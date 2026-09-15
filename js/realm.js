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

export const GAME_NAME = '命运';        // 查证自第一卷第二章「《命运》世界」
export const SERVER_NAME = '';         // 书中是否分区未知

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

/* ---------------- 属性体系（按原文） ----------------
   原文第 2~3 章给的是三层结构，本项目照搬：

     ① 自由属性 25 点 —— 力量 / 体质 / 敏捷 / 精神，每项 4~10，
        升级可继续获得自由属性点。
     ② 固定属性 10 点 —— 幸运 / 悟性 / 魅力，每项 0~10，
        **不随升级增长**，只能靠装备或特殊途径提升。
     ③ 天赋属性 —— 反应力 / 感知力 / 专注力，由系统扫描得来，
        等同于玩家在现实世界的能力，不可分配。常人平均 7~10。

   叶天邪的实际选择（原文）：
     自由 力量10 / 体质7 / 敏捷4 / 精神4
     固定 魅力10 / 幸运0 / 悟性0
     天赋 反应力72 / 感知力53 / 专注力42（约七倍于常人）
*/

export const FREE_POINTS = 25;          // 初始自由属性点
export const FREE_MIN = 4, FREE_MAX = 10;
export const FIXED_POINTS = 10;         // 初始固定属性点
export const FIXED_MIN = 0, FIXED_MAX = 10;

/* 自由属性。conv 是原文给出的「战士」换算，直接照抄：
     1 力量 = 2 物攻
     1 体质 = 10 生命 + 1 防御
     1 敏捷 = 1 回避 + 1 命中
     1 精神 = 2 魔攻 + 10 魔法值 */
export const FREE_STATS = [
  { id: 'str', name: '力量', col: '#ff8048', desc: '物理攻击 +2',
    conv: { atk: 2 } },
  { id: 'vit', name: '体质', col: '#7dffa8', desc: '生命 +10　防御 +1',
    conv: { hp: 10, def: 1 } },
  { id: 'agi', name: '敏捷', col: '#8fe6ff', desc: '回避 +1　命中 +1',
    conv: { eva: 1, acc: 1 } },
  { id: 'spi', name: '精神', col: '#c08ad6', desc: '魔法攻击 +2　魔法值 +10',
    conv: { matk: 2, mp: 10 } },
];

/* 固定属性。原文明确写了各自管什么，效果按原文实现——
   尤其是幸运：原文系统警告「幸运为 0，爆率和暴击率会降到最低，
   攻击时全部取攻击值的下限」。这条在本项目里是真生效的。 */
export const FIXED_STATS = [
  { id: 'luck', name: '幸运', col: '#ffd24a',
    desc: '爆率、暴击率、偶然事件成功率' },
  { id: 'wit', name: '悟性', col: '#7fd8c0',
    desc: '领悟能力；每点额外 +0.3% 经验' },
  { id: 'chm', name: '魅力', col: '#ff8ab0',
    desc: '命运世界居民与动物对你的好感' },
];

/* 天赋属性。原文：等同现实世界的能力，由系统扫描，不可分配。
   常人平均 7~10；叶天邪 72 / 53 / 42。
   本项目把它接到战斗里——这是主角在「没有职业」阶段唯一的依仗。 */
export const TALENT_STATS = [
  { id: 'react', name: '反应力', col: '#ff6a8a',
    desc: '对外界刺激快速做出反应的能力' },
  { id: 'sense', name: '感知力', col: '#8fd8ff',
    desc: '感受外界刺激的范围和能力' },
  { id: 'focus', name: '专注力', col: '#c9a8ff',
    desc: '凝聚精神不受外界刺激影响的能力' },
];

export const TALENT_AVG = 8.5;          // 原文「平均为 7 到 10 左右」

/* 自由属性 → 派生属性 */
export function applyFreeStats(s, alloc = {}) {
  for (const st of FREE_STATS) {
    const v = alloc[st.id] || 0;
    for (const [k, mul] of Object.entries(st.conv)) {
      s[k] = (s[k] || 0) + v * mul;
    }
  }
  return s;
}

/* 固定属性的实际效果 */

/* 幸运 → 暴击率。原文：幸运 0 时暴击率「降到最低」。
   这里取 0 幸运 = 0% 暴击，满幸运 = 25%。 */
export function luckCrit(luck = 0) {
  return Math.max(0, Math.min(10, luck)) * 0.025;
}

/* 幸运 → 伤害浮动区间。原文：幸运 0「攻击时全部取攻击值的下限」。
   所以 0 幸运的人每一刀都是最小值，没有任何运气可言；
   幸运越高，浮动区间的上沿越高。 */
export function luckRoll(luck = 0) {
  const k = Math.max(0, Math.min(10, luck)) / 10;
  /* 「下限」就是面板攻击力本身，幸运只往上加，不往下扣。
     这样原文的两组伤害数字才对得上（见 battle.js 的 computeDamage 注释）：
     物攻 23 打野狼 = 15，物攻 94 打同一只 = 86。
     此前 lo 写成 0.94，等于幸运 0 的人白白少 6% 伤害，和原文差一截。 */
  return { lo: 1, hi: 1 + 0.18 * k };          // luck 0 → [1, 1] 恒定取下限
}

/* 幸运 → 掉落率倍率（原文的「爆率」） */
export function luckDrop(luck = 0) {
  return 1 + Math.max(0, Math.min(10, luck)) * 0.08;
}

/* 悟性 → 经验加成。原文：每多一点悟性额外获得 0.3% 经验。 */
export function witExp(wit = 0) {
  return 1 + Math.max(0, Math.min(10, wit)) * 0.003;
}

/* 魅力 → NPC / 动物好感。原文没给数值，这里做成一个 0~1 的系数，
   供剧情判定「能不能从 NPC 嘴里问出东西」。 */
export function charmFavor(chm = 0) {
  return Math.max(0, Math.min(10, chm)) / 10;
}

/* 天赋属性 → 战斗数值。
   原文没给换算公式（它只是个扫描出来的数字），这部分是本项目的设计：
   常人（TALENT_AVG）处收益为 0——天赋属性衡量的是「比常人强多少」，
   一个普通人不该因为「有反应力」就白拿闪避。超出常人的部分才折算，
   且收益递减，所以七倍于常人很强，但不会变成免疫一切攻击。 */
function talentScale(v, cap, k = 0.35) {
  const x = Math.max(0, v) / TALENT_AVG;            // 常人 = 1
  const over = Math.max(0, x - 1);                  // 超出常人的倍数
  return cap * (1 - 1 / (1 + over * k));            // over=0 → 0；over→∞ → cap
}
/* ⚠ 原文没有给闪避公式，只给了结果——而结果非常极端：
   第9章「一个等级0级、全身新手装备的玩家竟独立对战着三只五级的怪物，
   而在他连续攻出十几次后，三只行动力很强的怪物却连碰到没有碰到他」，
   整场唯一挨的一下还是他自己「动作缓了一缓，任由那狼爪拍在他的身上」故意挨的。
   所以 cap 必须高到让反应力 72 的人面对 5 级野狼近乎不可命中，
   否则原文里「0 级单挑三只五级狼」这件事在游戏里根本不成立。
   0.42 是上一版按「不能太强」拍的，与原文相悖。 */
/* 反应力 → 闪避。k = 6.2 是按原文的**结果**反解的，不是拍的：
     第9章「一个等级0级、全身新手装备的玩家竟独立对战着三只五级的怪物，
     而在他连续攻出十几次后，三只行动力很强的怪物却连碰到没有碰到他」，
     整场唯一挨的一下是他「动作缓了一缓，任由那狼爪拍在他的身上」故意挨的。
   反应力 72 代进去得 0.93，再被 battle.js 夹到 0.92 —— 野狼约 8% 命中，
   一场下来正好挨一两下，和原文吻合。常人（8.5）处仍然是 0。
   ⚠ 曲线形状本身原文未给，只有「叶天邪不可命中」这一个观测点。 */
export function reactEvade(react = TALENT_AVG) { return talentScale(react, 0.95, 6.2); }
export function senseAccuracy(sense = TALENT_AVG) { return talentScale(sense, 0.30); }
export function focusResist(focus = TALENT_AVG) { return talentScale(focus, 0.45); }

/* ---------------- 七大基础职业（原文第3章） ---------------- */
export const BASE_CLASSES = [
  { id: 'warrior', name: '战士', desc: '强大的物理攻击与相对强大的物理防御，近战输出核心。行动力、命中、回避相对薄弱。' },
  { id: 'guard', name: '盾卫', desc: '防御专长。' },
  { id: 'archer', name: '弓箭手', desc: '远程物理，主属性偏敏捷。' },
  { id: 'assassin', name: '刺客', desc: '高爆发近战，脆。' },
  { id: 'priest', name: '牧师', desc: '治疗与增益。' },
  { id: 'mage', name: '魔法师', desc: '远程法术输出。' },
  { id: 'summoner', name: '召唤师', desc: '召唤协战。' },
];

/* ---------------- 三转职业线 ----------------
   原项目里角色一入队职业就定死了。网游文的核心爽点之一是转职：
   同一个角色在剧情节点上整个换一套打法、换立绘、换资源机制。

   ⚠ 职业名查证自百科；**等级门槛 10/40/70 与试炼是本项目自配**，原著未考证。

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
/* ---------------- 等级与经验（按原文校准） ----------------

   ⚠ 这里曾经有两套：realm.js 一套（99 级、分段曲线、等级压制），
   characters.js 一套（50 级、42+lv²*3.2、无等级压制），而游戏跑的是后者，
   realm.js 这套没有任何人 import——等于「等级压制」一天都没生效过。
   2026-09-15 按原文收敛成这一套，characters.js 的重复定义已删除。

   原文给出的硬数字（第12章「爱哭萝莉和冷酷主人」）：

     「《命运》的升级前所未有的艰难，0级的状态越5级杀了九只野狼才完成了
       从零到一的跨越。而从一级到二级的跨越难度又足足提升了十倍……
       零级到一级需要的是100点的经验值，而一级到二级却是整整1000点。
       如此夸张的跨越幅度虚拟游戏历史上从未有之。」

   于是三件事是原文钉死的，不许动：
     ① 玩家从 **0 级** 起步（第8章：「0级，身上只有没什么属性的新手衣」）
     ② 0→1 = 100 点经验
     ③ 1→2 = 1000 点经验
*/

/* ⚠ 原文未考证：等级上限。原文读到的最高等级是第102章的 15 级，
   没有任何一处提到上限是多少。99 是沿用值，不是查证结果。 */
export const MAX_LEVEL = 99;

export function expToNext(level) {
  if (level >= MAX_LEVEL) return Infinity;
  if (level <= 0) return 100;      // 原文：零级到一级需要 100 点
  if (level === 1) return 1000;    // 原文：一级到二级整整 1000 点
  /* ⚠ 原文未考证：2 级以后的阈值一处都没写。
     已知的只有节奏——他在第17章 1 级、第19章 2 级、第20章 3 级、第23章 4 级，
     然后第46章才 11 级、第92章 12 级、第102章 15 级：前几级很快，之后迅速拉长。
     所以这里从 1000 起按幂律往上走，而不是继续「每级十倍」（那会直接崩掉）。 */
  return Math.round(1000 * Math.pow(level, 1.55));
}

/* 打死一个等级 lv 的怪给多少经验。

   两个校准点都来自原文，常数是按它们反解出来的：
     · 5 级野狼 → 0 级玩家：**11**（原文「越5级杀了九只野狼」完成 0→1，即 100/9）
     · 5 级三星 BOSS 巨型凶狼 → 1 级玩家：**400**（原文第17章明写「获得经验值400」）

   等级压制：原文没有给公式，但方向是明写的——第88章「他扛着不到100的生命值
   一群群猎杀15级的怪物，同一单位时间内所获得经验值无疑要数倍的多出普通练级玩家」。
   ⚠ 越级 +12%/级、碾压 ×0.82^n 这两个系数是本项目自配，原文未考证。 */
/* 由原文反解：每只 5 级野狼对 0 级玩家给 12 点。
   必须是 12 不是 11——原文说「杀了九只野狼才完成从零到一的跨越」，
   意思是第 9 只那一下正好跨过 100：8 只 = 96 不够，9 只 = 108 够了。
   取 11 的话 9 只只有 99，差 1 点升不上去，就和原文对不上了。 */
const EXP_BASE = 0.957;   // 拟合值：同时满足上面两个原文校准点
const STAR_MUL = {          // ⚠ 只有 3 星是原文钉死的（400），其余按原文的
  1: 3,                     //    「1星超出普通怪1-2倍、2星超出1星1-2倍」推的
  2: 9,
  3: 36,                    // 原文：5级三星BOSS对1级玩家 = 400
};
export function expFromKill(enemyLv, playerLv, opts = {}) {
  const star = typeof opts === 'object' ? (opts.star || (opts.boss ? 3 : 0)) : (opts ? 3 : 0);
  const base = EXP_BASE * Math.pow(enemyLv, 1.28);
  const gap = enemyLv - playerLv;
  let k = 1;
  if (gap >= 0) k = 1 + Math.min(gap, 10) * 0.12;        // 越级最多 +120%
  else k = Math.max(0.04, Math.pow(0.82, -gap));          // 低级怪迅速归零
  return Math.max(1, Math.round(base * k * (STAR_MUL[star] || 1)));
}

/* ---------------- 公会势力 ----------------
   原项目没有「别的玩家」。网游文里最重要的对手从来不是 BOSS，
   是别的公会——他们和你抢同一个刷新点、同一件掉落、同一个首杀。

   power 是势力值，会随剧情推进变化；
   stance 决定他们见到你时的默认态度。 */
export const GUILDS = {
  /* ⚠ 已拆除：天阙 / 玄冥 / 落霞 / 九幽 四个公会是原创虚构，原著中不存在，已删。
     目前唯一查证到的组织是「天魂佣兵团」，但它的定位、规模、与主角的关系都不清楚，
     所以只留一个占位条目，不敢给数值。补齐需要原文。 */
  player: {
    id: 'player', name: '无', tag: '—', col: '#FF3B6B',
    desc: '主角起步时没有任何组织归属。', power: 0, stance: 'self',
  },
  tianhun: {
    id: 'tianhun', name: '天魂佣兵团', tag: '【天魂】', col: '#FDE68A',
    desc: '原著中出现过的组织。具体设定待考证。',
    power: null, stance: 'unknown', unverified: true,
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
  GAME_NAME, SERVER_NAME,
  FREE_POINTS, FREE_MIN, FREE_MAX, FIXED_POINTS, FIXED_MIN, FIXED_MAX,
  FREE_STATS, FIXED_STATS, TALENT_STATS, TALENT_AVG, BASE_CLASSES,
  applyFreeStats, luckCrit, luckRoll, luckDrop, witExp, charmFavor,
  reactEvade, senseAccuracy, focusResist, TIERS, TIER_BY_RANK, MAX_TIER, FORBIDDEN,
  CLASS_LINE, CLASS_BY_STAGE, SUB_IDENTITIES, GUILDS, WAR_OBJECTIVES, FACTIONS,
  MAX_LEVEL, expToNext, expFromKill, tierInfo, tierUnlocked, canAdvance,
};
