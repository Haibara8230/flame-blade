/* 高分屏渲染验证：在 1080p / 2K / 4K 三种视口下检查
   canvas 后备缓冲尺寸、基准变换是否正确，并测一段帧率。 */
const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'].find(p => fs.existsSync(p));
const URL_ = process.argv[2] || 'http://127.0.0.1:8130/?debug=1';
const OUT = process.argv[3] || '.';
const PORT = 9700 + Math.floor(Math.random() * 90);
const PROFILE = path.join(os.tmpdir(), 'fb-dpi-' + Date.now());
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
  proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, '--window-size=1920,1080',
    '--hide-scrollbars', '--no-first-run', '--disable-gpu', '--mute-audio', '--no-sandbox',
    '--user-data-dir=' + PROFILE, 'about:blank'], { stdio: 'ignore' });
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
    const i = ++id; const to = setTimeout(() => { pend.delete(i); rej(new Error('cdp timeout ' + method)); }, 30000);
    pend.set(i, m => { clearTimeout(to); res(m); }); ws.send(JSON.stringify({ id: i, method, params }));
  });
  await send('Runtime.enable'); await send('Page.enable');
  const ev = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result && r.result.exceptionDetails) return 'ERR:' + (r.result.exceptionDetails.text || 'exception');
    return r.result && r.result.result ? r.result.result.value : null;
  };

  const MODES = [
    { name: '1080p', w: 1920, h: 1080, dpr: 1 },
    { name: '2K', w: 2560, h: 1440, dpr: 1 },
    { name: '1080p@2x', w: 1920, h: 1080, dpr: 2 },
    { name: '4K', w: 3840, h: 2160, dpr: 1 },
  ];

  let fail = 0;
  for (const m of MODES) {
    await send('Emulation.setDeviceMetricsOverride', {
      width: m.w, height: m.h, deviceScaleFactor: m.dpr, mobile: false,
    });
    await send('Page.navigate', { url: URL_ });
    await sleep(2200);
    await ev("document.getElementById('btn-new').click(); window.__partyJoin('lei',6); window.__partyJoin('cang',6); 'ok'");
    await sleep(900);

    const info = JSON.parse(await ev(`(function(){
      var cv=document.getElementById('cv');
      var g=cv.getContext('2d');
      var t=g.getTransform();
      return JSON.stringify({
        backing: cv.width+'x'+cv.height,
        css: cv.style.width+'x'+cv.style.height,
        scaleA: +t.a.toFixed(3), scaleD: +t.d.toFixed(3),
        stageScale: document.getElementById('stage').dataset.scale,
        dpr: window.devicePixelRatio
      });
    })()`));

    // 帧率：数 1.5 秒内的 rAF 次数
    const fps = await ev(`new Promise(function(res){
      var n=0, t0=performance.now();
      (function f(){ n++; if(performance.now()-t0<1500) requestAnimationFrame(f); else res(Math.round(n/((performance.now()-t0)/1000))); })();
    })`);

    const expected = Math.min(3, Math.max(1, Number(info.stageScale) * m.dpr));
    const okScale = Math.abs(info.scaleA - expected) < 0.02 && Math.abs(info.scaleD - expected) < 0.02;
    const px = info.backing.split('x').map(Number);
    // 实际占屏宽度 = 960 * stageScale（CSS px），乘 dpr 就是应有的物理像素
    const idealPx = 960 * Number(info.stageScale) * m.dpr;
    const okPx = px[0] >= Math.min(idealPx, 960 * 3) - 2;
    console.log(`${m.name.padEnd(10)} 视口${m.w}x${m.h} dpr${m.dpr}  后备缓冲 ${info.backing.padEnd(11)} CSS ${info.css}  基准变换 ${info.scaleA}  1:1需要${Math.round(960*Number(info.stageScale)*m.dpr)}px  帧率 ${fps}`);
    if (!okScale) { console.log('           FAIL 基准变换应为 ' + expected.toFixed(3)); fail++; }
    if (!okPx) { console.log('           FAIL 后备缓冲没有跟上视口'); fail++; }
    if (fps < 30) { console.log('           WARN 帧率偏低 ' + fps); }

    const r = await send('Page.captureScreenshot', { format: 'png' });
    if (r.result && r.result.data) fs.writeFileSync(path.join(OUT, 'dpi-' + m.name + '.png'), Buffer.from(r.result.data, 'base64'));
  }

  console.log('');
  console.log('控制台异常: ' + (errs.length ? errs.join(' | ') : '无'));
  console.log(fail === 0 && errs.length === 0 ? '=== 全部通过 ===' : '=== ' + fail + ' 项失败 ===');
  done(fail === 0 && errs.length === 0 ? 0 : 1);
})().catch(e => { console.error('FATAL', e.message); done(1); });
