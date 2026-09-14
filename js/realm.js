/* ============================================================
   realm.js — 《邪龙逆天》世界观数据层

   这个文件是整个改造的地基。原项目《炎之刃》是单机剧情 RPG：
   等级只是剧情给的数字，装备八阶，没有职业转换，没有外部势力。

   网游文要的是另一套东西——玩家在一个「所有人都在同一个世界里抢」
   的服务器上，靠等级、转职、掉落和公会来确立位置。所以这里定义：

     ① 十一阶装备位阶（苍白之器 → 禁断之器）
     ② 三转职业线（逆骨邪龙 → 逆天邪龙 → 黄金龙神）
     ③ 公会势力与争夺目标
     ④ 网游式经验曲线（等级本身变成玩法，不再是剧情赠品）

   战斗引擎（行动条 / 资源 / 格挡弹反 / 属性克制）沿用原项目，
   这一层挂在它外面，不动 battle.js 的内核。
   ============================================================ */

/* ---------------- 世界 ---------------- */

export const GAME_NAME = '神魔大陆';        // 剧中玩家登录的那款全息网游
export const SERVER_NAME = '第七区·苍梧';

/* ---------------- 十一阶装备位阶 ----------------
   前五阶是凡品，靠打怪和商店就能堆起来；
   仙灵之器开始需要特定副本或剧情；
   圣灭之器是服务器级别的事件产物；
   禁断之器全服只有两件，是后期所有冲突的根源。

   mul   数值倍率（乘在基础曲线上）
   aff   词缀条数
   lv    出现的等级下限
   weight 掉落权重——注意后四阶权重极低，靠掉落几乎不可能拿到，
          设计上它们是「剧情 / 公会战 / 世界 BOSS 的产物」。
   gate  解锁闸门，没满足就完全不进掉落池。 */
export const TIERS = [
  { rank: 1,  name: '苍白之器', col: '#9CA3AF', mul: 1.00, aff: 0, lv: 1,  weight: 40,
    desc: '新手村的凡铁与粗布。人人都有，人人都嫌弃。' },
  { rank: 2,  name: '钢铁之器', col: '#D6D3D1', mul: 1.14, aff: 1, lv: 4,  weight: 30,
    desc: '正经铁匠铺的出品，第一件让你觉得自己不是平民的东西。' },
  { rank: 3,  name: '青铜之器', col: '#22C55E', mul: 1.30, aff: 2, lv: 9,  weight: 18,
    desc: '带上了第一层附魔纹路，小队副本的主要产出。' },
  { rank: 4,  name: '白银之器', col: '#3B82F6', mul: 1.50, aff: 3, lv: 16, weight: 8,
    desc: '公会里能拿出来说一句的装备，通常有明确的流派倾向。' },
  { rank: 5,  name: '黄金之器', col: '#F59E0B', mul: 1.76, aff: 4, lv: 24, weight: 3,
    desc: '一区之内叫得出名字的货色，掉一件够公会吵三天。' },
  { rank: 6,  name: '仙灵之器', col: '#2DD4BF', mul: 2.08, aff: 5, lv: 33, weight: 1.1,
    gate: 'awaken', desc: '灵脉与仙境的造物，讲究共鸣、净化与庇护。龙魂觉醒后才会对你显形。' },
  { rank: 7,  name: '天绝之器', col: '#EF4444', mul: 2.50, aff: 6, lv: 42, weight: 0.4,
    gate: 'reborn2', desc: '触碰天界禁制的极端兵装。带着它上线，天上是会注意到的。' },
  { rank: 8,  name: '神玄之器', col: '#A855F7', mul: 3.05, aff: 7, lv: 52, weight: 0.14,
    gate: 'reborn2', desc: '神格残留凝成的器物，已经不完全服从使用者。' },
  { rank: 9,  name: '亚·圣灭之器', col: '#F0ABFC', mul: 3.75, aff: 8, lv: 63, weight: 0.04,
    gate: 'reborn3', desc: '圣灭的仿品与半成品。仿品尚且如此，真品可想而知。' },
  { rank: 10, name: '圣灭之器', col: '#FDE68A', mul: 4.70, aff: 9, lv: 75, weight: 0.008,
    gate: 'reborn3', desc: '全服公告级别的产物。掉落的那一刻，所有大公会都会知道它在谁手上。' },
  { rank: 11, name: '禁断之器', col: '#FF3B6B', mul: 6.20, aff: 10, lv: 88, weight: 0,
    gate: 'never', desc: '全服仅两件，不掉落、不交易、不能被夺走——只能被继承。' },
];

export const TIER_BY_RANK = {};
for (const t of TIERS) TIER_BY_RANK[t.rank] = t;
export const MAX_TIER = 11;

/* ---------------- 禁断之器 ----------------
   weight 为 0，永远不进随机掉落池。它们只能由剧情授予。
   两件的定位是刻意对立的：一件属于「死过一次的人」，
   一件属于「还没决定要怎么死的人」。 */
export const FORBIDDEN = {
  bilo: {
    id: 'bilo', name: '碧落黄泉', tier: 11, slot: 'weapon', type: '刀剑',
    flavor: '上有碧落，下有黄泉——两端都走到过的人，才提得动它。',
    // 双刃：伤害极高，但每次挥击自伤，血越少反而越强
    eff: { lifesteal: 0.18, lowHpAtk: 0.45, recoil: 0.06, pierce: 0.22 },
    note: '攻击时按最大生命 6% 自伤；生命低于 40% 时攻击力 +45%。',
  },
  fate: {
    id: 'fate', name: '命运之刻', tier: 11, slot: 'acc', type: '护符',
    flavor: '它不改变结果，只让你在结果落下之前，多看一眼。',
    // 不给纯数值，给「重来一次」的权利
    eff: { lastStand: 1, foresight: 1, statusRes: 0.35, extraTurn: 0.15 },
    note: '每场战斗一次，致命伤后残留 1 点生命；可预读敌方下一次行动。',
  },
};

/* ---------------- 三转职业线 ----------------
   原项目里角色一入队职业就定死了。网游文的核心爽点之一是转职：
   同一个角色在剧情节点上整个换一套打法、换立绘、换资源机制。

   每一转都要求：等级达标 + 完成对应的剧情试炼。
   光刷等级转不了，光推剧情也转不了——两条腿都得走。 */
export const CLASS_LINE = [
  {
    stage: 0, id: 'novice', name: '无职', short: '无职',
    lv: 1, trial: null,
    desc: '刚登录的普通玩家。系统给了一把苍白之器，仅此而已。',
    resource: 'mp', resourceName: '术力',
  },
  {
    stage: 1, id: 'nigu', name: '逆骨邪龙', short: '逆骨',
    lv: 10, trial: 'trial_dragonsoul',
    desc: '龙魂初醒。骨中逆纹浮出，攻击带上不讲道理的暴戾，' +
          '但每一次爆发都要拿自己的血去换。',
    resource: 'soul', resourceName: '龙魂',
    grant: { atk: 26, hp: 180, cri: 0.06 },
    skills: ['ni_claw', 'ni_scale', 'ni_roar'],
  },
  {
    stage: 2, id: 'nitian', name: '逆天邪龙', short: '逆天',
    lv: 40, trial: 'trial_defysky',
    desc: '光暗双龙魂同时运转。这一转之后，天上开始正式把你当成一个问题。',
    resource: 'soul', resourceName: '龙魂',
    grant: { atk: 88, hp: 620, cri: 0.10, spd: 12 },
    skills: ['ni_twin', 'ni_abyss', 'ni_defy'],
  },
  {
    stage: 3, id: 'longshen', name: '黄金龙神', short: '龙神',
    lv: 70, trial: 'trial_goldendragon',
    desc: '前世自爆的那一份龙魂，终于被自己捡了回来。',
    resource: 'soul', resourceName: '龙魂',
    grant: { atk: 240, hp: 1800, cri: 0.16, spd: 30, par: 0.10 },
    skills: ['ni_golden', 'ni_judgement', 'ni_rebirth'],
  },
];

export const CLASS_BY_STAGE = {};
for (const c of CLASS_LINE) CLASS_BY_STAGE[c.stage] = c;

/* 支线身份：不替换主职业，是在主线之外另开的「兼职」。
   每个都挂在一段支线剧情上，拿到之后作为被动常驻。 */
export const SUB_IDENTITIES = {
  beastEnvoy: { id: 'beastEnvoy', name: '幻兽神使', unlock: 'q_beast',
    desc: '可召唤幻兽协战，战斗中多一个行动位。', eff: { summon: 1 } },
  clawKing: { id: 'clawKing', name: '深渊的爪皇', unlock: 'q_abyss',
    desc: '前世被围剿的直接原因。对「天界」阵营伤害 +30%。', eff: { vsHeaven: 0.30 } },
  warSaint: { id: 'warSaint', name: '魔武圣', unlock: 'q_warsaint',
    desc: '近身压制。格挡成功后必定反击。', eff: { guardCounter: 1 } },
  dawnArcher: { id: 'dawnArcher', name: '黎明圣射手', unlock: 'q_dawn',
    desc: '远程精准。会心伤害 +40%，对首领额外 +15%。',
    eff: { critDmg: 0.40, bossBane: 0.15 } },
};

/* ---------------- 等级与经验 ----------------
   网游曲线：前期给得快，让玩家尝到「一晚上跳三级」的甜头；
   30 级以后拉开，转职节点（10/40/70）前后各有一个缓冲带。 */
export const MAX_LEVEL = 99;

export function expToNext(level) {
  if (level >= MAX_LEVEL) return Infinity;
  // 分段曲线：1-9 冲刺 / 10-39 平稳 / 40-69 拉长 / 70+ 陡峭
  if (level < 10) return Math.round(60 * Math.pow(level, 1.35) + 40);
  if (level < 40) return Math.round(210 * Math.pow(level, 1.42));
  if (level < 70) return Math.round(430 * Math.pow(level, 1.55));
  return Math.round(980 * Math.pow(level, 1.68));
}

/* 打死一个等级 lv 的怪给多少经验。等级压制双向生效：
   越级打高给额外奖励，碾压低级怪几乎没有收益——
   逼玩家往前走，而不是在安全区刷一整晚。 */
export function expFromKill(enemyLv, playerLv, isBoss = false) {
  const base = 14 * Math.pow(enemyLv, 1.28);
  const gap = enemyLv - playerLv;
  let k = 1;
  if (gap >= 0) k = 1 + Math.min(gap, 10) * 0.12;        // 越级最多 +120%
  else k = Math.max(0.04, Math.pow(0.82, -gap));          // 低级怪迅速归零
  return Math.max(1, Math.round(base * k * (isBoss ? 6.5 : 1)));
}

/* ---------------- 公会势力 ----------------
   原项目没有「别的玩家」。网游文里最重要的对手从来不是 BOSS，
   是别的公会——他们和你抢同一个刷新点、同一件掉落、同一个首杀。

   power 是势力值，会随剧情推进变化；
   stance 决定他们见到你时的默认态度。 */
export const GUILDS = {
  player: {
    id: 'player', name: '无名', tag: '—', col: '#FF3B6B',
    desc: '你还没有公会。在这个服务器上，这意味着你谁也不是。',
    power: 0, stance: 'self',
  },
  tianque: {
    id: 'tianque', name: '天阙', tag: '【天阙】', col: '#FDE68A',
    desc: '第七区第一大公会。会长「执圭」是全服第一个满级的人，' +
          '也是第一个宣布「禁断之器必须归公会所有」的人。',
    power: 100, stance: 'hostile',
  },
  xuanming: {
    id: 'xuanming', name: '玄冥', tag: '【玄冥】', col: '#A855F7',
    desc: '暗杀与情报起家，不抢首杀，只抢掉落。' +
          '他们不在乎你是谁，只在乎你身上那件东西值多少。',
    power: 72, stance: 'hostile',
  },
  luoxia: {
    id: 'luoxia', name: '落霞', tag: '【落霞】', col: '#2DD4BF',
    desc: '由散人和被大公会挤出来的人拼起来的联盟。人多，但不齐。' +
          '他们需要一个能站在最前面的人。',
    power: 48, stance: 'neutral',
  },
  jiuyou: {
    id: 'jiuyou', name: '九幽', tag: '【九幽】', col: '#7C3AED',
    desc: '不像玩家公会——没有招募，没有频道，成员全部顶着同一个空白头像。' +
          '有人说他们根本不是玩家。',
    power: 88, stance: 'unknown',
  },
};

/* 公会战争夺目标：网游文的「战场」不是随机遭遇，是有明确战利品的。 */
export const WAR_OBJECTIVES = {
  spawn: { id: 'spawn', name: '刷新点', desc: '占住世界 BOSS 的刷新坐标，独享首杀。' },
  vein: { id: 'vein', name: '灵脉', desc: '持有期间全会成员经验获取 +25%。' },
  gate: { id: 'gate', name: '传送阵', desc: '控制跨区通道，决定谁能进下一张地图。' },
  relic: { id: 'relic', name: '遗物', desc: '直接指向一件圣灭之器的坐标。' },
};

/* ---------------- 阵营 ----------------
   前世线遗留：天界围剿过你，魔龙族是你母亲那一边。
   这个字段会影响伤害计算（爪皇身份对天界 +30%）和部分剧情分支。 */
export const FACTIONS = {
  player: { id: 'player', name: '玩家' },
  heaven: { id: 'heaven', name: '天界', col: '#FDE68A' },
  demon: { id: 'demon', name: '魔龙族', col: '#FF3B6B' },
  abyss: { id: 'abyss', name: '深渊', col: '#7C3AED' },
  neutral: { id: 'neutral', name: '中立', col: '#9CA3AF' },
};

/* ---------------- 查询辅助 ---------------- */

export function tierInfo(rank) {
  return TIER_BY_RANK[Math.max(1, Math.min(MAX_TIER, rank))] || TIER_BY_RANK[1];
}

/* 当前存档开到了第几阶。转职进度是主闸门——
   没觉醒龙魂的人，仙灵之器对他来说根本不显形。 */
export function tierUnlocked(rank, ctx = {}) {
  const t = TIER_BY_RANK[rank];
  if (!t) return false;
  const stage = ctx.classStage || 0;
  switch (t.gate) {
    case 'awaken': return stage >= 1;
    case 'reborn2': return stage >= 2;
    case 'reborn3': return stage >= 3;
    case 'never': return false;          // 禁断之器只能由剧情授予
    default: return true;
  }
}

/* 能不能转下一职 —— 等级和试炼缺一不可，面板上要能说清缺哪个 */
export function canAdvance(level, stage, flags = {}) {
  const next = CLASS_BY_STAGE[stage + 1];
  if (!next) return { ok: false, why: '已经走到这条路的尽头。' };
  if (level < next.lv) return { ok: false, why: `需要等级 ${next.lv}（当前 ${level}）`, next };
  if (next.trial && !flags[next.trial]) return { ok: false, why: `需要完成试炼：${next.name}之证`, next };
  return { ok: true, next };
}

export default {
  GAME_NAME, SERVER_NAME, TIERS, TIER_BY_RANK, MAX_TIER, FORBIDDEN,
  CLASS_LINE, CLASS_BY_STAGE, SUB_IDENTITIES, GUILDS, WAR_OBJECTIVES, FACTIONS,
  MAX_LEVEL, expToNext, expFromKill, tierInfo, tierUnlocked, canAdvance,
};
