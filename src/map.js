import * as maplibregl from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { attachBasemapStatus } from './basemap.js';
import { formatBuildingArea } from './format.js';
import { formatShowcaseAddress } from './data.js';

// 静态展示使用独立只读地图适配层，不引入位置核验、搜索或写入能力
maplibregl.setWorkerUrl(maplibreWorkerUrl);

const TYPE_CLASS = Object.freeze({
  住宅: 'residential', 办公: 'office', 商业: 'commercial',
  车位: 'parking', 库房: 'warehouse', 其他: 'other',
});

function popupRow(label, value) {
  const item = document.createElement('div');
  item.className = 'popup-row';
  const term = document.createElement('dt');
  term.textContent = label;
  const description = document.createElement('dd');
  description.textContent = value;
  item.append(term, description);
  return item;
}

function createPopup(property, onViewDetails) {
  const content = document.createElement('article');
  content.className = 'property-popup';
  const eyebrow = document.createElement('span');
  eyebrow.className = 'popup-id';
  eyebrow.textContent = `${property.property_code} · 虚构演示数据`;
  const title = document.createElement('strong');
  title.className = 'popup-title';
  title.textContent = property.property_name;
  const address = document.createElement('p');
  address.className = 'popup-address';
  address.textContent = formatShowcaseAddress(property) || '地址信息待补充';
  const details = document.createElement('dl');
  details.className = 'popup-details';
  details.append(
    popupRow('概况', `${property.property_type} · ${property.usage_status} · ${formatBuildingArea(property.building_area)}`),
    popupRow('区域', property.district),
    popupRow('位置状态', '演示定位'),
  );
  const action = document.createElement('button');
  action.type = 'button';
  action.className = 'popup-detail-action';
  action.textContent = '查看详情';
  action.addEventListener('click', event => {
    event.stopPropagation();
    onViewDetails(property.property_id, action);
  });
  content.append(eyebrow, title, address, details, action);
  return content;
}

export function createShowcaseMap(container, properties, onMarkerSelect, onBasemapStatus, onViewDetails, config) {
  const markers = new Map();
  const propertyById = new Map(properties.map(property => [property.property_id, property]));
  let visibleIds = new Set(propertyById.keys());
  const neutralCamera = { center: config.center, zoom: config.zoom };
  const map = new maplibregl.Map({
    container,
    style: config.style,
    center: config.center,
    zoom: config.zoom,
    minZoom: config.minZoom,
    maxZoom: config.maxZoom,
    attributionControl: { compact: false, customAttribution: config.attribution },
  });
  attachBasemapStatus(map, config.hasConfiguredBasemap, onBasemapStatus);
  map.addControl(new maplibregl.NavigationControl(), 'top-right');

  function closeOtherPopups(propertyId = null) {
    markers.forEach(({ marker }, markerId) => {
      if (markerId !== propertyId) marker.getPopup()?.remove();
    });
  }

  properties.forEach(property => {
    if (!Number.isFinite(property.longitude) || !Number.isFinite(property.latitude)) return;
    const element = document.createElement('button');
    element.type = 'button';
    element.className = `property-marker marker-type-${TYPE_CLASS[property.property_type] ?? 'other'} usage-${property.usage_status} is-verified`;
    element.dataset.propertyId = property.property_id;
    element.textContent = '✓';
    element.setAttribute('aria-label', `${property.property_type}房产，${property.property_name}，虚构演示坐标`);
    const popup = new maplibregl.Popup({ offset: 18, maxWidth: '280px', focusAfterOpen: false })
      .setDOMContent(createPopup(property, onViewDetails));
    const marker = new maplibregl.Marker({ element })
      .setLngLat([property.longitude, property.latitude])
      .setPopup(popup)
      .addTo(map);
    element.addEventListener('click', event => {
      event.stopImmediatePropagation();
      if (!visibleIds.has(property.property_id)) return;
      closeOtherPopups(property.property_id);
      if (!popup.isOpen()) marker.togglePopup();
      onMarkerSelect(property.property_id, element, event);
    });
    markers.set(property.property_id, { marker, element });
  });

  const resizeObserver = new ResizeObserver(() => map.resize());
  resizeObserver.observe(map.getContainer());
  map.once('remove', () => resizeObserver.disconnect());

  function setSelected(propertyId) {
    markers.forEach(({ element }, markerId) => {
      const selected = markerId === propertyId;
      element.classList.toggle('is-selected', selected);
      element.setAttribute('aria-pressed', String(selected));
      const property = propertyById.get(markerId);
      element.setAttribute('aria-label', `${property.property_type}房产，${property.property_name}，${selected ? '已选中，' : ''}虚构演示坐标`);
    });
  }

  function setVisibleProperties(ids) {
    visibleIds = ids;
    markers.forEach(({ marker, element }, markerId) => {
      const visible = ids.has(markerId);
      element.classList.toggle('is-hidden', !visible);
      element.disabled = !visible;
      if (!visible) marker.getPopup()?.remove();
    });
  }

  function closePopup(propertyId) {
    if (propertyId) markers.get(propertyId)?.marker.getPopup()?.remove();
    else closeOtherPopups();
  }

  function fitVisibleProperties(ids, animated = true) {
    const located = [...ids].map(id => propertyById.get(id))
      .filter(property => Number.isFinite(property?.longitude) && Number.isFinite(property?.latitude));
    closeOtherPopups();
    if (!located.length) {
      map.easeTo({ ...neutralCamera, duration: animated ? 500 : 0 });
      return false;
    }
    if (located.length === 1) {
      map.flyTo({ center: [located[0].longitude, located[0].latitude], zoom: 13, duration: animated ? 700 : 0, essential: true });
      return true;
    }
    const bounds = new maplibregl.LngLatBounds();
    located.forEach(property => bounds.extend([property.longitude, property.latitude]));
    map.fitBounds(bounds, {
      padding: { top: 70, right: 55, bottom: 65, left: 55 },
      maxZoom: 11.3,
      duration: animated ? 700 : 0,
    });
    return true;
  }

  function focusProperty(propertyId) {
    const property = propertyById.get(propertyId);
    const entry = markers.get(propertyId);
    if (!property || !entry) return;
    closeOtherPopups(propertyId);
    map.flyTo({ center: [property.longitude, property.latitude], zoom: 13, duration: 700, essential: true });
    if (!entry.marker.getPopup()?.isOpen()) entry.marker.togglePopup();
  }

  function ensurePropertyVisible(propertyId) {
    const property = propertyById.get(propertyId);
    if (!property) return;
    const point = map.project([property.longitude, property.latitude]);
    const canvas = map.getContainer();
    if (point.x < 35 || point.y < 35 || point.x > canvas.clientWidth - 35 || point.y > canvas.clientHeight - 35) {
      map.jumpTo({ center: [property.longitude, property.latitude] });
    }
  }

  fitVisibleProperties(visibleIds, false);
  return {
    map,
    hasConfiguredBasemap: config.hasConfiguredBasemap,
    focusProperty,
    setSelected,
    setVisibleProperties,
    fitVisibleProperties,
    closePopup,
    ensurePropertyVisible,
  };
}
