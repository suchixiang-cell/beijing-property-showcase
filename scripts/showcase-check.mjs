import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { collectFilterOptions, createSearchProjection, deriveLocationState, queryProperties } from '../src/query.js';
import { summarizeShowcaseProperties, validateShowcaseProperties } from '../src/data.js';
import { createTiandituStyle } from '../src/tianditu.js';

const raw = JSON.parse(await readFile(new URL('../data/properties.showcase.json', import.meta.url), 'utf8'));
const properties = validateShowcaseProperties(raw);
const emptyFilters = {
  districts: new Set(), ownershipUnits: new Set(), propertyTypes: new Set(), usageStatuses: new Set(), locationStatuses: new Set(),
  appliedAreaMin: null, appliedAreaMax: null,
};

function rejected(mutator, expected) {
  const clone = structuredClone(raw);
  mutator(clone);
  assert.throws(() => validateShowcaseProperties(clone), expected);
}

test('1. dataset contains exactly ten explicitly fictional records', () => {
  assert.equal(properties.length, 10);
  assert.ok(properties.every(property => property.is_fictional && property.fictional_marker === 'FICTIONAL_SHOWCASE_ONLY'));
  assert.ok(properties.every(property => /^DEMO-BJ-\d{3}$/.test(property.property_code)));
});

test('2. dataset covers six districts, five property types and multiple statuses', () => {
  assert.equal(new Set(properties.map(property => property.district)).size, 6);
  assert.deepEqual(new Set(properties.map(property => property.property_type)), new Set(['住宅', '办公', '商业', '车位', '库房']));
  assert.ok(new Set(properties.map(property => property.usage_status)).size >= 5);
});

test('3. summary metrics remain 10/8/2 and 6081.8 square metres', () => {
  assert.deepEqual(summarizeShowcaseProperties(properties), { total: 10, located: 8, unlocated: 2, area: 6081.8 });
});

test('4. duplicate codes are rejected', () => {
  rejected(items => { items[1].property_code = items[0].property_code; }, /重复/);
});

test('5. invalid controlled values are rejected', () => {
  rejected(items => { items[0].property_type = '酒店'; }, /房产类型/);
  rejected(items => { items[0].usage_status = '未知状态'; }, /使用状态/);
  rejected(items => { items[0].district = '虚构区'; }, /行政区/);
});

test('6. invalid or inconsistent synthetic coordinates are rejected', () => {
  rejected(items => { items[0].longitude = 121; }, /超出北京展示范围/);
  rejected(items => { items[8].longitude = 116.4; }, /同时存在或同时为空/);
  rejected(items => { items[0].coordinate_source = null; }, /合成展示坐标/);
});

test('7. fictional markers and synthetic naming are mandatory', () => {
  rejected(items => { items[0].fictional_marker = ''; }, /虚构展示标记/);
  rejected(items => { items[0].ownership_unit = '普通产权单位'; }, /未显式标记为虚构/);
});

test('8. local search finds name, code and ownership text', () => {
  const projections = new Map(properties.map(property => [property.property_id, createSearchProjection(property)]));
  for (const queryText of ['晨星家园', 'DEMO-BJ-005', '产权单位丁']) {
    assert.ok(queryProperties(properties, { queryText, filters: emptyFilters, projections }).matches.length >= 1, queryText);
  }
});

test('9. filters cover district, ownership, type, status and location', () => {
  const options = collectFilterOptions(properties);
  assert.ok(options.districts.includes('朝阳区'));
  assert.ok(options.ownershipUnits.includes('虚构演示产权单位甲'));
  assert.ok(options.propertyTypes.includes('住宅'));
  assert.ok(options.usageStatuses.includes('维修中'));
  const filtered = queryProperties(properties, {
    filters: { ...emptyFilters, propertyTypes: new Set(['住宅']), locationStatuses: new Set(['unlocated']) },
    getEffectiveLocationState: deriveLocationState,
  });
  assert.equal(filtered.matches.length, 1);
  assert.equal(filtered.matches[0].property_code, 'DEMO-BJ-009');
});

test('10. runtime entry has no backend, authentication, Search V2 or writable dependency', async () => {
  const runtimeFiles = ['main.js', 'map.js', 'ui.js', 'query.js', 'detail.js', 'basemap.js', 'tianditu.js'];
  const runtime = (await Promise.all(runtimeFiles.map(file => readFile(new URL(`../src/${file}`, import.meta.url), 'utf8')))).join('\n');
  assert.doesNotMatch(runtime, /\/api\b|auth|session|sqlite|postgres|excel|search_v2|geocod|beginVerification|drag/i);
});

test('11. static HTML contains approved wording and no writable controls', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /login|logout|password|新增房产|编辑房产|导入 Excel|作废房产|重新定位|PHASE|debug/i);
  assert.match(html, /集团在京房产智能管理系统/);
  assert.match(html, /DEMO ONLY · 测试版/);
  assert.match(html, /全部房产数据均为虚构演示数据/);
  assert.match(html, /成果展示版 · 仅供功能演示/);
  assert.doesNotMatch(html, /只读成果展示 · 所有交互仅用于浏览虚构房产分布/);
});

test('12. read-only detail exposes approved fields without mutation metadata', async () => {
  const detail = await readFile(new URL('../src/detail.js', import.meta.url), 'utf8');
  assert.doesNotMatch(detail, /version|updated_by|database|编辑|作废|重新定位/i);
  for (const label of ['房产编号', '产权单位', '行政区', '地址概要', '房产类型', '建筑面积', '使用状态', '责任部门', '维护责任人', '定位状态']) {
    assert.match(detail, new RegExp(label));
  }
});

test('13. Vite config supports root and future Pages base without proxy', async () => {
  const config = await readFile(new URL('../vite.config.js', import.meta.url), 'utf8');
  assert.doesNotMatch(config, /proxy\s*:|github\.io|驾驶舱/);
  assert.match(config, /SHOWCASE_BASE_PATH/);
  assert.match(config, /VITE_TIANDITU_SHOWCASE_KEY/);
});

test('14. missing showcase key produces no external basemap style', () => {
  assert.equal(createTiandituStyle(''), null);
  assert.equal(createTiandituStyle('YOUR_TIANDITU_KEY'), null);
});

test('15. package manifest contains only approved minimal dependencies', async () => {
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.deepEqual(Object.keys(manifest.dependencies), ['maplibre-gl']);
  assert.deepEqual(Object.keys(manifest.devDependencies), ['vite']);
});
