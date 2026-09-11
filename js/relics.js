/* ============================================================
   relics.js — 遗物

   剧本里早就写满了物件：小铃系了两道的红绳、刻着十八个名字的树皮、
   孩子折歪的纸太阳、父亲刀鞘上的旧徽记……但它们此前只存在于台词里，
   说完就没了。

   现在每一件都是可收集的遗物：翻开能看到那段回忆，
   同时给全队一点很小但真实的加成。对应的旗标本来就在存档里，
   所以只要在旗标点亮时登记一次即可。
   ============================================================ */

export const RELICS = [
  {
    id: 'ribbon', name: '两道结的红绳', flag: 'ribbonPromise', chapter: '序章',
    hint: '序章，钟楼下。有人把它系在了你看不见的地方。',
    bonus: { par: 0.02 }, bonusText: '全队弹反率 +2%',
    memory: '「要系两道。」她说，「系一道会松，松了就找不回来了。」\n凯当时嫌麻烦。现在他每天早上都要重新系一次。',
    bond: 'kaito',
  },
  {
    id: 'crest', name: '刀鞘上的旧徽记', flag: 'sawOldCrest', chapter: '序章',
    hint: '序章，铁匠铺。铁匠看见它时，手停了一下。',
    bonus: { atk: 4 }, bonusText: '全队攻击力 +4',
    memory: '铁匠只说了一句：「这个记号，我很久没见过了。」\n然后他就再也没说过第二句。第二天，铁匠铺烧了。',
    bond: 'cang',
  },
  {
    id: 'bark', name: '刻着名字的树皮', flag: 'sisterForestClue', chapter: '第二章',
    hint: '第二章，林中空营地。十八个人，十四个打了勾。',
    bonus: { hp: 40 }, bonusText: '全队生命上限 +40',
    memory: '十八个名字，十四个打了勾，四个写着「要扶」。\n背面刻着一个箭头，指向水流下游。\n她怕漏掉人。每次出门都要数。',
    bond: 'kaito',
  },
  {
    id: 'medicine', name: '没送出去的药包', flag: 'carriedMedicine', chapter: '序章',
    hint: '序章，药屋。本来是要送去给别人的。',
    bonus: { hpRegen: 0.015 }, bonusText: '战斗中每回合回复 1.5% 生命',
    memory: '药是给守钟老人的。他那天没等到。\n凯后来一直背着这个药包，没打开过。',
    bond: 'cang',
  },
  {
    id: 'ledger', name: '商会的账单', flag: 'harborPlan', chapter: '第三章',
    hint: '第三章，港町。上面写着人数和日期，却没有货物。',
    bonus: { bossBane: 0.06 }, bonusText: '对首领伤害 +6%',
    memory: '写着人数，写着日期，没有货物。\n换的是通行许可。魔军给他们自己的船放行。\n雷把账单折起来收进怀里：「留着。总有人要看。」',
    bond: 'lei',
  },
  {
    id: 'paper_sun', name: '折歪了的纸太阳', flag: 'ryzeBond', chapter: '第四章',
    hint: '第四章，北境避难所。一个不会说话的孩子给的。',
    bonus: { statusRes: 0.08 }, bonusText: '全队异常抵抗 +8%',
    memory: '「为什么给我？」\n「因为你没有把我冻起来。」\n璃很认真地把它夹进衣襟。从那天起，她的手不再那么凉了。',
    bond: 'ryze',
  },
  {
    id: 'namestone', name: '扶正的名字石', flag: 'cangBond', chapter: '第五章',
    hint: '第五章，遗迹出口。苍一个人在那里待了很久。',
    bonus: { def: 5 }, bonusText: '全队防御力 +5',
    memory: '五百年了，他还记得每一块石头上刻的是谁。\n「记住名字不是为了难过。」他说，\n「是为了让他们还算数。」',
    bond: 'cang',
  },
  {
    id: 'spear_grip', name: '缠了三层的枪柄布', flag: 'leiBond', chapter: '第二章',
    hint: '第二章，夜营。她守夜的时候在缠它。',
    bonus: { cri: 0.03 }, bonusText: '全队会心率 +3%',
    memory: '「缠三层，手就不会滑。」\n「血也擦得掉。」\n她说这话的时候没有抬头。',
    bond: 'lei',
  },
  {
    id: 'seal_frag', name: '封印残片', flag: 'sealKnowledge', chapter: '第五章',
    hint: '第五章，记忆石。父亲当年带走的那一块。',
    bonus: { elemAll: 0.05 }, bonusText: '全队所有属性伤害 +5%',
    memory: '「确认只能吞掉战场？」\n「确认。」\n他带走了这一块，然后去了还活着的人那里。\n五百年后，它在他儿子手上。',
    bond: 'cang',
  },
  {
    id: 'oath', name: '不熄之约', flag: 'promised', chapter: '第六章',
    hint: '第六章，王座之前。不是东西，是一句话。',
    bonus: { atk: 6, hp: 50 }, bonusText: '全队攻击 +6、生命上限 +50',
    memory: '「我说过，地上冷。」\n那时候她的手松开了。霜华落在地上。\n这件遗物没有形状。但每个人都知道它在。',
    bond: 'ryze',
  },
];

export const RELIC_BY_FLAG = {};
for (const r of RELICS) RELIC_BY_FLAG[r.flag] = r;

/* 已收集的遗物合计出的加成 */
export function relicBonus(G, key) {
  let sum = 0;
  for (const r of RELICS) {
    if (!G.relics || !G.relics[r.id]) continue;
    const v = r.bonus[key];
    if (typeof v === 'number') sum += v;
  }
  return sum;
}

/* 检查旗标，把新点亮的遗物登记进收藏。返回新获得的那些。 */
export function syncRelics(G) {
  if (!G.relics) G.relics = {};
  const gained = [];
  for (const r of RELICS) {
    if (G.relics[r.id]) continue;
    if (!G.flags || !G.flags[r.flag]) continue;
    G.relics[r.id] = { at: Date.now() };
    gained.push(r);
  }
  return gained;
}

export default { RELICS, relicBonus, syncRelics };
