/* 回归测试：面板【关闭】之后，游戏必须还能继续。
   用 __advance 精确推进到目标状态——不能用 autoRun，它会一路冲进战斗，
   于是根本没停在商店/营地上，测试会假通过。 */
const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'].find(p => fs.existsSync(p));
const URL_ = process.argv[2] || 'http://127.0.0.1:8130/?debug=1';
const PORT = 9900 + Math.floor(Math.random() * 90);
const PROFILE = path.join(os.tmpdir(), 'fb-close-' + Date.now());
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
  proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, '--window-size=1280,760',
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
    if (m.method === 'Runtime.exceptionThrown') errs.push('[EXCEPTION] ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  });
  const send = (method, params = {}) => new Promise((res, rej) => {
    const i = ++id; const to = setTimeout(() => { pend.delete(i); rej(new Error('cdp timeout ' + method)); }, 20000);
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

  const PROBE = '(function(){var G=window.__G;function v(i){return !document.getElementById(i).classList.contains("hidden");}' +
    'var alive=v("dialogue")||v("choices")||v("cmdmenu")||v("panel")||v("title")||v("ending")||v("loading");' +
    'return JSON.stringify({mode:G.mode,scene:G.sceneId,panelKind:G.panelKind,alive:alive});})()';

  let fail = 0;
  const state = async () => JSON.parse(await ev(PROBE));
  const check = async (name) => {
    const st = await state();
    const ok = st.alive;
    console.log('  ' + (ok ? 'PASS' : 'FAIL') + ' ' + name + ' -> mode=' + st.mode + ' scene=' + st.scene + ' 可交互=' + st.alive);
    if (!ok) fail++;
    return st;
  };
  const advanceUntil = async (want, max = 50) => {
    for (let i = 0; i < max; i++) {
      const st = await state();
      if (st.mode === want) return st;
      await ev('window.__advance(1)');
      await sleep(110);
    }
    return state();
  };

  await ev("window.__fast=false; document.getElementById('btn-new').click(); window.__partyJoin('lei',6); window.__partyJoin('cang',6); 'ok'");
  await sleep(500);

  console.log('[1] 商店：推进到开店 -> 点关闭');
  await ev("window.__setScene('c1_end'); 'ok'");
  await sleep(350);
  let st = await advanceUntil('shop');
  console.log('    开店后 mode = ' + st.mode);
  if (st.mode !== 'shop') { console.log('    FAIL 没能进商店，本项无效'); fail++; }
  else {
    await ev("document.getElementById('panel-close').click(); 'ok'");
    await sleep(800);
    const after = await check('关闭商店后');
    if (after.mode === 'shop') { console.log('    FAIL mode 仍停在 shop —— 正是这次要修的卡死'); fail++; }
  }

  console.log('[2] 营地：推进到营地面板 -> 点关闭');
  await ev("window.__setScene('sp_camp1'); 'ok'");
  await sleep(350);
  st = await advanceUntil('panel');
  console.log('    营地 mode = ' + st.mode + '  panelKind = ' + st.panelKind);
  if (st.panelKind !== 'camp') { console.log('    FAIL 没能进营地面板'); fail++; }
  else {
    await ev("document.getElementById('panel-close').click(); 'ok'");
    await sleep(900);
    const after = await check('关闭营地后');
    if (after.mode === 'panel') { console.log('    FAIL mode 仍停在 panel'); fail++; }
  }

  console.log('[3] 队伍面板：对话中打开 -> 点关闭');
  await ev("window.__setScene('c2_meet'); 'ok'"); await sleep(400);
  await ev("document.getElementById('btn-status').click(); 'ok'"); await sleep(350);
  st = await state();
  console.log('    打开后 mode = ' + st.mode + '  panelKind = ' + st.panelKind);
  await ev("document.getElementById('panel-close').click(); 'ok'"); await sleep(450);
  await check('关闭队伍面板后');
  await ev('window.__advance(2)'); await sleep(350);
  await check('关闭后还能继续推进对话');

  console.log('[4] 道具面板：开 -> 点关闭');
  await ev("document.getElementById('btn-bag').click(); 'ok'"); await sleep(350);
  await ev("document.getElementById('panel-close').click(); 'ok'"); await sleep(450);
  await check('关闭道具面板后');

  console.log('');
  console.log('控制台异常: ' + (errs.length ? errs.join(' | ') : '无'));
  console.log(fail === 0 && errs.length === 0 ? '=== 全部通过 ===' : '=== ' + fail + ' 项失败 ===');
  done(fail === 0 && errs.length === 0 ? 0 : 1);
})().catch(e => { console.error('FATAL', e.message); done(1); });
