/* 平衡模拟：用真实公式推算各场战斗的长度、生存能力与胜负倾向。
   行动条改版后「回合」不再是所有人各打一次，而是按 spd 分配出手机会——
   模型改为：算出全场每「轮」（= 全体 gauge 各涨满一次的时间）里各单位的出手次数期望。 */
import { ACTORS, ENEMIES, ENEMY_SKILLS, SKILLS, EQUIPS, statsAt } from '../js/characters.js';
import { SCENES } from '../js/story.js';
import { obtainable } from './reach.mjs';

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
  const hpK = (d.boss && lv >= 18) ? 0.032 : 0.075;
  return {
    name: d.name, level: lv, hp: Math.floor(d.hp * (1 + k * hpK)),
    atk: Math.floor(d.atk * (1 + k * 0.11)), def: Math.floor(d.def * (1 + k * 0.10)),
    spd: d.spd + k, skills: d.skills, boss: !!d.boss, weak: d.weak || [],
  };
}
function mkHero(id, lv, equips) {
  const s = statsAt(ACTORS[id], lv, equips);
  return {
    id, name: ACTORS[id].name, role: ACTORS[id].role, level: lv,
    resource: ACTORS[id].resource || 'mp',
    hp: s.hp, mp: s.mp, mpRegen: s.mpRegen, atk: s.atk, def: s.def, spd: s.spd, cri: s.cri,
    blk: s.blk, par: s.par, rageMul: s.rageMul,
    skills: ACTORS[id].skills.filter(x => x.lv <= lv).map(x => x.id),
  };
}
const PARTY = {
  early: [['kaito', 3, ['mu_sword', 'cloth']], ['cang', 5, ['wood_staff', 'cloth']]],
  forest: [['kaito', 6, ['iron_sword', 'leather']], ['cang', 6, ['wood_staff', 'leather']], ['lei', 6, ['hunter_spear', 'leather']]],
  mid: [['kaito', 10, ['flame_sword', 'chain']], ['cang', 10, ['blue_staff', 'chain']], ['lei', 10, ['hunter_spear', 'chain']], ['ryze', 10, ['snow_staff', 'holy_cloak']]],
  late: [['kaito', 15, ['holy_sword', 'demon_mail']], ['cang', 15, ['blue_staff', 'holy_cloak']], ['lei', 15, ['storm_spear', 'chain']], ['ryze', 15, ['snow_staff', 'holy_cloak']]],
  final: [['kaito', 18, ['holy_sword', 'demon_mail']], ['cang', 18, ['blue_staff', 'holy_cloak']], ['lei', 18, ['storm_spear', 'chain']], ['ryze', 18, ['snow_staff', 'holy_cloak']]],
};

const ASSUMED_ROUNDS = 6;    // 续航折算用的典型战斗长度（单位：轮）
const HEALER_OUTPUT = 0.5;   // 治愈角色实际用于输出的出手占比
const RAGE_PER_ACT = 16;     // 愤怒角色每次出手+挨打大致能攒到的怒气

/* 遭遇表直接从 story.js 读取——此前这里是手抄的副本，改了剧本这边不会跟着变。
   只有「打到这场时队伍大概什么水平」是模拟器的假设，必须留在这里。 */
/* 预设里只允许出现玩家真能拿到的装备。
   踩过的坑：终盘预设给凯配了圣剑·霜华 + 魔铠·黑曜，而这两件当时都无法获得，
   于是整个终盘平衡是按玩家永远达不到的装等算的（实战比模拟结论更难）。 */
function checkGear() {
  const OK = obtainable();
  const bad = [];
  for (const [key, list] of Object.entries(PARTY)) {
    for (const [id, lv, eq] of list) for (const e of eq) {
      if (!OK.has(e)) bad.push(`${key}/${id}: ${e}`);
    }
  }
  if (bad.length) {
    console.log('! 预设里用了玩家拿不到的装备：' + bad.join('、'));
    process.exitCode = 1;
  }
}
checkGear();

const STAGE_PARTY = {
  c1_battle1: ['第一章 魔兵×2', 'early'],
  c1_battle2: ['第一章 魔兵+弓手', 'early'],
  c2_battle1: ['第二章 冥狼×2+弓手', 'forest'],
  c2_guardian: ['第二章 森之守卫(BOSS)', 'forest'],
  c3_battle1: ['第三章 霜牙兽×2+魔兵', 'mid'],
  c3_witch: ['第三章 冰之魔女(BOSS)', 'mid'],
  c4_zain: ['第四章 泽恩(BOSS)', 'late'],
  c4_grang: ['第四章 古兰+杂兵(BOSS)', 'late'],
  c5_king: ['第五章 魔王(BOSS)', 'final'],
  c5_final: ['第五章 终焉魔王(BOSS)', 'final'],
  secret_final: ['隐藏 终焉魔王·强', 'final'],
};

const STAGES = [];
for (const [sid, sc] of Object.entries(SCENES)) {
  if (!sc.enemies) continue;
  const meta = STAGE_PARTY[sid];
  if (!meta) { console.log(`! 战斗场景 ${sid} 没有配队伍档位，已跳过`); continue; }
  STAGES.push([meta[0], meta[1], sc.enemies.map(e => [e.ref, e.level])]);
}
for (const sid of Object.keys(STAGE_PARTY)) {
  if (!SCENES[sid] || !SCENES[sid].enemies) console.log(`! STAGE_PARTY 里的 ${sid} 在剧本里已不是战斗场景`);
}

/* 从未出现在任何战斗里的敌人（做了数据和立绘却没人用） */
{
  const used = new Set(STAGES.flatMap(([, , foes]) => foes.map(f => f[0])));
  const idle = Object.keys(ENEMIES).filter(k => !used.has(k));
  if (idle.length) console.log('! 未被任何战斗使用的敌人:', idle.map(k => ENEMIES[k].name).join('、'));
}

console.log('=== 战斗平衡模拟（期望值） ===');
console.log('场次'.padEnd(26), '我方HP', '敌方HP', '我方/轮', '敌/轮', '预计轮数', '评价');
let problems = [];
for (const [name, pkey, foes] of STAGES) {
  const heroes = PARTY[pkey].map(([id, lv, eq]) => mkHero(id, lv, eq));
  const es = foes.map(([ref, lv]) => mkEnemy(ref, lv));
  const totalHp = heroes.reduce((a, h) => a + h.hp, 0);
  const eHp = es.reduce((a, e) => a + e.hp, 0);
  const eDef0 = es.reduce((a, e) => a + e.def, 0) / es.length;
  const eLv = Math.round(es.reduce((a, e) => a + e.level, 0) / es.length);
  const pLv = Math.round(heroes.reduce((a, h) => a + h.level, 0) / heroes.length);
  const pDef0 = heroes.reduce((a, h) => a + h.def, 0) / heroes.length;

  /* 行动条：一「轮」定义为全场平均速度的单位涨满一次 gauge 的时间。
     某个单位在一轮里的出手次数 = 它的速度 / 全场平均速度。 */
  const all = [...heroes, ...es];
  const spdAvg = all.reduce((a, u) => a + u.spd, 0) / all.length;
  const actsOf = u => u.spd / spdAvg;

  /* 弱点覆盖：只要队里有人能打出该敌人的弱点属性，就按期望摊一部分克制收益 */
  const partyElems = new Set(heroes.flatMap(h => h.skills.map(id => SKILLS[id]).filter(s => s && s.type === 'atk').map(s => s.elem)));
  const weakHit = es.some(e => (e.weak || []).some(w => partyElems.has(w))) ? 1.12 : 1;

  // 我方每轮总输出
  let pOut = 0;
  for (const h of heroes) {
    const usable = h.skills.map(id => SKILLS[id]).filter(s => s && s.type === 'atk' && !s.ult);
    let best = null, bestV = -1;
    for (const s of usable) {
      const single = dmgOf(h.atk, eDef0, s.power, h.level, eLv, h.cri) * (s.hits || 1);
      const total = s.target === 'all' ? single * es.length : single;
      const v = total / Math.max(8, (s.mp || 10));
      if (v > bestV) { bestV = v; best = { s, total }; }
    }
    const basic = dmgOf(h.atk, eDef0, 1, h.level, eLv, h.cri);
    const acts = actsOf(h);
    const budgetActs = ASSUMED_ROUNDS * acts;          // 这场里该角色总出手数
    let perAct = basic;
    if (best && (best.s.mp || 0) > 0 && h.level >= 9) {
      /* 资源续航：术力角色按自然回复算，愤怒角色按战斗中的积攒速率算 */
      const pool = h.resource === 'rage'
        ? RAGE_PER_ACT * (h.rageMul || 1) * budgetActs
        : h.mp + h.mpRegen * budgetActs;
      const casts = Math.min(budgetActs, Math.floor(pool / best.s.mp));
      perAct = (casts * Math.max(best.total, basic) + (budgetActs - casts) * basic) / Math.max(1, budgetActs);
    }
    if (h.role === '治愈') perAct *= HEALER_OUTPUT;
    pOut += Math.round(perAct * acts * weakHit);
  }

  // 敌方每轮总输出（已扣掉我方的格挡/弹反期望减伤）
  const parAvg = heroes.reduce((a, h) => a + (h.par || 0), 0) / heroes.length;
  const blkAvg = heroes.reduce((a, h) => a + (h.blk || 0), 0) / heroes.length;
  const mitigate = 1 - parAvg - blkAvg * 0.62;
  let eOut = 0;
  for (const e of es) {
    const pool = e.skills || [{ id: 'atk', w: 1 }];
    const tot = pool.reduce((a, b) => a + b.w, 0);
    let avgSingle = 0;
    for (const p of pool) {
      const sk = ENEMY_SKILLS[p.id] || ENEMY_SKILLS.atk;
      const d = dmgOf(e.atk, pDef0, sk.power || 1, e.level, pLv, 0.03);
      avgSingle += (p.w / tot) * d * (sk.hits || 1) * (sk.target === 'all' ? heroes.length : 1);
    }
    eOut += Math.round(avgSingle * actsOf(e) * mitigate);
  }

  const rounds = (eHp / pOut).toFixed(1);
  const survive = (totalHp / eOut).toFixed(1);
  let verdict = [];
  if (+rounds > 12) verdict.push('太肉');
  if (+rounds < 1.6) verdict.push('太脆');
  if (+survive < 2.2) verdict.push('⚠会被秒');
  if (+survive > 12) verdict.push('太简单');
  if (!verdict.length) verdict.push('✔ 手感良好');
  if (!verdict.includes('✔ 手感良好')) {
    problems.push(name + ' → ' + verdict.join('/') + '（轮数 ' + rounds + '、生存 ' + survive + '）');
  }
  console.log(name.padEnd(26), String(totalHp).padStart(6), String(eHp).padStart(7), String(pOut).padStart(9), String(eOut).padStart(8), String(rounds).padStart(8), ' 存活' + survive + '轮', verdict.join(' '));
}
console.log('\n结论:', problems.length ? '需要调整：' + problems.join('；') : '全部战斗手感在合理区间 ✔');
