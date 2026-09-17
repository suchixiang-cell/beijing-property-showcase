import 'maplibre-gl/dist/maplibre-gl.css';
import './styles.css';
import './showcase.css';
import rawProperties from '../data/properties.showcase.json';
import { getBasemapConfig } from './basemap.js';
import { formatBuildingArea } from './format.js';
import {
  LOCATION_STATUS,
  collectFilterOptions,
  countActiveFilters,
  createSearchProjection,
  deriveLocationState,
  getResultOverview,
  queryProperties,
} from './query.js';
import { createPropertyFilters, createPropertyList, createSearch } from './ui.js';
import { createShowcasePropertyDetail } from './detail.js';
import { summarizeShowcaseProperties, validateShowcaseProperties } from './data.js';
import { createShowcaseMap } from './map.js';

function renderFatal(error) {
  const panel = document.createElement('main');
  panel.className = 'showcase-fatal';
  const heading = document.createElement('h1');
  heading.textContent = '展示数据无法加载';
  const message = document.createElement('p');
  message.textContent = error.message;
  panel.append(heading, message);
  document.body.replaceChildren(panel);
}

let properties;
try {
  properties = validateShowcaseProperties(rawProperties);
} catch (error) {
  renderFatal(error);
  throw error;
}

const propertyById = id => properties.find(property => property.property_id === id) ?? null;
const getLocationState = property => {
  const state = deriveLocationState(property);
  return { ...state, label: state.status === LOCATION_STATUS.UNLOCATED ? '未定位' : '演示定位' };
};
const projections = new Map(properties.map(property => [property.property_id, createSearchProjection(property)]));
const workspace = document.querySelector('.workspace');
const stage = document.querySelector('.property-stage');
const detailElement = document.querySelector('#property-detail');
const listContainer = document.querySelector('#property-list');
const searchInput = document.querySelector('#property-search');
const resultHeading = document.querySelector('#result-heading');
const resultCount = document.querySelector('#result-count');
const resultSummary = document.querySelector('#result-summary');
const mobileMapViewButton = document.querySelector('#mobile-map-view');
const mobileListViewButton = document.querySelector('#mobile-list-view');
const mobileListCount = document.querySelector('#mobile-list-count');
const fitResultsButton = document.querySelector('#fit-results');
const mapResultStatus = document.querySelector('#map-result-status');
const unlocatedSelection = document.querySelector('#unlocated-selection');
const announcement = document.querySelector('#showcase-announcement');
let selectedId = null;
let appliedSearchText = '';
let currentQuery = null;
let primaryView = 'map';

function isNarrowView() {
  return window.matchMedia('(max-width: 800px)').matches;
}

function setPrimaryView(view) {
  primaryView = view === 'list' ? 'list' : 'map';
  workspace.classList.toggle('mobile-view-map', primaryView === 'map');
  workspace.classList.toggle('mobile-view-list', primaryView === 'list');
  mobileMapViewButton.setAttribute('aria-pressed', String(primaryView === 'map'));
  mobileListViewButton.setAttribute('aria-pressed', String(primaryView === 'list'));
  if (primaryView === 'map') requestAnimationFrame(() => mapController.map.resize());
}

function closeDetail() {
  stage.classList.remove('has-detail');
  workspace.classList.remove('detail-open');
  detailElement.removeAttribute('role');
  detailElement.removeAttribute('aria-modal');
  requestAnimationFrame(() => mapController.map.resize());
}

const detail = createShowcasePropertyDetail(detailElement, closeDetail);

function openDetail(propertyId, opener) {
  const property = propertyById(propertyId);
  if (!property) return;
  if (isNarrowView()) mapController.map.stop();
  mapController.closePopup(propertyId);
  detail.render(property, getLocationState(property), opener);
  stage.classList.add('has-detail');
  workspace.classList.add('detail-open');
  if (isNarrowView()) {
    detailElement.setAttribute('role', 'dialog');
    detailElement.setAttribute('aria-modal', 'true');
  }
  requestAnimationFrame(() => {
    mapController.map.resize();
    if (!isNarrowView() && getLocationState(property).status !== LOCATION_STATUS.UNLOCATED) {
      mapController.ensurePropertyVisible(propertyId);
    }
    detail.focusHeading();
  });
}

function clearSelection() {
  if (selectedId) mapController.closePopup(selectedId);
  selectedId = null;
  propertyList.setSelected(null);
  mapController.setSelected(null);
  detail.close();
  mapResultStatus.hidden = true;
  unlocatedSelection.hidden = true;
}

function showUnlocated(property) {
  const renderMessage = container => {
    container.replaceChildren(document.createTextNode(`${property.property_name}尚未定位，地图上没有展示点位。`));
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'showcase-map-status-action';
    button.textContent = '查看详情';
    button.addEventListener('click', () => openDetail(property.property_id, button));
    container.append(button);
    container.hidden = false;
  };
  renderMessage(mapResultStatus);
  renderMessage(unlocatedSelection);
}

function restoreMapStatus() {
  unlocatedSelection.hidden = true;
  unlocatedSelection.replaceChildren();
  const overview = currentQuery ? getResultOverview(currentQuery.summary) : { message: '' };
  mapResultStatus.textContent = overview.message;
  mapResultStatus.hidden = !overview.message;
}

function selectProperty(propertyId, { source = 'list', opener = null } = {}) {
  const property = propertyById(propertyId);
  if (!property) return;
  selectedId = propertyId;
  propertyList.setSelected(propertyId, source === 'map');
  mapController.setSelected(propertyId);
  detail.close();
  const location = getLocationState(property);
  if (source === 'list' && isNarrowView()) setPrimaryView('map');
  if (location.status === LOCATION_STATUS.UNLOCATED) showUnlocated(property);
  else {
    restoreMapStatus();
    if (source === 'list') mapController.focusProperty(propertyId);
  }
  if (opener) announcement.textContent = `已选择${property.property_name}。`;
}

const mapConfig = getBasemapConfig({ VITE_TIANDITU_KEY: import.meta.env.VITE_TIANDITU_SHOWCASE_KEY });
const mapController = createShowcaseMap('map', properties, (propertyId, opener) => {
  selectProperty(propertyId, { source: 'map', opener });
}, status => {
  const notice = document.querySelector('#basemap-notice');
  const messages = {
    'missing-key': '底图暂未启用；当前仍可浏览虚构演示点位。',
    loading: '正在加载地图底图与注记…',
    failed: '底图暂时无法显示；虚构演示点位和列表仍可浏览。',
  };
  notice.textContent = messages[status] ?? '';
  notice.hidden = status === 'ready';
  document.querySelector('.map-grid').hidden = status === 'ready' || status === 'loading';
}, openDetail, mapConfig);

function clearAllConditions() {
  searchInput.value = '';
  appliedSearchText = '';
  propertyFilters.clear();
  searchInput.focus();
}

const propertyList = createPropertyList(listContainer, (propertyId, opener) => {
  selectProperty(propertyId, { source: 'list', opener });
}, clearAllConditions, getLocationState);
const propertyFilters = createPropertyFilters(document.querySelector('#property-filters'), filters => applyQuery(filters));
const filterOptions = collectFilterOptions(properties);
filterOptions.locationStatuses = [LOCATION_STATUS.LOCATED, LOCATION_STATUS.UNLOCATED];
propertyFilters.refreshOptions(filterOptions);

function formatResultSummary(summary) {
  const located = summary.verified + summary.unverified;
  return `当前 ${summary.result} 套 · 已定位 ${located} · 未定位 ${summary.unlocated} · 建筑面积 ${formatBuildingArea(summary.area)}`;
}

function applyQuery(filters = propertyFilters.getState()) {
  currentQuery = queryProperties(properties, {
    queryText: appliedSearchText,
    filters,
    projections,
    getEffectiveLocationState: getLocationState,
  });
  propertyList.render(currentQuery.matches);
  mapController.setVisibleProperties(currentQuery.resultIds);
  const hasFilters = countActiveFilters(filters) > 0;
  resultHeading.textContent = hasFilters ? '筛选结果' : appliedSearchText.trim() ? '搜索结果' : '全部房产';
  resultCount.textContent = `共 ${currentQuery.summary.result} 套`;
  mobileListCount.textContent = String(currentQuery.summary.result);
  resultSummary.textContent = formatResultSummary(currentQuery.summary);
  restoreMapStatus();
  if (selectedId && !currentQuery.resultIds.has(selectedId)) clearSelection();
  else if (selectedId) propertyList.setSelected(selectedId);
  mapController.fitVisibleProperties(currentQuery.resultIds);
}

const metrics = summarizeShowcaseProperties(properties);
document.querySelector('#metric-total').textContent = `${metrics.total} 套`;
document.querySelector('#metric-located').textContent = `${metrics.located} 套`;
document.querySelector('#metric-unlocated').textContent = `${metrics.unlocated} 套`;
document.querySelector('#metric-area').textContent = formatBuildingArea(metrics.area);

createSearch(searchInput, value => { appliedSearchText = value; applyQuery(); });
mobileMapViewButton.addEventListener('click', () => setPrimaryView('map'));
mobileListViewButton.addEventListener('click', () => setPrimaryView('list'));
fitResultsButton.addEventListener('click', () => mapController.fitVisibleProperties(currentQuery.resultIds));
document.addEventListener('keydown', event => {
  if (event.key === '/' && event.target !== searchInput) {
    event.preventDefault();
    searchInput.focus();
  } else if (event.key === 'Escape' && detail.isOpen) {
    event.preventDefault();
    detail.close();
  }
});

setPrimaryView('map');
applyQuery();
