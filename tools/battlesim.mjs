/* battlesim.mjs — 无浏览器战斗回归：真的跑完整场战斗。
   语法检查和 balance.mjs 都验证不了「行动条会不会卡死、资源够不够放奥义」，
   这个脚本用一个简易 AI 把几场代表性战斗打到结束，报告出手分布与奥义可达性。
   用法：node tools/battlesim.mjs */
import { createBattle, updateBattle, takePlayerAction, forecastOrder } from '../js/battle.js';
import { ACTORS, SKILLS, statsAt } from '../js/characters.js';
import { SCENES } from '../js/story.js';

function makeMember(id, lv) {
  const def = ACTORS[id];
  const eq = [];
  const st = statsAt(def, lv, eq);
  const res = def.resource || 'mp';
  return {
    id, name: def.name, title: def.title, portrait: def.portrait, role: def.role,
    level: lv, exp: 0, hp: st.hp, maxHp: st.hp, mp: res === 'rage' ? 0 : st.mp, maxMp: st.mp,
    atk: st.atk, def: st.def, spd: st.spd, cri: st.cri, mpRegen: st.mpRegen,
    blk: st.blk, par: st.par, rageMul: st.rageMul, resource: res,
    equips: eq, skills: def.skills.filter(s => s.lv <= lv).map(s => s.id), isEnemy: false,
  };
}

globalThis.__PROBE = [];
const results = [];
function runOne(sceneId, lvl) {
  const sc = SCENES[sceneId];
  const party = ['kaito', 'cang', 'lei', 'ryze'].map(id => makeMember(id, lvl));
  let ended = null;
  const game = {
    party, sfx() {}, requestPlayerTurn(b) { b.ui.mode = 'input'; },
    onBattleWin() { ended = 'win'; }, onBattleLose() { ended = 'lose'; }, onBattleEscape() { ended = 'escape'; },
  };
  const B = createBattle(game, sc, sc);
  const acts = { kaito: 0, cang: 0, lei: 0, ryze: 0 };
  const enemyActs = {};
  let parry = 0, block = 0, frames = 0; const ultCount = {};
  const peak = {};   // 各角色资源峰值：用来判断奥义门槛够不够得着
  const seen = new Set(); const allLog = [];
  const drain = () => { for (const e of B.log) if (!seen.has(e)) { seen.add(e); allLog.push(e.txt); } };
  while (!ended && frames < 200000) {
    frames++;
    updateBattle(B, 1 / 60, { actionPressed: false, confirmPressed: false });
    drain();
    for (const m of B.party) peak[m.id] = Math.max(peak[m.id] || 0, m.mp);
    if (B.ui.mode === 'input' && !B.over) {
      const m = B.active;
      if (!m || m.dead) { B.ui.mode = 'running'; continue; }
      acts[m.id] = (acts[m.id] || 0) + 1;
      // 简易 AI：能放奥义就放，否则最强负担得起的攻击技，否则普攻
      const ult = m.skills.map(i => SKILLS[i]).find(s => s && s.ult && (s.mp || 0) <= m.mp);
      const atks = m.skills.map(i => SKILLS[i]).filter(s => s && s.type === 'atk' && !s.ult && (s.mp || 0) <= m.mp);
      atks.sort((a, b) => b.power * (b.hits || 1) - a.power * (a.hits || 1));
      let cmd;
      if (ult) { cmd = { type: 'skill', skill: ult.id, target: 0 }; ultCount[m.id] = (ultCount[m.id] || 0) + 1; }
      else if (atks[0] && atks[0].mp > 0) cmd = { type: 'skill', skill: atks[0].id, target: 0 };
      else if (m.hp < m.maxHp * 0.35) cmd = { type: 'guard' };
      else cmd = { type: 'attack', target: 0 };
      takePlayerAction(B, m, cmd);
    }
  }
  for (const e of B.enemies) enemyActs[e.name] = (enemyActs[e.name] || 0);
  const log = B.log.map(l => l.txt || l).join('\n');
  parry = (log.match(/弹反！/g) || []).length;
  block = (log.match(/挡下了这一击/g) || []).length;
  const enemyHits = (log.match(/使用了/g) || []).length;
  results.push({ sceneId, ended, frames, acts, parry, block, enemyHits,
    peak: B.party.map(m => { const u = m.skills.map(i => SKILLS[i]).find(x => x && x.ult);
      return `${m.name} 峰值${Math.round(peak[m.id] || 0)}${u ? '/奥义需' + u.mp : '(无奥义)'}`; }).join('　'),
    ultCount,
    resEnd: B.party.map(m => `${m.name}${Math.round(m.mp)}/${m.maxMp}`).join(' ') });
}


runOne('c1_battle1', 3);
runOne('c3_battle1', 10);
runOne('c4_zain', 15);
runOne('c5_final', 18);

for (const r of results) {
  console.log(`${r.sceneId.padEnd(12)} 结果=${r.ended} 帧数=${r.frames}`);
  console.log(`   出手次数 ${JSON.stringify(r.acts)}`);
  console.log(`   奥义发动 ${JSON.stringify(r.ultCount)}`);
  console.log(`   ${r.peak}`);
}
const bad = results.filter(r => !r.ended);
console.log(bad.length ? `\nX ${bad.length} 场没有正常结束（可能卡死）` : '\n✔ 全部战斗正常结束，没有卡死');

/* ============================================================
   行动条的推条 / 拉条与速度状态
   这几项只能靠「真的打一场再看出手顺序变了没有」来验证：
   validate 看不出效果，balance 的模型按静态 spd 算，也算不出瞬时的加减速。
   ============================================================ */
function mechTest(actorId, skillId, expect, verbose = true) {
  const party = ['kaito', 'cang', 'lei', 'ryze'].map(id => makeMember(id, 18));
  const sc = { id: 'mech', bg: 'snow', enemies: [{ ref: 'ice_hound', level: 12 }, { ref: 'ice_hound', level: 12 }] };
  const game = { party, sfx() {}, requestPlayerTurn(b) { b.ui.mode = 'input'; }, onBattleWin() {}, onBattleLose() {}, onBattleEscape() {} };
  const B = createBattle(game, sc, sc);
  const m = B.party.find(p => p.id === actorId);
  // 等到轮到他；其他人一律格挡，避免打死敌人
  for (let i = 0; i < 60000 && !(B.ui.mode === 'input' && B.active === m); i++) {
    updateBattle(B, 1 / 60, {});
    if (B.ui.mode === 'input' && B.active !== m) takePlayerAction(B, B.active, { type: 'guard' });
  }
  m.mp = m.maxMp;
  const g0 = { e: B.enemies.map(e => e.gauge), p: B.party.map(p => p.gauge) };
  takePlayerAction(B, m, { type: 'skill', skill: skillId, target: 0 });
  for (let i = 0; i < 900 && (B.ui.queue.length || B.cutin); i++) updateBattle(B, 1 / 60, {});
  const g1 = { e: B.enemies.map(e => e.gauge), p: B.party.map(p => p.gauge) };
  // 行动条会随时间自然上涨，所以看的是「相对位移」：目标与其它单位的差值变化
  const drift = (g1.e[1] - g0.e[1]);
  const rel = Math.round((g1.e[0] - g0.e[0]) - drift);
  const res = {
    敌1相对位移: rel,
    施术者spd倍率: m.buffs.spd,
    施术者状态: m.status.map(s => s.id).join('|') || '-',
    敌方状态: B.enemies.map(e => e.status.map(s => s.id).join('|') || '-').join(','),
    我方行动条: g0.p.map((v, i) => Math.round(v) + '→' + Math.round(g1.p[i])).join(' '),
  };
  const ok = expect(res, B);
  if (ok || verbose) console.log(`  ${ok ? '✔' : '✗'} ${SKILLS[skillId].name}　${JSON.stringify(res, null, 0)}`);
  return ok;
}

console.log('\n=== 行动条机制 ===');
/* 概率型效果要多次取样，否则断言本身是随机失败的 */
function mechTestRetry(actorId, skillId, expect, tries = 6) {
  for (let i = 0; i < tries; i++) if (mechTest(actorId, skillId, expect, i === tries - 1)) return true;
  return false;
}

const mech = [
  mechTest('lei', 'lianshe', r => r.敌1相对位移 <= -15),              // 拉条 -22
  mechTest('kaito', 'jiaoyan', r => r.施术者spd倍率 > 1 && r.施术者状态.includes('haste')),
  mechTestRetry('ryze', 'baoxue', (r, B) => B.enemies.some(e => e.status.some(s => s.id === 'slow'))),
];
console.log(mech.every(Boolean) ? '✔ 推条/拉条与速度状态均生效' : 'X 有机制未生效');
if (!mech.every(Boolean)) process.exitCode = 1;
