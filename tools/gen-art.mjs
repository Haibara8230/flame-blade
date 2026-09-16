/* 扫描 art/portraits/ 与 art/monsters/ 生成图片清单。

   和 gen-equipment.mjs 一个套路：让「目录里有什么」变成一份显式清单，
   浏览器不用去猜文件在不在，也不会满控制台 404。

   命名规则：
     art/portraits/<角色id>.png          默认立绘（见 js/portraits.js 顶部注释）
     art/portraits/<角色id>-<表情>.png   某个表情的专用图（可选）
     art/monsters/<敌人id>.png           怪物图（敌人 id 见 js/characters.js 的 ENEMIES）

   怪物图没有表情差分，一个 id 一张。

   用法：node tools/gen-art.mjs
   往这两个目录加删图片之后都要重跑一次。
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXT = new Set(['.png', '.webp', '.jpg', '.jpeg']);

function ensure(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log('已创建空目录', path.relative(root, dir));
  }
}
const imagesIn = dir => fs.readdirSync(dir).filter(f => EXT.has(path.extname(f).toLowerCase()));

let bad = 0;

/* ---------------- 立绘 ---------------- */
const pDir = path.join(root, 'art', 'portraits');
ensure(pDir);

const { EXPRESSIONS } = await import('../js/portraits.js');
const exprSet = new Set(EXPRESSIONS);

const manifest = {};
const skipped = [];
for (const f of imagesIn(pDir)) {
  const ext = path.extname(f).toLowerCase();
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

const pOut = path.join(pDir, 'manifest.json');
fs.writeFileSync(pOut, JSON.stringify(manifest, null, 2));
const ids = Object.keys(manifest);
console.log('已生成', path.relative(root, pOut));
if (!ids.length) console.log('  目录里还没有图片——游戏会继续用代码画的立绘。');
else for (const id of ids) console.log(`  ${id}: ${Object.keys(manifest[id]).join(' / ')}`);
if (skipped.length) { console.log('\n! 立绘注意：'); skipped.forEach(x => console.log('  ' + x)); bad++; }

/* ---------------- 怪物 ---------------- */
const mDir = path.join(root, 'art', 'monsters');
ensure(mDir);

const { ENEMIES } = await import('../js/characters.js');
const known = new Set(Object.keys(ENEMIES));

const mons = {};
const orphans = [];
for (const f of imagesIn(mDir)) {
  const id = path.basename(f, path.extname(f));
  if (!known.has(id)) { orphans.push(f); continue; }
  mons[id] = 'art/monsters/' + f;
}

const mOut = path.join(mDir, 'manifest.json');
fs.writeFileSync(mOut, JSON.stringify(mons, null, 2));
const mIds = Object.keys(mons);
console.log('\n已生成', path.relative(root, mOut));
if (!mIds.length) console.log('  目录里还没有图片——战斗会继续用 sprites.js 画的怪物。');
else for (const id of mIds) console.log(`  ${id}（${ENEMIES[id].name}）`);

/* 文件名对不上任何一个敌人 id 的图片，游戏永远读不到它。
   这正是本项目最怕的「静默停在旧数据上」，所以必须报错退出。 */
if (orphans.length) {
  console.log('\n! 怪物注意：以下文件名不是任何一个敌人 id，游戏读不到它们：');
  orphans.forEach(f => console.log('  ' + f));
  console.log('  敌人 id 见 js/characters.js 的 ENEMIES，当前有：');
  console.log('  ' + [...known].join(', '));
  console.log('  要么把文件改成对应的 id，要么先把这个怪物加进 ENEMIES。');
  bad++;
}

if (bad) process.exitCode = 1;
