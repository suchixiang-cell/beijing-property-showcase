export const SHOWCASE_FICTIONAL_MARKER = 'FICTIONAL_SHOWCASE_ONLY';
const BEIJING_BOUNDS = Object.freeze({ west: 115.4, east: 117.6, south: 39.4, north: 41.1 });
// 展示入口只保留静态数据校验所需的受控值，避免把业务导入目录与示例内容打入公开产物
const PROPERTY_TYPES = Object.freeze(['住宅', '办公', '商业', '车位', '库房', '其他']);
const USAGE_STATUSES = Object.freeze(['自用', '出租', '闲置', '借用', '维修中', '其他']);
const BEIJING_DISTRICTS = Object.freeze([
  '东城区', '西城区', '朝阳区', '丰台区', '石景山区', '海淀区', '门头沟区', '房山区',
  '通州区', '顺义区', '昌平区', '大兴区', '怀柔区', '平谷区', '密云区', '延庆区',
]);
const requiredTextFields = Object.freeze([
  'property_code', 'property_name', 'ownership_unit', 'district', 'street_township',
  'community_name', 'property_type', 'usage_status', 'maintenance_department',
  'maintenance_responsible_person',
]);

function validationError(message) {
  const error = new Error(`展示数据校验失败：${message}`);
  error.name = 'ShowcaseDataValidationError';
  return error;
}

function isFictionalText(value) {
  return /虚构|演示/.test(String(value ?? ''));
}

function validateCoordinates(property) {
  const hasLongitude = Number.isFinite(property.longitude);
  const hasLatitude = Number.isFinite(property.latitude);
  if (hasLongitude !== hasLatitude) throw validationError(`${property.property_code} 的经纬度必须同时存在或同时为空。`);
  if (!hasLongitude) {
    if (property.coordinate_source !== null || property.coordinate_verified !== false) {
      throw validationError(`${property.property_code} 的未定位状态不一致。`);
    }
    return false;
  }
  if (property.longitude < BEIJING_BOUNDS.west || property.longitude > BEIJING_BOUNDS.east ||
      property.latitude < BEIJING_BOUNDS.south || property.latitude > BEIJING_BOUNDS.north) {
    throw validationError(`${property.property_code} 的演示坐标超出北京展示范围。`);
  }
  if (property.coordinate_source !== 'synthetic_showcase' || property.coordinate_verified !== true) {
    throw validationError(`${property.property_code} 的已定位状态必须明确标记为合成展示坐标。`);
  }
  return true;
}

export function validateShowcaseProperties(input) {
  if (!Array.isArray(input) || input.length < 8 || input.length > 12) {
    throw validationError('记录数量必须在 8–12 条之间。');
  }
  const codes = new Set();
  const ids = new Set();
  let located = 0;
  let unlocated = 0;

  const normalized = input.map((source, index) => {
    const property = { ...source };
    const label = property.property_code || `第 ${index + 1} 条记录`;
    if (property.is_fictional !== true || property.fictional_marker !== SHOWCASE_FICTIONAL_MARKER) {
      throw validationError(`${label} 缺少明确的虚构展示标记。`);
    }
    const missing = requiredTextFields.find(key => !String(property[key] ?? '').trim());
    if (missing) throw validationError(`${label} 缺少字段 ${missing}。`);
    if (!/^DEMO-BJ-\d{3}$/.test(property.property_code)) throw validationError(`${label} 的房产编号不是演示专用格式。`);
    if (codes.has(property.property_code)) throw validationError(`房产编号 ${property.property_code} 重复。`);
    if (!property.property_id || ids.has(property.property_id)) throw validationError(`${label} 的内部演示标识无效或重复。`);
    if (!PROPERTY_TYPES.includes(property.property_type)) throw validationError(`${label} 的房产类型不受支持。`);
    if (!USAGE_STATUSES.includes(property.usage_status)) throw validationError(`${label} 的使用状态不受支持。`);
    if (!BEIJING_DISTRICTS.includes(property.district)) throw validationError(`${label} 的行政区不在受控词表中。`);
    if (!Number.isFinite(property.building_area) || property.building_area <= 0) throw validationError(`${label} 的建筑面积无效。`);
    if (![property.property_name, property.ownership_unit, property.street_township, property.community_name,
      property.maintenance_department, property.maintenance_responsible_person].every(isFictionalText)) {
      throw validationError(`${label} 的名称、单位、地址或人员字段未显式标记为虚构。`);
    }
    if (property.property_type === '住宅') {
      if (!Number.isInteger(property.bedroom_count) || property.bedroom_count < 0 || property.bedroom_count > 20) {
        throw validationError(`${label} 的住宅居室数无效。`);
      }
      if (typeof property.has_elevator !== 'boolean') throw validationError(`${label} 的住宅电梯状态无效。`);
    } else if (property.bedroom_count !== null || property.has_elevator !== null) {
      throw validationError(`${label} 的非住宅记录不得填写住宅专用字段。`);
    }
    if (validateCoordinates(property)) located += 1;
    else unlocated += 1;
    codes.add(property.property_code);
    ids.add(property.property_id);
    return Object.freeze(property);
  });

  if (located !== 8 || unlocated !== 2) throw validationError(`应包含 8 条已定位和 2 条未定位记录，当前为 ${located}/${unlocated}。`);
  return Object.freeze(normalized);
}

export function summarizeShowcaseProperties(properties) {
  return properties.reduce((summary, property) => {
    const located = Number.isFinite(property.longitude) && Number.isFinite(property.latitude);
    summary.total += 1;
    summary.area += property.building_area;
    summary[located ? 'located' : 'unlocated'] += 1;
    return summary;
  }, { total: 0, located: 0, unlocated: 0, area: 0 });
}

export function formatShowcaseAddress(property) {
  return [property.district, property.street_township, property.community_name, property.building_no, property.full_address]
    .map(value => String(value ?? '').trim()).filter(Boolean).join(' · ');
}
