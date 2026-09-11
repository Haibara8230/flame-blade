/* 手机端适配验证：在多种手机视口下检查布局、触屏按键、全屏与输入链路
   用法: node tools/mobile.cjs [url] */
const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'].find(p => fs.existsSync(p));
const BASE = process.argv[2] || 'http://127.0.0.1:8123/?debug=1';
const OUT = path.join(__dirname, '..', 'screenshots');
fs.mkdirSync(OUT, { recursive: true });

/* 注意：Chrome 的 setTouchEmulationEnabled 一旦开启，后续关闭仍会残留 ontouchstart，
   所以「桌面」必须放在第一个跑，否则会被触摸仿真污染。 */
const DEVICES = [
  { name: '桌面1280', w: 1280, h: 760, mobile: false, dpr: 1 },
  { name: 'iPhone14-竖屏', w: 390, h: 844, mobile: true, dpr: 3 },
  { name: 'iPhone14-横屏', w: 844, h: 390, mobile: true, dpr: 3 },
  { name: 'Android-竖屏', w: 360, h: 800, mobile: true, dpr: 3 },
  { name: 'Android-横屏', w: 800, h: 360, mobile: true, dpr: 3 },
  { name: 'iPhoneSE-横屏', w: 667, h: 375, mobile: true, dpr: 2 },
  { name: 'iPad-横屏', w: 1024, h: 768, mobile: true, dpr: 2 },
];

const sleep = ms => new Promise(r => setTimeout(r, ms));
function getJSON(url, timeout = 3000) {
  return new Promise((res, rej) => {
    const req = http.get(url, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); });
    req.on('error', rej); req.setTimeout(timeout, () => req.destroy(new Error('timeout')));
  });
}

let proc = null;
const done = c => { try { proc && proc.kill(); } catch (e) { } setTimeout(() => process.exit(c), 200); };
let problems = [];

(async () => {
  const PORT = 9800 + Math.floor(Math.random() * 150);
  proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, '--hide-scrollbars',
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--mute-audio',
    '--disable-crash-reporter', '--disable-breakpad', '--no-sandbox',
    '--user-data-dir=' + path.join(os.tmpdir(), 'fb-mob-' + Date.now()), 'about:blank'], { stdio: 'ignore' });
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
  let id = 0; const pend = new Map(); const errs = [];
  const onMsg = raw => {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errs.push('EXCEPTION: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errs.push('err: ' + m.params.entry.text);
  };
  if (ws.addEventListener) ws.addEventListener('message', e => onMsg(e.data));
  const send = (method, params = {}, t = 20000) => new Promise((res, rej) => {
    const i = ++id; const to = setTimeout(() => { pend.delete(i); rej(new Error('cdp timeout ' + method)); }, t);
    pend.set(i, m => { clearTimeout(to); res(m); }); ws.send(JSON.stringify({ id: i, method, params }));
  });
  /* 统一包装成 IIFE，避免 CDP 对多语句表达式的解析差异，并捕获内部异常 */
  const evalx = async (body) => {
    const wrapped = `(function(){ try { ${body} } catch (e) { return 'ERR:' + (e && e.message ? e.message : String(e)); } })()`;
    const r = await send('Runtime.evaluate', { expression: wrapped, awaitPromise: true, returnByValue: true });
    if (r.result && r.result.exceptionDetails) return 'ERR:' + (r.result.exceptionDetails.text || 'unknown');
    return r.result && r.result.result ? r.result.result.value : null;
  };
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');

  /* 安全解析：evalx 失败时返回 'ERR:...'，不要让整个脚本崩掉 */
  const parseOr = (s, fallback, label) => {
    if (typeof s !== 'string' || s.startsWith('ERR:')) { problems.push(`${label}: 求值失败 ${s}`); return fallback; }
    try { return JSON.parse(s); } catch (e) { problems.push(`${label}: JSON 解析失败 ${e.message}`); return fallback; }
  };

  for (const d of DEVICES) {
    await send('Emulation.setDeviceMetricsOverride', {
      width: d.w, height: d.h, deviceScaleFactor: d.dpr, mobile: d.mobile,
      screenOrientation: { type: d.w > d.h ? 'landscapePrimary' : 'portraitPrimary', angle: d.w > d.h ? 90 : 0 },
    });
    await send('Emulation.setTouchEmulationEnabled', { enabled: d.mobile, maxTouchPoints: d.mobile ? 5 : 0 });
    await send('Page.navigate', { url: BASE });
    await sleep(2600);

    // 0) 页面是否真的加载成功
    const pageInfo = await evalx(`return JSON.stringify({url:location.href, title:document.title, ready:document.readyState, hasStage:!!document.getElementById('stage'), hasG:!!window.__G})`);
    const pi = parseOr(pageInfo, { url: '?', title: '?', ready: '?', hasStage: false, hasG: false }, d.name + ' 页面加载');
    console.log(`\n【${d.name}】 ${d.w}x${d.h} dpr${d.dpr}${d.mobile ? ' 触屏' : ' 桌面'}  url=${pi.url} ready=${pi.ready} stage=${pi.hasStage} debugAPI=${pi.hasG}`);
    if (!pi.hasStage) { problems.push(`${d.name}: 页面未加载 (url=${pi.url} title=${pi.title} ready=${pi.ready})`); continue; }

    // 1) 竖屏应显示旋转提示；横屏应隐藏
    const portrait = d.h > d.w;
    const rotateShown = await evalx("return !document.getElementById('rotate').classList.contains('hidden')");
    if (d.mobile && portrait && rotateShown !== true) problems.push(`${d.name}: 竖屏未显示旋转提示`);
    if ((!d.mobile || !portrait) && rotateShown === true) problems.push(`${d.name}: 不该显示旋转提示`);

    // 2) 舞台必须在视口内（不越界、不留黑边过多）
    const geo = await evalx(`
      const r = document.getElementById('stage').getBoundingClientRect();
      return JSON.stringify({x:+r.x.toFixed(1),y:+r.y.toFixed(1),w:+r.width.toFixed(1),h:+r.height.toFixed(1),
        vw:window.innerWidth,vh:window.innerHeight,
        touchUI:document.body.classList.contains('touch-ui'),
        fullBtn:!!document.getElementById('btn-full')});
    `);
    const g = parseOr(geo, { x: 0, y: 0, w: 0, h: 0, vw: d.w, vh: d.h, touchUI: null }, d.name + ' stage几何');

    // 3) 开局 → 战斗，检查触屏按键只在战斗中显示
    const flow = await evalx(`
      if (window.__newGame) { window.__newGame(20,['kaito','cang','lei','ryze']); window.__advance(70); }
      return window.__G ? window.__G.mode : 'no-debug';
    `);
    await sleep(1600);
    const touchState = await evalx(`
      return JSON.stringify({
        mode: window.__G ? window.__G.mode : null,
        touchCombat: document.getElementById('touch').classList.contains('combat'),
        touchVisible: getComputedStyle(document.getElementById('touch')).display,
        keySize: (function(){const k=document.querySelector('.tkey');const r=k.getBoundingClientRect();return [Math.round(r.width),Math.round(r.height)];})(),
        cmdBtns: document.getElementById('cmd-buttons').children.length,
        cmdBtnSize: (function(){const b=document.querySelector('.cbtn');if(!b)return null;const r=b.getBoundingClientRect();return [Math.round(r.width),Math.round(r.height)];})(),
        overlap: (function(){
          const t=document.getElementById('touch').getBoundingClientRect();
          const c=document.getElementById('cmdmenu').getBoundingClientRect();
          return !(t.bottom < c.top || t.top > c.bottom || t.right < c.left || t.left > c.right);
        })()
      });
    `);
    const t = parseOr(touchState, { mode: null, touchCombat: false, touchVisible: 'none', keySize: [0, 0], cmdBtns: 0, cmdBtnSize: null, overlap: false }, d.name + ' 触屏状态');

    // 4) 剧情推进链路：退回剧情模式，点画面应推进一行台词
    await evalx(`window.__setScene('prologue'); return 'to-prologue';`);
    await sleep(900);
    const b1 = await evalx(`return JSON.stringify({scene:window.__G.sceneId, line:window.__G.lineIdx, mode:window.__G.mode})`);
    const tapRes = await evalx(`
      const cv=document.getElementById('cv');
      const r=cv.getBoundingClientRect();
      const x=r.x+Math.min(r.width/2, 240), y=r.y+Math.min(r.height/2, 160);
      const ev=(type)=>new PointerEvent(type,{bubbles:true,cancelable:true,clientX:x,clientY:y,pointerType:'touch',isPrimary:true});
      cv.dispatchEvent(ev('pointerdown'));
      cv.dispatchEvent(ev('pointerup'));
      return 'tap@'+Math.round(x)+','+Math.round(y);
    `);
    await sleep(800);
    const a1 = await evalx(`return JSON.stringify({scene:window.__G.sceneId, line:window.__G.lineIdx, mode:window.__G.mode})`);
    const b0 = parseOr(b1, { line: -1, scene: null, mode: null }, d.name + ' before');
    const a0 = parseOr(a1, { line: -1, scene: null, mode: null }, d.name + ' after');
    const advanced = (a0.line > b0.line) || (a0.scene !== b0.scene) || (a0.mode !== b0.mode);

    console.log(`  舞台: ${g.w}x${g.h} @(${g.x},${g.y})  视口: ${g.vw}x${g.vh}  touch-ui=${g.touchUI}`);
    console.log(`  模式=${t.mode}  触屏按键 display=${t.touchVisible} combat=${t.touchCombat} 尺寸=${t.keySize}  指令按钮=${t.cmdBtns}个 ${t.cmdBtnSize}`);
    console.log(`  旋转提示=${rotateShown === true ? '显示' : '隐藏'}  按键与指令栏重叠=${t.overlap}`);
    console.log(`  触摸点击=${tapRes}  剧情推进=${advanced ? '✔' : '✗'} (${b0.mode}|${b0.scene} → ${a0.mode}|${a0.scene})`);

    if (d.mobile && !portrait && g.w < 200) problems.push(`${d.name}: 舞台宽度异常 ${g.w}`);
    if (g.x < -1 || g.y < -1) problems.push(`${d.name}: 舞台被移出可视区 @(${g.x},${g.y})`);
    if (g.y + g.h > g.vh + 1 && d.mobile) problems.push(`${d.name}: 舞台纵向溢出底部 ${(g.y + g.h).toFixed(0)}>${g.vh}`);
    if (d.mobile && !portrait && g.h < g.vh * 0.9) problems.push(`${d.name}: 横屏未铺满高度 ${g.h}/${g.vh}`);
    if (d.mobile && !advanced) problems.push(`${d.name}: 触摸点击未推进剧情`);
    if (!d.mobile && t.touchVisible === 'flex') problems.push(`${d.name}: 桌面端不该显示触屏按键`);
    if (d.mobile && !portrait) {
      if (t.touchCombat && t.touchVisible !== 'flex') problems.push(`${d.name}: 战斗中触屏按键未显示`);
      if (t.keySize[0] < 40) problems.push(`${d.name}: 触屏按键过小 ${t.keySize}`);
      if (t.cmdBtnSize && t.cmdBtnSize[1] < 34) problems.push(`${d.name}: 指令按钮过矮 ${t.cmdBtnSize}`);
      if (t.cmdBtns !== 4) problems.push(`${d.name}: 指令按钮数量异常 ${t.cmdBtns}`);
      if (t.overlap) problems.push(`${d.name}: 触屏按键与指令栏重叠`);
    }

    const shot = await send('Page.captureScreenshot', { format: 'png' });
    if (shot.result && shot.result.data) {
      fs.writeFileSync(path.join(OUT, `mobile-${d.name}.png`), Buffer.from(shot.result.data, 'base64'));
    }
  }

  console.log('\n=== 控制台错误 ===');
  console.log(errs.length ? errs.join('\n') : '(clean)');
  console.log('\n=== 结论 ===');
  if (problems.length) { problems.forEach(p => console.log('  ✗ ' + p)); }
  else console.log('  ✔ 所有视口布局与触屏链路正常');
  try { ws.close(); } catch (e) { }
  done(problems.length || errs.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e && e.message); done(1); });
setTimeout(() => { console.error('GLOBAL TIMEOUT'); done(2); }, 280000);



