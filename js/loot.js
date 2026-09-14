/* ============================================================
   loot.js — 战利品

   装备名称、品质与主题全部来自策划稿 equipment-catalog.json（512 件），
   本文件只负责把「名字」变成「能打的东西」：
     品质 → 数值档位、词缀条数、可掉落的等级下限
     主题 → 属性倾向（余烬偏炎、薄霜偏冰、疾风偏速……）
     类别 → 基础属性曲线（刀剑高攻、护甲高防、戒指偏特效）

   同一件「绯焰骑士剑」在不同周目会带不同词缀，
   所以 512 个名字撑得起远多于 512 种实际装备。

   生成结果注册进 characters.js 的 EQUIPS 表，
   面板、商店、存档、statsAt 全部沿用原有的 id 查表逻辑。
   ============================================================ */
import { EQUIPS } from './characters.js';
import { CATALOG, CATALOG_RARITIES } from './equipment-data.js';
import { TIERS, MAX_TIER } from './realm.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const chance = p => Math.random() < p;
const roundTo = (v, step) => Math.round(v / step) * step;

/* ---------------- 品质 ----------------
   rank 1~8。affixes 是词缀条数，mul 是数值倍率，
   lv 是这个品质「开始出现」的等级下限——低品质不会在后期刷屏，
   高品质也不会在序章掉出来。 */
export const RARITY_RANK = {};
for (const r of CATALOG_RARITIES) RARITY_RANK[r.rank] = r;

/* 十一阶位阶的数值档位来自 realm.js —— 那里是唯一事实来源，
   这里只是把它转成 loot 内部用的形状，避免两处各写一份数字。

   设计意图：**白银之器（4）足以走完目前已实现的流程**。
   黄金与仙灵（5~6）是龙魂觉醒后的正常成长线；
   天绝 / 神玄（7~8）要二转；亚圣灭 / 圣灭（9~10）要三转；
   禁断之器（11）weight 为 0，永远不进掉落池，只能由剧情授予。 */
const RARITY_TUNE = {};
for (const t of TIERS) {
  RARITY_TUNE[t.rank] = { affixes: t.aff, mul: t.mul, lv: t.lv, weight: t.weight, gate: t.gate };
}

/* 当前存档能开到第几阶。main.js 每次生成掉落前把上下文喂进来。
   闸门主要看转职进度——没觉醒龙魂的人，仙灵之器对他根本不显形。 */
let unlockCtx = { ngPlus: 0, flags: {}, classStage: 0 };
export function setLootContext(ctx) {
  unlockCtx = ctx || { ngPlus: 0, flags: {}, classStage: 0 };
}

function gateOpen(gate) {
  if (!gate) return true;
  const ng = unlockCtx.ngPlus || 0;
  const stage = unlockCtx.classStage || 0;
  switch (gate) {
    case 'awaken': return stage >= 1 || ng > 0;   // 仙灵：一转·逆骨邪龙
    case 'reborn2': return stage >= 2 || ng > 0;  // 天绝 / 神玄：二转·逆天邪龙
    case 'reborn3': return stage >= 3;            // 亚圣灭 / 圣灭：三转·黄金龙神
    case 'never': return false;                   // 禁断之器：剧情授予，不掉落
    default: return true;
  }
}
export function rarityInfo(rank) {
  const base = RARITY_RANK[rank] || RARITY_RANK[1];
  return { ...base, ...RARITY_TUNE[rank] };
}

/* ---------------- 类别 → 基础属性曲线 ----------------
   每级成长值，再乘品质倍率。 */
const TYPE_CURVE = {
  '刀剑': { slot: 'weapon', atk: 1.35, cri: 0.02 },
  '长枪': { slot: 'weapon', atk: 1.18, spd: 0.14 },
  '法杖': { slot: 'weapon', atk: 0.78, mp: 2.6 },
  '弓弩': { slot: 'weapon', atk: 1.22, cri: 0.035, spd: 0.06 },
  '护甲': { slot: 'armor', def: 1.55, hp: 3.4, blk: 0.02 },
  '披风': { slot: 'armor', def: 0.95, spd: 0.12, par: 0.02, hp: 1.8 },
  '戒指': { slot: 'acc', atk: 0.38, mp: 1.2 },
  '护符': { slot: 'acc', hp: 2.6, def: 0.32 },
};

/* 类别推荐给谁用（面板上给个提示，不做硬限制） */
export const TYPE_OWNER = { '刀剑': 'kaito', '长枪': 'lei', '法杖': 'cang', '弓弩': 'lei' };

/* ---------------- 主题 → 属性倾向 ----------------
   让「薄霜」系真的偏冰、「疾风」系真的快，名字和手感对得上。
   没列出的主题走默认，只受品质与类别影响。 */
const THEME_TRAIT = {
  /* 1 普通 —— 只给一点属性倾向，不给特效 */
  '村镇锻造': {}, '行脚旅人': { stat: 'spd' }, '山林猎户': { stat: 'cri' },
  '边城兵卒': { stat: 'def' }, '初习术法': { stat: 'mp' }, '海岸工坊': { stat: 'hp' },
  '古道商队': { stat: 'hp' }, '废堡遗物': { stat: 'def' },

  /* 2 优秀 —— 属性倾向开始成型 */
  '赤矿火纹': { elem: 'fire' }, '北地寒铁': { elem: 'ice' }, '游猎疾风': { stat: 'spd' },
  '雷纹银器': { elem: 'thunder' }, '幽林毒牙': { elem: 'dark' }, '暗巷夜猎': { elem: 'dark' },
  '清泉水晶': { stat: 'mp' }, '白昼祈祷': { elem: 'holy' },

  /* 3 精良 —— 各军团/学派的制式品，带一条特效 */
  '赤焰军团': { elem: 'fire', eff: 'burnChance' }, '苍霜城堡': { elem: 'ice', eff: 'flatCut' },
  '苍穹游骑': { stat: 'spd', eff: 'firstStrike' }, '雷谷遗迹': { elem: 'thunder', eff: 'critDmg' },
  '苍木秘境': { elem: 'holy', eff: 'hpRegen' }, '古墓夜歌': { elem: 'dark', eff: 'lifesteal' },
  '圣堂旧藏': { elem: 'holy', eff: 'statusRes' }, '荒沙王庭': { stat: 'def', eff: 'thorns' },

  /* 4 史诗 —— 绑着第一部的首领与事件，掉落也跟着它们走 */
  '赤狱战场': { elem: 'fire', eff: 'bossBane' }, '失落冰庭': { elem: 'ice', eff: 'freezePower' },
  '影廊禁卫': { elem: 'dark', eff: 'pierce' }, '古森遗誓': { eff: 'thorns' },
  '雷霆王墓': { elem: 'thunder', eff: 'echo' }, '深海亡国': { stat: 'mp', eff: 'mpPlus' },
  '黎明圣战': { elem: 'holy', eff: 'holyPower' }, '旧日英雄': { eff: 'lastStand' },

  /* 5 仙灵 —— 第七章。共鸣、净化、庇护 */
  '青岚灵境': { stat: 'spd', eff: 'echo' }, '寒月灵池': { elem: 'ice', eff: 'hpRegen' },
  '丹霞火山': { elem: 'fire', eff: 'burnChance' }, '万木仙庭': { elem: 'holy', eff: 'hpRegen' },
  '星河旧渡': { stat: 'mp', eff: 'mpPlus' }, '神兽遗谷': { eff: 'weakHunter' },
  '幽梦仙乡': { elem: 'dark', eff: 'statusRes' }, '玉海仙岛': { stat: 'hp', eff: 'flatCut' },

  /* 6 天绝 —— 第八章。破防、封禁、改变战局 */
  '断界遗兵': { eff: 'pierce' }, '吞日禁域': { elem: 'fire', eff: 'critDmg' },
  '逆血魔城': { elem: 'dark', eff: 'lifesteal' }, '长夜死境': { elem: 'dark', eff: 'sealPower' },
  '星陨荒原': { eff: 'critDmg' }, '神罚废墟': { eff: 'bossBane' },
  '永寂冰渊': { elem: 'ice', eff: 'freezePower' }, '命轮裂隙': { eff: 'lastStand' },

  /* 7 神器 —— 第九章七柱。神权 */
  '原初炎庭': { elem: 'fire', eff: 'burnChance' }, '太古雪国': { elem: 'ice', eff: 'freezePower' },
  '天雷神庭': { elem: 'thunder', eff: 'extraTurn' }, '苍生神木': { elem: 'holy', eff: 'hpRegen' },
  '星海神殿': { stat: 'mp', eff: 'mpPlus' }, '白昼王座': { elem: 'holy', eff: 'holyPower' },
  '幽月王座': { elem: 'dark', eff: 'lifesteal' }, '古神遗誓': { eff: 'guardCounter' },

  /* 8 超神器 —— 终幕。世界规则 */
  '创生遗器': { eff: 'allStat' }, '终末遗器': { eff: 'critDmg' },
  '时序禁器': { eff: 'extraTurn' }, '命途禁器': { eff: 'dodge' },
  '虚实禁器': { eff: 'dodge' }, '轮回禁器': { eff: 'echo' },
  '自由禁器': { eff: 'firstStrike' }, '不熄之约': { eff: 'ragePlus' },
};

/* ---------------- 词缀 ----------------
   名字已经由图鉴决定，词缀只出现在说明里，不再拼进名称。 */
export const AFFIXES = [
  { id: 'atk', name: '锋锐', stat: 'atk', v: [0.24, 0.48], text: n => `攻击力 +${n}` },
  { id: 'def', name: '坚壁', stat: 'def', v: [0.24, 0.48], text: n => `防御力 +${n}` },
  { id: 'hp', name: '厚生', stat: 'hp', v: [1.8, 3.6], text: n => `生命上限 +${n}` },
  { id: 'mp', name: '通灵', stat: 'mp', v: [1.4, 2.8], text: n => `术力上限 +${n}` },
  { id: 'spd', name: '轻捷', stat: 'spd', v: [0.14, 0.30], text: n => `速度 +${n}` },
  { id: 'cri', name: '锐目', stat: 'cri', pctStat: true, v: [0.03, 0.07], text: n => `会心率 +${pct(n)}` },
  { id: 'blk', name: '稳架', stat: 'blk', pctStat: true, v: [0.03, 0.06], text: n => `格挡率 +${pct(n)}` },
  { id: 'par', name: '巧劲', stat: 'par', pctStat: true, v: [0.02, 0.05], text: n => `弹反率 +${pct(n)}` },

  { id: 'lifesteal', name: '吸血', eff: 'lifesteal', v: [0.05, 0.13], text: n => `造成伤害的 ${pct(n)} 回复自身生命` },
  { id: 'thorns', name: '荆棘', eff: 'thorns', v: [0.09, 0.24], text: n => `受到伤害时反弹 ${pct(n)}` },
  { id: 'ragePlus', name: '怒涛', eff: 'ragePlus', v: [0.15, 0.40], text: n => `怒气获取量 +${pct(n)}` },
  { id: 'breakPlus', name: '破势', eff: 'breakPlus', v: [1, 1], int: true, text: () => '击中弱点时击破槽额外 +1' },
  { id: 'critDmg', name: '致命', eff: 'critDmg', v: [0.12, 0.32], text: n => `会心伤害 +${pct(n)}` },
  { id: 'pierce', name: '贯穿', eff: 'pierce', v: [0.07, 0.20], text: n => `无视目标 ${pct(n)} 防御` },
  { id: 'firstStrike', name: '先手', eff: 'firstStrike', v: [10, 28], int: true, text: n => `开战时行动条 +${n}` },
  { id: 'hpRegen', name: '回春', eff: 'hpRegen', v: [0.018, 0.05], text: n => `每回合回复 ${pct(n)} 生命` },
  { id: 'mpPlus', name: '涌泉', eff: 'mpPlus', v: [2, 6], int: true, text: n => `每回合额外回复 ${n} 术力` },
  { id: 'burnChance', name: '燃焰', eff: 'burnChance', v: [0.10, 0.28], text: n => `攻击有 ${pct(n)} 概率点燃目标` },
  { id: 'statusRes', name: '守誓', eff: 'statusRes', v: [0.15, 0.40], text: n => `${pct(n)} 概率免疫异常状态` },
  { id: 'weakHunter', name: '猎弱', eff: 'weakHunter', v: [0.10, 0.28], text: n => `对弱点目标伤害 +${pct(n)}` },
  { id: 'bossBane', name: '弑王', eff: 'bossBane', v: [0.08, 0.22], text: n => `对首领伤害 +${pct(n)}` },
  { id: 'guardCounter', name: '还礼', eff: 'guardCounter', v: [1, 1], int: true, text: () => '普通格挡也会触发反击' },
  { id: 'lastStand', name: '不倒', eff: 'lastStand', v: [1, 1], int: true, text: () => '每场战斗一次，致命伤后残留 1 点生命' },
  { id: 'killHeal', name: '收割', eff: 'killHeal', v: [0.05, 0.15], text: n => `击倒敌人回复 ${pct(n)} 生命` },
  { id: 'echo', name: '余响', eff: 'echo', v: [0.10, 0.26], text: n => `${pct(n)} 概率追加一次半伤攻击` },
  { id: 'flatCut', name: '壁垒', eff: 'flatCut', v: [0.05, 0.15], text: n => `受到的伤害减少 ${pct(n)}` },
  { id: 'freezePower', name: '封冰', eff: 'freezePlus', v: [0.08, 0.22], text: n => `冰封概率 +${pct(n)}` },
  { id: 'holyPower', name: '曙裁', eff: 'holyPower', v: [0.10, 0.25], text: n => `神圣裁决伤害 +${pct(n)}` },
  { id: 'sealPower', name: '封绝', eff: 'sealPower', v: [0.10, 0.26], text: n => `攻击有 ${pct(n)} 概率封印目标术式` },
  { id: 'dodge', name: '虚影', eff: 'dodge', v: [0.05, 0.14], text: n => `${pct(n)} 概率完全闪避` },
  { id: 'extraTurn', name: '时序', eff: 'extraTurn', v: [0.05, 0.12], text: n => `${pct(n)} 概率行动后立刻再动一次` },
  { id: 'allStat', name: '创世', eff: 'allStat', v: [1, 1], int: true, text: () => '全属性额外 +8%' },
];
const AFFIX_BY_ID = {};
for (const a of AFFIXES) AFFIX_BY_ID[a.id] = a;

/* 高品质专属：rank ≥ 5 才可能出现的强力词缀 */
const HIGH_ONLY = new Set(['dodge', 'extraTurn', 'allStat', 'sealPower', 'lastStand', 'guardCounter']);

/* 特效上限，防止高品质把每条词缀都顶到同一个天花板 */
const EFF_CAP = {
  lifesteal: 0.20, thorns: 0.32, ragePlus: 0.55, critDmg: 0.50, pierce: 0.32,
  hpRegen: 0.07, burnChance: 0.35, statusRes: 0.55, weakHunter: 0.38,
  bossBane: 0.32, killHeal: 0.20, echo: 0.32, flatCut: 0.22,
  freezePlus: 0.30, holyPower: 0.32, sealPower: 0.30, dodge: 0.18, extraTurn: 0.15,
  firstStrike: 40, mpPlus: 9,
};
/* 神器与超神器突破常规上限——它们本来就不是正常流程能拿到的东西 */
const EFF_CAP_HIGH = {
  lifesteal: 0.30, thorns: 0.45, ragePlus: 0.80, critDmg: 0.85, pierce: 0.45,
  hpRegen: 0.11, burnChance: 0.50, statusRes: 0.75, weakHunter: 0.60,
  bossBane: 0.50, killHeal: 0.30, echo: 0.50, flatCut: 0.33,
  freezePlus: 0.45, holyPower: 0.50, sealPower: 0.45, dodge: 0.28, extraTurn: 0.25,
  firstStrike: 62, mpPlus: 16,
};

function pct(n) { return Math.round(n * 100) + '%'; }

/* 同一件图鉴装备永远拿到同一条神权，靠 id 哈希固定下来 */
function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return h;
}

const DIVINE_POWERS = {
  god: [
    { name: '神权·灼', key: 'burnChance', v: 0.35, text: '攻击额外 35% 概率点燃' },
    { name: '神权·凝', key: 'freezePlus', v: 0.30, text: '冰封概率额外 +30%' },
    { name: '神权·迅', key: 'extraTurn', v: 0.10, text: '10% 概率行动后立刻再动一次' },
    { name: '神权·生', key: 'hpRegen', v: 0.05, text: '每回合额外回复 5% 生命' },
    { name: '神权·涌', key: 'mpPlus', v: 8, text: '每回合额外回复 8 术力' },
    { name: '神权·裁', key: 'bossBane', v: 0.25, text: '对首领伤害额外 +25%' },
    { name: '神权·蚀', key: 'lifesteal', v: 0.12, text: '额外 12% 吸血' },
    { name: '神权·约', key: 'guardCounter', v: 1, text: '普通格挡也会触发反击' },
  ],
  super: [
    { name: '超神权·创世', key: 'allStat', v: 1, text: '全属性额外 +8%，且突破常规词缀上限' },
    { name: '超神权·终末', key: 'critDmg', v: 0.50, text: '会心伤害额外 +50%' },
    { name: '超神权·时序', key: 'extraTurn', v: 0.20, text: '20% 概率行动后立刻再动一次' },
    { name: '超神权·命途', key: 'lastStand', v: 1, text: '每场战斗一次，致命伤后残留 1 点生命' },
    { name: '超神权·虚实', key: 'dodge', v: 0.18, text: '额外 18% 概率完全闪避' },
    { name: '超神权·轮回', key: 'echo', v: 0.30, text: '额外 30% 概率追加一次半伤攻击' },
    { name: '超神权·自由', key: 'firstStrike', v: 45, text: '开战时行动条额外 +45' },
    { name: '超神权·不熄', key: 'ragePlus', v: 0.60, text: '怒气获取量额外 +60%' },
  ],
};

/* ---------------- 索引 ---------------- */
const BY_RANK = {};
for (const it of CATALOG) (BY_RANK[it.rarityRank] = BY_RANK[it.rarityRank] || []).push(it);
export const CATALOG_BY_THEME = {};
for (const it of CATALOG) (CATALOG_BY_THEME[it.theme] = CATALOG_BY_THEME[it.theme] || []).push(it);
export const CATALOG_SIZE = CATALOG.length;

/* 等级越高，低品质越不该继续刷屏：给一个随等级抬升的品质地板 */
function rankFloor(level) {
  if (level >= 42) return 5;
  if (level >= 34) return 4;
  if (level >= 26) return 3;
  if (level >= 16) return 2;
  return 1;
}

/* 某个等级下，允许出现哪些品质（同时受解锁条件限制） */
function allowedRanks(level) {
  const floor = rankFloor(level);
  const out = [];
  for (let r = 1; r <= MAX_TIER; r++) {
    if (level < RARITY_TUNE[r].lv) continue;
    if (r < floor) continue;
    if (!gateOpen(RARITY_TUNE[r].gate)) continue;
    out.push(r);
  }
  if (out.length) return out;
  // 条件全不满足时回落到当前等级能开的最高一档
  for (let r = MAX_TIER; r >= 1; r--) if (level >= RARITY_TUNE[r].lv && gateOpen(RARITY_TUNE[r].gate)) return [r];
  return [1];
}

function rollRank(level, minRank = 1, luck = 0) {
  const pool = allowedRanks(level).filter(r => r >= minRank);
  if (!pool.length) return Math.min(MAX_TIER, minRank);
  let total = 0;
  const w = pool.map(r => {
    const weight = RARITY_TUNE[r].weight * (1 + luck * (r - 1) * 0.45);
    total += weight;
    return { r, weight };
  });
  let x = Math.random() * total;
  for (const e of w) { x -= e.weight; if (x <= 0) return e.r; }
  return pool[0];
}

/* ---------------- 生成 ---------------- */
let serial = 0;

/* opt: { level, rank, minRank, slot, type, theme, luck, id } */
export function rollEquip(opt = {}) {
  const level = Math.max(1, Math.round(opt.level || 1));
  const rank = opt.rank || rollRank(level, opt.minRank || 1, opt.luck || 0);
  let pool = opt.theme ? (CATALOG_BY_THEME[opt.theme] || []) : (BY_RANK[rank] || BY_RANK[1]);
  if (opt.slot) pool = pool.filter(x => x.slot === opt.slot);
  if (opt.type) pool = pool.filter(x => x.type === opt.type);
  if (!pool.length) pool = BY_RANK[rank] || BY_RANK[1];
  const entry = opt.id ? (CATALOG.find(x => x.id === opt.id) || pick(pool)) : pick(pool);
  return buildFrom(entry, level, opt);
}

/* 按图鉴条目造一件实际装备 */
export function buildFrom(entry, level, opt = {}) {
  const rar = rarityInfo(entry.rarityRank);
  const curve = TYPE_CURVE[entry.type] || TYPE_CURVE['刀剑'];
  const trait = THEME_TRAIT[entry.theme] || {};

  const eq = {
    id: `gen_${entry.id}_${(serial++).toString(36)}`,
    catalogId: entry.id, name: entry.name, theme: entry.theme, type: entry.type,
    slot: entry.slot, rarity: entry.rarity, rank: entry.rarityRank,
    col: rar.color, rarityName: entry.rarity,
    level, generated: true, eff: {}, effList: [],
    owner: TYPE_OWNER[entry.type] || null,
  };

  /* 基础数值 */
  const k = level * rar.mul;
  const put = (key, per) => {
    if (!per) return;
    const v = (key === 'cri' || key === 'blk' || key === 'par')
      ? roundTo(per * (1 + level * 0.03) * rar.mul, 0.01)
      : Math.round(per * k * rnd(0.92, 1.10));
    if (v) eq[key] = (eq[key] || 0) + v;
  };
  for (const key of ['atk', 'def', 'hp', 'mp', 'spd', 'cri', 'blk', 'par']) put(key, curve[key]);

  /* 主题倾向：给一条固定的属性偏移，让同主题的东西手感一致 */
  if (trait.stat) put(trait.stat, (curve[trait.stat] || 0.6) * 0.45);
  if (trait.elem) {
    eq.eff.elemDmg = eq.eff.elemDmg || {};
    const v = Math.min(0.30, roundTo(0.05 + entry.rarityRank * 0.022, 0.01));
    eq.eff.elemDmg[trait.elem] = v;
    const EN = { fire: '炎', ice: '冰', thunder: '雷', holy: '圣', dark: '暗' };
    eq.effList.push({ id: 'elem', text: `${EN[trait.elem]}属性伤害 +${pct(v)}` });
  }

  /* 神权先算：它会占掉一个效果位，随机词缀要避开它。 */
  applyDivine(eq, entry, trait);

  /* 词缀。主题指定的那一条必定出现，其余随机。 */
  const used = new Set();
  const grade = 1 + (rar.mul - 1) * (entry.rarityRank >= 7 ? 0.62 : 0.45);
  const addAffix = a => {
    if (!a || used.has(a.id)) return false;
    used.add(a.id);
    let v = rnd(a.v[0], a.v[1]);
    if (a.stat) {
      // 百分比型属性（会心/格挡/弹反）不能跟着品质倍率线性涨，否则神器档一件就顶满
      const raw = a.pctStat
        ? Math.min(0.12, roundTo(v * (1 + (rar.mul - 1) * 0.5), 0.01))
        : Math.round(v * level * rar.mul);
      if (!raw) return false;
      eq[a.stat] = (eq[a.stat] || 0) + raw;
      eq.effList.push({ id: a.id, text: a.text(raw) });
      return true;
    }
    v = a.int ? Math.max(1, Math.round(v * (a.eff === 'firstStrike' ? grade : 1))) : roundTo(v * grade, 0.01);
    const caps = entry.rarityRank >= 7 ? EFF_CAP_HIGH : EFF_CAP;
    const cap = caps[a.eff];
    if (cap !== undefined) v = Math.min(v, cap);
    eq.eff[a.eff] = (eq.eff[a.eff] || 0) + v;
    eq.effList.push({ id: a.id, text: a.text(v) });
    return true;
  };

  let left = rar.affixes;
  // 主题词缀：如果神权已经给过同一个效果，就换成随机一条，避免「点燃 +35%／点燃 +23%」并排出现
  const themeAffix = AFFIX_BY_ID[trait.eff];
  if (themeAffix && themeAffix.eff !== eq.divineKey && left > 0 && addAffix(themeAffix)) left--;
  const pool = AFFIXES.filter(a =>
    !used.has(a.id)
    && (!HIGH_ONLY.has(a.id) || entry.rarityRank >= 5)
    && a.eff !== eq.divineKey);          // 神权给过的效果不再重复挂一条词缀
  for (let i = 0; i < left && pool.length; i++) {
    addAffix(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }

  eq.lore = entry.lore || '';
  // 去掉重复的说明行（主题与词缀可能命中同一件事）
  const seenText = new Set();
  eq.effList = eq.effList.filter(e => !seenText.has(e.text) && seenText.add(e.text));
  eq.desc = eq.effList.length ? eq.effList.map(e => e.text).join('；') : `${entry.theme}的${entry.type}。`;
  eq.price = estimatePrice(eq, rar, level);
  if (opt.register !== false) EQUIPS[eq.id] = eq;
  return eq;
}

/* 神权：只有神器（7）与超神器（8）才有的独立效果，一件一条。
   这是「非常强力」真正落地的地方——正常流程拿不到，拿到就能改变打法。
   同一件图鉴装备永远拿到同一条，优先挑与主题对得上的那一条。 */
function applyDivine(eq, entry, trait) {
  if (entry.rarityRank < 7) return;
  const powers = entry.rarityRank >= 8 ? DIVINE_POWERS.super : DIVINE_POWERS.god;
  const want = trait.elem === 'fire' ? 'burnChance'
    : trait.elem === 'ice' ? 'freezePlus'
      : trait.elem === 'thunder' ? 'extraTurn'
        : trait.elem === 'holy' ? 'hpRegen'
          : trait.elem === 'dark' ? 'lifesteal' : trait.eff;
  const dp = powers.find(x => x.key === want)
    || powers[Math.abs(hashStr(entry.id)) % powers.length];
  eq.eff[dp.key] = (eq.eff[dp.key] || 0) + dp.v;
  eq.divine = dp.name;
  eq.divineKey = dp.key;
  eq.effList.unshift({ id: 'divine', text: `【${dp.name}】${dp.text}` });
}

function estimatePrice(eq, rar, level) {
  const worth = (eq.atk || 0) * 9 + (eq.def || 0) * 8 + (eq.hp || 0) * 1.3 + (eq.mp || 0) * 1.5
    + (eq.spd || 0) * 7 + (eq.cri || 0) * 900 + (eq.blk || 0) * 800 + (eq.par || 0) * 900
    + eq.effList.length * 70;
  return Math.max(25, Math.round(worth * (1 + level * 0.02) * (rar.mul * 0.75)));
}

/* ---------------- 掉落 ----------------
   def.theme 是首领专属主题——史诗档的名字本来就绑着具体首领，
   所以打古兰掉「炎狱古兰」系，打丝薇雅掉「冰庭丝薇雅」系。 */
export function rollDrops(def, level, opt = {}) {
  const out = [];
  const luck = opt.luck || 0;
  if (def.boss) {
    const top = allowedRanks(level).slice(-1)[0];
    const base = Math.max(2, top - 1);
    if (def.theme && CATALOG_BY_THEME[def.theme]) {
      out.push(rollEquip({ level: level + 2, theme: def.theme, luck: luck + 0.8 }));
    }
    out.push(rollEquip({ level: level + 2, minRank: base, luck: luck + 0.6 }));
    if (chance(0.3 + luck * 0.2)) out.push(rollEquip({ level: level + 3, minRank: Math.min(8, base + 1), luck: luck + 1 }));
  } else {
    if (chance(0.30 + luck * 0.12)) out.push(rollEquip({ level, luck }));
    if (chance(0.07 + luck * 0.06)) out.push(rollEquip({ level, minRank: 2, luck: luck + 0.4 }));
  }
  return out.filter(Boolean);
}

/* 商店货架：按当前等级给一批买得到的东西 */
export function rollShopStock(level, n = 6, opt = {}) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(rollEquip({ level, minRank: i < 2 ? 2 : 1, luck: opt.luck || 0 }));
  return out;
}

/* 存档往返 */
export function restoreLoot(map) {
  if (!map) return;
  for (const [id, eq] of Object.entries(map)) EQUIPS[id] = eq;
}
export function collectLoot() {
  const out = {};
  for (const [id, eq] of Object.entries(EQUIPS)) if (eq && eq.generated) out[id] = eq;
  return out;
}

/* 单位身上所有装备的特效合计 */
export function eqBonus(unit, key) {
  if (!unit || !unit.equips) return 0;
  let sum = 0;
  for (const id of unit.equips) {
    const e = EQUIPS[id];
    if (!e || !e.eff) continue;
    if (typeof e.eff[key] === 'number') sum += e.eff[key];
    if (e.eff.allStat && key === 'critDmg') sum += 0.08;
  }
  return sum;
}
export function eqElemBonus(unit, elem) {
  if (!unit || !unit.equips || !elem || elem === 'none') return 0;
  let sum = 0;
  for (const id of unit.equips) {
    const e = EQUIPS[id];
    if (!e || !e.eff) continue;
    if (e.eff.elemDmg && e.eff.elemDmg[elem]) sum += e.eff.elemDmg[elem];
    if (elem === 'holy' && e.eff.holyPower) sum += e.eff.holyPower;
  }
  return sum;
}

export default {
  rollEquip, buildFrom, rollDrops, rollShopStock, eqBonus, eqElemBonus,
  rarityInfo, CATALOG, CATALOG_SIZE, CATALOG_BY_THEME, AFFIXES,
};
