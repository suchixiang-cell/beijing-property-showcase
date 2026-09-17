import assert from 'node:assert/strict';

const debugOrigin = process.env.SHOWCASE_BROWSER_DEBUG_ORIGIN ?? 'http://127.0.0.1:9227';
const appOrigin = process.env.SHOWCASE_APP_ORIGIN ?? 'http://127.0.0.1:4177/';
const targets = await fetch(`${debugOrigin}/json/list`).then(response => response.json());
const target = targets.find(item => item.type === 'page' && item.url.startsWith(appOrigin)) ?? targets.find(item => item.type === 'page');
if (!target) throw new Error('找不到展示版本地测试页面。');
const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
const results = [];
let sequence = 0;
let apiRequests = 0;
let externalRequests = 0;
let interceptionError = null;

await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => reject(new Error(`${method} 超时。`)), 15_000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.id) {
    const item = pending.get(message.id);
    if (!item) return;
    pending.delete(message.id);
    clearTimeout(item.timer);
    message.error ? item.reject(new Error(message.error.message)) : item.resolve(message.result);
    return;
  }
  if (message.method !== 'Fetch.requestPaused') return;
  const url = new URL(message.params.request.url);
  let work;
  if (url.origin === new URL(appOrigin).origin || ['data:', 'blob:'].includes(url.protocol)) {
    if (url.pathname.startsWith('/api')) apiRequests += 1;
    work = send('Fetch.continueRequest', { requestId: message.params.requestId });
  } else {
    externalRequests += 1;
    work = send('Fetch.failRequest', { requestId: message.params.requestId, errorReason: 'BlockedByClient' });
  }
  work.catch(error => { if (!/Invalid InterceptionId/.test(error.message)) interceptionError = error; });
});

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
}

async function waitFor(expression) {
  const script = `(async()=>{const end=Date.now()+12000;while(Date.now()<end){if(${expression})return true;await new Promise(resolve=>setTimeout(resolve,50));}return false;})()`;
  assert.equal(await evaluate(script), true, expression);
}

function record(name, value) {
  results.push(name);
  assert.equal(Boolean(value), true, name);
}

async function viewport(width, height) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 800 });
}

try {
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
  await viewport(1366, 768);
  await send('Page.navigate', { url: appOrigin });
  await waitFor(`document.querySelectorAll('.property-card').length===10 && document.querySelectorAll('.property-marker').length===8`);

  record('1. leadership summary shows 10/8/2 and total area', await evaluate(`document.querySelector('#metric-total').textContent==='10 套'&&document.querySelector('#metric-located').textContent==='8 套'&&document.querySelector('#metric-unlocated').textContent==='2 套'&&document.querySelector('#metric-area').textContent.includes('6,081.8')`));
  record('2. title, DEMO badge and fictional-data statement are visible', await evaluate(`document.querySelector('h1').textContent==='集团在京房产智能管理系统'&&document.querySelector('.demo-badge').textContent.includes('DEMO ONLY')&&document.body.textContent.includes('全部房产数据均为虚构演示数据')`));
  record('3. no business mutation controls are present', await evaluate(`!document.querySelector('dialog,#auth-shell,#login-form,#logout-button,#create-property,#open-excel-import,#property-detail-edit,#property-detail-retire')`));

  await evaluate(`(()=>{const input=document.querySelector('#property-search');input.value='DEMO-BJ-009';input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await waitFor(`document.querySelectorAll('.property-card').length===1`);
  record('4. local search finds an unlocated demonstration property', await evaluate(`document.querySelector('.property-card').textContent.includes('榆光住宅')`));
  await evaluate(`document.querySelector('.property-card').click()`);
  record('5. unlocated selection remains readable without creating a marker', await evaluate(`!document.querySelector('#map-result-status').hidden&&document.querySelector('#map-result-status').textContent.includes('尚未定位')&&document.querySelectorAll('.property-marker').length===8`));
  await evaluate(`document.querySelector('#map-result-status button').click()`);
  record('6. read-only detail exposes business fields without mutation actions', await evaluate(`!document.querySelector('#property-detail').hidden&&document.querySelector('#property-detail-content').textContent.includes('运维责任')&&![...document.querySelectorAll('#property-detail button')].some(button=>/编辑|作废|定位|保存|导入/.test(button.textContent))`));
  await evaluate(`document.querySelector('#property-detail-close').click();const input=document.querySelector('#property-search');input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));`);
  await waitFor(`document.querySelectorAll('.property-card').length===10`);

  await evaluate(`document.querySelector('[data-filter-trigger="propertyTypes"]').click();[...document.querySelectorAll('[data-filter-group="propertyTypes"] input')].find(input=>input.value==='住宅').click();document.querySelector('[data-filter-apply]').click()`);
  await waitFor(`document.querySelectorAll('.property-card').length===3`);
  record('7. property-type filter works entirely in the browser', await evaluate(`document.querySelector('#result-count').textContent==='共 3 套'`));
  await evaluate(`document.querySelector('#clear-filters').click()`);
  await waitFor(`document.querySelectorAll('.property-card').length===10`);

  for (const [width, height] of [[375, 812], [389, 812], [400, 608], [1366, 768], [1440, 1000]]) {
    await viewport(width, height);
    await evaluate(`window.dispatchEvent(new Event('resize'))`);
    const mobile = width < 800;
    if (mobile) {
      await evaluate(`document.querySelector('#mobile-list-view').click()`);
      await waitFor(`getComputedStyle(document.querySelector('.property-sidebar')).display!=='none'`);
    }
    record(`8. no horizontal overflow at ${width}x${height}`, await evaluate(`document.documentElement.scrollWidth<=innerWidth+1`));
    record(`9. title and DEMO indicator remain visible at ${width}x${height}`, await evaluate(`(()=>{const title=document.querySelector('h1').getBoundingClientRect();const badge=document.querySelector('.demo-badge').getBoundingClientRect();return title.width>0&&badge.width>0&&title.left>=0&&badge.right<=innerWidth+1;})()`));
    if (mobile) {
      record(`10. mobile map/list switch is understandable at ${width}x${height}`, await evaluate(`getComputedStyle(document.querySelector('.mobile-view-switch')).display!=='none'&&document.querySelector('#mobile-list-view').getAttribute('aria-pressed')==='true'`));
      await evaluate(`document.querySelector('#filter-toggle').click()`);
      record(`11. mobile filters fit at ${width}x${height}`, await evaluate(`(()=>{const triggers=[...document.querySelectorAll('.filter-trigger')];return triggers.every(item=>item.getBoundingClientRect().right<=innerWidth+1);})()`));
      await evaluate(`document.querySelector('#filter-toggle').click()`);
    }
    await evaluate(`document.querySelector('.property-card').click()`);
    await waitFor(`document.querySelector('.maplibregl-popup .popup-detail-action')`);
    await evaluate(`document.querySelector('.popup-detail-action').click()`);
    await waitFor(`!document.querySelector('#property-detail').hidden`);
    record(`12. read-only detail fits at ${width}x${height}`, await evaluate(`(()=>{const box=document.querySelector('#property-detail').getBoundingClientRect();return box.left>=-1&&box.right<=innerWidth+1&&!document.querySelector('#property-detail').textContent.includes('数据库');})()`));
    await evaluate(`document.querySelector(${JSON.stringify(mobile ? '#property-detail-back' : '#property-detail-close')}).click()`);
    if (mobile) await evaluate(`document.querySelector('#mobile-list-view').click()`);
  }

  record('13. showcase made zero backend requests', apiRequests === 0);
  record('14. keyless local validation made zero external requests', externalRequests === 0);
  if (interceptionError) throw interceptionError;
  process.stdout.write(`SHOWCASE BROWSER PASS ${results.length}/${results.length}\nbackend_requests=${apiRequests}\nexternal_requests=${externalRequests}\n`);
} finally {
  socket.close();
}
