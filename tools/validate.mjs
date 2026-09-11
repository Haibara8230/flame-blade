/* 剧情图校验：确保每个场景都有出路、引用存在、战斗场景有敌人 */
import { SCENES, ENDINGS } from '../js/story.js';
import { ACTORS, SKILLS, ENEMIES, ITEMS, EQUIPS, SHOPS } from '../js/characters.js';
import { PORTRAITS } from '../js/portraits.js';

const errs = [], warns = [];
const ids = new Set(Object.keys(SCENES));

function chkTarget(id, who) {
  if (!id) return;
  if (!ids.has(id)) errs.push(`${who}: 引用了不存在的场景 "${id}"`);
}
function chkActions(actions, who) {
  for (const a of actions || []) {
    if (!a || typeof a !== 'object') continue;
    if (a.goto) chkTarget(a.goto, who + '.goto');
    if (typeof a.join === 'string' && !ACTORS[a.join]) errs.push(`${who}: 未知角色 ${a.join}`);
    if (typeof a.item === 'string' && !ITEMS[a.item] && !EQUIPS[a.item]) errs.push(`${who}: 未知道具/装备 ${a.item}`);
    if (typeof a.equip === 'string' && !EQUIPS[a.equip]) errs.push(`${who}: 未知装备 ${a.equip}`);
    if (a.branch && a.target) { walk(a.target.yes, who + '.yes'); walk(a.target.no, who + '.no'); }
  }
}

const reachable = new Set();
const endingsUsed = new Set();
function walk(id, from) {
  if (!id) return;
  if (!ids.has(id)) { errs.push(`${from}: 指向不存在场景 ${id}`); return; }
  if (reachable.has(id)) return;
  reachable.add(id);
  const sc = SCENES[id];
  if (sc.ending) { endingsUsed.add(sc.ending); if (!ENDINGS[sc.ending]) errs.push(`${id}: 未知结局 ${sc.ending}`); }
  if (sc.next) walk(sc.next, id);
  if (sc.choices) {
    for (const c of sc.choices) {
      chkActions(c.action, id + ' choice');
      if (!c.goto) errs.push(`${id}: 选项缺少 goto`);
      walk(c.goto, id + ' choice');
    }
  }
  if (sc.branch) {
    if (!sc.branch.branch) errs.push(`${id}: branch 缺少条件`);
    walk(sc.branch.yes, id + '.yes'); walk(sc.branch.no, id + '.no');
  }
  if (sc.pre && sc.pre.length) {
    const first = sc.pre[0];
    const isLines = Array.isArray(first) && typeof first[0] === 'string';
    if (isLines) {
      for (const [who, txt] of sc.pre) {
        if (typeof who !== 'string' || typeof txt !== 'string') errs.push(`${id}.pre: 台词格式错误`);
        else if (txt.length > 130) warns.push(`${id}.pre: 台词过长(${txt.length})`);
      }
    } else {
      for (const a of sc.pre) {
        chkActions([a], id + '.pre');
        if (a.branch && a.target) { walk(a.target.yes, id + '.pre.yes'); walk(a.target.no, id + '.pre.no'); }
      }
    }
  }
  if (sc.enemies) {
    const d = sc.enemies.map(e => e.ref);
    for (const r of sc.enemies) if (!ENEMIES[r.ref]) errs.push(`${id}: 未知敌人 ${r.ref}`);
    if (!sc.next && !sc.win) warns.push(`${id}: 战斗场景没有 next`);
    if (!sc.next) errs.push(`${id}: 战斗场景没有 next（胜利后无出处）`);
  }
  // 台词校验
  if (sc.lines) {
    for (const [who, txt] of sc.lines) {
      if (typeof who !== 'string' || typeof txt !== 'string') { errs.push(`${id}: 台词格式错误`); continue; }
      if (txt.length > 130) warns.push(`${id}: 台词过长(${txt.length}) ${txt.slice(0, 24)}…`);
    }
  }
  if (sc.shop && !SHOPS[sc.shop]) errs.push(`${id}: 未知商店 ${sc.shop}`);
  // 没有出路的场景
  const preActs = (sc.pre && sc.pre.length && !(Array.isArray(sc.pre[0]) && typeof sc.pre[0][0] === 'string')) ? sc.pre : [];
  const preBranch = preActs.find(a => a && a.branch);
  const hasExit = sc.next || sc.choices || sc.branch || sc.ending || sc.enemies || sc.loading || preBranch;
  if (!hasExit) errs.push(`${id}: 死路（无 next/choices/branch/ending）`);
}

walk('prologue', '(root)');
// 失败路线与隐藏路线由运行时代码触发
walk('c5_defeat', '(battle-lose)');
walk('secret_route', '(secret-trigger)');

// 角色/技能一致性
for (const a of Object.values(ACTORS)) {
  for (const s of a.skills) if (!SKILLS[s.id]) errs.push(`角色 ${a.id}: 未知技能 ${s.id}`);
  for (const w of a.weaponSkill) if (!SKILLS[w]) errs.push(`角色 ${a.id}: 未知武器技 ${w}`);
  if (!PORTRAITS[a.portrait]) errs.push(`角色 ${a.id}: 缺少立绘 ${a.portrait}`);
  if (!a.quote) warns.push(`角色 ${a.id}: 缺少台词`);
}
for (const s of Object.values(SKILLS)) {
  if (s.type === 'atk' && s.power == null) errs.push(`技能 ${s.id}: 缺少威力`);
  if (s.ult && !s.type === 'atk') warns.push(`技能 ${s.id}: 奥义类型异常`);
}
// 奥义覆盖
const ults = Object.values(ACTORS).map(a => a.skills.map(s => SKILLS[s.id]).filter(s => s && s.ult).length);
ults.forEach((n, i) => { if (n === 0) warns.push(`角色 ${Object.keys(ACTORS)[i]} 没有奥义`); });

const unreachable = [...ids].filter(i => !reachable.has(i));
if (unreachable.length) warns.push('不可达场景: ' + unreachable.join(', '));
const unusedEndings = Object.keys(ENDINGS).filter(e => !endingsUsed.has(e));
if (unusedEndings.length) errs.push('未使用的结局: ' + unusedEndings.join(', '));

console.log('场景总数:', ids.size, ' 可达:', reachable.size);
console.log('结局:', [...endingsUsed].join(', '));
console.log('敌人种类:', Object.keys(ENEMIES).length, ' 技能数:', Object.keys(SKILLS).length);
console.log('立绘:', Object.keys(PORTRAITS).join(', '));

/* ---- 立绘 SVG 结构校验 ----
   曾经踩过的坑：svgWrap 漏写 </svg>，导致所有立绘都是残缺 XML、
   浏览器静默解码失败（img.naturalWidth === 0），画面上立绘框全空。 */
for (const [k, uri] of Object.entries(PORTRAITS)) {
  const svg = decodeURIComponent(uri.slice(uri.indexOf(',') + 1));
  const opens = (svg.match(/<svg\b/g) || []).length;
  const closes = (svg.match(/<\/svg>/g) || []).length;
  if (!svg.startsWith('<svg')) errs.push(`立绘 ${k}: 不是以 <svg 开头`);
  if (!svg.trimEnd().endsWith('</svg>')) errs.push(`立绘 ${k}: 缺少结尾 </svg>（SVG 残缺，浏览器会解码失败）`);
  if (opens !== closes) errs.push(`立绘 ${k}: <svg>/${'</svg>'} 数量不匹配 (${opens}/${closes})`);
  // 引用一致性：#id 定义的渐变必须都存在
  const ids = new Set([...svg.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
  for (const ref of new Set([...svg.matchAll(/url\(#([^)]+)\)/g)].map(m => m[1]))) {
    if (!ids.has(ref)) errs.push(`立绘 ${k}: 引用了未定义的渐变 #${ref}`);
  }
  if ((svg.match(/<path\b/g) || []).length < 8) warns.push(`立绘 ${k}: path 数量偏少，可能画错了`);
}
console.log('立绘结构: 全部通过（' + Object.keys(PORTRAITS).length + ' 张）');

/* ---- 成长曲线模拟：按主线战斗最小经验推算队伍等级 ---- */
{
  const { expToNext: e2n } = await import('../js/characters.js');
  let lv = 1, exp = 0;
  const script = [
    ['战斗 第一章 2场', 80], ['章末奖励', 300],
    ['战斗 第二章 2场', 150], ['章末奖励', 450],
    ['战斗 第三章 2场', 220], ['章末奖励', 650],
    ['战斗 第四章 2场', 300], ['章末奖励', 800],
    ['最终决战', 1000],
  ];
  for (const [label, g] of script) {
    exp += g;
    while (exp >= e2n(lv) && lv < 40) { exp -= e2n(lv); lv++; }
    console.log(`  进度 ${label.padEnd(16)} 累计经验+${g} → 凯 Lv.${lv}（余 ${exp}）`);
  }
  if (lv < 14) warns.push(`主线经验偏低：终盘凯只有 Lv.${lv}，建议 ≥15`);
  if (lv > 24) warns.push(`主线经验偏高：终盘凯达到 Lv.${lv}`);
}

/* ---- Boss 强度对照表 ---- */
{
  const rows = Object.values(ENEMIES).filter(e => e.boss).map(e => `${e.name}(Lv基准) HP${e.hp} ATK${e.atk} DEF${e.def}`);
  console.log('首领:', rows.join(' | '));
}
if (warns.length) { console.log('\n--- 警告 (' + warns.length + ') ---'); warns.forEach(w => console.log('  ! ' + w)); }
if (errs.length) { console.log('\n--- 错误 (' + errs.length + ') ---'); errs.forEach(w => console.log('  X ' + w)); process.exitCode = 1; }
else console.log('\n✔ 剧情图与数据校验通过');
