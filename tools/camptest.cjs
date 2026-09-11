/* 验证第一部已经拿到第二部的元素：营地会开、商店货架会生成 */
const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'].find(p => fs.existsSync(p));
const URL_ = process.argv[2] || 'http://127.0.0.1:8131/?debug=1';
const PORT = 9500 + Math.floor(Math.random() * 90);
const PROFILE = path.join(os.tmpdir(), 'fb-sync-' + Date.now());
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
    if (m.method === 'Runtime.exceptionThrown') errs.push('[EXCEPTION] ' + ((m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description) || m.params.exceptionDetails.text));
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
  const state = async () => JSON.parse(await ev(
    '(function(){var G=window.__G;return JSON.stringify({mode:G.mode,scene:G.sceneId,panelKind:G.panelKind});})()'));
  const advanceUntil = async (want, max = 60) => {
    for (let i = 0; i < max; i++) {
      const st = await state();
      if (st.mode === want) return st;
      await ev('window.__advance(1)'); await sleep(100);
    }
    return state();
  };

  let fail = 0;
  await ev("window.__fast=false; document.getElementById('btn-new').click(); window.__partyJoin('lei',8); window.__partyJoin('cang',8); 'ok'");
  await sleep(500);

  // 第一部的六处营地：进去应该开营地面板，再「继续前进」应该能走下去
  const CAMPS = [
    ['c1_end', '第一章末 · 幸存者补给处'],
    ['forest_camp', '第二章 · 林中夜营'],
    ['h_shop', '第三章 · 港町补给'],
    ['s_camp', '第四章 · 雪夜'],
    ['s_shop', '第四章 · 北境补给'],
    ['r_camp', '第五章 · 遗迹出口'],
    ['c4_end', '第六章末 · 露台前哨'],
  ];
  console.log('— 第一部营地 —');
  for (const [id, label] of CAMPS) {
    await ev("window.__setScene('" + id + "'); 'ok'"); await sleep(300);
    const st = await advanceUntil('panel', 30);
    const ok = st.panelKind === 'camp';
    console.log((ok ? 'PASS ' : 'FAIL ') + label.padEnd(22) + ' panelKind=' + st.panelKind);
    if (!ok) { fail++; continue; }
    // 营地里必须有休整按钮
    const hasRest = await ev("!!document.getElementById('camp-rest')");
    if (!hasRest) { console.log('       FAIL 营地里没有休整按钮'); fail++; }
    await ev("document.getElementById('camp-go').click(); 'ok'"); await sleep(600);
    const after = await state();
    if (after.mode === 'panel' && after.panelKind === 'camp') { console.log('       FAIL 继续前进之后还停在营地'); fail++; }
  }

  // 第一部商店的货架应该含有生成装备（id 以 gen_ 开头）
  console.log('');
  console.log('— 第一部商店货架 —');
  for (const [id, label] of [['village', '村庄'], ['harbor', '港町'], ['north', '北境'], ['final', '深渊前哨']]) {
    const raw = await ev("JSON.stringify(window.__G.shopStock && window.__G.shopStock." + id + " || null)");
    const list = JSON.parse(raw || 'null');
    if (!list) { console.log('SKIP ' + label + ' 尚未进过店'); continue; }
    const gen = list.filter(k => String(k).startsWith('gen_')).length;
    const ok = gen > 0;
    console.log((ok ? 'PASS ' : 'FAIL ') + label.padEnd(6) + ' 共 ' + list.length + ' 件，其中生成装备 ' + gen + ' 件');
    if (!ok) fail++;
  }

  console.log('');
  console.log('控制台异常: ' + (errs.length ? errs.join(' | ') : '无'));
  console.log(fail === 0 && errs.length === 0 ? '=== 通过 ===' : '=== ' + fail + ' 项失败 ===');
  done(fail === 0 && errs.length === 0 ? 0 : 1);
})().catch(e => { console.error('FATAL', e.message); done(1); });
