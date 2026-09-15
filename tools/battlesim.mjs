/* battlesim.mjs — 无浏览器战斗回归：真的把整场战斗跑完。
   语法检查和 balance.mjs 都验证不了「行动条会不会卡死、技能效果有没有真的生效」，
   这个脚本用一个简易 AI 把当前剧本里每一场战斗打到结束，并单独验证几项机制。
   用法：node tools/battlesim.mjs

   2026-09-15 重建：此前跑的是 c1_battle1 / c3_battle1 / c4_zain / c5_final 四个
   《炎之刃》时代的场景，剧情按原文重写后它们全部不存在，SCENES[id] 返回 undefined，
   createBattle 拿 stage.bg 时直接抛 TypeError——脚本从那以后一直是启动即崩溃。
   （不是 createBattle 换了签名，是场景 id 没了。）
   现在场次直接从 SCENES 推导，新增战斗不用改这个文件。 */
import { createBattle, updateBattle, takePlayerAction } from '../js/battle.js';
import { ACTORS, SKILLS, statsAt } from '../js/characters.js';
import { SCENES } from '../js/story.js';
import { applyStatPoints, applyTalentStats } from '../js/growth.js';

/* main.js 的 defaultEquip()。那是 UI 层的数据，这里按实际值列出。 */
const DEFAULT_EQUIP = {
  kaito: ['mu_sword', 'cloth'], cang: ['wood_staff', 'cloth'],
  lei: ['hunter_spear', 'cloth'], ryze: ['snow_staff', 'holy_cloak'],
};

/* 与 main.js 的 makeMember + recalc 保持一致。
   关键是属性点与天赋属性必须叠上去——回避(eva)/命中(acc) 只在那一步才产生，
   而主角这个阶段的打法全靠反应力换来的回避，漏掉就等于测了另一个角色。 */
function makeMember(id, lv, equips) {
  const def = ACTORS[id];
  const eq = equips || DEFAULT_EQUIP[id] || [];
  const res = def.resource || 'mp';
  const m = {
    id, name: def.name, title: def.title, portrait: def.portrait, role: def.role,
    level: lv, exp: 0, resource: res, equips: eq,
    skills: def.skills.filter(s => s.lv <= lv).map(s => s.id),
    bonus: { atk: 0, def: 0, hp: 0 },
    alloc: { ...(def.alloc || { str: 4, vit: 4, agi: 4, spi: 4 }) },
    fixed: { ...(def.fixed || { luck: 0, wit: 0, chm: 0 }) },
    talentAttr: { ...(def.talentAttr || {}) },
    points: 0, sp: 0, talents: {}, isEnemy: false,
  };
  const st = statsAt(def, lv, eq);
  applyStatPoints(st, m.alloc);
  applyTalentStats(st, m);
  return Object.assign(m, {
    hp: st.hp, maxHp: st.hp, mp: res === 'rage' ? 0 : st.mp, maxMp: st.mp,
    atk: st.atk, def: st.def, spd: st.spd, cri: st.cri, mpRegen: st.mpRegen,
    blk: st.blk, par: st.par, rageMul: st.rageMul,
    eva: st.eva || 0, acc: st.acc || 0,
  });
}

function mkGame(party) {
  const g = {
    party, flags: {}, ended: null,
    sfx() { }, useItem() { }, onBattleMusic() { },
    requestPlayerTurn(b) { b.ui.mode = 'input'; },
    onBattleWin() { g.ended = 'win'; },
    onBattleLose() { g.ended = 'lose'; },
    onBattleEscape() { g.ended = 'escape'; },
  };
  return g;
}

const aliveIdx = B => { const i = B.enemies.findIndex(e => !e.dead && e.hp > 0); return i < 0 ? 0 : i; };

/* 简易 AI，按主角当前这套「没有职业、没有暴击」的招式设计：
   刚闪过就擦身反手（afterDodgeBonus +60%，这是他唯一的高伤途径）→
   没有 haste 就读招（抢先手 + 拉高回避）→ 残血凝神 → 否则最强攻击技。 */
function chooseCmd(B, m) {
  const has = id => m.skills.includes(id);
  const inStatus = id => (m.status || []).some(s => s.id === id);
  const tgt = aliveIdx(B);
  if (m.justDodged && has('yt_counter')) return { type: 'skill', skill: 'yt_counter', target: tgt };
  if (has('yt_read') && !inStatus('haste')) return { type: 'skill', skill: 'yt_read', target: tgt };
  if (m.hp < m.maxHp * 0.3 && has('yt_focus') && !inStatus('defUp')) return { type: 'skill', skill: 'yt_focus', target: tgt };
  const ult = m.skills.map(i => SKILLS[i]).find(s => s && s.ult && (s.mp || 0) <= m.mp);
  if (ult) return { type: 'skill', skill: ult.id, target: tgt };
  const atks = m.skills.map(i => SKILLS[i])
    .filter(s => s && s.type === 'atk' && !s.ult && (s.mp || 0) <= m.mp)
    .sort((a, b) => b.power * (b.hits || 1) - a.power * (a.hits || 1));
  if (atks[0]) return { type: 'skill', skill: atks[0].id, target: tgt };
  return { type: 'attack', target: tgt };
}

/* ============================================================
   第一部分：把剧本里每一场战斗真的打完
   ============================================================ */

/* 打到这场时队伍大概什么水平——按原文：整个杀狼段他都是 **0 级**
   （第8章「0级，身上只有没什么属性的新手衣」），第12章才升到 1 级。
   剧本新增战斗而这里没配等级时，退回按敌人等级估算，不会漏跑。 */
const LEVEL_AT = { d_fight1: 0, d_fight1b: 0, d_fight2: 0, d_fight3: 1 };

const STAGES = [];
for (const [sid, sc] of Object.entries(SCENES)) {
  if (!sc.enemies || !sc.enemies.length) continue;
  const eLv = Math.round(sc.enemies.reduce((a, e) => a + (e.level || 1), 0) / sc.enemies.length);
  STAGES.push([sid, sc, LEVEL_AT[sid] ?? Math.max(1, eLv - 2)]);
}

const results = [];
for (const [sid, sc, lv] of STAGES) {
  const party = [makeMember('kaito', lv)];
  const game = mkGame(party);
  const B = createBattle(game, sc, sc);
  const acts = {}; const peak = {};
  let frames = 0, dodges = 0;
  const hp0 = party.reduce((a, m) => a + m.maxHp, 0);
  while (!game.ended && frames < 200000) {
    frames++;
    updateBattle(B, 1 / 60, { actionPressed: false, confirmPressed: false });
    for (const m of B.party) peak[m.id] = Math.max(peak[m.id] || 0, m.mp);
    if (B.ui.mode === 'input' && !B.over) {
      const m = B.active;
      if (!m || m.dead) { B.ui.mode = 'running'; continue; }
      if (m.justDodged) dodges++;
      acts[m.name] = (acts[m.name] || 0) + 1;
      takePlayerAction(B, m, chooseCmd(B, m));
    }
  }
  const log = B.log.map(l => l.txt || l).join('\n');
  results.push({
    sid, lv, ended: game.ended, frames, acts, dodges,
    hpLeft: B.party.reduce((a, m) => a + Math.max(0, Math.ceil(m.hp)), 0), hp0,
    peak: B.party.map(m => `${m.name} ${m.resource}峰值${Math.round(peak[m.id] || 0)}/${m.maxMp}`).join('　'),
    parry: (log.match(/弹反/g) || []).length,
    block: (log.match(/挡下了这一击/g) || []).length,
    enemies: sc.enemies.map(e => e.ref + '@' + e.level).join('+'),
  });
}

console.log('=== 全场战斗（邪天单人，等级取自真实通关记录）===');
for (const r of results) {
  console.log(`${r.sid.padEnd(11)} Lv${String(r.lv).padStart(2)} vs ${r.enemies.padEnd(34)} 结果=${r.ended ?? '未结束'} 帧=${r.frames}`);
  console.log(`   出手 ${JSON.stringify(r.acts)}　闪避后出手 ${r.dodges} 次　弹反 ${r.parry}　格挡 ${r.block}`);
  console.log(`   剩余 ${r.hpLeft}/${r.hp0}　${r.peak}`);
}
const stuck = results.filter(r => !r.ended);
console.log(stuck.length ? `\n✗ ${stuck.length} 场没有正常结束（卡死）：${stuck.map(r => r.sid).join('、')}`
  : `\n✔ ${results.length} 场全部正常结束，没有卡死`);

/* ============================================================
   第二部分：技能效果是否真的生效

   存在的理由：2026-09-14 发现 gaugePush / gaugePull / fixedDamage / taunt /
   evadeUp / afterDodgeBonus 这几个键里有五个从来就是死键——引擎认的名字不一样，
   或者压根没实现。技能描述写得有模有样，打出来什么都没发生，
   validate 看不出来（键名它不认识），balance 的模型也算不出瞬时效果。
   只能靠「真的打一场，再看状态变了没有」。
   ============================================================ */
function probeBattle(lv = 5, n = 2) {
  const party = [makeMember('kaito', lv)];
  const game = mkGame(party);
  const sc = {
    id: 'mech', bg: 'forest', escape: false,
    enemies: Array.from({ length: n }, () => ({ ref: 'wild_wolf', level: 5 })),
  };
  const B = createBattle(game, sc, sc);
  const m = B.party[0];
  // 等到轮到他出手
  for (let i = 0; i < 60000 && !(B.ui.mode === 'input' && B.active === m); i++) {
    updateBattle(B, 1 / 60, {});
    if (B.ui.mode === 'input' && B.active !== m) takePlayerAction(B, B.active, { type: 'guard' });
  }
  return { B, m, game };
}
const settle = B => { for (let i = 0; i < 900 && (B.ui.queue.length || B.cutin); i++) updateBattle(B, 1 / 60, {}); };

const mech = [];
function check(name, fn) {
  let ok = false, detail = '';
  try { const r = fn(); ok = !!r.ok; detail = r.detail; }
  catch (e) { detail = 'EXCEPTION ' + e.message; }
  mech.push(ok);
  console.log(`  ${ok ? '✔' : '✗'} ${name}　${detail}`);
}

console.log('\n=== 技能机制 ===');

check('投石 yt_stone：把目标的行动条拉回去（gauge -26）', () => {
  const { B, m } = probeBattle();
  /* 两件事会让这一项随机失败，都是测法的问题不是引擎的问题：
       ① shiftGauge 把行动条夹在 [0, GOAL-1]。轮到主角出手时，刚动过的那只狼
          行动条往往贴近 0，-26 全被夹掉，测出来就是 0；
       ② settle 期间行动条会自然上涨，涨满的那只还会出手清零，
          等结算完再比，比的已经不是这一下推了多少。
     所以先把两只摆到同一个有余量的位置，并把速度归零冻住行动条。 */
  for (const e of B.enemies) { e.gauge = 70; e.spd = 0; }
  const g0 = B.enemies.map(e => e.gauge);
  takePlayerAction(B, m, { type: 'skill', skill: 'yt_stone', target: 0 });
  settle(B);
  const g1 = B.enemies.map(e => e.gauge);
  // 行动条会随时间自然上涨，所以看的是「目标相对其它单位」的位移
  const rel = Math.round((g1[0] - g0[0]) - (g1[1] - g0[1]));
  return { ok: rel <= -15, detail: `敌1 相对位移 ${rel}` };
});

check('读招 yt_read：haste 状态 + 回避加成（evadeUp 0.3）', () => {
  const { B, m } = probeBattle();
  takePlayerAction(B, m, { type: 'skill', skill: 'yt_read', target: 0 });
  /* 回避加成只维持到本单位下次出手（startOfTurn 会清零），
     所以不能等 settle 跑完再看——取过程中的峰值。 */
  let evaPeak = 0;
  for (let i = 0; i < 900 && (B.ui.queue.length || B.cutin); i++) {
    updateBattle(B, 1 / 60, {});
    evaPeak = Math.max(evaPeak, m.evadeBonus || 0);
  }
  const st = (m.status || []).map(s => s.id);
  return {
    ok: st.includes('haste') && evaPeak > 0,
    detail: `状态[${st.join('|') || '-'}] 回避加成峰值 ${evaPeak} spd倍率 ${m.buffs && m.buffs.spd}`,
  };
});

check('凝神 yt_focus：defUp 状态 + 自愈（selfHeal 0.12）', () => {
  const { B, m } = probeBattle();
  m.hp = Math.floor(m.maxHp * 0.5);
  const hp0 = m.hp;
  takePlayerAction(B, m, { type: 'skill', skill: 'yt_focus', target: 0 });
  settle(B);
  const st = (m.status || []).map(s => s.id);
  return {
    ok: st.includes('defUp') && m.hp > hp0,
    detail: `状态[${st.join('|') || '-'}] 生命 ${hp0}→${Math.ceil(m.hp)}（上限 ${m.maxHp}）`,
  };
});

check('擦身反手 yt_counter：闪避后伤害 +60%（afterDodgeBonus）', () => {
  const hit = dodged => {
    const { B, m } = probeBattle();
    m.justDodged = dodged;
    /* 野狼正好 170 血，加成后那一刀会溢杀——按掉血量测出来两边都是 170，
       比值假成 1.27。把靶子的血拉到打不死，测的才是伤害本身。 */
    const e = B.enemies[0];
    e.maxHp = 1e6; e.hp = 1e6;
    takePlayerAction(B, m, { type: 'skill', skill: 'yt_counter', target: 0 });
    settle(B);
    return Math.round(1e6 - e.hp);
  };
  /* 主角幸运为 0 —— 原文系统警告「攻击时全部取攻击值的下限」，
     所以他永不暴击、伤害浮动恒定取下限，这里两次的伤害是可比的。 */
  const a = hit(true), b = hit(false);
  return { ok: a > b * 1.3, detail: `闪避后 ${a} / 平常 ${b}（比值 ${(a / Math.max(1, b)).toFixed(2)}）` };
});

console.log(mech.every(Boolean) ? '✔ 技能机制全部生效' : '✗ 有机制未生效');
if (!mech.every(Boolean) || stuck.length) process.exitCode = 1;
