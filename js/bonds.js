/* ============================================================
   bonds.js — 羁绊

   此前 trustRyze / leiBond / cangBond / ryzeBond 都是布尔开关：
   玩家看不见、无从投入，SECRET END 的三地支援更是三个隐形的旗标。

   现在羁绊是 0~5 的等级，有明确的来源和明确的回报：
     Lv2 解锁双人连携　Lv3 解锁进阶连携　Lv4 解锁四人连携　Lv5 影响结局
   ============================================================ */

export const BOND_MAX = 5;

/* 每一级需要的累计羁绊值 */
const BOND_STEPS = [0, 2, 5, 9, 14, 20];

export const BOND_SOURCES = {
  talk: { v: 2, name: '营地对话' },
  aid: { v: 3, name: '支线支援' },
  rescue: { v: 1, name: '战斗中救起濒死的同伴' },
  choice: { v: 3, name: '关键抉择站在对方一边' },
  relic: { v: 2, name: '找到与其相关的遗物' },
};

export function bondValue(G, id) { return (G.bonds && G.bonds[id]) || 0; }

export function bondLevel(G, id) {
  const v = bondValue(G, id);
  let lv = 0;
  for (let i = 1; i < BOND_STEPS.length; i++) if (v >= BOND_STEPS[i]) lv = i;
  return lv;
}

export function bondProgress(G, id) {
  const v = bondValue(G, id);
  const lv = bondLevel(G, id);
  if (lv >= BOND_MAX) return { lv, cur: 0, need: 0, full: true };
  const base = BOND_STEPS[lv], next = BOND_STEPS[lv + 1];
  return { lv, cur: v - base, need: next - base, full: false };
}

/* 加羁绊。返回是否升级了，调用方负责提示。 */
export function addBond(G, id, source = 'talk', times = 1) {
  if (!G.bonds) G.bonds = {};
  const src = BOND_SOURCES[source] || BOND_SOURCES.talk;
  const before = bondLevel(G, id);
  G.bonds[id] = Math.min(BOND_STEPS[BOND_MAX], (G.bonds[id] || 0) + src.v * times);
  const after = bondLevel(G, id);
  return { leveled: after > before, from: before, to: after, srcName: src.name };
}

/* 队伍整体羁绊（结局判定用） */
export function averageBond(G, party) {
  if (!party || !party.length) return 0;
  let sum = 0;
  for (const m of party) sum += bondLevel(G, m.id);
  return sum / party.length;
}

/* 旧存档兼容：把老的布尔旗标折算成羁绊值 */
export function migrateFlags(G) {
  if (!G.bonds) G.bonds = {};
  const f = G.flags || {};
  const bump = (id, v) => { G.bonds[id] = Math.max(G.bonds[id] || 0, v); };
  if (f.trustRyze) bump('ryze', 5);
  if (f.ryzeBond) bump('ryze', 9);
  if (f.leiBond) bump('lei', 9);
  if (f.cangBond) bump('cang', 9);
  if (f.defendedRyze || f.heardRyze) bump('ryze', 5);
  if (f.promised) bump('ryze', 14);
  if (f.forestAid) bump('cang', 5);
  if (f.harborAid) bump('lei', 5);
  if (f.northAid) bump('ryze', 5);
  bump('kaito', 20);      // 凯是玩家自己，恒定满级
}

export default { BOND_MAX, addBond, bondLevel, bondValue, bondProgress, averageBond, migrateFlags };
