/* ============================================================
   growth.js — 角色养成

   升级不再只是数字自己往上跳。每级会给：
     · 3 点【属性点】—— 玩家自己分配到 力/体/敏/念
     · 1 点【技能点】—— 投进角色专属的天赋树

   两者都存进存档，都在 recalc() 里参与最终属性计算，
   也都会被二周目继承。这是「同一个角色能练成不同样子」的地基。
   ============================================================ */

export const STAT_POINTS_PER_LEVEL = 3;
export const SP_PER_LEVEL = 1;

/* ---------------- 属性点 ----------------
   四围各自影响两项派生属性，避免出现「只堆一项」的最优解。 */
export const STATS = [
  { id: 'str', name: '力', desc: '攻击力 +2.4　会心率 +0.2%', col: '#ff8048' },
  { id: 'vit', name: '体', desc: '生命 +14　防御力 +1.3', col: '#7dffa8' },
  { id: 'agi', name: '敏', desc: '速度 +1.1　弹反率 +0.3%', col: '#8fe6ff' },
  { id: 'foc', name: '念', desc: '术力 +9　格挡率 +0.3%', col: '#c08ad6' },
];

export function applyStatPoints(s, alloc = {}) {
  const { str = 0, vit = 0, agi = 0, foc = 0 } = alloc;
  s.atk += Math.round(str * 2.4);
  s.cri += str * 0.002;
  s.hp += vit * 14;
  s.def += Math.round(vit * 1.3);
  s.spd += Math.round(agi * 1.1);
  s.par += agi * 0.003;
  s.mp += foc * 9;
  s.blk += foc * 0.003;
  return s;
}

/* ---------------- 天赋树 ----------------
   每个角色三条分支，各四层。req 指向同一条分支的上一层，
   保证玩家必须在「铺宽」和「挖深」之间做选择。

   eff 里的键分两类：
     · 直接属性（atk/def/hp/mp/spd/cri/blk/par）→ 进 statsAt 后的加成
     · 战斗特效（与 loot.js 的词缀同名）→ 由 talentBonus() 读出来，
       battle.js 把它和装备词缀加在一起算。 */
export const TALENTS = {
  kaito: [
    /* 炎道 —— 把怒气变成输出 */
    { id: 'k_f1', br: '炎道', tier: 0, name: '烈息', max: 3, eff: { atk: 4 }, desc: '攻击力 +4／级' },
    { id: 'k_f2', br: '炎道', tier: 1, req: 'k_f1', max: 3, eff: { ragePlus: 0.08 }, desc: '怒气获取 +8%／级' },
    { id: 'k_f3', br: '炎道', tier: 2, req: 'k_f2', max: 2, eff: { elemDmg: { fire: 0.07 } }, desc: '炎属性伤害 +7%／级' },
    { id: 'k_f4', br: '炎道', tier: 3, req: 'k_f3', max: 1, eff: { releaseCost: -0.15 }, desc: '所有解放的怒气消耗 −15%' },
    /* 守势 —— 把挨打变成资源 */
    { id: 'k_g1', br: '守势', tier: 0, name: '铁壁', max: 3, eff: { def: 3, hp: 18 }, desc: '防御 +3、生命 +18／级' },
    { id: 'k_g2', br: '守势', tier: 1, req: 'k_g1', max: 3, eff: { par: 0.018 }, desc: '弹反率 +1.8%／级' },
    { id: 'k_g3', br: '守势', tier: 2, req: 'k_g2', max: 2, eff: { thorns: 0.07 }, desc: '受击反弹 +7%／级' },
    { id: 'k_g4', br: '守势', tier: 3, req: 'k_g3', max: 1, eff: { guardCounter: 1 }, desc: '普通格挡也会触发反击' },
    /* 不退 —— 残血与续航 */
    { id: 'k_s1', br: '不退', tier: 0, name: '韧骨', max: 3, eff: { hp: 26 }, desc: '生命 +26／级' },
    { id: 'k_s2', br: '不退', tier: 1, req: 'k_s1', max: 3, eff: { lifesteal: 0.03 }, desc: '吸血 +3%／级' },
    { id: 'k_s3', br: '不退', tier: 2, req: 'k_s2', max: 2, eff: { lowHpAtk: 0.10 }, desc: '生命低于 40% 时攻击 +10%／级' },
    { id: 'k_s4', br: '不退', tier: 3, req: 'k_s3', max: 1, eff: { lastStand: 1 }, desc: '每场一次，致命伤后残留 1 点生命' },
  ],
  cang: [
    { id: 'c_h1', br: '苍光', tier: 0, name: '澄心', max: 3, eff: { mp: 16 }, desc: '术力 +16／级' },
    { id: 'c_h2', br: '苍光', tier: 1, req: 'c_h1', max: 3, eff: { healPlus: 0.08 }, desc: '治疗量 +8%／级' },
    { id: 'c_h3', br: '苍光', tier: 2, req: 'c_h2', max: 2, eff: { mpPlus: 2 }, desc: '每回合额外回复 2 术力／级' },
    { id: 'c_h4', br: '苍光', tier: 3, req: 'c_h3', max: 1, eff: { reviveFull: 1 }, desc: '复活时回复至满血' },
    { id: 'c_j1', br: '审判', tier: 0, name: '圣纹', max: 3, eff: { atk: 3 }, desc: '攻击力 +3／级' },
    { id: 'c_j2', br: '审判', tier: 1, req: 'c_j1', max: 3, eff: { elemDmg: { holy: 0.08 } }, desc: '圣属性伤害 +8%／级' },
    { id: 'c_j3', br: '审判', tier: 2, req: 'c_j2', max: 2, eff: { weakHunter: 0.08 }, desc: '对弱点目标伤害 +8%／级' },
    { id: 'c_j4', br: '审判', tier: 3, req: 'c_j3', max: 1, eff: { breakPlus: 1 }, desc: '击中弱点时击破槽额外 +1' },
    { id: 'c_w1', br: '守护', tier: 0, name: '静默', max: 3, eff: { def: 3 }, desc: '防御 +3／级' },
    { id: 'c_w2', br: '守护', tier: 1, req: 'c_w1', max: 3, eff: { statusRes: 0.07 }, desc: '异常抵抗 +7%／级' },
    { id: 'c_w3', br: '守护', tier: 2, req: 'c_w2', max: 2, eff: { partyCut: 0.04 }, desc: '全队受到的伤害 −4%／级' },
    { id: 'c_w4', br: '守护', tier: 3, req: 'c_w3', max: 1, eff: { hpRegen: 0.03 }, desc: '每回合回复 3% 生命' },
  ],
  lei: [
    { id: 'l_s1', br: '疾风', tier: 0, name: '轻身', max: 3, eff: { spd: 3 }, desc: '速度 +3／级' },
    { id: 'l_s2', br: '疾风', tier: 1, req: 'l_s1', max: 3, eff: { firstStrike: 8 }, desc: '开战行动条 +8／级' },
    { id: 'l_s3', br: '疾风', tier: 2, req: 'l_s2', max: 2, eff: { echo: 0.07 }, desc: '追击概率 +7%／级' },
    { id: 'l_s4', br: '疾风', tier: 3, req: 'l_s3', max: 1, eff: { extraTurn: 0.12 }, desc: '12% 概率行动后立刻再动一次' },
    { id: 'l_p1', br: '穿刺', tier: 0, name: '锐芒', max: 3, eff: { atk: 4 }, desc: '攻击力 +4／级' },
    { id: 'l_p2', br: '穿刺', tier: 1, req: 'l_p1', max: 3, eff: { pierce: 0.05 }, desc: '无视防御 +5%／级' },
    { id: 'l_p3', br: '穿刺', tier: 2, req: 'l_p2', max: 2, eff: { cri: 0.03 }, desc: '会心率 +3%／级' },
    { id: 'l_p4', br: '穿刺', tier: 3, req: 'l_p3', max: 1, eff: { critDmg: 0.30 }, desc: '会心伤害 +30%' },
    { id: 'l_h1', br: '猎手', tier: 0, name: '追迹', max: 3, eff: { hp: 20 }, desc: '生命 +20／级' },
    { id: 'l_h2', br: '猎手', tier: 1, req: 'l_h1', max: 3, eff: { killHeal: 0.04 }, desc: '击倒回复 +4%／级' },
    { id: 'l_h3', br: '猎手', tier: 2, req: 'l_h2', max: 2, eff: { bossBane: 0.07 }, desc: '对首领伤害 +7%／级' },
    { id: 'l_h4', br: '猎手', tier: 3, req: 'l_h3', max: 1, eff: { gaugeOnKill: 30 }, desc: '击倒敌人时行动条 +30' },
  ],
  ryze: [
    { id: 'r_i1', br: '冰核', tier: 0, name: '凝霜', max: 3, eff: { mp: 14, atk: 2 }, desc: '术力 +14、攻击 +2／级' },
    { id: 'r_i2', br: '冰核', tier: 1, req: 'r_i1', max: 3, eff: { elemDmg: { ice: 0.08 } }, desc: '冰属性伤害 +8%／级' },
    { id: 'r_i3', br: '冰核', tier: 2, req: 'r_i2', max: 2, eff: { freezePlus: 0.10 }, desc: '冰封概率 +10%／级' },
    { id: 'r_i4', br: '冰核', tier: 3, req: 'r_i3', max: 1, eff: { shatter: 0.35 }, desc: '对冰封目标伤害 +35%' },
    { id: 'r_a1', br: '术理', tier: 0, name: '解析', max: 3, eff: { cri: 0.02, mp: 8 }, desc: '会心 +2%、术力 +8／级' },
    { id: 'r_a2', br: '术理', tier: 1, req: 'r_a1', max: 3, eff: { pierce: 0.05 }, desc: '无视防御 +5%／级' },
    { id: 'r_a3', br: '术理', tier: 2, req: 'r_a2', max: 2, eff: { breakPlus: 1 }, desc: '击破槽额外 +1／级' },
    { id: 'r_a4', br: '术理', tier: 3, req: 'r_a3', max: 1, eff: { allElem: 0.12 }, desc: '所有属性伤害 +12%' },
    { id: 'r_b1', br: '同行', tier: 0, name: '暖手', max: 3, eff: { hp: 18, def: 2 }, desc: '生命 +18、防御 +2／级' },
    { id: 'r_b2', br: '同行', tier: 1, req: 'r_b1', max: 3, eff: { bondPlus: 1 }, desc: '连携技伤害 +10%／级' },
    { id: 'r_b3', br: '同行', tier: 2, req: 'r_b2', max: 2, eff: { statusRes: 0.08 }, desc: '异常抵抗 +8%／级' },
    { id: 'r_b4', br: '同行', tier: 3, req: 'r_b3', max: 1, eff: { guardAlly: 0.18 }, desc: '全队受到的伤害 −18%' },
  ],
};

export const BRANCHES = {
  kaito: ['炎道', '守势', '不退'],
  cang: ['苍光', '审判', '守护'],
  lei: ['疾风', '穿刺', '猎手'],
  ryze: ['冰核', '术理', '同行'],
};

const TALENT_BY_ID = {};
for (const list of Object.values(TALENTS)) for (const t of list) TALENT_BY_ID[t.id] = t;
export function talentDef(id) { return TALENT_BY_ID[id]; }

/* 某个天赋现在能不能再点一级 */
export function canLearn(member, id) {
  const t = TALENT_BY_ID[id];
  if (!t) return { ok: false, why: '没有这个天赋' };
  const list = TALENTS[member.id] || [];
  if (!list.includes(t)) return { ok: false, why: '不是该角色的天赋' };
  const cur = (member.talents && member.talents[id]) || 0;
  if (cur >= t.max) return { ok: false, why: '已经点满' };
  if ((member.sp || 0) < 1) return { ok: false, why: '技能点不足' };
  if (t.req) {
    const reqDef = TALENT_BY_ID[t.req];
    const have = (member.talents && member.talents[t.req]) || 0;
    if (have < reqDef.max) return { ok: false, why: `需要先点满【${reqDef.name || reqDef.desc}】` };
  }
  return { ok: true };
}

export function learnTalent(member, id) {
  const chk = canLearn(member, id);
  if (!chk.ok) return chk;
  member.talents = member.talents || {};
  member.talents[id] = (member.talents[id] || 0) + 1;
  member.sp = (member.sp || 0) - 1;
  return { ok: true };
}

/* 天赋带来的直接属性加成，叠进 statsAt 的结果 */
export function applyTalentStats(s, member) {
  const tal = member.talents || {};
  for (const [id, rank] of Object.entries(tal)) {
    const t = TALENT_BY_ID[id];
    if (!t || !rank) continue;
    const e = t.eff;
    if (e.atk) s.atk += e.atk * rank;
    if (e.def) s.def += e.def * rank;
    if (e.hp) s.hp += e.hp * rank;
    if (e.mp) s.mp += e.mp * rank;
    if (e.spd) s.spd += e.spd * rank;
    if (e.cri) s.cri += e.cri * rank;
    if (e.blk) s.blk += e.blk * rank;
    if (e.par) s.par += e.par * rank;
  }
  return s;
}

/* 天赋带来的战斗特效（与装备词缀同名，battle.js 会把两者相加） */
export function talentBonus(member, key) {
  const tal = member && member.talents;
  if (!tal) return 0;
  let sum = 0;
  for (const [id, rank] of Object.entries(tal)) {
    const t = TALENT_BY_ID[id];
    if (!t || !rank) continue;
    const v = t.eff[key];
    if (typeof v === 'number') sum += v * rank;
  }
  return sum;
}

/* 天赋带来的属性伤害加成 */
export function talentElem(member, elem) {
  const tal = member && member.talents;
  if (!tal) return 0;
  let sum = 0;
  for (const [id, rank] of Object.entries(tal)) {
    const t = TALENT_BY_ID[id];
    if (!t || !rank) continue;
    if (t.eff.allElem) sum += t.eff.allElem * rank;
    if (t.eff.elemDmg && t.eff.elemDmg[elem]) sum += t.eff.elemDmg[elem] * rank;
  }
  return sum;
}

/* 升级时发点数 */
export function grantLevelPoints(member, levels = 1) {
  member.points = (member.points || 0) + STAT_POINTS_PER_LEVEL * levels;
  member.sp = (member.sp || 0) + SP_PER_LEVEL * levels;
}

/* 洗点：把已投入的点全部退回（营地里提供，鼓励玩家试不同流派） */
export function respec(member) {
  const alloc = member.alloc || {};
  const spent = (alloc.str || 0) + (alloc.vit || 0) + (alloc.agi || 0) + (alloc.foc || 0);
  member.points = (member.points || 0) + spent;
  member.alloc = { str: 0, vit: 0, agi: 0, foc: 0 };
  let sp = 0;
  for (const v of Object.values(member.talents || {})) sp += v;
  member.sp = (member.sp || 0) + sp;
  member.talents = {};
  return { points: spent, sp };
}

export default { TALENTS, STATS, applyStatPoints, applyTalentStats, talentBonus, talentElem, canLearn, learnTalent, grantLevelPoints, respec };
