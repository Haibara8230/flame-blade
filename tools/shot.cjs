/* 无头截图 & 错误采集：CDP 驱动 headless Chrome
   用法: node tools/shot.cjs <url> <outdir> <stepsJsonOrPath> */
const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].find(p => fs.existsSync(p));

const URL_ = process.argv[2] || 'http://127.0.0.1:8123/?debug=1';
const OUTDIR = process.argv[3] || path.join(__dirname, 'shots');
let stepsArg = process.argv[4] || '[]';
if (fs.existsSync(stepsArg)) stepsArg = fs.readFileSync(stepsArg, 'utf8');
const STEPS = JSON.parse(stepsArg);
fs.mkdirSync(OUTDIR, { recursive: true });

const PORT = 9500 + Math.floor(Math.random() * 300);
const PROFILE = path.join(os.tmpdir(), 'fb-' + Date.now());
const sleep = ms => new Promise(r => setTimeout(r, ms));

function getJSON(url, timeout = 3000) {
  return new Promise((res, rej) => {
    const req = http.get(url, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); });
    req.on('error', rej);
    req.setTimeout(timeout, () => { req.destroy(new Error('timeout')); });
  });
}

let proc = null;
function cleanup(code) {
  try { if (proc && !proc.killed) proc.kill(); } catch (e) { }
  setTimeout(() => process.exit(code), 200);
}

(async () => {
  proc = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${PORT}`,
    '--window-size=1280,760', '--hide-scrollbars', '--no-first-run',
    '--no-default-browser-check', '--disable-gpu', '--mute-audio',
    '--disable-crash-reporter', '--disable-breakpad', '--no-sandbox',
    '--user-data-dir=' + PROFILE,
    'about:blank',
  ], { stdio: 'ignore' });

  let target = null;
  for (let i = 0; i < 80; i++) {
    try {
      const list = await getJSON(`http://127.0.0.1:${PORT}/json/list`);
      const page = list.find(t => t.type === 'page');
      if (page) { target = page; break; }
    } catch (e) { }
    await sleep(250);
  }
  if (!target) { console.error('NO TARGET on port ' + PORT); return cleanup(1); }
  console.log('target:', target.id);

  const WebSocket = typeof globalThis.WebSocket !== 'undefined' ? globalThis.WebSocket : require('ws');  const ws = new WebSocket(target.webSocketDebuggerUrl, { maxPayload: 64 * 1024 * 1024 });
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('ws open timeout')), 8000);
    const ok = () => { clearTimeout(t); res(); };
    if (ws.addEventListener) { ws.addEventListener('open', ok, { once: true }); ws.addEventListener('error', rej, { once: true }); }
    else { ws.on('open', ok); ws.on('error', rej); }
  });
  console.log('ws connected');

  let id = 0; const pend = new Map(); const logs = [];
  const onMsg = raw => {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
    if (m.method === 'Runtime.consoleAPICalled') {
      logs.push('[' + m.params.type + '] ' + m.params.args.map(a => a.value ?? a.description ?? '').join(' '));
    }
    if (m.method === 'Runtime.exceptionThrown') {
      logs.push('[EXCEPTION] ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
    }
    if (m.method === 'Log.entryAdded' && m.params.entry.level !== 'verbose') {
      logs.push('[log:' + m.params.entry.level + '] ' + m.params.entry.text);
    }
  };
  if (ws.addEventListener) ws.addEventListener('message', e => onMsg(e.data));
  else ws.on('message', onMsg);

  const send = (method, params = {}, timeout = 15000) => new Promise((res, rej) => {
    const i = ++id;
    const t = setTimeout(() => { pend.delete(i); rej(new Error('cdp timeout: ' + method)); }, timeout);
    pend.set(i, m => { clearTimeout(t); res(m); });
    ws.send(JSON.stringify({ id: i, method, params }));
  });

  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');
  const VW = Number(process.env.VW || 1280), VH = Number(process.env.VH || 760);
  const MOBILE = process.env.MOBILE === '1';
  console.log(`viewport: ${VW}x${VH} mobile=${MOBILE}`);
  await send('Emulation.setDeviceMetricsOverride', {
    width: VW, height: VH, deviceScaleFactor: MOBILE ? 3 : 1, mobile: MOBILE,
    screenOrientation: { type: VW > VH ? 'landscapePrimary' : 'portraitPrimary', angle: VW > VH ? 90 : 0 },
  });
  await send('Emulation.setTouchEmulationEnabled', { enabled: MOBILE, maxTouchPoints: MOBILE ? 5 : 0 });
  await send('Page.navigate', { url: URL_ });
  await sleep(2600);

  const shot = async (name) => {
    const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    if (!r.result || !r.result.data) { logs.push('[shot-fail] ' + name); return; }
    fs.writeFileSync(path.join(OUTDIR, name + '.png'), Buffer.from(r.result.data, 'base64'));
    console.log('shot:', name);
  };

  await shot('00-title');
  let n = 1;
  for (const s of STEPS) {
    if (s.eval) {
      const r = await send('Runtime.evaluate', { expression: s.eval, awaitPromise: true, returnByValue: true });
      if (r.result && r.result.exceptionDetails) logs.push('[EVAL-ERR ' + (s.name || '') + '] ' + JSON.stringify(r.result.exceptionDetails.text || r.result.exceptionDetails));
      else if (r.result && r.result.result) logs.push('[eval ' + (s.name || '') + '] ' + JSON.stringify(r.result.result.value));
    }
    const wait = s.wait ?? 700;
    const chunks = Math.max(1, Math.ceil(wait / 1000));
    for (let i = 0; i < chunks; i++) {
      await sleep(wait / chunks);
      if (s.shotEvery) await shot((s.name || 'step') + '-' + (++n));
    }
    if (s.name && !s.shotEvery) await shot(s.name);
  }

  console.log('=== CONSOLE / ERRORS ===');
  console.log(logs.length ? logs.join('\n') : '(clean)');
  try { ws.close(); } catch (e) { }
  cleanup(0);
})().catch(e => { console.error('FATAL', e && e.message); cleanup(1); });

setTimeout(() => { console.error('GLOBAL TIMEOUT'); cleanup(2); }, 150000);
