/* 平衡模拟：用真实公式推算各场战斗的回合数、生存能力与胜负倾向 */
import { ACTORS, ENEMIES, ENEMY_SKILLS, SKILLS, EQUIPS, statsAt } from '../js/characters.js';

const BATTLE_SPEED = 0.68;
const rnd = (a, b) => (a + b) / 2;   // 用期望值代替随机

/* 复刻 battle.js 的公式（保持一致） */
function eAtk(u) { return u.atk; }
function eDef(u) { return u.def; }
function dmgOf(atk, def, power, lvl, dlv, critRate = 0) {
  const base = (atk * power * 1.02) - def * 0.9 + 44 * power;
  const lvK = 1 + (lvl - dlv) * 0.02;
  let d = base * lvK;
  d *= (1 - critRate) * 1 + critRate * 1.72;
  return Math.max(1, Math.round(d));
}
function mkEnemy(ref, lv) {
  const d = ENEMIES[ref], k = lv - 1;
  const hpK = (d.boss && lv >= 18) ? 0.035 : 0.075;
  return { name: d.name, level: lv, hp: Math.floor(d.hp * (1 + k * hpK)), atk: Math.floor(d.atk * (1 + k * 0.11)), def: Math.floor(d.def * (1 + k * 0.10)), skills: d.skills, boss: !!d.boss };
}
function mkHero(id, lv, equips) {
  const s = statsAt(ACTORS[id], lv, equips);
  return { id, name: ACTORS[id].name, level: lv, hp: s.hp, atk: s.atk, def: s.def, cri: s.cri, skills: ACTORS[id].skills.filter(x => x.lv <= lv).map(x => x.id) };
}
/* 每回合我方输出：凯用最强可用攻击技，其余同理 */
function heroDamage(h, foe) {
  const usable = h.skills.map(id => SKILLS[id]).filter(s => s && s.type === 'atk' && (s.mp || 0) <= 60 && !s.ult);
  if (!usable.length) return dmgOf(eAtk(h), eDef(foe), 1, h.level, foe.level, h.cri);
  // 选每 MP 伤害最高、且不至于太耗蓝的技能；一轮按平均取用
  let best = null, bestV = -1;
  for (const s of usable) {
    const per = dmgOf(eAtk(h), eDef(foe), s.power, h.level, foe.level, h.cri) * (s.hits || 1) * (s.target === 'all' ? 1 : 1);
    const v = per / Math.max(6, (s.mp || 8));   // 折算续航
    if (v > bestV) { bestV = v; best = s; }
  }
  const useSkill = (best.mp || 0) > 0 && h.level >= 8;
  const s = useSkill ? best : { power: 1, hits: 1 };
  const per = dmgOf(eAtk(h), eDef(foe), s.power, h.level, foe.level, h.cri) * (s.hits || 1);
  return Math.round(per);
}
function enemyDamage(e, hero) {
  const pool = e.skills || [{ id: 'atk', w: 1 }];
  const tot = pool.reduce((a, b) => a + b.w, 0);
  let avg = 0;
  for (const p of pool) {
    const s = ENEMY_SKILLS[p.id] || ENEMY_SKILLS.atk;
    avg += (p.w / tot) * dmgOf(eAtk(e), eDef(hero), s.power || 1, e.level, hero.level, 0.03);
  }
  return Math.round(avg);
}

const PARTY = {
  early: [['kaito', 3, ['mu_sword', 'cloth']], ['cang', 5, ['wood_staff', 'cloth']]],
  forest: [['kaito', 6, ['iron_sword', 'leather']], ['cang', 6, ['wood_staff', 'leather']], ['lei', 6, ['hunter_spear', 'leather']]],
  mid: [['kaito', 10, ['flame_sword', 'chain']], ['cang', 10, ['blue_staff', 'chain']], ['lei', 10, ['hunter_spear', 'chain']], ['ryze', 10, ['snow_staff', 'holy_cloak']]],
  late: [['kaito', 15, ['holy_sword', 'demon_mail']], ['cang', 15, ['blue_staff', 'holy_cloak']], ['lei', 15, ['storm_spear', 'chain']], ['ryze', 15, ['snow_staff', 'holy_cloak']]],
  final: [['kaito', 18, ['holy_sword', 'demon_mail']], ['cang', 18, ['blue_staff', 'holy_cloak']], ['lei', 18, ['storm_spear', 'chain']], ['ryze', 18, ['snow_staff', 'holy_cloak']]],
};

const STAGES = [
  ['第一章 魔兵×2', 'early', [['demon_soldier', 1], ['demon_soldier', 1]]],
  ['第一章 魔兵+弓手', 'early', [['demon_soldier2', 2], ['demon_soldier', 2]]],
  ['第二章 冥狼×2+弓手', 'forest', [['hell_hound', 3], ['hell_hound', 3], ['demon_soldier2', 3]]],
  ['第二章 森之守卫(BOSS)', 'forest', [['forest_guard', 4]]],
  ['第三章 霜牙兽×2+魔兵', 'mid', [['ice_hound', 6], ['ice_hound', 6], ['demon_soldier', 6]]],
  ['第三章 冰之魔女(BOSS)', 'mid', [['ice_witch', 8]]],
  ['第四章 泽恩(BOSS)', 'late', [['zain', 11]]],
  ['第四章 古兰+杂兵(BOSS)', 'late', [['demon_general', 13], ['demon_soldier', 13], ['demon_soldier2', 13]]],
  ['第五章 魔王(BOSS)', 'final', [['demon_king', 18]]],
  ['第五章 终焉魔王(BOSS)', 'final', [['demon_king_final', 20]]],
  ['隐藏 终焉魔王·强', 'final', [['demon_king_final', 22]]],
];

console.log('=== 战斗平衡模拟（期望值） ===');
console.log('场次'.padEnd(26), '我方HP', '敌方HP', '我方/回合', '敌/回合', '预计回合', '评价');
let problems = [];
for (const [name, pkey, foes] of STAGES) {
  const heroes = PARTY[pkey].map(([id, lv, eq]) => mkHero(id, lv, eq));
  const es = foes.map(([ref, lv]) => mkEnemy(ref, lv));
  const totalHp = heroes.reduce((a, h) => a + h.hp, 0);
  const eHp = es.reduce((a, e) => a + e.hp, 0);
  const heroesTotal = heroes.reduce((a, h) => a + h.hp, 0);
  const eDef0 = es.reduce((a, e) => a + e.def, 0) / es.length;
  const foeForCalc = { level: Math.round(es.reduce((a, e) => a + e.level, 0) / es.length), def: eDef0 };
  // 我方每回合总输出（单体技能对单体，群体技能×敌数）
  let pOut = 0;
  for (const h of heroes) {
    const usable = h.skills.map(id => SKILLS[id]).filter(s => s && s.type === 'atk' && !s.ult);
    let best = null, bestV = -1;
    for (const s of usable) {
      const single = dmgOf(h.atk, eDef0, s.power, h.level, foeForCalc.level, h.cri) * (s.hits || 1);
      const total = s.target === 'all' ? single * es.length : single;
      const v = total / Math.max(8, (s.mp || 10));
      if (v > bestV) { bestV = v; best = { s, total }; }
    }
    const basic = dmgOf(h.atk, eDef0, 1, h.level, foeForCalc.level, h.cri);
    const use = best && (best.s.mp || 0) > 0 && h.level >= 9 ? best.total : basic;
    pOut += Math.round(Math.max(use, basic));
  }
  // 敌方每回合总输出（对我方随机单体；全屏技能×人数）
  let eOut = 0;
  for (const e of es) {
    const pool = e.skills || [{ id: 'atk', w: 1 }];
    const tot = pool.reduce((a, b) => a + b.w, 0);
    let avgSingle = 0;
    for (const p of pool) {
      const s = ENEMY_SKILLS[p.id] || ENEMY_SKILLS.atk;
      const d = dmgOf(e.atk, heroes.reduce((a, h) => a + h.def, 0) / heroes.length, s.power || 1, e.level, Math.round(heroes.reduce((a, h) => a + h.level, 0) / heroes.length), 0.03);
      avgSingle += (p.w / tot) * d * (s.target === 'all' ? heroes.length : 1);
    }
    eOut += Math.round(avgSingle);
  }
  const rounds = (eHp / pOut).toFixed(1);
  const survive = (totalHp / eOut).toFixed(1);
  let verdict = [];
  if (+rounds > 12) verdict.push('太肉');
  if (+rounds < 1.6) verdict.push('太脆');
  if (+survive < 2.2) verdict.push('⚠会被秒');
  if (+survive > 12) verdict.push('太简单');
  if (!verdict.length) verdict.push('✔ 手感良好');
  if (verdict.some(v => v.includes('⚠'))) problems.push(name + ' → 生存 ' + survive + ' 回合');
  console.log(name.padEnd(26), String(totalHp).padStart(6), String(eHp).padStart(7), String(pOut).padStart(9), String(eOut).padStart(8), String(rounds).padStart(9), ' 存活' + survive + '回合', verdict.join(' '));
}
console.log('\n结论:', problems.length ? '需要调整：' + problems.join('；') : '全部战斗手感在合理区间 ✔');
