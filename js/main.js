/* ============================================================
   main.js — 主循环 / 场景 / UI / 存档 / 音效
   《炎之刃》FLAME BLADE
   ============================================================ */
import { ACTORS, SKILLS, COMBOS, ITEMS, EQUIPS, SHOPS, STATUS, ELEM, statsAt, expToNext, ENEMIES, MAX_LEVEL, equipFreeBonus, equipFixedBonus, applyAtkPct } from './characters.js';
import { SCENES, ENDINGS } from './story.js';
import { portraitURL, hasPortrait } from './portraits.js';
import { rollDrops, rollShopStock, restoreLoot, collectLoot, setLootContext } from './loot.js';
import * as GR from './growth.js';
import * as PW from './power.js';
import * as SP from './sprites.js';
import * as BT from './battle.js';

const W = 960, H = 540;          // 逻辑坐标系，所有绘制代码都按这个尺寸写
const $ = id => document.getElementById(id);
const cv = $('cv');
const ctx = cv.getContext('2d', { alpha: true, desynchronized: false });

/* ============================================================
   高分屏渲染
   ============================================================
   画布的后备缓冲此前固定 960×540，再用 CSS transform 把整个 #stage 放大铺满屏幕：
   1080p 上是 2 倍拉伸，2K 上接近 2.7 倍，4K 更糟——所以画面糊。
   （DOM 那层的文字和面板是矢量的，一直都清晰，糊的只有 canvas。）

   现在让后备缓冲等于「实际占用的物理像素」，再用 setTransform 把坐标系
   缩回 960×540，绘制代码一行都不用改。 */
/* 上限 2880×1620。够 2K 做到 1:1，4K 会略低于 1:1 但远好过原来的 960×540。
   低端机或 4K 上如果掉帧，renderCap 会自动往下退一档。 */
const MAX_RENDER_SCALE = 3;
let renderCap = MAX_RENDER_SCALE;
let renderScale = 1;

function applyBaseTransform() {
  ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
}

/* 帧率兜底：连续一段时间掉到 40fps 以下就降一档分辨率。
   只降不升，避免在阈值附近来回抖动；最多降两档（3 → 2.5 → 2）。 */
let slowFrames = 0, lastCssScale = 1;
function watchPerf(dt) {
  if (renderCap <= 2 || renderScale <= 2) { slowFrames = 0; return; }
  if (dt > 1 / 40) slowFrames++; else slowFrames = Math.max(0, slowFrames - 1);
  if (slowFrames > 90) {            // 约 1.5~2 秒持续掉帧
    slowFrames = 0;
    renderCap = Math.max(2, renderCap - 0.5);
    syncCanvasResolution(lastCssScale);
  }
}

function syncCanvasResolution(cssScale) {
  lastCssScale = cssScale;
  const dpr = window.devicePixelRatio || 1;
  const want = Math.min(renderCap, Math.max(1, cssScale * dpr));
  const bw = Math.round(W * want), bh = Math.round(H * want);
  // 改 width/height 会清空画布并重置上下文状态，所以只在真的变了时才改
  if (cv.width !== bw || cv.height !== bh) {
    cv.width = bw;
    cv.height = bh;
    cv.style.width = W + 'px';     // CSS 尺寸保持逻辑大小，#stage 的布局不受影响
    cv.style.height = H + 'px';
  }
  renderScale = cv.width / W;
  applyBaseTransform();
}
/* 多存档槽：四结局的游戏只有一个槽位是硬伤。
   slot 0 是自动存档，1~3 是手动槽。 */
const SAVE_PREFIX = 'flameblade.save.v3.';
const SAVE_SLOTS = 4;
const slotKey = i => SAVE_PREFIX + i;
const LEGACY_KEY = 'flameblade.save.v1';
function slotInfo(i) {
  try {
    const raw = localStorage.getItem(slotKey(i)) || (i === 1 ? localStorage.getItem(LEGACY_KEY) : null);
    if (!raw) return null;
    const d = JSON.parse(raw);
    return { i, t: d.t, chapter: d.chapter || '—', lv: d.party?.[0]?.level || 1, ng: d.flags?.ngPlus || 0 };
  } catch (e) { return null; }
}
function anySave() { for (let i = 0; i < SAVE_SLOTS; i++) if (slotInfo(i)) return true; return false; }

/* ============================================================
   自适应缩放
   ============================================================ */
/* ============================================================
   自适应缩放 / 移动端适配
   ============================================================ */
const stage = $('stage');
/* 触屏判定：优先看「主指针是否粗糙」；纯鼠标桌面即使有触摸仿真也不算触屏设备 */
const COARSE = !!(window.matchMedia && window.matchMedia('(pointer:coarse)').matches);
const TOUCH_POINTS = (navigator.maxTouchPoints || 0) > 0;
const IS_TOUCH = TOUCH_POINTS && (COARSE || 'ontouchstart' in window);
if (IS_TOUCH) {
  document.body.classList.add('touch-ui');
  // 触屏设备自动尝试全屏（浏览器要求在用户交互后才能进入全屏）
  const goFull = () => {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      window.removeEventListener('pointerdown', goFull);
      window.removeEventListener('keydown', goFull);
      return;
    }
    const el = document.documentElement;
    const rq = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!rq) return;
    try {
      const p = rq.call(el, { navigationUI: 'hide' });
      if (p && p.catch) p.catch(() => { /* 用户或浏览器拒绝，忽略 */ });
    } catch (e) { /* 忽略 */ }
    window.removeEventListener('pointerdown', goFull);
    window.removeEventListener('keydown', goFull);
  };
  window.addEventListener('pointerdown', goFull);
  window.addEventListener('keydown', goFull);
}

function isPortrait() {
  return window.innerHeight > window.innerWidth * 1.05;
}

function fit() {
  const vw = window.innerWidth, vh = window.innerHeight;
  const portrait = isPortrait();
  // 先算出「完整放下」的缩放
  const fitScale = Math.min(vw / W, vh / H) * 0.98;
  let s = fitScale;
  // 触屏横屏：按高度放大到铺满，但不允许宽度超出视口。
  // 16:9 手机本来就不会溢出；4:3 平板会溢出 30%+，直接把指令栏最右的按钮裁到屏幕外。
  if (IS_TOUCH && !portrait) {
    s = Math.max(fitScale, Math.min((vh / H) * 0.995, vw / W));
  }
  const dx = Math.max(0, (vw - W * s) / 2);
  const dy = Math.max(0, (vh - H * s) / 2);
  stage.style.transform = `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) scale(${s.toFixed(4)})`;
  stage.dataset.scale = s.toFixed(4);
  stage.dataset.portrait = portrait ? '1' : '0';
  syncCanvasResolution(s);

  // 竖屏提示（只在触屏设备上出现）
  const rot = $('rotate');
  if (rot) {
    if (IS_TOUCH && portrait) rot.classList.remove('hidden');
    else rot.classList.add('hidden');
  }
}
window.addEventListener('resize', fit);
window.addEventListener('orientationchange', () => setTimeout(fit, 120));
/* 窗口拖到另一块 DPR 不同的显示器上时，resize 不一定触发，
   用 resolution 媒体查询兜住。 */
if (window.matchMedia) {
  let dprWatch = null;
  const watchDpr = () => {
    if (dprWatch && dprWatch.removeEventListener) dprWatch.removeEventListener('change', onDpr);
    dprWatch = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    if (dprWatch.addEventListener) dprWatch.addEventListener('change', onDpr, { once: true });
  };
  const onDpr = () => { fit(); watchDpr(); };
  watchDpr();
}
if (window.visualViewport) window.visualViewport.addEventListener('resize', fit);
if (window.matchMedia) {
  const mq = window.matchMedia('(orientation: portrait)');
  if (mq.addEventListener) mq.addEventListener('change', () => setTimeout(fit, 60));
}
fit();

/* 全屏按钮 */
const fullBtn = $('btn-full');
if (fullBtn) {
  fullBtn.onclick = e => {
    e.stopPropagation();
    const el = document.documentElement;
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      (document.exitFullscreen || document.webkitExitFullscreen || (() => { })).call(document);
    } else {
      const rq = el.requestFullscreen || el.webkitRequestFullscreen;
      if (rq) { try { rq.call(el, { navigationUI: 'hide' }); } catch (err) { toast('该浏览器不支持全屏'); } }
      else toast('该浏览器不支持全屏');
    }
    setTimeout(fit, 150);
  };
  if (!IS_TOUCH) fullBtn.style.opacity = '.55';
}

/* ============================================================
   音效（WebAudio 程序化合成）
   ============================================================ */
let AC = null, musicMode = null;
function ac() {
  if (!AC) {
    try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; }
  }
  if (AC && AC.state === 'suspended') AC.resume();
  return AC;
}
function tone(f, dur, type = 'sine', vol = .18, slide = 0) {
  const a = ac(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f, a.currentTime);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), a.currentTime + dur);
  g.gain.setValueAtTime(0, a.currentTime);
  g.gain.linearRampToValueAtTime(vol, a.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
  o.connect(g); g.connect(a.destination);
  o.start(); o.stop(a.currentTime + dur + .02);
}
function noise(dur, vol = .2, hp = 800) {
  const a = ac(); if (!a) return;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource(); src.buffer = buf;
  const f = a.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
  const g = a.createGain(); g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(a.destination);
  src.start();
}
const SFX = {
  ui: () => tone(720, .06, 'square', .07),
  hit: () => { noise(.16, .26, 500); tone(180, .1, 'sawtooth', .12, -90); },
  crit: () => { noise(.22, .32, 400); tone(320, .16, 'square', .14, -180); },
  guard: () => { tone(1100, .1, 'square', .1, 400); noise(.1, .14, 2000); },
  perfect: () => { tone(1400, .12, 'square', .13, 700); tone(2100, .18, 'sine', .1, 500); },
  miss: () => tone(140, .18, 'sawtooth', .09, -60),
  heal: () => { tone(660, .14, 'sine', .1, 320); tone(990, .18, 'sine', .07, 260); },
  ult: () => { tone(120, .7, 'sawtooth', .2, 900); noise(.6, .2, 200); },
  win: () => { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, .3, 'triangle', .13), i * 90)); },
  lose: () => { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, .45, 'triangle', .12), i * 150)); },
  levelup: () => { [523, 784, 1046, 1318].forEach((f, i) => setTimeout(() => tone(f, .22, 'square', .1), i * 70)); },
  page: () => tone(480, .05, 'square', .05),
};
function sfx(k) { (SFX[k] || SFX.ui)(); }

/* ============================================================
   程序化音序器
   ============================================================
   此前 BGM 的全部实现是一个 6 音数组，按固定间隔轮播单音三角波——
   没有节奏、没有和声、没有打击、没有段落变化，一个琶音循环 90 分钟。

   现在是一个真正的小型音序器：和弦层 + 低音层 + 打击层 + 旋律层，
   四小节一段，A/B 段交替，仍然是纯 WebAudio，不需要任何外部音频文件。 */

const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const hz = (name, oct) => 440 * Math.pow(2, (NOTE[name] + (oct - 4) * 12 - 9) / 12);

/* 和弦：根音 + 音程结构 */
const CHORD = {
  min: [0, 3, 7], maj: [0, 4, 7], min7: [0, 3, 7, 10], maj7: [0, 4, 7, 11],
  sus4: [0, 5, 7], dim: [0, 3, 6],
};
function chordFreqs(root, oct, kind) {
  const base = hz(root, oct);
  return CHORD[kind].map(i => base * Math.pow(2, i / 12));
}

/* 每种气氛的一段编配：
     bpm   速度
     prog  和弦进行（四小节，A/B 两段交替）
     drums 打击型（k 底鼓 / s 军鼓 / h 踩镲 / . 空）
     lead  旋律动机，按和弦音级取音，null 表示该拍不出声
     wave  旋律音色 */
const TRACKS = {
  calm: {
    bpm: 76, wave: 'triangle', vol: .5,
    prog: [['A', 3, 'min7'], ['F', 3, 'maj7'], ['C', 3, 'maj7'], ['G', 3, 'sus4']],
    progB: [['F', 3, 'maj7'], ['G', 3, 'sus4'], ['A', 3, 'min7'], ['A', 3, 'min7']],
    drums: 'h...h...h...h...',
    lead: [0, null, 2, null, 1, null, 0, null, 2, null, 1, null, 0, null, null, null],
  },
  forest: {
    bpm: 88, wave: 'triangle', vol: .5,
    prog: [['D', 3, 'min'], ['B', 2, 'maj'], ['G', 3, 'maj'], ['A', 3, 'sus4']],
    progB: [['G', 3, 'maj'], ['D', 3, 'min'], ['A', 3, 'min7'], ['A', 3, 'sus4']],
    drums: 'k..h..k.h.k..h..',
    lead: [0, 1, 2, null, 1, null, 2, 3, null, 2, 1, null, 0, null, 1, null],
  },
  snow: {
    bpm: 68, wave: 'sine', vol: .46,
    prog: [['E', 3, 'min'], ['C', 3, 'maj7'], ['G', 3, 'maj'], ['B', 2, 'min7']],
    progB: [['C', 3, 'maj7'], ['G', 3, 'sus4'], ['E', 3, 'min'], ['E', 3, 'min']],
    drums: '..h.....h.......',
    lead: [2, null, null, 1, null, 0, null, null, 2, null, 3, null, 2, null, null, null],
  },
  dark: {
    bpm: 84, wave: 'sawtooth', vol: .42,
    prog: [['D', 2, 'min'], ['D', 2, 'min'], ['B', 2, 'dim'], ['A', 2, 'min']],
    progB: [['F', 2, 'maj'], ['E', 2, 'dim'], ['D', 2, 'min'], ['A', 2, 'sus4']],
    drums: 'k...k..sk...k..s',
    lead: [0, null, 0, 1, null, 0, null, null, 2, null, 1, 0, null, null, null, null],
  },
  battle: {
    bpm: 132, wave: 'square', vol: .40,
    prog: [['A', 2, 'min'], ['G', 2, 'maj'], ['F', 2, 'maj'], ['E', 2, 'maj']],
    progB: [['A', 2, 'min'], ['C', 3, 'maj'], ['G', 2, 'maj'], ['E', 2, 'maj']],
    drums: 'k.h.s.h.k.h.s.hh',
    lead: [0, 2, 1, 2, 0, null, 2, 3, 1, null, 2, 1, 0, null, 0, null],
  },
  raid: {
    bpm: 126, wave: 'sawtooth', vol: .40,
    prog: [['D', 2, 'min'], ['A', 2, 'min'], ['B', 2, 'dim'], ['A', 2, 'maj']],
    progB: [['D', 2, 'min'], ['F', 2, 'maj'], ['C', 3, 'maj'], ['A', 2, 'maj']],
    drums: 'k.k.s.k.k.k.s.s.',
    lead: [0, 0, 2, null, 1, 1, null, 2, 0, null, 3, 2, 1, null, null, null],
  },
  boss: {
    bpm: 148, wave: 'sawtooth', vol: .42,
    prog: [['C', 2, 'min'], ['A', 2, 'dim'], ['G', 2, 'min'], ['G', 2, 'maj']],
    progB: [['C', 2, 'min'], ['E', 2, 'maj'], ['F', 2, 'min'], ['G', 2, 'maj']],
    drums: 'k.khs.khk.khs.kk',
    lead: [0, 1, 2, 3, 2, 1, 0, null, 2, 3, 4, 3, 2, null, 0, null],
  },
  hot: {
    bpm: 160, wave: 'square', vol: .44,
    prog: [['A', 2, 'min'], ['F', 2, 'maj'], ['C', 3, 'maj'], ['G', 2, 'maj']],
    progB: [['A', 2, 'min'], ['G', 2, 'maj'], ['F', 2, 'maj'], ['E', 2, 'maj']],
    drums: 'kkhsk.hskkhsk.hs',
    lead: [0, 2, 4, 2, 3, 2, 1, 2, 0, 2, 4, 5, 4, 2, 1, null],
  },
  ending: {
    bpm: 72, wave: 'triangle', vol: .5,
    prog: [['C', 3, 'maj7'], ['G', 3, 'maj'], ['A', 3, 'min7'], ['F', 3, 'maj7']],
    progB: [['F', 3, 'maj7'], ['C', 3, 'maj7'], ['G', 3, 'sus4'], ['C', 3, 'maj7']],
    drums: '..h.....h...h...',
    lead: [0, null, 1, 2, null, 1, null, 0, 2, null, 3, null, 2, null, null, null],
  },
};

let seqTimer = null, seqStep = 0, seqBar = 0, seqAlt = false;

function playStep(t) {
  const a = ac(); if (!a) return;
  const bar = Math.floor(seqStep / 4) % 4;
  const beat = seqStep % 16;
  const prog = (seqAlt && t.progB) ? t.progB : t.prog;
  const [root, oct, kind] = prog[bar];

  // 每小节头：铺和弦 + 低音
  if (seqStep % 4 === 0) {
    const freqs = chordFreqs(root, oct, kind);
    freqs.forEach((f, i) => tone(f, 1.5, 'triangle', .035 * t.vol * (i === 0 ? 1.3 : 1)));
    tone(hz(root, oct - 1), 1.2, 'sine', .075 * t.vol);
  }
  // 打击
  const d = t.drums[beat];
  if (d === 'k') { tone(56, .16, 'sine', .30 * t.vol, -26); noise(.05, .06 * t.vol, 90); }
  else if (d === 's') { noise(.13, .17 * t.vol, 1300); tone(190, .07, 'triangle', .07 * t.vol); }
  else if (d === 'h') noise(.045, .055 * t.vol, 6500);
  // 旋律
  const deg = t.lead[beat];
  if (deg !== null && deg !== undefined) {
    const scale = CHORD[kind];
    const step = scale[deg % scale.length] + 12 * Math.floor(deg / scale.length);
    tone(hz(root, oct + 1) * Math.pow(2, step / 12), .34, t.wave, .10 * t.vol);
  }
}

function setMusic(mode) {
  if (mode === musicMode) return;
  musicMode = mode;
  if (seqTimer) { clearInterval(seqTimer); seqTimer = null; }
  if (!mode) return;
  const t = TRACKS[mode] || TRACKS.calm;
  seqStep = 0; seqBar = 0; seqAlt = false;
  const stepMs = 60000 / t.bpm / 4;     // 十六分音符
  const tick = () => {
    playStep(t);
    seqStep++;
    if (seqStep % 16 === 0) { seqBar++; if (seqBar % 4 === 0) seqAlt = !seqAlt; }  // 四小节换段
  };
  seqTimer = setInterval(tick, stepMs);
  tick();
}

/* Boss 阶段转换时切到更紧的变奏，由 battle.js 的 checkPhases 调用 */
function battleMusic(mode) { setMusic(mode); }


/* ============================================================
   输入
   ============================================================ */
const KEYMAP = {
  ' ': 'action', 'z': 'confirm', 'Z': 'confirm', 'Enter': 'confirm',
  'x': 'cancel', 'X': 'cancel', 'Escape': 'cancel',
  'ArrowUp': 'up', 'w': 'up', 'W': 'up',
  'ArrowDown': 'down', 's': 'down', 'S': 'down',
  'ArrowLeft': 'left', 'a': 'left', 'A': 'left',
  'ArrowRight': 'right', 'd': 'right', 'D': 'right',
};
const input = { action: false, actionPressed: false, confirm: false, confirmPressed: false, cancelPressed: false, up: false, down: false, left: false, right: false };
let keysDown = {};
window.addEventListener('keydown', e => {
  const k = KEYMAP[e.key];
  if (k) e.preventDefault();
  ac();
  if (e.repeat) return;
  if (!k) return;
  keysDown[k] = true;
  if (k === 'confirm' || k === 'action') input.confirmPressed = true;
  if (k === 'cancel') input.cancelPressed = true;
}, { passive: false });
window.addEventListener('keyup', e => {
  const k = KEYMAP[e.key];
  if (k) keysDown[k] = false;
});
/* 抉择按钮当前是否已经弹出。
   注意不能用 `G.scene.choices` 代替——那只说明「这个场景最终会有抉择」，
   而抉择按钮是在台词全部读完后才出现的。用前者当条件会让玩家从进入场景那一刻
   就再也无法推进台词，按钮也永远不会弹出。 */
function choicesOpen() { return !$('choices').classList.contains('hidden'); }

/* 触摸：一次触碰可能在 canvas 和其上的 UI 元素各触发一次 pointerdown，
   用 handled 标记防止一次点击被算作两次「确认」 */
let pdHandled = false;
stage.addEventListener('pointerdown', e => {
  ac();
  pdHandled = false;
  if (G.mode === 'scene' && e.target === cv) {
    if (G.typed < G.fullText.length) { pdHandled = true; return; }   // 正在打字 → 先补全文字
    if (choicesOpen()) { pdHandled = true; return; }                 // 按钮已弹出 → 请点按钮
    input.confirmPressed = true;                                    // 否则推进对话
    pdHandled = true;
    return;
  }
  if (e.target !== cv) pdHandled = true;      // 点在 UI 元素上，由该元素自己处理
  input.actionPressed = true;
  input.confirmPressed = true;
});
function syncInput() {
  input.action = !!keysDown.action;
  input.confirm = !!keysDown.confirm;
}

/* ============================================================
   Toast
   ============================================================ */
let toastT = 0;
function toast(msg, ms) {
  const el = $('toast');
  // 战利品提示带稀有度颜色，所以这里允许少量 HTML
  if (/[<][a-z/]/i.test(msg)) el.innerHTML = msg; else el.textContent = msg;
  el.classList.add('on');
  toastT = ms ? ms / 1000 : 2.2;
}
function updateToast(dt) {
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').classList.remove('on'); }
}

/* ============================================================
   游戏状态
   ============================================================ */
const G = {
  mode: 'title',        // title | load | scene | battle | shop | ending | panel
  sceneId: null, scene: null,
  lineIdx: 0, typing: 0, typed: 0, fullText: '', shownText: '',
  /* 原文第7章的初始面板：「声望：0；金钱：0」——进游戏时身上一个铜板都没有，
     背包里也没有系统白送的药水。第一笔收入是三只野狼掉的那一枚铜币。
     ⚠ 此前是 gold:120 + 三瓶药水，都是本项目编的。 */
  party: [], bag: {}, gold: 0, fame: 0,
  flags: {},
  chapter: '',
  battle: null, stageDef: null,
  battleResume: false,
  curActor: 0, cmdSel: 0, submenu: null,
  bg: 'village_day', bgT: 0, fade: 0,
  loadTimer: 0, loadTarget: null,
  shakeUI: 0,
  enemyTurnNote: '',
  galleryFrom: 'title',
  lastDmg: 0,
  storySeen: false,
  // 新增系统
  bonds: {}, relics: {}, codex: {},
  autoBattle: false, lastDrops: null, campShownFor: null,
};
/* 战斗模块通过这两个钩子查询羁绊与天赋，避免 battle.js 反向依赖存档结构 */
G.onBattleMusic = mode => battleMusic(mode);
G.talentBonus = (m, key) => GR.talentBonus(m, key);

/* 装备槽位。按原文第7章的初始装备扩成五格：
   新手短剑（武器）+ 新手布衣 / 新手长裤 / 新手布鞋（上衣 / 下装 / 鞋）+ 饰品。 */
export const SLOTS = ['weapon', 'body', 'legs', 'feet', 'acc'];
const SLOT_CN = { weapon: '武器', body: '上衣', legs: '下装', feet: '鞋', acc: '饰品' };

/* 队伍构造 */
function makeMember(id, level = null) {
  const def = ACTORS[id];
  const lv = level ?? def.joinLevel;
  /* 定长数组，空位保留 null。此前是 .filter(Boolean) 压缩过的，
     之后又按下标 0/1/2 当作武器/护甲/饰品用——只是碰巧对得上（TODO A3）。
     槽位同时按原文扩成五格：原文第7章的初始装备是
     新手布衣 / 新手长裤 / 新手布鞋 三件，旧的三槽位装不下。 */
  const equips = SLOTS.map(slot => defaultEquip(id, slot) || null);
  const st = statsAt(def, lv, equips);
  const res = def.resource || 'mp';
  return {
    id, name: def.name, title: def.title, portrait: def.portrait, role: def.role,
    level: lv, exp: 0, hp: st.hp, maxHp: st.hp, mp: res === 'rage' ? 0 : st.mp, maxMp: st.mp,
    atk: st.atk, def: st.def, spd: st.spd, cri: st.cri, mpRegen: st.mpRegen,
    blk: st.blk, par: st.par, rageMul: st.rageMul,
    resource: def.resource || 'mp',
    equips, skills: def.skills.filter(s => s.lv <= lv).map(s => s.id),
    bonus: { atk: 0, def: 0, hp: 0 },   // 剧情给的永久加成，recalc 后重新叠加
    /* 属性体系按原文分三层（见 realm.js）：
       alloc      自由属性 力量/体质/敏捷/精神——创号分配，升级继续加点
       fixed      固定属性 幸运/悟性/魅力——创号定死，之后只能靠装备
       talentAttr 天赋属性 反应力/感知力/专注力——系统扫描，不可分配
       三者都进存档。角色定义里给的是原文中的数值，作为默认值。 */
    alloc: { ...(def.alloc || { str: 4, vit: 4, agi: 4, spi: 4 }) },
    fixed: { ...(def.fixed || { luck: 0, wit: 0, chm: 0 }) },
    talentAttr: { ...(def.talentAttr || {}) },
    points: 0, sp: 0, talents: {},
    /* 原文第7章面板：「饥饿度：0/110（饥饿度的承受上限=100+力量属性，
       当饥饿度达到承受上限时，每秒会自动掉落1%的生命值。
       饥饿度可以通过饮食来减少。）」
       ⚠ 原文没给「每多久涨一点」，本项目按推进剧情/打完一场各涨若干，已标注。 */
    hunger: 0,
    /* 原文第7章面板：火/水/风/雷/土/光/暗 七系抗性，初始全部 0%。 */
    resist: { fire: 0, water: 0, wind: 0, thunder: 0, earth: 0, light: 0, dark: 0 },
    sex: 'male',    // 大凶兔的「好大一棒槌」对男性目标伤害 +40%
    isEnemy: false,
  };
}

/* 饥饿度推进。⚠ 原文只给了上限公式与到顶后的惩罚，没给累积速度，
   这里按「一场战斗 / 一段剧情」各涨一点，是本项目的设定。 */
function tickHunger(amount = 1) {
  for (const m of G.party) {
    const cap = GR.hungerCap((m.alloc && m.alloc.str) || 0);
    m.hunger = Math.min(cap, (m.hunger || 0) + amount);
    if (m.hunger >= cap) {
      // 原文：达到承受上限时，每秒自动掉落 1% 生命值
      const loss = Math.max(1, Math.floor(m.maxHp * GR.HUNGER_DRAIN));
      m.hp = Math.max(1, m.hp - loss);
    }
  }
}
/* 原文第7章：背包里孤零零一把新手短剑，身上是新手布衣 + 长裤 + 布鞋。 */
function defaultEquip(id, slot) {
  const map = {
    kaito: { weapon: 'mu_sword', body: 'novice_robe', legs: 'novice_pants', feet: 'novice_shoes', acc: null },
  };
  return map[id] ? map[id][slot] : null;
}
/* 按等级 + 装备重算属性。
   注意三件事都必须在这里处理，否则会被静默抹掉——升级和换装备都会走这个函数：
   1. blk / par / rageMul 也是 statsAt 派生的（装备能加格挡率和弹反率）；
   2. m.bonus 是剧情给的永久加成，不来自 statsAt，必须在重算后重新叠加；
   3. 愤怒型角色的资源不该按比例缩放到满。 */
function recalc(m) {
  const def = ACTORS[m.id];
  const st = statsAt(def, m.level, m.equips);
  /* 装备的「四大基本属性 +N」要先并进配点，再走原文的换算公式
     （永恒命运之刻：四大基本属性+10 → 力量也 +10 → 物攻 +20）。 */
  const fb = equipFreeBonus(m.equips);
  const alloc = fb ? Object.fromEntries(Object.entries(m.alloc || {}).map(([k, v]) => [k, v + fb])) : m.alloc;
  GR.applyStatPoints(st, alloc);        // 玩家分配的属性点 + 装备附带的基本属性
  applyAtkPct(st, m.equips);            // 攻击% 必须在属性换算之后
  GR.applyTalentStats(st, m);           // 天赋树的直接属性
  st.blk = Math.min(st.blk, 0.60);
  st.par = Math.min(st.par, 0.30);
  const hpR = m.maxHp ? m.hp / m.maxHp : 1, mpR = m.maxMp ? m.mp / m.maxMp : 1;
  m.maxHp = st.hp; m.maxMp = st.mp; m.atk = st.atk; m.def = st.def; m.spd = st.spd;
  m.cri = st.cri; m.mpRegen = st.mpRegen;
  m.blk = st.blk; m.par = st.par; m.rageMul = st.rageMul;
  /* 回避 / 命中来自自由属性【敏捷】（原文：1 敏捷 = 1 回避 + 1 命中）。
     battle.js 的回避判定会读 m.eva，攻击方的命中读天赋属性【感知力】。 */
  m.eva = st.eva || 0; m.acc = st.acc || 0;
  const b = m.bonus;
  if (b) { m.atk += b.atk || 0; m.def += b.def || 0; m.maxHp += b.hp || 0; }
  m.hp = Math.min(m.maxHp, Math.max(1, Math.round(m.maxHp * hpR)));
  m.mp = Math.min(m.maxMp, Math.round(m.maxMp * mpR));
}
function addMember(id, level) {
  if (G.party.find(p => p.id === id)) return G.party.find(p => p.id === id);
  const explicit = level != null;
  /* 原文里玩家从 0 级起步，所以不能再把下限钳到 1（第7章面板：「等级：0级」）。 */
  const m = makeMember(id, level ?? Math.max(ACTORS[id].joinLevel, 0));
  // 新成员等级不低于队伍平均-1（剧情加入时自动拉齐）
  if (!explicit && G.party.length) {
    const avg = Math.round(G.party.reduce((s, p) => s + p.level, 0) / G.party.length);
    m.level = Math.max(m.level, Math.max(1, avg - 1));
    recalc(m);
    m.skills = ACTORS[id].skills.filter(s => s.lv <= m.level).map(s => s.id);
    m.hp = m.maxHp; m.mp = m.maxMp;
  }
  G.party.push(m);
  return m;
}

/* ============================================================
   经验 / 升级
   ============================================================ */
function gainExp(amount) {
  const ups = [];
  for (const m of G.party) {
    if (m.level >= MAX_LEVEL) continue;
    m.exp += amount;
    let leveled = false;
    while (m.exp >= expToNext(m.level) && m.level < MAX_LEVEL) {
      m.exp -= expToNext(m.level);
      m.level++;
      leveled = true;
      const before = [...m.skills];
      const def = ACTORS[m.id];
      m.skills = def.skills.filter(s => s.lv <= m.level).map(s => s.id);
      const gained = m.skills.filter(s => !before.includes(s)).map(s => SKILLS[s]?.name).filter(Boolean);
      GR.grantLevelPoints(m, 1);        // 每级 3 属性点 + 1 技能点
      ups.push({ name: m.name, level: m.level, skills: gained });
    }
    if (leveled) {
      recalc(m);
      m.hp = Math.min(m.maxHp, m.hp + Math.floor(m.maxHp * 0.4));
      m.mp = Math.min(m.maxMp, m.mp + Math.floor(m.maxMp * 0.4));
    }
  }
  return ups;
}
function showLevelUps(ups) {
  if (!ups.length) return;
  sfx('levelup');
  let i = 0;
  const next = () => {
    if (i >= ups.length) { refreshHUD(); return; }
    const u = ups[i++];
    toast(`★ ${u.name} 升到了 Lv.${u.level}！` + (u.skills.length ? ` 习得【${u.skills.join('、')}】` : ''));
    setTimeout(next, 1500);
  };
  next();
}

/* ============================================================
   场景推进
   ============================================================ */
function gotoScene(id) {
  const sc = SCENES[id];
  if (!sc) { console.warn('missing scene', id); return; }
  G.sceneId = id; G.scene = sc; G.lineIdx = 0; G.mode = 'scene';
  G.sceneConsumed = false;
  if (sc.chapter) { G.chapter = sc.chapter; $('hud-chapter').textContent = sc.chapter; }
  if (sc.bg) setBg(sc.bg);
  if (sc.music) setMusic(sc.music);
  // pre 动作
  const visited = G.flags.sceneRewards || (G.flags.sceneRewards = {});
  if (sc.pre && (!sc.once || !visited[id])) {
    visited[id] = true;
    for (const a of sc.pre) runAction(a);
  }
  autoSave();
  if (sc.loading) { showLoading(sc.loadingTitle || sc.chapter, sc.loadingText || ''); G.loadTarget = id; return; }
  $('dialogue').classList.remove('hidden');
  $('choices').classList.add('hidden');
  refreshHUD();
  nextLine();
}

/* 遗物的战斗特效走和装备词缀同一套键名 */

function runAction(a) {
  if (!a || typeof a !== 'object') return;
  if (a.set) Object.assign(G.flags, a.set);
  if (a.objective) G.flags.currentObjective = a.objective;
  if (typeof a.join === 'string' && ACTORS[a.join]) { addMember(a.join); toast(`※ ${ACTORS[a.join].name} 加入了队伍！`); }
  if (typeof a.item === 'string') { G.bag[a.item] = (G.bag[a.item] || 0) + 1; toast(`获得【${EQUIPS[a.item]?.name || ITEMS[a.item]?.name || a.item}】`); }
  if (typeof a.equip === 'string') { const owner = G.party.find(m => ACTORS[m.id]) || G.party[0]; if (owner) { const slotIdx = SLOTS.indexOf(EQUIPS[a.equip]?.slot); if (slotIdx >= 0) owner.equips[slotIdx] = a.equip; } }
  if (a.gold) { G.gold += a.gold; }
  /* 创号分配：把玩家在剧情里选的自由属性 / 固定属性真正写到角色身上。
     原文的角色创建是一次性、不可更改的（没有删号重练），所以这里
     也只在第一次生效——场景的 once 标记保证不会重复执行。 */
  if (a.build) {
    const m = G.party.find(p => p.id === (a.build.who || 'kaito'));
    if (m) {
      if (a.build.alloc) m.alloc = { ...a.build.alloc };
      if (a.build.fixed) m.fixed = { ...a.build.fixed };
      if (a.build.talentAttr) m.talentAttr = { ...a.build.talentAttr };
      recalc(m);
      m.hp = m.maxHp;
      if (m.resource !== 'rage') m.mp = m.maxMp;
      const f = m.fixed || {};
      toast(`※ 属性已确定　幸运${f.luck ?? 0}／悟性${f.wit ?? 0}／魅力${f.chm ?? 0}`);
    }
  }
  if (a.exp) {
    const ups = gainExp(a.exp);
    toast(`※ 全队获得 ${a.exp} 点历练经验`);
    showLevelUps(ups);
  }
  if (a.heal === 'party') for (const m of G.party) { m.dead = false; m.hp = m.maxHp; if (m.resource !== 'rage') m.mp = m.maxMp; }
  if (a.bonus) for (const m of G.party) {
    // 直接改 m.atk 会在下一次 recalc（升级/换装备）时被抹掉，必须存进 m.bonus
    if (!m.bonus) m.bonus = { atk: 0, def: 0, hp: 0 };
    m.bonus.atk += a.bonus.atk || 0;
    m.bonus.def += a.bonus.def || 0;
    m.bonus.hp += a.bonus.hp || 0;
    recalc(m);
  }
  // 条件跳转动作：{ branch:'flagName', target:{ yes, no } }
  if (typeof a.branch === 'string' && a.target) {
    gotoScene(G.flags[a.branch] ? a.target.yes : a.target.no);
  }
}

function setBg(bg) { if (G.bg !== bg) { G.bg = bg; G.bgT = 0; } }

function advanceScene() {
  const sc = G.scene;
  if (!sc) return;
  if (sc.lines && G.lineIdx < sc.lines.length) { nextLine(); return; }
  // 台词完毕
  if (sc.next && String(sc.next).startsWith('__BATTLE__')) {
    const bs = G.battleScene;
    if (bs) { launchBattle(bs); return; }
  }
  // 营地：休整、聊天涨羁绊、调整养成，然后再继续
  if (sc.shop) { openShop(sc.shop); return; }
  if (sc.enemies) { startBattleFromScene(sc); return; }
  // 第一部的结局：放完结局画面再进第二部
  if (sc.partEnding && !G.flags[`partShown_${sc.partEnding}`]) {
    G.flags[`partShown_${sc.partEnding}`] = true;
    G.flags.part1Ending = sc.partEnding;
    showEnding(sc.partEnding, sc.next);
    return;
  }
  if (sc.ending) { showEnding(sc.ending); return; }
  if (sc.next) { gotoScene(sc.next); return; }
  // 没有下一步：回到标题
  gotoTitle();
}

function nextLine() {
  const sc = G.scene;
  if (!sc || !sc.lines) { finishLines(); return; }
  if (G.lineIdx >= sc.lines.length) { finishLines(); return; }
  // 台词可选第三项：显式指定表情（['璃','……笨蛋……','cry']）
  const [name, text, expr] = sc.lines[G.lineIdx];
  G.lineIdx++;
  showLine(name, text, expr);
}
function finishLines() {
  const sc = G.scene;
  $('dialogue').classList.add('hidden');
  if (sc.choices) { showChoices(sc.choices); return; }
  if (sc.branch) {
    const v = G.flags[sc.branch.branch];
    gotoScene(v ? sc.branch.yes : sc.branch.no);
    return;
  }
  advanceScene();
}

const PID_MAP = (() => {
  const m = {};
  const put = (n, pid) => { if (n) m[n] = pid; };
  for (const a of Object.values(ACTORS)) { put(a.name, a.portrait); put(a.realName, a.portrait); }
  /* 原文里的说话人。立绘按原文的外貌描写画，见 portraits.js 每条的注释。
     ⚠ 此前这里映射了小铃 / 健次郎 / 魔王阿斯特 / 魔将古兰 / 铁匠 / 船长 …
     一整套《炎之刃》的说话人，原著中一个都不存在，已删除。 */
  put('叶天邪', 'kaito'); put('邪天', 'kaito');
  put('刘桦', 'liuhua');
  put('接待小姐', 'clerk');
  put('普洛斯', 'prolos');
  put('被封印的老人', 'sealed');
  put('？？？', 'guoguo'); put('???', 'guoguo'); put('果果', 'guoguo');
  /* ⚠ 以下几位原文没有写外貌，暂不给立绘，宁可没有也不要编：
       少女（蓝白格子裙）、保镖（黑西装）、记者、路人玩家、眼镜学长。
     承泽湖的谪仙女子（lake）与大胖子（fatman）原文有细写，立绘已备好，
     等剧情把她们的台词补上就能挂。 */
  return m;
})();

/* 说话人 → 表情的兜底推断。
   剧本可以在台词里显式写第三项（['璃','……笨蛋……','cry']），
   没写的时候按标点与内容猜一个，比全程同一张微笑脸强得多。 */
function guessExpr(name, text) {
  if (/（哭|眼泪|抹眼|哭出声/.test(text)) return 'cry';
  if (/！{1,}$|——！|「[^」]*！」/.test(text) && text.length < 40) return 'shout';
  if (/（笑|笑了|咧嘴|嘿嘿/.test(text)) return 'smile';
  if (/别管我|撑着点|咳|受伤|（喘|倒下/.test(text)) return 'hurt';
  if (/杀|滚|闭嘴|混蛋|可恶|别过来/.test(text)) return 'angry';
  return 'normal';
}

function showLine(name, text, expr) {
  const nm = $('dlg-name-text');
  const tx = $('dlg-text');
  const img = $('dlg-img');
  const wrap = $('dialogue');
  const port = img.parentElement;
  wrap.classList.remove('hidden');

  /* 旁白占全剧 28% 的台词，此前一直显示一张灰度的凯。
     现在直接把立绘收起来，对话框自己撑满。 */
  if (name === '旁白' || name === '系统') {
    nm.textContent = name === '系统' ? 'SYSTEM' : '';
    port.classList.add('hidden');
    wrap.classList.add('no-portrait');
  } else {
    const pid = PID_MAP[name]
      || (name.includes('璃') ? 'ryze' : name.includes('凯') ? 'kaito' : null);
    if (pid && hasPortrait(pid)) {
      port.classList.remove('hidden');
      wrap.classList.remove('no-portrait');
      const e = expr || guessExpr(name, text);
      const next = portraitURL(pid, e);
      if (img.src !== next) {
        img.src = next;
        // 换人/换表情时给一次轻微的进场，视觉上不再是「贴图突然替换」
        img.classList.remove('pop');
        void img.offsetWidth;
        img.classList.add('pop');
      }
      img.style.filter = 'none';
    } else {
      port.classList.add('hidden');
      wrap.classList.add('no-portrait');
    }
    nm.textContent = name;
  }

  G.fullText = text;
  G.typed = 0; G.typing = text.length * 0.014 + 0.06;
  tx.textContent = '';
  tx.className = 'dlg-text typing';
  $('dlg-next').classList.add('hidden');
}

function updateTyping(dt) {
  if (G.typing > 0) {
    G.typing -= dt;
    if (G.typing <= 0) {
      if (G.typed < G.fullText.length) { G.typed += 2; sfx('page'); G.typing = 0.014; }
    }
    const partial = G.fullText.slice(0, G.typed);
    $('dlg-text').innerHTML = formatLine(partial);
    if (G.typed >= G.fullText.length) {
      $('dlg-text').className = 'dlg-text';
      $('dlg-text').innerHTML = formatLine(G.fullText);
      $('dlg-next').classList.remove('hidden');
      G.typing = 0; G.typed = G.fullText.length + 1;
    }
  }
}
function formatLine(s) {
  return s
    .replace(/「([^」]*)」/g, '<span class="shout">「$1」</span>')
    .replace(/（([^）]*)）/g, '<span class="narr">（$1）</span>')
    .replace(/^系统：(.*)$/gm, '<span class="sys">$1</span>')
    .replace(/※/g, '<span class="sys">※</span>');
}

/* ============================================================
   抉择
   ============================================================ */
/* 选项门禁。第一部的线性剧情用不到，第二部的神域枢纽要靠它
   实现「七柱任选顺序、全部打完才开最深处」。 */
function choiceAvailable(c) {
  return !!c && !(c.unless && G.flags[c.unless]) &&
    (!c.requireAll || c.requireAll.every(k => G.flags[k])) &&
    (!c.require || Object.entries(c.require).every(([k, v]) => G.flags[k] === v));
}
function showChoices(list) {
  const box = $('choices'), ul = $('choices-list');
  ul.innerHTML = '';
  list.forEach(c => {
    if (c.unless && G.flags[c.unless]) return;
    const b = document.createElement('button');
    b.className = 'choice';
    b.disabled = !choiceAvailable(c);
    b.innerHTML = `${c.text}${c.hint ? `<div style="font-size:11.5px;color:#ffb98a;margin-top:5px;letter-spacing:0">▸ ${c.hint}</div>` : ''}`;
    b.onclick = e => { e.stopPropagation(); pickChoice(c); };
    ul.appendChild(b);
  });
  box.classList.remove('hidden');
}
function pickChoice(c) {
  if (!choiceAvailable(c)) return;
  if (c.action?.some(a => a.retryBattle)) {
    if (!G.battleCheckpoint) { toast('没有战前记录，请读取存档或重新开始。'); return; }
    const snap = JSON.parse(JSON.stringify(G.battleCheckpoint));
    G.party = snap.party; G.bag = snap.bag; G.gold = snap.gold; G.flags = snap.flags;
    gotoScene(snap.sceneId);
    return;
  }
  sfx('levelup');
  $('choices').classList.add('hidden');
  if (c.action) for (const a of c.action) runAction(a);
  if (c.goto) gotoScene(c.goto);
}

/* ============================================================
   战斗
   ============================================================ */
function startBattleFromScene(sc) {
  // 战前台词（由通用 pre 动作临时注入 sc.introLines）
  if (sc.introLines && sc.introLines.length) {
    const preScene = {
      id: sc.id + '_intro', chapter: G.chapter, bg: sc.bg || G.bg,
      lines: sc.introLines, next: '__BATTLE__' + sc.id,
    };
    SCENES[preScene.id] = preScene;
    G.battleScene = sc;
    gotoScene(preScene.id);
    return;
  }
  launchBattle(sc);
}

function launchBattle(sc) {
  G.battleCheckpoint = JSON.parse(JSON.stringify({ sceneId: sc.id || G.sceneId, party: G.party, bag: G.bag, gold: G.gold, flags: G.flags }));
  G.battleScene = null;
  const stage = { bg: sc.bg || G.bg, introLines: sc.introLines, script: sc.script };
  const def = {
    id: sc.id || G.sceneId, bg: sc.bg || G.bg, enemies: sc.enemies,
    escape: sc.escape !== false, boss: !!sc.boss,
    introLines: sc.introLines, win: sc.win, onWin: sc.onWin, next: sc.next || null,
    objective: sc.objective, telegraph: sc.telegraph, modifiers: sc.modifiers, support: sc.support,
  };
  G.stageDef = def;
  G.battleBg = sc.bg || G.bg;
  setMusic(sc.boss ? 'boss' : 'battle');
  const b = BT.createBattle(G, def, stage);
  G.battle = b;
  G.mode = 'battle';
  G.curActor = 0;
  $('dialogue').classList.add('hidden');
  $('cmdmenu').classList.remove('hidden');
  b.ui.mode = 'wait';
  $('cmd-buttons').innerHTML = '';
  if (b.scripted) buildScriptUI(b); else buildCommandUI();
}

/* 演出战斗的界面：只留「倍速」和「跳过」。
   这一场是原文的独角戏，玩家不需要下任何指令——他连技能都没有。 */
function buildScriptUI(b) {
  $('cmd-actor').innerHTML = `<div class="an">${b.party[0]?.name || ''}</div>
    <div style="color:#bbb2dd">按原文演出中</div>`;
  const row = $('cmd-buttons');
  row.innerHTML = '';
  const mk = (label, sub, fn) => {
    const btn = document.createElement('button');
    btn.className = 'cbtn';
    btn.innerHTML = `${label}${sub ? `<span class="sub">${sub}</span>` : ''}`;
    btn.onclick = e => { e.stopPropagation(); sfx('ui'); fn(); };
    row.appendChild(btn);
  };
  mk('倍速', BT.battleSpeedLabel(), () => { BT.cycleBattleSpeed(); buildScriptUI(b); });
  mk('跳过', '直接看结果', () => { BT.skipScript(b); });
}

/* 战利品：普通战斗小概率掉一件，首领必掉且保底稀有。
   等级取敌方最高等级，所以越往后掉的东西越好。 */
function grantDrops(b) {
  const sc = G.stageDef || {};
  const lv = Math.max(1, ...b.enemies.map(e => e.level || 1));
  const isBoss = !!sc.boss || b.enemies.some(e => e.boss);
  // 图鉴：登记本场遇到并击破的敌人
  for (const e of b.enemies) if (e.dead) G.codex[e.ref] = (G.codex[e.ref] || 0) + 1;
  setLootContext({ ngPlus: G.flags.ngPlus || 0, flags: G.flags });
  // 首领掉落走图鉴里它自己的主题（打古兰掉「赤狱战场」系）
  const theme = sc.theme || b.enemies.find(e => e.boss && e.def && e.def.theme)?.def.theme || null;
  const drops = rollDrops({ boss: isBoss, theme }, lv, { luck: (G.flags.ngPlus || 0) * 0.25 });
  if (!drops.length) return;
  for (const eq of drops) G.bag[eq.id] = (G.bag[eq.id] || 0) + 1;
  G.lastDrops = drops;
  const names = drops.map(e => `<span style="color:${e.col}">${e.name}</span>`).join('、');
  toast(`※ 战利品：${names}`, 2600);
}

function battleEndToStory() {
  const sc = G.stageDef;
  const nextScene = {
    id: sc.id + '_win', chapter: G.chapter, bg: G.battleBg,
    lines: sc.win || [['旁白', '（战斗结束了。）']],
    next: sc.next || null,
  };
  if (sc.onWin) for (const a of sc.onWin) runAction(a);
  SCENES[nextScene.id] = nextScene;
  tickHunger(2);            // 打完一场：饥饿度 +2
  G.justWon = sc.id;
  G.battle = null;
  $('cmdmenu').classList.add('hidden');
  $('cmd-buttons').innerHTML = '';
  gotoScene(nextScene.id);
  refreshHUD();
}

G.onBattleWin = function (b, exp, gold) {
  setTimeout(() => {
    sfx('win');
    for (const member of G.party) {
      const fought = b.party.find(m => m.id === member.id);
      if (fought) { member.hp = fought.hp; member.mp = fought.mp; member.dead = fought.dead; }
    }
    G.gold += gold;
    const ups = gainExp(exp);
    showLevelUps(ups);
    /* ⚠ 此前打完一场白送两成生命与术力，是本项目编的。
       原文里他杀完三只狼就是带着那一爪的伤走的，没有任何自动回复。 */
    // 复活倒下的同伴（残血）
    for (const m of G.party) if (m.dead) { m.dead = false; m.hp = Math.max(1, Math.floor(m.maxHp * 0.15)); m.pose = 'idle'; }
    for (const m of G.party) if (m.resource === 'rage') m.mp = 0;   // 怒气不跨战斗保留
    grantDrops(b);
    battleEndToStory();
  }, 900);
};
G.onBattleLose = function (b) {
  sfx('lose');
  setTimeout(() => {
    G.battle = null;
    $('cmdmenu').classList.add('hidden');
    $('cmd-buttons').innerHTML = '';
    gotoScene('arc_defeat');
  }, 1200);
};
G.onBattleEscape = function (b) {
  const sc = G.stageDef;
  G.battle = null;
  $('cmdmenu').classList.add('hidden');
  toast('※ 成功脱离战斗');
  // 回到触发战斗的场景，继续推进剧情
  G.mode = 'scene';
  $('dialogue').classList.remove('hidden');
  if (G.scene) { setMusic(G.scene.music || 'calm'); advanceScene(); }
  else gotoTitle();
};

/* ---- 玩家指令 UI ---- */
function aliveParty() { return G.battle.party.filter(m => !m.dead); }
function buildCommandUI() {
  const b = G.battle;
  if (!b || b.over) return;
  const row = $('cmd-buttons');
  row.innerHTML = '';
  const m = b.party[G.curActor];
  if (!m || m.dead) return;
  const resName = (ACTORS[m.id] && ACTORS[m.id].resourceName) || (m.resource === 'rage' ? '怒气' : '术力');
  const stage = BT.releaseStage(m);
  $('cmd-actor').innerHTML = `<div class="an">${m.name}</div>
    <div style="color:#bbb2dd">Lv.${m.level} · ${m.title}</div>
    <div style="color:#ffb98a;margin-top:3px">HP ${Math.ceil(m.hp)}/${m.maxHp}</div>
    <div style="color:${m.resource === 'rage' ? '#ff9a3c' : '#6fd8ff'}">${resName} ${Math.ceil(m.mp)}/${m.maxMp}${stage ? ` <span style="color:#ffd76a">解放·${'壹贰叁'[stage - 1]}</span>` : ''}</div>
    <div style="margin-top:5px;display:flex;gap:6px">
      <button class="mini" id="btn-speed" style="padding:3px 8px;font-size:11px">倍速 ${BT.battleSpeedLabel()}</button>
      <button class="mini ${G.autoBattle ? 'g' : ''}" id="btn-auto" style="padding:3px 8px;font-size:11px">自动 ${G.autoBattle ? '开' : '关'}</button>
    </div>`;
  const mk = (label, sub, fn, dis, cls = '') => {
    const btn = document.createElement('button');
    btn.className = 'cbtn ' + cls;
    btn.innerHTML = `${label}${sub ? `<span class="sub">${sub}</span>` : ''}`;
    btn.disabled = !!dis;
    btn.onclick = e => { e.stopPropagation(); sfx('ui'); fn(); };
    row.appendChild(btn);
  };
  mk('攻击', '斩击', () => chooseTarget(m, 'enemy', i => doCmd(m, { type: 'attack', target: i })));
  mk('技能', '术式/奥义', () => openSkills(m));
  mk('道具', `剩余${Object.values(G.bag).reduce((a, b2) => a + b2, 0)}`, () => openBagInBattle(m));
  mk('格挡', '预判弹反 · 免伤并反击', () => doCmd(m, { type: 'guard' }));
  /* ⚠ 连携（COMBOS）与羁绊是《炎之刃》时期的系统，原著中没有，已删除。 */
  if (b.objective) {
    const label = b.objective.type === 'purify' ? '净化' : '封门';
    if (b.objective.type !== 'rescue') mk(label, BT.objectiveText(b), () => doCmd(m, { type: 'objective' }), !BT.canObjective(b, m));
  }
  // 剧本用 escape 标记哪些战斗可以逃。此前只有这个标记，指令栏里从来没有出口。
  if (b.def && b.def.escape) mk('逃跑', '脱离战斗', () => doCmd(m, { type: 'escape' }));
  const sp = $('btn-speed'), au = $('btn-auto');
  if (sp) sp.onclick = e => { e.stopPropagation(); sfx('ui'); BT.cycleBattleSpeed(); buildCommandUI(); };
  if (au) au.onclick = e => {
    e.stopPropagation(); sfx('ui');
    G.autoBattle = !G.autoBattle;
    buildCommandUI();
    if (G.autoBattle) autoTakeTurn();
  };
  $('cmdmenu').classList.remove('hidden');
  if (G.autoBattle) autoTakeTurn();
}

/* 自动战斗：挑一个合理的指令替玩家出手。
   优先级：救濒死的同伴 → 能放的连携 → 够资源的解放/奥义 → 打弱点 → 普攻。 */
function autoTakeTurn() {
  const b = G.battle;
  if (!b || b.over || b.ui.mode !== 'input') return;
  const m = b.party[G.curActor];
  if (!m || m.dead) return;
  setTimeout(() => {
    if (!G.autoBattle || !G.battle || G.battle !== b || b.ui.mode !== 'input') return;
    const purge = b.objective?.type === 'purify' ? (b.objective.targets || []) : null;
    const alive = b.enemies.map((e, i) => ({ e, i }))
      .filter(x => !x.e.dead && (!purge || purge.includes(x.e.ref)));
    if (!alive.length) return doCmd(m, { type: 'guard' });
    const hurt = b.party.map((p, i) => ({ p, i })).filter(x => !x.p.dead && x.p.hp / x.p.maxHp < 0.35);
    const downed = b.party.map((p, i) => ({ p, i })).filter(x => x.p.dead);
    const has = id => m.skills.includes(id) && SKILLS[id] && m.mp >= (SKILLS[id].mp || 0);

    // 目标战：轮到该角色且条件满足时，优先推进目标（净化 / 封门）
    if (b.objective && BT.canObjective(b, m)) return doCmd(m, { type: 'objective' });
    if (downed.length && has('fusheng')) return doCmd(m, { type: 'skill', skill: 'fusheng', target: downed[0].i });
    if (hurt.length && has('liaoshang')) return doCmd(m, { type: 'skill', skill: 'liaoshang', target: hurt[0].i });
    const combos = BT.availableCombos(b, m);
    if (combos.length) return doCmd(m, { type: 'combo', combo: combos[0].id, target: alive[0].i });
    // 够资源就放最高档的解放 / 奥义
    const ults = m.skills.map(id => SKILLS[id]).filter(sk => sk && (sk.ult || sk.release) && m.mp >= (sk.mp || 0));
    if (ults.length) {
      ults.sort((a, c) => (c.mp || 0) - (a.mp || 0));
      return doCmd(m, { type: 'skill', skill: ults[0].id, target: alive[0].i });
    }
    // 打弱点
    for (const sk of m.skills.map(id => SKILLS[id]).filter(Boolean)) {
      if (sk.type !== 'atk' || m.mp < (sk.mp || 0)) continue;
      const tg = alive.find(x => (x.e.weak || []).includes(sk.elem));
      if (tg) return doCmd(m, { type: 'skill', skill: sk.id, target: tg.i });
    }
    doCmd(m, { type: 'attack', target: alive[0].i });
  }, 220);
}

/* 目标选择界面。
   此前攻击和敌方道具永远打「第一个活着的敌人」，单体治疗和友方道具永远作用在
   party[0]（凯）——意味着没法集火、没法挑弱点，也没法治疗或复活除凯以外的任何人。
   kind: 'enemy' | 'ally'（活着的同伴）| 'downed'（倒下的同伴，复活用） */
function chooseTarget(m, kind, onPick, back) {
  const b = G.battle;
  hideSubmenu();
  let el = $('skilllist');
  if (!el) { el = document.createElement('div'); el.id = 'skilllist'; $('cmdmenu').appendChild(el); }

  const rows = kind === 'enemy'
    ? b.enemies.map((e, i) => ({ i, u: e, ok: !e.dead }))
    : b.party.map((p, i) => ({ i, u: p, ok: kind === 'downed' ? p.dead : !p.dead }));
  const usable = rows.filter(r => r.ok);
  if (!usable.length) {
    toast(kind === 'downed' ? '没有倒下的同伴' : '没有可选的目标');
    back ? back() : hideSubmenu();
    return;
  }
  // 只剩一个合法目标时不必多点一次
  if (usable.length === 1) { hideSubmenu(); onPick(usable[0].i); return; }

  const label = kind === 'enemy' ? '选择攻击目标' : (kind === 'downed' ? '选择要复活的同伴' : '选择目标同伴');
  el.innerHTML = `<div class="sk-head"><span>${m.name} —— ${label}</span><span style="color:#ffb98a">点一下确定</span></div>
    <div class="sk-grid">${rows.map(r => {
    const u = r.u;
    const pct = Math.max(0, Math.round((u.hp / u.maxHp) * 100));
    const st = (u.status || []).map(x => (STATUS[x.id] ? STATUS[x.id].icon : '')).join('');
    const weak = (kind === 'enemy' && u.weak && u.weak.length)
      ? '　弱点 ' + u.weak.map(w => (ELEM[w] ? ELEM[w].name : w)).join('/') : '';
    return `<button class="sk" data-tg="${r.i}" ${r.ok ? '' : 'disabled'}>
        <span class="c">${u.dead ? '倒下' : pct + '%'}</span>
        <div class="n">${u.name}${u.level ? ' Lv.' + u.level : ''}</div>
        <div class="d">HP ${Math.ceil(u.hp)}/${u.maxHp}${weak}${st ? '　' + st : ''}</div>
      </button>`;
  }).join('')}
      <button class="sk" data-tg="__cancel"><div class="n">← 返回</div></button>
    </div>`;
  el.classList.remove('hidden');
  el.querySelectorAll('.sk').forEach(btn => {
    btn.onclick = e => {
      e.stopPropagation(); sfx('ui');
      const v = btn.dataset.tg;
      if (v === '__cancel') { back ? back() : hideSubmenu(); return; }
      hideSubmenu();
      onPick(Number(v));
    };
  });
}

function pickTargetIdx() {
  const b = G.battle;
  const alive = b.enemies.filter(e => !e.dead);
  return alive.length ? b.enemies.indexOf(alive[0]) : -1;
}
function doCmd(m, cmd) {
  const b = G.battle;
  if (!b || b.ui.mode !== 'input') return;
  G.submenu = null;
  hideSubmenu();
  hideCommandUI();
  BT.takePlayerAction(b, m, cmd);
}
function hideCommandUI() {
  $('cmd-buttons').innerHTML = '<div style="grid-column:1/-1;text-align:center;color:#ffd76a;font-size:14px;letter-spacing:3px;padding:10px">— 行动中 —</div>';
}
function hideSubmenu() {
  const el = $('skilllist');
  if (el) el.classList.add('hidden');
}
function openSkills(m) {
  hideSubmenu();
  let el = $('skilllist');
  if (!el) {
    el = document.createElement('div'); el.id = 'skilllist';
    $('cmdmenu').appendChild(el);
  }
  const list = m.skills.filter(id => SKILLS[id]);
  const resName = (ACTORS[m.id] && ACTORS[m.id].resourceName) || (m.resource === 'rage' ? '怒气' : '术力');
  const sealed = BT.isSealed(m);
  el.innerHTML = `<div class="sk-head"><span>${m.name} 的技能　${resName} ${Math.ceil(m.mp)}/${m.maxMp}</span><span style="color:#ffb98a">${sealed ? '✖ 被封印，无法使用术式' : (m.resource === 'rage' ? '怒气靠攻击与受击积攒' : '术力每回合自然回复')}</span></div>
    <div class="sk-grid">${list.map(id => {
    const s = SKILLS[id];
    const isUlt = !!s.ult;
    const usable = !sealed && s.mp <= m.mp;
    return `<button class="sk" data-sk="${id}" ${usable ? '' : 'disabled'}>
        <span class="c">${isUlt ? '★奥义 ' : ''}${resName.slice(0, 1)} ${s.mp}</span>
        <div class="n">${s.name}</div>
        <div class="d">${s.desc}</div>
      </button>`;
  }).join('')}
      <button class="sk" data-sk="__cancel"><div class="n">← 返回</div><div class="d">取消选择</div></button>
    </div>`;
  el.classList.remove('hidden');
  el.querySelectorAll('.sk').forEach(btn => {
    btn.onclick = e => {
      e.stopPropagation();
      const id = btn.dataset.sk;
      sfx('ui');
      if (id === '__cancel') { hideSubmenu(); return; }
      const s = SKILLS[id];
      const go = t => doCmd(m, { type: 'skill', skill: id, target: t });
      const again = () => openSkills(m);
      // 群体 / 自身技能不需要选目标
      if (s.target === 'all' || s.target === 'party' || s.target === 'self') { go(0); return; }
      if (s.type === 'revive') chooseTarget(m, 'downed', go, again);
      else if (s.target === 'ally') chooseTarget(m, 'ally', go, again);
      else chooseTarget(m, 'enemy', go, again);
    };
  });
}
function openBagInBattle(m) {
  hideSubmenu();
  let el = $('skilllist');
  if (!el) { el = document.createElement('div'); el.id = 'skilllist'; $('cmdmenu').appendChild(el); }
  const keys = Object.keys(G.bag).filter(k => G.bag[k] > 0 && ITEMS[k]);
  el.innerHTML = `<div class="sk-head"><span>${m.name} 的道具　持有 ${GR.formatCoin(G.gold)}</span><span>选择后即可使用</span></div>
    <div class="sk-grid">${keys.length ? keys.map(k => {
    const it = ITEMS[k];
    return `<button class="sk" data-it="${k}"><span class="c">×${G.bag[k]}</span><div class="n">${it.name}</div><div class="d">${it.desc}</div></button>`;
  }).join('') : '<div style="color:#a99">—— 背包空空如也 ——</div>'}
      <button class="sk" data-it="__cancel"><div class="n">← 返回</div></button>
    </div>`;
  el.classList.remove('hidden');
  el.querySelectorAll('.sk').forEach(btn => {
    btn.onclick = e => {
      e.stopPropagation(); sfx('ui');
      const k = btn.dataset.it;
      if (k === '__cancel') { hideSubmenu(); return; }
      const it = ITEMS[k];
      const go = t => doCmd(m, { type: 'item', item: k, target: t });
      const again = () => openBagInBattle(m);
      if (it.target === 'self') { go(0); return; }
      if (it.target === 'enemy') chooseTarget(m, 'enemy', go, again);
      else if (it.revive) chooseTarget(m, 'downed', go, again);
      else chooseTarget(m, 'ally', go, again);
    };
  });
}

G.requestPlayerTurn = function (b) {
  if (b.over || G.mode !== 'battle') return;
  for (const e of b.enemies) { e.pose = 'idle'; e.atkP = null; }
  for (const m of b.party) { m.pose = 'idle'; m.atkP = null; }
  // 行动条决定了当前该谁出手
  const act = b.active;
  G.curActor = act && !act.isEnemy ? b.party.indexOf(act) : b.party.findIndex(m => !m.dead);
  if (G.curActor < 0) G.curActor = 0;
  b.ui.mode = 'input';
  buildCommandUI();
};

G.useItem = function (id) {
  if (G.bag[id] > 0) G.bag[id]--;
  if (G.bag[id] <= 0) delete G.bag[id];
  refreshHUD();
};
G.sfx = sfx;

/* ============================================================
   商店
   ============================================================ */
/* 所有商店的装备货架都现场生成——第一部原本是写死的几件，
   到了第二部忽然变成随机掉落品，两边像两个游戏。现在统一：
   固定清单里的消耗品与剧情装备保留，再按队伍等级补一批当前档位的装备。 */
const SHOP_STOCK_N = {
  village: 3, harbor: 4, north: 5, final: 6,
  spirit: 6, edge: 7, divine: 8, last: 8,
};
const DYNAMIC_ONLY = {
  spirit: '仙灵之野 · 换物处',
  edge: '断天之径 · 无名者的摊子',
  divine: '神域 · 静室补给',
  last: '终幕之前 · 最后一次整备',
};
function shopDef(id) {
  const fixed = SHOPS[id];
  const name = DYNAMIC_ONLY[id] || (fixed && fixed.name);
  if (!fixed && !DYNAMIC_ONLY[id]) return null;
  const cache = G.shopStock || (G.shopStock = {});
  if (!cache[id]) {
    const lv = Math.max(1, Math.round(G.party.reduce((a, m) => a + m.level, 0) / Math.max(1, G.party.length)));
    setLootContext({ ngPlus: G.flags.ngPlus || 0, flags: G.flags });
    const stock = rollShopStock(lv, SHOP_STOCK_N[id] || 4, { luck: (G.flags.ngPlus || 0) * 0.3 });
    cache[id] = [...((fixed && fixed.items) || []), ...stock.map(e => e.id)];
  }
  return { name, items: cache[id] };
}

function openShop(id) {
  const shop = shopDef(id);
  if (!shop) { goAfterShop(); return; }
  G.mode = 'shop';
  $('dialogue').classList.add('hidden');
  $('choices').classList.add('hidden');
  const panel = $('panel');
  $('panel-title').textContent = `◆ ${shop.name}　持有 ${GR.formatCoin(G.gold)}`;
  const body = $('panel-body');
  body.innerHTML = `<div style="grid-column:1/-1">
    ${shop.items.map(k => {
    const it = ITEMS[k] || EQUIPS[k];
    const price = it.price || 0;
    const owned = G.bag[k] || 0;
    const eq = EQUIPS[k];
    const tag = eq ? `<span class="tag eq">${eq.rarity || ''}${eq.slot === 'weapon' ? '武器' : eq.slot === 'armor' ? '护甲' : '饰品'}</span>` : `<span class="tag">持有 ${owned}</span>`;
    return `<div class="shop-row">
        <div><b style="color:${eq && eq.col ? eq.col : '#ffd76a'}">${it.name}</b> ${tag}
          <div style="font-size:11.5px;color:#bbb2dd;margin-top:3px">${it.desc}</div>
          <div style="font-size:11px;color:#8fe6ff;margin-top:2px">${statLine(eq || it)}</div>
        </div>
        <div style="text-align:right">
          <div class="pr">${price} 金</div>
          <button class="mini" data-buy="${k}" ${G.gold < price ? 'disabled' : ''}>购买</button>
        </div>
      </div>`;
  }).join('')}
    <div style="margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,160,70,.3)">
      <div style="color:#ffd76a;font-size:13px;margin-bottom:6px">◈ 队伍整备（为谁装备）</div>
      <div style="display:grid;grid-template-columns:1fr;gap:6px">
        ${G.party.map(m => `<div class="shop-row">
          <div><b style="color:#ffd76a">${m.name}</b> Lv.${m.level}
            <div style="font-size:11.5px;color:#bbb2dd">装备：${m.equips.filter(Boolean).map(e => EQUIPS[e]?.name).filter(Boolean).join(' / ') || '无'}</div>
          </div>
          <button class="mini g" data-eq="${m.id}">装备</button>
        </div>`).join('')}
      </div>
      <div style="margin-top:10px;font-size:12px;color:#bbb2dd">持有物品：${Object.keys(G.bag).filter(k => G.bag[k] > 0).map(k => `${ITEMS[k]?.name || EQUIPS[k]?.name || k}×${G.bag[k]}`).join('、') || '无'}</div>
      <div style="margin-top:12px"><button class="mini" id="shop-leave" style="padding:8px 22px">离开商店 ▶</button></div>
    </div>
  </div>`;
  panel.classList.remove('hidden');
  body.querySelectorAll('[data-buy]').forEach(b => b.onclick = e => {
    e.stopPropagation();
    const k = b.dataset.buy;
    const it = ITEMS[k] || EQUIPS[k];
    if (G.gold < it.price) { toast('钱不够'); return; }
    G.gold -= it.price;
    G.bag[k] = (G.bag[k] || 0) + 1;
    sfx('heal');
    toast(`购买了【${it.name}】`);
    openShop(id);
    refreshHUD();
  });
  body.querySelectorAll('[data-eq]').forEach(b => b.onclick = e => {
    e.stopPropagation();
    openEquipScreen(b.dataset.eq, () => openShop(id));
  });
  $('shop-leave').onclick = e => { e.stopPropagation(); goAfterShop(); };
}
function statLine(o) {
  if (!o) return '';
  const p = [];
  if (o.atk) p.push(`攻击+${o.atk}`);
  if (o.def) p.push(`防御+${o.def}`);
  if (o.hp) p.push(`生命+${o.hp}`);
  if (o.mp) p.push(`术力+${o.mp}`);
  if (o.spd) p.push(`速度+${o.spd}`);
  if (o.cri) p.push(`暴击+${Math.round(o.cri * 100)}%`);
  return p.join('　');
}
/* 离开商店，继续推进剧情。
   注意：closePanel() 在 G.mode==='shop' 时会自己转调这里，
   所以调用方不要再先 closePanel() 再 goAfterShop() ——那会推进两次，
   把「商店的下一幕」直接跳过去（第三章补给后会一路掉回标题画面）。 */
function goAfterShop() {
  G.mode = 'scene';
  const sc = G.scene;
  $('panel').classList.add('hidden');
  G.panelKind = null;
  G.prevMode = null;
  if (sc && sc.next) gotoScene(sc.next);
  else gotoTitle();
}
function openEquipScreen(memberId, back) {
  const m = G.party.find(p => p.id === memberId);
  const body = $('panel-body');
  const nowCP = PW.combatPower(m);
  $('panel-title').textContent = `◈ ${m.name} 的装备　战力 ${nowCP}`;


  /* 只列这个角色用得上的：武器按类别限定（刀剑给凯、长枪弓弩给雷、法杖给苍与璃），
     护甲饰品人人可用。此前所有人共用一张清单，璃的栏里堆满了自己拿不动的大剑。 */
  const owned = Object.keys(G.bag)
    .filter(k => G.bag[k] > 0 && EQUIPS[k] && PW.canEquip(m.id, EQUIPS[k]));

  const rowFor = (k, equipped) => {
    const e = EQUIPS[k];
    const lv = PW.equipLevel(e);
    const type = PW.equipType(e);
    const delta = equipped ? 0 : PW.powerWith(m, k) - nowCP;
    const t = PW.powerTier(delta);
    return `<div class="shop-row" style="align-items:flex-start">
      <div style="flex:1;min-width:0">
        <b style="color:${e.col || '#ffd76a'}">${e.name}</b>
        <span class="tag" style="margin-left:6px">Lv.${lv}</span>
        ${e.rarity ? `<span class="tag" style="color:${e.col};border-color:${e.col}66">${e.rarity}</span>` : ''}
        ${type ? `<span class="tag">${type}</span>` : ''}
        ${equipped ? '<span class="tag eq">已装备</span>' : ''}
        <div style="font-size:11px;color:#8fe6ff;margin-top:3px">${statLine(e)}</div>
        ${e.desc && e.effList && e.effList.length ? `<div style="font-size:11.5px;color:#bbb2dd;margin-top:2px;line-height:1.6">${e.desc}</div>` : ''}
        ${e.lore ? `<div style="font-size:11px;color:#8a7d8c;margin-top:2px;font-style:italic">${e.lore}</div>` : ''}
      </div>
      <div style="text-align:right;white-space:nowrap">
        ${equipped ? '' : `<div style="font-size:12px;color:${t.col};font-weight:700">战力 ${t.sign}${delta}</div>
        <button class="mini" data-wear="${k}">装备</button>`}
      </div>
    </div>`;
  };

  body.innerHTML = `<div style="grid-column:1/-1">
    <div style="font-size:12px;color:#bbb2dd;margin-bottom:10px">
      只显示 ${m.name} 能装备的东西。「战力」是攻防血速与全部特效折算后的综合评分，
      换装前可以先看变化值。
    </div>
    ${SLOTS.map(slot => {
    const cur = m.equips[SLOTS.indexOf(slot)];
    const list = owned.filter(k => EQUIPS[k].slot === slot)
      .sort((a, b) => PW.powerWith(m, b) - PW.powerWith(m, a));
    return `<div style="margin-bottom:14px">
        <div style="color:#ffd76a;font-size:13px;margin-bottom:5px">${SLOT_CN[slot]}</div>
        ${cur ? rowFor(cur, true) : '<div style="font-size:12px;color:#8a7d8c;margin-bottom:4px">当前：未装备</div>'}
        ${list.length ? list.map(k => rowFor(k, false)).join('')
      : '<div style="font-size:12px;color:#8a7d8c">—— 背包里没有 ' + m.name + ' 能用的' + SLOT_CN[slot] + ' ——</div>'}
      </div>`;
  }).join('')}
    <button class="mini g" id="eq-back" style="padding:8px 22px">返回</button>
  </div>`;

  body.querySelectorAll('[data-wear]').forEach(b => b.onclick = e => {
    e.stopPropagation();
    const k = b.dataset.wear;
    const e2 = EQUIPS[k];
    if (!PW.canEquip(m.id, e2)) { toast(`${m.name} 用不了${PW.equipType(e2) || '这件装备'}`); return; }
    const slotIdx = SLOTS.indexOf(e2.slot);
    const old = m.equips[slotIdx];
    if (old) G.bag[old] = (G.bag[old] || 0) + 1;
    G.bag[k]--;
    if (G.bag[k] <= 0) delete G.bag[k];
    m.equips[slotIdx] = k;
    recalc(m);
    sfx('heal');
    const after = PW.combatPower(m);
    toast(`${m.name} 装备了【${e2.name}】　战力 ${nowCP} → ${after}`);
    openEquipScreen(memberId, back);
  });
  $('eq-back').onclick = e => { e.stopPropagation(); back && back(); };
}

/* ============================================================
   面板
   ============================================================ */
/* 进入面板模式。
   关键：面板已经开着时不能再用 'panel' 覆盖 prevMode——否则关闭时会「恢复」到 panel 自己，
   面板视觉上消失但 G.mode 永远停在 'panel'，点任何地方都没反应，只能刷新页面。 */
function enterPanel(kind) {
  if (G.mode !== 'panel') G.prevMode = G.mode;
  G.panelKind = kind;
  G.mode = 'panel';
}
function closePanel() {
  $('panel').classList.add('hidden');

  /* 商店是用 G.mode='shop' 直接开的，没走 enterPanel。
     此前点【关闭】只把面板藏起来，G.mode 仍停在 'shop'——画面上什么都没有，
     点任何地方都没反应，只能刷新页面。关闭商店等同于逛完离开。 */
  if (G.mode === 'shop') { G.panelKind = null; G.prevMode = null; goAfterShop(); return; }

  const wasCamp = G.panelKind === 'camp';
  G.panelKind = null;
  if (G.mode === 'panel') G.mode = (G.prevMode && G.prevMode !== 'panel') ? G.prevMode : 'scene';
  G.prevMode = null;

  // 关掉营地 = 继续前进
  if (wasCamp) { continueAfterCamp(); return; }
  resumeSceneUI();
}

/* 收尾保险：回到 scene 模式时，画面上必须有对话框或抉择按钮之一。
   两者都没有说明这一幕的台词已经放完（例如从营地/商店返回），
   此时要把场景继续推下去，而不是把玩家留在空画面里。 */
function resumeSceneUI() {
  if (G.mode !== 'scene') return;
  const dlgHidden = $('dialogue').classList.contains('hidden');
  const chHidden = $('choices').classList.contains('hidden');
  if (!dlgHidden || !chHidden) return;
  const sc = G.scene;
  if (!sc) { gotoTitle(); return; }
  if (sc.lines && G.lineIdx < sc.lines.length) { $('dialogue').classList.remove('hidden'); nextLine(); return; }
  advanceScene();
}
/* 再点一次同一个 HUD 按钮 = 关闭（手机上这是最自然的退出方式） */
function togglePanel(kind, open) {
  if (G.mode === 'panel' && G.panelKind === kind) closePanel();
  else open();
}
function openPartyPanel() {
  enterPanel('party');
  const unspent = G.party.reduce((a, m) => a + (m.points || 0) + (m.sp || 0), 0);
  const teamCP = PW.partyPower(G.party);
  $('panel-title').textContent = `◈ 队伍状态　战力 ${teamCP}　持有 ${GR.formatCoin(G.gold)}${unspent ? `　· 有 ${unspent} 点未分配` : ''}`;
  const body = $('panel-body');
  body.innerHTML = G.party.map(m => {
    const pend = (m.points || 0) + (m.sp || 0);
    return `<div class="pcard">
      <img src="${portraitURL(m.portrait)}" alt="">
      <div class="pi">
        <div class="pn">${m.name} <span style="font-size:11.5px;color:#bbb2dd">Lv.${m.level} · ${m.title}</span>
          <span class="tag" style="color:#ffd76a;border-color:#ffd76a55">战力 ${PW.combatPower(m)}</span>
          ${pend ? `<span class="tag" style="background:#5a3a12;color:#ffd76a">可分配 ${pend}</span>` : ''}</div>
        <div class="bar hp"><i style="width:${(m.hp / m.maxHp * 100).toFixed(1)}%"></i></div>
        <div class="pv">HP ${Math.ceil(m.hp)} / ${m.maxHp}</div>
        <div class="bar mp"><i style="width:${(m.mp / m.maxMp * 100).toFixed(1)}%"></i></div>
        <div class="pv">${(ACTORS[m.id] && ACTORS[m.id].resourceName) || '术力'} ${Math.ceil(m.mp)} / ${m.maxMp}　攻击 ${m.atk}　防御 ${m.def}　速度 ${m.spd}</div>
        <div class="pv">会心${Math.round((m.cri || 0) * 100)}%　格挡${Math.round((m.blk || 0) * 100)}%　弹反${Math.round((m.par || 0) * 100)}%　EXP ${m.exp}/${expToNext(m.level)}</div>
        <div class="pv">饥饿度 ${m.hunger || 0} / ${GR.hungerCap((m.alloc && m.alloc.str) || 0)}　（到顶后每秒掉 1% 生命）</div>
        <div class="pv">抗性　${GR.RESISTS.map(r => `${r.name}${Math.round(((m.resist || {})[r.id] || 0) * 100)}%`).join('　')}</div>
        <div>${m.skills.map(sk => `<span class="tag">${SKILLS[sk]?.name || sk}</span>`).join('')}</div>
        <div>${m.equips.filter(Boolean).map(e => {
      const eq = EQUIPS[e];
      if (!eq) return `<span class="tag">${e}</span>`;
      return `<span class="tag eq" style="${eq.col ? `color:${eq.col}` : ''}">${eq.name} <span style="opacity:.7">Lv.${PW.equipLevel(eq)}</span></span>`;
    }).join('') || '<span class="tag">未装备</span>'}</div>
        <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">
          <button class="mini" data-grow="${m.id}">养成${pend ? ' ●' : ''}</button>
          <button class="mini g" data-equip="${m.id}">装备</button>
        </div>
      </div>
    </div>`;
  }).join('') + `<div style="grid-column:1/-1;font-size:12px;color:#bbb2dd;margin-top:6px">
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
      </div>
      道具：${Object.keys(G.bag).filter(k => G.bag[k] > 0 && !EQUIPS[k]).map(k => `${ITEMS[k]?.name || k}×${G.bag[k]}`).join('、') || '无'}
    </div>`;
  body.querySelectorAll('[data-grow]').forEach(b => b.onclick = e => { e.stopPropagation(); sfx('ui'); openGrowth(b.dataset.grow); });
  body.querySelectorAll('[data-equip]').forEach(b => b.onclick = e => { e.stopPropagation(); sfx('ui'); openEquipScreen(b.dataset.equip, openPartyPanel); });
  $('panel').classList.remove('hidden');
}

/* 离开营地后继续推进本场景。
   关掉营地面板和点「继续前进」是同一件事——否则玩家点【关闭】就会卡在
   一个既没有对话框也没有面板的空画面里。 */
function continueAfterCamp() {
  G.campScene = null;
  G.mode = 'scene';
  const sc2 = G.scene;
  if (!sc2) { gotoTitle(); return; }
  if (sc2.shop) { openShop(sc2.shop); return; }
  if (sc2.enemies) { startBattleFromScene(sc2); return; }
  if (sc2.choices) { showChoices(sc2.choices); return; }
  if (sc2.next) { gotoScene(sc2.next); return; }
  gotoTitle();
}

/* 营地闲聊的一句提示，真正的内容在羁绊等级里体现 */
const CAMP_TALK = {
  cang: '他在翻那本记名字的册子。',
  lei: '她在缠枪柄上的布，缠到第三层了。',
  ryze: '她坐在火边，手里捏着那枚纸太阳。',
};

/* ============================================================
   养成：属性点 + 天赋树
   ============================================================ */
function openGrowth(memberId) {
  const m = G.party.find(p => p.id === memberId);
  if (!m) return;
  const talents = GR.TALENTS[m.id] || [];
  const branches = GR.BRANCHES[m.id] || [];

  const statRows = GR.STATS.map(st => `<div class="shop-row">
      <div><b style="color:${st.col}">${st.name}</b>　<span style="color:#bbb2dd;font-size:11.5px">${st.desc}</span>
        <div style="font-size:12px;color:#8fe6ff;margin-top:2px">已投入 ${m.alloc[st.id] || 0}</div></div>
      <button class="mini" data-stat="${st.id}" ${(m.points || 0) < 1 ? 'disabled' : ''}>+1</button>
    </div>`).join('');

  const treeCols = branches.map(br => {
    const nodes = talents.filter(t => t.br === br);
    return `<div style="flex:1;min-width:190px">
      <div style="color:#ffd76a;font-weight:700;margin-bottom:6px">${br}</div>
      ${nodes.map(t => {
      const rank = (m.talents && m.talents[t.id]) || 0;
      const chk = GR.canLearn(m, t.id);
      const done = rank >= t.max;
      return `<div class="shop-row" style="align-items:flex-start">
          <div style="flex:1">
            <b style="color:${done ? '#ffd76a' : rank ? '#8fe6ff' : '#e8e0f0'}">${t.name || t.br}</b>
            <span style="font-size:11px;color:#8a7d8c">${rank}/${t.max}</span>
            <div style="font-size:11.5px;color:#bbb2dd;margin-top:2px">${t.desc}</div>
            ${!chk.ok && !done ? `<div style="font-size:11px;color:#8a7d8c;margin-top:2px">${chk.why}</div>` : ''}
          </div>
          <button class="mini" data-tal="${t.id}" ${chk.ok ? '' : 'disabled'}>+</button>
        </div>`;
    }).join('')}
    </div>`;
  }).join('');

  openPanel(`◈ ${m.name} 的养成`, `
    <div style="grid-column:1/-1">
      <div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:10px;font-size:13px">
        <span>属性点 <b style="color:#ffd76a">${m.points || 0}</b></span>
        <span>技能点 <b style="color:#ffd76a">${m.sp || 0}</b></span>
        <span style="color:#bbb2dd">攻${m.atk} 防${m.def} 速${m.spd} 生命${m.maxHp} ${m.resource === 'rage' ? '怒气' : '术力'}${m.maxMp}</span>
      </div>
      <div style="color:#ffd76a;font-weight:700;margin:10px 0 6px">属性点</div>
      ${statRows}
      <div style="color:#ffd76a;font-weight:700;margin:16px 0 6px">天赋树　<span style="font-size:11.5px;color:#bbb2dd;font-weight:400">同一分支要点满上一层才能往下走</span></div>
      <div style="display:flex;gap:12px;flex-wrap:wrap">${treeCols}</div>
      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="mini g" id="grow-back">← 返回队伍</button>
        <button class="mini" id="grow-respec">洗点重来</button>
      </div>
    </div>`);

  document.querySelectorAll('[data-stat]').forEach(b => b.onclick = e => {
    e.stopPropagation();
    if ((m.points || 0) < 1) return;
    m.points--;
    m.alloc[b.dataset.stat] = (m.alloc[b.dataset.stat] || 0) + 1;
    recalc(m); sfx('levelup'); openGrowth(memberId);
  });
  document.querySelectorAll('[data-tal]').forEach(b => b.onclick = e => {
    e.stopPropagation();
    const r = GR.learnTalent(m, b.dataset.tal);
    if (!r.ok) { toast(r.why); return; }
    recalc(m); sfx('levelup'); openGrowth(memberId);
  });
  $('grow-back').onclick = e => { e.stopPropagation(); openPartyPanel(); };
  $('grow-respec').onclick = e => {
    e.stopPropagation();
    const r = GR.respec(m);
    recalc(m); sfx('heal');
    toast(`退回 ${r.points} 属性点、${r.sp} 技能点`);
    openGrowth(memberId);
  };
}

/* ============================================================
   标题 / 载入 / 结局
   ============================================================ */
function gotoTitle() {
  G.mode = 'title';
  setMusic(null);
  $('title').classList.remove('hidden');
  $('hud').classList.add('hidden');
  $('dialogue').classList.add('hidden');
  $('choices').classList.add('hidden');
  $('cmdmenu').classList.add('hidden');
  $('panel').classList.add('hidden');
  $('ending').classList.add('hidden');
  $('loading').classList.add('hidden');
  $('btn-continue').disabled = !anySave();
  $('btn-continue').style.opacity = anySave() ? 1 : .4;
}
/* 通用面板：给存档槽、羁绊、遗物、天赋这些新界面共用 */
function openPanel(title, html, kind = 'generic') {
  enterPanel(kind);
  $('panel').classList.remove('hidden');
  $('panel-title').textContent = title;
  $('panel-body').innerHTML = html;
}

/* 存档槽面板：0 号是自动存档（只能读不能写），1~3 手动。 */
function openSlots(mode) {
  sfx('ui');
  const rows = [];
  for (let i = 0; i < SAVE_SLOTS; i++) {
    const info = slotInfo(i);
    const label = i === 0 ? '自动存档' : `存档 ${i}`;
    const when = info ? new Date(info.t).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
    const body = info
      ? `${info.chapter}　Lv.${info.lv}${info.ng ? `　<span style="color:#ffd76a">周目 ${info.ng + 1}</span>` : ''}<div style="font-size:11px;color:#8a7d8c">${when}</div>`
      : '<span style="color:#8a7d8c">空</span>';
    const dis = (mode === 'save' && i === 0) || (mode === 'load' && !info);
    rows.push(`<button class="shop-row slotbtn" data-slot="${i}" ${dis ? 'disabled' : ''} style="width:100%;text-align:left;${dis ? 'opacity:.4' : ''}">
      <div><b>${label}</b><div style="font-size:12px;color:#bbb2dd;margin-top:2px">${body}</div></div>
      <div style="color:#ffd76a">${dis ? '' : (mode === 'save' ? '写入' : '读取')}</div>
    </button>`);
  }
  openPanel(mode === 'save' ? '保存到哪个存档？' : '读取哪个存档？',
    `<div style="display:grid;gap:8px">${rows.join('')}</div>`);
  document.querySelectorAll('.slotbtn').forEach(b => {
    b.onclick = ev => {
      ev.stopPropagation();
      const i = Number(b.dataset.slot);
      closePanel();
      if (mode === 'save') saveGame(i); else loadGame(i);
    };
  });
}

function showLoading(title, text) {
  $('loading').classList.remove('hidden');
  $('load-chapter').textContent = title || G.chapter;
  $('load-text').textContent = text || '命运正在转动……';
  setMusic('calm');
}
function showEnding(kind, continueTo) {
  const e = ENDINGS[kind];
  G.endingContinue = continueTo || null;
  if (!continueTo) G.lastEnding = kind;
  G.mode = 'ending';
  setMusic('ending');
  $('ending').classList.remove('hidden');
  $('ending-label').textContent = continueTo ? e.label + ' · 第一部 完' : e.label;
  $('ending-title').textContent = e.title;
  /* 第一部的结局是过场，不是终点。
     此前这里按钮永远写着「再战一次」，玩家看完 SECRET END 只会以为通关了，
     根本不知道后面还有第二部。 */
  $('ending-text').textContent = continueTo
    ? e.text + '\n\n——门关上了。但门后面，并不是空的。'
    : e.text;
  $('btn-again').textContent = continueTo ? '继续 · 第二部 门的另一边 →' : '旅程结算';
  $('ending-bg').style.background = `radial-gradient(ellipse at 50% 40%, #2a1a3c, #06040c)`;
  $('dialogue').classList.add('hidden');
  $('cmdmenu').classList.add('hidden');
  $('hud').classList.add('hidden');
}
function newGame() {
  G.party = [];
  /* 原文第7章的初始面板：「声望：0；金钱：0」。背包里也没有系统白送的药水。
     ⚠ 此前是三瓶回复药 + 一瓶术力泉 + 120 金，都是本项目编的。 */
  G.bag = {};
  G.gold = 0;
  G.fame = 0;
  G.flags = {};
  G.battleCheckpoint = null;
  G.chapter = '';
  addMember('kaito', 0);   // 原文：等级 0 级，职业：无
  for (const m of G.party) { m.hp = m.maxHp; m.mp = m.resource === 'rage' ? 0 : m.maxMp; }
  G.mode = 'scene';
  $('title').classList.add('hidden');
  $('hud').classList.remove('hidden');
  $('loading').classList.add('hidden');
  gotoScene('prologue');
}
function saveData() {
  return {
    v: 3, t: Date.now(), sceneId: SCENES[G.sceneId]?.once ? G.sceneId : (G.scene?.next || G.sceneId), chapter: G.chapter,
    battleCheckpoint: G.battleCheckpoint,
    flags: G.flags, gold: G.gold, bag: G.bag,
    loot: collectLoot(),            // 随机生成的装备必须跟着存档走
    relics: G.relics, bonds: G.bonds, codex: G.codex,
    party: G.party.map(m => ({
      id: m.id, level: m.level, exp: m.exp, hp: m.hp, mp: m.mp,
      equips: m.equips, skills: m.skills, bonus: m.bonus,
      alloc: m.alloc, points: m.points, sp: m.sp, talents: m.talents,
    })),
  };
}
function saveGame(slot = 1, quiet = false) {
  try {
    localStorage.setItem(slotKey(slot), JSON.stringify(saveData()));
    if (!quiet) toast(slot === 0 ? '◇ 已自动存档' : `◇ 已保存到存档 ${slot}`);
  } catch (e) { toast('保存失败：' + e.message); }
}
function autoSave() { saveGame(0, true); }
function loadGame(slot = 1) {
  const raw = localStorage.getItem(slotKey(slot)) || (slot === 1 ? localStorage.getItem(LEGACY_KEY) : null);
  if (!raw) { toast('这个存档是空的'); return; }
  try {
    const d = JSON.parse(raw);
    restoreLoot(d.loot);          // 先把随机装备注册回 EQUIPS，否则 recalc 查不到
    G.relics = d.relics || {};
    G.bonds = d.bonds || {};
    G.codex = d.codex || {};
    G.party = d.party.map(p => {
      const m = makeMember(p.id, p.level);
      m.exp = p.exp || 0; m.equips = p.equips || m.equips; m.skills = p.skills || m.skills;
      m.bonus = p.bonus || m.bonus;
      m.alloc = p.alloc || m.alloc;
      m.points = p.points || 0; m.sp = p.sp || 0; m.talents = p.talents || {};
      recalc(m);
      m.hp = Math.min(m.maxHp, Math.max(1, p.hp));
      m.mp = m.resource === 'rage' ? 0 : Math.min(m.maxMp, p.mp ?? m.maxMp);
      return m;
    });
    G.bag = d.bag || {}; G.gold = d.gold || 0; G.flags = d.flags || {};
    G.battleCheckpoint = d.battleCheckpoint || null;
    // 战斗中保存的进度从本场开战前恢复，避免读档重复消耗道具或保留残血。
    if (SCENES[d.sceneId]?.enemies && G.battleCheckpoint?.sceneId === d.sceneId) {
      const snap = JSON.parse(JSON.stringify(G.battleCheckpoint));
      G.party = snap.party; G.bag = snap.bag; G.gold = snap.gold; G.flags = snap.flags;
    }
    G.chapter = d.chapter || '';
    $('title').classList.add('hidden');
    $('ending').classList.add('hidden');
    $('hud').classList.remove('hidden');
    gotoScene(d.sceneId || 'prologue');
    toast('◇ 读取存档成功');
  } catch (e) { toast('读取失败'); }
}

/* ============================================================
   奥义一览
   ============================================================ */
function openGallery() {
  G.prevMode = G.mode;
  const panel = $('panel');
  $('panel-title').textContent = '★ 奥义一览';
  const ults = [
    ['kaito', 'miehun', '奥义·灭魂炎狱斩', '五段斩在敌人体内燃起炎狱。热血全满时发动。'],
    ['cang', 'fuyin', '福音·复苏之光', '唤醒倒下的同伴并回复其生命。'],
    ['lei', 'xunyou', '奥义·疾风迅游枪', '化作疾风，七连贯穿。热血全满时发动。'],
    ['ryze', 'juedui', '奥义·绝对零度', '连时空都冻结的极寒。热血全满时发动。'],
  ];
  $('panel-body').innerHTML = ults.map(([pid, sid, name, desc]) => {
    const s = SKILLS[sid];
    return `<div class="pcard">
      <img src="${portraitURL(pid)}" alt="">
      <div class="pi">
        <div class="pn">${ACTORS[pid].name} <span style="font-size:11.5px;color:#bbb2dd">${ACTORS[pid].title}</span></div>
        <div style="color:#ffd76a;font-weight:700;margin:4px 0">★ ${name}</div>
        <div class="pv">${s ? s.desc : desc}</div>
        <div class="pv" style="margin-top:4px">消耗：${ACTORS[pid].resource === 'rage' ? '怒气' : '术力'} ${s ? s.mp : '?'}</div>
        <div class="pv" style="margin-top:6px;color:#ff9a9a">${ACTORS[pid].quote}</div>
      </div>
    </div>`;
  }).join('') + `<div style="grid-column:1/-1">
    <div class="shop-row" style="flex-direction:column;align-items:flex-start;gap:6px">
      <b style="color:#ffd76a">战斗操作</b>
      <div style="font-size:12.5px;line-height:1.9;color:#ddd5ff">
        · 鼠标点击指令按钮，或直接点击画面 = 确认<br>
        · <kbd>空格</kbd> / <kbd>Z</kbd> = 推进对话；战斗点击指令和目标，不需要时机操作<br>
        · 【格挡】提升本次防御概率并积攒怒气；顶部显示未来行动顺序<br>
        · 学会奥义且怒气或术力足够时，可在【技能】中发动<br>
        · 【◈ 队伍】底部查看目标和支援；战败后可恢复战前状态重试<br>
        · 敌人有 <b style="color:#8fe6ff">弱点属性</b>，用对应属性攻击可打出 1.5 倍伤害
      </div>
      <button class="mini g" id="gal-back" style="padding:8px 22px;margin-top:6px">返回</button>
    </div></div>`;
  panel.classList.remove('hidden');
  $('gal-back').onclick = e => { e.stopPropagation(); closePanel(); };
}

/* ============================================================
   HUD
   ============================================================ */
function refreshHUD() {
  $('hud-chapter').textContent = G.chapter || '炎之刃';
}
$('btn-status').onclick = e => { e.stopPropagation(); togglePanel('party', openPartyPanel); };
$('panel-close').onclick = e => { e.stopPropagation(); closePanel(); };
// 点面板本身的空白处（不是里面的内容）也关闭
$('panel').addEventListener('pointerdown', e => { if (e.target === $('panel')) closePanel(); });
$('btn-bag').onclick = e => {
  e.stopPropagation();
  if (G.mode === 'battle') return toast('战斗中请使用指令栏的【道具】');
  if (G.mode === 'panel' && G.panelKind === 'bag') return closePanel();
  enterPanel('bag');
  $('panel-title').textContent = '◆ 持有道具　' + G.gold + ' 金';
  $('panel-body').innerHTML = `<div style="grid-column:1/-1">
    ${Object.keys(G.bag).filter(k => G.bag[k] > 0).map(k => {
    const it = ITEMS[k] || EQUIPS[k];
    return `<div class="shop-row"><div><b>${it.name}</b> ×${G.bag[k]}<div style="font-size:11.5px;color:#bbb2dd">${it.desc || ''}</div></div>
        ${ITEMS[k] ? `<button class="mini" data-use="${k}">使用</button>` : `<button class="mini g" data-eq="${k}">装备</button>`}</div>`;
  }).join('') || '<div style="color:#a99">—— 背包空空如也 ——</div>'}</div>`;
  $('panel').classList.remove('hidden');
  $('panel-body').querySelectorAll('[data-use]').forEach(b => b.onclick = ev => {
    ev.stopPropagation();
    const k = b.dataset.use;
    const it = ITEMS[k];
    if (it.heal) { const m = G.party.find(p => p.hp < p.maxHp) || G.party[0]; m.hp = Math.min(m.maxHp, m.hp + it.heal); toast(`${m.name} 回复了生命`); }
    if (it.mp) { const m = G.party[0]; m.mp = Math.min(m.maxMp, m.mp + it.mp); toast('术力回复'); }
    G.bag[k]--; if (G.bag[k] <= 0) delete G.bag[k];
    sfx('heal'); $('btn-bag').onclick({ stopPropagation() { } });
  });
};
$('btn-save').onclick = e => { e.stopPropagation(); openSlots('save'); };
$('btn-title').onclick = e => { e.stopPropagation(); if (confirm('返回标题画面？未保存的进度会丢失。')) gotoTitle(); };
$('btn-new').onclick = e => { e.stopPropagation(); sfx('levelup'); newGame(); };
$('btn-continue').onclick = e => { e.stopPropagation(); sfx('ui'); openSlots('load'); };
$('btn-gallery').onclick = e => { e.stopPropagation(); sfx('ui'); openGallery(); };
$('btn-help').onclick = e => { e.stopPropagation(); sfx('ui'); openGallery(); };
$('btn-again').onclick = e => {
  e.stopPropagation();
  sfx('ui');
  if (G.endingContinue) {           // 第一部结局：放完继续第二部
    const nx = G.endingContinue;
    G.endingContinue = null;
    $('ending').classList.add('hidden');
    G.mode = 'scene';
    $('hud').classList.remove('hidden');
    $('dialogue').classList.remove('hidden');
    G.campShownFor = null;
    gotoScene(nx);
    return;
  }
  gotoTitle();
};
document.addEventListener('pointerdown', () => ac(), { once: true });

/* ============================================================
   绘制场景（文字冒险）
   ============================================================ */
function drawScene(dt) {
  G.bgT += dt;
  const t = G.bgT;
  SP.drawBackground(ctx, G.bg, W, H, t, {});
  // 队伍剪影站在前景（若有队友立绘位置）
  const members = G.party.slice(0, 4);
  const spots = [{ x: 180, y: 470 }, { x: 300, y: 484 }, { x: 410, y: 470 }, { x: 510, y: 486 }];
  members.forEach((m, i) => {
    const sp = spots[i];
    const at = ACTORS[m.id];
    const pal = {
      kaito: { hair: '#2b2340', cloth: '#1d2a4a', trim: '#c8332f', eye: '#ff8a1a', weapon: 'sword' },
      cang: { hair: '#7d5fd8', cloth: '#efeaf8', trim: '#6a4fc0', eye: '#57e0ff', weapon: 'staff' },
      lei: { hair: '#3a3a48', cloth: '#2e3a52', trim: '#c8332f', eye: '#9be25a', weapon: 'spear' },
      ryze: { hair: '#d8d2ee', cloth: '#2a2050', trim: '#c9a8ff', eye: '#c9a8ff', weapon: 'sword', cape: '#1c1638' },
    }[m.id];
    // 呼吸浮动
    SP.drawHumanoid(ctx, sp.x + Math.sin(t * 0.8 + i) * 4, sp.y, 0.92, t + i * 0.7, 'idle', pal);
  });
  // 顶部渐变遮罩（让对话框更清晰）
  const g = ctx.createLinearGradient(0, H - 220, 0, H);
  g.addColorStop(0, 'rgba(4,4,12,0)');
  g.addColorStop(1, 'rgba(4,4,12,.75)');
  ctx.fillStyle = g;
  ctx.fillRect(0, H - 220, W, 220);
}

/* ============================================================
   主循环
   ============================================================ */
let last = performance.now();
let dmgVig = 0, hotOv = 0;

function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  G.frames = (G.frames || 0) + 1;
  syncInput();

  /* --- 更新 --- */
  if (G.mode === 'scene') {
    updateTyping(dt);
    if (input.confirmPressed) {
      const done = G.typed >= G.fullText.length;
      if (!done) { G.typed = G.fullText.length; G.typing = 0; $('dlg-text').innerHTML = formatLine(G.fullText); $('dlg-next').classList.remove('hidden'); }
      else if (!choicesOpen()) nextLineCheck();
    }
  }
  if (G.mode === 'battle' && G.battle) {
    const b = G.battle;
    b.dmgDealt = 0;
    const prevHp = b.party.map(m => m.hp);
    BT.updateBattle(b, dt, input);
    // 受击红晕
    b.party.forEach((m, i) => { if (m.hp < prevHp[i]) dmgVig = 1; });
    // 日志更新
    $('battle-log').innerHTML = BT.battleLogHTML(b);
    $('battle-log').classList.toggle('story', !!b.scripted);
    // 格挡条
  } else {
    updateToast(dt);
  }

  /* 兜底：G.mode 停在 'panel' 但面板已经隐藏 = 状态失同步，此时点哪都没反应。
     与其让玩家只能刷新，不如直接恢复。 */
  if (G.mode === 'panel' && $('panel').classList.contains('hidden')) closePanel();

  /* 特效层透明度 */
  dmgVig = Math.max(0, dmgVig - dt * 1.6);
  $('dmgvignette').style.opacity = (dmgVig * 0.75).toFixed(2);
  const anyUlt = G.mode === 'battle' && G.battle && G.battle.party.some(m => BT.canUlt(m));
  hotOv = anyUlt ? Math.min(1, hotOv + dt * 3) : Math.max(0, hotOv - dt * 3);
  $('hotoverlay').style.opacity = (hotOv * 0.55).toFixed(2);
  $('hotoverlay').style.background = `radial-gradient(ellipse at center, rgba(255,150,0,0) 40%, rgba(255,90,0,.45) 100%)`;

  /* --- 绘制 --- */
  watchPerf(dt);
  applyBaseTransform();          // 每帧重置基准变换，save/restore 失衡时能自愈
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  if (G.mode === 'battle' && G.battle) {
    BT.drawBattle(G.battle, ctx, W, H);
  } else if (G.mode === 'scene' || G.mode === 'shop' || G.mode === 'panel') {
    drawScene(dt);
  } else if (G.mode === 'title' || G.mode === 'ending') {
    // 标题画面用 CSS 渐变，canvas 画一点星海
    SP.drawBackground(ctx, 'void', W, H, performance.now() / 1000, {});
  }
  ctx.restore();

  /* 奥义 cut-in DOM */
  if (G.mode === 'battle' && G.battle && G.battle.cutin) {
    const c = G.battle.cutin;
    const el = $('cutin');
    el.classList.remove('hidden');
    $('cutin-img').src = portraitURL(c.portrait);
    $('cutin-name').textContent = c.name;
  } else {
    $('cutin').classList.add('hidden');
  }

  /* 载入过渡 */
  if (G.loadTarget) {
    G.loadTimer += dt;
    if (G.loadTimer > 1.5) {
      const target = G.loadTarget; G.loadTarget = null; G.loadTimer = 0;
      $('loading').classList.add('hidden');
      gotoScene(target);
    }
  }

  // 边缘触发标志：每帧消费一次后清除
  input.actionPressed = false;
  input.confirmPressed = false;
  input.cancelPressed = false;

  requestAnimationFrame(loop);
}

/* 台词放完之后该做什么，只允许 finishLines 一处说了算。
   此前这里自己又判了一次 sc.choices，于是「营地 + 二选一」的场景
   会直接弹选项、跳过营地——点击推进和无头测试走的都是这条路。 */
function nextLineCheck() {
  const sc = G.scene;
  if (!sc) return;
  if (sc.lines && G.lineIdx < sc.lines.length) nextLine();
  else finishLines();
}

/* ============================================================
   自动化测试接口（仅当 URL 带 ?debug=1 时启用）
   用于 tools/ 下的无头回归测试，正常玩家不会看到任何差异
   ============================================================ */
const DEBUG = new URLSearchParams(location.search).has('debug') || location.hash === '#debug';
if (DEBUG) {
/* 供无头测试：推进剧情（等价于点击画面） */
window.__fast = false;   // 无头测试：跳过商店
window.__advance = function (n = 1) {
  for (let i = 0; i < n; i++) {
    if (G.mode === 'shop') { goAfterShop(); continue; }
    if (G.mode !== 'scene' || !G.scene) break;
    G.typed = G.fullText.length; G.typing = 0;
    nextLineCheck();
    if (window.__fast && G.mode === 'shop') { goAfterShop(); }
  }
  return `${G.mode} | ${G.sceneId}`;
};
/* 直接给当前出战角色指定行动（等价于点击指令按钮） */
window.__cmd = function (actorIdx, type, skill, target) {
  const b = G.battle;
  if (!b) return 'no-battle';
  const m = b.party[actorIdx];
  if (!m) return 'no-actor';
  G.curActor = actorIdx;
  doCmd(m, { type: type || 'attack', skill, target: target ?? 0 });
  return `${m.id}:${type || 'attack'}${skill ? ':' + skill : ''} cmds=${b.party.map(p => p.cmd ? 1 : 0).join('')} ui=${b.ui.mode}`;
};
/* 用普攻把当前回合剩余角色补完 */
window.__fillTurn = function () {
  const b = G.battle;
  if (!b) return 'no-battle';
  for (let i = 0; i < b.party.length; i++) {
    const m = b.party[i];
    if (!m.dead && !m.cmd) { G.curActor = i; doCmd(m, { type: 'attack', target: 0 }); }
  }
  return `uimode=${b.ui.mode} q=${b.ui.queue.length}`;
};
window.__choice = function (i) {
  const list = G.scene && G.scene.choices;
  if (!list) return 'no-choices';
  pickChoice(list[i] || list[0]);
  return 'picked ' + i;
};
window.__partyJoin = function (id, lv) { const m = addMember(id, lv); return m.name + ' Lv.' + m.level; };
window.__newGame = function (level = 0, members = ['kaito']) {
  newGame();
  G.party = [];
  for (const id of members) addMember(id, level);
  for (const m of G.party) { m.hp = m.maxHp; m.mp = m.resource === 'rage' ? 0 : m.maxMp; }
  return G.party.map(m => m.name + 'Lv' + m.level + '[' + m.skills.join(',') + ']').join(' ');
};
window.__setScene = function (id) { gotoScene(id); return id; };
/* 无头测试：把全队拉到指定等级并重算属性（含属性点/天赋/遗物） */
window.__levelTo = function (lv) {
  for (const m of G.party) {
    while (m.level < lv) { m.level++; GR.grantLevelPoints(m, 1); }
    m.skills = ACTORS[m.id].skills.filter(x => x.lv <= m.level).map(x => x.id);
    recalc(m);
    m.hp = m.maxHp; m.mp = m.resource === 'rage' ? 0 : m.maxMp;
  }
  return G.party.map(m => m.name + m.level).join(',');
};
window.__autoRun = function (maxSteps = 400, maxMs = 120000) {
  // 自动通剧情：推进对话 + 自动战斗 + 自动选第一个选项
  let steps = 0;
  const t0 = performance.now();
  const trace = [];
  let lastSig = '', stuck = 0;
  if (window.__godPulse) clearInterval(window.__godPulse);
  if (window.__godMode) window.__godPulse = setInterval(() => { for (const m of G.party) { m.atk = 99999; } if (G.battle) for (const m of G.battle.party) { m.atk = 99999; m.spd = 9999; } }, 250);
  const tick = () => {
    steps++;
    try { return tickBody(); } catch (e) { window.__lastRunReason = 'EXCEPTION: ' + (e && e.message); window.__trace = trace; return window.__lastRunReason; }
  };
  const tickBody = () => {
    if (steps > maxSteps) { window.__trace = trace; window.__lastRunReason = 'max-steps:' + G.mode + '|' + G.sceneId; return window.__lastRunReason; }
    if (performance.now() - t0 > maxMs) { window.__trace = trace; window.__lastRunReason = 'timeout:' + G.mode + '|' + G.sceneId; return window.__lastRunReason; }
    if (window.__stopRun) { window.__stopRun = false; window.__trace = trace; window.__lastRunReason = 'graceful-stop:' + G.mode + '|' + G.sceneId; return window.__lastRunReason; }
    if (G.mode === 'ending') { window.__trace = trace; window.__lastRunReason = 'ending:' + G.sceneId; return window.__lastRunReason; }
    trace.push(G.mode + ':' + G.sceneId + (G.battle ? '(' + G.battle.enemies.map(e => e.hp).join(',') + ')' : ''));
    if (trace.length > 60) trace.shift();
    // 卡死检测
    const sig = G.mode + ':' + G.sceneId + (G.battle ? ':' + G.battle.turn + ':' + G.battle.enemies.map(e => e.hp).join(',') : '');
    if (sig === lastSig) { stuck++; if (stuck > 160) { window.__trace = trace; window.__lastRunReason = 'stuck:' + sig; return window.__lastRunReason; } }
    else { lastSig = sig; stuck = 0; }
    if (G.mode === 'battle' && G.battle) {
      const b = G.battle;
      if (b.ui.mode === 'input' && !b.over) {
        const m = b.party[G.curActor];
        if (!m || m.dead) { /* 行动条会自行推进 */ }
        else {
          // 简易 AI：能用奥义就用，其次用能负担的最强攻击技，最后普攻
          const ult = m.skills.map(s => SKILLS[s]).find(s => s && s.ult && (s.mp || 0) <= m.mp);
          /* 净化战要先清掉 objective.targets 里的那些，本体打不死。
             此前这里把目标写死成 curse_root，第二部的玄鹿战（目标是 withered_root）
             因此永远找不到可打的敌人，全队一直格挡直到team wipe，再从失败重试，无限循环。 */
          const purge = b.objective?.type === 'purify' ? (b.objective.targets || []) : null;
          const target = b.enemies.findIndex(e => !e.dead && (!purge || purge.includes(e.ref)));
          if (BT.canObjective(b, m)) doCmd(m, { type: 'objective' });
          else if (target < 0) doCmd(m, { type: 'guard' });
          else if (ult) { doCmd(m, { type: 'skill', skill: ult.id, target }); }
          else {
            const atkSkills = m.skills.map(s => SKILLS[s])
              .filter(s => s && s.type === 'atk' && !s.ult && (s.mp || 0) <= m.mp);
            atkSkills.sort((a, b) => (b.power * (b.hits || 1)) - (a.power * (a.hits || 1)));
            const best = atkSkills[0];
            if (best && (best.power * (best.hits || 1)) > 1.05 && m.mp > best.mp) doCmd(m, { type: 'skill', skill: best.id, target });
            else doCmd(m, { type: 'attack', target });
          }
        }
      }
    } else if (G.mode === 'shop') { goAfterShop(); }
    else if (G.mode === 'panel') {
      // 营地等面板会把 G.mode 切到 panel；无头测试里直接点「继续前进」
      const go = document.getElementById('camp-go');
      if (go) go.click(); else closePanel();
    }
    else if (G.mode === 'scene') {
      if (G.scene && G.scene.choices) pickChoice(G.scene.choices.find(choiceAvailable));
      else __advance(1);
    } else if (G.mode === 'title') { window.__trace = trace; return 'back-to-title:' + G.sceneId; }
    setTimeout(tick, 30);
    return 'running';
  };
  return tick();
};
window.__startBattle = function (obj) { G.scene = { ...obj, id: obj.id, lines: null }; G.sceneId = obj.id; startBattleFromScene(G.scene); return 'battle-start'; };
window.__autoBattle = function (rounds) {
  // 自动打一场：每回合随机下指令（用于无头验证战斗流程）
  let guardN = 0;
  const tick = () => {
    const b = G.battle;
    if (!b) return 'battle-over';
    if (b.ui.mode === 'input' && !b.over) {
      const m = b.party[G.curActor];
      if (m && !m.dead) {
        const alive = b.party.filter(p => !p.dead);
        const ultReady = m.skills.map(s => SKILLS[s]).find(s => s.ult && (s.mp || 0) <= m.mp);
        if (ultReady) doCmd(m, { type: 'skill', skill: ultReady.id, target: 0 });
        else if (m.mp > 25 && m.id !== 'kaito' && Math.random() < .5) {
          const sk = m.skills.map(s => SKILLS[s]).filter(s => s && !s.ult && s.mp > 0 && s.mp <= m.mp);
          if (sk.length) doCmd(m, { type: 'skill', skill: sk[Math.floor(Math.random() * sk.length)].id, target: 0 });
          else doCmd(m, { type: 'attack', target: 0 });
        } else doCmd(m, { type: 'attack', target: 0 });
      }
    }
    guardN++;
    if (guardN > 4000) return 'timeout';
    if (G.battle) { setTimeout(tick, 60); return 'running'; }
    return 'done:' + G.mode + '|' + G.sceneId;
  };
  return tick();
};
window.__god = function () {
  // 无头测试用：让战斗瞬间结束，只验证剧情流程
  window.__godMode = true;
  for (const m of G.party) { m.atk = 99999; m.spd = 9999; }
  if (G.battle) for (const m of G.battle.party) { m.atk = 99999; m.spd = 9999; }
  return 'god-mode';
};
window.__traceQ = function () { return 'removed'; };
window.__qc = function () {
  const b = G.battle;
  if (!b) return { mode: G.mode, frames: G.frames };
  const cur = b.ui.queue[0];
  return { frames: G.frames, t: +b.t.toFixed(2), turn: b.turn, over: b.over, uimode: b.ui.mode, qlen: b.ui.queue.length, curT: cur ? +(cur._t || 0).toFixed(2) : null, curDur: cur ? cur.dur : null, ehp: b.enemies.map(e => e.hp), hp: b.party.map(m => Math.ceil(m.hp)), hitstop: +b.hitstop.toFixed(3), dbg: window.__dbg };
};
window.__state = function () {
  return {
    mode: G.mode, scene: G.sceneId, chapter: G.chapter,
    line: G.lineIdx, lines: G.scene && G.scene.lines ? G.scene.lines.length : null,
    party: G.party.map(m => `${m.name}Lv${m.level} ${Math.ceil(m.hp)}/${m.maxHp} ${m.resource}${Math.ceil(m.mp)}`),
    gold: G.gold, bag: G.bag,
    battle: G.battle ? { turn: G.battle.turn, over: G.battle.over, ehp: G.battle.enemies.map(e => e.hp + '/' + e.maxHp), hp: G.battle.party.map(m => Math.ceil(m.hp) + '/' + m.maxHp), log: G.battle.log.map(l => l.txt.replace(/<[^>]+>/g, '')) } : null,
  };
};
window.__playerHurt = function () {
  // 无头测试：把我方血量压低，检验危机与弹反
  if (G.battle) for (const m of G.battle.party) m.hp = Math.max(1, Math.floor(m.maxHp * 0.2));
  return 'hurt';
};
window.__giveUlt = function () {
  if (G.battle) for (const m of G.battle.party) m.mp = m.maxMp;
  return 'ult-ready';
};
window.__envProbe = function () {
  return JSON.stringify({
    isTouch: IS_TOUCH, coarse: COARSE, points: navigator.maxTouchPoints || 0,
    onTouchStart: 'ontouchstart' in window,
    touchUI: document.body.classList.contains('touch-ui'),
    vw: window.innerWidth, vh: window.innerHeight,
    scale: stage.dataset.scale, portrait: stage.dataset.portrait,
    transform: stage.style.transform,
    rect: (function () { const r = stage.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; })(),
  });
};
window.__canvasStats = function () {  const c = document.getElementById('cv');
  const g = c.getContext('2d');
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let r = 0, gg = 0, b = 0, n = 0, uniq = new Set();
  const step = 4 * 7; // 采样
  for (let i = 0; i < d.length; i += step) {
    r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++;
    if (uniq.size < 40000) uniq.add((d[i] >> 3 << 10) | (d[i + 1] >> 3 << 5) | (d[i + 2] >> 3));
  }
  return { mean: [Math.round(r / n), Math.round(gg / n), Math.round(b / n)], colors: uniq.size };
};
} /* end DEBUG */

/* 启动 */
gotoTitle();
requestAnimationFrame(loop);
window.__G = G;
window.__BT = BT;
window.__SCENES = SCENES;
