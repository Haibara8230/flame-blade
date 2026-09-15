/* ============================================================
   battle.js — 回合制战斗系统
   特色：热血槽 / 奥义演出 / 格挡弹反 / 连击多段 / 属性弱点
   ============================================================ */
import { ACTORS, SKILLS, COMBOS, ENEMIES, ENEMY_SKILLS, EQUIPS, ITEMS, STATUS, statsAt, enemyStatsAt } from './characters.js';
import { eqBonus as equipBonus, eqElemBonus as equipElem } from './loot.js';
import { talentBonus, talentElem, derived } from './growth.js';

/* 装备词缀与天赋用同一套键名，战斗里永远查这两个合并后的函数。 */
function eqBonus(unit, key) { return equipBonus(unit, key) + talentBonus(unit, key); }
function eqElemBonus(unit, elem) { return equipElem(unit, elem) + talentElem(unit, elem); }
import * as SP from './sprites.js';

const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const chance = p => Math.random() < p;

const H_BAR_Y = 30;

/* 战斗节奏倍率：越小越快（影响所有动作时长） */
/* 演出基准速度。setBattleSpeed() 让玩家在 ×1 / ×2 / ×3 之间切换。 */
const BASE_SPEED = 0.68;
export const SPEED_STEPS = [1, 2, 3];
let speedIdx = 0;
export let BATTLE_SPEED = BASE_SPEED;
export function battleSpeedLabel() { return '×' + SPEED_STEPS[speedIdx]; }
export function cycleBattleSpeed() {
  speedIdx = (speedIdx + 1) % SPEED_STEPS.length;
  BATTLE_SPEED = BASE_SPEED / SPEED_STEPS[speedIdx];
  return battleSpeedLabel();
}
export function setBattleSpeedIndex(i) {
  speedIdx = clamp(i | 0, 0, SPEED_STEPS.length - 1);
  BATTLE_SPEED = BASE_SPEED / SPEED_STEPS[speedIdx];
  return battleSpeedLabel();
}
export function battleSpeedIndex() { return speedIdx; }

/* 行动条：单位的 gauge 按 spd 速率涨到 GOAL 就出手，出手后减去 GOAL 并保留溢出，
   所以速度高的单位能在慢速单位出手一次的间隔里行动两次。 */
const GOAL = 100;

/* 愤怒资源的获取量（只有 resource==='rage' 的角色会收到） */
/* 凯的人设是「为守护而出鞘」，但此前 par 0.08 几乎不触发，怒气一场都攒不到奥义。
   现在格挡与弹反是怒气的主要来源，主角的循环变成「接下这一刀，再还回去」。 */
const RAGE = { hit: 1.25, taken: 28, block: 14, parry: 35, kill: 8, guardCmd: 10 };

/* 站位（960x540 画布） */
const ENEMY_POS = [
  [{ x: 600, y: 372 }, { x: 742, y: 388 }, { x: 866, y: 368 }],
  [{ x: 660, y: 392 }],
];
const PARTY_POS = [
  { x: 150, y: 452 }, { x: 252, y: 468 }, { x: 352, y: 452 }, { x: 440, y: 472 },
];

/* 敌人图标缩放 */
function enemyScale(def) {
  const s = def.shape === 'king' ? 0.62 : def.shape === 'demon' ? 0.58 : def.shape === 'wolf' ? 0.78 : 0.72;
  return s * (def.scale || 1);
}

/* ============================================================
   构造战斗
   ============================================================ */
export function createBattle(game, def, stage) {
  const B = {
    game, def, stage, bg: stage.bg || 'forest',
    over: false, result: null,
    enemyActs: [], log: [],
    fx: [], floats: [],
    shake: 0, flash: 0, zoom: 1, hitstop: 0,
    guard: null, cutin: null,
    cmd: null, ui: { mode: 'idle', queue: [] },
    time: 0, message: null, introT: stage.introLines ? 1 : 0,
    t: 0, turn: 0, escapes: 0, active: null,
  };

  // 敌人实例
  const n = def.enemies.length;
  const row = n <= 1 ? 1 : 0;
  B.enemies = def.enemies.map((e, i) => {
    const d = ENEMIES[e.ref];
    const lv = e.level;
    /* baseLevel：这份数值是「按几级写的」。
       第一部的敌人从 1 级线性放大没问题，但第二部一路到 Lv48，
       再线性放大会让攻防涨到失控（防御一度算到 900+，伤害归零）。
       所以第二部的敌人直接写成终盘数值，baseLevel 指出它的基准。
       缩放公式在 characters.js 里只有一份，工具与运行时共用。 */
    const st = enemyStatsAt(d, lv);
    const k = st.scaleK;
    const pos = ENEMY_POS[row][i] || ENEMY_POS[row][ENEMY_POS[row].length - 1];
    const scale = enemyScale(d) * (1 + k * 0.028);
    const maxHp = st.maxHp;
    return {
      i, ref: d.id, def: d, name: d.name, shape: d.shape, palette: d.palette,
      level: lv, maxHp, hp: maxHp,
      atk: st.atk, defv: st.defv,
      spd: st.spd, exp: st.exp, gold: st.gold,
      boss: !!d.boss, skills: d.skills, quote: d.quote, weak: d.weak || null,
      scale, x: pos.x, y: pos.y, baseX: pos.x, baseY: pos.y,
      pose: 'idle', hurtP: null, atkP: null, dead: false, dying: 0,
      status: [], buffs: { atk: 1, def: 1, spd: 1 },
      gauge: rnd(0, 15), isEnemy: true,
      /* 击破槽：打中弱点累积，满了进入 BREAK（眩晕 + 行动条清零 + 易伤）。
         首领需要更多次，杂兵两三下就能打断。 */
      breakMax: d.boss ? (lv >= 18 ? 8 : 6) : 3,
      breakGauge: 0, broken: 0,
      phases: (d.phases || []).map(ph => ({ ...ph, done: false })),
      phase: 1, said: false, offY: 0,
    };
  });

  // 我方实例（引用 game.party）
  B.party = game.party.map((m, i) => {
    const p = PARTY_POS[i] || PARTY_POS[3];
    return {
      ...m, i, x: p.x, y: p.y, baseX: p.x, baseY: p.y,
      pose: 'idle', hurtP: null, atkP: null, dying: 0,
      status: [], buffs: { atk: 1, def: 1, spd: 1 },
      gauge: rnd(0, 15),
      resource: (ACTORS[m.id] && ACTORS[m.id].resource) || 'mp',
      guardStance: false, cmd: null, acted: false,
      lastStandUsed: false,
    };
  });
  // 「先手」词缀：开战时行动条起步更高
  for (const m of B.party) {
    const fs = eqBonus(m, 'firstStrike');
    if (fs) m.gauge = clamp(m.gauge + fs, 0, GOAL - 1);
  }
  B.byId = {};
  for (const m of B.party) {
    B.byId[m.id] = m;
    if (m.resource === 'rage') m.mp = 0;   // 愤怒从零攒起
  }

  B.combosUsed = {};
  B.bondLevel = id => (game.bondLevel ? game.bondLevel(id) : 0);
  B.comboBonus = () => {
    // 璃的「同行」天赋：连携技伤害提升
    let best = 0;
    for (const m of B.party) best = Math.max(best, (game.talentBonus ? game.talentBonus(m, 'bondPlus') : 0) * 0.10);
    return best;
  };
  B.objective = def.objective ? { ...def.objective, progress: 0, completed: [] } : null;
  B.supportUsed = {};
  for (const mod of def.modifiers || []) if (game.flags?.[mod.flag]) {
    for (const e of B.enemies) {
      if (mod.enemyHp) e.hp = e.maxHp = Math.floor(e.maxHp * mod.enemyHp);
      if (mod.enemySpeed) e.spd = Math.max(1, Math.floor(e.spd * mod.enemySpeed));
    }
  }
  if (def.support && game.flags?.forestAid) {
    applyBuff(B, { id: 'defUp', turns: 5 }, B.party);
    addLog(B, '森林根系托住城基：全队获得防御提升。');
  }

  addLog(B, `⚔ ${def.enemies.map(e => ENEMIES[e.ref].name).join('、')} 出现了！`);
  for (const e of B.enemies) if (e.quote && chance(0.7)) B.floats.push({ kind: 'quote', txt: e.quote, x: e.x, y: e.y - 110 * e.scale, life: 0, dur: 2.2, col: '#ff9a9a' });
  beginNextTurn(B);
  return B;
}

/* ============================================================
   行动条调度（速度决定出手顺序，快的单位可以连续出手）
   ============================================================ */
export function effSpd(u) { return Math.max(1, Math.floor((u.spd || 1) * (u.buffs?.spd || 1))); }

function livingUnits(B) { return [...B.party, ...B.enemies].filter(u => !u.dead); }

/* 推进行动条，返回下一个出手的单位 */
function scheduleNext(B) {
  const units = livingUnits(B);
  if (!units.length) return null;
  let best = null, bestT = Infinity;
  for (const u of units) {
    const t = (GOAL - u.gauge) / effSpd(u);
    if (t < bestT) { bestT = t; best = u; }
  }
  for (const u of units) u.gauge += effSpd(u) * bestT;
  best.gauge -= GOAL;
  return best;
}

/* 未来出手顺序预览（不改动真实 gauge） */
export function forecastOrder(B, n = 8) {
  const sim = livingUnits(B).map(u => ({ u, g: u.gauge, spd: effSpd(u) }));
  const out = [];
  for (let i = 0; i < n && sim.length; i++) {
    let bi = 0, bt = Infinity;
    sim.forEach((x, j) => { const t = (GOAL - x.g) / x.spd; if (t < bt) { bt = t; bi = j; } });
    sim.forEach(x => { x.g += x.spd * bt; });
    sim[bi].g -= GOAL;
    out.push(sim[bi].u);
  }
  return out;
}

/* ============================================================
   日志 / 特效辅助
   ============================================================ */
function addLog(B, txt, cls = '') {
  B.log.push({ txt, cls });
  if (B.log.length > 4) B.log.shift();
}

function addFloat(B, txt, x, y, col, size = 34, crit = false) {
  B.floats.push({ kind: 'text', txt, x, y, col, size, crit, life: 0, dur: 0.95 });
}
function addFx(B, kind, x, y, col, extra = {}) {
  B.fx.push({ kind, x, y, col, life: 0, dur: extra.dur || 0.6, ...extra });
}
function shake(B, v) { B.shake = Math.max(B.shake, v); }
function flash(B, v) { B.flash = Math.max(B.flash, v); }

function damage(B, target, amount, opt = {}) {
  if (target.broken > 0) amount *= 1.5;      // BREAK 期间易伤
  amount = Math.max(1, Math.floor(amount));
  if (opt.drain && opt.from) {
    const heal = Math.floor(amount * opt.drain);
    opt.from.hp = Math.min(opt.from.maxHp, opt.from.hp + heal);
    addFloat(B, `+${heal}`, opt.from.x, opt.from.y - 120, '#7dffa8', 26);
  }
  // 「不倒」词缀：每场一次，致命伤害后残留 1 点生命
  if (!target.isEnemy && amount >= target.hp && !target.lastStandUsed && eqBonus(target, 'lastStand') > 0) {
    target.lastStandUsed = true;
    amount = Math.max(0, target.hp - 1);
    addFloat(B, '不倒！', target.x, target.y - 150, '#ffd76a', 30, true);
    addLog(B, `<span class="hl">※ ${target.name} 凭「不倒」撑住了这一击！</span>`);
  }
  target.hp = Math.max(0, target.hp - amount);
  /* 净化战不能靠击杀本体取胜，伤害只会压制它。
     此前这里把本体写死成 forest_guard，于是第二部的玄鹿战可以被直接打死，
     净化流程形同虚设。改成「不在 objective.targets 里的那个就是本体」。 */
  if (B.objective?.type === 'purify' && !(B.objective.targets || []).includes(target.ref)) {
    target.hp = Math.max(1, target.hp);
  }
  const col = opt.col || (opt.crit ? '#ffe14d' : '#ff5566');
  addFloat(B, (opt.crit ? '会心 ' : '') + amount, target.x + rnd(-18, 18), target.y - 110, col, opt.crit ? 42 : 32, opt.crit);
  target.hurtP = 0;
  addFx(B, 'burst', target.x, target.y - 80, opt.col || '#ff8a1a', { dur: 0.42, r: 42 });
  shake(B, opt.crit ? 14 : 8);
  B.hitstop = opt.crit ? 0.09 : 0.05;
  if (target.hp <= 0) {
    target.dead = true; target.pose = 'dead'; target.dying = 0;
    addLog(B, `<span class="dmg">${target.name} 被击倒了！</span>`);
    if (opt.by) {
      gainRage(B, opt.by, RAGE.kill);
      const gk = talentBonus(opt.by, 'gaugeOnKill');   // 雷「猎手」：击倒推条
      if (gk) shiftGauge(B, opt.by, gk);
      const kh = eqBonus(opt.by, 'killHeal');          // 「收割」
      if (kh > 0 && !opt.by.dead) {
        const h = Math.floor(opt.by.maxHp * kh);
        opt.by.hp = Math.min(opt.by.maxHp, opt.by.hp + h);
        addFloat(B, `+${h}`, opt.by.x, opt.by.y - 120, '#7dffa8', 26);
      }
    }
  } else if (target.isEnemy) {
    checkPhases(B, target);
  }
  // 「吸血」：我方造成伤害回血
  if (opt.by && !opt.by.isEnemy && !opt.by.dead) {
    const ls = eqBonus(opt.by, 'lifesteal');
    if (ls > 0) {
      const h = Math.max(1, Math.floor(amount * ls));
      opt.by.hp = Math.min(opt.by.maxHp, opt.by.hp + h);
      addFloat(B, `+${h}`, opt.by.x, opt.by.y - 126, '#7dffa8', 22);
    }
  }
  // 「荆棘」：我方受伤时反弹给攻击者
  if (!target.isEnemy && opt.attacker && opt.attacker.isEnemy && !opt.attacker.dead) {
    const th = eqBonus(target, 'thorns');
    if (th > 0) {
      const back = Math.max(1, Math.floor(amount * th));
      opt.attacker.hp = Math.max(0, opt.attacker.hp - back);
      addFloat(B, `${back}`, opt.attacker.x, opt.attacker.y - 118, '#ffb0b0', 22);
      if (opt.attacker.hp <= 0) { opt.attacker.dead = true; opt.attacker.pose = 'dead'; opt.attacker.dying = 0; }
    }
  }
  const out = amount;
  return out;
}

/* 弱点击破：打中弱点累积击破槽，满了敌人被 BREAK。
   此前弱点只是一次性 ×1.5 飘个字，玩家没有理由记住谁怕什么。 */
function gainBreak(B, target, n = 1) {
  if (!target || target.dead || !target.isEnemy || target.broken > 0) return;
  target.breakGauge = Math.min(target.breakMax, target.breakGauge + n);
  if (target.breakGauge < target.breakMax) {
    addFloat(B, `击破 ${target.breakGauge}/${target.breakMax}`, target.x, target.y - 168, '#8fe6ff', 20);
    return;
  }
  target.breakGauge = 0;
  target.broken = 2;                       // 持续两回合易伤
  target.gauge = 0;                        // 行动条清零，出手被推到最后
  applyStatus(B, target, 'stun', 1);
  addLog(B, `<span class="hl">※ BREAK！${target.name} 的架势被打散了！</span>`);
  addFloat(B, 'BREAK!', target.x, target.y - 150, '#ffe14d', 44, true);
  addFx(B, 'burst', target.x, target.y - 80, '#ffe14d', { dur: 0.7, r: 110, n: 18 });
  flash(B, 0.55); shake(B, 18);
  B.hitstop = 0.16;
}

/* 首领阶段转换：血量跌破阈值时换台词、换数值、换技能表。
   此前首领从第一回合到第三十七回合行为完全不变。 */
function checkPhases(B, e) {
  if (!e || e.dead || !e.phases || !e.phases.length) return;
  const ratio = e.hp / e.maxHp;
  for (const ph of e.phases) {
    if (ph.done || ratio > ph.at) continue;
    ph.done = true;
    e.phase++;
    if (ph.gain) {
      if (ph.gain.atk) e.atk = Math.floor(e.atk * ph.gain.atk);
      if (ph.gain.def) e.defv = Math.floor(e.defv * ph.gain.def);
      if (ph.gain.spd) e.spd = Math.max(1, Math.floor(e.spd * ph.gain.spd));
    }
    if (ph.clearBuffs) { e.status = []; e.buffs = { atk: 1, def: 1, spd: 1 }; }
    if (ph.addSkills) e.skills = [...e.skills, ...ph.addSkills.map(id => ({ id, w: 4 }))];
    if (ph.heal) e.hp = Math.min(e.maxHp, e.hp + Math.floor(e.maxHp * ph.heal));
    for (const line of ph.lines || []) {
      B.floats.push({ kind: 'quote', txt: line, x: e.x, y: e.y - 130 * e.scale, life: 0, dur: 2.6, col: '#ffd76a' });
      addLog(B, `<span class="hl">${e.name}：${line}</span>`);
    }
    addLog(B, `<span class="hl">※ ${e.name} 进入第 ${e.phase} 形态！</span>`);
    addFloat(B, `第 ${e.phase} 形态`, e.x, e.y - 180, '#ff8048', 30, true);
    addFx(B, 'burst', e.x, e.y - 80, ph.col || '#ff6a1a', { dur: 0.9, r: 140, n: 22 });
    flash(B, 0.8); shake(B, 22);
    B.hitstop = 0.2;
    if (ph.music) B.game.onBattleMusic && B.game.onBattleMusic(ph.music);
    if (ph.bg) B.bg = ph.bg;
  }
}

/* 愤怒资源：只有 resource==='rage' 的角色会积攒，术力角色无视 */
export function gainRage(B, unit, v) {
  if (!unit || unit.dead || unit.isEnemy) return;
  if (unit.resource !== 'rage' || v <= 0) return;
  const before = unit.mp;
  unit.mp = clamp(unit.mp + v * (unit.rageMul || 1) * (1 + eqBonus(unit, 'ragePlus')), 0, unit.maxMp);
  const gained = Math.round(unit.mp - before);
  if (gained > 0) addFloat(B, `怒+${gained}`, unit.x + rnd(-10, 10), unit.y - 132, '#ff9a3c', 20);
  if (canUlt(unit) && !unit.ultNotified) {
    unit.ultNotified = true;
    addLog(B, `<span class="hl">※ ${unit.name} 的怒气足够发动【奥义】了！</span>`);
    addFloat(B, '奥义就绪！', unit.x, unit.y - 152, '#ffd76a', 26);
  } else if (!canUlt(unit)) unit.ultNotified = false;
}

/* 该角色当前资源是否够放奥义 */
export function canUlt(m) {
  if (!m || m.dead) return false;
  const ults = (m.skills || []).map(id => SKILLS[id]).filter(sk => sk && (sk.ult || sk.release));
  if (!ults.length) return false;
  const cheapest = Math.min(...ults.map(sk => sk.mp || 0));
  return m.mp >= cheapest;
}

/* 当前怒气能打开到第几段解放（给 HUD 显示用） */
export function releaseStage(m) {
  if (!m) return 0;
  const rel = (m.skills || []).map(id => SKILLS[id]).filter(sk => sk && sk.release);
  let best = 0;
  for (const sk of rel) if (m.mp >= (sk.mp || 0)) best = Math.max(best, sk.release);
  return best;
}

/* 资源占比（0~1），给 HUD 和隐藏结局判定用 */
/* 被「封印」时不能使用技能与奥义（只剩普攻 / 格挡 / 道具）。
   此前 STATUS.seal 定义了、图标也有，但既没有技能会施加它，被施加了也没有任何效果。 */
/* 推条 / 拉条：直接加减目标的行动条。
   正数 = 提前出手（推条），负数 = 推迟出手（拉条）。
   上限留 1 点余量，否则 scheduleNext 算出的等待时间会变成 0 或负数。 */
export function shiftGauge(B, u, delta) {
  if (!u || u.dead || !delta) return;
  const before = u.gauge;
  u.gauge = clamp(u.gauge + delta, 0, GOAL - 1);
  const moved = Math.round(u.gauge - before);
  if (!moved) return;
  addFloat(B, moved > 0 ? `行动 +${moved}` : `行动 ${moved}`, u.x, u.y - 150,
    moved > 0 ? '#8fe6ff' : '#c86bff', 22);
}

export function isSealed(u) {
  return !!(u && u.status && u.status.some(s => s.id === 'seal'));
}

export function resourceRatio(m) {
  return m && m.maxMp ? clamp(m.mp / m.maxMp, 0, 1) : 0;
}

/* ============================================================
   数值计算
   ============================================================ */
export function effAtk(u) { return Math.floor((u?.atk || 0) * (u?.buffs?.atk || 1)); }
export function effDef(u) {
  if (!u) return 0;
  return Math.floor(u.defv !== undefined ? u.defv * (u.buffs?.def || 1) : (u.def || 0) * (u.buffs?.def || 1));
}

export function computeDamage(B, atkUnit, defUnit, power, opt = {}) {
  if (!atkUnit || !defUnit) return { dmg: 0, crit: false };
  const atk = effAtk(atkUnit);
  let defv = effDef(defUnit);
  // 「贯穿」词缀与技能自带的破防叠加
  const pierce = clamp((opt.pierceDef || 0) + eqBonus(atkUnit, 'pierce'), 0, 0.85);
  if (pierce) defv = Math.floor(defv * (1 - pierce));
  /* 平衡公式：普攻（power=1）约造成 (1.05×攻击 − 0.95×防御) 的伤害
     —— 保证一场战斗 3~6 回合，且高防敌人仍有明显减伤
     防御按段数摊薄：多段技此前每一段都要扣满一次防御，段数越多越吃亏
     （凯的 5 段奥义被扣 5 次，伤害只有璃单段奥义的三分之一）。 */
  const hits = Math.max(1, opt.hits || 1);
  const base = (atk * power * 1.02) - (defv * 0.9) / hits + 44 * power;
  const lvl = atkUnit.level || 1;
  const dlv = defUnit.level || 1;
  const lvK = 1 + (lvl - dlv) * 0.02;
  /* 伤害浮动区间由攻击者的【幸运】决定。
     原文里系统对幸运 0 的警告是「攻击时全部取攻击值的下限」，
     所以幸运 0 的角色这里恒定取 0.94，一点运气都没有。
     敌人没有固定属性，沿用原来的区间。 */
  const roll = atkUnit.isEnemy ? { lo: 0.94, hi: 1.06 } : derived(atkUnit).roll;
  const rand = rnd(roll.lo, roll.hi);
  let dmg = base * lvK * rand;
  /* 暴击率：玩家侧完全由【幸运】决定（原文：幸运影响暴击率，幸运 0 则最低）。
     装备与技能的加成仍然叠加，否则装备上的「致命」词缀会失去意义。 */
  const criRate = atkUnit.isEnemy
    ? (atkUnit.cri || 0.06) + (opt.criBonus || 0) + 0.03
    : derived(atkUnit).crit + (atkUnit.cri || 0) + (opt.criBonus || 0);
  const crit = chance(criRate);
  if (crit) dmg *= 1.72 + eqBonus(atkUnit, 'critDmg');     // 「致命」词缀
  /* 【擦身反手】一类技能：上一次挨打时闪开了，这一刀才有加成。
     主角幸运为 0、永远不会暴击，这是他唯一能打出高伤的途径——
     而且必须先读对一次攻击，属于「操作换伤害」。 */
  if (opt.afterDodgeBonus && atkUnit.justDodged) {
    dmg *= 1 + opt.afterDodgeBonus;
    opt.dodgeCounter = true;
  }
  // 属性克制
  if (opt.weak && opt.elem && opt.weak.includes(opt.elem)) { dmg *= 1.5; opt.isWeak = true; }
  // 装备特效：属性伤害、猎弱、弑王
  if (opt.elem && opt.elem !== 'none') dmg *= 1 + eqElemBonus(atkUnit, opt.elem);
  // 天赋：凯「不退」残血增伤、璃「冰核」对冰封目标增伤
  if (!atkUnit.isEnemy && atkUnit.hp / atkUnit.maxHp < 0.4) dmg *= 1 + talentBonus(atkUnit, 'lowHpAtk');
  if ((defUnit.status || []).some(st => st.id === 'frozen')) dmg *= 1 + talentBonus(atkUnit, 'shatter');
  // 苍「守护」/ 璃「同行」：全队减伤
  if (!defUnit.isEnemy && opt.partyCut) dmg *= 1 - clamp(opt.partyCut, 0, 0.5);
  if (opt.weakTarget) dmg *= 1 + eqBonus(atkUnit, 'weakHunter');
  if (defUnit.boss) dmg *= 1 + eqBonus(atkUnit, 'bossBane');
  // 「壁垒」：受到的伤害减免
  if (!defUnit.isEnemy) dmg *= 1 - clamp(eqBonus(defUnit, 'flatCut'), 0, 0.45);
  // 状态影响
  const st = defUnit.status || [];
  if (st.some(s => s.id === 'defUp')) dmg *= 0.7;
  if (st.some(s => s.id === 'defDown')) dmg *= 1.3;
  dmg = Math.max(1, dmg);
  return { dmg: Math.floor(dmg), crit };
}

/* ============================================================
   技能执行器（统一入口）
   ============================================================ */
function runSkill(B, atkUnit, skillId, targets, opt = {}) {
  const s = SKILLS[skillId];
  const isEnemySkill = !!ENEMY_SKILLS[skillId];
  const es = ENEMY_SKILLS[skillId];
  const spec = isEnemySkill ? es : s;
  if (!spec) return null;      // 连携技不走技能表，这里直接跳过
  if (!targets || !targets.length) return null;

  const elem = spec.elem || 'none';
  const hits = spec.hits || 1;
  const isMagic = ['ice', 'thunder', 'holy', 'dark'].includes(elem) && !['pierce', 'slash'].includes(spec.fx) && !isEnemySkill;
  const fxName = spec.fx || (isEnemySkill ? 'slash' : 'slash');

  const hitDur = 0.19, recov = 0.24;
  const total = hits * (hitDur + recov) + (hits > 1 ? 0.3 : 0.34);

  // 预计算
  const plan = targets.filter(Boolean).map(tg => {
    const arr = [];
    for (let h = 0; h < hits; h++) {
      const tgWeak = tg.weak || tg.def?.weak;
      const r = computeDamage(B, atkUnit, tg, spec.power || 1, {
        elem, criBonus: spec.criBonus || 0, pierceDef: spec.pierceDef || 0, hits,
        weakTarget: !!(tgWeak && elem && tgWeak.includes(elem)),
        partyCut: tg.isEnemy ? 0 : partyDamageCut(B),
        afterDodgeBonus: spec.afterDodgeBonus || 0,
      });
      arr.push(r);
    }
    return { tg, arr };
  });

  let fired = new Array(hits).fill(false);
  let poseSet = false;

  return {
    dur: total,
    start() {
      addLog(B, `<span class="hl">${atkUnit.name}</span> 使用了 <span class="hl">${spec.name || skillId}</span>！`);
      if (atkUnit.isEnemy) {
        if (!spec.target || spec.target === 'one' || spec.target === 'all') {
          atkUnit.pose = 'ready';
          atkUnit.atkP = 0;
        } else {
          atkUnit.pose = 'cast';
        }
      } else {
        atkUnit.pose = isMagic ? 'cast' : 'ready';
        if (isMagic) addFx(B, 'aura', atkUnit.x, atkUnit.y - 70, elemColor(elem), { dur: 0.5, r: 74 });
      }
      if (spec.buff && (spec.target === 'self' || spec.target === 'selfside')) {
        applyBuff(B, spec.buff, atkUnit.isEnemy ? B.enemies.filter(e => !e.dead) : [atkUnit]);
      }
    },
    tick(k) {
      const u = k * total;
      for (let h = 0; h < hits; h++) {
        const t0 = h * (hitDur + recov) + hitDur * 0.55;
        if (!fired[h] && u >= t0) {
          fired[h] = true;
          doHit(h);
        }
      }
      // 敌人冲刺表现
      if (atkUnit.isEnemy && spec.power > 0) {
        atkUnit.atkP = clamp((u - 0.02) / (hitDur + recov), 0, 1);
      }
    },
    resolve() { },
  };

  function doHit(h) {
    for (const p of plan) {
      const tg = p.tg;
      if (tg.dead) continue;
      const r = p.arr[h];
      const weak = tg.weak || tg.def?.weak;
      let elemBonus = false;
      if (weak && weak.includes(elem)) { r.dmg = Math.floor(r.dmg * 1.5); elemBonus = true; }
      if (elemBonus && !atkUnit.isEnemy && h === 0) gainBreak(B, tg, 1 + eqBonus(atkUnit, 'breakPlus'));
      const isEnemy = atkUnit.isEnemy;
      /* 防御判定：敌人打我方时先滚回避，再滚弹反、格挡。
         概率来自角色属性 + 装备，选了「格挡」指令则本轮大幅提升。 */
      let guardMul = 1, guardKind = null, dodged = false;
      if (isEnemy && !tg.isEnemy) {
        /* 回避判定，排在弹反 / 格挡之前，命中则攻击完全落空。
           两个来源都是原文里的东西：
             · 自由属性【敏捷】——「1 敏捷 = 1 回避 + 1 命中」
             · 天赋属性【反应力】—— 等同现实的反应能力，主角 72，常人 7~10
           攻击方的【感知力】折算成命中，抵掉一部分回避。
           这是主角在「职业赋予失败、整个新手期没有职业」时唯一真正的依仗。 */
        const d = derived(tg);
        const evaFromAgi = Math.min(0.25, (tg.eva || 0) * 0.01);
        const acc = atkUnit.isEnemy ? 0 : derived(atkUnit).accuracy;
        const evade = clamp(d.evade + evaFromAgi + (tg.evadeBonus || 0) - acc, 0, 0.75);
        if (chance(evade)) {
          guardMul = 0; guardKind = 'dodge'; dodged = true;
          // 记下「刚闪过」，【擦身反手】一类技能会吃这个加成
          tg.justDodged = true;
        }
      }
      if (isEnemy && !tg.isEnemy && !dodged) {
        /* 预判格挡：下了格挡指令就进入架势，弹反窗口大幅放宽。
           par 来自角色属性 + 装备（疾风之靴的 par+0.05 到这里才第一次有意义）。 */
        const par = clamp((tg.par || 0) + (tg.guardStance ? 0.34 : 0), 0, 0.85);
        const blk = clamp((tg.blk || 0) + (tg.guardStance ? 0.45 : 0), 0, 0.92);
        if (chance(par)) { guardMul = 0; guardKind = 'parry'; }
        else if (chance(blk)) { guardMul = 0.38; guardKind = 'block'; }
      }
      const finalDmg = Math.floor(r.dmg * guardMul);

      if (guardKind === 'dodge') {
        tg.hurtP = 0;
        addFloat(B, '闪避', tg.x, tg.y - 118, '#8fe6ff', 28);
      } else if (guardKind === 'parry') {
        // 完全抵消，不走 damage()（它有最低 1 点伤害的下限）
        tg.hurtP = 0;
        addFloat(B, '弹反！', tg.x, tg.y - 118, '#fff6c0', 30);
        flash(B, 0.35); shake(B, 10);
      } else {
        damage(B, tg, finalDmg, { crit: r.crit, col: r.crit ? '#ffe14d' : (elemBonus ? elemColor(elem) : undefined), by: isEnemy ? null : atkUnit, attacker: atkUnit, from: spec.drain ? atkUnit : null, drain: spec.drain });
        if (isEnemy && !tg.isEnemy) gainRage(B, tg, clamp(RAGE.taken * finalDmg / Math.max(1, tg.maxHp), 2, 25));
      }

      // 命中特效
      const fxCol = elemColor(elem) === '#ffffff' ? (r.crit ? '#ffe14d' : '#ffffff') : elemColor(elem);
      /* 命中特效。
         每个 fx 名字对应技能描述里真正写的那件事——
         「连续三次斩击」就画三道刀光，「雷光贯穿」就真的从天上劈下来，
         「连时空都冻结」就冻整个画面，而不是所有技能共用一团爆光。 */
      const ultBig = !!spec.ult;
      switch (fxName) {
        case 'slash':
          addFx(B, 'slash', tg.x, tg.y - 88, fxCol, { dur: 0.34, ang: -0.6 + rnd(-.4, .4), rx: 78, ry: 66 });
          if (hits > 1 && h < hits - 1) addFx(B, 'slash', tg.x, tg.y - 88, '#ffffff', { dur: 0.3, ang: 0.7 + rnd(-.4, .4), rx: 70, ry: 60 });
          break;
        case 'flurry':                       // 连刃·三连斩：一次画满整组刀光
          if (h === 0) addFx(B, 'flurry', tg.x, tg.y - 88, fxCol, { dur: 0.16 * hits + 0.3, n: hits, rx: 80 });
          addFx(B, 'slash', tg.x, tg.y - 88, '#ffffff', { dur: 0.26, ang: (h % 2 ? 1 : -1) * 0.8, rx: 68, ry: 58 });
          break;
        case 'pierce':
          addFx(B, 'pierce', tg.x, tg.y - 86, fxCol, { dur: 0.32 });
          addFx(B, 'burst', tg.x, tg.y - 84, fxCol, { dur: 0.3, r: 44, n: 7 });
          break;
        case 'fire':
          addFx(B, 'burst', tg.x, tg.y - 80, '#ff6a1a', { dur: 0.6, r: ultBig ? 140 : 90, n: ultBig ? 22 : 14 });
          addFx(B, 'fire', tg.x, tg.y - 40, '#ff8a1a', { dur: ultBig ? 1.0 : 0.7, big: ultBig });
          if (ultBig && h === hits - 1) { flash(B, 0.5); shake(B, 16); }
          break;
        case 'blaze':                        // 焦炎·狮子奋迅：脚下炎环 + 火柱
          addFx(B, 'blaze', tg.x, tg.y, '#ff8a1a', { dur: 0.8 });
          addFx(B, 'fire', tg.x, tg.y - 40, '#ffb43d', { dur: 0.7 });
          break;
        case 'ice':
          addFx(B, 'ice', tg.x, tg.y - 80, '#8fe6ff', { dur: 0.65 });
          addFx(B, 'burst', tg.x, tg.y - 80, '#cfe8ff', { dur: 0.34, r: 52, n: 8 });
          break;
        case 'frost':                        // 绝对零度 / 暴雪：整个画面降温
          if (h === 0) addFx(B, 'frostfield', 0, 0, '#8fe6ff', { dur: ultBig ? 1.1 : 0.75 });
          addFx(B, 'ice', tg.x, tg.y - 80, '#e8ffff', { dur: 0.7 });
          if (ultBig && h === 0) { flash(B, 0.45); B.hitstop = 0.12; }
          break;
        case 'thunder':
          addFx(B, 'thunder', tg.x, tg.y, '#ffe14d', { dur: 0.5 });
          addFx(B, 'burst', tg.x, tg.y - 80, '#ffe14d', { dur: 0.45, r: 70, n: 10 });
          break;
        case 'bolt':                         // 雷鸣·千鸟突：一道贯穿的雷
          addFx(B, 'bolt', tg.x, tg.y - 80, '#ffe14d', { dur: 0.42 });
          addFx(B, 'thunder', tg.x, tg.y, '#fff6c0', { dur: 0.45 });
          addFx(B, 'burst', tg.x, tg.y - 80, '#ffe14d', { dur: 0.4, r: 80, n: 12 });
          shake(B, 12);
          break;
        case 'holy':                         // 圣光：自上而下的光柱
          addFx(B, 'holybeam', tg.x, tg.y - 40, '#fff3c4', { dur: 0.62 });
          addFx(B, 'burst', tg.x, tg.y - 80, '#ffffff', { dur: 0.4, r: 66, n: 10 });
          break;
        case 'shadow':
          addFx(B, 'shadow', tg.x, tg.y - 80, '#6a2a8a', { dur: 0.55 });
          addFx(B, 'burst', tg.x, tg.y - 80, '#c86bff', { dur: 0.4, r: 60, n: 9 });
          break;
        case 'combo':                        // 连携技
          addFx(B, 'combo', tg.x, tg.y - 80, fxCol, { dur: 0.7 });
          addFx(B, 'burst', tg.x, tg.y - 80, '#ffffff', { dur: 0.5, r: 120, n: 18 });
          flash(B, 0.6); shake(B, 18);
          break;
        default:
          addFx(B, 'burst', tg.x, tg.y - 80, fxCol, { dur: 0.45, r: 60 });
      }
      if (elemBonus) addFloat(B, '弱点！', tg.x, tg.y - 148, '#48d8ff', 24);

      // 附加状态
      const inf = spec.inflict;
      const infChance = (inf ? (inf.chance ?? 0.4) : 0)
        + (inf && inf.id === 'frozen' && !atkUnit.isEnemy ? talentBonus(atkUnit, 'freezePlus') : 0);
      if (inf && !tg.dead && chance(infChance)) {
        applyStatus(B, tg, inf.id, inf.turns || STATUS[inf.id].turns);
      }
      // 「燃焰」词缀：我方攻击概率点燃
      if (!atkUnit.isEnemy && !tg.dead && chance(eqBonus(atkUnit, 'burnChance'))) {
        applyStatus(B, tg, 'burn', STATUS.burn.turns);
      }
      // 「余响」词缀：概率追加一次半伤攻击
      if (!atkUnit.isEnemy && !tg.dead && h === hits - 1 && chance(eqBonus(atkUnit, 'echo'))) {
        const ex = computeDamage(B, atkUnit, tg, (spec.power || 1) * 0.5, { elem, hits: 1 });
        damage(B, tg, ex.dmg, { crit: ex.crit, col: '#ffd76a', by: atkUnit, attacker: atkUnit });
        addFloat(B, '余响！', tg.x, tg.y - 158, '#ffd76a', 24);
        addFx(B, 'slash', tg.x, tg.y - 88, '#ffd76a', { dur: 0.28, ang: 1.1, rx: 70, ry: 60 });
      }
      // 只在第一段生效，否则多段技会把目标一路推到条底
      if (spec.gauge && !tg.dead && h === 0) shiftGauge(B, tg, spec.gauge);
      // 格挡/弹反的视觉与怒气回馈
      if (guardKind) {
        addFx(B, 'guard', tg.x, tg.y - 70, guardKind === 'parry' ? '#fff6c0' : '#8fd8ff', { dur: 0.4, perfect: guardKind === 'parry' });
        if (guardKind === 'parry') {
          addLog(B, `<span class="hl">※ 弹反！${tg.name} 完全抵消了这一击！</span>`);
          gainRage(B, tg, RAGE.parry);
          // 弹反的回报：把攻击者的行动条打回去，并立刻还一刀
          shiftGauge(B, atkUnit, -GOAL * 0.4);
          if (!atkUnit.dead && h === 0) {
            const back = computeDamage(B, tg, atkUnit, 0.85, { hits: 1 });
            damage(B, atkUnit, back.dmg, { crit: back.crit, col: '#fff6c0', by: tg });
            addFloat(B, '反击！', atkUnit.x, atkUnit.y - 140, '#fff6c0', 26);
            addFx(B, 'slash', atkUnit.x, atkUnit.y - 88, '#fff6c0', { dur: 0.32, ang: 0.5, rx: 78, ry: 66 });
            if (atkUnit.weak && tg.elemAffinity && atkUnit.weak.includes(tg.elemAffinity)) gainBreak(B, atkUnit, 1);
          }
        } else {
          addLog(B, `※ ${tg.name} 挡下了这一击（伤害减免）。`);
          gainRage(B, tg, RAGE.block);
          // 「还礼」词缀：普通格挡也触发反击
          if (eqBonus(tg, 'guardCounter') > 0 && !atkUnit.dead && h === 0) {
            const back = computeDamage(B, tg, atkUnit, 0.55, { hits: 1 });
            damage(B, atkUnit, back.dmg, { crit: back.crit, col: '#8fd8ff', by: tg });
            addFloat(B, '还礼', atkUnit.x, atkUnit.y - 140, '#8fd8ff', 22);
          }
        }
      }
      if (!isEnemy && !tg.dead) gainRage(B, atkUnit, (SKILLS[skillId]?.rage || 10) / Math.max(1, hits) * RAGE.hit);
      // 技能自带的自我回复（真·灭魂炎狱斩）
      if (spec.selfHeal && h === hits - 1 && !atkUnit.isEnemy && !atkUnit.dead) {
        const h2 = Math.floor(atkUnit.maxHp * spec.selfHeal);
        atkUnit.hp = Math.min(atkUnit.maxHp, atkUnit.hp + h2);
        addFloat(B, `+${h2}`, atkUnit.x, atkUnit.y - 130, '#ff9a3c', 30);
        addFx(B, 'fire', atkUnit.x, atkUnit.y - 40, '#ff8a1a', { dur: 0.8 });
      }
    }
    // 敌人被攻击后按血量说话
    if (!atkUnit.isEnemy) {
      for (const e of B.enemies) {
        if (!e.dead && e.hp / e.maxHp < 0.5 && !e.said && e.quote) {
          e.said = true;
          B.floats.push({ kind: 'quote', txt: e.quote, x: e.x, y: e.y - 110 * e.scale, life: 0, dur: 2, col: '#ffb0b0' });
        }
      }
    }
  }
}

/* 全队减伤：苍的「守护」与璃的「同行」，取两者之和 */
function partyDamageCut(B) {
  let cut = 0;
  for (const m of B.party) {
    if (m.dead) continue;
    cut += talentBonus(m, 'partyCut') + talentBonus(m, 'guardAlly');
  }
  return clamp(cut, 0, 0.45);
}

function elemColor(e) {
  return { none: '#ffffff', fire: '#ff8a1a', ice: '#8fe6ff', thunder: '#ffe14d', dark: '#b06bff', holy: '#fff3c4' }[e] || '#ffffff';
}

/* ============================================================
   状态 / 增益
   ============================================================ */
export function applyStatus(B, unit, id, turns) {
  // 「守誓」词缀：概率免疫负面状态
  if (unit && !unit.isEnemy && STATUS[id] && STATUS[id].bad && chance(eqBonus(unit, 'statusRes'))) {
    addFloat(B, '抵抗！', unit.x, unit.y - 140, '#8fd8ff', 22);
    return;
  }
  const st = STATUS[id];
  if (!st) return;
  if (id === 'poison' && (unit.def?.immune || []).includes('poison')) return;
  const ex = unit.status.find(s => s.id === id);
  if (ex) ex.turns = Math.max(ex.turns, turns);
  else unit.status.push({ id, turns });
  addLog(B, `<span class="${st.bad ? 'dmg' : 'heal'}">${unit.name} 陷入【${st.name}】状态！</span>`);
  addFloat(B, st.icon + st.name, unit.x, unit.y - 130, st.bad ? '#ff7a9a' : '#8fe6ff', 22);
}

function applyBuff(B, buff, targets) {
  const st = STATUS[buff.id];
  for (const t of targets) {
    if (!t || t.dead) continue;
    const ex = t.status.find(s => s.id === buff.id);
    if (ex) ex.turns = Math.max(ex.turns, buff.turns);
    else t.status.push({ id: buff.id, turns: buff.turns });
    if (buff.id === 'atkUp') t.buffs.atk = 1.5;
    if (buff.id === 'defUp') t.buffs.def = 1.4;
    if (buff.id === 'haste') t.buffs.spd = 1.6;
    if (buff.id === 'slow') t.buffs.spd = 0.6;
    addFloat(B, st.icon + st.name, t.x, t.y - 130, '#ffe14d', 22);
    addFx(B, 'aura', t.x, t.y - 70, '#ffe14d', { dur: 0.55, r: 76 });
  }
  addLog(B, `<span class="hl">${targets.map(t => t.name).join('、')} 获得【${st.name}】！</span>`);
}

export function tickStatus(B, unit) {
  for (const s of unit.status) {
    if (s.id === 'poison') {
      const d = Math.floor(unit.maxHp * 0.07) + 12;
      unit.hp = Math.max(0, unit.hp - d);
      addFloat(B, `☠${d}`, unit.x + rnd(-14, 14), unit.y - 110, '#c86bff', 26);
      addFx(B, 'burst', unit.x, unit.y - 70, '#c86bff', { dur: .4, r: 34 });
    }
    if (s.id === 'burn') {
      const d = Math.floor(unit.maxHp * 0.09) + 16;
      unit.hp = Math.max(0, unit.hp - d);
      addFloat(B, `🔥${d}`, unit.x + rnd(-14, 14), unit.y - 110, '#ff8a1a', 26);
      addFx(B, 'fire', unit.x, unit.y - 40, '#ff8a1a', { dur: .45 });
    }
    if (s.id === 'regen') {
      const h = Math.floor(unit.maxHp * 0.1) + 20;
      unit.hp = Math.min(unit.maxHp, unit.hp + h);
      addFloat(B, `+${h}`, unit.x, unit.y - 120, '#7dffa8', 26);
      addFx(B, 'heal', unit.x, unit.y - 60, '#7dffa8', { dur: .5 });
    }
    if (B.objective?.type === 'purify' && !(B.objective.targets || []).includes(unit.ref)) unit.hp = Math.max(1, unit.hp);
    if (unit.hp <= 0 && !unit.dead) {
      unit.dead = true; unit.pose = 'dead'; unit.dying = 0;
      addLog(B, `<span class="dmg">${unit.name} 倒下了！</span>`);
    }
    s.turns--;
  }
  const removed = unit.status.filter(s => s.turns <= 0);
  for (const r of removed) {
    if (r.id === 'atkUp') unit.buffs.atk = 1;
    if (r.id === 'defUp') unit.buffs.def = 1;
    if (r.id === 'haste' || r.id === 'slow') unit.buffs.spd = 1;
  }
  unit.status = unit.status.filter(s => s.turns > 0);
}

/* ============================================================
   行动构造
   ============================================================ */
/* 玩家指令批量执行 */
/* 轮到下一个单位出手。我方 -> 等玩家下指令；敌方 -> 直接行动。 */
export function beginNextTurn(B) {
  if (B.over) return;
  const u = scheduleNext(B);
  if (!u) return;
  B.active = u;
  B.turn++;
  B.ui.queue.push({
    dur: 0.22,
    start() { startOfTurn(B, u); },
    tick() { },
    resolve() { afterTurnStart(B, u); },
  });
}

/* 单位自己的回合开始：状态结算、资源回复、清掉上一次的格挡姿态 */
function startOfTurn(B, u) {
  u.guardStance = false;
  u.parryReady = false;
  /* 【读招】的回避加成与「刚闪过」的标记都只维持到本单位下次出手。
     它们必须在这里清掉，否则加成会一直叠着不掉，主角变成无敌。 */
  u.evadeBonus = 0;
  u.justDodged = false;
  if (u.broken > 0) {
    u.broken--;
    if (u.broken === 0) addLog(B, `${u.name} 重新站稳了架势。`);
  }
  tickStatus(B, u);
  if (u.dead) return;
  if (u.status.some(st => st.id === 'stun')) {
    addLog(B, `<span class="hl">${u.name} 处于眩晕，无法行动！</span>`); u.skip = true; return;
  }
  if (u.status.some(st => st.id === 'frozen')) {
    addLog(B, `<span class="hl">${u.name} 被冰封，无法行动！</span>`); u.skip = true; return;
  }
  u.skip = false;
  // 术力角色在自己回合开始回蓝；愤怒角色没有被动回复
  if (!u.isEnemy && u.resource !== 'rage') u.mp = Math.min(u.maxMp, u.mp + (u.mpRegen || 3) + eqBonus(u, 'mpPlus'));
  // 「回春」词缀
  if (!u.isEnemy) {
    const rg = eqBonus(u, 'hpRegen');
    if (rg > 0 && u.hp < u.maxHp) {
      const h = Math.max(1, Math.floor(u.maxHp * rg));
      u.hp = Math.min(u.maxHp, u.hp + h);
      addFloat(B, `+${h}`, u.x, u.y - 118, '#7dffa8', 20);
    }
  }
}

function afterTurnStart(B, u) {
  if (B.over) return;
  if (u.dead || u.skip) { u.skip = false; endTurn(B); return; }
  if (u.isEnemy) {
    chooseEnemyAction(B, u);
    B.ui.queue.push({ dur: 0.12, start() { }, tick() { }, resolve() { endTurn(B); } });
  } else {
    B.ui.mode = 'wait';   // 队列清空后 updateBattle 会向 UI 请求指令
  }
}

/* 玩家为当前单位下达了一条指令 */
export function takePlayerAction(B, m, cmd) {
  if (B.over || !m || m.dead) return;
  B.ui.mode = 'running';
  B.ui.queue.push({
    dur: 0.32,
    start() { m.pose = 'ready'; },
    tick(k) { if (k > 0.9) m.pose = 'idle'; },
    resolve() { resolvePlayerCmd(B, m, cmd); },
  });
  B.ui.queue.push({ dur: 0.12, start() { }, tick() { }, resolve() { endTurn(B); } });
}

function endTurn(B) {
  checkBattleEnd(B);
  if (B.over) return;
  // 雷「疾风·连闪」：概率行动后立刻再动一次
  const u = B.active;
  if (u && !u.isEnemy && !u.dead && chance(talentBonus(u, 'extraTurn'))) {
    u.gauge = GOAL - 1;
    addFloat(B, '连闪！', u.x, u.y - 150, '#8fe6ff', 26);
    addLog(B, `<span class="hl">※ ${u.name} 的速度快到再动了一次！</span>`);
  }
  beginNextTurn(B);
}

function resolvePlayerCmd(B, m, cmd) {
  if (m.dead) return;
  if (B.objective?.type === 'rescue') B.objective.progress++;
  switch (cmd.type) {
    case 'objective': {
      if (!canObjective(B, m)) break;
      B.objective.completed.push(m.id);
      B.objective.progress++;
      m.guardStance = true;
      addLog(B, `${m.name} 完成了${B.objective.type === 'purify' ? '净化' : '封门术式'}！`);
      addFloat(B, '术式完成', m.x, m.y - 130, '#8fe6ff', 26);
      break;
    }
    case 'attack': {
      const ws = (ACTORS[m.id] && ACTORS[m.id].weaponSkill) || ['xinzhan'];
      const sk = SKILLS[ws[0]] || SKILLS.xinzhan || SKILLS.liaoshang;
      if (sk) execSkill(B, m, sk.id, [pickEnemy(B, cmd.target)].filter(Boolean));
      break;
    }
    case 'skill': {
      const sk = SKILLS[cmd.skill];
      if (!sk) break;
      if (isSealed(m)) { addLog(B, `<span class="dmg">${m.name} 被封印了，无法使用术式！</span>`); break; }
      // 凯「炎道·薪尽」：解放的怒气消耗打折
      const disc = sk.release ? (1 + talentBonus(m, 'releaseCost')) : 1;
      m.mp = Math.max(0, m.mp - Math.round((sk.mp || 0) * Math.max(0.4, disc)));
      if (sk.type === 'heal') {
        execHeal(B, m, sk, cmd.target);
      } else if (sk.type === 'revive') {
        execRevive(B, m, sk, cmd.target);
      } else if (sk.type === 'buff') {
        execBuff(B, m, sk);
      } else if (sk.ult) {
        execUlt(B, m, sk, cmd.target);
      } else {
        const targets = sk.target === 'all' ? B.enemies.filter(e => !e.dead) : [pickEnemy(B, cmd.target)].filter(Boolean);
        execSkill(B, m, sk.id, targets);
      }
      break;
    }
    case 'item': execItem(B, m, cmd.item, cmd.target); break;
    case 'combo':
      execCombo(B, m, cmd.combo, cmd.target);
      break;
    case 'guard':
      m.guardStance = true;
      addLog(B, `<span class="hl">${m.name}</span> 摆出了防御姿态（格挡·弹反率大幅提升）。`);
      gainRage(B, m, RAGE.guardCmd);
      break;
    case 'escape':
      attemptEscape(B); break;
  }
}

/* ============================================================
   连携技
   ============================================================ */
/* 行动条顺序上相邻的两人（或全队）+ 羁绊达标 → 亮起合击。
   发动时同时消耗参与者本回合的行动。 */
export function availableCombos(B, m) {
  if (!m || m.dead || !B.bondLevel) return [];
  const order = forecastOrder(B, 6).filter(u => !u.isEnemy && !u.dead);
  const idx = order.findIndex(u => u.id === m.id);
  const neighbours = new Set();
  if (idx >= 0) {
    if (order[idx + 1]) neighbours.add(order[idx + 1].id);
    if (order[idx - 1]) neighbours.add(order[idx - 1].id);
  }
  const alive = new Set(B.party.filter(p => !p.dead).map(p => p.id));
  const out = [];
  for (const c of Object.values(COMBOS)) {
    if (!c.members.includes(m.id)) continue;
    if (!c.members.every(id => alive.has(id))) continue;
    if (B.combosUsed && B.combosUsed[c.id]) continue;
    const partners = c.members.filter(id => id !== m.id);
    // 四人连携只要全员活着即可；双人连携需要出手顺序相邻
    if (c.members.length === 2 && !partners.every(id => neighbours.has(id))) continue;
    const minBond = Math.min(...c.members.map(id => B.bondLevel(id)));
    if (minBond < c.bond) continue;
    out.push(c);
  }
  return out;
}

export function execCombo(B, m, comboId, targetIdx) {
  const c = COMBOS[comboId];
  if (!c) return;
  B.combosUsed = B.combosUsed || {};
  B.combosUsed[c.id] = true;
  const members = c.members.map(id => B.byId[id]).filter(u => u && !u.dead);
  // 参与者的行动条全部清空，等价于都用掉了这一回合
  for (const u of members) if (u.id !== m.id) u.gauge = 0;

  B.cutin = {
    name: c.name, portrait: (B.byId[c.members[0]] || m).portrait, combo: true,
    members: members.map(u => u.portrait), life: 0, dur: 1.6,
    after: () => {
      flash(B, 1); shake(B, 24);
      const targets = c.target === 'party' ? B.party.filter(u => !u.dead)
        : c.target === 'all' ? B.enemies.filter(e => !e.dead)
          : [pickEnemy(B, targetIdx)].filter(Boolean);
      addLog(B, `<span class="hl">连携 · ${c.name}！</span>`);

      if (c.type === 'support') {
        for (const t of targets) {
          if (c.healRatio) {
            const h = Math.floor(t.maxHp * c.healRatio);
            t.hp = Math.min(t.maxHp, t.hp + h);
            addFloat(B, `+${h}`, t.x, t.y - 120, '#7dffa8', 30);
            addFx(B, 'heal', t.x, t.y - 60, '#7dffa8', { dur: 0.7 });
          }
          if (c.buff) applyStatus(B, t, c.buff.id, c.buff.turns);
          if (c.pushAll) shiftGauge(B, t, c.pushAll);
          addFx(B, 'combo', t.x, t.y - 80, '#8fe6ff', { dur: 0.6 });
        }
        B.ui.queue.push({ dur: 0.7, start() { }, tick() { }, resolve() { } });
        return;
      }

      const bonusMul = 1 + (B.comboBonus ? B.comboBonus(c) : 0);
      const hits = c.hits || 1;
      let t0 = 0;
      B.ui.queue.push({
        dur: 0.24 * hits + 0.5,
        start() { for (const u of members) { u.pose = 'ready'; u.atkP = 0; } },
        tick(k) {
          const step = Math.floor(k * hits);
          while (t0 <= step && t0 < hits) {
            for (const tg of targets) {
              if (tg.dead) continue;
              let mul = 1;
              if (c.bonusVs && (tg.status || []).some(st => st.id === c.bonusVs.status)) mul = c.bonusVs.mul;
              const r = computeDamage(B, m, tg, (c.power || 1) * mul * bonusMul, {
                elem: c.elem, hits, criBonus: c.alwaysCrit ? 1 : 0.15,
              });
              damage(B, tg, r.dmg, { crit: c.alwaysCrit || r.crit, col: '#ffd76a', by: m, attacker: m });
              addFx(B, 'combo', tg.x, tg.y - 80, '#ffd76a', { dur: 0.55 });
            }
            t0++;
          }
        },
        resolve() { for (const u of members) u.pose = 'idle'; },
      });
    },
  };
}

function pickEnemy(B, i) {
  const alive = B.enemies.filter(e => !e.dead);
  if (!alive.length) return B.enemies[0];
  if (i != null) { const e = B.enemies[i]; if (e && !e.dead) return e; }
  return alive[0];
}

/* 把技能包装成 action 并推入队列 */
function execSkill(B, atkUnit, skillId, targets) {
  const act = runSkill(B, atkUnit, skillId, targets.filter(Boolean));
  if (act) B.ui.queue.push(act);
}
function execUlt(B, m, sk, targetIdx) {
  // 奥义演出
  const targets = sk.target === 'all' ? B.enemies.filter(e => !e.dead) : [pickEnemy(B, targetIdx)];
  m.ultNotified = false;
  B.cutin = { name: sk.name, portrait: m.portrait, life: 0, dur: 1.5, after: () => {
    flash(B, 1);
    shake(B, 20);
    const act = runSkill(B, m, sk.id, targets);
    if (act) B.ui.queue.push(act);
    addLog(B, `<span class="hl">—— ${m.name} 的奥义！${sk.name}！！</span>`);
  } };
  B.game.sfx('ult');
}
function execHeal(B, m, sk, targetIdx) {
  const t = sk.target === 'party' ? null : (B.party[targetIdx] || m);
  const list = sk.target === 'party' ? B.party : [t];
  const doHeal = () => B.ui.queue.push({
    dur: 0.85,
    start() {
      m.pose = 'cast';
      addLog(B, `<span class="hl">${m.name}</span> 使用了 <span class="hl">${sk.name}</span>！`);
      addFx(B, 'aura', m.x, m.y - 70, '#8fe6ff', { dur: .6, r: 80 });
      for (const u of list) {
        if (!u || u.dead) continue;
        const heal = Math.floor((m.atk * sk.power * 2.6 + u.maxHp * (sk.power * 0.12) + 40) * (1 + talentBonus(m, 'healPlus')));
        u.hp = Math.min(u.maxHp, u.hp + heal);
        addFloat(B, `+${heal}`, u.x, u.y - 120, '#7dffa8', 32);
        addFx(B, 'heal', u.x, u.y - 60, '#7dffa8', { dur: .8 });
        addLog(B, `<span class="heal">${u.name} 回复了 ${heal} 点生命。</span>`);
      }
      if (sk.buff) applyBuff(B, sk.buff, list.filter(u => u && !u.dead));
      if (sk.gauge) for (const u of list) shiftGauge(B, u, sk.gauge);
    },
    tick(k) { if (k > .8) m.pose = 'idle'; },
    resolve() { gainRage(B, m, 12); },
  });
  if (sk.ult) {
    m.ultNotified = false;
    B.cutin = { name: sk.name, portrait: m.portrait, life: 0, dur: 1.5, after: () => { flash(B, .8); doHeal(); } };
    B.game.sfx('ult');
  } else doHeal();
}
function execRevive(B, m, sk, targetIdx) {
  const t = B.party[targetIdx];
  if (!t || !t.dead) { addLog(B, `※ 目标没有倒下。`); return; }
  B.ui.queue.push({
    dur: 1.0,
    start() {
      m.pose = 'cast';
      addLog(B, `<span class="hl">${m.name}</span> 使用了 <span class="hl">${sk.name}</span>！`);
      addFx(B, 'heal', t.x, t.y - 60, '#fff3c4', { dur: 1 });
      t.dead = false; t.pose = 'idle'; t.dying = 0;
      t.hp = talentBonus(m, 'reviveFull') > 0 ? t.maxHp : Math.floor(t.maxHp * (sk.power || 0.5));
      addFloat(B, '复活！', t.x, t.y - 140, '#fff3c4', 30);
      addLog(B, `<span class="heal">${t.name} 重新站了起来！</span>`);
      gainRage(B, m, 18);
    },
    tick(k) { if (k > .9) m.pose = 'idle'; },
    resolve() { },
  });
}
function execBuff(B, m, sk) {
  B.ui.queue.push({
    dur: 0.8,
    start() {
      m.pose = 'ready';
      addLog(B, `<span class="hl">${m.name}</span> 发动了 <span class="hl">${sk.name}</span>！`);
      applyBuff(B, sk.buff, [m]);
      if (sk.buff2) applyBuff(B, sk.buff2, [m]);
      if (sk.gauge) shiftGauge(B, m, sk.gauge);
      /* 【读招】一类技能：临时拉高回避，持续到该单位下次出手。
         主角没有职业、没有暴击，回避是他唯一能主动操作的变量。 */
      if (sk.evadeUp) {
        m.evadeBonus = sk.evadeUp;
        addFloat(B, `回避 +${Math.round(sk.evadeUp * 100)}%`, m.x, m.y - 150, '#8fe6ff', 22);
      }
      /* selfHeal 原本只写在伤害循环里（见 runSkill 的命中分支），
         于是 type:'buff' 的技能永远走不到那一段——【凝神】描述里写着
         「回复少量生命」，实际一点血都不回。又一个死键，2026-09-15 补上。 */
      if (sk.selfHeal && !m.dead) {
        const hs = Math.floor(m.maxHp * sk.selfHeal);
        m.hp = Math.min(m.maxHp, m.hp + hs);
        addFloat(B, `+${hs}`, m.x, m.y - 130, '#7dffa8', 30);
      }
      flash(B, 0.35);
      shake(B, 8);
      gainRage(B, m, sk.rage || 12);
    },
    tick(k) { if (k > .6) m.pose = 'idle'; },
    resolve() { },
  });
}

export function execItem(B, m, itemId, targetIdx) {
  const it = ITEMS[itemId];
  if (!it) return;
  B.game.useItem(itemId);
  const isEnemyTarget = it.target === 'enemy';
  const t = isEnemyTarget ? pickEnemy(B, targetIdx) : (B.party[targetIdx] || m);
  B.ui.queue.push({
    dur: 0.8,
    start() {
      addLog(B, `<span class="hl">${m.name}</span> 使用了 <span class="hl">${it.name}</span>。`);
      m.pose = 'ready';
      if (it.heal && t) {
        t.hp = Math.min(t.maxHp, t.hp + it.heal);
        addFloat(B, `+${it.heal}`, t.x, t.y - 120, '#7dffa8', 32);
        addFx(B, 'heal', t.x, t.y - 60, '#7dffa8', { dur: .8 });
        addLog(B, `<span class="heal">${t.name} 回复了生命。</span>`);
      }
      if (it.mp && t) {
        t.mp = Math.min(t.maxMp, t.mp + it.mp);
        addFloat(B, `+${it.mp}`, t.x - 30, t.y - 140, '#48d8ff', 28);
        addFx(B, 'aura', t.x, t.y - 70, '#48d8ff', { dur: .6, r: 60 });
      }
      if (it.full && t) { t.hp = t.maxHp; t.mp = t.maxMp; addFloat(B, '全回复！', t.x, t.y - 150, '#fff3c4', 28); }
      if (it.revive != null && t && t.dead) {
        t.dead = false; t.pose = 'idle'; t.dying = 0; t.hp = Math.floor(t.maxHp * it.revive);
        addFloat(B, '复活！', t.x, t.y - 150, '#fff3c4', 30);
        addLog(B, `<span class="heal">${t.name} 重新站了起来！</span>`);
      }
      if (it.dmg && t) {
        damage(B, t, it.dmg, { col: '#ff8a1a' });
        addFx(B, 'fire', t.x, t.y - 40, '#ff8a1a', { dur: .7 });
        addFx(B, 'burst', t.x, t.y - 80, '#ff6a1a', { dur: .6, r: 86, n: 14 });
      }
      if (it.seal && t) applyStatus(B, t, 'stun', 1);
      if (it.escape) { B.escaped = true; addLog(B, `※ 烟雾散开——成功脱身！`); }
      gainRage(B, m, 8);
    },
    tick(k) { if (k > .7) m.pose = 'idle'; },
    resolve() { },
  });
}

function attemptEscape(B) {
  if (B.def.boss || !B.def.escape) {
    addLog(B, `<span class="dmg">※ 首领战无法逃离！</span>`);
    return;
  }
  B.escapes++;
  const ok = chance(0.62 + B.escapes * 0.15);
  if (ok) { B.escaped = true; addLog(B, `※ 成功脱离战斗！`); }
  else addLog(B, `<span class="dmg">※ 逃跑失败！</span>`);
}

/* ============================================================
   敌方回合
   ============================================================ */
function chooseEnemyAction(B, e) {
  const warning = B.def.telegraph;
  if (warning && warning.enemy === e.ref && !isSealed(e)) {
    e.storyActs = (e.storyActs || 0) + 1;
    if (!e.charging && e.storyActs % warning.every === 0) {
      e.charging = warning.skill;
      addLog(B, `预警：${e.name} 下次行动将施放【${ENEMY_SKILLS[warning.skill].name}】！`);
      addFloat(B, '蓄力中！', e.x, e.y - 145, '#ffe14d', 28);
      return;
    }
    if (e.charging && B.def.support && B.game.flags?.northAid && !B.supportUsed.north) {
      B.supportUsed.north = true;
      e.charging = null;
      addLog(B, '北境灯塔照亮核心，打断了这次蓄力！');
      return;
    }
  }
  // 阶段转换（Boss 半血狂暴）
  if (e.boss && e.phase === 1 && e.hp / e.maxHp <= 0.5) {
    e.phase = 2;
    e.buffs.atk = 1.35;
    e.atk = Math.floor(e.atk * 1.08);
    addLog(B, `<span class="hl">※ ${e.name} 的气息变了——进入第二形态！</span>`);
    addFloat(B, '形态转换！', e.x, e.y - 150 * e.scale, '#ff2a3c', 30);
    flash(B, 0.7); shake(B, 18);
    B.enemyActs.push(1);
    return;
  }
  const pool = isSealed(e) ? [{ id: 'atk', w: 1 }] : e.charging ? [{ id: e.charging, w: 1 }] :
    (e.skills || [{ id: 'atk', w: 1 }]).filter(p => !warning || e.ref !== warning.enemy || p.id !== warning.skill);
  if (!isSealed(e)) e.charging = null;
  if (isSealed(e)) addLog(B, `${e.name} 被封印了，只能挥出普通一击。`);
  const total = pool.reduce((s, x) => s + x.w, 0);
  let r = Math.random() * total, pick = pool[0];
  for (const p of pool) { r -= p.w; if (r <= 0) { pick = p; break; } }
  const spec = ENEMY_SKILLS[pick.id] || ENEMY_SKILLS.atk;

  // 目标选择
  let targets;
  if (spec.target === 'all') targets = B.party.filter(m => !m.dead);
  else if (spec.target === 'selfside' || spec.target === 'self') targets = [e];
  else {
    const alive = B.party.filter(m => !m.dead);
    if (!alive.length) return;
    // 40% 概率打血量最低的
    targets = [chance(0.4) ? alive.slice().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0] : alive[Math.floor(Math.random() * alive.length)]];
  }
  targets = targets.filter(t => t && !t.dead);
  if (!targets.length) return;

  if (spec.buff) { applyBuff(B, spec.buff, [e]); B.enemyActs.push(0); return; }
  if (!spec.power) { addLog(B, `${e.name} 使用了 ${spec.name}。`); B.enemyActs.push(0); return; }

  // 敌人攻击（格挡/弹反在 doHit 里按概率判定，不再需要玩家按键）
  const saveTargets = targets.slice();
  B.ui.queue.push({
    dur: 0.85,
    start() {
      addLog(B, `<span class="dmg">${e.name}</span> 使用了 <span class="hl">${spec.name}</span>！`);
      e.pose = 'ready'; e.atkP = 0;
    },
    tick(k) { e.atkP = clamp(k / 0.62, 0, 1); },
    resolve() {
      const act = runSkill(B, e, spec.id, saveTargets.filter(t => t && !t.dead), {});
      if (act) B.ui.queue.push(act);
    },
  });
  B.enemyActs.push(1);
}

/* ============================================================
   胜负判定
   ============================================================ */
export function canObjective(B, m) {
  const o = B.objective;
  if (!o || !m || m.dead || isSealed(m) || o.completed.includes(m.id)) return false;
  if (o.type === 'purify') return m.id === o.actor && B.enemies.filter(e => o.targets.includes(e.ref)).every(e => e.dead);
  if (o.type === 'seal') return o.actors.includes(m.id) && B.enemies.every(e => e.dead);
  return false;
}

export function objectiveText(B) {
  const o = B.objective;
  if (!o) return '';
  if (o.type === 'rescue') return `装船进度 ${Math.min(o.progress, o.steps)}/${o.steps} · 也可击退全部追兵`;
  if (o.type === 'purify') return `咒缚根剩余 ${B.enemies.filter(e => o.targets.includes(e.ref) && !e.dead).length} · 断根后由苍选择净化`;
  return B.enemies.some(e => !e.dead) ? '目标：击破核心；随后由璃和苍选择封门' :
    `封门进度 ${o.completed.length}/${o.actors.length} · 等待${o.actors.filter(id => !o.completed.includes(id)).map(id => ACTORS[id].name).join('、')}`;
}

export function checkBattleEnd(B) {
  if (B.over) return;
  const aliveP = B.party.filter(m => !m.dead);
  const aliveE = B.enemies.filter(e => !e.dead);
  // 核心破坏后没有敌人，必须唤醒术式执行者，避免缺少复活道具时永远无法封门。
  if (B.objective?.type === 'seal' && !aliveE.length && aliveP.length && !B.coreOpened) {
    B.coreOpened = true;
    for (const m of B.party) {
      if (m.dead) { m.dead = false; m.hp = Math.max(1, Math.floor(m.maxHp * 0.25)); m.pose = 'idle'; }
      m.status = [];
      m.buffs = { atk: 1, def: 1, spd: 1 };
    }
    addLog(B, '核心破坏，压制解除。同伴恢复行动，轮到璃和苍时选择【封门】。');
  }
  if (B.def.support && B.game.flags?.harborAid && !B.supportUsed.harbor && aliveP.length && B.enemies.some(e => e.hp <= e.maxHp / 2)) {
    B.supportUsed.harbor = true;
    for (const m of aliveP) {
      m.hp = Math.min(m.maxHp, m.hp + Math.floor(m.maxHp * 0.35));
      if (m.resource !== 'rage') m.mp = Math.min(m.maxMp, m.mp + Math.floor(m.maxMp * 0.3));
    }
    addLog(B, '港町船队送来补给：全队恢复 35% 生命和 30% 术力。');
  }
  const obj = B.objective;
  const won = !obj ? !aliveE.length : obj.type === 'rescue' ? (!aliveE.length || obj.progress >= obj.steps) :
    obj.type === 'purify' ? obj.completed.includes(obj.actor) :
    !aliveE.length && obj.actors.every(id => obj.completed.includes(id));
  if (won && aliveP.length) {
    B.over = true; B.result = 'win';
    B.ui.queue.push({ dur: 1.0, start() { flash(B, .55); addLog(B, `<span class="hl">※ 战斗胜利！</span>`); }, tick() { }, resolve() { } });
    B.ui.queue.push({ dur: 0.05, start() { }, tick() { }, resolve() { onWin(B); } });
  } else if (!aliveP.length) {
    B.over = true; B.result = 'lose';
    B.ui.queue.push({ dur: 1.0, start() { addLog(B, `<span class="dmg">※ 全员倒下了……</span>`); }, tick() { }, resolve() { } });
    B.ui.queue.push({ dur: 0.05, start() { }, tick() { }, resolve() { B.game.onBattleLose(B); } });
  } else if (B.escaped) {
    B.over = true; B.result = 'escape';
    B.ui.queue.push({ dur: 0.4, start() { }, tick() { }, resolve() { B.game.onBattleEscape(B); } });
  }
}

function onWin(B) {
  const exp = B.enemies.reduce((s, e) => s + e.exp, 0);
  const gold = B.enemies.reduce((s, e) => s + e.gold, 0);
  addLog(B, `<span class="hl">※ 获得 ${exp} 点经验、${gold} 金币。</span>`);
  B.game.onBattleWin(B, exp, gold);
}

/* ============================================================
   更新
   ============================================================ */
export function updateBattle(B, dt, input) {
  B.t += dt;
  if (B.hitstop > 0) { B.hitstop -= dt; if (B.hitstop < 0) B.hitstop = 0; dt *= 0.12; }

  // 奥义演出
  if (B.cutin) {
    B.cutin.life += dt / Math.max(0.34, BATTLE_SPEED / 0.68);
    if (B.cutin.life >= B.cutin.dur) {
      const c = B.cutin; B.cutin = null; c.after && c.after();
    }
  }

  // 队列推进
  const cur = B.ui.queue[0];
  if (cur) {
    if (!cur._started) {
      cur._started = true;
      if (cur.dur > 0.08) cur.dur *= BATTLE_SPEED;
      cur.start && cur.start();
    }
    cur._t = (cur._t || 0) + dt;
    const k = clamp(cur._t / cur.dur, 0, 1);
    cur.tick && cur.tick(k);
    if (k >= 1) {
      B.ui.queue.shift();
      cur.resolve && cur.resolve();
      cleanupDead(B);
    }
  } else if (!B.over && !B.cutin) {
    // 需要玩家输入
    if (B.ui.mode === 'wait') {
      B.game.requestPlayerTurn(B);
      B.ui.mode = 'input';
    }
  }

  // 特效
  for (const f of B.fx) f.life += dt;
  B.fx = B.fx.filter(f => f.life < f.dur);
  for (const f of B.floats) f.life += dt;
  B.floats = B.floats.filter(f => f.life < f.dur);

  // 受击恢复
  for (const u of [...B.enemies, ...B.party]) {
    if (u.hurtP !== null && u.hurtP !== undefined) { u.hurtP += dt * 3.2; if (u.hurtP > 1) u.hurtP = null; }
    if (u.dead && u.dying < 1) u.dying = Math.min(1, u.dying + dt * 2);
    if (!u.dead && u.pose === 'strike' && !u.atkP) u.pose = 'idle';
  }

  B.shake *= Math.pow(0.02, dt);
  if (B.shake < 0.4) B.shake = 0;
  B.flash *= Math.pow(0.0008, dt);
  if (B.flash < 0.01) B.flash = 0;

  checkBattleEnd(B);
}

function cleanupDead(B) {
  // 死亡的敌人保留在场上（作为尸体），不再行动
}

/* ============================================================
   绘制
   ============================================================ */
export function drawBattle(B, ctx, W, H) {
  const t = B.t;
  ctx.save();
  if (B.shake > 0.4) ctx.translate(rnd(-B.shake, B.shake), rnd(-B.shake, B.shake));

  /* 背景 */
  SP.drawBackground(ctx, B.bg, W, H, t, { pan: 0 });
  if (B.objective || B.enemies.some(e => e.charging && !e.dead)) {
    ctx.save();
    ctx.fillStyle = 'rgba(8,6,20,.85)'; ctx.fillRect(120, 76, 720, 48);
    ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffe2a0';
    ctx.fillText(objectiveText(B), 480, 94);
    const warning = B.enemies.filter(e => e.charging && !e.dead).map(e => `${e.name} 下次行动：${ENEMY_SKILLS[e.charging].name}`).join(' / ');
    ctx.fillStyle = '#ff9d9d'; ctx.fillText(warning, 480, 114);
    ctx.restore();
  }

  /* 战斗地面光 */
  const gg = ctx.createRadialGradient(W / 2, H - 60, 40, W / 2, H - 60, 460);
  gg.addColorStop(0, 'rgba(255,150,60,.14)');
  gg.addColorStop(1, 'rgba(255,90,0,0)');
  ctx.fillStyle = gg;
  ctx.fillRect(0, H - 220, W, 220);

  /* 敌人 */
  const sorted = [...B.enemies].sort((a, b) => a.y - b.y);
  for (const e of sorted) {
    ctx.save();
    if (e.dead) ctx.globalAlpha = Math.max(0, 1 - e.dying * 0.75);
    const pose = e.dead ? 'dead' : (e.pose || 'idle');
    SP.drawEnemy(ctx, e.shape, e.def, e.x, e.y, e.scale, t, pose, { attackP: e.atkP, hurtP: e.hurtP });
    ctx.restore();
  }

  /* 我方 */
  for (const m of B.party) {
    if (m.dead && m.dying >= 1) {
      // 倒地后仍然画（淡出）
      ctx.save(); ctx.globalAlpha = 0.4;
      SP.drawHumanoid(ctx, m.x, m.y, 0.72, t, 'dead', { ...ACTORS[m.id], weaponGlow: ultGlow(m) });
      ctx.restore();
      continue;
    }
    ctx.save();
    if (m.dead) ctx.globalAlpha = Math.max(0.25, 1 - m.dying * 0.6);
    const glow = ultGlow(m);
    const pose = m.dead ? 'dead' : (m.pose || 'idle');
    if (m.guardStance && !m.dead) {
      // 防御盾
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const sg = ctx.createRadialGradient(m.x, m.y - 70, 20, m.x, m.y - 70, 78);
      sg.addColorStop(0, 'rgba(120,200,255,0)');
      sg.addColorStop(.75, 'rgba(120,200,255,.32)');
      sg.addColorStop(1, 'rgba(120,200,255,0)');
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.arc(m.x, m.y - 70, 78, 0, TAU); ctx.fill();
      ctx.restore();
    }
    const at = ACTORS[m.id];
    SP.drawHumanoid(ctx, m.x, m.y, 0.84, t, pose, {
      hair: at.hair || hairOf(m.id), cloth: at.cloth || clothOf(m.id), trim: at.trim || trimOf(m.id),
      skin: at.skin || '#ffe0c8', eye: at.eye || eyeOf(m.id), weapon: at.weapon || weaponOf(m.id),
      attackP: m.atkP, hurtP: m.hurtP, weaponGlow: glow,
      cape: m.id === 'ryze' ? '#2a2050' : null,
    });
    ctx.restore();
    // 状态图标
    drawStatusIcons(ctx, m, t);
  }
  for (const e of B.enemies) if (!e.dead) drawStatusIcons(ctx, e, t);

  /* 敌方血条 */
  B.enemies.forEach((e, i) => {
    if (e.dead) return;
    drawEnemyBar(ctx, e, W, i);
  });

  /* 特效 */
  for (const f of B.fx) {
    const k = f.life / f.dur;
    switch (f.kind) {
      case 'slash': SP.drawSlash(ctx, f.x, f.y, f.rx || 78, k, f.ang || 0, f.col); break;
      case 'burst': SP.drawBurst(ctx, f.x, f.y, f.r || 60, k, f.col, f.n || 12); break;
      case 'heal': SP.drawHeal(ctx, f.x, f.y, k, f.col); break;
      case 'thunder': SP.drawThunder(ctx, f.x, f.y, k, f.col); break;
      case 'ice': SP.drawIce(ctx, f.x, f.y, k, f.col); break;
      case 'meteor': SP.drawMeteor(ctx, f.x, f.y, k, f.col, W, H); break;
      case 'guard': SP.drawGuardSpark(ctx, f.x, f.y, k, f.perfect); break;
      case 'aura': {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = Math.sin(k * Math.PI) * .8;
        const rg = ctx.createRadialGradient(f.x, f.y + 20, 4, f.x, f.y + 20, f.r * (0.5 + k));
        rg.addColorStop(0, f.col); rg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = rg;
        ctx.beginPath(); ctx.arc(f.x, f.y + 20, f.r * (0.5 + k), 0, TAU); ctx.fill();
        ctx.restore();
        break;
      }
      case 'pierce': {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = f.col; ctx.lineWidth = 8 * (1 - k);
        ctx.shadowColor = f.col; ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.moveTo(f.x - 160 + k * 120, f.y + 40);
        ctx.lineTo(f.x + 60 + k * 20, f.y - 20);
        ctx.stroke();
        ctx.restore();
        break;
      }
      case 'fire': {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const n = f.big ? 16 : 9, spread = f.big ? 110 : 60;
        for (let i = 0; i < n; i++) {
          const a = i / n * TAU + k * 2;
          const rr = 30 + k * spread;
          ctx.globalAlpha = (1 - k) * .7;
          const R = f.big ? 38 : 26;
          const fg = ctx.createRadialGradient(f.x + Math.cos(a) * rr, f.y + Math.sin(a) * rr * .5, 0, f.x + Math.cos(a) * rr, f.y + Math.sin(a) * rr * .5, R);
          fg.addColorStop(0, '#fff2b0'); fg.addColorStop(.4, f.col); fg.addColorStop(1, 'rgba(200,0,0,0)');
          ctx.fillStyle = fg;
          ctx.beginPath(); ctx.arc(f.x + Math.cos(a) * rr, f.y + Math.sin(a) * rr * .5, R, 0, TAU); ctx.fill();
        }
        ctx.restore();
        break;
      }

      /* ---- 以下是为「让特效对得上技能描述」新增的演出 ---- */

      // 千鸟突：雷光沿直线贯穿，落点炸开
      case 'bolt': {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = f.col; ctx.shadowColor = f.col; ctx.shadowBlur = 28;
        for (let s2 = 0; s2 < 3; s2++) {
          ctx.lineWidth = (7 - s2 * 2) * (1 - k * .6);
          ctx.beginPath();
          let px = f.x - 260, py = f.y - 130 + s2 * 8;
          ctx.moveTo(px, py);
          for (let i = 1; i <= 8; i++) {
            px = f.x - 260 + (260 * i / 8) * Math.min(1, k * 2.4);
            py = f.y - 130 + (130 * i / 8) + Math.sin(i * 2.2 + s2) * 22 * (1 - k);
            ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
        ctx.restore();
        break;
      }

      // 连斩：一组按时间错开的刀光，段数越多越密
      case 'flurry': {
        const cnt = f.n || 3;
        for (let i = 0; i < cnt; i++) {
          const kk = clamp(k * cnt - i, 0, 1);
          if (kk <= 0 || kk >= 1) continue;
          SP.drawSlash(ctx, f.x + Math.sin(i * 2.1) * 26, f.y + Math.cos(i * 1.7) * 20,
            (f.rx || 76) * (0.8 + i * 0.08), kk, (i % 2 ? 1 : -1) * (0.5 + i * 0.22), f.col);
        }
        break;
      }

      // 绝对零度 / 暴雪：全屏降温 + 冰晶生成
      case 'frostfield': {
        ctx.save();
        ctx.globalAlpha = Math.sin(k * Math.PI) * .35;
        ctx.fillStyle = f.col; ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = Math.sin(k * Math.PI) * .9;
        for (let i = 0; i < 26; i++) {
          const a = (i * 137.5) * Math.PI / 180;
          const rr = (i / 26) * 420 * (0.3 + k);
          const x = W / 2 + Math.cos(a) * rr, y = H / 2 + Math.sin(a) * rr * .55;
          const sz = 6 + (i % 4) * 4;
          ctx.strokeStyle = '#e8ffff'; ctx.lineWidth = 2;
          ctx.beginPath();
          for (let b = 0; b < 6; b++) {
            const ba = b / 6 * TAU + k * 1.4;
            ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(ba) * sz, y + Math.sin(ba) * sz);
          }
          ctx.stroke();
        }
        ctx.restore();
        break;
      }

      // 狮子奋迅：脚下炎环 + 上升的火柱，表示「斗气爆发」
      case 'blaze': {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = (1 - k) * .95;
        const rr = 40 + k * 70;
        ctx.strokeStyle = f.col; ctx.lineWidth = 9 * (1 - k); ctx.shadowColor = f.col; ctx.shadowBlur = 26;
        ctx.beginPath(); ctx.ellipse(f.x, f.y + 46, rr, rr * .34, 0, 0, TAU); ctx.stroke();
        for (let i = 0; i < 12; i++) {
          const a = i / 12 * TAU;
          const px = f.x + Math.cos(a) * rr * .8;
          const h = 90 * (1 - k) * (0.5 + (i % 3) * 0.25);
          const g2 = ctx.createLinearGradient(px, f.y + 46, px, f.y + 46 - h);
          g2.addColorStop(0, f.col); g2.addColorStop(1, 'rgba(255,240,160,0)');
          ctx.fillStyle = g2;
          ctx.fillRect(px - 7, f.y + 46 - h, 14, h);
        }
        ctx.restore();
        break;
      }

      // 圣光审判：自上而下的光柱
      case 'holybeam': {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = Math.sin(k * Math.PI) * .95;
        const w = 70 * (1 - k * 0.4);
        const g3 = ctx.createLinearGradient(f.x, 0, f.x, f.y + 40);
        g3.addColorStop(0, 'rgba(255,255,255,0)');
        g3.addColorStop(.45, f.col);
        g3.addColorStop(1, '#ffffff');
        ctx.fillStyle = g3;
        ctx.fillRect(f.x - w / 2, 0, w, f.y + 40);
        ctx.globalAlpha = (1 - k) * .8;
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(f.x, f.y + 40, w * (0.6 + k), w * (0.2 + k * 0.1), 0, 0, TAU); ctx.stroke();
        ctx.restore();
        break;
      }

      // 暗影：向内收缩的黑雾环
      case 'shadow': {
        ctx.save(); ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = Math.sin(k * Math.PI) * .8;
        for (let i = 0; i < 10; i++) {
          const a = i / 10 * TAU + k * 3;
          const rr = (1 - k) * 120 + 16;
          const x = f.x + Math.cos(a) * rr, y = f.y + Math.sin(a) * rr * .6;
          const g4 = ctx.createRadialGradient(x, y, 0, x, y, 34);
          g4.addColorStop(0, f.col); g4.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g4;
          ctx.beginPath(); ctx.arc(x, y, 34, 0, TAU); ctx.fill();
        }
        ctx.restore();
        break;
      }

      // 连携技：两道交叉的巨大刀光 + 冲击环
      case 'combo': {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = (1 - k);
        ctx.strokeStyle = f.col; ctx.lineWidth = 16 * (1 - k); ctx.shadowColor = f.col; ctx.shadowBlur = 34;
        ctx.beginPath(); ctx.ellipse(f.x, f.y, 150 * (0.4 + k), 44 * (0.4 + k), -0.7, 0, TAU); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(f.x, f.y, 150 * (0.4 + k), 44 * (0.4 + k), 0.7, 0, TAU); ctx.stroke();
        ctx.lineWidth = 5 * (1 - k);
        ctx.strokeStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(f.x, f.y, 60 + k * 190, 0, TAU); ctx.stroke();
        ctx.restore();
        break;
      }
    }
  }

  /* 飘字 */
  for (const f of B.floats) {
    const k = f.life / f.dur;
    if (f.kind === 'text') SP.drawFloatText(ctx, f.txt, f.x, f.y, k, f.col, f.size, f.crit);
    else {
      ctx.save();
      ctx.globalAlpha = k > .7 ? 1 - (k - .7) / .3 : 1;
      ctx.font = '700 16px "Noto Sans SC",system-ui,sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(10,4,10,.92)';
      ctx.strokeText(f.txt, f.x, f.y - k * 42);
      ctx.fillStyle = f.col;
      ctx.fillText(f.txt, f.x, f.y - k * 42);
      ctx.restore();
    }
  }

  /* 玩家 HUD 血条 */
  drawPartyHUD(ctx, B, t);

  /* 行动数 */
  ctx.save();
  ctx.font = '700 13px "Noto Sans SC",system-ui,sans-serif';
  ctx.fillStyle = 'rgba(255,220,170,.75)';
  ctx.textAlign = 'right';
  ctx.fillText(`行动 ${B.turn}`, W - 14, 132);
  ctx.restore();

  drawTurnOrder(ctx, B, W);

  /* 白闪 */
  if (B.flash > 0.01) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = B.flash;
    ctx.fillStyle = '#fff';
    ctx.fillRect(-40, -40, W + 80, H + 80);
    ctx.restore();
  }

  /* 奥义速度线 */
  if (B.cutin) {
    SP.drawSpeedLines(ctx, W, H, t, .45 * Math.min(1, B.cutin.life * 4));
  }

  /* 敌方首领血条（普通敌人血条已画在其头顶） */
  const boss = B.enemies.find(e => e.boss && !e.dead);
  if (boss) drawBossBar(ctx, boss, W);

  ctx.restore();
}

/* 出手顺序预览：左边是下一个行动的单位 */
function drawTurnOrder(ctx, B, W) {
  if (B.over) return;
  const order = forecastOrder(B, 8);
  if (!order.length) return;
  const S = 30, GAP = 5, X0 = 14, Y0 = 96;
  ctx.save();
  ctx.font = '700 11px "Noto Sans SC",system-ui,sans-serif';
  ctx.fillStyle = 'rgba(255,220,170,.7)';
  ctx.textAlign = 'left';
  ctx.fillText('出手顺序 →', X0, Y0 - 6);
  order.forEach((u, i) => {
    const x = X0 + 74 + i * (S + GAP), y = Y0 - S + 4;
    const sz = i === 0 ? S + 4 : S;
    const yy = i === 0 ? y - 2 : y;
    ctx.globalAlpha = i === 0 ? 1 : Math.max(0.35, 1 - i * 0.1);
    ctx.fillStyle = u.isEnemy ? 'rgba(90,16,30,.9)' : 'rgba(22,30,70,.9)';
    SP.util.rrect(ctx, x, yy, sz, sz, 5); ctx.fill();
    ctx.strokeStyle = i === 0 ? 'rgba(255,215,106,.95)' : (u.isEnemy ? 'rgba(255,90,110,.55)' : 'rgba(120,200,255,.55)');
    ctx.lineWidth = i === 0 ? 2 : 1;
    SP.util.rrect(ctx, x, yy, sz, sz, 5); ctx.stroke();
    ctx.fillStyle = u.isEnemy ? '#ffb0b0' : '#cfe4ff';
    ctx.font = `800 ${i === 0 ? 15 : 13}px "Noto Sans SC",system-ui,sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText((u.name || '?').slice(0, 1), x + sz / 2, yy + sz / 2 + 5);
    ctx.textAlign = 'left';
  });
  ctx.restore();
}

function ultGlow(m) {
  if (canUlt(m)) return '#ffd76a';
  if (resourceRatio(m) >= 0.6) return '#ff8a1a';
  return null;
}

const APPEAR = {
  kaito: { hair: '#2b2340', cloth: '#1d2a4a', trim: '#c8332f', eye: '#ff8a1a', weapon: 'sword' },
  cang: { hair: '#7d5fd8', cloth: '#efeaf8', trim: '#6a4fc0', eye: '#57e0ff', weapon: 'staff' },
  lei: { hair: '#3a3a48', cloth: '#2e3a52', trim: '#c8332f', eye: '#9be25a', weapon: 'spear' },
  ryze: { hair: '#d8d2ee', cloth: '#2a2050', trim: '#c9a8ff', eye: '#c9a8ff', weapon: 'sword' },
  zain: { hair: '#12101e', cloth: '#1a0f22', trim: '#8f1226', eye: '#ff3b4e', weapon: 'twin' },
  baixue: { hair: '#eaf4ff', cloth: '#1c3a5c', trim: '#dceaf8', eye: '#8fe6ff', weapon: 'staff' },
};
function hairOf(id) { return APPEAR[id]?.hair || '#2b2340'; }
function clothOf(id) { return APPEAR[id]?.cloth || '#1d2a4a'; }
function trimOf(id) { return APPEAR[id]?.trim || '#c8332f'; }
function eyeOf(id) { return APPEAR[id]?.eye || '#ff8a1a'; }
function weaponOf(id) { return APPEAR[id]?.weapon || 'sword'; }

function drawStatusIcons(ctx, u, t) {
  if (!u.status || !u.status.length) return;
  ctx.save();
  ctx.font = '700 13px "Noto Sans SC",system-ui,sans-serif';
  ctx.textAlign = 'center';
  let x = u.x - (u.status.length - 1) * 9;
  for (const s of u.status) {
    const st = STATUS[s.id];
    if (!st) continue;
    ctx.fillStyle = st.bad ? 'rgba(120,10,40,.85)' : 'rgba(10,60,90,.85)';
    ctx.strokeStyle = st.bad ? '#ff6b8a' : '#8fe6ff';
    ctx.lineWidth = 1.4;
    const y = u.y - (u.shape ? 118 * u.scale : 196);
    ctx.beginPath(); ctx.arc(x, y, 8, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = st.bad ? '#ffd0dc' : '#d8f4ff';
    ctx.fillText(st.icon, x, y + 4.5);
    x += 18;
  }
  ctx.restore();
}

function drawEnemyBar(ctx, e, W, i) {
  const w = 118, h = 8;
  const x = e.x - w / 2, y = 46 + (i % 2) * 0;
  // 名字
  ctx.save();
  ctx.font = '700 12.5px "Noto Sans SC",system-ui,sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,225,190,.9)';
  ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(10,4,10,.9)';
  ctx.strokeText(`${e.name} Lv.${e.level}`, e.x, y - 6);
  ctx.fillText(`${e.name} Lv.${e.level}`, e.x, y - 6);
  ctx.fillStyle = 'rgba(20,10,26,.85)';
  SP.util.rrect(ctx, x, y, w, h, 4); ctx.fill();
  const p = clamp(e.hp / e.maxHp, 0, 1);
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  if (e.boss) { g.addColorStop(0, '#ff2a3c'); g.addColorStop(1, '#ffb43d'); }
  else { g.addColorStop(0, '#ff5566'); g.addColorStop(1, '#ff9a5c'); }
  ctx.fillStyle = g;
  SP.util.rrect(ctx, x + 1, y + 1, (w - 2) * p, h - 2, 3); ctx.fill();
  ctx.strokeStyle = 'rgba(255,180,120,.5)'; ctx.lineWidth = 1;
  SP.util.rrect(ctx, x, y, w, h, 4); ctx.stroke();
  ctx.restore();
}

function drawPartyHUD(ctx, B, t) {
  const list = B.party;
  const X = 14, Y = 150, CW = 168, CH = 62, GAP = 6;
  list.forEach((m, i) => {
    const x = X, y = Y + i * (CH + GAP);
    ctx.save();
    // 面板
    const bg = ctx.createLinearGradient(x, y, x + CW, y);
    bg.addColorStop(0, m.dead ? 'rgba(50,20,30,.82)' : 'rgba(12,10,26,.86)');
    bg.addColorStop(1, 'rgba(12,10,26,.35)');
    ctx.fillStyle = bg;
    SP.util.rrect(ctx, x, y, CW, CH, 6); ctx.fill();
    const ready = canUlt(m) && !m.dead;
    const isRage = m.resource === 'rage';
    ctx.strokeStyle = ready ? 'rgba(255,215,106,.95)' : (B.active === m ? 'rgba(255,240,200,.8)' : 'rgba(255,160,70,.38)');
    ctx.lineWidth = ready || B.active === m ? 2 : 1.2;
    SP.util.rrect(ctx, x, y, CW, CH, 6); ctx.stroke();

    // 名字
    ctx.font = '800 15px "Noto Sans SC",system-ui,sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = m.dead ? '#8a8098' : (ready ? '#ffd76a' : '#ffe9cf');
    ctx.fillText(m.name, x + 9, y + 19);
    ctx.font = '600 10.5px "Noto Sans SC",system-ui,sans-serif';
    ctx.fillStyle = 'rgba(200,190,230,.85)';
    ctx.fillText(`Lv.${m.level}`, x + 42, y + 19);
    if (m.dead) { ctx.fillStyle = '#ff8098'; ctx.fillText('倒下', x + 74, y + 19); }
    if (ready) {
      ctx.fillStyle = '#ffd76a';
      ctx.font = '800 11px "Noto Sans SC",system-ui,sans-serif';
      ctx.fillText('★奥义可用', x + 100, y + 19);
    }

    // HP
    const bw = CW - 18;
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    SP.util.rrect(ctx, x + 9, y + 25, bw, 8, 4); ctx.fill();
    const hp = clamp(m.hp / m.maxHp, 0, 1);
    const hg = ctx.createLinearGradient(x + 9, 0, x + 9 + bw, 0);
    hg.addColorStop(0, hp < .3 ? '#ff2a4a' : '#ff5f6d'); hg.addColorStop(1, hp < .3 ? '#ff7a5c' : '#ffb35c');
    ctx.fillStyle = hg;
    SP.util.rrect(ctx, x + 9, y + 25, bw * hp, 8, 4); ctx.fill();
    ctx.font = '600 9.5px system-ui';
    ctx.fillStyle = '#fff';
    ctx.fillText(`${Math.ceil(m.hp)}/${m.maxHp}`, x + 11, y + 32.5);

    // 资源条（术力=蓝 / 愤怒=橙红）
    const res = resourceRatio(m);
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    SP.util.rrect(ctx, x + 9, y + 38, bw, 9, 4.5); ctx.fill();
    const rg = ctx.createLinearGradient(x + 9, 0, x + 9 + bw, 0);
    if (isRage) { rg.addColorStop(0, '#ff4a1a'); rg.addColorStop(1, '#ffd76a'); }
    else { rg.addColorStop(0, '#2a7ad8'); rg.addColorStop(1, '#6fd8ff'); }
    ctx.fillStyle = rg;
    SP.util.rrect(ctx, x + 9, y + 38, bw * res, 9, 4.5); ctx.fill();
    if (ready) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = .3 + .28 * Math.sin(t * 8);
      ctx.fillStyle = '#ffd76a';
      SP.util.rrect(ctx, x + 9, y + 38, bw, 9, 4.5); ctx.fill();
      ctx.restore();
    }
    ctx.font = '700 9px "Noto Sans SC",system-ui,sans-serif';
    ctx.fillStyle = isRage ? 'rgba(255,220,170,.95)' : 'rgba(200,235,255,.95)';
    ctx.fillText(isRage ? '怒' : '术', x + 11, y + 45.5);
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.ceil(m.mp)}/${m.maxMp}`, x + 9 + bw - 3, y + 45.5);
    ctx.textAlign = 'left';

    // 状态
    if (m.status.length) {
      let sx = x + CW - 14;
      ctx.font = '700 11px system-ui';
      ctx.textAlign = 'center';
      for (const s of m.status.slice(-3)) {
        const st = STATUS[s.id];
        ctx.fillStyle = st.bad ? '#ff7a9a' : '#8fe6ff';
        ctx.fillText(st.icon, sx, y + 31);
        sx -= 13;
      }
    }
    ctx.restore();
  });
}

function drawBossBar(ctx, boss, W) {
  const w = 470, h = 16, x = (W - w) / 2, y = H_BAR_Y;
  ctx.save();
  ctx.font = '800 15px "Noto Sans SC",system-ui,sans-serif';
  ctx.textAlign = 'center';
  ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(10,4,10,.95)';
  ctx.strokeText(boss.name, W / 2, y - 8);
  const grad = ctx.createLinearGradient(W / 2 - 100, 0, W / 2 + 100, 0);
  grad.addColorStop(0, '#ffd76a'); grad.addColorStop(.5, '#ff9a5c'); grad.addColorStop(1, '#ffd76a');
  ctx.fillStyle = grad;
  ctx.fillText(boss.name, W / 2, y - 8);

  ctx.fillStyle = 'rgba(20,4,12,.88)';
  SP.util.rrect(ctx, x, y, w, h, 5); ctx.fill();
  const p = clamp(boss.hp / boss.maxHp, 0, 1);
  const bg = ctx.createLinearGradient(x, 0, x + w, 0);
  bg.addColorStop(0, '#8f0f22'); bg.addColorStop(.5, '#ff2a3c'); bg.addColorStop(1, '#ff8a1a');
  ctx.fillStyle = bg;
  SP.util.rrect(ctx, x + 2, y + 2, (w - 4) * p, h - 4, 4); ctx.fill();
  if (boss.phase === 2) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = .3 + .3 * Math.sin(Date.now() / 120);
    ctx.fillStyle = '#ff2a3c';
    SP.util.rrect(ctx, x, y, w, h, 5); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffd0d8';
    ctx.font = '700 11px "Noto Sans SC",system-ui,sans-serif';
    ctx.fillText('— 第二形态 —', W / 2, y + h + 14);
  }
  ctx.strokeStyle = 'rgba(255,200,120,.7)'; ctx.lineWidth = 1.6;
  SP.util.rrect(ctx, x, y, w, h, 5); ctx.stroke();
  ctx.restore();
}

/* 战斗日志（HTML） */
export function battleLogHTML(B) {
  return B.log.map(l => `<div class="${l.cls}">${l.txt}</div>`).join('');
}

export default { createBattle, updateBattle, drawBattle, beginNextTurn, takePlayerAction, forecastOrder, battleLogHTML, gainRage, canUlt, resourceRatio, isSealed, shiftGauge, computeDamage, checkBattleEnd };
