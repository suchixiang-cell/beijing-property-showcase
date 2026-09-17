import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const dist = path.resolve('dist');
assert.equal((await stat(dist)).isDirectory(), true, 'dist 不存在，请先运行展示构建。');

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(target));
    else files.push(target);
  }
  return files;
}

const files = await walk(dist);
const indexFile = files.find(file => path.basename(file) === 'index.html');
assert.ok(indexFile, '构建缺少 index.html。');
assert.equal(files.some(file => /\.(sqlite|db|xlsx|log|map|pem|key)$/i.test(file)), false, '构建包含禁止的数据库、文档、日志、密钥或源码映射文件。');
const textFiles = files.filter(file => /\.(html|js|css|json|svg|txt)$/i.test(file));
const combined = (await Promise.all(textFiles.map(file => readFile(file, 'utf8')))).join('\n');
const forbidden = [
  'SESSION_SECRET', 'ADMIN_BOOTSTRAP', 'BEGIN PRIVATE KEY', 'Fictional-MVP',
  '/api/auth', '/api/properties', '/api/imports', 'api.tianditu.gov.cn',
  'better-sqlite3', 'sqlite::', 'Fastify', 'passwordHash', 'property_session',
  'MVP1-TEST-', '登录系统', '退出登录', '新增房产', '编辑房产', '导入 Excel', '作废房产', '重新定位',
];
for (const value of forbidden) assert.equal(combined.includes(value), false, `构建包含禁止内容：${value}`);
assert.equal(/tk=[A-Za-z0-9_-]{12,}/.test(combined), false, '构建包含疑似实际天地图 Key。');

const expectedBase = process.env.EXPECTED_SHOWCASE_BASE_PATH;
if (expectedBase) {
  const index = await readFile(indexFile, 'utf8');
  const escaped = expectedBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert.match(index, new RegExp(`${escaped}assets/`), '构建资源未使用预期 Pages base。');
}

const hosts = new Set([...combined.matchAll(/https:\/\/([A-Za-z0-9.-]+)/g)].map(match => match[1].toLowerCase()));
// MapLibre 产物包含项目与规范文档链接；浏览器网络审计会断言这些链接不产生请求
const allowedHosts = new Set([
  't4.tianditu.gov.cn', 'www.tianditu.gov.cn', 'www.w3.org',
  'github.com', 'maplibre.org', 'wiki.openstreetmap.org',
]);
for (const host of hosts) assert.equal(allowedHosts.has(host), true, `构建包含未批准网络主机：${host}`);

process.stdout.write(`PUBLIC ARTIFACT AUDIT PASS\nfiles=${files.length}\ntext_files=${textFiles.length}\nhosts=${[...hosts].sort().join(',') || 'none'}\n`);
