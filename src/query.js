export const MISSING_OWNERSHIP = '__MISSING_OWNERSHIP__';

export const LOCATION_STATUS = Object.freeze({
  LOCATED: 'located',
  UNLOCATED: 'unlocated',
});

export const LOCATION_STATUS_LABELS = Object.freeze({
  [LOCATION_STATUS.LOCATED]: '演示定位',
  [LOCATION_STATUS.UNLOCATED]: '未定位',
});

export function normalizeSearchText(value) {
  return String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('zh-CN');
}

export function getOwnership(property) {
  return String(property.ownership_unit ?? '').trim() || null;
}

export function deriveLocationState(property) {
  const located = Number.isFinite(property?.longitude) && Number.isFinite(property?.latitude);
  const status = located ? LOCATION_STATUS.LOCATED : LOCATION_STATUS.UNLOCATED;
  return {
    longitude: located ? property.longitude : null,
    latitude: located ? property.latitude : null,
    status,
    label: LOCATION_STATUS_LABELS[status],
  };
}

export function createSearchProjection(property) {
  return normalizeSearchText([
    property.property_name,
    property.full_address,
    property.community_name,
    property.street_township,
    property.building_no,
    property.unit_no,
    property.room_no,
    getOwnership(property),
    property.property_code,
  ].join(' '));
}

function selected(values, value) {
  return !(values?.size) || values.has(value);
}

export function queryProperties(properties, options = {}) {
  const filters = options.filters ?? {};
  const tokens = normalizeSearchText(options.queryText).split(' ').filter(Boolean);
  const getLocation = options.getEffectiveLocationState ?? deriveLocationState;
  const projections = options.projections ?? new Map(properties.map(property => [property.property_id, createSearchProjection(property)]));
  const matches = [];
  let located = 0;
  let unlocated = 0;
  let area = 0;

  properties.forEach(property => {
    const location = getLocation(property);
    const ownership = getOwnership(property) ?? MISSING_OWNERSHIP;
    const searchable = projections.get(property.property_id) ?? createSearchProjection(property);
    if (!tokens.every(token => searchable.includes(token))) return;
    if (!selected(filters.districts, property.district)) return;
    if (!selected(filters.ownershipUnits, ownership)) return;
    if (!selected(filters.propertyTypes, property.property_type)) return;
    if (!selected(filters.usageStatuses, property.usage_status)) return;
    if (!selected(filters.locationStatuses, location.status)) return;
    if (filters.appliedAreaMin !== null && filters.appliedAreaMin !== undefined && property.building_area < filters.appliedAreaMin) return;
    if (filters.appliedAreaMax !== null && filters.appliedAreaMax !== undefined && property.building_area > filters.appliedAreaMax) return;
    matches.push(property);
    if (location.status === LOCATION_STATUS.LOCATED) located += 1;
    else unlocated += 1;
    area += property.building_area;
  });

  return {
    matches,
    resultIds: new Set(matches.map(property => property.property_id)),
    summary: { result: matches.length, total: properties.length, verified: located, unverified: 0, unlocated, area },
  };
}

export function collectFilterOptions(properties) {
  const values = key => [...new Set(properties.map(property => property[key]).filter(value => String(value ?? '').trim()))]
    .sort((left, right) => String(left).localeCompare(String(right), 'zh-CN'));
  return {
    districts: values('district'),
    ownershipUnits: values('ownership_unit'),
    propertyTypes: values('property_type'),
    usageStatuses: values('usage_status'),
    locationStatuses: [LOCATION_STATUS.LOCATED, LOCATION_STATUS.UNLOCATED],
  };
}

export function countActiveFilters(filters) {
  return ['districts', 'ownershipUnits', 'propertyTypes', 'usageStatuses', 'locationStatuses']
    .reduce((count, key) => count + (filters[key]?.size ?? 0), 0) +
    Number(filters.appliedAreaMin !== null && filters.appliedAreaMin !== undefined) +
    Number(filters.appliedAreaMax !== null && filters.appliedAreaMax !== undefined);
}

export function getResultOverview(summary) {
  const located = summary.verified + summary.unverified;
  if (summary.result === 0) return { message: '当前条件下暂无匹配房产' };
  if (located === 0) return { message: `${summary.result}套房产符合条件，其中${summary.unlocated}套尚未定位，地图暂无可显示点位` };
  if (located === 1) return { message: summary.unlocated ? `当前${summary.result}套结果 · 地图显示1套 · ${summary.unlocated}套未定位` : '' };
  return { message: summary.unlocated ? `当前${summary.result}套结果 · 地图显示${located}套 · ${summary.unlocated}套未定位` : '' };
}
