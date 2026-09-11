/* ============================================================
   power.js — 战斗力评估与装备适配

   两个用途：
     ① 面板上给玩家一个「换这件到底是变强还是变弱」的直观数字
     ② tools/balance.mjs 用同一套公式，把关卡数值对着队伍实际战力来调，
        而不是对着「等级 + 一套假设装备」来调

   战力不是把属性直接相加——攻防血速的边际价值完全不同。
   这里按「它对一场战斗的实际贡献」折算：
     进攻 = 有效攻击力 × 会心期望 × 属性/特效加成
     生存 = 有效血量（血 + 防御折算 + 减伤折算）
     节奏 = 速度带来的额外出手 + 资源续航
   三项加权求和，再开方压平量级，让数字停在四位数以内好读。
   ============================================================ */
import { EQUIPS, SKILLS, ACTORS, statsAt } from './characters.js';
import { talentBonus, talentElem, applyStatPoints, applyTalentStats } from './growth.js';

/* ---------------- 装备适配 ----------------
   武器分类别限定使用者；护甲、披风、戒指、护符人人可用。 */
export const WEAPON_USERS = {
  '刀剑': ['kaito'],
  '长枪': ['lei'],
  '弓弩': ['lei'],
  '法杖': ['cang', 'ryze'],
};

/* 旧的固定装备没有 type 字段，按 id 归类 */
const LEGACY_TYPE = {
  mu_sword: '刀剑', iron_sword: '刀剑', flame_sword: '刀剑', holy_sword: '刀剑',
  wood_staff: '法杖', blue_staff: '法杖', snow_staff: '法杖',
  hunter_spear: '长枪', storm_spear: '长枪',
};

export function equipType(eq) {
  if (!eq) return null;
  return eq.type || LEGACY_TYPE[eq.id] || null;
}

/* 这件装备该角色能不能用 */
export function canEquip(memberId, eq) {
  if (!eq) return false;
  if (eq.slot !== 'weapon') return true;      // 护甲 / 饰品不限
  const t = equipType(eq);
  if (!t) return true;                        // 归不了类的就不拦
  const users = WEAPON_USERS[t];
  return !users || users.includes(memberId);
}

/* 装备等级：生成装备带 level，固定装备按数值反推一个近似档位 */
export function equipLevel(eq) {
  if (!eq) return 0;
  if (eq.level) return eq.level;
  const worth = (eq.atk || 0) * 2 + (eq.def || 0) * 2 + (eq.hp || 0) * 0.25 + (eq.mp || 0) * 0.3;
  return Math.max(1, Math.round(worth / 6));
}

/* ---------------- 战力 ---------------- */

/* 把装备与天赋里那些「按百分比影响输出」的特效折成一个乘区 */
function offenseMul(u) {
  const g = k => (eqEff(u, k) + talentBonus(u, k));
  const critDmg = g('critDmg');
  const cri = Math.min(0.9, u.cri || 0);
  // 会心期望：基础 1.72 倍，加上致命词缀
  const critK = 1 + cri * (0.72 + critDmg);
  const elem = avgElem(u);
  const misc = 1
    + g('weakHunter') * 0.35          // 只在打弱点时生效，按出现频率折一部分
    + g('bossBane') * 0.25
    + g('pierce') * 0.5               // 破防近似等价于半额增伤
    + g('echo') * 0.5                 // 追击是半伤，所以乘 0.5
    + g('lifesteal') * 0.15
    + g('extraTurn') * 0.8;
  return critK * (1 + elem) * misc;
}

/* 各属性伤害加成的均值——不知道会打到什么弱点，取平均 */
function avgElem(u) {
  const keys = ['fire', 'ice', 'thunder', 'holy', 'dark'];
  let s = 0;
  for (const k of keys) s += eqElem(u, k) + talentElem(u, k);
  return s / keys.length;
}

function defenseMul(u) {
  const g = k => (eqEff(u, k) + talentBonus(u, k));
  const blk = Math.min(0.6, u.blk || 0);
  const par = Math.min(0.3, u.par || 0);
  // 格挡减伤 62%，弹反完全免伤
  return 1 / Math.max(0.25, 1 - (blk * 0.62 + par + g('flatCut') + g('dodge')))
    * (1 + g('thorns') * 0.2 + g('hpRegen') * 4 + g('killHeal') * 1.5 + (g('lastStand') ? 0.08 : 0));
}

function eqEff(u, key) {
  if (!u.equips) return 0;
  let s = 0;
  for (const id of u.equips) {
    const e = EQUIPS[id];
    if (e && e.eff && typeof e.eff[key] === 'number') s += e.eff[key];
  }
  return s;
}
function eqElem(u, elem) {
  if (!u.equips) return 0;
  let s = 0;
  for (const id of u.equips) {
    const e = EQUIPS[id];
    if (!e || !e.eff) continue;
    if (e.eff.elemDmg && e.eff.elemDmg[elem]) s += e.eff.elemDmg[elem];
    if (elem === 'holy' && e.eff.holyPower) s += e.eff.holyPower;
  }
  return s;
}

/* 技能带来的输出倍率：取这个角色当前能用的最强一招，
   和普攻比出一个系数——只会普攻的角色不该和有全体奥义的算一样。 */
function skillMul(u) {
  const list = (u.skills || []).map(id => SKILLS[id]).filter(s => s && s.type === 'atk');
  if (!list.length) return 1;
  let best = 1;
  for (const s of list) {
    const hits = s.hits || 1;
    let v = (s.power || 1) * hits;
    if (s.target === 'all') v *= 1.6;          // 全体技在群战里的实际收益
    if (s.ult || s.release) v *= 0.75;         // 奥义有资源门槛，不是每回合都能放
    best = Math.max(best, v);
  }
  return 0.55 + best * 0.45;                    // 普攻打底，强技占一部分权重
}

/* 单个角色的战力 */
export function combatPower(u) {
  if (!u) return 0;
  const atk = (u.atk || 0) * offenseMul(u) * skillMul(u);
  const ehp = ((u.maxHp || u.hp || 1) + (u.def || 0) * 8) * defenseMul(u);
  const tempo = (u.spd || 1) * 6
    + (u.resource === 'rage' ? 0 : (u.maxMp || 0) * 0.35 + (u.mpRegen || 0) * 12);
  const raw = atk * 9 + ehp * 0.9 + tempo * 2;
  return Math.round(Math.sqrt(raw) * 12);
}

export function partyPower(party) {
  return (party || []).reduce((a, m) => a + (m.dead ? 0 : combatPower(m)), 0);
}

/* 敌人战力：同一套折算，方便和队伍直接比 */
export function enemyPower(e) {
  if (!e) return 0;
  const atk = (e.atk || 0) * 1.15;
  const ehp = ((e.maxHp || e.hp || 1) + (e.defv ?? e.def ?? 0) * 8);
  const tempo = (e.spd || 1) * 6;
  const raw = atk * 9 + ehp * 0.9 + tempo * 2;
  return Math.round(Math.sqrt(raw) * 12);
}

/* 换上某件装备之后战力会变成多少（不改动真实数据） */
export function powerWith(member, eqId) {
  const def = ACTORS[member.id];
  if (!def) return combatPower(member);
  const eq = EQUIPS[eqId];
  const slotIdx = ['weapon', 'armor', 'acc'].indexOf(eq ? eq.slot : '');
  const equips = [...(member.equips || [])];
  if (slotIdx >= 0) equips[slotIdx] = eqId;
  const st = statsAt(def, member.level, equips);
  applyStatPoints(st, member.alloc);
  applyTalentStats(st, member);
  st.blk = Math.min(st.blk, 0.60);
  st.par = Math.min(st.par, 0.30);
  const b = member.bonus || {};
  const probe = {
    ...member, equips,
    atk: st.atk + (b.atk || 0), def: st.def + (b.def || 0),
    maxHp: st.hp + (b.hp || 0), maxMp: st.mp, spd: st.spd,
    cri: st.cri, blk: st.blk, par: st.par, mpRegen: st.mpRegen,
  };
  return combatPower(probe);
}

/* 战力档位，给面板配个颜色 */
export function powerTier(delta) {
  if (delta > 0) return { col: '#7dffa8', sign: '+' };
  if (delta < 0) return { col: '#ff8080', sign: '' };
  return { col: '#8a7d8c', sign: '±' };
}

export default { combatPower, partyPower, enemyPower, powerWith, canEquip, equipLevel, equipType };
