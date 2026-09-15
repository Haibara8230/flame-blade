/* 扫描 art/portraits/ 生成图片立绘清单。

   和 gen-equipment.mjs 一个套路：让「目录里有什么」变成一份显式清单，
   浏览器不用去猜文件在不在，也不会满控制台 404。

   命名规则（见 js/portraits.js 顶部注释）：
     <角色id>.png            默认立绘
     <角色id>-<表情>.png     某个表情的专用图（可选）

   用法：node tools/gen-art.mjs
   往 art/portraits/ 加删图片之后都要重跑一次。
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'art', 'portraits');
const out = path.join(dir, 'manifest.json');
const EXT = new Set(['.png', '.webp', '.jpg', '.jpeg']);

if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
  console.log('已创建空目录', path.relative(root, dir));
}

const { EXPRESSIONS } = await import('../js/portraits.js');
const exprSet = new Set(EXPRESSIONS);

const manifest = {};
const skipped = [];
for (const f of fs.readdirSync(dir)) {
  const ext = path.extname(f).toLowerCase();
  if (!EXT.has(ext)) continue;
  const stem = path.basename(f, ext);
  const dash = stem.lastIndexOf('-');
  let id = stem, expr = 'normal';
  if (dash > 0 && exprSet.has(stem.slice(dash + 1))) {
    id = stem.slice(0, dash);
    expr = stem.slice(dash + 1);
  }
  (manifest[id] ||= {})[expr] = 'art/portraits/' + f;
}

/* 有表情图但没有默认图 → 那个角色一张都用不上，必须报出来 */
for (const [id, v] of Object.entries(manifest)) {
  if (!v.normal) skipped.push(`${id}: 只有表情图、缺少默认立绘 ${id}.png，该角色会整个退回程序化立绘`);
}

fs.writeFileSync(out, JSON.stringify(manifest, null, 2));
const ids = Object.keys(manifest);
console.log('已生成', path.relative(root, out));
if (!ids.length) console.log('目录里还没有图片——游戏会继续用代码画的立绘。');
else for (const id of ids) console.log(`  ${id}: ${Object.keys(manifest[id]).join(' / ')}`);
if (skipped.length) { console.log('\n! 注意：'); skipped.forEach(x => console.log('  ' + x)); process.exitCode = 1; }
