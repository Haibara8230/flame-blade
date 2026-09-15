/* 无头全流程通关测试：分段调用 __autoRun，直到抵达结局 */
const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'].find(p => fs.existsSync(p));
const URL_ = process.argv[2] || 'http://127.0.0.1:8123/?debug=1';
const OUT = path.join(__dirname, '..', 'shots-final');
fs.mkdirSync(OUT, { recursive: true });
const PORT = 9700 + Math.floor(Math.random() * 200);
const PROFILE = path.join(os.tmpdir(), 'fb-run-' + Date.now());
const sleep = ms => new Promise(r => setTimeout(r, ms));
function getJSON(url, timeout = 3000) {
  return new Promise((res, rej) => {
    const req = http.get(url, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); });
    req.on('error', rej); req.setTimeout(timeout, () => req.destroy(new Error('timeout')));
  });
}
let proc = null;
const done = c => { try { proc && proc.kill(); } catch (e) { } setTimeout(() => process.exit(c), 200); };

(async () => {
  proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, '--window-size=1280,760',
    '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--mute-audio',
    '--disable-crash-reporter', '--disable-breakpad', '--no-sandbox', '--user-data-dir=' + PROFILE, 'about:blank'], { stdio: 'ignore' });
  let target = null;
  for (let i = 0; i < 80; i++) {
    try { const l = await getJSON(`http://127.0.0.1:${PORT}/json/list`); const pg = l.find(t => t.type === 'page'); if (pg) { target = pg; break; } } catch (e) { }
    await sleep(250);
  }
  if (!target) { console.error('NO TARGET'); return done(1); }
  const WebSocket = typeof globalThis.WebSocket !== 'undefined' ? globalThis.WebSocket : require('ws');
  const ws = new WebSocket(target.webSocketDebuggerUrl, { maxPayload: 64 * 1024 * 1024 });
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('ws timeout')), 8000);
    if (ws.addEventListener) { ws.addEventListener('open', () => { clearTimeout(t); res(); }, { once: true }); ws.addEventListener('error', rej, { once: true }); }
  });
  let id = 0; const pend = new Map(); const logs = [];
  const onMsg = raw => {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') logs.push('[EXCEPTION] ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') logs.push('[err] ' + m.params.entry.text);
  };
  if (ws.addEventListener) ws.addEventListener('message', e => onMsg(e.data));
  const send = (method, params = {}, t = 20000) => new Promise((res, rej) => {
    const i = ++id; const to = setTimeout(() => { pend.delete(i); rej(new Error('cdp timeout ' + method)); }, t);
    pend.set(i, m => { clearTimeout(to); res(m); }); ws.send(JSON.stringify({ id: i, method, params }));
  });
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  await send('Page.navigate', { url: URL_ });
  await sleep(2500);
  const evalx = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result && r.result.exceptionDetails) return 'ERR:' + JSON.stringify(r.result.exceptionDetails.text || r.result.exceptionDetails);
    return r.result && r.result.result ? r.result.result.value : null;
  };
  const shot = async (name) => {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    if (r.result && r.result.data) { fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(r.result.data, 'base64')); console.log('shot', name); }
  };
  await shot('title');
  /* 真实路径 = 邪天单人。按原文，第 8 章之前主角没有队友，
     chapter-destiny.js 里也没有任何 join: 动作。
     此前这里用 __partyJoin 强塞了 lei/cang/ryze 三人（旧四人队时代的残留），
     于是这个脚本每次都以「四人队 Lv6~8」通关，而玩家真实体验是
     「单人 Lv1 起步」——难度、资源曲线、战斗时长全都没被覆盖。
     要做满编队压力测试请另开脚本，不要混进主回归。 */
  console.log('start:', await evalx("window.__fast=true; document.getElementById('btn-new').click(); 'ok'"));
  let last = '';
  for (let round = 0; round < 60; round++) {
    const r = await evalx("window.__stopRun=false; window.__autoRun(6000, 20000)");
    await sleep(21000);
    const st = await evalx("JSON.stringify({mode:window.__G.mode, scene:window.__G.sceneId, line:window.__G.lineIdx, chapter:window.__G.chapter, party:window.__G.party.map(m=>m.name+m.level), turn:window.__G.battle?window.__G.battle.turn:null, ehp:window.__G.battle?window.__G.battle.enemies.map(e=>e.hp):null, res:window.__G.party.map(m=>m.resource+Math.round(m.mp)+'/'+m.maxMp)})");
    console.log('round', round, r, st);
    if (typeof st === 'string' && st.includes('"mode":"ending"')) { await shot('ending'); break; }
    if (st === last && round > 0) { console.log('no progress, stopping'); break; }
    last = st;
    if (round % 8 === 7) await shot('mid' + round);
  }
  const fin = await evalx("JSON.stringify({mode:window.__G.mode, scene:window.__G.sceneId, label:document.getElementById('ending-label').textContent, title:document.getElementById('ending-title').textContent, text:document.getElementById('ending-text').textContent, flags:window.__G.flags, party:window.__G.party.map(m=>m.name+'Lv'+m.level+' '+Math.ceil(m.hp)+'/'+m.maxHp), gold:window.__G.gold})");
  console.log('=== FINAL ==='); console.log(fin);
  console.log('=== ERRORS ==='); console.log(logs.length ? logs.join('\n') : '(clean)');

  /* 断言：必须真的走到结局，且队伍必须仍是单人。
     后者是防回归——一旦有人再往开局塞队友，这里会立刻报出来，
     而不是像之前那样静默地测了很久的假路径。 */
  const F = (() => { try { return JSON.parse(fin); } catch (e) { return null; } })();
  const fails = [];
  if (!F) fails.push('拿不到最终状态');
  else {
    if (F.mode !== 'ending') fails.push('没有走到结局（mode=' + F.mode + ' scene=' + F.scene + '）');
    if (!Array.isArray(F.party) || F.party.length !== 1)
      fails.push('队伍应为单人，实际 ' + (F.party ? F.party.length : '?') + ' 人：' + (F.party || []).join(' / '));
  }
  if (logs.length) fails.push('控制台有 ' + logs.length + ' 条错误');
  console.log('=== 结论 ===');
  if (fails.length) fails.forEach(f => console.log('  ✗ ' + f));
  else console.log('  ✔ 真实路径（邪天单人）通关，控制台零报错');

  try { ws.close(); } catch (e) { }
  done(fails.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e && e.message); done(1); });
/* 行动条改版后每个单位单独出手，一场首领战的行动数（以及挂机所需的真实时间）
   比原来的批量回合制多得多，290 秒已经跑不完全程了。 */
setTimeout(() => { console.error('GLOBAL TIMEOUT'); done(2); }, 780000);
