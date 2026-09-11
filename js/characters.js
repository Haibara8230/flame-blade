/* ============================================================
   characters.js — 角色 / 技能 / 敌人 / 道具 / 装备 数据
   ============================================================ */

/* ---------------- 元素 ---------------- */
export const ELEM = {
  none: { name: '无', color: '#ffffff' },
  fire: { name: '炎', color: '#ff6a1a' },
  ice: { name: '冰', color: '#8fe6ff' },
  thunder: { name: '雷', color: '#ffe14d' },
  dark: { name: '暗', color: '#b06bff' },
  holy: { name: '圣', color: '#fff3c4' },
};

/* ---------------- 状态 ---------------- */
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
  kaito: {
    id: 'kaito', name: '凯', title: '炎之剑士', portrait: 'kaito',
    role: '剑士', joinLevel: 1,
    // 凯用「愤怒」而非术力：开战为 0，靠攻击/受击/格挡积攒
    resource: 'rage',
    base: { hp: 320, mp: 40, atk: 46, def: 26, spd: 30, cri: 0.10, blk: 0.18, par: 0.08, rageMul: 1.0, mpRegen: 3 },
    grow: { hp: 46, mp: 4, atk: 4.9, def: 2.5, spd: 1.4 },
    weaponSkill: ['xinzhan', 'lianren', 'leiming', 'jiaoyan', 'miehun'],
    skills: [
      { id: 'xinzhan', lv: 1 }, { id: 'lianren', lv: 3 }, { id: 'liepo', lv: 6 },
      { id: 'leiming', lv: 9 }, { id: 'jiaoyan', lv: 12 }, { id: 'miehun', lv: 15 },
    ],
    quote: '「我的剑，不会为仇恨而挥——它为守护而出鞘！」',
    winQuote: '还站得起来吗？那就继续。',
  },
  cang: {
    id: 'cang', name: '苍', title: '苍蓝术士', portrait: 'cang',
    role: '治愈', joinLevel: 2,
    resource: 'mp',
    base: { hp: 230, mp: 110, atk: 30, def: 20, spd: 28, cri: 0.06, blk: 0.10, par: 0.05, rageMul: 0.9, mpRegen: 6 },
    grow: { hp: 34, mp: 12, atk: 3.0, def: 1.9, spd: 1.3 },
    weaponSkill: ['liaoshang', 'bingzhen', 'shengguang', 'leiting', 'fuyin'],
    skills: [
      { id: 'liaoshang', lv: 2 }, { id: 'bingzhen', lv: 4 }, { id: 'qifu', lv: 7 },
      { id: 'shengguang', lv: 9 }, { id: 'leiting', lv: 11 }, { id: 'fuyin', lv: 13 }, { id: 'zhenyan', lv: 15 },
    ],
    quote: '「别逞强了，笨蛋。——把手给我。」',
    winQuote: '伤口我来处理，你只管往前冲。',
  },
  lei: {
    id: 'lei', name: '雷', title: '疾风之枪', portrait: 'lei',
    role: '枪兵', joinLevel: 4,
    resource: 'mp',
    base: { hp: 280, mp: 60, atk: 42, def: 24, spd: 36, cri: 0.14, blk: 0.12, par: 0.14, rageMul: 1.1, mpRegen: 4 },
    grow: { hp: 41, mp: 6, atk: 4.5, def: 2.3, spd: 1.9 },
    weaponSkill: ['tuchuan', 'lianshe', 'leiting', 'xunyou'],
    skills: [
      { id: 'tuchuan', lv: 4 }, { id: 'lianshe', lv: 6 }, { id: 'zhuihun', lv: 9 },
      { id: 'leiting', lv: 12 }, { id: 'xunyou', lv: 14 },
    ],
    quote: '「速度就是我的答案——看都看不清，就别谈什么胜负了！」',
    winQuote: '太慢了，太慢了！',
  },
  ryze: {
    id: 'ryze', name: '璃', title: '冰晶少女', portrait: 'ryze',
    role: '法师', joinLevel: 6,
    resource: 'mp',
    base: { hp: 210, mp: 130, atk: 34, def: 18, spd: 26, cri: 0.08, blk: 0.08, par: 0.06, rageMul: 1.2, mpRegen: 7 },
    grow: { hp: 31, mp: 14, atk: 5.3, def: 1.8, spd: 1.2 },
    weaponSkill: ['bingzhen', 'baoxue', 'bingfeng', 'fuyin'],
    skills: [
      { id: 'bingzhen', lv: 6 }, { id: 'baoxue', lv: 8 }, { id: 'bingfeng', lv: 11 },
      { id: 'juedui', lv: 13 }, { id: 'fuyin', lv: 15 },
    ],
    quote: '「……我这样的人，也可以站在光里吗？」',
    winQuote: '对不起……但我必须走下去。',
  },
};

/* ---------------- 技能表 ----------------
   type: atk 攻击 / heal 治疗 / buff 增益 / debuff 减益 / revive 复活
------------------------------------------- */
export const SKILLS = {
  /* —— 凯 —— */
  xinzhan: {
    id: 'xinzhan', name: '心斩', mp: 0, type: 'atk', elem: 'none', power: 1.0, hits: 1,
    target: 'one', desc: '凝聚斗气的一击。回复自身少量热血。', rage: 12,
    fx: 'slash',
  },
  lianren: {
    id: 'lianren', name: '连刃·三连斩', mp: 14, type: 'atk', elem: 'none', power: 0.62, hits: 3,
    target: 'one', desc: '连续三次斩击，命中数越多热血越高。', rage: 16,
    fx: 'slash', multi: true,
  },
  liepo: {
    id: 'liepo', name: '裂地·炎爆斩', mp: 22, type: 'atk', elem: 'fire', power: 1.75, hits: 1,
    target: 'all', desc: '烈焰横扫，对全体敌人造成炎属性伤害，有机会点燃。', rage: 18,
    fx: 'fire', inflict: { id: 'burn', chance: 0.4 },
  },
  leiming: {
    id: 'leiming', name: '雷鸣·千鸟突', mp: 26, type: 'atk', elem: 'thunder', power: 2.05, hits: 1,
    target: 'one', desc: '雷光贯穿单体，高概率使其眩晕。', rage: 20,
    fx: 'thunder', inflict: { id: 'stun', chance: 0.35 },
  },
  jiaoyan: {
    id: 'jiaoyan', name: '焦炎·狮子奋迅', mp: 34, type: 'buff', target: 'self',
    desc: '炎之斗气爆发：攻击力大幅上升，且行动更快。', rage: 25,
    fx: 'aura', buff: { id: 'atkUp', turns: 3 }, buff2: { id: 'haste', turns: 3 },
  },
  miehun: {
    id: 'miehun', name: '奥义·灭魂炎狱斩', mp: 58, type: 'atk', elem: 'fire', power: 1.05, hits: 5,
    target: 'one', desc: '【奥义】五段斩在敌人体内燃起炎狱。', rage: 0,
    fx: 'fire', ult: true, multi: true, inflict: { id: 'burn', chance: 0.9 },
  },

  /* —— 苍 —— */
  liaoshang: {
    id: 'liaoshang', name: '疗伤', mp: 14, type: 'heal', power: 0.55, target: 'ally',
    desc: '以术式治愈一名同伴。', rage: 10, fx: 'heal',
  },
  bingzhen: {
    id: 'bingzhen', name: '冰针', mp: 12, type: 'atk', elem: 'ice', power: 1.45, hits: 1,
    target: 'one', desc: '冰之针贯穿敌人。', rage: 12, fx: 'ice',
  },
  qifu: {
    id: 'qifu', name: '苍之祈愿', mp: 30, type: 'heal', power: 0.40, target: 'party',
    desc: '苍蓝之光治愈全体同伴，并提升防御。', rage: 14, fx: 'heal',
    buff: { id: 'defUp', turns: 3 },
  },
  shengguang: {
    id: 'shengguang', name: '圣光·裁罪', mp: 22, type: 'atk', elem: 'holy', power: 1.65, hits: 1,
    target: 'one', desc: '苍白的审判之光，对魔性之物格外有效。', rage: 14, fx: 'thunder',
  },
  leiting: {
    id: 'leiting', name: '雷霆', mp: 24, type: 'atk', elem: 'thunder', power: 1.60, hits: 1,
    target: 'all', desc: '落雷轰击全体敌人。', rage: 14, fx: 'thunder',
  },
  fuyin: {
    id: 'fuyin', name: '福音・复苏之光', mp: 46, type: 'revive', power: 0.45, target: 'ally',
    desc: '唤醒倒下的同伴并回复其生命。', rage: 20, fx: 'heal',
  },
  zhenyan: {
    id: 'zhenyan', name: '奥义·苍之绝唱', mp: 120, type: 'heal', power: 0.85, target: 'party',
    desc: '【奥义】苍蓝之光笼罩全军：大幅回复、附加再生，并让全队立刻抢到先手。', rage: 0,
    fx: 'heal', ult: true, buff: { id: 'regen', turns: 4 }, gauge: 45,
  },

  /* —— 雷 —— */
  tuchuan: {
    id: 'tuchuan', name: '突穿', mp: 0, type: 'atk', elem: 'none', power: 1.05, hits: 1,
    target: 'one', desc: '高速突刺。', rage: 13, fx: 'pierce',
  },
  lianshe: {
    id: 'lianshe', name: '连突·四连枪', mp: 16, type: 'atk', elem: 'none', power: 0.55, hits: 4,
    target: 'one', desc: '四连突刺，暴击率提升，并把目标的行动条往后打。', rage: 17,
    fx: 'pierce', multi: true, criBonus: 0.2, gauge: -22,
  },
  zhuihun: {
    id: 'zhuihun', name: '追魂枪', mp: 22, type: 'atk', elem: 'dark', power: 1.9, hits: 1,
    target: 'one', desc: '锁定灵魂的一击，无视部分防御。', rage: 18, fx: 'pierce', pierceDef: 0.5,
  },
  xunyou: {
    id: 'xunyou', name: '奥义·疾风迅游枪', mp: 90, type: 'atk', elem: 'thunder', power: 0.72, hits: 7,
    target: 'one', desc: '【奥义】化作疾风，七连贯穿。', rage: 0,
    fx: 'pierce', ult: true, multi: true,
  },

  /* —— 璃 —— */
  baoxue: {
    id: 'baoxue', name: '暴雪', mp: 20, type: 'atk', elem: 'ice', power: 1.5, hits: 1,
    target: 'all', desc: '暴风雪覆盖全场，有机会让敌人迟缓。', rage: 14, fx: 'ice',
    inflict: { id: 'slow', chance: 0.5 },
  },
  bingfeng: {
    id: 'bingfeng', name: '冰封之棺', mp: 26, type: 'atk', elem: 'ice', power: 1.7, hits: 1,
    target: 'one', desc: '将敌人封入冰棺，高概率冰封。', rage: 16, fx: 'ice',
    inflict: { id: 'frozen', chance: 0.45 },
  },
  juedui: {
    id: 'juedui', name: '奥义·绝对零度', mp: 150, type: 'atk', elem: 'ice', power: 2.25, hits: 1,
    target: 'all', desc: '【奥义】连时空都冻结的极寒。', rage: 0,
    fx: 'ice', ult: true, inflict: { id: 'frozen', chance: 0.5 },
  },

  /* —— 通用/共享 —— */
  'guard': { id: 'guard', name: '格挡', mp: 0, type: 'guard', target: 'self', desc: '摆出防御姿态，减伤并积攒热血。' },
};

/* ---------------- 装备 ---------------- */
export const EQUIPS = {
  mu_sword: { id: 'mu_sword', name: '木刀', slot: 'weapon', atk: 4, desc: '修行用的木刀。', price: 0 },
  iron_sword: { id: 'iron_sword', name: '铁之长剑', slot: 'weapon', atk: 14, desc: '村里铁匠打的结实长剑。', price: 180 },
  flame_sword: { id: 'flame_sword', name: '炎纹剑·绯', slot: 'weapon', atk: 28, cri: 0.06, desc: '刃纹如火焰流动的名刀。', price: 620 },
  holy_sword: { id: 'holy_sword', name: '圣剑·霜华', slot: 'weapon', atk: 46, cri: 0.10, mp: 20, desc: '冰封千年的圣剑，刃上开着霜花。', price: 0 },
  wood_staff: { id: 'wood_staff', name: '木杖', slot: 'weapon', atk: 4, mp: 10, desc: '见习术士的杖。', price: 0 },
  blue_staff: { id: 'blue_staff', name: '苍蓝法杖', slot: 'weapon', atk: 12, mp: 30, desc: '能增强术式的青蓝法杖。', price: 260 },
  snow_staff: { id: 'snow_staff', name: '雪晶法杖', slot: 'weapon', atk: 22, mp: 55, desc: '冰晶在杖顶缓缓旋转。', price: 0 },
  hunter_spear: { id: 'hunter_spear', name: '猎兵短枪', slot: 'weapon', atk: 12, spd: 3, desc: '轻巧好用的短枪。', price: 0 },
  storm_spear: { id: 'storm_spear', name: '疾风长枪', slot: 'weapon', atk: 30, spd: 7, desc: '枪身刻着风的纹路。', price: 560 },
  cloth: { id: 'cloth', name: '旅装', slot: 'armor', def: 6, desc: '普通的旅行衣物。', price: 0 },
  leather: { id: 'leather', name: '皮甲', slot: 'armor', def: 14, hp: 30, blk: 0.03, desc: '轻便的兽皮护甲。', price: 150 },
  chain: { id: 'chain', name: '锁子甲', slot: 'armor', def: 26, hp: 70, blk: 0.06, desc: '细密的铁环护甲。', price: 420 },
  demon_mail: { id: 'demon_mail', name: '魔铠·黑曜', slot: 'armor', def: 38, hp: 130, blk: 0.10, desc: '从魔将身上剥下的漆黑铠甲。', price: 0 },
  holy_cloak: { id: 'holy_cloak', name: '圣袍·曙光', slot: 'armor', def: 32, hp: 110, mp: 30, blk: 0.05, desc: '织入了黎明之光的圣袍。', price: 0 },
  ring_pow: { id: 'ring_pow', name: '炎之指环', slot: 'acc', atk: 10, desc: '让斗气更灼热的指环。', price: 200 },
  ring_life: { id: 'ring_life', name: '生命护符', slot: 'acc', hp: 90, desc: '缓缓补给生命力的护符。', price: 200 },
  ring_fast: { id: 'ring_fast', name: '疾风之靴', slot: 'acc', spd: 6, par: 0.05, desc: '脚步轻快如风。', price: 180 },
  bond_ring: { id: 'bond_ring', name: '羁绊之证', slot: 'acc', atk: 16, def: 12, hp: 60, blk: 0.04, par: 0.03, desc: '同伴赠予的护身符——只要戴着，就不是一个人在战斗。', price: 0 },
};

/* ---------------- 道具 ---------------- */
export const ITEMS = {
  potion: { id: 'potion', name: '疗伤药', heal: 150, price: 40, desc: '回复一名同伴150点生命。', target: 'ally' },
  potion_hi: { id: 'potion_hi', name: '高级疗伤药', heal: 420, price: 110, desc: '回复一名同伴420点生命。', target: 'ally' },
  elixir: { id: 'elixir', name: '全愈之露', heal: 9999, price: 320, desc: '完全回复生命与术力。', target: 'ally', full: true },
  ether: { id: 'ether', name: '术力之泉', mp: 60, price: 70, desc: '回复60点术力。', target: 'ally' },
  revive: { id: 'revive', name: '复苏之羽', revive: 0.5, price: 200, desc: '唤醒倒下的同伴并回复一半生命。', target: 'ally' },
  seal: { id: 'seal', name: '封魔符', seal: 1, price: 90, desc: '使一名敌人下回合无法行动。', target: 'enemy' },
  bomb: { id: 'bomb', name: '炎爆弹', dmg: 230, elem: 'fire', price: 120, desc: '对一名敌人造成固定炎属性伤害。', target: 'enemy' },
  smoke: { id: 'smoke', name: '遁形烟', escape: 1, price: 70, desc: '必定从战斗中脱身（对首领无效）。', target: 'self' },
};

/* ---------------- 商店 ---------------- */
export const SHOPS = {
  village: { name: '铁匠铺 & 药屋', items: ['potion', 'ether', 'leather', 'iron_sword', 'wood_staff', 'ring_pow'] },
  harbor: { name: '港町商会', items: ['potion', 'potion_hi', 'ether', 'revive', 'seal', 'smoke', 'chain', 'blue_staff', 'hunter_spear', 'ring_fast'] },
  north: { name: '北境补给站', items: ['potion_hi', 'elixir', 'revive', 'bomb', 'flame_sword', 'storm_spear', 'ring_life', 'holy_cloak'] },
  final: { name: '深渊前哨 · 最后的交易', items: ['potion_hi', 'elixir', 'revive', 'bomb', 'demon_mail', 'bond_ring'] },
};

/* ---------------- 敌人 ----------------
   shape: humanoid / wolf / bird / slime / demon / king
------------------------------------------- */
export const ENEMIES = {
  training_dummy: {
    id: 'training_dummy', name: '练习木桩', shape: 'humanoid',
    palette: { hair: '#806044', cloth: '#9a7955', trim: '#d4b080', skin: '#bc9464', eye: '#59432e', weapon: 'staff' },
    hp: 100, atk: 1, def: 0, spd: 18, exp: 0, gold: 0, hot: 0,
    weak: [], quote: '（绑着布团的横臂缓缓转来。）', skills: [{ id: 'atk', w: 1 }],
  },
  demon_soldier: {
    id: 'demon_soldier', name: '魔兵', shape: 'humanoid', palette: { hair: '#3a1020', cloth: '#4a1220', trim: '#8f1226', skin: '#c98f8f', eye: '#ff3b4e', weapon: 'axe' },
    hp: 180, atk: 26, def: 10, spd: 26, exp: 22, gold: 24, hot: 9,
    weak: ['thunder'],
    quote: '嘶——人类的血……',
    skills: [{ id: 'atk', w: 8 }, { id: 'heavy', w: 3 }],
  },
  demon_soldier2: {
    id: 'demon_soldier2', name: '魔兵·弓手', shape: 'humanoid', palette: { hair: '#20182e', cloth: '#2c1a3a', trim: '#a04a1a', skin: '#c98f8f', eye: '#ffa01a', weapon: 'bow' },
    hp: 150, atk: 34, def: 6, spd: 32, exp: 24, gold: 26, hot: 9,
    weak: ['fire'],
    quote: '别动，很快就结束了。',
    skills: [{ id: 'atk', w: 6 }, { id: 'snipe', w: 3 }],
  },
  hell_hound: {
    id: 'hell_hound', name: '冥狼', shape: 'wolf', palette: { body: '#2a1a3a', trim: '#8f1226', eye: '#ff6a1a', fang: '#fff2e0' },
    hp: 220, atk: 42, def: 8, spd: 40, exp: 30, gold: 28, hot: 10,
    weak: ['fire'],
    quote: '呜嗷——！',
    skills: [{ id: 'atk', w: 7 }, { id: 'bite', w: 3 }, { id: 'howl', w: 2 }],
  },
  ice_hound: {
    id: 'ice_hound', name: '霜牙兽', shape: 'wolf', palette: { body: '#8fb8d8', trim: '#48d8ff', eye: '#e8ffff', fang: '#ffffff' },
    hp: 820, atk: 62, def: 14, spd: 40, exp: 34, gold: 32, hot: 10,
    weak: ['fire'],
    quote: '咕噜噜……',
    skills: [{ id: 'atk', w: 7 }, { id: 'frostbite', w: 3 }, { id: 'howl', w: 2 }],
  },
  forest_guard: {
    id: 'forest_guard', name: '森之守卫', shape: 'demon', palette: { body: '#1e3a22', trim: '#5aa04a', eye: '#ffe14d' },
    hp: 760, atk: 62, def: 18, spd: 30, exp: 60, gold: 80, hot: 11,
    weak: ['fire'],
    quote: '离开……这片森林……',
    skills: [{ id: 'atk', w: 4 }, { id: 'rootbind', w: 2 }, { id: 'heavy', w: 4 }, { id: 'quake', w: 4 }],
    boss: true,
  },
  ice_witch: {
    id: 'ice_witch', name: '冰之魔女·丝薇雅', shape: 'humanoid', scale: 1.1,
    palette: { hair: '#cfe8ff', cloth: '#1c3a5c', trim: '#8fe6ff', skin: '#ffe0e8', eye: '#48d8ff', weapon: 'staff' },
    hp: 1700, atk: 62, def: 22, spd: 38, exp: 180, gold: 260, hot: 12,
    weak: ['fire'],
    quote: '在永恒的冬天里沉睡吧。',
    skills: [{ id: 'atk', w: 3 }, { id: 'ice_lance', w: 3 }, { id: 'blizzard', w: 5 }, { id: 'ice_coffin', w: 2 }, { id: 'frost_nova', w: 3 }],
    boss: true,
  },
  zain: {
    id: 'zain', name: '暗影四天王·泽恩', shape: 'humanoid', scale: 1.15,
    palette: { hair: '#12101e', cloth: '#1a0f22', trim: '#8f1226', skin: '#e0c0c0', eye: '#ff3b4e', weapon: 'twin' },
    hp: 2900, atk: 84, def: 30, spd: 46, exp: 320, gold: 420, hot: 13,
    weak: ['thunder', 'holy'],
    quote: '「热血」？真是廉价的词汇。',
    skills: [{ id: 'atk', w: 3 }, { id: 'dark_slash', w: 4 }, { id: 'shadow_step', w: 3 }, { id: 'drain', w: 2 }, { id: 'dark_wave', w: 4 }, { id: 'dark_seal', w: 2 }],
    boss: true,
  },
  baixue: {
    id: 'baixue', name: '冰之四天王·白雪', shape: 'humanoid', scale: 1.12,
    palette: { hair: '#eaf4ff', cloth: '#1c3a5c', trim: '#dceaf8', skin: '#ffeef4', eye: '#8fe6ff', weapon: 'staff' },
    hp: 2200, atk: 62, def: 34, spd: 40, exp: 460, gold: 600, hot: 13,
    weak: ['fire'],
    quote: '勇气？那不过是没有尝过绝望的错觉。',
    skills: [{ id: 'atk', w: 4 }, { id: 'ice_lance', w: 3 }, { id: 'blizzard', w: 3 }, { id: 'ice_coffin', w: 3 }, { id: 'frost_nova', w: 2 }],
    boss: true,
  },
  demon_general: {
    id: 'demon_general', name: '魔将·古兰', shape: 'demon', scale: 1.2,
    palette: { body: '#2a0c14', trim: '#c8a04a', eye: '#ff6a1a' },
    hp: 3400, atk: 79, def: 40, spd: 34, exp: 520, gold: 700, hot: 14,
    weak: ['ice', 'holy'],
    quote: '人类的城池，一座一座烧掉就好。',
    skills: [{ id: 'atk', w: 5 }, { id: 'heavy', w: 4 }, { id: 'dark_slash', w: 3 }, { id: 'quake', w: 2 }],
    boss: true,
  },
  demon_king: {
    id: 'demon_king', name: '魔王·阿斯特', shape: 'king', scale: 1.35,
    palette: { body: '#14060e', trim: '#c8a04a', eye: '#ff2a3c', cape: '#5a0a18' },
    hp: 3100, atk: 64, def: 40, spd: 46, exp: 999, gold: 999, hot: 15,
    weak: ['ice', 'holy'],
    quote: '——来吧，让我看看人类能燃烧到什么程度。',
    skills: [
      { id: 'atk', w: 4 }, { id: 'dark_slash', w: 4 }, { id: 'abyss', w: 3 },
      { id: 'king_roar', w: 2 }, { id: 'meteor', w: 3 }, { id: 'drain', w: 2 },
    ],
    boss: true,
  },
  demon_king_final: {
    id: 'demon_king_final', name: '终焉魔王·阿斯特·真', shape: 'king', scale: 1.55,
    palette: { body: '#0a0308', trim: '#ffd76a', eye: '#ff2a3c', cape: '#8f0f22' },
    hp: 5200, atk: 69, def: 46, spd: 50, exp: 999, gold: 999, hot: 16,
    weak: ['thunder', 'holy'],
    quote: '绝望吧。这就是终焉。',
    skills: [
      { id: 'atk', w: 3 }, { id: 'dark_slash', w: 4 }, { id: 'abyss', w: 3 },
      { id: 'king_roar', w: 3 }, { id: 'meteor', w: 3 }, { id: 'drain', w: 2 }, { id: 'annihilate', w: 2 },
    ],
    boss: true,
  },
};

// 新旅程的敌人复用现有绘制轮廓，拥有独立数值和名称。
Object.assign(ENEMIES, {
  curse_root: { ...ENEMIES.forest_guard, id: 'curse_root', name: '咒缚根', boss: false, hp: 170, atk: 12, def: 4, spd: 16, exp: 12, gold: 0, quote: '（黑根扎进树心。）', skills: [{ id: 'rootbind', w: 1 }] },
  harbor_guard: { ...ENEMIES.demon_soldier, id: 'harbor_guard', name: '商会武装护卫', hp: 420, atk: 37, def: 14, exp: 48, gold: 55, weak: ['thunder'], quote: '凭证呢？退后！' },
  relic_guard: { ...ENEMIES.demon_soldier, id: 'relic_guard', name: '遗迹石像', hp: 1050, atk: 48, def: 28, spd: 22, exp: 95, gold: 65, weak: ['ice', 'holy'], quote: '（古老的机关重新运转。）' },
  memory_blade: { ...ENEMIES.zain, id: 'memory_blade', name: '记忆中的刀影', hp: 1800, atk: 54, def: 22, spd: 34, exp: 180, gold: 0, weak: ['holy', 'thunder'], quote: '（回去吧。饭已经好了。）', skills: [{ id: 'atk', w: 4 }, { id: 'heavy', w: 2 }] },
});

/* ---------------- 敌人技能 ---------------- */
export const ENEMY_SKILLS = {
  atk: { id: 'atk', name: '攻击', power: 1.0, elem: 'none' },
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
  dark_slash: { id: 'dark_slash', name: '暗影斩', power: 1.65, elem: 'dark' },
  dark_wave: { id: 'dark_wave', name: '暗影波动', power: 1.25, elem: 'dark', target: 'all' },
  dark_seal: { id: 'dark_seal', name: '影缚·封术', power: 1.45, elem: 'dark', inflict: { id: 'seal', chance: 0.55 } },
  shadow_step: { id: 'shadow_step', name: '影渡', power: 1.2, elem: 'dark', hits: 2 },
  drain: { id: 'drain', name: '生命吸取', power: 1.3, elem: 'dark', drain: 0.6 },
  quake: { id: 'quake', name: '震地', power: 1.35, elem: 'none', target: 'all', inflict: { id: 'stun', chance: 0.25 } },
  abyss: { id: 'abyss', name: '深渊之颚', power: 1.8, elem: 'dark', inflict: { id: 'defDown', chance: 0.4 } },
  king_roar: { id: 'king_roar', name: '魔王咆哮', power: 1.4, elem: 'dark', target: 'all', inflict: { id: 'defDown', chance: 0.6 } },
  meteor: { id: 'meteor', name: '陨星坠落', power: 2.0, elem: 'fire', target: 'all' },
  annihilate: { id: 'annihilate', name: '终焉之刃', power: 2.6, elem: 'dark', target: 'all', gauge: -28 },
};

/* ---------------- 成长曲线 ---------------- */
export function expToNext(level) { return Math.floor(42 + level * level * 3.2); }

export function statsAt(def, level, equips = []) {
  const g = def.grow, b = def.base;
  const k = level - 1;
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
