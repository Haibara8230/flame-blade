/* 由 equipment-catalog.json 生成 js/equipment-data.js。

   之前这一步只存在于某个人的终端历史里，没进仓库——
   结果是改了 JSON 而忘记重新生成，掉落池会静默地停在旧数据上，
   高阶装备一件都不掉，而且不报任何错。加进来省得再踩。

   用法：node tools/gen-equipment.mjs
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcPath = path.join(root, 'equipment-catalog.json');
const outPath = path.join(root, 'js', 'equipment-data.js');

const src = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
const rarities = src.rarities || [];
const items = src.items || [];

if (!items.length) throw new Error('equipment-catalog.json 里没有 items');

// 阶位必须连续，缺号会让 loot.js 的 BY_RANK 出现空池，
// 而空池会静默回落到 1 阶——正是这次查出来的那个 bug。
const ranks = [...new Set(items.map(i => i.rarityRank))].sort((a, b) => a - b);
for (const r of rarities) {
  if (r.rank === Math.max(...rarities.map(x => x.rank))) continue;  // 最高阶允许留空（禁断之器由剧情授予）
  if (!ranks.includes(r.rank)) throw new Error(`阶位 ${r.rank}（${r.name}）没有任何装备条目`);
}

const head = `/* 由 equipment-catalog.json 生成，勿手改。\n` +
  `   改完 JSON 请跑：node tools/gen-equipment.mjs\n` +
  `   源文件是命名策划稿；数值、词缀与掉落全部在 loot.js 里派生。 */\n`;
const body =
  `export const CATALOG_RARITIES = ${JSON.stringify(rarities)};\n` +
  `export const CATALOG = ${JSON.stringify(items)};\n` +
  `export default { CATALOG, CATALOG_RARITIES };\n`;

fs.writeFileSync(outPath, head + body);

const by = {};
for (const i of items) by[i.rarityRank] = (by[i.rarityRank] || 0) + 1;
console.log(`已生成 ${path.relative(root, outPath)}`);
console.log(`阶位数 ${rarities.length}，装备 ${items.length} 件`);
console.log(rarities.map(r => `${r.rank}.${r.name}×${by[r.rank] || 0}`).join('  '));
