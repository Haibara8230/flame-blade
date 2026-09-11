/* ============================================================
   battle.js — 回合制战斗系统
   特色：热血槽 / 奥义演出 / 格挡弹反 / 连击多段 / 属性弱点
   ============================================================ */
import { ACTORS, SKILLS, ENEMIES, ENEMY_SKILLS, EQUIPS, ITEMS, STATUS, statsAt } from './characters.js';
import * as SP from './sprites.js';

const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const chance = p => Math.random() < p;

const H_BAR_Y = 30;

/* 战斗节奏倍率：越小越快（影响所有动作时长） */
export const BATTLE_SPEED = 0.68;

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
    cmd: null, ui: { mode: 'wait', queue: [] },
    time: 0, message: null, introT: stage.introLines ? 1 : 0,
    t: 0, turn: 1, escapes: 0,
  };

  // 敌人实例
  const n = def.enemies.length;
  const row = n <= 1 ? 1 : 0;
  B.enemies = def.enemies.map((e, i) => {
    const d = ENEMIES[e.ref];
    const lv = e.level;
    const k = lv - 1;
    const pos = ENEMY_POS[row][i] || ENEMY_POS[row][ENEMY_POS[row].length - 1];
    const scale = enemyScale(d) * (1 + k * 0.028);
    // 最终决战的首领不随等级过度膨胀，避免变成消耗战
    const hpK = (d.boss && lv >= 18) ? 0.035 : 0.075;
    const maxHp = Math.floor(d.hp * (1 + k * hpK));
    return {
      i, ref: d.id, def: d, name: d.name, shape: d.shape, palette: d.palette,
      level: lv, maxHp, hp: maxHp,
      atk: Math.floor(d.atk * (1 + k * 0.11)), defv: Math.floor(d.def * (1 + k * 0.10)),
      spd: d.spd + k, exp: Math.floor(d.exp * (1 + k * 0.22)), gold: Math.floor(d.gold * (1 + k * 0.2)),
      hot: d.hot || 10, boss: !!d.boss, skills: d.skills, quote: d.quote,
      scale, x: pos.x, y: pos.y, baseX: pos.x, baseY: pos.y,
      pose: 'idle', hurtP: null, atkP: null, dead: false, dying: 0,
      status: [], buffs: { atk: 1, def: 1 },
      phase: 1, said: false, offY: 0,
    };
  });

  // 我方实例（引用 game.party）
  B.party = game.party.map((m, i) => {
    const p = PARTY_POS[i] || PARTY_POS[3];
    return {
      ...m, i, x: p.x, y: p.y, baseX: p.x, baseY: p.y,
      pose: 'idle', hurtP: null, atkP: null, dying: 0,
      status: [], buffs: { atk: 1, def: 1 },
      defending: false, cmd: null, acted: false,
    };
  });
  B.byId = {};
  for (const m of B.party) B.byId[m.id] = m;

  addLog(B, `⚔ ${def.enemies.map(e => ENEMIES[e.ref].name).join('、')} 出现了！`);
  for (const e of B.enemies) if (e.quote && chance(0.7)) B.floats.push({ kind: 'quote', txt: e.quote, x: e.x, y: e.y - 110 * e.scale, life: 0, dur: 2.2, col: '#ff9a9a' });
  return B;
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
  amount = Math.max(1, Math.floor(amount));
  if (opt.drain && opt.from) {
    const heal = Math.floor(amount * opt.drain);
    opt.from.hp = Math.min(opt.from.maxHp, opt.from.hp + heal);
    addFloat(B, `+${heal}`, opt.from.x, opt.from.y - 120, '#7dffa8', 26);
  }
  target.hp = Math.max(0, target.hp - amount);
  const col = opt.col || (opt.crit ? '#ffe14d' : '#ff5566');
  addFloat(B, (opt.crit ? '会心 ' : '') + amount, target.x + rnd(-18, 18), target.y - 110, col, opt.crit ? 42 : 32, opt.crit);
  target.hurtP = 0;
  addFx(B, 'burst', target.x, target.y - 80, opt.col || '#ff8a1a', { dur: 0.42, r: 42 });
  shake(B, opt.crit ? 14 : 8);
  B.hitstop = opt.crit ? 0.09 : 0.05;
  if (target.hp <= 0) {
    target.dead = true; target.pose = 'dead'; target.dying = 0;
    addLog(B, `<span class="dmg">${target.name} 被击倒了！</span>`);
    if (opt.by) addHeat(B, opt.by, 6);
  }
  const out = amount;
  return out;
}

export function addHeat(B, unit, v) {
  if (!unit || unit.dead) return;
  if (unit.isEnemy) return;
  unit.hot = clamp(unit.hot + v, 0, 100);
  if (unit.hot >= 100) {
    unit.hot = 100;
    if (!unit.hotNotified) {
      unit.hotNotified = true;
      addLog(B, `<span class="hl">※ ${unit.name} 的热血已满！可以发动【奥义】！</span>`);
      addFloat(B, '热血全满！', unit.x, unit.y - 150, '#ffd76a', 26);
    }
  } else if (unit.hot < 100) { unit.hotNotified = false; }
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
  if (opt.pierceDef) defv = Math.floor(defv * (1 - opt.pierceDef));
  /* 平衡公式：普攻（power=1）约造成 (1.05×攻击 − 0.95×防御) 的伤害
     —— 保证一场战斗 3~6 回合，且高防敌人仍有明显减伤 */
  const base = (atk * power * 1.02) - defv * 0.9 + 44 * power;
  const lvl = atkUnit.level || 1;
  const dlv = defUnit.level || 1;
  const lvK = 1 + (lvl - dlv) * 0.02;
  const rand = rnd(0.94, 1.06);
  let dmg = base * lvK * rand;
  const criRate = (atkUnit.cri || 0.06) + (opt.criBonus || 0) + (atkUnit.isEnemy ? 0.03 : 0);
  const crit = chance(criRate);
  if (crit) dmg *= 1.72;
  // 属性克制
  if (opt.weak && opt.elem && opt.weak.includes(opt.elem)) { dmg *= 1.5; opt.isWeak = true; }
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
  if (!spec) return null;
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
      const r = computeDamage(B, atkUnit, tg, spec.power || 1, {
        elem, criBonus: spec.criBonus || 0, pierceDef: spec.pierceDef || 0,
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
      const isEnemy = atkUnit.isEnemy;
      // 玩家格挡减伤
      let guardMul = 1;
      if (isEnemy && tg.defending) guardMul = tg.guardPerfect ? 0 : 0.38;
      const finalDmg = Math.floor(r.dmg * (tg.defending ? guardMul : 1));

      damage(B, tg, finalDmg, { crit: r.crit, col: r.crit ? '#ffe14d' : (elemBonus ? elemColor(elem) : undefined), by: isEnemy ? null : atkUnit, from: spec.drain ? atkUnit : null, drain: spec.drain });

      // 命中特效
      const fxCol = elemColor(elem) === '#ffffff' ? (r.crit ? '#ffe14d' : '#ffffff') : elemColor(elem);
      switch (fxName) {
        case 'slash':
          addFx(B, 'slash', tg.x, tg.y - 88, fxCol, { dur: 0.34, ang: -0.6 + rnd(-.4, .4), rx: 78, ry: 66 });
          if (hits > 1 && h < hits - 1) addFx(B, 'slash', tg.x, tg.y - 88, '#ffffff', { dur: 0.3, ang: 0.7 + rnd(-.4, .4), rx: 70, ry: 60 });
          break;
        case 'pierce':
          addFx(B, 'pierce', tg.x, tg.y - 86, fxCol, { dur: 0.32 });
          break;
        case 'fire':
          addFx(B, 'burst', tg.x, tg.y - 80, '#ff6a1a', { dur: 0.6, r: 90, n: 14 });
          addFx(B, 'fire', tg.x, tg.y - 40, '#ff8a1a', { dur: 0.7 });
          break;
        case 'ice':
          addFx(B, 'ice', tg.x, tg.y - 80, '#8fe6ff', { dur: 0.65 });
          break;
        case 'thunder':
          addFx(B, 'thunder', tg.x, tg.y, '#ffe14d', { dur: 0.5 });
          addFx(B, 'burst', tg.x, tg.y - 80, '#ffe14d', { dur: 0.45, r: 70, n: 10 });
          break;
        default:
          addFx(B, 'burst', tg.x, tg.y - 80, fxCol, { dur: 0.45, r: 60 });
      }
      if (elemBonus) addFloat(B, '弱点！', tg.x, tg.y - 148, '#48d8ff', 24);

      // 附加状态
      const inf = spec.inflict || (spec.id === 'bite' ? null : null);
      if (inf && !tg.dead && chance(inf.chance ?? 0.4)) {
        applyStatus(B, tg, inf.id, inf.turns || STATUS[inf.id].turns);
      }
      // 玩家被击时的格挡视觉
      if (isEnemy && tg.defending) {
        addFx(B, 'guard', tg.x, tg.y - 70, tg.guardPerfect ? '#fff6c0' : '#8fd8ff', { dur: 0.4, perfect: tg.guardPerfect });
        if (tg.guardPerfect) {
          addLog(B, `<span class="hl">※ 完美弹反！${tg.name} 抵消了伤害！</span>`);
          addHeat(B, tg, 24);
          tg.hot = clamp(tg.hot + 0, 0, 100);
        } else {
          addLog(B, `※ ${tg.name} 挡下了这一击（伤害减免）。`);
          addHeat(B, tg, 12);
        }
      }
      if (!isEnemy && !tg.dead) addHeat(B, atkUnit, (SKILLS[skillId]?.hot || 10) / Math.max(1, hits) * 0.55);
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

function elemColor(e) {
  return { none: '#ffffff', fire: '#ff8a1a', ice: '#8fe6ff', thunder: '#ffe14d', dark: '#b06bff', holy: '#fff3c4' }[e] || '#ffffff';
}

/* ============================================================
   状态 / 增益
   ============================================================ */
export function applyStatus(B, unit, id, turns) {
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
  }
  unit.status = unit.status.filter(s => s.turns > 0);
}

/* ============================================================
   行动构造
   ============================================================ */
/* 玩家指令批量执行 */
export function makePlayerTurn(B, cmds) {
  const acts = [];
  const sorted = [...B.party].filter(m => !m.dead).sort((a, b) => b.spd - a.spd);
  const queue = sorted.map(m => ({ m, cmd: cmds[m.id] || { type: 'attack' } }));
  let totalDur = 0;

  for (const { m, cmd } of queue) {
    if (m.dead) continue;
    acts.push({
      dur: 0.4,
      start() { m.pose = 'ready'; },
      tick(k) { if (k > 0.9) m.pose = 'idle'; },
      resolve() { resolvePlayerCmd(B, m, cmd); },
    });
  }
  // 我方行动结束后敌人行动
  acts.push({
    dur: 0.2, start() { }, tick() { }, resolve() { enemyPhase(B); },
  });
  return acts;
}

function resolvePlayerCmd(B, m, cmd) {
  if (m.dead) return;
  m.defending = false;
  switch (cmd.type) {
    case 'attack': {
      const ws = (ACTORS[m.id] && ACTORS[m.id].weaponSkill) || ['xinzhan'];
      const sk = SKILLS[ws[0]] || SKILLS.xinzhan || SKILLS.liaoshang;
      if (sk) execSkill(B, m, sk.id, [pickEnemy(B, cmd.target)].filter(Boolean));
      break;
    }
    case 'skill': {
      const sk = SKILLS[cmd.skill];
      if (!sk) break;
      m.mp = Math.max(0, m.mp - (sk.mp || 0));
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
    case 'guard':
      m.defending = true;
      addLog(B, `<span class="hl">${m.name}</span> 摆出了防御姿态。`);
      addHeat(B, m, 14);
      break;
    case 'escape':
      attemptEscape(B); break;
  }
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
  m.hot = 0;
  m.hotNotified = false;
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
        const heal = Math.floor(m.atk * sk.power * 2.6 + u.maxHp * (sk.power * 0.12) + 40);
        u.hp = Math.min(u.maxHp, u.hp + heal);
        addFloat(B, `+${heal}`, u.x, u.y - 120, '#7dffa8', 32);
        addFx(B, 'heal', u.x, u.y - 60, '#7dffa8', { dur: .8 });
        addLog(B, `<span class="heal">${u.name} 回复了 ${heal} 点生命。</span>`);
      }
      if (sk.buff) applyBuff(B, sk.buff, list.filter(u => u && !u.dead));
    },
    tick(k) { if (k > .8) m.pose = 'idle'; },
    resolve() { addHeat(B, m, 12); },
  });
  if (sk.ult) {
    m.hot = 0; m.hotNotified = false;
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
      t.hp = Math.floor(t.maxHp * (sk.power || 0.5));
      addFloat(B, '复活！', t.x, t.y - 140, '#fff3c4', 30);
      addLog(B, `<span class="heal">${t.name} 重新站了起来！</span>`);
      addHeat(B, m, 18);
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
      flash(B, 0.35);
      shake(B, 8);
      addHeat(B, m, sk.hot || 12);
      m.mp = Math.max(0, m.mp - (sk.mp || 0));
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
      addHeat(B, m, 8);
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
function enemyPhase(B) {
  if (B.over) return;
  const alive = B.enemies.filter(e => !e.dead);
  const order = alive.sort((a, b) => b.spd - a.spd);
  for (const e of order) {
    B.ui.queue.push({
      dur: 0.32,
      start() {
        // 回合开始时处理状态
        tickStatus(B, e);
        if (e.dead) return;
        if (e.status.some(s => s.id === 'stun')) {
          addLog(B, `<span class="hl">${e.name} 处于眩晕，无法行动！</span>`);
          e.skip = true;
          return;
        }
        if (e.status.some(s => s.id === 'frozen')) {
          addLog(B, `<span class="hl">${e.name} 被冰封，无法行动！</span>`);
          e.skip = true;
          return;
        }
        e.skip = false;
        chooseEnemyAction(B, e);
      },
      tick() { }, resolve() { },
    });
  }
  // 回合结束：回合数 +1
  B.ui.queue.push({
    dur: 0.15, start() { }, tick() { },
    resolve() { endRound(B); if (!B.over) { B.ui.mode = 'wait'; B.game.requestPlayerTurn(B); } },
  });
}

function chooseEnemyAction(B, e) {
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
  const pool = e.skills || [{ id: 'atk', w: 1 }];
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

  // 有格挡窗口的敌人攻击
  const saveTargets = targets.slice();
  B.ui.queue.push({
    dur: 1.30,
    start() {
      addLog(B, `<span class="dmg">${e.name}</span> 使用了 <span class="hl">${spec.name}</span>！`);
      e.pose = 'ready'; e.atkP = 0;
      // 建立格挡窗口（玩家在命中前按下 空格/点击 即为弹反）
      if (!B.def.noGuard) {
        B.guard = {
          t: 0, dur: 0.72, impact: 0.55, done: false, result: null, resolved: false, pressed: false,
          onPress() {
            const g = B.guard;
            if (!g || g.done) return;
            const dp = Math.abs(g.t / g.dur - g.impact);
            if (dp < 0.085) g.result = 'perfect';
            else if (dp < 0.205) g.result = 'good';
            else g.result = 'miss';
            g.done = true;
            B.game.sfx(g.result === 'perfect' ? 'perfect' : g.result === 'good' ? 'guard' : 'miss');
            addFx(B, 'guard', saveTargets[0].x, saveTargets[0].y - 70, g.result === 'perfect' ? '#fff6c0' : '#8fd8ff', { dur: 0.45, perfect: g.result === 'perfect' });
            if (g.result === 'perfect') {
              flash(B, 0.45); shake(B, 12);
              B.floats.push({ kind: 'quote', txt: '完美弹反！', x: W_GUARD_X, y: W_GUARD_Y, life: 0, dur: 1.1, col: '#fff6c0' });
            } else if (g.result === 'good') {
              shake(B, 6);
            }
          },
        };
      }
    },
    tick(k) {
      if (B.guard && !B.guard.done) {
        const g = B.guard;
        g.t = k * g.dur;
        if (k >= g.impact + 0.005 && !g.resolved) { g.resolved = true; g.done = true; g.result = 'none'; }
      }
      e.atkP = clamp(k / 0.62, 0, 1);
    },
    resolve() {
      const g = B.guard;
      for (const t of saveTargets) {
        if (!t || t.dead) continue;
        t.guardPerfect = !!(g && g.result === 'perfect');
        t.defending = !!(g && (g.result === 'perfect' || g.result === 'good'));
      }
      const act = runSkill(B, e, spec.id, saveTargets, {});
      if (act) B.ui.queue.push(act);
      B.guard = null;
    },
  });
  B.enemyActs.push(1);
}

const W_GUARD_X = 480, W_GUARD_Y = 210;

function endRound(B) {
  for (const m of B.party) {
    if (!m.dead) {
      tickStatus(B, m);
      m.mp = Math.min(m.maxMp, m.mp + (m.mpRegen || 3));
      m.defending = false; m.guardPerfect = false;
    }
  }
  for (const e of B.enemies) if (!e.dead) tickStatus(B, e);
  B.turn++;
  checkBattleEnd(B);
}

/* ============================================================
   胜负判定
   ============================================================ */
export function checkBattleEnd(B) {
  if (B.over) return;
  const aliveP = B.party.filter(m => !m.dead);
  const aliveE = B.enemies.filter(e => !e.dead);
  if (!aliveE.length) {
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
    B.cutin.life += dt;
    if (B.cutin.life >= B.cutin.dur) {
      const c = B.cutin; B.cutin = null; c.after && c.after();
    }
  }

  // 队列推进
  const cur = B.ui.queue[0];
  if (cur) {
    if (!cur._started) { cur._started = true; if (cur.dur > 0.08) cur.dur *= BATTLE_SPEED; cur.start && cur.start(); }    cur._t = (cur._t || 0) + dt;
    const k = clamp(cur._t / cur.dur, 0, 1);
    cur.tick && cur.tick(k);
    if (k >= 1) {
      B.ui.queue.shift();
      cur.resolve && cur.resolve();
      cleanupDead(B);
    }
  } else if (!B.over && !B.cutin) {
    // 需要玩家输入
    if (B.guard) { /* 等待格挡窗口 */ }
    else if (B.ui.mode === 'wait') {
      B.game.requestPlayerTurn(B);
      B.ui.mode = 'input';
    }
  }

  // 格挡窗口推进（g.t 由队列 tick 驱动，这里只处理按键）
  if (B.guard && !B.guard.done) {
    const g = B.guard;
    if (input.actionPressed && !g.pressed) { g.pressed = true; g.onPress(); }
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
    if (m.defending && !m.dead) {
      // 防御盾
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const sg = ctx.createRadialGradient(m.x, m.y - 70, 20, m.x, m.y - 70, 78);
      sg.addColorStop(0, 'rgba(120,200,255,0)');
      sg.addColorStop(.75, m.guardPerfect ? 'rgba(255,246,192,.4)' : 'rgba(120,200,255,.28)');
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
        for (let i = 0; i < 9; i++) {
          const a = i / 9 * TAU + k * 2;
          const rr = 30 + k * 60;
          ctx.globalAlpha = (1 - k) * .7;
          const fg = ctx.createRadialGradient(f.x + Math.cos(a) * rr, f.y + Math.sin(a) * rr * .5, 0, f.x + Math.cos(a) * rr, f.y + Math.sin(a) * rr * .5, 26);
          fg.addColorStop(0, '#fff2b0'); fg.addColorStop(.4, f.col); fg.addColorStop(1, 'rgba(200,0,0,0)');
          ctx.fillStyle = fg;
          ctx.beginPath(); ctx.arc(f.x + Math.cos(a) * rr, f.y + Math.sin(a) * rr * .5, 26, 0, TAU); ctx.fill();
        }
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

  /* 回合数 */
  ctx.save();
  ctx.font = '700 13px "Noto Sans SC",system-ui,sans-serif';
  ctx.fillStyle = 'rgba(255,220,170,.75)';
  ctx.textAlign = 'right';
  ctx.fillText(`TURN ${B.turn}`, W - 14, 132);
  ctx.restore();

  /* 我方格挡窗（弹反条由 DOM 显示，这里画目标圈） */
  if (B.guard && !B.guard.done) {
    const g = B.guard;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const tt = clamp(g.t / g.dur, 0, 1);
    const near = 1 - Math.abs(tt - g.impact) / 0.3;
    if (near > 0) {
      ctx.globalAlpha = near * .5;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(W / 2, H / 2, 240 - near * 40, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }

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

function ultGlow(m) {
  if (m.hot >= 100) return '#ffd76a';
  if (m.hot >= 60) return '#ff8a1a';
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
    ctx.strokeStyle = m.hot >= 100 ? 'rgba(255,215,106,.95)' : 'rgba(255,160,70,.38)';
    ctx.lineWidth = m.hot >= 100 ? 2 : 1.2;
    SP.util.rrect(ctx, x, y, CW, CH, 6); ctx.stroke();

    // 名字
    ctx.font = '800 15px "Noto Sans SC",system-ui,sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = m.dead ? '#8a8098' : (m.hot >= 100 ? '#ffd76a' : '#ffe9cf');
    ctx.fillText(m.name, x + 9, y + 19);
    ctx.font = '600 10.5px "Noto Sans SC",system-ui,sans-serif';
    ctx.fillStyle = 'rgba(200,190,230,.85)';
    ctx.fillText(`Lv.${m.level}`, x + 42, y + 19);
    if (m.dead) { ctx.fillStyle = '#ff8098'; ctx.fillText('倒下', x + 74, y + 19); }
    if (m.hot >= 100) {
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

    // MP
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    SP.util.rrect(ctx, x + 9, y + 36, bw, 6, 3); ctx.fill();
    const mp = clamp(m.mp / m.maxMp, 0, 1);
    ctx.fillStyle = '#48b8ff';
    SP.util.rrect(ctx, x + 9, y + 36, bw * mp, 6, 3); ctx.fill();

    // 热血
    const hot = clamp(m.hot / 100, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    SP.util.rrect(ctx, x + 9, y + 45, bw, 7, 3.5); ctx.fill();
    const hhg = ctx.createLinearGradient(x + 9, 0, x + 9 + bw, 0);
    hhg.addColorStop(0, '#ff6a1a'); hhg.addColorStop(1, '#ffd76a');
    ctx.fillStyle = hhg;
    SP.util.rrect(ctx, x + 9, y + 45, bw * hot, 7, 3.5); ctx.fill();
    if (hot >= 1) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = .35 + .3 * Math.sin(t * 8);
      ctx.fillStyle = '#ffd76a';
      SP.util.rrect(ctx, x + 9, y + 45, bw, 7, 3.5); ctx.fill();
      ctx.restore();
    }
    ctx.font = '700 8.5px "Noto Sans SC",system-ui,sans-serif';
    ctx.fillStyle = 'rgba(255,220,170,.9)';
    ctx.fillText('热血', x + 11, y + 51.5);

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

export default { createBattle, updateBattle, drawBattle, makePlayerTurn, battleLogHTML, addHeat, computeDamage, checkBattleEnd };
