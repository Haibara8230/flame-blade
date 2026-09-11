/* reach.mjs — 「玩家实际能走到 / 能拿到什么」的纯计算，没有任何输出。
   validate.mjs 用它报错，balance.mjs 用它校验队伍预设的装备。

   存在的理由：这个项目踩过两次同一类坑——数据、图标、台词、执行代码全都写好了，
   但没有任何路径能让玩家碰到（圣剑·霜华只有一行台词说「获得了」、
   「深渊前哨」商店从未被任何场景引用）。静态看代码全是「已实现」，
   只有真人玩到那一步才会发现，所以必须能自动算出来。 */

import { SCENES } from '../js/story.js';
import { SHOPS } from '../js/characters.js';

/* main.js 的 defaultEquip() 给的初始装备。那是 UI 层的数据，这里按实际值列出。 */
export const START_EQUIP = ['mu_sword', 'cloth', 'wood_staff', 'hunter_spear', 'snow_staff', 'holy_cloak'];

/* 从剧情入口出发，能走到的场景集合。
   三个入口分别是：正常开局、战斗失败线、隐藏线（后两者由运行时代码触发）。 */
export function reachableScenes(roots = ['prologue', 'c5_defeat', 'secret_route']) {
  const seen = new Set();
  const stack = [...roots];
  while (stack.length) {
    const id = stack.pop();
    if (!id || seen.has(id) || !SCENES[id]) continue;
    seen.add(id);
    const sc = SCENES[id];
    const push = x => { if (typeof x === 'string') stack.push(x); };
    push(sc.next);
    for (const c of sc.choices || []) {
      push(c.goto);
      for (const a of c.action || []) if (a && a.branch && a.target) { push(a.target.yes); push(a.target.no); }
    }
    if (sc.branch) { push(sc.branch.yes); push(sc.branch.no); }
    for (const a of sc.pre || []) {
      if (!a || typeof a !== 'object' || Array.isArray(a)) continue;
      if (a.branch && a.target) { push(a.target.yes); push(a.target.no); }
    }
  }
  return seen;
}

/* 真正会开门的商店（被某个可达场景用 shop: 引用的） */
export function openShops(reach = reachableScenes()) {
  const out = new Set();
  for (const id of reach) {
    const sc = SCENES[id];
    if (sc && sc.shop) out.add(sc.shop);
  }
  return out;
}

/* 玩家能拿到的装备与道具 id：开放商店的货 + 可达场景发放的 + 初始装备 */
export function obtainable(reach = reachableScenes()) {
  const out = new Set(START_EQUIP);
  for (const k of openShops(reach)) for (const g of (SHOPS[k] || {}).items || []) out.add(g);
  const walk = o => {
    if (!o || typeof o !== 'object') return;
    if (typeof o.item === 'string') out.add(o.item);
    if (typeof o.equip === 'string') out.add(o.equip);
    for (const v of Object.values(o)) walk(v);
  };
  for (const id of reach) walk(SCENES[id]);
  return out;
}
