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
  /* 注：四个内部 id（kaito/cang/lei/ryze）保留为纯引擎键——
     天赋树、立绘、武器归属、羁绊表都按它们索引。玩家看不到 id，
     看到的是 name/title/role。改 id 收益为零，破坏面却很大。 */

  /* —— 主角：叶天邪，游戏 ID「邪天」 ——
     资源用「龙魂」（沿用 rage 机制）：开战为 0，靠出手、挨打、格挡累积。
     这套机制天然适合他——越打越猛，但开局最脆，符合「拿命换爆发」的定位。 */
  kaito: {
    id: 'kaito', name: '邪天', title: '逆骨邪龙', portrait: 'kaito',
    realName: '叶天邪', role: '近战', joinLevel: 1,
    resource: 'rage', resourceName: '龙魂',
    base: { hp: 340, mp: 40, atk: 50, def: 24, spd: 32, cri: 0.12, blk: 0.16, par: 0.10, rageMul: 1.15, mpRegen: 3 },
    grow: { hp: 49, mp: 4, atk: 5.4, def: 2.4, spd: 1.5 },
    weaponSkill: ['ni_claw', 'ni_scale', 'ni_roar', 'ni_twin', 'ni_golden'],
    skills: [
      { id: 'ni_claw', lv: 1 }, { id: 'ni_scale', lv: 3 }, { id: 'ni_ember', lv: 5 }, { id: 'ni_roar', lv: 6 },
      { id: 'ni_burst', lv: 8 }, { id: 'ni_twin', lv: 10 }, { id: 'ni_abyss', lv: 14 },
      { id: 'ni_defy', lv: 18 }, { id: 'ni_golden', lv: 24 },
    ],
    quote: '「我死过一次了。这辈子轮到我说了算。」',
    winQuote: '还有谁？',
  },

  /* —— 璃仙儿 ——
     治疗 + 增益。设定上她知道的比主角多得多，但从不一次说完，
     数值上做成「续航极强、爆发极弱」，逼玩家把她当作战线而不是输出。 */
  cang: {
    id: 'cang', name: '仙儿', title: '谪尘之灵', portrait: 'cang',
    realName: '璃仙儿', role: '治愈', joinLevel: 2,
    resource: 'mp', resourceName: '灵息',
    base: { hp: 236, mp: 124, atk: 28, def: 20, spd: 29, cri: 0.05, blk: 0.11, par: 0.06, rageMul: 0.9, mpRegen: 7 },
    grow: { hp: 35, mp: 13, atk: 2.8, def: 2.0, spd: 1.3 },
    weaponSkill: ['xi_mend', 'xi_veil', 'xi_purge', 'xi_bloom'],
    skills: [
      { id: 'xi_mend', lv: 2 }, { id: 'xi_veil', lv: 4 }, { id: 'xi_purge', lv: 7 },
      { id: 'xi_bloom', lv: 9 }, { id: 'xi_chain', lv: 11 }, { id: 'xi_seal', lv: 13 },
      { id: 'xi_return', lv: 14 },
    ],
    quote: '「你要走的那条路，我走过一次。所以这次我跟着你。」',
    winQuote: '手伸过来，别逞强。',
  },

  /* —— 梦羽衣 · 幻影妖莲 ——
     查证：在更早的一款游戏里就与主角相识；仙儿离开后陪主角度过最难的一段。
     称号「幻影妖莲」，另有「血梦天堂妖罗」「血妖月」等称呼。
     ⚠ 她的实际登场时间点未考证——本项目暂放在游击位，等原文校对。
     数值定位是我配的：极快、极脆、会心高。 */
  lei: {
    id: 'lei', name: '梦羽衣', title: '幻影妖莲', portrait: 'lei',
    realName: '梦羽衣', role: '游击', joinLevel: 4,
    resource: 'mp', resourceName: '妖力',
    base: { hp: 272, mp: 62, atk: 44, def: 22, spd: 39, cri: 0.17, blk: 0.10, par: 0.15, rageMul: 1.1, mpRegen: 4 },
    grow: { hp: 39, mp: 6, atk: 4.7, def: 2.1, spd: 2.1 },
    weaponSkill: ['th_pierce', 'th_volley', 'th_mark', 'th_gale'],
    skills: [
      { id: 'th_pierce', lv: 4 }, { id: 'th_volley', lv: 6 }, { id: 'th_mark', lv: 9 },
      { id: 'th_accel', lv: 10 }, { id: 'th_gale', lv: 12 }, { id: 'th_last', lv: 15 },
    ],
    quote: '「你那副样子，我在上一个游戏里就看腻了。」',
    winQuote: '影子比人先到——这句话你该习惯了。',
  },

  /* —— 果果 ——
     看上去十二三岁，实际是全队最危险的那个。数值刻意做成极端：
     血少得离谱、输出高得离谱，放出去要么秒杀全场要么自己先倒。 */
  ryze: {
    id: 'ryze', name: '果果', title: '不知名的圣子', portrait: 'ryze',
    realName: '果果', role: '术士', joinLevel: 6,
    resource: 'mp', resourceName: '神识',
    base: { hp: 196, mp: 146, atk: 38, def: 16, spd: 27, cri: 0.09, blk: 0.06, par: 0.05, rageMul: 1.2, mpRegen: 8 },
    grow: { hp: 28, mp: 16, atk: 6.1, def: 1.6, spd: 1.2 },
    weaponSkill: ['gg_spark', 'gg_collapse', 'gg_zero', 'gg_seal'],
    skills: [
      { id: 'gg_spark', lv: 6 }, { id: 'gg_collapse', lv: 8 }, { id: 'gg_zero', lv: 11 },
      { id: 'gg_wither', lv: 13 }, { id: 'gg_seal', lv: 15 },
    ],
    quote: '「这个世界的规则我看过了。写得不太好。」',
    winQuote: '嗯。下一个。',
  },
};

/* ---------------- 技能表 ----------------
   type: atk 攻击 / heal 治疗 / buff 增益 / debuff 减益 / revive 复活
------------------------------------------- */
export const SKILLS = {
  /* ============ 邪天 · 逆骨邪龙线 ============
     设计主轴：所有强招都要付代价——自伤、破防、或者把行动条压给敌人。
     龙魂（rage）开局为 0，所以前两回合他是全队最弱的，越往后越不讲理。 */
  ni_claw: {
    id: 'ni_claw', name: '逆鳞爪', mp: 0, type: 'atk', elem: 'none', power: 1.05, hits: 1,
    target: 'one', desc: '骨中逆纹浮出，一记贯穿爪。积攒龙魂。', rage: 14,
    fx: 'slash',
  },
  ni_scale: {
    id: 'ni_scale', name: '龙鳞·三叠', mp: 0, type: 'atk', elem: 'none', power: 0.66, hits: 3,
    target: 'one', desc: '三段叠爪，段数越多龙魂涨得越快。', rage: 18,
    fx: 'flurry', multi: true,
  },
  ni_ember: {
    id: 'ni_ember', name: '龙炎·喷', mp: 0, type: 'atk', elem: 'fire', power: 1.25, hits: 1,
    target: 'all', desc: '低头喷出一口龙炎，全体炎属性伤害，有机会点燃。', rage: 15,
    fx: 'fire', inflict: { id: 'burn', chance: 0.45 },
  },
  ni_roar: {
    id: 'ni_roar', name: '龙吼·慑', mp: 0, type: 'debuff', target: 'all',
    desc: '龙魂外放震慑全场：敌方全体行动条后退，并有机会迟缓。', rage: 16,
    fx: 'roar', gaugePush: 20, inflict: { id: 'slow', chance: 0.45 },
  },
  ni_burst: {
    id: 'ni_burst', name: '血爆·逆冲', mp: 25, type: 'atk', elem: 'dark', power: 1.60, hits: 2,
    target: 'one', desc: '【龙魂·壹】燃烧自身精血双击，自伤最大生命 8%。', rage: 0,
    fx: 'dark', multi: true, release: 1, selfDamage: 0.08,
  },
  ni_twin: {
    id: 'ni_twin', name: '光暗双龙魂', mp: 45, type: 'atk', elem: 'holy', power: 1.15, hits: 4,
    target: 'one', desc: '【龙魂·贰】光暗两道龙魂交缠贯穿，无视半数防御。', rage: 0,
    fx: 'twin', ult: true, multi: true, release: 2, pierce: 0.5,
  },
  ni_abyss: {
    id: 'ni_abyss', name: '深渊爪皇', mp: 55, type: 'atk', elem: 'dark', power: 2.35, hits: 1,
    target: 'all', desc: '【龙魂·贰】前世那只手伸了出来。全体暗属性重击，高概率封印。', rage: 0,
    fx: 'abyss', ult: true, release: 2, inflict: { id: 'seal', chance: 0.6 },
  },
  ni_defy: {
    id: 'ni_defy', name: '逆天·苍穹断', mp: 80, type: 'atk', elem: 'dark', power: 1.45, hits: 5,
    target: 'all', desc: '【龙魂·叁】五段撕裂全场，自伤三成生命，但回满龙魂。', rage: 0,
    fx: 'defy', ult: true, multi: true, release: 3, selfDamage: 0.30,
  },
  ni_golden: {
    id: 'ni_golden', name: '黄金龙神·临', mp: 100, type: 'atk', elem: 'holy', power: 2.10, hits: 4,
    target: 'all', desc: '【龙魂·叁】三转形态显化，全体圣属性四段，并回复自身五成生命。', rage: 0,
    fx: 'golden', ult: true, multi: true, release: 3, selfHeal: 0.5,
  },

  /* ============ 仙儿 · 谪尘之灵 ============
     纯续航位。刻意不给她任何高倍率攻击技——
     她的价值是让邪天敢用那些自伤技，而不是自己去砍人。 */
  xi_mend: {
    id: 'xi_mend', name: '灵息·补', mp: 12, type: 'heal', target: 'ally',
    desc: '回复单体生命，并清除一个轻度异常。', power: 1.0, fx: 'heal', cleanse: 1,
  },
  xi_veil: {
    id: 'xi_veil', name: '谪尘帷', mp: 18, type: 'buff', target: 'allies',
    desc: '全队防御上升，并获得少量伤害吸收。', fx: 'veil',
    buff: { id: 'defUp', turns: 3 }, shield: 0.12,
  },
  xi_purge: {
    id: 'xi_purge', name: '净尘', mp: 20, type: 'heal', target: 'allies',
    desc: '全队小幅回复，并清除所有负面状态。', power: 0.55, fx: 'purge', cleanseAll: true,
  },
  xi_bloom: {
    id: 'xi_bloom', name: '花开千年', mp: 30, type: 'heal', target: 'allies',
    desc: '全队大幅回复，并附加三回合再生。', power: 1.05, fx: 'bloom',
    buff: { id: 'regen', turns: 3 },
  },
  xi_chain: {
    id: 'xi_chain', name: '灵息·牵', mp: 26, type: 'buff', target: 'allies',
    desc: '全队立刻推进行动条，抢下先手。', fx: 'chain', gaugePull: 30,
  },
  xi_seal: {
    id: 'xi_seal', name: '缚灵印', mp: 28, type: 'debuff', target: 'one',
    desc: '封住目标的技能，只能普攻或格挡。', fx: 'seal',
    inflict: { id: 'seal', chance: 0.85 },
  },
  xi_return: {
    id: 'xi_return', name: '前生缘·归', mp: 60, type: 'revive', target: 'ally',
    desc: '【奥义】把倒下的同伴拉回来，并回复其全部生命。', fx: 'revive', ult: true, reviveFull: true,
  },

  /* ============ 天痕 · 断风枪手 ============
     行动条操控专家。他不负责打最高的那一下，负责让敌人永远慢半拍。 */
  th_pierce: {
    id: 'th_pierce', name: '断风·刺', mp: 8, type: 'atk', elem: 'none', power: 1.35, hits: 1,
    target: 'one', desc: '一记直刺，无视部分防御。', fx: 'pierce', pierce: 0.3,
  },
  th_volley: {
    id: 'th_volley', name: '连突·四连枪', mp: 16, type: 'atk', elem: 'none', power: 0.60, hits: 4,
    target: 'one', desc: '四段连突，并把目标的行动条往后打。', fx: 'flurry',
    multi: true, gaugePush: 22,
  },
  th_mark: {
    id: 'th_mark', name: '猎标', mp: 14, type: 'debuff', target: 'one',
    desc: '标记目标：其防御下降，且全队对它的会心率上升。', fx: 'mark',
    inflict: { id: 'defDown', chance: 1 }, markCrit: 0.2,
  },
  th_accel: {
    id: 'th_accel', name: '提速', mp: 12, type: 'buff', target: 'self',
    desc: '把气劲压进腿上：自身速度大幅提升，连续抢两次出手。', fx: 'aura',
    buff: { id: 'haste', turns: 3 },
  },
  th_gale: {
    id: 'th_gale', name: '疾风·裂空', mp: 24, type: 'atk', elem: 'thunder', power: 1.80, hits: 1,
    target: 'all', desc: '横扫全场的雷属性枪风，有机会眩晕。', fx: 'bolt',
    inflict: { id: 'stun', chance: 0.3 },
  },
  th_last: {
    id: 'th_last', name: '奥义·追不上的那一枪', mp: 55, type: 'atk', elem: 'thunder', power: 1.30, hits: 5,
    target: 'one', desc: '【奥义】五段爆发，命中后自身立刻再动一次。', fx: 'bolt',
    ult: true, multi: true, extraTurn: true,
  },

  /* ============ 果果 · 不知名的圣子 ============
     极端玻璃炮。倍率全队最高，但她挨两下就会倒——
     玩家必须先学会保她，才能用她。 */
  gg_spark: {
    id: 'gg_spark', name: '识·点', mp: 10, type: 'atk', elem: 'holy', power: 1.40, hits: 1,
    target: 'one', desc: '一点神识落下，命中处凭空塌陷。', fx: 'spark',
  },
  gg_collapse: {
    id: 'gg_collapse', name: '规则·崩', mp: 24, type: 'atk', elem: 'dark', power: 2.10, hits: 1,
    target: 'all', desc: '强行改写一小片区域的规则，全体承受暗属性伤害。', fx: 'collapse',
    inflict: { id: 'defDown', chance: 0.5 },
  },
  gg_zero: {
    id: 'gg_zero', name: '归零', mp: 32, type: 'atk', elem: 'ice', power: 2.60, hits: 1,
    target: 'one', desc: '把目标的存在往回抹一段，高概率冰封。', fx: 'ice',
    inflict: { id: 'frozen', chance: 0.55 },
  },
  gg_wither: {
    id: 'gg_wither', name: '花谢', mp: 30, type: 'debuff', target: 'all',
    desc: '全体剧毒与迟缓。她说这叫「让时间按它本来的样子走」。', fx: 'wither',
    inflict: { id: 'poison', chance: 0.8 }, inflict2: { id: 'slow', chance: 0.6 },
  },
  gg_seal: {
    id: 'gg_seal', name: '奥义·这一页不算', mp: 70, type: 'atk', elem: 'holy', power: 3.40, hits: 2,
    target: 'all', desc: '【奥义】她合上书又翻开。全场两段圣属性抹除。', fx: 'golden',
    ult: true, multi: true,
  },
};

/* ---------------- 连携技 ----------------
   条件：两人在行动条顺序上相邻 + 羁绊达标。发动时消耗两人的当前回合。
   这是羁绊系统在战斗里的出口——培养羁绊不再只是结局分支的开关。 */
export const COMBOS = {
  /* 连携技要求双方羁绊达标。设计意图：让「带谁出场」变成一个真选择，
     而不是永远上四个数值最高的。 */
  polar: {
    id: 'polar', name: '冻骨·爪落', members: ['kaito', 'ryze'], bond: 2,
    power: 1.9, hits: 3, elem: 'ice', target: 'one', fx: 'ice',
    desc: '果果先把目标冻在原地，邪天的爪再落下。目标冰封时伤害翻倍。',
    bonusVs: { status: 'frozen', mul: 2 },
  },
  twinlance: {
    id: 'twinlance', name: '双锋·破阵', members: ['kaito', 'lei'], bond: 2,
    power: 1.35, hits: 4, elem: 'none', target: 'one', fx: 'pierce',
    desc: '天痕一枪撕开缺口，邪天贴身补上四爪。必定会心。',
    alwaysCrit: true,
  },
  sanctuary: {
    id: 'sanctuary', name: '尘外结界', members: ['cang', 'ryze'], bond: 3,
    power: 0, type: 'support', target: 'party', fx: 'heal',
    desc: '仙儿撑起帷幕，果果在里面改写了两回合的规则。全体回复并硬化防御。',
    healRatio: 0.35, buff: { id: 'defUp', turns: 2 },
  },
  windbless: {
    id: 'windbless', name: '牵风', members: ['cang', 'lei'], bond: 3,
    power: 0, type: 'support', target: 'party', fx: 'aura',
    desc: '仙儿把灵息接到天痕的枪上，全队跟着他一起抢先手。',
    buff: { id: 'haste', turns: 3 }, pushAll: 34,
  },
  defiance: {
    id: 'defiance', name: '化身邪龙', members: ['kaito', 'cang', 'lei', 'ryze'], bond: 4,
    power: 2.4, hits: 4, elem: 'dark', target: 'all', fx: 'defy',
    desc: '四个人同时出手。全员羁绊 Lv4 以上才会亮起——这一招的前提是没人打算走。',
    finale: true,
  },
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
  /* 目前剧情只到第八章，只有新手村村口一个摊子是可达的。
     NPC 只卖消耗品和垫底装备——原文里真正的装备来自掉落和任务。 */
  novice: { name: '新手村 · 杂货摊',
    items: ['potion', 'potion_hi', 'ether', 'revive', 'seal', 'bomb', 'smoke',
            'leather', 'chain', 'iron_sword', 'wood_staff', 'hunter_spear',
            'ring_pow', 'ring_life', 'ring_fast'] },
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
    theme: '古森遗誓', boss: true,
  },
  ice_witch: {
    id: 'ice_witch', name: '冰之魔女·丝薇雅', shape: 'humanoid', scale: 1.1,
    palette: { hair: '#cfe8ff', cloth: '#1c3a5c', trim: '#8fe6ff', skin: '#ffe0e8', eye: '#48d8ff', weapon: 'staff' },
    hp: 1700, atk: 62, def: 22, spd: 38, exp: 180, gold: 260, hot: 12,
    weak: ['fire'],
    quote: '在永恒的冬天里沉睡吧。',
    skills: [{ id: 'atk', w: 3 }, { id: 'ice_lance', w: 3 }, { id: 'blizzard', w: 5 }, { id: 'ice_coffin', w: 2 }, { id: 'frost_nova', w: 3 }],
    theme: '失落冰庭', boss: true,
  },
  zain: {
    id: 'zain', name: '暗影四天王·泽恩', shape: 'humanoid', scale: 1.15,
    palette: { hair: '#12101e', cloth: '#1a0f22', trim: '#8f1226', skin: '#e0c0c0', eye: '#ff3b4e', weapon: 'twin' },
    hp: 2900, atk: 84, def: 30, spd: 46, exp: 320, gold: 420, hot: 13,
    weak: ['thunder', 'holy'],
    quote: '「热血」？真是廉价的词汇。',
    skills: [{ id: 'atk', w: 3 }, { id: 'dark_slash', w: 4 }, { id: 'shadow_step', w: 3 }, { id: 'drain', w: 2 }, { id: 'dark_wave', w: 4 }, { id: 'dark_seal', w: 2 }],
    theme: '影廊禁卫', boss: true,
  },
  baixue: {
    id: 'baixue', name: '冰之四天王·白雪', shape: 'humanoid', scale: 1.12,
    palette: { hair: '#eaf4ff', cloth: '#1c3a5c', trim: '#dceaf8', skin: '#ffeef4', eye: '#8fe6ff', weapon: 'staff' },
    hp: 2200, atk: 62, def: 34, spd: 40, exp: 460, gold: 600, hot: 13,
    weak: ['fire'],
    quote: '勇气？那不过是没有尝过绝望的错觉。',
    skills: [{ id: 'atk', w: 4 }, { id: 'ice_lance', w: 3 }, { id: 'blizzard', w: 3 }, { id: 'ice_coffin', w: 3 }, { id: 'frost_nova', w: 2 }],
    theme: '失落冰庭', boss: true,
  },
  demon_general: {
    id: 'demon_general', name: '魔将·古兰', shape: 'demon', scale: 1.2,
    palette: { body: '#2a0c14', trim: '#c8a04a', eye: '#ff6a1a' },
    hp: 3400, atk: 79, def: 40, spd: 34, exp: 520, gold: 700, hot: 14,
    weak: ['ice', 'holy'],
    quote: '人类的城池，一座一座烧掉就好。',
    skills: [{ id: 'atk', w: 5 }, { id: 'heavy', w: 4 }, { id: 'dark_slash', w: 3 }, { id: 'quake', w: 2 }],
    theme: '赤狱战场', boss: true,
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
    theme: '旧日英雄', boss: true,
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
    theme: '旧日英雄', boss: true,
  },


  /* ===================== 第一卷「永恒命运之刻」 =====================
     ⚠ 以下敌人按查证到的章节标题设置（第八章「杀狼！」、第十五章「再战鬼谷子」）。
     具体形象、数值、技能组均为本项目设计，原著未考证。

     已拆除：天阙外围哨 / 玄冥跟单 / 逆骨之守 / 天阙队长·执圭
     —— 那四个连同「天阙公会战」整段都是原创虚构，原著中不存在。 */

  /* 第八章「杀狼！」——原文：野狼 5 级，生命 170，喜群居，
     会对靠近的人类主动发起攻击，移动速度约为玩家基础移动力的 1.5 倍。
     速度值按「1.5 倍」折算给高，血量按原文 170 直接用。 */
  wild_wolf: {
    id: 'wild_wolf', name: '野狼', shape: 'wolf',
    palette: { body: '#6a6258', trim: '#3a352e', eye: '#ff6a4a', fang: '#f6efe2' },
    hp: 170, atk: 19, def: 5, spd: 33, exp: 42, gold: 16, hot: 4,
    weak: ['fire'], quote: '（一声长嚎。另外两只被惊动了。）',
    skills: [{ id: 'atk', w: 8 }, { id: 'heavy', w: 2 }],
  },
  novice_wolf: {
    id: 'novice_wolf', name: '灰狼', shape: 'wolf',
    palette: { body: '#6a6a72', trim: '#3e3e46', eye: '#ffd24a', fang: '#f4efe4' },
    hp: 95, atk: 16, def: 4, spd: 24, exp: 24, gold: 12, hot: 3,
    weak: ['fire'], quote: '（新手村外第一群怪。它们成群，从不单独出现。）',
    skills: [{ id: 'atk', w: 1 }],
  },
  wolf_alpha: {
    id: 'wolf_alpha', name: '狼群首领', shape: 'wolf',
    palette: { body: '#4a4a56', trim: '#26262e', eye: '#ff8a3a', fang: '#fffaf0' },
    hp: 260, atk: 26, def: 9, spd: 28, exp: 78, gold: 46, hot: 8,
    weak: ['fire'], quote: '（比其它狼大了一圈。它在等你先动。）',
    skills: [{ id: 'atk', w: 7 }, { id: 'heavy', w: 4 }],
  },

  /* 幽风平原 —— 查证：十五级以下弱小怪物活跃，初级玩家练级之地 */
  plain_sprite: {
    id: 'plain_sprite', name: '幽风精', shape: 'humanoid',
    palette: { hair: '#2e4a48', cloth: '#33564f', trim: '#7fd8c0', skin: '#9fc4bb', eye: '#b7ffe6', weapon: 'none' },
    hp: 140, atk: 21, def: 7, spd: 30, exp: 40, gold: 22, hot: 5,
    weak: ['thunder'], quote: '（风停下来的时候，才看得见它。）',
    skills: [{ id: 'atk', w: 7 }, { id: 'snipe', w: 3 }],
  },
  plain_beast: {
    id: 'plain_beast', name: '平原角兽', shape: 'wolf',
    palette: { body: '#5a4a36', trim: '#332a1e', eye: '#ffb24a', fang: '#fff4e0' },
    hp: 210, atk: 27, def: 12, spd: 22, exp: 58, gold: 34, hot: 7,
    weak: ['ice'], quote: '（低头把角对准你，然后就不动了。）',
    skills: [{ id: 'atk', w: 6 }, { id: 'heavy', w: 4 }],
  },

  /* 第十五章「再战鬼谷子」——「再战」说明之前已经交过手。
     ⚠ 他的身份、立场、战斗方式原著未考证，这里只按「反复出现的对手」来配。 */
  guiguzi: {
    id: 'guiguzi', name: '鬼谷子', shape: 'humanoid', boss: true,
    palette: { hair: '#d8d8d0', cloth: '#2a2a33', trim: '#8fa8c8', skin: '#d4c0a8', eye: '#9fd8ff', weapon: 'staff' },
    hp: 1380, atk: 48, def: 20, spd: 31, exp: 480, gold: 360, hot: 28,
    weak: ['dark'],
    quote: '（又是你。上次没打完的，这次接着来。）',
    skills: [{ id: 'atk', w: 5 }, { id: 'heavy', w: 3 }, { id: 'snipe', w: 3 }, { id: 'roarpush', w: 2 }],
    phase2: { atk: 1.32, quote: '（这次你比上次快了不少。）' },
  },
};

// 新旅程的敌人复用现有绘制轮廓，拥有独立数值和名称。
Object.assign(ENEMIES, {
  curse_root: { ...ENEMIES.forest_guard, id: 'curse_root', name: '咒缚根', boss: false, hp: 170, atk: 12, def: 4, spd: 16, exp: 12, gold: 0, quote: '（黑根扎进树心。）', skills: [{ id: 'rootbind', w: 1 }] },
  harbor_guard: { ...ENEMIES.demon_soldier, id: 'harbor_guard', name: '商会武装护卫', hp: 420, atk: 68, def: 14, exp: 48, gold: 55, weak: ['thunder'], quote: '凭证呢？退后！' },
  relic_guard: { ...ENEMIES.demon_soldier, id: 'relic_guard', name: '遗迹石像', hp: 1050, atk: 102, def: 28, spd: 22, exp: 95, gold: 65, weak: ['ice', 'holy'], quote: '（古老的机关重新运转。）' },
  memory_blade: { ...ENEMIES.zain, id: 'memory_blade', name: '记忆中的刀影', hp: 1800, atk: 124, def: 22, spd: 34, exp: 180, gold: 0, weak: ['holy', 'thunder'], quote: '（回去吧。饭已经好了。）', skills: [{ id: 'atk', w: 4 }, { id: 'heavy', w: 2 }] },
});

/* ---------------- 第二部 · 门的另一边 ----------------
   仙灵（Lv20+）、天绝（Lv27+）、神器（Lv34+）、超神器（Lv42+）四个档位，
   与 512 件装备图鉴的后四个品质一一对应：打到哪一层，就掉哪一层的东西。
   theme 字段决定首领掉落会走图鉴里的哪个主题。 */
Object.assign(ENEMIES, {
  /* — 第七章 · 仙灵之野 — */
  spirit_moth: {
    id: 'spirit_moth', name: '灵蛾', shape: 'bird',
    palette: { body: '#8fd8c8', trim: '#e8fff8', eye: '#fff3c4', wing: '#a8e8d8' },
    baseLevel: 20, hp: 2600, atk: 210, def: 96, spd: 46, exp: 520, gold: 260, hot: 16,
    weak: ['fire'], quote: '（翅膀上的鳞粉正在褪色。）',
    skills: [{ id: 'atk', w: 6 }, { id: 'pollen', w: 4 }, { id: 'dazzle', w: 3 }],
  },
  withered_root: {
    id: 'withered_root', name: '枯灵根', shape: 'demon',
    palette: { body: '#4a4030', trim: '#8a7a50', eye: '#d8c88a' },
    baseLevel: 20, hp: 3400, atk: 190, def: 118, spd: 24, exp: 560, gold: 280, hot: 16,
    weak: ['fire', 'holy'], quote: '（它在找水。这里已经没有水了。）',
    skills: [{ id: 'atk', w: 5 }, { id: 'rootbind', w: 4 }, { id: 'drain', w: 3 }],
  },
  xuanlu: {
    id: 'xuanlu', name: '玄鹿', shape: 'wolf', scale: 1.25,
    palette: { body: '#3a4a3a', trim: '#a8d8a0', eye: '#e8ffd8', fang: '#ffffff' },
    baseLevel: 21, hp: 8200, atk: 262, def: 140, spd: 38, exp: 2200, gold: 1300, hot: 17,
    weak: ['fire'], theme: '万木仙庭',
    quote: '（它低下头。角上缠着还没枯的藤。）',
    skills: [{ id: 'atk', w: 4 }, { id: 'rootbind', w: 3 }, { id: 'quake', w: 3 }, { id: 'pollen', w: 3 }],
    boss: true,
    phases: [{ at: 0.4, lines: ['（角上的藤开始发光。它不是在攻击，是在求救。）'], gain: { def: 1.2 }, col: '#a8d8a0' }],
  },
  qingluan: {
    id: 'qingluan', name: '青鸾', shape: 'bird', scale: 1.3,
    palette: { body: '#2a6a8a', trim: '#ff8a1a', eye: '#fff3c4', wing: '#48b8d8' },
    baseLevel: 23, hp: 9000, atk: 290, def: 128, spd: 54, exp: 2400, gold: 1400, hot: 17,
    weak: ['ice'], theme: '丹霞火山',
    quote: '门关上那天，我们就开始烧了。',
    skills: [{ id: 'atk', w: 3 }, { id: 'plume_storm', w: 4 }, { id: 'phoenix_dive', w: 3 }, { id: 'meteor', w: 2 }],
    boss: true,
    phases: [
      { at: 0.55, lines: ['你们把门关上，是为了活。我不怪你们。'], gain: { spd: 1.18 }, addSkills: ['phoenix_dive'], col: '#ff8a1a' },
      { at: 0.22, lines: ['但你们得听完我烧完之前要说的话。'], gain: { atk: 1.28 }, clearBuffs: true, col: '#ffd76a' },
    ],
  },
  jiuwei: {
    id: 'jiuwei', name: '九尾', shape: 'wolf', scale: 1.28,
    palette: { body: '#8a2a4a', trim: '#ffd76a', eye: '#ff6a8a', fang: '#fff2e0' },
    baseLevel: 24, hp: 10200, atk: 306, def: 132, spd: 60, exp: 2600, gold: 1500, hot: 17,
    weak: ['holy'], theme: '幽梦仙乡',
    quote: '你们要找的答案，我这里有九个版本。挑一个？',
    skills: [{ id: 'atk', w: 3 }, { id: 'mirage', w: 4 }, { id: 'drain', w: 3 }, { id: 'dark_slash', w: 3 }],
    boss: true,
    phases: [
      { at: 0.6, lines: ['第一个版本：你们是对的。'], gain: { spd: 1.2 }, addSkills: ['mirage'], col: '#ff6a8a' },
      { at: 0.25, lines: ['第九个版本：门后面本来就没有人。你信哪个？'], gain: { atk: 1.3 }, clearBuffs: true, col: '#ffd76a' },
    ],
  },
  baize: {
    id: 'baize', name: '白泽', shape: 'king', scale: 1.35,
    palette: { body: '#e8e4f2', trim: '#8a7ad8', eye: '#6a5ab8', cape: '#c8c0e4' },
    baseLevel: 26, hp: 9200, atk: 418, def: 152, spd: 48, exp: 3000, gold: 1800, hot: 18,
    weak: ['dark'], theme: '神兽遗谷',
    quote: '我知道所有事。包括你们不想听的那一件。',
    skills: [{ id: 'atk', w: 3 }, { id: 'truth_lash', w: 4 }, { id: 'dark_seal', w: 3 }, { id: 'king_roar', w: 2 }],
    boss: true,
    phases: [
      { at: 0.5, lines: ['门不是魔王造的。'], gain: { atk: 1.16 }, addSkills: ['truth_lash'], col: '#8a7ad8' },
      { at: 0.2, lines: ['是神造的。为了把会吵的东西，全部关在外面。'], gain: { spd: 1.2 }, clearBuffs: true, col: '#ffd76a' },
    ],
  },

  /* — 第八章 · 断天之径 — */
  edict_sentry: {
    id: 'edict_sentry', name: '禁制哨戒', shape: 'humanoid', scale: 1.1,
    palette: { hair: '#c8c8d8', cloth: '#3a3a52', trim: '#ff3b4e', skin: '#d8d8e8', eye: '#ff3b4e', weapon: 'twin' },
    baseLevel: 27, hp: 5200, atk: 330, def: 176, spd: 50, exp: 900, gold: 520, hot: 18,
    weak: ['thunder'], quote: '此路已被删除。',
    skills: [{ id: 'atk', w: 5 }, { id: 'erase', w: 3 }, { id: 'dark_seal', w: 3 }],
  },
  name_wraith: {
    id: 'name_wraith', name: '无名者', shape: 'humanoid',
    palette: { hair: '#6a6a7a', cloth: '#22222e', trim: '#8a8a9a', skin: '#9a9aaa', eye: '#e8e8f8', weapon: 'sword' },
    baseLevel: 27, hp: 4600, atk: 318, def: 160, spd: 54, exp: 860, gold: 480, hot: 18,
    weak: ['holy'], quote: '（它张嘴，却发不出自己的名字。）',
    skills: [{ id: 'atk', w: 6 }, { id: 'drain', w: 3 }, { id: 'silence_field', w: 3 }],
  },
  zangxing: {
    id: 'zangxing', name: '葬星', shape: 'king', scale: 1.45,
    palette: { body: '#10142a', trim: '#8fa8ff', eye: '#ffffff', cape: '#1a2450' },
    baseLevel: 29, hp: 17000, atk: 452, def: 198, spd: 52, exp: 4200, gold: 2400, hot: 19,
    weak: ['fire'], theme: '星陨荒原',
    quote: '星星落下来的时候，没有人会记得它叫什么。',
    skills: [{ id: 'atk', w: 3 }, { id: 'starfall', w: 4 }, { id: 'meteor', w: 3 }, { id: 'erase', w: 2 }],
    boss: true,
    phases: [
      { at: 0.6, lines: ['名字是最先掉下去的东西。'], gain: { atk: 1.15 }, addSkills: ['starfall'], col: '#8fa8ff' },
      { at: 0.28, lines: ['你们记得的那些，我一并收走。'], gain: { atk: 1.25, spd: 1.12 }, clearBuffs: true, col: '#ffffff' },
    ],
  },
  jimie: {
    id: 'jimie', name: '寂灭', shape: 'demon', scale: 1.5,
    palette: { body: '#0a0a10', trim: '#4a4a5a', eye: '#8a8a9a' },
    baseLevel: 31, hp: 12500, atk: 624, def: 224, spd: 44, exp: 4700, gold: 2700, hot: 19,
    weak: ['holy', 'thunder'], theme: '长夜死境',
    quote: '……',
    skills: [{ id: 'atk', w: 4 }, { id: 'silence_field', w: 4 }, { id: 'abyss', w: 3 }, { id: 'erase', w: 3 }],
    boss: true,
    phases: [
      { at: 0.55, lines: ['（它没有说话。整个场地的声音矮了一截。）'], gain: { def: 1.2 }, addSkills: ['silence_field'], col: '#4a4a5a' },
      { at: 0.2, lines: ['（连脚步声也消失了。）'], gain: { atk: 1.3, spd: 1.2 }, clearBuffs: true, col: '#8a8a9a' },
    ],
  },
  nierming: {
    id: 'nierming', name: '逆命', shape: 'humanoid', scale: 1.4,
    palette: { hair: '#ffd76a', cloth: '#2a1030', trim: '#c86bff', skin: '#e8d8e8', eye: '#c86bff', weapon: 'twin' },
    baseLevel: 33, hp: 15000, atk: 560, def: 212, spd: 64, exp: 5200, gold: 3000, hot: 19,
    weak: ['none'], theme: '命轮裂隙',
    quote: '我已经赢过你们了。只是你们还没走到那一步。',
    skills: [{ id: 'atk', w: 3 }, { id: 'rewind', w: 4 }, { id: 'shadow_step', w: 3 }, { id: 'dark_seal', w: 2 }],
    boss: true,
    phases: [
      { at: 0.5, lines: ['第一次回溯。'], heal: 0.25, gain: { spd: 1.15 }, col: '#c86bff' },
      { at: 0.2, lines: ['第二次。……没有第三次了，对吧。'], gain: { atk: 1.3 }, clearBuffs: true, col: '#ffd76a' },
    ],
  },

  /* — 第九章 · 神域七柱 — */
  god_flame: {
    id: 'god_flame', name: '炎之神·迦罗', shape: 'king', scale: 1.5,
    palette: { body: '#3a0c08', trim: '#ffb43d', eye: '#ff6a1a', cape: '#8f1226' },
    baseLevel: 35, hp: 16000, atk: 700, def: 258, spd: 56, exp: 7000, gold: 3600, hot: 20,
    weak: ['ice'], theme: '原初炎庭', quote: '我给过人类火。人类拿它烧了一整座山。',
    skills: [{ id: 'atk', w: 3 }, { id: 'meteor', w: 4 }, { id: 'divine_judge', w: 3 }, { id: 'starfall', w: 2 }],
    boss: true,
    phases: [{ at: 0.5, lines: ['所以我收回来了。有意见？'], gain: { atk: 1.22 }, addSkills: ['divine_judge'], col: '#ffb43d' }],
  },
  god_frost: {
    id: 'god_frost', name: '霜之神·希兰', shape: 'king', scale: 1.5,
    palette: { body: '#0a1e38', trim: '#bfe4ff', eye: '#8fe6ff', cape: '#2c5480' },
    baseLevel: 35, hp: 16200, atk: 762, def: 272, spd: 52, exp: 7000, gold: 3600, hot: 20,
    weak: ['fire'], theme: '太古雪国', quote: '安静是我能给的最好的礼物。',
    skills: [{ id: 'atk', w: 3 }, { id: 'frost_nova', w: 4 }, { id: 'ice_coffin', w: 3 }, { id: 'divine_judge', w: 2 }],
    boss: true,
    phases: [{ at: 0.5, lines: ['你们连这个也要拒绝。'], gain: { def: 1.2, spd: 1.1 }, addSkills: ['divine_judge'], col: '#8fe6ff' }],
  },
  god_thunder: {
    id: 'god_thunder', name: '雷之神·迅', shape: 'king', scale: 1.45,
    palette: { body: '#2a2a10', trim: '#ffe14d', eye: '#fff6c0', cape: '#6a5a10' },
    baseLevel: 36, hp: 15200, atk: 852, def: 260, spd: 74, exp: 7200, gold: 3700, hot: 20,
    weak: ['dark'], theme: '天雷神庭', quote: '快一点结束，对大家都好。',
    skills: [{ id: 'atk', w: 4 }, { id: 'divine_judge', w: 4 }, { id: 'shadow_step', w: 3 }],
    boss: true,
    phases: [{ at: 0.45, lines: ['还不够快。'], gain: { spd: 1.3 }, col: '#ffe14d' }],
  },
  god_forest: {
    id: 'god_forest', name: '森之神·娑', shape: 'demon', scale: 1.55,
    palette: { body: '#16301a', trim: '#7ad86a', eye: '#e8ffd8' },
    baseLevel: 36, hp: 15400, atk: 898, def: 286, spd: 42, exp: 7200, gold: 3700, hot: 20,
    weak: ['fire'], theme: '苍生神木', quote: '树不会问为什么要活着。',
    skills: [{ id: 'atk', w: 4 }, { id: 'rootbind', w: 3 }, { id: 'quake', w: 3 }, { id: 'divine_judge', w: 3 }],
    boss: true,
    phases: [{ at: 0.5, lines: ['你们问得太多了。'], gain: { def: 1.25 }, heal: 0.08, col: '#7ad86a' }],
  },
  god_sea: {
    id: 'god_sea', name: '海之神·澜', shape: 'king', scale: 1.5,
    palette: { body: '#08243a', trim: '#48d8ff', eye: '#e8ffff', cape: '#1c5a80' },
    baseLevel: 37, hp: 16000, atk: 756, def: 276, spd: 54, exp: 7400, gold: 3800, hot: 20,
    weak: ['thunder'], theme: '星海神殿', quote: '潮水带走了多少名字，你们数得清吗？',
    skills: [{ id: 'atk', w: 3 }, { id: 'tide', w: 4 }, { id: 'frost_nova', w: 3 }, { id: 'divine_judge', w: 2 }],
    boss: true,
    phases: [{ at: 0.5, lines: ['数不清。所以别数了。'], gain: { atk: 1.2 }, addSkills: ['tide'], col: '#48d8ff' }],
  },
  god_night: {
    id: 'god_night', name: '夜之神·缇', shape: 'humanoid', scale: 1.4,
    palette: { hair: '#1a1020', cloth: '#0a0810', trim: '#6a4a8a', skin: '#c8b8d8', eye: '#c86bff', weapon: 'twin' },
    baseLevel: 37, hp: 15200, atk: 772, def: 268, spd: 68, exp: 7400, gold: 3800, hot: 20,
    weak: ['holy'], theme: '幽月王座', quote: '睡吧。醒着太辛苦了。',
    skills: [{ id: 'atk', w: 3 }, { id: 'dark_wave', w: 4 }, { id: 'silence_field', w: 3 }, { id: 'divine_judge', w: 2 }],
    boss: true,
    phases: [{ at: 0.45, lines: ['你们为什么不肯睡。'], gain: { spd: 1.2, atk: 1.15 }, col: '#c86bff' }],
  },
  god_light: {
    id: 'god_light', name: '光之神·曜', shape: 'king', scale: 1.55,
    palette: { body: '#3a3018', trim: '#fff3c4', eye: '#ffffff', cape: '#c8a04a' },
    baseLevel: 39, hp: 16800, atk: 820, def: 298, spd: 60, exp: 8200, gold: 4200, hot: 21,
    weak: ['dark'], theme: '白昼王座', quote: '我照过所有角落。角落里什么都没有。',
    skills: [{ id: 'atk', w: 3 }, { id: 'divine_judge', w: 5 }, { id: 'starfall', w: 3 }, { id: 'king_roar', w: 2 }],
    boss: true,
    phases: [
      { at: 0.6, lines: ['我看过了。真的什么都没有。'], gain: { atk: 1.18 }, col: '#fff3c4' },
      { at: 0.25, lines: ['……那你们在照着什么走？'], gain: { spd: 1.2 }, clearBuffs: true, col: '#ffffff' },
    ],
  },

  /* — 终幕 · 超神器 — */
  law_order: {
    id: 'law_order', name: '时序', shape: 'king', scale: 1.6,
    palette: { body: '#1a1830', trim: '#c8c0ff', eye: '#ffffff', cape: '#3a3060' },
    baseLevel: 43, hp: 19000, atk: 1180, def: 322, spd: 82, exp: 12000, gold: 6000, hot: 21,
    weak: ['none'], theme: '时序禁器', quote: '你们已经输了。只是顺序还没到。',
    skills: [{ id: 'atk', w: 3 }, { id: 'rewind', w: 4 }, { id: 'divine_judge', w: 3 }, { id: 'erase', w: 3 }],
    boss: true,
    phases: [
      { at: 0.6, lines: ['把这一段倒回去。'], heal: 0.15, gain: { spd: 1.2 }, col: '#c8c0ff' },
      { at: 0.25, lines: ['……倒不回去了。'], gain: { atk: 1.3 }, clearBuffs: true, col: '#ffffff' },
    ],
  },
  law_cause: {
    id: 'law_cause', name: '因果', shape: 'demon', scale: 1.6,
    palette: { body: '#2a1018', trim: '#ff8a8a', eye: '#ffd76a' },
    baseLevel: 45, hp: 21000, atk: 1046, def: 340, spd: 64, exp: 13000, gold: 6500, hot: 21,
    weak: ['holy'], theme: '命途禁器', quote: '你烧了村子，所以你要救人。这很公平。',
    skills: [{ id: 'atk', w: 3 }, { id: 'karma', w: 4 }, { id: 'abyss', w: 3 }, { id: 'divine_judge', w: 3 }],
    boss: true,
    phases: [
      { at: 0.55, lines: ['你父亲开了门，所以你必须关上它。'], gain: { atk: 1.2 }, addSkills: ['karma'], col: '#ff8a8a' },
      { at: 0.22, lines: ['你们不接受？那就由你们来还。'], gain: { atk: 1.28, spd: 1.15 }, clearBuffs: true, col: '#ffd76a' },
    ],
  },
  law_end: {
    id: 'law_end', name: '终焉', shape: 'king', scale: 1.8,
    palette: { body: '#050308', trim: '#fde68a', eye: '#ffffff', cape: '#2a0a12' },
    baseLevel: 48, hp: 24000, atk: 980, def: 366, spd: 72, exp: 26000, gold: 9999, hot: 22,
    weak: ['fire'], theme: '终末遗器',
    quote: '我不是谁。我是「安静下来」这件事本身。',
    skills: [
      { id: 'atk', w: 3 }, { id: 'divine_judge', w: 4 }, { id: 'starfall', w: 3 },
      { id: 'karma', w: 3 }, { id: 'erase', w: 3 }, { id: 'silence_field', w: 2 }, { id: 'annihilate', w: 3 },
    ],
    boss: true,
    phases: [
      { at: 0.78, lines: ['为什么还在响。'], gain: { atk: 1.10 }, addSkills: ['starfall'], col: '#fde68a' },
      { at: 0.55, lines: ['我给过你们很多次安静的机会。'], gain: { atk: 1.14, spd: 1.08 }, addSkills: ['karma'], col: '#ff8a8a' },
      { at: 0.32, lines: ['健次郎也吵。阿斯特也吵。你们全都一样。'], gain: { atk: 1.18 }, clearBuffs: true, col: '#ffd76a' },
      { at: 0.12, lines: ['……那就一直吵下去吧。吵到我听不见为止。'], gain: { atk: 1.25, spd: 1.15 }, heal: 0.04, col: '#ffffff', music: 'hot' },
    ],
  },
});

/* ---------------- 首领阶段 ----------------
   血量跌破阈值时换台词、换数值、换技能表。
   此前首领从第一回合到第三十七回合行为完全不变，这是「战斗太长」真正的来源。 */
Object.assign(ENEMIES.forest_guard, {
  phases: [
    { at: 0.5, lines: ['（守卫的胸口裂开，黑根整片翻涌出来。）'], gain: { atk: 1.12 }, addSkills: ['quake'], col: '#5aa04a' },
  ],
});
Object.assign(ENEMIES.ice_witch, {
  phases: [
    { at: 0.55, lines: ['有点意思。那这个呢？'], gain: { spd: 1.15 }, addSkills: ['frost_nova'], col: '#8fe6ff' },
    { at: 0.22, lines: ['在永恒的冬天里沉睡吧——！'], gain: { atk: 1.22 }, clearBuffs: true, col: '#e8ffff' },
  ],
});
Object.assign(ENEMIES.zain, {
  phases: [
    { at: 0.6, lines: ['你们追不上我。'], gain: { spd: 1.2 }, addSkills: ['shadow_step'], col: '#c86bff' },
    { at: 0.25, lines: ['那就连影子一起，全部吃掉。'], gain: { atk: 1.25 }, addSkills: ['dark_wave'], clearBuffs: true, col: '#ff3b4e' },
  ],
});
Object.assign(ENEMIES.baixue, {
  phases: [
    { at: 0.5, lines: ['勇气？让我看看它能撑多久。'], gain: { atk: 1.18, def: 1.1 }, addSkills: ['ice_coffin'], col: '#8fe6ff' },
  ],
});
Object.assign(ENEMIES.demon_general, {
  phases: [
    { at: 0.45, lines: ['好！就是这个！再来！'], gain: { atk: 1.3 }, addSkills: ['quake'], clearBuffs: true, col: '#ff6a1a' },
  ],
});
Object.assign(ENEMIES.demon_king, {
  phases: [
    { at: 0.65, lines: ['……你们还站着。'], gain: { atk: 1.15, spd: 1.1 }, addSkills: ['dark_wave'], col: '#ff2a3c' },
    { at: 0.3, lines: ['那就让这个世界安静下来。'], gain: { atk: 1.25 }, addSkills: ['meteor'], clearBuffs: true, col: '#ffd76a' },
  ],
});
Object.assign(ENEMIES.demon_king_final, {
  phases: [
    { at: 0.7, lines: ['吵。'], gain: { atk: 1.12, spd: 1.08 }, addSkills: ['king_roar'], col: '#ff2a3c' },
    { at: 0.42, lines: ['五百年了，还是这么吵。'], gain: { atk: 1.18 }, addSkills: ['annihilate'], clearBuffs: true, col: '#8f0f22' },
    { at: 0.15, lines: ['——健次郎。你教出来的这些东西，真难听。'], gain: { atk: 1.3, spd: 1.15 }, heal: 0.05, col: '#ffd76a', music: 'hot' },
  ],
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

/* ---------------- 成长曲线 ---------------- */
/* 第二部把等级上限推到 50，所以后段曲线要放缓，
   否则 Lv30 之后每一级都要打十几场。 */
export const MAX_LEVEL = 50;
export function expToNext(level) {
  const base = 42 + level * level * 3.2;
  return Math.floor(level > 27 ? base * (1 - (level - 27) * 0.014) : base);
}

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
