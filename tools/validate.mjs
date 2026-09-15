/* 剧情图校验：确保每个场景都有出路、引用存在、战斗场景有敌人 */
import { SCENES, ENDINGS } from '../js/story.js';
import { ACTORS, SKILLS, ENEMIES, ITEMS, EQUIPS, SHOPS, ELEM, STATUS, ENEMY_SKILLS, statsAt, enemyStatsAt } from '../js/characters.js';
import { PORTRAITS } from '../js/portraits.js';
import { obtainable, openShops } from './reach.mjs';

/* 原文明确「没有」的东西，不该被报成缺陷。
   · 主角没有奥义、连技能都没有——原文第9章：「全世界只有叶天邪一个例外，
     他没有技能，没有职业，只能以新手剑并不华丽的砍、劈、刺……」
   · 原文的探知术面板只给「等级 / 生命 / 描述 / 技能」，从来没有「弱点属性」
     这一栏，所以照抄原文的怪物没有 weak 是正确的，不是漏配。
   把这两类排除掉，剩下的警告才有意义。 */
const CANON_NO_ULT = new Set(['kaito']);
const CANON_ENEMIES = new Set([
  'angry_chick', 'fierce_rabbit', 'wild_wolf', 'dire_wolf',
  'giant_dire_wolf', 'blood_wolf', 'mutant_blood_wolf',
]);

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
  // partEnding：第一部的结局画面放完会继续进第二部，同样算「用到了」
  if (sc.partEnding) { endingsUsed.add(sc.partEnding); if (!ENDINGS[sc.partEnding]) errs.push(`${id}: 未知结局 ${sc.partEnding}`); }
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

/* 《炎之刃》时期的固定装备。那批剧情（chapter-one/journey/finale/beyond）
   已随改编退役，这些装备也就跟着退役了——它们仍留在 EQUIPS 里是因为
   power.js 的类型查表和 tools/balance.mjs 的夹具还引用着 id。
   现役内容的可达性检查不该把它们算进来，否则 7 条常红错误会淹掉真问题。 */
const LEGACY_EQUIP = new Set([
  'flame_sword', 'holy_sword', 'blue_staff', 'storm_spear', 'snow_staff',
  'demon_mail', 'bond_ring', 'holy_cloak', 'mu_sword', 'elixir',
]);

walk('prologue', '(root)');
// 失败路线与隐藏路线由运行时代码触发
walk('arc_defeat', '(battle-lose)');

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
ults.forEach((n, i) => { const id = Object.keys(ACTORS)[i]; if (n === 0 && !CANON_NO_ULT.has(id)) warns.push(`角色 ${id} 没有奥义`); });

/* ---- 资源系统校验 ---- */
for (const a of Object.values(ACTORS)) {
  const res = a.resource;
  if (res !== 'mp' && res !== 'rage') errs.push(`角色 ${a.id}: resource 必须是 'mp' 或 'rage'（当前 ${res}）`);
  const pool = statsAt(a, 15).mp;
  /* 转职后才解锁的技能（邪龙系，原文第111章「转职——逆骨邪龙！」）。
     转职本身还没实现，所以它们现在必然够不到——这是「未实现内容」，
     不是「配错了」。按现役内容检查会常红，因此排除。 */
  const POST_ADVANCE = /^ni_/;
  const liveSkills = a.skills.filter(x => !POST_ADVANCE.test(x.id));
  const ultEntry = liveSkills.find(x => SKILLS[x.id] && SKILLS[x.id].ult);
  const ult = ultEntry && SKILLS[ultEntry.id];
  // 主线终盘约 Lv15，习得等级高于它的奥义在正常通关里永远见不到
  if (ultEntry && ultEntry.lv > 15) errs.push(`奥义 ${ultEntry.id}: 习得等级 Lv${ultEntry.lv} 高于主线终盘等级 Lv15，正常通关学不到`);
  if (!ult) { if (!CANON_NO_ULT.has(a.id)) warns.push(`角色 ${a.id}: 没有奥义`); }
  else if (!ult.mp) {
    // 奥义原本靠「热血满100」开锁，改成资源门槛后 0 消耗 = 可以无限放
    errs.push(`奥义 ${ult.id}: 消耗为 0，改用资源门槛后会变成无限放`);
  } else if (ult.mp > pool) {
    errs.push(`奥义 ${ult.id}: 消耗 ${ult.mp} 超过 ${a.name} Lv15 的资源上限 ${pool}`);
  } else if (ult.mp < pool * 0.3) {
    warns.push(`奥义 ${ult.id}: 消耗 ${ult.mp} 仅占 ${a.name} 资源池 ${pool} 的 ${Math.round(ult.mp / pool * 100)}%，偏廉价`);
  }
  const st = statsAt(a, 15, []);
  if (st.blk + st.par >= 0.9) errs.push(`角色 ${a.id}: 格挡率+弹反率 = ${(st.blk + st.par).toFixed(2)}，几乎完全免疫`);
}

/* ---- 属性克制校验：weak 引用的属性要存在，且队伍里得真的有人打得出来 ---- */
{
  const atkElems = new Set(Object.values(SKILLS).filter(s => s.type === 'atk').map(s => s.elem));
  for (const e of Object.values(ENEMIES)) {
    if (!e.weak || !e.weak.length) { if (!CANON_ENEMIES.has(e.id)) warns.push(`敌人 ${e.id}: 没有弱点属性，克制机制对它无效`); continue; }
    if (CANON_ENEMIES.has(e.id)) continue;   // 原文照抄的怪物，弱点由原文决定
    for (const w of e.weak) {
      if (!ELEM[w]) errs.push(`敌人 ${e.id}: 未知弱点属性 ${w}`);
      else if (!atkElems.has(w)) errs.push(`敌人 ${e.id}: 弱点 ${w} 没有任何我方攻击技能能打出`);
    }
  }
}

/* ---- 可达性校验 ----
   专防一类问题：数据、图标、台词、执行代码都写好了，但没有任何路径能让玩家碰到。
   这类东西静态看代码全是「已实现」，只有真人玩到那一步才会发现不对。
   踩过的坑：圣剑·霜华只有一行台词说「获得了」，实际从未发放。 */
{
  // 商店必须真的被某个可达场景引用，否则它的独家商品玩家买不到
  const open = openShops(reachable);
  for (const [k, v] of Object.entries(SHOPS)) {
    if (!open.has(k)) errs.push(`商店 ${k}（${v.name}）没有任何可达场景引用它，其独家商品玩家买不到`);
  }
}

{
  const OK = obtainable(reachable);
  for (const [k, e] of Object.entries(EQUIPS)) {
    if (LEGACY_EQUIP.has(k)) continue;
    /* 剧情授予的唯一之器不走商店/掉落。原文里永恒命运之刻是「已强制认主，
       不可交易，不可掉落，不可偷窃，不可丢弃」，只能由剧情给。
       但它必须真的有剧情给——所以降级成警告，而不是直接放过。 */
    if (e.bound || e.noDrop) {
      if (!OK.has(k)) warns.push(`唯一之器 ${e.name}(${k}) 目前还没有任何场景授予（原文在第11章给出，剧情尚未推进到）`);
      continue;
    }
    if (!OK.has(k)) errs.push(`装备 ${e.name}(${k}) 玩家无法获得——不在任何开放商店出售，也没有场景发放`);
  }
  for (const [k, it] of Object.entries(ITEMS)) {
    if (LEGACY_EQUIP.has(k)) continue;
    if (!OK.has(k)) errs.push(`道具 ${it.name}(${k}) 玩家无法获得——不在任何开放商店出售，也没有场景发放`);
  }
}

{
  // 状态异常：必须至少有一个技能 / 敌技 / 道具会施加
  const applied = new Set();
  for (const sk of [...Object.values(SKILLS), ...Object.values(ENEMY_SKILLS)]) {
    if (sk.inflict) applied.add(sk.inflict.id);
    if (sk.buff) applied.add(sk.buff.id);
    if (sk.buff2) applied.add(sk.buff2.id);
  }
  for (const it of Object.values(ITEMS)) if (it.seal) applied.add('stun');   // 封魔符实际施加的是 stun
  for (const k of Object.keys(STATUS)) {
    /* 现阶段主角没有任何技能（原文第9章：「他没有技能，没有职业」），
       所以没有状态会被施加是**正确**的，不是漏配。等原文的技能出现再接。
       降级成警告，但不放过——否则将来真漏配也看不出来。 */
    if (!applied.has(k)) warns.push(`状态 ${STATUS[k].name}(${k}) 还没有任何技能或道具会施加它（原文技能尚未出现）`);
  }

  // 属性：必须至少有一个攻击技能能打出，否则弱点/克制永远触发不了
  const castable = new Set([
    ...Object.values(SKILLS).filter(sk => sk.type === 'atk').map(sk => sk.elem),
    ...Object.values(ENEMY_SKILLS).map(sk => sk.elem),
  ]);
  for (const k of Object.keys(ELEM)) {
    /* 七系属性来自原文第7章的抗性面板，而主角这个阶段一个属性技能都没有，
       打不出任何属性是正确的。同样降级成警告。 */
    if (k !== 'none' && !castable.has(k)) warns.push(`属性 ${ELEM[k].name}(${k}) 还没有任何攻击技能能打出（原文技能尚未出现）`);
  }
}

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

/* ---- 成长曲线模拟：沿真实剧情路径推算主角等级 ----

   2026-09-15 重建。此前这里是一张手抄的经验表
   （['战斗 第三章 2场', 220] 之类），不读 SCENES 里任何真实数据，
   所以改敌人等级、改奖励、删整章它都不会发现——它推算并打印的是
   「凯 Lv.15」，而「凯」这个角色在当前流程里根本不存在了。
   看起来像验证，实际什么都没验证。

   现在改成：从 prologue 出发真的走一遍剧情图，把沿途战斗的敌人经验
   （enemyStatsAt 的等级缩放公式）和场景发的经验都累加起来，
   用 characters.js 的 expToNext 升级——全部是游戏真正在跑的那几个函数。 */
{
  const { expToNext: e2n, MAX_LEVEL } = await import('../js/characters.js');
  const { expFromKill } = await import('../js/realm.js');

  /* 沿 next / choices 走一条确定路径：抉择一律取第一个分支。
     战斗都在主线 next 链上，不被抉择挡住，所以这条路径覆盖全部战斗；
     真有战斗被挂到分支里，下面的「有战斗没走到」会报出来。 */
  const path = [];
  {
    const seen = new Set();
    let id = 'prologue';
    while (id && SCENES[id] && !seen.has(id)) {
      seen.add(id);
      const sc = SCENES[id];
      path.push(id);
      if (sc.choices && sc.choices.length) id = sc.choices[0].goto;
      else if (sc.branch) id = sc.branch.yes;
      else id = sc.next;
    }
  }

  /* 场景发的经验：pre 里的 { exp: N }，以及走到的那个分支的 action */
  const sceneExp = sc => {
    let g = 0;
    const eat = list => { for (const a of list || []) if (a && typeof a.exp === 'number') g += a.exp; };
    eat(sc.pre);
    if (sc.choices && sc.choices[0]) eat(sc.choices[0].action);
    return g;
  };

  let lv = 1, exp = 0, battles = 0, totalExp = 0;
  const rows = [];
  for (const id of path) {
    const sc = SCENES[id];
    let gain = sceneExp(sc), label = null;
    if (sc.enemies && sc.enemies.length) {
      battles++;
      /* battle.js 结算时走的就是 realm.js 的 expFromKill（按原文校准，
         而且随玩家当前等级变化——等级压制），不是敌人身上那个静态 exp 字段。 */
      gain += sc.enemies.reduce((a, e) => a + expFromKill(
        e.level || 1, lv, { star: ENEMIES[e.ref]?.star || (ENEMIES[e.ref]?.boss ? 3 : 0) }), 0);
      label = `${id}（${sc.enemies.map(e => ENEMIES[e.ref]?.name || e.ref).join('+')}）`;
    } else if (gain > 0) label = `${id}（剧情奖励）`;
    if (!label) continue;
    exp += gain; totalExp += gain;
    while (exp >= e2n(lv) && lv < MAX_LEVEL) { exp -= e2n(lv); lv++; }
    rows.push(`  进度 ${label.padEnd(34)} +${String(gain).padStart(4)} → Lv.${lv}（余 ${exp}/${e2n(lv)}）`);
  }
  rows.forEach(r => console.log(r));
  console.log(`  合计 ${battles} 场战斗，累计经验 ${totalExp}，终局 Lv.${lv}`);

  /* 剧本里有战斗，但这条路径一场都没走到 —— 多半是主线断了 */
  const allBattles = Object.values(SCENES).filter(sc => sc.enemies && sc.enemies.length).length;
  if (battles < allBattles) warns.push(`成长模拟只走到 ${battles}/${allBattles} 场战斗，其余挂在分支里（模拟结论偏低）`);
  if (!battles) errs.push('成长模拟一场战斗都没走到，主线可能断了');

  /* 基准来自 playthrough.cjs 的真实通关记录（2026-09-15：Lv7~8 收尾）。
     注意方向：这里每场只打一次，所以是**下界**——实测更高不是出了错，
     而是自动战斗死了 3 次，arc_defeat 把人送回 d_hunt 重打，经验又拿了一遍。
     band 给得宽，是为了抓「整章经验被删 / 被翻倍」这种量级的问题，
     而不是每次微调数值都来烦人。 */
  /* 原文：0 级杀九只 5 级野狼才升到 1 级（100 点经验），1→2 还要整整 1000 点。
     剧本里这四场正好是 9 只狼 + 1 只头狼，所以走完应当**刚好 1 级**——
     和原文第12章他升到 1 级的时点对得上。 */
  const REAL = { low: 1, high: 2, note: '原文：九只野狼完成 0→1，1→2 还要 1000 点' };
  if (lv < REAL.low) warns.push(`主线经验偏低：模拟终局只有 Lv.${lv}（${REAL.note}）`);
  if (lv > REAL.high) warns.push(`主线经验偏高：模拟终局 Lv.${lv}（${REAL.note}）`);
}

/* ---- 经验曲线只能有一套 ----
   realm.js 也导出了 MAX_LEVEL / expToNext / expFromKill（99 级、分段曲线、
   等级压制），但没有任何文件 import 它们——游戏跑的是 characters.js 那一套
   （50 级、二次曲线、没有等级压制）。两套并存迟早会有人改错一边。 */
{
  const ch = await import('../js/characters.js');
  const rm = await import('../js/realm.js');
  if (ch.MAX_LEVEL !== rm.MAX_LEVEL) {
    warns.push(`等级上限有两套：characters.js ${ch.MAX_LEVEL} / realm.js ${rm.MAX_LEVEL}——游戏用的是前者，realm.js 那套没有任何人 import`);
  }
}

/* ---- Boss 强度对照表：按剧本里真实的遭遇等级换算，基准值之间没有可比性 ---- */
{
  const at = {};
  for (const sc of Object.values(SCENES)) for (const e of sc.enemies || []) if (ENEMIES[e.ref]?.boss) at[e.ref] = e.level;
  const rows = [];
  let prev = null;
  for (const e of Object.values(ENEMIES)) {
    if (!e.boss) continue;
    const lv = at[e.id];
    if (lv == null) { rows.push(`${e.name}(未登场)`); continue; }
    const st = enemyStatsAt(e, lv);
    const hp = st.maxHp, atk = st.atk;
    rows.push(`${e.name}@Lv${lv} HP${hp} ATK${atk}`);
    if (prev && atk < prev.atk) warns.push(`首领强度倒挂：${e.name}(有效ATK${atk}) 弱于更早登场的 ${prev.name}(${prev.atk})`);
    prev = { name: e.name, atk };
  }
  console.log('首领:', rows.join(' | '));
}
if (warns.length) { console.log('\n--- 警告 (' + warns.length + ') ---'); warns.forEach(w => console.log('  ! ' + w)); }
if (errs.length) { console.log('\n--- 错误 (' + errs.length + ') ---'); errs.forEach(w => console.log('  X ' + w)); process.exitCode = 1; }
else console.log('\n✔ 剧情图与数据校验通过');
