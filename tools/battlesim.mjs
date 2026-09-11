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
