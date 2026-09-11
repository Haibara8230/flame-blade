/* PNG 像素分析：确认画面真的画出来了（非空白/非纯色） */
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

function readPNG(file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not png');
  let off = 8, w = 0, h = 0, bd = 8, ct = 6, idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bd = data[8]; ct = data[9]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const ch = ct === 6 ? 4 : ct === 2 ? 3 : ct === 0 ? 1 : 4;
  const bpp = ch * (bd / 8);
  const stride = w * bpp;
  const out = Buffer.alloc(h * stride);
  let pos = 0;
  for (let y = 0; y < h; y++) {
    const ft = raw[pos++];
    const line = raw.subarray(pos, pos + stride); pos += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (ft === 1) v += a; else if (ft === 2) v += b; else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      cur[x] = v & 255;
    }
  }
  return { w, h, ch, bpp, stride, data: out };
}

function regionStats(img, x0, y0, x1, y1) {
  let r = 0, g = 0, b = 0, n = 0, min = 255, max = 0;
  const uniq = new Set();
  let varSum = 0;
  const lum = [];
  for (let y = y0; y < y1; y += 2) {
    for (let x = x0; x < x1; x += 2) {
      const i = y * img.stride + x * img.bpp;
      const R = img.data[i], G = img.data[i + 1], B = img.data[i + 2];
      r += R; g += G; b += B; n++;
      uniq.add((R >> 4 << 8) | (G >> 4 << 4) | (B >> 4));
      const L = (R * 0.299 + G * 0.587 + B * 0.114);
      lum.push(L); if (L < min) min = L; if (L > max) max = L;
    }
  }
  const mL = lum.reduce((a, c) => a + c, 0) / lum.length;
  const sd = Math.sqrt(lum.reduce((a, c) => a + (c - mL) ** 2, 0) / lum.length);
  return { mean: [Math.round(r / n), Math.round(g / n), Math.round(b / n)], lumSD: +sd.toFixed(1), min: Math.round(min), max: Math.round(max), colors: uniq.size };
}

const dir = process.argv[2] || path.join(__dirname, '..', 'shots');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.png')).sort();
for (const f of files) {
  const img = readPNG(path.join(dir, f));
  const all = regionStats(img, 0, 0, img.w, img.h);
  const mid = regionStats(img, Math.round(img.w * .1), Math.round(img.h * .1), Math.round(img.w * .9), Math.round(img.h * .9));
  console.log(f.padEnd(22), `${img.w}x${img.h}`, 'mean=' + JSON.stringify(all.mean), 'lumSD=' + all.lumSD, 'colors=' + all.colors, '| center', JSON.stringify(mid.mean), 'sd=' + mid.lumSD);
}
