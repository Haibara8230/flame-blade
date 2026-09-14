/* refs/ 下的原文预处理：编码检测 + 按章切分 + 生成章节索引。

   为什么需要它：原文有几百万字，一次读不进上下文。
   切分之后可以按批次读（比如一次 30 章），每章压成一份结构化笔记落盘，
   后续从笔记生成游戏场景，而不是反复搬运原文。

   用法：
     node tools/ingest.mjs --check     只检测编码，不写任何文件
     node tools/ingest.mjs             切章，写 refs/chapters/ 与 refs/index.json
     node tools/ingest.mjs --to-utf8   顺便把 GBK 源文件转存为 UTF-8

   refs/ 整个目录在 .gitignore 里，产物不会进仓库。
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const refs = path.join(root, 'refs');
const args = new Set(process.argv.slice(2));

if (!fs.existsSync(refs)) {
  console.error('没有 refs/ 目录。先建它，把原文 txt 放进去。');
  process.exit(1);
}

/* ---------------- 编码 ----------------
   小说站下载的 txt 多半是 GBK/GB18030，按 UTF-8 读会整篇乱码。
   判断方法：分别用两种编码解码，看谁产生的替换字符（U+FFFD）少。 */
function decodeBest(buf) {
  const tryDecode = enc => {
    try { return new TextDecoder(enc, { fatal: false }).decode(buf); }
    catch { return null; }
  };
  const utf8 = tryDecode('utf-8');
  const gbk = tryDecode('gb18030');
  const bad = s => s ? (s.match(/�/g) || []).length : Infinity;
  const bu = bad(utf8), bg = bad(gbk);
  if (bu <= bg) return { text: utf8, enc: 'utf-8', bad: bu };
  return { text: gbk, enc: 'gb18030', bad: bg };
}

/* ---------------- 切章 ----------------
   匹配「第一章 标题」「第1章 标题」「序章 标题」这类行首标题。
   分卷行（第一卷 …）单独记，用来给章节打卷号。 */
const CH_RE = /^[ \t　]*(?:(序[章幕])|第\s*([0-9一二三四五六七八九十百千零两]+)\s*章)[ \t　]*(.*)$/;
const VOL_RE = /^[ \t　]*第\s*([0-9一二三四五六七八九十百千零两]+)\s*卷[ \t　]*(.*)$/;

/* 正文里也会出现「第三百章」这类行内引用，只靠正则会误切。
   两条约束把它们挡掉：标题行不会长，也不会用句末标点收尾。 */
function looksLikeHeading(line, title) {
  if (line.trim().length > 40) return false;
  if (/[。！？；、，]\s*$/.test(title)) return false;
  return true;
}

function splitChapters(text) {
  const lines = text.split(/\r?\n/);
  const out = [];
  let vol = null, cur = null;
  for (const line of lines) {
    const v = line.match(VOL_RE);
    if (v && looksLikeHeading(line, (v[2] || '').trim())) {
      vol = { num: v[1], title: (v[2] || '').trim() };
      continue;
    }
    const m = line.match(CH_RE);
    if (m && looksLikeHeading(line, (m[3] || '').trim())) {
      if (cur) out.push(cur);
      cur = {
        seq: out.length + 1,
        num: m[1] ? m[1] : m[2],
        title: (m[3] || '').trim(),
        vol: vol ? `第${vol.num}卷 ${vol.title}`.trim() : null,
        lines: [],
      };
      continue;
    }
    if (cur) cur.lines.push(line);
  }
  if (cur) out.push(cur);
  return out;
}

/* ---------------- 主流程 ---------------- */
const sources = fs.readdirSync(refs)
  .filter(f => /\.txt$/i.test(f))
  .map(f => path.join(refs, f))
  .sort();

if (!sources.length) {
  console.error('refs/ 下没有 .txt。把原文放进去再跑，命名随意（full.txt / vol1.txt / …）。');
  process.exit(1);
}

let all = [];
for (const src of sources) {
  const buf = fs.readFileSync(src);
  const { text, enc, bad } = decodeBest(buf);
  const name = path.basename(src);
  console.log(`${name}  ${(buf.length / 1048576).toFixed(1)}MB  编码=${enc}` +
    (bad ? `  ⚠ 仍有 ${bad} 个无法解码的字符` : ''));

  if (args.has('--to-utf8') && enc !== 'utf-8') {
    const dst = src.replace(/\.txt$/i, '.utf8.txt');
    fs.writeFileSync(dst, text);
    console.log(`  → 已转存 ${path.basename(dst)}`);
  }
  if (args.has('--check')) continue;

  const chs = splitChapters(text);
  console.log(`  切出 ${chs.length} 章`);
  all = all.concat(chs);
}

if (args.has('--check')) {
  console.log('\n只做了编码检测，没有写文件。确认编码没问题后去掉 --check 再跑。');
  process.exit(0);
}

if (!all.length) {
  console.error('\n一章都没切出来。可能是章节标题格式不匹配——');
  console.error('脚本认的是行首的「第N章 标题」或「序章 标题」。');
  console.error('把你文件里实际的标题行贴给我，我改正则。');
  process.exit(1);
}

// 重新编号（跨文件连续）
all.forEach((c, i) => { c.seq = i + 1; });

const chDir = path.join(refs, 'chapters');
fs.mkdirSync(chDir, { recursive: true });
for (const c of all) {
  const body = c.lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  const head = `# ${c.num === '序章' || c.num === '序幕' ? c.num : '第' + c.num + '章'} ${c.title}`.trim();
  fs.writeFileSync(
    path.join(chDir, String(c.seq).padStart(4, '0') + '.txt'),
    (c.vol ? c.vol + '\n' : '') + head + '\n\n' + body + '\n');
}

const index = all.map(c => ({
  seq: c.seq, vol: c.vol, num: c.num, title: c.title, chars: c.lines.join('').length,
}));
fs.writeFileSync(path.join(refs, 'index.json'), JSON.stringify(index, null, 2));

const vols = [...new Set(all.map(c => c.vol).filter(Boolean))];
const total = index.reduce((a, c) => a + c.chars, 0);
console.log(`\n共 ${all.length} 章，${(total / 10000).toFixed(1)} 万字`);
if (vols.length) console.log(`分卷 ${vols.length} 个：${vols.slice(0, 5).join(' / ')}${vols.length > 5 ? ' …' : ''}`);
console.log(`章节已写入 refs/chapters/，索引 refs/index.json`);
console.log(`\n下一步：我按批次读 refs/chapters/，每章压成笔记写进 refs/notes/。`);
