/* ============================================================
   main.js — 主循环 / 场景 / UI / 存档 / 音效
   《炎之刃》FLAME BLADE
   ============================================================ */
import { ACTORS, SKILLS, ITEMS, EQUIPS, SHOPS, STATUS, ELEM, statsAt, expToNext, ENEMIES } from './characters.js';
import { SCENES, ENDINGS } from './story.js';
import { portraitURL } from './portraits.js';
import * as SP from './sprites.js';
import * as BT from './battle.js';

const W = 960, H = 540;
const $ = id => document.getElementById(id);
const cv = $('cv');
const ctx = cv.getContext('2d');
const SAVE_KEY = 'flameblade.save.v1';

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

  // 竖屏提示（只在触屏设备上出现）
  const rot = $('rotate');
  if (rot) {
    if (IS_TOUCH && portrait) rot.classList.remove('hidden');
    else rot.classList.add('hidden');
  }
}
window.addEventListener('resize', fit);
window.addEventListener('orientationchange', () => setTimeout(fit, 120));
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
let AC = null, musicTimer = null, musicMode = null;
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

const MUSIC = {
  calm: [261.6, 329.6, 392.0, 523.3, 392.0, 329.6],
  forest: [220, 277.2, 329.6, 415.3, 329.6, 277.2],
  snow: [293.7, 349.2, 440, 587.3, 440, 349.2],
  dark: [155.6, 185, 233.1, 311.1, 233.1, 185],
  boss: [130.8, 155.6, 196, 261.6, 311.1, 261.6],
  battle: [196, 233.1, 293.7, 392, 293.7, 233.1],
  raid: [174.6, 207.7, 261.6, 349.2, 261.6, 207.7],
  hot: [261.6, 311.1, 392, 523.3, 622.3, 523.3],
  ending: [349.2, 440, 523.3, 698.5, 523.3, 440],
};
function setMusic(mode) {
  if (mode === musicMode) return;
  musicMode = mode;
  if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  if (!mode) return;
  const seq = MUSIC[mode] || MUSIC.calm;
  let i = 0;
  const play = () => {
    const f = seq[i % seq.length];
    tone(f, mode === 'boss' || mode === 'hot' ? .5 : .9, 'triangle', mode === 'boss' ? .075 : .05);
    if (i % 3 === 0) tone(f / 2, 1.1, 'sine', .045);
    i++;
  };
  musicTimer = setInterval(play, mode === 'boss' || mode === 'hot' ? 480 : 900);
  play();
}

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
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('on');
  toastT = 2.2;
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
  party: [], bag: { potion: 3 }, gold: 120,
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
};

/* 队伍构造 */
function makeMember(id, level = null) {
  const def = ACTORS[id];
  const lv = level ?? def.joinLevel;
  const equips = ['weapon', 'armor', 'acc'].map(slot => defaultEquip(id, slot)).filter(Boolean);
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
    isEnemy: false,
  };
}
function defaultEquip(id, slot) {
  const map = {
    kaito: { weapon: 'mu_sword', armor: 'cloth', acc: null },
    cang: { weapon: 'wood_staff', armor: 'cloth', acc: null },
    lei: { weapon: 'hunter_spear', armor: 'cloth', acc: null },
    ryze: { weapon: 'snow_staff', armor: 'holy_cloak', acc: null },
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
  const hpR = m.maxHp ? m.hp / m.maxHp : 1, mpR = m.maxMp ? m.mp / m.maxMp : 1;
  m.maxHp = st.hp; m.maxMp = st.mp; m.atk = st.atk; m.def = st.def; m.spd = st.spd;
  m.cri = st.cri; m.mpRegen = st.mpRegen;
  m.blk = st.blk; m.par = st.par; m.rageMul = st.rageMul;
  const b = m.bonus;
  if (b) { m.atk += b.atk || 0; m.def += b.def || 0; m.maxHp += b.hp || 0; }
  m.hp = Math.min(m.maxHp, Math.max(1, Math.round(m.maxHp * hpR)));
  m.mp = Math.min(m.maxMp, Math.round(m.maxMp * mpR));
}
function addMember(id, level) {
  if (G.party.find(p => p.id === id)) return G.party.find(p => p.id === id);
  const explicit = level != null;
  const m = makeMember(id, level ?? Math.max(ACTORS[id].joinLevel, 1));
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
    if (m.level >= 30) continue;
    m.exp += amount;
    let leveled = false;
    while (m.exp >= expToNext(m.level) && m.level < 30) {
      m.exp -= expToNext(m.level);
      m.level++;
      leveled = true;
      const before = [...m.skills];
      const def = ACTORS[m.id];
      m.skills = def.skills.filter(s => s.lv <= m.level).map(s => s.id);
      const gained = m.skills.filter(s => !before.includes(s)).map(s => SKILLS[s]?.name).filter(Boolean);
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
  if (sc.loading) { showLoading(sc.loadingTitle || sc.chapter, sc.loadingText || ''); G.loadTarget = id; return; }
  $('dialogue').classList.remove('hidden');
  $('choices').classList.add('hidden');
  refreshHUD();
  nextLine();
}

function runAction(a) {
  if (!a || typeof a !== 'object') return;
  if (a.set) Object.assign(G.flags, a.set);
  if (a.objective) G.flags.currentObjective = a.objective;
  if (a.evaluateAid) G.flags.allAid = !!(G.flags.forestAid && G.flags.harborAid && G.flags.northAid);
  if (typeof a.join === 'string' && ACTORS[a.join]) { addMember(a.join); toast(`※ ${ACTORS[a.join].name} 加入了队伍！`); }
  if (typeof a.item === 'string') { G.bag[a.item] = (G.bag[a.item] || 0) + 1; toast(`获得【${EQUIPS[a.item]?.name || ITEMS[a.item]?.name || a.item}】`); }
  if (typeof a.equip === 'string') { const owner = G.party.find(m => ACTORS[m.id]) || G.party[0]; if (owner) { const slotIdx = ['weapon', 'armor', 'acc'].indexOf(EQUIPS[a.equip]?.slot); if (slotIdx >= 0) owner.equips[slotIdx] = a.equip; } }
  if (a.gold) { G.gold += a.gold; }
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
  if (sc.shop) { openShop(sc.shop); return; }
  if (sc.enemies) { startBattleFromScene(sc); return; }
  if (sc.ending) { showEnding(sc.ending); return; }
  if (sc.next) { gotoScene(sc.next); return; }
  // 没有下一步：回到标题
  gotoTitle();
}

function nextLine() {
  const sc = G.scene;
  if (!sc || !sc.lines) { finishLines(); return; }
  if (G.lineIdx >= sc.lines.length) { finishLines(); return; }
  const [name, text] = sc.lines[G.lineIdx];
  G.lineIdx++;
  showLine(name, text);
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
  for (const a of Object.values(ACTORS)) { put(a.name, a.portrait); put(a.name + '·' + a.id, a.portrait); }
  put('冰之魔女·丝薇雅', 'baixue'); put('丝薇雅', 'baixue');
  put('暗影四天王·泽恩', 'zain'); put('泽恩', 'zain');
  put('冰之四天王·白雪', 'baixue'); put('白雪', 'baixue');
  put('健次郎', null); put('凯', 'kaito');
  put('魔王·阿斯特', 'zain'); put('终焉魔王·阿斯特·真', 'zain');
  put('阿斯特', 'zain'); put('古兰', 'zain');
  put('魔将·古兰', 'zain');
  return m;
})();

function showLine(name, text) {
  const nm = $('dlg-name-text');
  const tx = $('dlg-text');
  const img = $('dlg-img');
  const wrap = $('dialogue');
  wrap.classList.remove('hidden');
  // 名字与立绘
  const speaker = Object.values(ACTORS).find(a => a.name === name);
  if (name === '旁白') {
    nm.textContent = '';
    img.src = portraitURL(G.party[0]?.portrait || 'kaito');
    img.style.filter = 'grayscale(.7) brightness(.7)';
  } else if (name === '系统') {
    nm.textContent = 'SYSTEM';
    img.src = portraitURL(G.party[0]?.portrait || 'kaito');
    img.style.filter = 'hue-rotate(160deg) brightness(.8)';
  } else {
    nm.textContent = name;
    const mapped = PID_MAP[name];
    const pid = (mapped !== undefined && mapped !== null) ? mapped
      : (name.includes('璃') ? 'ryze' : name.includes('凯') ? 'kaito' : null);
    img.src = portraitURL(pid || G.party[0]?.portrait || 'kaito');
    img.style.filter = pid ? 'none' : 'brightness(.72) saturate(.8)';
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
  const stage = { bg: sc.bg || G.bg, introLines: sc.introLines };
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
  buildCommandUI();
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
    // 战后回复少量
    for (const m of G.party) if (!m.dead) m.mp = Math.min(m.maxMp, m.mp + Math.floor(m.maxMp * 0.15));
    // 复活倒下的同伴（残血）
    for (const m of G.party) if (m.dead) { m.dead = false; m.hp = Math.max(1, Math.floor(m.maxHp * 0.15)); m.pose = 'idle'; }
    for (const m of G.party) if (m.resource === 'rage') m.mp = 0;   // 怒气不跨战斗保留
    battleEndToStory();
  }, 900);
};
G.onBattleLose = function (b) {
  sfx('lose');
  setTimeout(() => {
    G.battle = null;
    $('cmdmenu').classList.add('hidden');
    $('cmd-buttons').innerHTML = '';
    gotoScene('c5_defeat');
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
  const resName = m.resource === 'rage' ? '怒气' : '术力';
  $('cmd-actor').innerHTML = `<div class="an">${m.name}</div>
    <div style="color:#bbb2dd">Lv.${m.level} · ${m.title}</div>
    <div style="color:#ffb98a;margin-top:3px">HP ${Math.ceil(m.hp)}/${m.maxHp}</div>
    <div style="color:${m.resource === 'rage' ? '#ff9a3c' : '#6fd8ff'}">${resName} ${Math.ceil(m.mp)}/${m.maxMp}</div>`;
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
  mk('格挡', '大幅提升格挡/弹反率', () => doCmd(m, { type: 'guard' }));
  if (b.objective) {
    const label = b.objective.type === 'purify' ? '净化' : '封门';
    if (b.objective.type !== 'rescue') mk(label, BT.objectiveText(b), () => doCmd(m, { type: 'objective' }), !BT.canObjective(b, m));
  }
  // 剧本用 escape 标记哪些战斗可以逃。此前只有这个标记，指令栏里从来没有出口。
  if (b.def && b.def.escape) mk('逃跑', '脱离战斗', () => doCmd(m, { type: 'escape' }));
  $('cmdmenu').classList.remove('hidden');
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
  const resName = m.resource === 'rage' ? '怒气' : '术力';
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
  el.innerHTML = `<div class="sk-head"><span>${m.name} 的道具　持有 ${G.gold} 金</span><span>选择后即可使用</span></div>
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
function openShop(id) {
  const shop = SHOPS[id];
  G.mode = 'shop';
  $('dialogue').classList.add('hidden');
  $('choices').classList.add('hidden');
  const panel = $('panel');
  $('panel-title').textContent = `◆ ${shop.name}　持有 ${G.gold} 金`;
  const body = $('panel-body');
  body.innerHTML = `<div style="grid-column:1/-1">
    ${shop.items.map(k => {
    const it = ITEMS[k] || EQUIPS[k];
    const price = it.price || 0;
    const owned = G.bag[k] || 0;
    const eq = EQUIPS[k];
    const tag = eq ? `<span class="tag eq">${eq.slot === 'weapon' ? '武器' : eq.slot === 'armor' ? '护甲' : '饰品'}</span>` : `<span class="tag">持有 ${owned}</span>`;
    return `<div class="shop-row">
        <div><b style="color:#ffd76a">${it.name}</b> ${tag}
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
    if (G.gold < it.price) { toast('金币不足'); return; }
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
  $('shop-leave').onclick = e => { e.stopPropagation(); closePanel(); goAfterShop(); };
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
function goAfterShop() {
  G.mode = 'scene';
  const sc = G.scene;
  $('panel').classList.add('hidden');
  if (sc && sc.next) gotoScene(sc.next);
  else gotoTitle();
}
function openEquipScreen(memberId, back) {
  const m = G.party.find(p => p.id === memberId);
  const body = $('panel-body');
  $('panel-title').textContent = `◈ ${m.name} 的装备调整`;
  const owned = Object.keys(G.bag).filter(k => G.bag[k] > 0 && EQUIPS[k]);
  body.innerHTML = `<div style="grid-column:1/-1">
    ${['weapon', 'armor', 'acc'].map(slot => {
    const cur = m.equips[['weapon', 'armor', 'acc'].indexOf(slot)];
    return `<div style="margin-bottom:10px">
        <div style="color:#ffd76a;font-size:13px;margin-bottom:5px">${slot === 'weapon' ? '武器' : slot === 'armor' ? '护甲' : '饰品'} — 当前：${cur ? EQUIPS[cur].name : '无'}</div>
        ${owned.filter(k => EQUIPS[k].slot === slot).map(k => `<div class="shop-row">
            <div><b>${EQUIPS[k].name}</b><div style="font-size:11px;color:#8fe6ff">${statLine(EQUIPS[k])}</div></div>
            <button class="mini" data-wear="${k}">装备</button></div>`).join('') || '<div style="font-size:12px;color:#a99">—— 没有可换的装备 ——</div>'}
      </div>`;
  }).join('')}
    <button class="mini g" id="eq-back" style="padding:8px 22px">返回</button>
  </div>`;
  body.querySelectorAll('[data-wear]').forEach(b => b.onclick = e => {
    e.stopPropagation();
    const k = b.dataset.wear;
    const e2 = EQUIPS[k];
    const slotIdx = ['weapon', 'armor', 'acc'].indexOf(e2.slot);
    const old = m.equips[slotIdx];
    if (old) G.bag[old] = (G.bag[old] || 0) + 1;
    G.bag[k]--;
    if (G.bag[k] <= 0) delete G.bag[k];
    m.equips[slotIdx] = k;
    recalc(m);
    sfx('heal');
    toast(`${m.name} 装备了【${e2.name}】`);
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
  if (G.mode === 'panel') G.mode = (G.prevMode && G.prevMode !== 'panel') ? G.prevMode : 'scene';
  G.prevMode = null;
  G.panelKind = null;
}
/* 再点一次同一个 HUD 按钮 = 关闭（手机上这是最自然的退出方式） */
function togglePanel(kind, open) {
  if (G.mode === 'panel' && G.panelKind === kind) closePanel();
  else open();
}
function openPartyPanel() {
  enterPanel('party');
  $('panel-title').textContent = '◈ 队伍状态　持有 ' + G.gold + ' 金';
  const body = $('panel-body');
  body.innerHTML = G.party.map(m => {
    const def = ACTORS[m.id];
    return `<div class="pcard">
      <img src="${portraitURL(m.portrait)}" alt="">
      <div class="pi">
        <div class="pn">${m.name} <span style="font-size:11.5px;color:#bbb2dd">Lv.${m.level} · ${m.title}</span></div>
        <div class="bar hp"><i style="width:${(m.hp / m.maxHp * 100).toFixed(1)}%"></i></div>
        <div class="pv">HP ${Math.ceil(m.hp)} / ${m.maxHp}</div>
        <div class="bar mp"><i style="width:${(m.mp / m.maxMp * 100).toFixed(1)}%"></i></div>
        <div class="pv">MP ${Math.ceil(m.mp)} / ${m.maxMp}　攻击 ${m.atk}　防御 ${m.def}　速度 ${m.spd}</div>
        <div class="bar ht"><i style="width:${Math.round((m.mp / Math.max(1, m.maxMp)) * 100)}%"></i></div>
        <div class="pv">${m.resource === 'rage' ? '怒气' : '术力'} ${Math.ceil(m.mp)}/${m.maxMp}　格挡${Math.round((m.blk || 0) * 100)}% 弹反${Math.round((m.par || 0) * 100)}%　EXP ${m.exp}/${expToNext(m.level)}</div>
        <div>${m.skills.map(s => `<span class="tag">${SKILLS[s]?.name || s}</span>`).join('')}</div>
        <div>${m.equips.filter(Boolean).map(e => `<span class="tag eq">${EQUIPS[e]?.name}</span>`).join('') || '<span class="tag">未装备</span>'}</div>
      </div>
    </div>`;
  }).join('') + `<div style="grid-column:1/-1;font-size:12px;color:#bbb2dd;margin-top:6px">
      <p>当前目标：${G.flags.currentObjective || '陪小铃完成村里的事情。'}</p>
      <p>旅程支援：${[['forestAid', '森林根系'], ['harborAid', '港町船队'], ['northAid', '北境灯塔']].map(([key, label]) => `${G.flags[key] ? '✓' : '○'} ${label}`).join('　')}</p>
      <p>封门准备：${G.flags.sealKnowledge ? '✓ 已掌握完整封门法' : '○ 尚未读完完整术式'}；三地支援齐全可解除共同封门的代价。</p>
      <p>同伴往事：${[['leiBond', '雷'], ['ryzeBond', '璃'], ['cangBond', '苍']].map(([key, label]) => `${G.flags[key] ? '✓' : '○'} ${label}`).join('　')}</p>
      道具：${Object.keys(G.bag).filter(k => G.bag[k] > 0).map(k => `${ITEMS[k]?.name || EQUIPS[k]?.name || k}×${G.bag[k]}`).join('、') || '无'}
    </div>`;
  $('panel').classList.remove('hidden');
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
  $('btn-continue').disabled = !localStorage.getItem(SAVE_KEY);
  $('btn-continue').style.opacity = localStorage.getItem(SAVE_KEY) ? 1 : .4;
}
function showLoading(title, text) {
  $('loading').classList.remove('hidden');
  $('load-chapter').textContent = title || G.chapter;
  $('load-text').textContent = text || '命运正在转动……';
  setMusic('calm');
}
function showEnding(kind) {
  const e = ENDINGS[kind];
  G.mode = 'ending';
  setMusic('ending');
  $('ending').classList.remove('hidden');
  $('ending-label').textContent = e.label;
  $('ending-title').textContent = e.title;
  $('ending-text').textContent = e.text;
  $('ending-bg').style.background = `radial-gradient(ellipse at 50% 40%, #2a1a3c, #06040c)`;
  $('dialogue').classList.add('hidden');
  $('cmdmenu').classList.add('hidden');
  $('hud').classList.add('hidden');
}
function newGame() {
  G.party = [];
  G.bag = { potion: 3, ether: 1 };
  G.gold = 120;
  G.flags = {};
  G.battleCheckpoint = null;
  G.chapter = '';
  addMember('kaito', 1);
  for (const m of G.party) { m.hp = m.maxHp; m.mp = m.resource === 'rage' ? 0 : m.maxMp; }
  G.mode = 'scene';
  $('title').classList.add('hidden');
  $('hud').classList.remove('hidden');
  $('loading').classList.add('hidden');
  gotoScene('prologue');
}
function saveGame() {
  const data = {
    v: 2, t: Date.now(), sceneId: SCENES[G.sceneId]?.once ? G.sceneId : (G.scene?.next || G.sceneId), chapter: G.chapter,
    battleCheckpoint: G.battleCheckpoint,
    flags: G.flags, gold: G.gold, bag: G.bag,
    party: G.party.map(m => ({
      id: m.id, level: m.level, exp: m.exp, hp: m.hp, mp: m.mp,
      equips: m.equips, skills: m.skills, bonus: m.bonus,
    })),
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); toast('◇ 已保存进度'); }
  catch (e) { toast('保存失败：' + e.message); }
}
function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) { toast('没有可用的存档'); return; }
  try {
    const d = JSON.parse(raw);
    G.party = d.party.map(p => {
      const m = makeMember(p.id, p.level);
      m.exp = p.exp || 0; m.equips = p.equips || m.equips; m.skills = p.skills || m.skills;
      m.bonus = p.bonus || m.bonus;
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
        · 【净化】和【封门】只在目标满足、指定角色行动时可用；蓄力预警表示敌人的下次行动<br>
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
$('btn-save').onclick = e => { e.stopPropagation(); saveGame(); };
$('btn-title').onclick = e => { e.stopPropagation(); if (confirm('返回标题画面？未保存的进度会丢失。')) gotoTitle(); };
$('btn-new').onclick = e => { e.stopPropagation(); sfx('levelup'); newGame(); };
$('btn-continue').onclick = e => { e.stopPropagation(); sfx('ui'); loadGame(); };
$('btn-gallery').onclick = e => { e.stopPropagation(); sfx('ui'); openGallery(); };
$('btn-help').onclick = e => { e.stopPropagation(); sfx('ui'); openGallery(); };
$('btn-again').onclick = e => { e.stopPropagation(); gotoTitle(); };
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

function nextLineCheck() {
  const sc = G.scene;
  if (!sc) return;
  if (sc.lines && G.lineIdx < sc.lines.length) nextLine();
  else if (sc.choices) showChoices(sc.choices);
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
    if (G.mode === 'shop') { closePanel(); goAfterShop(); continue; }
    if (G.mode !== 'scene' || !G.scene) break;
    G.typed = G.fullText.length; G.typing = 0;
    nextLineCheck();
    if (window.__fast && G.mode === 'shop') { closePanel(); goAfterShop(); }
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
window.__newGame = function (level = 1, members = ['kaito']) {
  newGame();
  G.party = [];
  for (const id of members) addMember(id, level);
  for (const m of G.party) { m.hp = m.maxHp; m.mp = m.resource === 'rage' ? 0 : m.maxMp; }
  return G.party.map(m => m.name + 'Lv' + m.level + '[' + m.skills.join(',') + ']').join(' ');
};
window.__setScene = function (id) { gotoScene(id); return id; };
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
          const target = b.enemies.findIndex(e => !e.dead && (b.objective?.type !== 'purify' || e.ref === 'curse_root'));
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
    } else if (G.mode === 'shop') { closePanel(); goAfterShop(); }
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
