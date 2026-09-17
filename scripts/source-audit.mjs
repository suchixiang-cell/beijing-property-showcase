import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

const files = git('ls-files').split(/\r?\n/).filter(Boolean);
assert.ok(files.length > 0, '请先暂存公开仓库文件，再运行源代码审计。');

const allowedTopLevel = new Set([
  '.gitignore', 'README.md', 'PUBLIC_SHOWCASE_EXTRACTION_REPORT.md',
  'data', 'index.html', 'package-lock.json', 'package.json', 'scripts', 'src', 'vite.config.js',
]);
for (const file of files) {
  const topLevel = file.split('/')[0];
  assert.equal(allowedTopLevel.has(topLevel), true, `出现未批准顶层路径：${file}`);
  assert.doesNotMatch(file, /(^|\/)(server|migrations?|auth|database|coverage|dist|node_modules|test-results|playwright-report)(\/|$)/i, `出现禁止路径：${file}`);
  assert.doesNotMatch(file, /\.(db|sqlite|log|pem|key|xlsx|map)$/i, `出现禁止文件：${file}`);
}

const textFiles = files.filter(file => /(^|\/)([^/]+\.)?(html|js|mjs|css|json|md|txt)$/i.test(file));
const entries = await Promise.all(textFiles.map(async file => ({ file, text: await readFile(file, 'utf8') })));
const combined = entries.map(entry => entry.text).join('\n');
const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /tk=[A-Za-z0-9_-]{12,}/,
  /Bearer\s+[A-Za-z0-9._-]{12,}/i,
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
  /gh[pousr]_[A-Za-z0-9]{20,}/,
  /(?<!\d)\d{17}[0-9Xx](?!\d)/,
  /(?<!\d)1[3-9]\d{9}(?!\d)/,
];
for (const pattern of secretPatterns) assert.doesNotMatch(combined, pattern, `源代码出现疑似敏感值：${pattern}`);
assert.doesNotMatch(combined, /[A-Z]:\\Users\\/i, '源代码包含本地用户绝对路径。');

const runtime = entries.filter(entry => entry.file === 'index.html' || entry.file.startsWith('src/'))
  .map(entry => entry.text).join('\n');
assert.doesNotMatch(runtime, /\/api\b|api\.tianditu\.gov\.cn|search_v2|auth|session|sqlite|postgres|excel|geocod|password/i, '运行时代码包含禁止的业务或服务依赖。');
assert.doesNotMatch(runtime, /新增房产|编辑房产|导入 Excel|作废房产|重新定位|退出登录/, '运行时界面包含写入或账号操作。');

let history = '';
try { history = git('log', '--all', '--format=%H%n%s'); } catch { /* 首次提交前仓库没有历史 */ }
assert.doesNotMatch(history, /888ab0102643bd1af1065aa4d31bea074628bdd5|05aa8c1df16a16908626d4dddf456b65361ddc7f/, '新仓库继承了旧提交历史。');
const remotes = git('remote');
assert.equal(remotes, '', '本地公开仓库不得配置 remote。');

process.stdout.write(`PUBLIC SOURCE AUDIT PASS\ntracked_files=${files.length}\nremotes=0\n`);
