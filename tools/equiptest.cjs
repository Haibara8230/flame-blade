/* 装备界面验证：每个角色只看到自己能用的武器，且显示等级与战力变化 */
const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'].find(p => fs.existsSync(p));
const URL_ = process.argv[2] || 'http://127.0.0.1:8131/?debug=1';
const PORT = 9600 + Math.floor(Math.random() * 90);
const PROFILE = path.join(os.tmpdir(), 'fb-eq-' + Date.now());
const sleep = ms => new Promise(r => setTimeout(r, ms));
function getJSON(url) {
  return new Promise((res, rej) => {
    const req = http.get(url, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); });
    req.on('error', rej); req.setTimeout(3000, () => req.destroy(new Error('timeout')));
  });
}
let proc = null;
const done = c => { try { proc && proc.kill(); } catch (e) { } setTimeout(() => process.exit(c), 200); };

(async () => {
  proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, '--window-size=1600,900',
    '--hide-scrollbars', '--no-first-run', '--disable-gpu', '--mute-audio', '--no-sandbox',
    '--user-data-dir=' + PROFILE, 'about:blank'], { stdio: 'ignore' });
  let target = null;
  for (let i = 0; i < 80; i++) {
    try { const l = await getJSON(`http://127.0.0.1:${PORT}/json/list`); const pg = l.find(t => t.type === 'page'); if (pg) { target = pg; break; } } catch (e) { }
    await sleep(250);
  }
  if (!target) { console.error('NO TARGET'); return done(1); }
  const WebSocket = typeof globalThis.WebSocket !== 'undefined' ? globalThis.WebSocket : require('ws');
  const ws = new WebSocket(target.webSocketDebuggerUrl, { maxPayload: 32 * 1024 * 1024 });
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('ws timeout')), 8000);
    ws.addEventListener('open', () => { clearTimeout(t); res(); }, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });
  let id = 0; const pend = new Map(); const errs = [];
  ws.addEventListener('message', e => {
    let m; try { m = JSON.parse(e.data); } catch (x) { return; }
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errs.push('[EXCEPTION] ' + (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text));
  });
  const send = (method, params = {}) => new Promise((res, rej) => {
    const i = ++id; const to = setTimeout(() => { pend.delete(i); rej(new Error('cdp timeout ' + method)); }, 30000);
    pend.set(i, m => { clearTimeout(to); res(m); }); ws.send(JSON.stringify({ id: i, method, params }));
  });
  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.navigate', { url: URL_ });
  await sleep(2500);
  const ev = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result && r.result.exceptionDetails) return 'ERR:' + (r.result.exceptionDetails.text || 'exception');
    return r.result && r.result.result ? r.result.result.value : null;
  };

  let fail = 0;
  await ev("window.__fast=true; document.getElementById('btn-new').click(); window.__partyJoin('lei',12); window.__partyJoin('cang',12); window.__partyJoin('ryze',12); 'ok'");
  await sleep(600);

  // 往背包里塞满八个类别的装备，并把装备表挂到 window 方便断言
  const seeded = await ev([
    "(async function(){",
    "  const L = await import('./js/loot.js');",
    "  const C = await import('./js/characters.js');",
    "  window.__EQ = C.EQUIPS;",
    "  L.setLootContext({ngPlus:1, flags:{sawTruth:1, innerLock:1, allAid:1}});",
    "  const types = ['刀剑','长枪','法杖','弓弩','护甲','披风','戒指','护符'];",
    "  for (const t of types) for (let i=0;i<2;i++) { const e = L.rollEquip({level:14, type:t}); window.__G.bag[e.id] = 1; }",
    "  return Object.keys(window.__G.bag).length;",
    "})()",
  ].join('\n'));
  console.log('背包装备数:', seeded);
  if (typeof seeded !== 'number' || seeded < 16) { console.log('FAIL 没能塞进装备'); fail++; }

  const EXPECT = { kaito: ['刀剑'], cang: ['法杖'], lei: ['长枪', '弓弩'], ryze: ['法杖'] };
  for (const who of ['kaito', 'cang', 'lei', 'ryze']) {
    await ev("document.getElementById('btn-status').click(); 'ok'");
    await sleep(300);
    await ev("(document.querySelector('[data-equip=\"" + who + "\"]')||{click:function(){}}).click(); 'ok'");
    await sleep(500);
    const raw = await ev([
      "(function(){",
      "  var b = document.getElementById('panel-body');",
      "  var keys = Array.prototype.slice.call(b.querySelectorAll('[data-wear]')).map(function(x){return x.dataset.wear;});",
      "  var wep = keys.map(function(k){ var e = window.__EQ[k]; return e && e.slot==='weapon' ? (e.type||'?') : null; }).filter(Boolean);",
      "  return JSON.stringify({",
      "    title: document.getElementById('panel-title').textContent,",
      "    total: keys.length, weaponTypes: Array.from(new Set(wep)),",
      "    hasLv: b.innerHTML.indexOf('Lv.') >= 0,",
      "    hasCP: b.innerHTML.indexOf('战力') >= 0",
      "  });",
      "})()",
    ].join('\n'));
    if (typeof raw !== 'string') { console.log(who, 'FAIL 读不到面板', raw); fail++; continue; }
    const r = JSON.parse(raw);
    const want = EXPECT[who];
    const bad = r.weaponTypes.filter(t => !want.includes(t));
    const ok = bad.length === 0 && r.hasLv && r.hasCP && r.total > 0;
    console.log((ok ? 'PASS ' : 'FAIL ') + who.padEnd(6) + ' 可换 ' + String(r.total).padStart(2) + ' 件  武器类别 '
      + JSON.stringify(r.weaponTypes) + '  等级' + (r.hasLv ? '有' : '无') + '  战力' + (r.hasCP ? '有' : '无'));
    console.log('       ' + r.title);
    if (bad.length) console.log('       FAIL 出现了不该出现的武器类别: ' + JSON.stringify(bad));
    if (r.total === 0) console.log('       FAIL 一件可换装备都没有，过滤断言无效');
    if (!ok) fail++;
    await ev("document.getElementById('panel-close').click(); 'ok'");
    await sleep(250);
  }

  console.log('');
  console.log('控制台异常: ' + (errs.length ? errs.join(' | ') : '无'));
  console.log(fail === 0 && errs.length === 0 ? '=== 通过 ===' : '=== ' + fail + ' 项失败 ===');
  done(fail === 0 && errs.length === 0 ? 0 : 1);
})().catch(e => { console.error('FATAL', e.message); done(1); });
