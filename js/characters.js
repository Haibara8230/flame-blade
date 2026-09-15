/* ============================================================
   characters.js — 角色 / 技能 / 敌人 / 道具 / 装备 数据
   ============================================================ */

/* ---------------- 元素 ---------------- */
/* 属性按原文第7章的抗性面板：火系 / 水系 / 风系 / 雷系 / 土系 / 光系 / 暗系。
   ⚠ 此前是 炎/冰/雷/暗/圣 五系，是《炎之刃》的分类，与原文不符。 */
export const ELEM = {
  none:    { id: 'none',    name: '无',   col: '#D6D3D1' },
  fire:    { id: 'fire',    name: '火系', col: '#ff8048' },
  water:   { id: 'water',   name: '水系', col: '#48b0ff' },
  wind:    { id: 'wind',    name: '风系', col: '#7dffa8' },
  thunder: { id: 'thunder', name: '雷系', col: '#ffd24a' },
  earth:   { id: 'earth',   name: '土系', col: '#c8a878' },
  light:   { id: 'light',   name: '光系', col: '#fff3c4' },
  dark:    { id: 'dark',    name: '暗系', col: '#a06bd6' },
};

export const STATUS = {
  atkUp: { name: '攻击↑', turns: 3, bad: false, icon: '▲' },
  defUp: { name: '防御↑', turns: 3, bad: false, icon: '◆' },
  regen: { name: '再生', turns: 3, bad: false, icon: '✚' },
  poison: { name: '剧毒', turns: 3, bad: true, icon: '☠' },
  burn: { name: '灼烧', turns: 3, bad: true, icon: '🔥' },
  frozen: { name: '冰封', turns: 1, bad: true, icon: '❄' },
  stun: { name: '眩晕', turns: 1, bad: true, icon: '✷' },
  defDown: { name: '防御↓', turns: 3, bad: true, icon: '▼' },
  seal: { name: '封印', turns: 2, bad: true, icon: '✖' },
  haste: { name: '加速', turns: 3, bad: false, icon: '»' },
  slow: { name: '迟缓', turns: 3, bad: true, icon: '«' },
};

/* ---------------- 队伍角色 ---------------- */
export const ACTORS = {
  /* 注：四个内部 id（kaito/cang/lei/ryze）保留为纯引擎键——
     天赋树、立绘、武器归属、羁绊表都按它们索引。玩家看不到 id，
     看到的是 name/title/role。改 id 收益为零，破坏面却很大。 */

  /* —— 主角：叶天邪，游戏 ID「邪天」——
     原文此时的状态：**职业赋予失败，整个新手期没有职业**。
     所以他这里拿不到任何邪龙系技能——那些要到转职（原文第111章
     「转职——逆骨邪龙！」）之后才有，技能表里按等级锁在后面。

     他现在能依靠的只有三样，全是原文给的：
       · 自由属性 力量10 / 体质7 / 敏捷4 / 精神4（近战向）
       · 固定属性 魅力10 / 幸运0 / 悟性0 —— 幸运 0 意味着
         **永不暴击，且每一刀都取伤害下限**，这是真生效的
       · 天赋属性 反应力72 / 感知力53 / 专注力42（常人 7~10）
         —— 七倍于常人的反应力折算成闪避，这是他越级打怪的本钱

     base 里只放「身体底子」，属性点带来的部分由 alloc 在 recalc 时叠加，
     避免同一份数值被算两次。

     ⚠ 2026-09-15：原文第7章给了完整的初始面板，此前这里的 base 是编的，已照抄。

       人物：邪天　等级：0级　职业：无　声望：0；金钱：0
       基本属性：力量：10，体质：7，敏捷：4，精神：4
       固定属性：幸运：0；悟性：0；魅力：10
       生命值：70　魔法值：40　物理攻击力：23　魔法攻击力：8　物理防御力：11
       命中：4　回避：4　反应力：72　感知力：53　专注力：42
       出手速度：100（初始值）　移动速度：100（初始值）

     每一项都能用原文的战士公式验算出来，没有任何「角色自带底子」：
       生命 70 = 体质7 × 10
       魔法 40 = 精神4 × 10
       物攻 23 = 力量10 × 2 + 新手短剑 +3
       物防 11 = 体质7 × 1 + 新手衣 +4
       魔攻  8 = 精神4 × 2
       命中/回避 4 = 敏捷4 × 1

     所以 base 的 hp/mp/atk/def 全部为 0——数值一律由属性推导。
     grow 也按原文：升级只给「生命+10，魔法+10，5点自由属性点」，
     攻击和防御的成长全部来自玩家把那 5 点加到哪里。 */
  kaito: {
    id: 'kaito', name: '邪天', title: '无职业', portrait: 'kaito',
    realName: '叶天邪', role: '近战', joinLevel: 0,
    /* ⚠ 此前这里是 resource:'rage' / resourceName:'斗气'——原著中没有这个东西。
       原文第7章的面板上写的是「魔法值：40」（精神 4 × 10），
       而他唯一的技能探知术「损耗魔法值1点」。所以资源就是魔法值，没有怒气系统。 */
    resource: 'mp', resourceName: '魔法值',
    /* 幸运 0 → cri 基础值必须是 0。出手速度 100 是原文的初始值。 */
    base: { hp: 0, mp: 0, atk: 0, def: 0, spd: 100, cri: 0, blk: 0.10, par: 0.06, rageMul: 1.0, mpRegen: 0 },
    /* 原文：「叮……你的等级升为N级，生命+10，魔法+10，获得5点自由属性点。」
       这句在第12/19/20/23/46/92/102 章反复出现，格式一字不差。 */
    grow: { hp: 10, mp: 10, atk: 0, def: 0, spd: 0 },
    /* 原文的配点，创号时由玩家分配，这里是默认值 */
    alloc: { str: 10, vit: 7, agi: 4, spi: 4 },
    fixed: { luck: 0, wit: 0, chm: 10 },
    talentAttr: { react: 72, sense: 53, focus: 42 },
    /* 普攻就是「砍、劈、刺」。原文第9章：
       「即使是0级的玩家，也会自带一个见习职业的见习技能。而全世界只有叶天邪
         一个例外，**他没有技能，没有职业**，只能以新手剑并不华丽的砍、劈、刺……」 */
    weaponSkill: ['plain_strike'],
    /* 原文第7章的面板里，「技能」一栏只有一个，而且是全职业共有的：
       「技能：探知术：全职业共有技能，损耗魔法值1点，
         探知不高于自己等级十级的怪物属性。」
       ⚠ 此前这里配了 yt_slash / yt_read / yt_stone / yt_counter / yt_focus
       五个技能，以及 ni_* 一整条邪龙线——全部是本项目编的，原著中他这个阶段
       一个技能都没有。已删除。邪龙系技能要到原文第111章转职之后才存在。 */
    skills: [
      { id: 'scan', lv: 0 },     // 探知术：全职业共有
    ],
    quote: '「别人等我一天一夜都是应该。但我不会多等谁一秒。」',
    winQuote: '下一个。',
  },

  /* ⚠ 璃仙儿 / 梦羽衣 / 果果都是原著里真实存在的角色（分别出现在 136 / 141 / 283 章里），
     但此前给她们配的数值、技能、连携、羁绊全部是《炎之刃》时期的设计，原著无据。
     2026-09-15 整体移除，等剧情推进到她们登场的那一章（果果第9~10章）
     再按原文逐项重建。 */
};

/* ---------------- 技能表 ----------------
   type: atk 攻击 / heal 治疗 / buff 增益 / debuff 减益 / revive 复活
------------------------------------------- */
export const SKILLS = {
  /* ============ 邪天 · 无职业阶段 ============
     原文：见习职业赋予失败，整个新手期没有职业，
     系统建议十级后找职业导师直接转职。

     所以这一段他没有任何职业技能。下面五招全部来自他自己的东西——
     反应力 72、感知力 53、专注力 42，以及原文第八章他实际用的打法。
     刻意都做成低耗、低倍率：他这时候是真的弱，强的是操作。 */
  /* 普通攻击：新手剑的砍、劈、刺。原文里他这个阶段就只有这个。
     没有倍率加成、没有属性、没有特效——power 1.0 就是面板攻击力本身。 */
  plain_strike: {
    id: 'plain_strike', name: '砍／劈／刺', mp: 0, type: 'atk', elem: 'none',
    power: 1.0, hits: 1, target: 'one', rage: 12, fx: 'slash',
    desc: '新手剑并不华丽的砍、劈、刺。',
  },
  /* ---- 命运七杀（原文第11章，永恒命运之刻自带） ----
     「命运七杀：以永恒命运之刻的制裁之力对目标造成连续七次不同的命运制裁，
       制裁效果不可抗拒，不可叠加，攻击范围未知，技能冷却时间未知。」
     七杀的耗魔 100 起、每级翻倍，到第七杀 9999；效果原文一律写「未知」，
     状态一律是「**命运之核缺失，不可使用**」。
     所以这里全部 locked: true —— 面板上看得到、点不动，和原文一致。
     ⚠ 一个字都不要替原文补：效果就是「未知」。 */
  fate_kill_1: { id: 'fate_kill_1', name: '血刹', sub: '第一杀 · 生命制裁', mp: 100, type: 'atk', target: 'one', locked: '命运之核缺失，不可使用', desc: '效果未知。' },
  fate_kill_2: { id: 'fate_kill_2', name: '魔刹', sub: '第二杀 · 魔力制裁', mp: 200, type: 'atk', target: 'one', locked: '命运之核缺失，不可使用', desc: '效果未知。' },
  fate_kill_3: { id: 'fate_kill_3', name: '神溃', sub: '第三杀 · 天罡制裁', mp: 400, type: 'atk', target: 'one', locked: '命运之核缺失，不可使用', desc: '效果未知。' },
  fate_kill_4: { id: 'fate_kill_4', name: '毒蚀', sub: '第四杀 · 守护制裁', mp: 800, type: 'atk', target: 'one', locked: '命运之核缺失，不可使用', desc: '效果未知。' },
  fate_kill_5: { id: 'fate_kill_5', name: '亡魂', sub: '第五杀 · 生死制裁', mp: 1600, type: 'atk', target: 'one', locked: '命运之核缺失，不可使用', desc: '效果未知。' },
  fate_kill_6: { id: 'fate_kill_6', name: '杀魄', sub: '第六杀 · 阴阳制裁', mp: 3200, type: 'atk', target: 'one', locked: '命运之核缺失，不可使用', desc: '效果未知。' },
  fate_kill_7: { id: 'fate_kill_7', name: '天诛', sub: '第七杀 · 天命制裁', mp: 9999, type: 'atk', target: 'one', locked: '命运之核缺失，不可使用', desc: '效果未知。' },
  /* 「禁断技：命运禁罪·天戮：效果未知，命运之核缺失，不可使用。」 */
  fate_forbidden: { id: 'fate_forbidden', name: '命运禁罪·天戮', sub: '禁断技', mp: 0, type: 'atk', target: 'all', locked: '命运之核缺失，不可使用', desc: '效果未知。' },

  /* 原文第7章：「技能：探知术：全职业共有技能，损耗魔法值1点，
     探知不高于自己等级十级的怪物属性。」 */
  scan: {
    id: 'scan', name: '探知术', mp: 1, type: 'scan', target: 'one', rage: 0, fx: 'aura',
    desc: '全职业共有技能。损耗魔法值 1 点，探知不高于自己等级十级的怪物属性。',
  },
  /* ⚠ 此处原有邪天的邪龙线（ni_*）、仙儿（xi_*）、梦羽衣（th_*）、果果（gg_*）
     共二十余个技能，全部是本项目编的。原文第9章明写主角「没有技能，没有职业」，
     邪龙系要到第111章转职之后才存在；其余三人的技能等她们登场再按原文写。 */
};

/* ⚠ 连携（COMBOS）是《炎之刃》时期的系统，原著中没有对应设定，已删除。 */
export const COMBOS = {};

/* ⚠ 此前这里有回复药 / 术力泉 / 复苏之羽 / 封魔符 / 爆弹 / 遁形烟 八种道具，
   全部是《炎之刃》时期的设计。原文第7章：背包五十格，「里面孤零零的躺着一把
   细长的剑」——他身上一件道具都没有。原文里出现过的道具（小回复药水、
   小型魔法恢复药水，第16章）等剧情推进到能拿到的那一章再加。 */
export const ITEMS = {};

/* ---------------- 装备 ----------------
   ⚠ 此前这里有铁之长剑 / 炎纹剑·绯 / 圣剑·霜华 / 木杖 / 苍蓝法杖 / 猎手长枪 /
   皮甲 / 锁子甲 / 魔铠·黑曜 / 圣织披风 / 三种指环 / 羁绊之证……
   全部是《炎之刃》时期的固定装备，原著中不存在，2026-09-15 已删除。
   下面只留原文明确给出属性的几件。随机掉落的装备走 equipment-data.js 的图鉴。 */
export const EQUIPS = {
  /* 原文第7章：「新手短剑：装备要求：无，品级：苍白，属性：攻击+3。」 */
  mu_sword: { id: 'mu_sword', name: '新手短剑', slot: 'weapon', atk: 3, tier: 1,
    desc: '装备要求：无。品级：苍白。', price: 0 },
  /* 原文第7章：「新手布衣：防御+2。新手长裤：防御+1。新手布鞋：防御+1。」
     ——「身上所有的衣服加起来也不过是增加了四点防御而已。」 */
  novice_robe: { id: 'novice_robe', name: '新手布衣', slot: 'body', def: 2, tier: 1,
    desc: '装备要求：无。品级：苍白。', price: 0 },
  novice_pants: { id: 'novice_pants', name: '新手长裤', slot: 'legs', def: 1, tier: 1,
    desc: '装备要求：无。品级：苍白。', price: 0 },
  novice_shoes: { id: 'novice_shoes', name: '新手布鞋', slot: 'feet', def: 1, tier: 1,
    desc: '装备要求：无。品级：苍白。', price: 0 },

  /* ---- 永恒命运之刻（残） · 原文第11章，逐条照抄 ----
     「永恒命运之刻（残）：使用要求：无。品级：仙灵。命运世界的力量核心，
       有着未知的神秘来历和未知的神秘力量。目前处在命运之核全部丧失的残缺状态。
       已强制认主，主人：邪天，不可交易，不可掉落，不可偷窃，不可丢弃。
       属性：攻击+50，攻击+5%，四大基本属性+10，
             普通攻击时将对攻击范围内的所有目标同时造成伤害。
       技能：命运之赐：被动，永恒命运之刻之主将受到命运之祝福，
             提升天赋固定属性：幸运+10，悟性+10，魅力+10。」
     验算（原文第12章）：0级装备后物攻 94（「差点破百」），
     升1级把5点全加力量后 105（「攻击能力顿时破百」）。
     ⚠ 剧情要推进到第11章才会授予。 */
  fate_moment: {
    id: 'fate_moment', name: '永恒命运之刻（残）', slot: 'weapon', tier: 6,
    atk: 50, atkPct: 0.05, allFree: 10, fixedAll: 10, cleave: true,
    /* 原文第11章：这把武器自带【命运之赐】（被动，已由 fixedAll 实现）
       与【命运七杀】七招 + 禁断技【命运禁罪·天戮】，全部「命运之核缺失，不可使用」。 */
    skills: ['fate_kill_1', 'fate_kill_2', 'fate_kill_3', 'fate_kill_4',
             'fate_kill_5', 'fate_kill_6', 'fate_kill_7', 'fate_forbidden'],
    bound: '邪天', noTrade: true, noDrop: true, noSteal: true, noDiscard: true,
    price: 0, weight: 0,
    desc: '使用要求：无。品级：仙灵。命运世界的力量核心，有着未知的神秘来历和未知的神秘力量。' +
          '目前处在命运之核全部丧失的残缺状态。已强制认主，主人：邪天，' +
          '不可交易，不可掉落，不可偷窃，不可丢弃。',
  },
};

/* ⚠ 新手村杂货摊是本项目编的。原文第7章：「他没有像大多数玩家一样首先奔向
   新手村中那有限的几个人来试探能不能触发什么任务，而是拨开人群，
   径直走向了新手村外。」——他在新手村没有和任何人交易过。 */
export const SHOPS = {};

/* ---------------- 敌人 ----------------
   shape: humanoid / wolf / bird / slime / demon / king
------------------------------------------- */
export const ENEMIES = {
  /* ⚠ 此处原有《炎之刃》的整套敌人（魔兵、四天王、魔王、诸神、幽风精、
     鬼谷子…共四十余种），随那批章节一同退役，2026-09-15 已全部删除。
     下面全是照抄原文探知术面板的怪物。 */
  wild_wolf: {
    id: 'wild_wolf', name: '野狼', shape: 'wolf',
    palette: { body: '#6a6258', trim: '#3a352e', eye: '#ff6a4a', fang: '#f6efe2' },
    /* 原文第8章：「野狼：5级，生命：170。一种性情比较残暴的动物，喜群居，
       会对靠近的人类主动发起攻击。」
       物防 8：原文没直接给，由两组伤害数字反解（见 battle.js computeDamage）。
       物攻 32：原文第9章狼爪打在他身上是 -21，而他当时物防 11 → 21+11=32。
       ⚠ 出手速度原文未给，31 是沿用值（原文只说「移动速度至少是玩家的1.5倍」）。 */
        /* gold 0：原文里三只野狼总共只掉了一枚铜币，而且是第一只掉的——
       「他为0的幸运让在他手下死亡的怪物爆率全部取最低值」。
       那一枚由剧情场景直接发放，普通击杀不掉钱。 */
    baseLevel: 5, hp: 170, atk: 32, def: 8, spd: 31, exp: 42, gold: 0, hot: 4,
    weak: [], quote: '（一声长嚎。另外两只被惊动了。）',   // 原文面板没有「弱点」这一栏
    skills: [{ id: 'atk', w: 8 }, { id: 'heavy', w: 2 }],
  },
  /* ---- 以下怪物全部照抄原文的探知术面板 ----
     ⚠ 原文只给「等级 / 生命 / 描述 / 技能」，**没有给攻击力与防御力**。
     野狼的 atk 32 / def 8 是由原文的伤害数字反解的（见 battle.js computeDamage）；
     其余怪物的 atk / def / spd 标注为原文未考证，按与野狼的相对强度推。
     此前这里的「灰狼」「狼群首领」是本项目编的，原著中不存在，已删除。 */

  /* 原文第7章：「愤怒的小鸡：1级，生命：30，一群躁动的小鸡，
     偶尔会做出攻击人类的行为。」 */
  angry_chick: {
    id: 'angry_chick', name: '愤怒的小鸡', shape: 'wolf',
    palette: { body: '#f6e08a', trim: '#d8b048', eye: '#ff6a4a', fang: '#fff6d8' },
    baseLevel: 1, hp: 30, atk: 6, def: 0, spd: 18, exp: 3, gold: 1, hot: 1,
    weak: [], quote: '（一群躁动的小鸡，偶尔会做出攻击人类的行为。）',
    skills: [{ id: 'atk', w: 1 }],
  },

  /* 原文第7章：「大凶兔：3级，生命：70，因命运之塔的魔气外泄而受到轻微魔化
     影响的兔子，平时喜欢没事闲逛荡，人畜无害的外表之下掩藏着相当严重的暴力
     倾向。因身材矮小，习惯下三路攻击。
     技能：好大一棒槌：抡起肩上大棒狠狠攻击敌人两腿间的部位，
           对男性目标伤害加成40%，并有极低的概率触发即死。」 */
  fierce_rabbit: {
    id: 'fierce_rabbit', name: '大凶兔', shape: 'humanoid',
    palette: { hair: '#e8e4dc', cloth: '#cfc8bc', trim: '#9a9086', skin: '#f2eee6', eye: '#ff3b4e', weapon: 'axe' },
    baseLevel: 3, hp: 70, atk: 18, def: 3, spd: 22, exp: 7, gold: 2, hot: 2,
    weak: [], quote: '（人畜无害的外表之下，掩藏着相当严重的暴力倾向。）',
    skills: [{ id: 'atk', w: 7 }, { id: 'bigclub', w: 3 }],
  },

  /* 原文第16章：「巨型凶狼：5级三星级BOSS，生命：1300，凶狼中的变异体，
     有着远超普通凶狼的巨大体型和强大能力。技能：狂化。」
     「狂化：当巨型凶狼的生命下降至20%以下时，有50%的概率触发此技能，
       技能触发后攻击力、攻击速度、移动速度全部提升30%，防御降低30%，持续1分钟。」 */
  giant_dire_wolf: {
    id: 'giant_dire_wolf', name: '巨型凶狼', shape: 'wolf', boss: true, star: 3,
    palette: { body: '#4a4a56', trim: '#26262e', eye: '#ff8a3a', fang: '#fffaf0' },
    baseLevel: 5, hp: 1300, atk: 46, def: 14, spd: 33, exp: 0, gold: 60, hot: 8,
    scale: 1.8,
    weak: [], quote: '（凶狼中的变异体，有着远超普通凶狼的巨大体型和强大能力。）',
    skills: [{ id: 'atk', w: 8 }, { id: 'heavy', w: 3 }],
    /* 狂化：血量 20% 以下、50% 概率触发，攻击/攻速/移速 +30%，防御 -30%，持续 1 分钟 */
    phase: { at: 0.20, chance: 0.50, name: '狂化',
      buff: { atk: 1.30, spd: 1.30, def: 0.70 }, turns: 20,
      line: '（它仰天发出了一声悚人的狼吼，全身的毛发根根竖起，一双巨大的狼眼蒙上了一层骇人的血色。）' },
  },

  /* 原文第23章：「血狼：7级，生命：250，嗜血之狼，具有灵敏的行动能力，
     尖利的牙齿和狼爪是它们的锋利武器，会攻击所有靠近的生灵。技能：无。」
     原文同章：「生命值只比凶狼多出了50点，但其速度和仇恨距离却要明显的超过凶狼」
     —— 由此可反推普通凶狼生命 200。 */
  blood_wolf: {
    id: 'blood_wolf', name: '血狼', shape: 'wolf',
    palette: { body: '#5a2a2e', trim: '#2e1418', eye: '#ff2a3a', fang: '#ffe8e8' },
    baseLevel: 7, hp: 250, atk: 40, def: 10, spd: 38, exp: 0, gold: 3, hot: 5,
    weak: [], quote: '（嗜血之狼，会攻击所有靠近的生灵。）',
    skills: [{ id: 'atk', w: 1 }],
  },
  dire_wolf: {
    id: 'dire_wolf', name: '凶狼', shape: 'wolf',
    palette: { body: '#5c564c', trim: '#332e28', eye: '#ff7a4a', fang: '#f6efe2' },
    baseLevel: 6, hp: 200, atk: 36, def: 9, spd: 33, exp: 0, gold: 2, hot: 4,
    weak: [], quote: '（比野狼更大，也更暴戾。）',
    skills: [{ id: 'atk', w: 8 }, { id: 'heavy', w: 2 }],
  },

  /* 原文第23章：「变异血狼：7级三星级精英，生命：2000，变异的血狼，
     拥有比普通血狼更庞大更灵敏的身体，更强大的攻击能力。
     技能：血狼噬：攻击时有5%的概率将伤害转化做自己的生命值。」 */
  mutant_blood_wolf: {
    id: 'mutant_blood_wolf', name: '变异血狼', shape: 'wolf', boss: true, star: 3,
    palette: { body: '#6a1e26', trim: '#3a0e14', eye: '#ff1a2a', fang: '#fff0f0' },
    baseLevel: 7, hp: 2000, atk: 58, def: 18, spd: 42, exp: 0, gold: 120, hot: 9,
    scale: 1.8, weak: [],
    quote: '（拥有比普通血狼更庞大更灵敏的身体，更强大的攻击能力。）',
    skills: [{ id: 'atk', w: 8 }, { id: 'bloodbite', w: 2 }],
  },

  /* 幽风平原 —— 查证：十五级以下弱小怪物活跃，初级玩家练级之地 */
};


export const ENEMY_SKILLS = {
  atk: { id: 'atk', name: '攻击', power: 1.0, elem: 'none' },
  /* 原文第7章「大凶兔」的技能，照抄：
     「好大一棒槌：抡起肩上大棒狠狠攻击敌人两腿间的部位，
       对男性目标伤害加成40%，并有极低的概率触发即死。」
     ⚠「极低的概率」原文没给数字，取 1%。 */
  bigclub: { id: 'bigclub', name: '好大一棒槌', power: 1.0, elem: 'none',
    vsMale: 0.40, instantKill: 0.01,
    desc: '抡起肩上大棒狠狠攻击敌人两腿间的部位，对男性目标伤害加成 40%，并有极低的概率触发即死。' },
  /* 原文第23章「变异血狼」的技能，照抄：
     「血狼噬：攻击时有5%的概率将伤害转化做自己的生命值。」 */
  bloodbite: { id: 'bloodbite', name: '血狼噬', power: 1.0, elem: 'none',
    lifestealChance: 0.05,
    desc: '攻击时有 5% 的概率将伤害转化做自己的生命值。' },
  heavy: { id: 'heavy', name: '重击', power: 1.5, elem: 'none', desc: '势大力沉的一击。' },
  bite: { id: 'bite', name: '撕咬', power: 1.3, elem: 'dark', inflict: { id: 'poison', chance: 0.35 } },
  snipe: { id: 'snipe', name: '狙击', power: 1.35, elem: 'none', pierceDef: 0.4 },
  howl: { id: 'howl', name: '嗥叫', power: 0, elem: 'none', buff: { id: 'atkUp', turns: 3 }, target: 'selfside' },
  frostbite: { id: 'frostbite', name: '霜噬', power: 1.4, elem: 'ice', inflict: { id: 'frozen', chance: 0.3 } },
  rootbind: { id: 'rootbind', name: '束缚之根', power: 0.9, elem: 'none', inflict: { id: 'stun', chance: 0.5 } },
  ice_lance: { id: 'ice_lance', name: '冰之枪', power: 1.55, elem: 'ice' },
  blizzard: { id: 'blizzard', name: '暴风雪', power: 1.15, elem: 'ice', target: 'all', inflict: { id: 'slow', chance: 0.35 } },
  ice_coffin: { id: 'ice_coffin', name: '冰棺', power: 1.7, elem: 'ice', inflict: { id: 'frozen', chance: 0.4 } },
  frost_nova: { id: 'frost_nova', name: '霜之新星', power: 1.5, elem: 'ice', target: 'all', inflict: { id: 'defDown', chance: 0.5 } },
  dark_slash: { id: 'dark_slash', name: '暗影斩', power: 1.65, elem: 'dark', fx: 'shadow' },
  dark_wave: { id: 'dark_wave', name: '暗影波动', power: 1.25, elem: 'dark', fx: 'shadow', target: 'all' },
  dark_seal: { id: 'dark_seal', name: '影缚·封术', power: 1.45, elem: 'dark', fx: 'shadow', inflict: { id: 'seal', chance: 0.55 } },
  shadow_step: { id: 'shadow_step', name: '影渡', power: 1.2, elem: 'dark', fx: 'shadow', hits: 2 },
  drain: { id: 'drain', name: '生命吸取', power: 1.3, elem: 'dark', drain: 0.6 },
  quake: { id: 'quake', name: '震地', power: 1.35, elem: 'none', target: 'all', inflict: { id: 'stun', chance: 0.25 } },
  abyss: { id: 'abyss', name: '深渊之颚', power: 1.8, elem: 'dark', fx: 'shadow', inflict: { id: 'defDown', chance: 0.4 } },
  king_roar: { id: 'king_roar', name: '魔王咆哮', power: 1.4, elem: 'dark', fx: 'shadow', target: 'all', inflict: { id: 'defDown', chance: 0.6 } },
  meteor: { id: 'meteor', name: '陨星坠落', power: 2.0, elem: 'fire', target: 'all' },
  /* — 第二部新增 — */
  pollen: { id: 'pollen', name: '灵粉', power: 1.1, elem: 'holy', fx: 'holy', target: 'all', inflict: { id: 'slow', chance: 0.4 } },
  dazzle: { id: 'dazzle', name: '眩翅', power: 1.3, elem: 'holy', fx: 'holy', inflict: { id: 'stun', chance: 0.3 } },
  plume_storm: { id: 'plume_storm', name: '焚羽暴', power: 1.5, elem: 'fire', fx: 'fire', target: 'all', inflict: { id: 'burn', chance: 0.5 } },
  phoenix_dive: { id: 'phoenix_dive', name: '涅槃俯冲', power: 2.2, elem: 'fire', fx: 'fire', hits: 2 },
  mirage: { id: 'mirage', name: '九相幻影', power: 1.25, elem: 'dark', fx: 'shadow', hits: 3, gauge: -18 },
  truth_lash: { id: 'truth_lash', name: '真言鞭', power: 1.9, elem: 'holy', fx: 'holy', pierceDef: 0.35 },
  erase: { id: 'erase', name: '抹除', power: 1.75, elem: 'none', fx: 'shadow', inflict: { id: 'seal', chance: 0.5 } },
  silence_field: { id: 'silence_field', name: '寂灭领域', power: 1.35, elem: 'dark', fx: 'shadow', target: 'all', inflict: { id: 'seal', chance: 0.45 } },
  starfall: { id: 'starfall', name: '葬星坠', power: 2.1, elem: 'none', fx: 'holy', target: 'all' },
  rewind: { id: 'rewind', name: '回溯', power: 1.6, elem: 'none', fx: 'shadow', gauge: -30 },
  tide: { id: 'tide', name: '潮没', power: 1.8, elem: 'ice', fx: 'frost', target: 'all', inflict: { id: 'slow', chance: 0.5 } },
  divine_judge: { id: 'divine_judge', name: '神权裁决', power: 2.05, elem: 'holy', fx: 'holy', pierceDef: 0.3, inflict: { id: 'defDown', chance: 0.5 } },
  karma: { id: 'karma', name: '业报', power: 1.95, elem: 'dark', fx: 'shadow', target: 'all', drain: 0.4 },
  annihilate: { id: 'annihilate', name: '终焉之刃', power: 2.6, elem: 'dark', fx: 'shadow', target: 'all', gauge: -28 },
};

/* ---------------- 敌人等级缩放 ----------------
   此前这段公式在 battle.js、tools/validate.mjs、tools/balance.mjs 各抄了一份，
   加了 baseLevel 之后三处会立刻算出不同的结果（工具报出来的首领 ATK 是实际的六倍）。
   现在只留这一处，三边共用。 */
/* 装备附带的「四大基本属性 +N」与「固定属性 +N」。
   原文永恒命运之刻：属性「四大基本属性+10」；技能命运之赐「幸运+10，悟性+10，魅力+10」。
   这两类不是直接加面板，而是加到属性上再走原文的换算公式，所以单独取出来。 */
/* 百分比攻击加成。**必须在属性换算之后调用**——
   原文永恒命运之刻是「攻击+50，攻击+5%」，验算要 (力量×2 + 50) × 1.05
   才能得出原文的「差点破百」（94.5）；先乘再加只有 92，对不上。 */
export function applyAtkPct(s, equips = []) {
  let pct = 0;
  for (const id of equips) if (id) pct += (EQUIPS[id]?.atkPct) || 0;
  if (pct) s.atk = Math.floor(s.atk * (1 + pct));
  return s;
}

export function equipFreeBonus(equips = []) {
  let n = 0;
  for (const id of equips) if (id) n += (EQUIPS[id]?.allFree) || 0;
  return n;
}
export function equipFixedBonus(equips = []) {
  let n = 0;
  for (const id of equips) if (id) n += (EQUIPS[id]?.fixedAll) || 0;
  return n;
}

export function enemyStatsAt(ref, lv) {
  const d = typeof ref === 'string' ? ENEMIES[ref] : ref;
  if (!d) return null;
  const k = Math.max(0, lv - (d.baseLevel || 1));
  const hpK = (d.boss && lv >= 18) ? 0.032 : 0.075;
  return {
    def: d,
    maxHp: Math.floor(d.hp * (1 + k * hpK)),
    atk: Math.floor(d.atk * (1 + k * 0.11)),
    defv: Math.floor(d.def * (1 + k * 0.10)),
    spd: d.spd + k,
    exp: Math.floor(d.exp * (1 + k * 0.22)),
    gold: Math.floor(d.gold * (1 + k * 0.2)),
    scaleK: k,
  };
}

/* ---------------- 成长曲线 ----------------
   已移到 realm.js 并按原文重新校准（0→1=100、1→2=1000、5级野狼=12）。
   这里原本还有一套 MAX_LEVEL=50 / 42+lv²*3.2，和 realm.js 那套并存，
   而游戏跑的恰恰是这一套、realm.js 那套没人 import——两套并存已在
   2026-09-15 收敛掉。转发出去是为了不用改所有 import 点。 */
export { MAX_LEVEL, expToNext, expFromKill } from './realm.js';

export function statsAt(def, level, equips = []) {
  const g = def.grow, b = def.base;
  /* 0 基：原文里玩家从 **0 级** 起步（第8章「0级，身上只有没什么属性的新手衣」），
     所以 base 就是 0 级的身板，每升一级加一份 grow。
     此前是 k = level - 1（1 基），换算过来数值完全不变，只是索引整体下移一级。 */
  const k = Math.max(0, level);
  const s = {
    hp: Math.floor(b.hp + g.hp * k),
    mp: Math.floor(b.mp + g.mp * k),
    atk: Math.floor(b.atk + g.atk * k),
    def: Math.floor(b.def + g.def * k),
    spd: Math.floor(b.spd + g.spd * k),
    cri: b.cri,
    blk: b.blk ?? 0.10,
    par: b.par ?? 0.05,
    rageMul: b.rageMul ?? 1,
    mpRegen: b.mpRegen,
  };
  for (const id of equips) {
    if (!id) continue;                 // 定长槽位数组里的空位
    const e = EQUIPS[id];
    if (!e) continue;
    s.hp += e.hp || 0; s.mp += e.mp || 0; s.atk += e.atk || 0;
    s.def += e.def || 0; s.spd += e.spd || 0; s.cri += e.cri || 0;
    s.blk += e.blk || 0; s.par += e.par || 0;
  }
  // 防御判定先滚弹反再滚格挡，两者合计必须留出挨打的空间
  s.blk = Math.min(s.blk, 0.60);
  s.par = Math.min(s.par, 0.30);
  return s;
}
