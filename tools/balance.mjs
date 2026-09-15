/* 平衡模拟：用真实公式推算各场战斗的长度、生存能力与胜负倾向。
   行动条改版后「回合」不再是所有人各打一次，而是按 spd 分配出手机会——
   模型改为：算出全场每「轮」（= 全体 gauge 各涨满一次的时间）里各单位的出手次数期望。 */
import { ACTORS, ENEMIES, ENEMY_SKILLS, SKILLS, EQUIPS, statsAt, enemyStatsAt } from '../js/characters.js';
import { combatPower, enemyPower } from '../js/power.js';
import { SCENES } from '../js/story.js';
import { obtainable } from './reach.mjs';

/* 复刻 battle.js 的公式（保持一致） */
function eAtk(u) { return u.atk; }
function eDef(u) { return u.def; }
function dmgOf(atk, def, power, lvl, dlv, critRate = 0, hits = 1) {
  // 与 battle.js 一致：防御按段数摊薄，多段技不再被扣满 N 次
  const base = (atk * power * 1.02) - (def * 0.9) / Math.max(1, hits) + 44 * power;
  const lvK = 1 + (lvl - dlv) * 0.02;
  let d = base * lvK;
  d *= (1 - critRate) * 1 + critRate * 1.72;
  return Math.max(1, Math.round(d));
}
function mkEnemy(ref, lv) {
  const d = ENEMIES[ref];
  const st = enemyStatsAt(d, lv);      // 缩放公式只有 characters.js 一份
  return {
    name: d.name, level: lv, hp: st.maxHp,
    atk: st.atk, def: st.defv,
    spd: st.spd, skills: d.skills, boss: !!d.boss, weak: d.weak || [],
  };
}
function mkHero(id, lv, equips, gear) {
  const s = statsAt(ACTORS[id], lv, equips || []);
  if (gear) for (const k of Object.keys(gear)) s[k] = (s[k] || 0) + gear[k];
  return {
    id, name: ACTORS[id].name, role: ACTORS[id].role, level: lv,
    resource: ACTORS[id].resource || 'mp',
    hp: s.hp, mp: s.mp, mpRegen: s.mpRegen, atk: s.atk, def: s.def, spd: s.spd, cri: s.cri,
    blk: s.blk, par: s.par, rageMul: s.rageMul,
    skills: ACTORS[id].skills.filter(x => x.lv <= lv).map(x => x.id),
  };
}
/* 「打到这场时玩家大概什么水平」——模拟器唯一的假设，所以必须写实。

   2026-09-15 重建。此前这里是五档四人队，配的是 holy_sword / demon_mail /
   blue_staff 一类《炎之刃》时代的装备，脚本自己都会报「预设里用了玩家拿不到的装备」
   共 10 条。按那套预设算出来的是 1238 HP 的四人队，于是四场狼战全被判成
   「太简单 / 战力碾压」——而真实路径是邪天单人 340 HP，自动战斗中途死了 3 次。
   结论整个是反的。

   现在的等级取自 playthrough.cjs 的真实通关记录（邪天单人 Lv1 起步，Lv7 收尾）；
   装备按「会去杂货摊花钱的玩家」估：d_oldwoman 给 200 金，够买铁之长剑（180）；
   d_resupply 再给 260，够补一件皮甲（150）。 */
const PARTY = {
  solo_open:  [['kaito', 1, ['mu_sword', 'cloth']]],       // 头两场：还没来得及买东西
  solo_pack:  [['kaito', 3, ['iron_sword', 'cloth']]],     // 狼群：换了剑
  solo_alpha: [['kaito', 5, ['iron_sword', 'leather']]],   // 头狼：补上皮甲
};

/* 哪一场用哪一档。按敌人等级自动选在这里行不通——
   四场狼战的敌人全是 5 级，等级区分不出「第几场」，只有剧本顺序能。 */
const STAGE_TIER = {
  d_fight1: 'solo_open', d_fight1b: 'solo_open',
  d_fight2: 'solo_pack', d_fight3: 'solo_alpha',
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
    for (const [id, lv, eq] of list) for (const e of (eq || [])) {
      if (!OK.has(e)) bad.push(`${key}/${id}: ${e}`);
    }
  }
  if (bad.length) {
    console.log('! 预设里用了玩家拿不到的装备：' + bad.join('、'));
    process.exitCode = 1;
  }
}
checkGear();

/* 遭遇表与队伍档位都从剧本推导。
   此前这里是一张手抄的 STAGE_PARTY，剧情拆分重构之后就对不上了：
   10 场战斗被跳过，还误报四个敌人「未被任何战斗使用」。
   现在档位按该场敌人的等级自动选，新增章节不用改这个文件。 */
function tierFor(lv, sid) {
  if (STAGE_TIER[sid]) return STAGE_TIER[sid];
  /* 剧本新增了战斗而这里还没配档位：按敌人等级现编一个单人档，
     保证不漏跑，但结论只能当参考——真实等级要等 playthrough 跑一遍才知道。 */
  const key = 'auto' + lv;
  if (!PARTY[key]) PARTY[key] = [['kaito', Math.max(1, lv - 2), ['iron_sword', 'leather']]];
  return key;
}

/* 战斗场景在剧本里的先后顺序，用来给场次编号 */
const STAGES = [];
for (const [sid, sc] of Object.entries(SCENES)) {
  if (!sc.enemies || !sc.enemies.length) continue;
  const lv = Math.round(sc.enemies.reduce((a, e) => a + e.level, 0) / sc.enemies.length);
  const label = `${(sc.chapter || '').replace(/^第|章.*$/g, '').slice(0, 8) || '?'} ${sc.enemies.map(e => ENEMIES[e.ref].name).join('+')}`.slice(0, 26);
  // 教学战（练习木桩）本来就该秒杀，不参与平衡结论
  const tutorial = sc.enemies.every(e => e.ref === 'training_dummy');
  STAGES.push([label + (sc.boss ? '(BOSS)' : ''), tierFor(lv, sid), sc.enemies.map(e => [e.ref, e.level]), sid, tutorial]);
}

/* 从未出现在任何战斗里的敌人（做了数据和立绘却没人用） */
{
  const used = new Set(STAGES.flatMap(([, , foes]) => foes.map(f => f[0])));
  const idle = Object.keys(ENEMIES).filter(k => !used.has(k));
  /* 剧情按原文重写后，《炎之刃》整套敌人（四天王 / 魔王 / 诸神…）连同它们的
     章节一起退役了，全数落在这张表里。逐个列名字会刷掉 40 行，把真问题淹掉，
     所以只报数量 + 前几个；要看全名跑 reach.mjs。 */
  if (idle.length) {
    const head = idle.slice(0, 5).map(k => ENEMIES[k].name).join('、');
    console.log(`! 未被任何战斗使用的敌人 ${idle.length} 种（多数属已退役章节）：${head}${idle.length > 5 ? ' …' : ''}`);
  }
}

console.log('=== 战斗平衡模拟（期望值） ===');
console.log('场次'.padEnd(26), '我方HP', '敌方HP', '我方/轮', '敌/轮', '预计轮数', '生存', '战力偏离', '评价');
let problems = [];
for (const [name, pkey, foes, , tutorial] of STAGES) {
  const heroes = PARTY[pkey].map(([id, lv, eq]) => mkHero(id, lv, eq, PARTY[pkey].gear));
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
      const single = dmgOf(h.atk, eDef0, s.power, h.level, eLv, h.cri, s.hits || 1) * (s.hits || 1);
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
    if (!tutorial) problems.push(name + ' → ' + verdict.join('/') + '（轮数 ' + rounds + '、生存 ' + survive + '）');
  }
  /* 战力对比：和回合数模型互相印证。
     回合数看的是「打多久」，战力比看的是「双方厚度差多少」。
     两个指标同时跑偏，才说明真的失衡。 */
  const pCP = heroes.reduce((a, h) => a + combatPower(h), 0);
  const eCP = es.reduce((a, e) => a + enemyPower(e), 0);
  /* 直接比总和没有意义：四个人打一只首领，总战力本来就该高一截。
     按人数差折一个「应有的比值」，再看实际偏离多少。
     偏离 1.0 越远，说明这场越不对劲。 */
  const ratio = pCP / Math.max(1, eCP);
  const expected = 1 + 0.55 * Math.max(0, heroes.length - es.length);
  const dev = ratio / expected;
  if (!tutorial && dev < 0.62) verdict.push('战力吃紧');
  if (!tutorial && dev > 1.75) verdict.push('战力碾压');
  console.log(name.padEnd(26), String(totalHp).padStart(6), String(eHp).padStart(7), String(pOut).padStart(9), String(eOut).padStart(8), String(rounds).padStart(8), ' 存活' + survive + '轮', ' 战力' + dev.toFixed(2), verdict.join(' '));
}
console.log('\n结论:', problems.length ? '需要调整：' + problems.join('；') : '全部战斗手感在合理区间 ✔');
