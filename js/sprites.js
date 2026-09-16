/* ============================================================
   sprites.js — 程序化绘制日漫风格场景 / 精灵 / 特效
   坐标系：所有精灵传入脚底中心点 (x, y)，内部向上绘制
   ============================================================ */

const TAU = Math.PI * 2;
function rnd(a, b) { return a + Math.random() * (b - a); }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

/* ---------- 多边形路径 ---------- */
function poly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

/* ---------- 圆角矩形 ---------- */
function rrect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function ell(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, TAU);
}

/* ============================================================
   背景
   ============================================================ */
const STAR = Array.from({ length: 110 }, () => ({ x: Math.random(), y: Math.random(), r: rnd(0.5, 1.7), p: rnd(0, TAU) }));

function skyGradient(ctx, W, H, stops) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  stops.forEach(s => g.addColorStop(s[0], s[1]));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function stars(ctx, W, H, t, alpha = 1) {
  for (const s of STAR) {
    const a = (0.35 + 0.65 * Math.abs(Math.sin(t * 1.4 + s.p))) * alpha;
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.beginPath();
    ctx.arc(s.x * W, s.y * H * 0.62, s.r, 0, TAU);
    ctx.fill();
  }
}

function moon(ctx, x, y, r, t, col = '#ffe9b0') {
  const g = ctx.createRadialGradient(x, y, r * 0.4, x, y, r * 4);
  g.addColorStop(0, 'rgba(255,230,170,.55)');
  g.addColorStop(0.35, 'rgba(255,180,90,.16)');
  g.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r * 4, 0, TAU); ctx.fill();
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(200,170,120,.25)';
  ctx.beginPath(); ctx.arc(x - r * .3, y + r * .2, r * .22, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(x + r * .35, y - r * .25, r * .15, 0, TAU); ctx.fill();
}

export function drawBackground(ctx, kind, W, H, t, extras = {}) {
  ctx.save();
  const pan = extras.pan || 0;
  switch (kind) {

    /* ---------------- 燃烧的村庄 ---------------- */
    case 'village_fire': {
      skyGradient(ctx, W, H, [[0, '#12060a'], [.35, '#3a1208'], [.62, '#8f2c08'], [.78, '#d9560c'], [1, '#2a0d06']]);
      stars(ctx, W, H, t, .5);
      moon(ctx, W * 0.78, H * 0.2, 30, t, '#ffcf8a');
      // 远山
      ctx.fillStyle = 'rgba(20,8,14,.85)';
      poly(ctx, [[0, H * .62], [W * .16, H * .46], [W * .3, H * .6], [W * .5, H * .4], [W * .68, H * .6], [W * .85, H * .48], [W, H * .62], [W, H], [0, H]]);
      ctx.fill();
      // 村落剪影 + 火焰
      for (let i = 0; i < 7; i++) {
        const bx = (i * 137 + 40 - pan * 0.3) % (W + 200) - 100;
        const by = H * 0.68 + (i % 3) * 12;
        const s = 0.85 + (i % 4) * 0.14;
        ctx.fillStyle = '#140609';
        poly(ctx, [[bx - 58 * s, by], [bx - 58 * s, by - 56 * s], [bx - 34 * s, by - 84 * s], [bx + 34 * s, by - 84 * s], [bx + 58 * s, by - 56 * s], [bx + 58 * s, by]]);
        ctx.fill();
        // 屋顶
        ctx.fillStyle = '#0d0407';
        poly(ctx, [[bx - 70 * s, by - 56 * s], [bx, by - 104 * s], [bx + 70 * s, by - 56 * s]]);
        ctx.fill();
        // 窗中火光
        const fw = 26 * s * (0.85 + 0.15 * Math.sin(t * 9 + i));
        const gg = ctx.createRadialGradient(bx, by - 30 * s, 2, bx, by - 30 * s, fw * 2.2);
        gg.addColorStop(0, 'rgba(255,220,120,.95)');
        gg.addColorStop(1, 'rgba(255,90,0,0)');
        ctx.fillStyle = gg;
        ctx.beginPath(); ctx.arc(bx, by - 30 * s, fw * 2.2, 0, TAU); ctx.fill();
      }
      // 前景火焰
      for (let i = 0; i < 16; i++) {
        const fx = ((i * 71 + 20 - pan) % (W + 160)) - 80;
        const fy = H - 18;
        const hh = 34 + 30 * Math.abs(Math.sin(t * 4 + i * 1.7));
        const g = ctx.createLinearGradient(fx, fy, fx, fy - hh);
        g.addColorStop(0, 'rgba(255,240,150,.9)');
        g.addColorStop(.45, 'rgba(255,140,20,.75)');
        g.addColorStop(1, 'rgba(200,20,0,0)');
        ctx.fillStyle = g;
        poly(ctx, [[fx - 15, fy], [fx - 6, fy - hh * .6], [fx, fy - hh], [fx + 6, fy - hh * .6], [fx + 15, fy]]);
        ctx.fill();
      }
      // 地面
      ctx.fillStyle = '#180608';
      ctx.fillRect(0, H - 16, W, 16);
      break;
    }

    /* ---------------- 黑之森 ---------------- */
    case 'forest': {
      skyGradient(ctx, W, H, [[0, '#08120e'], [.45, '#12301f'], [.75, '#1c4a2a'], [1, '#08120c']]);
      stars(ctx, W, H, t, .35);
      moon(ctx, W * 0.22, H * 0.16, 22, t, '#d8ffe0');
      // 光柱
      for (let i = 0; i < 6; i++) {
        const lx = W * (0.1 + i * 0.16) - pan * 0.1;
        const g = ctx.createLinearGradient(lx, 0, lx + 90, H);
        g.addColorStop(0, 'rgba(180,255,190,.09)');
        g.addColorStop(1, 'rgba(120,255,150,0)');
        ctx.fillStyle = g;
        poly(ctx, [[lx, 0], [lx + 56, 0], [lx + 56 + 90, H], [lx + 46, H]]);
        ctx.fill();
      }
      // 三层树
      const layers = [
        { c: '#0e2a1c', o: 0.35, sc: 1.0, base: H * 0.74, w: 92 },
        { c: '#0a1f14', o: 0.7, sc: 1.35, base: H * 0.83, w: 128 },
        { c: '#05120b', o: 1, sc: 1.9, base: H, w: 176 },
      ];
      for (const L of layers) {
        for (let i = 0; i < 9; i++) {
          const tx = ((i * 173 + L.w * 0.5 - pan * L.o * 0.55) % (W + 320)) - 160;
          const s = L.sc;
          ctx.fillStyle = L.c;
          // 树干
          ctx.fillRect(tx - 9 * s, L.base - 150 * s, 18 * s, 160 * s);
          // 树冠（多层三角）
          for (let k = 0; k < 3; k++) {
            const yy = L.base - 130 * s - k * 52 * s;
            const ww = L.w * s * (1 - k * 0.22);
            poly(ctx, [[tx - ww, yy], [tx, yy - 84 * s], [tx + ww, yy]]);
            ctx.fill();
          }
        }
      }
      break;
    }

    /* ---------------- 北境雪原 ---------------- */
    case 'snow': {
      skyGradient(ctx, W, H, [[0, '#050a1c'], [.35, '#123058'], [.62, '#3a6a9c'], [.82, '#9fc4e0'], [1, '#dceaf8']]);
      stars(ctx, W, H, t, .6);
      moon(ctx, W * 0.7, H * 0.18, 26, t, '#eaf6ff');
      // 极光
      for (let i = 0; i < 3; i++) {
        const g = ctx.createLinearGradient(0, H * 0.05, 0, H * 0.4);
        g.addColorStop(0, 'rgba(120,255,200,0)');
        g.addColorStop(.5, `rgba(${i === 0 ? '120,255,200' : i === 1 ? '150,180,255' : '200,140,255'},.16)`);
        g.addColorStop(1, 'rgba(120,255,200,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, H * 0.28);
        for (let x = 0; x <= W; x += 32) ctx.lineTo(x, H * 0.2 + Math.sin(x * 0.006 + t * 0.7 + i * 2) * 42 + i * 12);
        ctx.lineTo(W, H * 0.45); ctx.lineTo(0, H * 0.45);
        ctx.closePath(); ctx.fill();
      }
      // 雪山
      ctx.fillStyle = '#2a4a70';
      poly(ctx, [[0, H * .72], [W * .18, H * .38], [W * .34, H * .66], [W * .55, H * .3], [W * .74, H * .62], [W * .9, H * .44], [W, H * .66], [W, H], [0, H]]);
      ctx.fill();
      ctx.fillStyle = 'rgba(230,245,255,.75)';
      poly(ctx, [[W * .18, H * .38], [W * .34, H * .66], [W * .26, H * .66], [W * .2, H * .5]]);
      ctx.fill();
      poly(ctx, [[W * .55, H * .3], [W * .74, H * .62], [W * .62, H * .62], [W * .56, H * .44]]);
      ctx.fill();
      // 雪原
      const sg = ctx.createLinearGradient(0, H * .7, 0, H);
      sg.addColorStop(0, '#c8dcee'); sg.addColorStop(1, '#eaf4ff');
      ctx.fillStyle = sg;
      poly(ctx, [[0, H * .78], [W * .3, H * .72], [W * .62, H * .8], [W, H * .74], [W, H], [0, H]]);
      ctx.fill();
      // 飘雪
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      for (let i = 0; i < 90; i++) {
        const sx = (i * 137 + t * (24 + (i % 5) * 14)) % (W + 40) - 20;
        const sy = ((i * 91 + t * (36 + (i % 4) * 18)) % (H + 40)) - 20;
        const r = 0.9 + (i % 3) * 0.8;
        ctx.globalAlpha = 0.35 + (i % 4) * 0.16;
        ctx.beginPath(); ctx.arc(sx, sy, r, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
      break;
    }

    /* ---------------- 魔王城·王座 ---------------- */
    case 'castle': {
      skyGradient(ctx, W, H, [[0, '#0a0210'], [.4, '#22041e'], [.7, '#4a0820'], [1, '#10020a']]);
      stars(ctx, W, H, t, .25);
      // 血色满月
      const g = ctx.createRadialGradient(W * .5, H * .22, 20, W * .5, H * .22, 260);
      g.addColorStop(0, 'rgba(255,60,60,.55)');
      g.addColorStop(.4, 'rgba(180,20,40,.18)');
      g.addColorStop(1, 'rgba(120,0,20,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#c81a30';
      ctx.beginPath(); ctx.arc(W * .5, H * .22, 78, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(90,4,20,.55)';
      ctx.beginPath(); ctx.arc(W * .5 - 22, H * .22 - 14, 16, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(W * .5 + 26, H * .22 + 18, 24, 0, TAU); ctx.fill();
      // 巨柱
      for (let i = 0; i < 5; i++) {
        const cx = 70 + i * (W - 140) / 4;
        const cw = 46;
        ctx.fillStyle = '#160418';
        ctx.fillRect(cx - cw / 2, H * .12, cw, H * .88);
        ctx.fillStyle = 'rgba(120,20,50,.5)';
        ctx.fillRect(cx - cw / 2, H * .12, 5, H * .88);
        ctx.fillStyle = '#22061f';
        ctx.fillRect(cx - cw / 2 - 9, H * .1, cw + 18, 16);
        // 柱上血纹
        ctx.strokeStyle = 'rgba(255,40,70,.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let y = H * .2; y < H; y += 26) ctx.lineTo(cx, y + Math.sin(y * .05 + t) * 4);
        ctx.stroke();
      }
      // 王座台阶
      ctx.fillStyle = '#12030f';
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(W * .18 + i * 40, H * .62 + i * 26, W * .64 - i * 80, 26);
      }
      // 悬浮符文
      for (let i = 0; i < 14; i++) {
        const px = (i * 211 + t * (12 + i * 3)) % (W + 120) - 60;
        const py = H * .2 + ((i * 97) % (H * .6)) + Math.sin(t * 1.4 + i) * 14;
        ctx.fillStyle = `rgba(255,${60 + i * 6},80,${.28 + .3 * Math.abs(Math.sin(t + i))})`;
        ctx.save(); ctx.translate(px, py); ctx.rotate(t + i);
        ctx.fillRect(-3, -3, 6, 6);
        ctx.restore();
      }
      break;
    }

    /* ---------------- 星海 / 回忆 ---------------- */
    case 'void': {
      skyGradient(ctx, W, H, [[0, '#050418'], [.5, '#100a34'], [1, '#03020c']]);
      stars(ctx, W, H, t, 1);
      for (let i = 0; i < 4; i++) {
        const g = ctx.createRadialGradient(W * (.2 + i * .2), H * .5 + Math.sin(t + i) * 30, 8, W * (.2 + i * .2), H * .5, 200);
        g.addColorStop(0, `rgba(${140 + i * 30},120,255,.22)`);
        g.addColorStop(1, 'rgba(60,40,160,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }
      break;
    }

    /* ---------------- 白昼村庄（和平） ---------------- */
    case 'village_day': {
      skyGradient(ctx, W, H, [[0, '#3a7ec8'], [.5, '#8fc4e8'], [.8, '#ffd9a0'], [1, '#f0c992']]);
      // 云
      ctx.fillStyle = 'rgba(255,255,255,.72)';
      for (let i = 0; i < 5; i++) {
        const cx = ((i * 260 + t * 8) % (W + 400)) - 200;
        const cy = 60 + (i % 3) * 42;
        ctx.beginPath();
        ctx.arc(cx, cy, 34, 0, TAU); ctx.arc(cx + 40, cy + 8, 26, 0, TAU);
        ctx.arc(cx - 38, cy + 10, 22, 0, TAU); ctx.arc(cx + 12, cy - 18, 26, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#5a9a4a';
      poly(ctx, [[0, H * .7], [W * .25, H * .54], [W * .6, H * .68], [W, H * .56], [W, H], [0, H]]);
      ctx.fill();
      ctx.fillStyle = '#7ab85a';
      poly(ctx, [[0, H * .82], [W * .35, H * .74], [W * .7, H * .84], [W, H * .78], [W, H], [0, H]]);
      ctx.fill();
      // 房子
      for (let i = 0; i < 4; i++) {
        const bx = 110 + i * 240, by = H * .78;
        ctx.fillStyle = '#e8dcc0';
        ctx.fillRect(bx - 62, by - 110, 124, 110);
        ctx.fillStyle = '#a8543a';
        poly(ctx, [[bx - 78, by - 110], [bx, by - 168], [bx + 78, by - 110]]); ctx.fill();
        ctx.fillStyle = '#5a3a22';
        ctx.fillRect(bx - 22, by - 60, 44, 60);
        ctx.fillStyle = '#8fc8e8';
        ctx.fillRect(bx - 52, by - 92, 26, 26);
        ctx.fillRect(bx + 26, by - 92, 26, 26);
      }
      // 树
      for (let i = 0; i < 7; i++) {
        const tx = 30 + i * 150;
        ctx.fillStyle = '#5a3a1e';
        ctx.fillRect(tx - 7, H * .74, 14, 60);
        ctx.fillStyle = '#4a8f3a';
        ctx.beginPath(); ctx.arc(tx, H * .72, 34, 0, TAU); ctx.fill();
        ctx.fillStyle = '#5aa844';
        ctx.beginPath(); ctx.arc(tx - 14, H * .7, 22, 0, TAU); ctx.fill();
      }
      break;
    }

    /* ---------------- 港町 ---------------- */
    case 'harbor': {
      skyGradient(ctx, W, H, [[0, '#1a3a6a'], [.45, '#e8703a'], [.7, '#ffb060'], [1, '#3a2a4a']]);
      moon(ctx, W * .18, H * .28, 22, t, '#fff0c0');
      // 海
      const sg = ctx.createLinearGradient(0, H * .6, 0, H);
      sg.addColorStop(0, '#2a4a7a'); sg.addColorStop(1, '#0a1a3a');
      ctx.fillStyle = sg; ctx.fillRect(0, H * .62, W, H * .38);
      ctx.strokeStyle = 'rgba(255,200,140,.35)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 14; i++) {
        const yy = H * .64 + i * 12;
        ctx.beginPath();
        for (let x = 0; x <= W; x += 24) ctx.lineTo(x, yy + Math.sin(x * .02 + t * 1.6 + i) * 3);
        ctx.stroke();
      }
      // 船
      for (let i = 0; i < 3; i++) {
        const sx = W * (.6 + i * .16), sy = H * .66 + i * 6;
        ctx.fillStyle = '#1a1020';
        poly(ctx, [[sx - 40, sy], [sx + 40, sy], [sx + 28, sy + 16], [sx - 28, sy + 16]]); ctx.fill();
        ctx.fillRect(sx - 2, sy - 60, 4, 60);
        ctx.fillStyle = '#d8d0e8';
        poly(ctx, [[sx + 2, sy - 58], [sx + 34, sy - 20], [sx + 2, sy - 20]]); ctx.fill();
      }
      // 栈桥
      ctx.fillStyle = '#3a2618';
      ctx.fillRect(0, H * .82, W * .55, 14);
      for (let i = 0; i < 9; i++) ctx.fillRect(i * 62 - 5, H * .82, 10, 60);
      // 建筑剪影
      for (let i = 0; i < 7; i++) {
        const bx = i * 150 - 20;
        const hh = 90 + (i % 4) * 46;
        ctx.fillStyle = '#120a18';
        ctx.fillRect(bx, H * .62 - hh, 120, hh + 40);
        ctx.fillStyle = 'rgba(255,190,110,.85)';
        for (let w = 0; w < 4; w++) ctx.fillRect(bx + 12 + w * 28, H * .62 - hh + 20, 14, 16);
      }
      break;
    }

    default: {
      skyGradient(ctx, W, H, [[0, '#0a0a1e'], [1, '#1a1030']]);
    }
  }
  ctx.restore();
}

/* ============================================================
   武器
   ============================================================ */
function weapon(ctx, type, hx, hy, ang, s, glowCol) {
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(ang);
  ctx.scale(s, s);
  const L = type === 'staff' ? 96 : type === 'spear' ? 120 : type === 'bow' ? 62 : 76;
  // 柄
  if (type !== 'bow') {
    ctx.fillStyle = '#3a2a1e';
    ctx.fillRect(-4, -L, 8, L + 14);
  }
  switch (type) {
    case 'sword': case 'twin': case 'katana': {
      ctx.fillStyle = '#2a2a3a';
      ctx.fillRect(-10, -10, 20, 12);
      const g = ctx.createLinearGradient(-6, -L, 6, -L);
      g.addColorStop(0, '#f8fbff'); g.addColorStop(.5, glowCol || '#cfe0ff'); g.addColorStop(1, '#8fa0c8');
      ctx.fillStyle = g;
      poly(ctx, [[-6, -8], [6, -8], [5, -L], [0, -L - 14], [-5, -L]]); ctx.fill();
      ctx.strokeStyle = 'rgba(30,20,40,.85)'; ctx.lineWidth = 1.6; ctx.stroke();
      if (glowCol) {
        ctx.shadowColor = glowCol; ctx.shadowBlur = 18;
        ctx.strokeStyle = glowCol; ctx.lineWidth = 2;
        poly(ctx, [[-6, -8], [6, -8], [5, -L], [0, -L - 14], [-5, -L]]); ctx.stroke();
      }
      break;
    }
    case 'axe': {
      ctx.fillStyle = '#6a6a78';
      poly(ctx, [[0, -L], [26, -L + 14], [30, -L + 46], [0, -L + 52]]); ctx.fill();
      poly(ctx, [[0, -L], [-26, -L + 14], [-30, -L + 46], [0, -L + 52]]); ctx.fill();
      ctx.strokeStyle = '#22222c'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#8f1226';
      ctx.fillRect(-6, -L + 52, 12, 10);
      break;
    }
    case 'spear': {
      ctx.fillStyle = '#cfe0ff';
      poly(ctx, [[0, -L - 26], [11, -L + 6], [0, -L + 22], [-11, -L + 6]]); ctx.fill();
      ctx.strokeStyle = '#2a2a3a'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = glowCol || '#8ee04a';
      ctx.fillRect(-5, -L + 14, 10, 8);
      break;
    }
    case 'staff': {
      const orb = glowCol || '#48d8ff';
      const g = ctx.createRadialGradient(0, -L - 10, 2, 0, -L - 10, 26);
      g.addColorStop(0, '#ffffff'); g.addColorStop(.35, orb); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, -L - 10, 26, 0, TAU); ctx.fill();
      ctx.fillStyle = orb;
      ctx.beginPath(); ctx.arc(0, -L - 10, 11, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#e8d8a8'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, -L - 10, 15, 0, TAU); ctx.stroke();
      ctx.fillStyle = '#e8d8a8';
      poly(ctx, [[-11, -L + 4], [11, -L + 4], [0, -L - 2]]); ctx.fill();
      break;
    }
    case 'bow': {
      ctx.strokeStyle = '#7a5a34'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(0, -L * .5, L * .62, -1.15, 1.15); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(-1.15) * L * .62, -L * .5 + Math.sin(-1.15) * L * .62);
      ctx.lineTo(Math.cos(1.15) * L * .62, -L * .5 + Math.sin(1.15) * L * .62);
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
}

/* ============================================================
   人形精灵
   pose: idle | ready | windup | strike | hurt | dead | cast | guard | dash
   ============================================================ */
export function drawHumanoid(ctx, x, y, s, t, pose = 'idle', p = {}) {
  const pal = {
    hair: p.hair || '#2b2340', cloth: p.cloth || '#1d2a4a', trim: p.trim || '#c8332f',
    skin: p.skin || '#ffe0c8', eye: p.eye || '#ff8a1a', weapon: p.weapon || 'sword',
    weaponGlow: p.weaponGlow || null, cape: p.cape || null, horns: p.horns || null,
  };
  const bob = pose === 'idle' || pose === 'ready' ? Math.sin(t * 2.2) * 2.2 * s : 0;
  let lean = 0, offX = 0, offY = 0, bodyRot = 0, armSwing = 0, flash = 0;
  if (p.attackP != null) {
    const ap = p.attackP;
    if (ap < 0.3) { lean = -0.22; armSwing = -1.1; offX = -4 * s; }
    else if (ap < 0.55) { const k = (ap - 0.3) / 0.25; lean = -0.22 + k * 0.5; armSwing = -1.1 + k * 3.0; offX = -4 * s + k * 26 * s; }
    else { const k = (ap - 0.55) / 0.45; lean = 0.28 * (1 - k); armSwing = 1.9 * (1 - k); offX = 22 * s * (1 - k); }
  }
  if (pose === 'windup') { lean = -0.24; armSwing = -1.2; }
  if (pose === 'strike') { lean = 0.3; armSwing = 2.0; offX = 24 * s; }
  if (pose === 'dash') { lean = 0.4; offX = 18 * s; }
  if (pose === 'cast') { lean = -0.08; armSwing = -0.6; offY = -Math.sin(t * 6) * 3 * s; }
  if (pose === 'guard') { lean = -0.16; armSwing = -0.5; }
  if (pose === 'hurt') { lean = -0.34; offX = -12 * s; offY = 3 * s; flash = 1; }
  if (p.hurtP != null) flash = Math.max(0, 1 - p.hurtP * 3);
  if (pose === 'dead') { bodyRot = -1.35; offY = 6 * s; }

  ctx.save();
  ctx.translate(x + offX, y + offY + bob);
  if (pose === 'dead') { ctx.translate(0, 6 * s); }
  ctx.scale(s, s);
  ctx.rotate(bodyRot * 0.5);
  ctx.lineJoin = 'round';

  const OUT = 'rgba(20,10,28,.9)';
  const put = (path, fill, stroke = OUT, lw = 2) => {
    ctx.beginPath(); path(); ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  };

  /* 影子 */
  ctx.fillStyle = 'rgba(0,0,0,.34)';
  ell(ctx, 0, 2, 34, 9); ctx.fill();

  /* 腿 */
  put(() => rrect(ctx, -20, -56, 15, 58, 6), '#232338');
  put(() => rrect(ctx, 5, -56, 15, 58, 6), '#1b1b2c');
  put(() => rrect(ctx, -23, -4, 22, 9, 4), '#141420');
  put(() => rrect(ctx, 2, -4, 22, 9, 4), '#141420');

  /* 后手 */
  ctx.save();
  ctx.translate(-17, -96); ctx.rotate(-0.35 - armSwing * 0.35);
  put(() => rrect(ctx, -6, 0, 11, 44, 5), pal.cloth);
  ctx.restore();

  /* 躯干 */
  if (pal.cape) {
    ctx.save();
    ctx.translate(0, -118);
    const flow = Math.sin(t * 2.1) * 6;
    put(() => poly(ctx, [[-20, 0], [20, 0], [40 + flow, 96], [12 + flow, 104], [0, 60], [-14 + flow, 104], [-40 + flow, 96]]), pal.cape);
    ctx.restore();
  }
  ctx.save();
  ctx.rotate(lean);
  put(() => poly(ctx, [[-24, -58], [24, -58], [29, -118], [-29, -118]]), pal.cloth, OUT, 2.4);
  // 衣领/纹样
  put(() => poly(ctx, [[-14, -118], [0, -92], [14, -118], [8, -122], [0, -108], [-8, -122]]), pal.trim, null);
  // 腰带
  put(() => rrect(ctx, -26, -62, 52, 10, 3), pal.trim, null);
  // 胸甲纹
  ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-18, -108); ctx.lineTo(-6, -74); ctx.moveTo(18, -108); ctx.lineTo(6, -74); ctx.stroke();

  /* 前手 + 武器 */
  ctx.save();
  ctx.translate(15, -108);
  ctx.rotate(-0.5 + armSwing);
  put(() => rrect(ctx, -5, -2, 11, 42, 5), pal.skin);
  const hx = 3, hy = 38;
  weapon(ctx, pal.weapon, hx, hy, -0.35 + (pose === 'windup' ? -0.5 : 0) + (pose === 'strike' ? 0.9 : 0), 1, pal.weaponGlow);
  ctx.restore();
  ctx.restore(); // torso

  /* 头 */
  ctx.save();
  ctx.translate(0, -118);
  ctx.rotate(lean * 0.55);
  // 脖子
  put(() => rrect(ctx, -8, -6, 16, 12, 4), '#e8b79b', null);
  // 脸
  put(() => { ctx.beginPath(); ctx.ellipse(0, -20, 21, 24, 0, 0, TAU); }, pal.skin, OUT, 2.2);
  // 头发（后）
  put(() => { ctx.beginPath(); ctx.ellipse(0, -26, 25, 27, 0, Math.PI, TAU); }, pal.hair, OUT, 2.2);
  // 眼睛
  const eyeH = (pose === 'hurt' || pose === 'dead') ? 1.1 : (pose === 'strike' ? 3.4 : 4.2);
  for (const k of [-1, 1]) {
    ctx.fillStyle = '#fff';
    ell(ctx, k * 8.5, -18, 5.6, eyeH + 1.6); ctx.fill();
    ctx.fillStyle = pal.eye;
    ell(ctx, k * 8.5, -18, 3.4, eyeH); ctx.fill();
    ctx.fillStyle = '#160c1c';
    ell(ctx, k * 8.5, -18, 1.6, Math.max(1, eyeH * .6)); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ell(ctx, k * 8.5 - 1.4, -19.6, 1.3, 1.5); ctx.fill();
  }
  // 眉
  ctx.strokeStyle = 'rgba(30,18,40,.9)'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-13, -25); ctx.lineTo(-4, (pose === 'strike' || pose === 'hurt' || pose === 'dead') ? -22 : -23.5);
  ctx.moveTo(13, -25); ctx.lineTo(4, (pose === 'strike' || pose === 'hurt' || pose === 'dead') ? -22 : -23.5);
  ctx.stroke();
  // 嘴
  ctx.strokeStyle = 'rgba(30,18,40,.85)'; ctx.lineWidth = 1.8;
  ctx.beginPath();
  if (pose === 'strike' || pose === 'hurt') { ell(ctx, 0, -8, 4.4, 3.4); ctx.fillStyle = '#7a1a28'; ctx.fill(); ctx.stroke(); }
  else { ctx.moveTo(-3.5, -8.5); ctx.lineTo(3.5, -8.5); ctx.stroke(); }
  // 前发
  put(() => poly(ctx, [[-23, -26], [-19, -40], [-9, -30], [-2, -42], [6, -30], [16, -41], [23, -25], [20, -30], [0, -34], [-20, -30]]), pal.hair, OUT, 2);
  if (pal.horns) {
    for (const k of [-1, 1]) {
      put(() => poly(ctx, [[k * 14, -40], [k * 26, -62], [k * 20, -38]]), pal.horns, OUT, 1.6);
    }
  }
  ctx.restore();

  /* 受击白光 */
  if (flash > 0.02) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = flash * 0.8;
    ctx.fillStyle = '#fff';
    ell(ctx, 0, -80, 34, 78); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}

/* ============================================================
   魔兽（四足）
   ============================================================ */
export function drawWolf(ctx, x, y, s, t, pose, p = {}) {
  const pal = { body: p.body || '#2a1a3a', trim: p.trim || '#8f1226', eye: p.eye || '#ff6a1a', fang: p.fang || '#fff2e0' };
  let offX = 0, lean = 0, flash = 0;
  if (p.attackP != null) {
    const ap = p.attackP;
    if (ap < 0.35) { offX = -14 * s; lean = -0.2; }
    else if (ap < 0.6) { const k = (ap - .35) / .25; offX = (-14 + k * 74) * s; lean = -0.2 + k * .5; }
    else { const k = (ap - .6) / .4; offX = 60 * s * (1 - k); lean = 0.3 * (1 - k); }
  }
  if (pose === 'hurt') { offX = -10 * s; flash = 1; }
  if (p.hurtP != null) flash = Math.max(0, 1 - p.hurtP * 3);
  if (pose === 'dead') { lean = 0.5; ctx.save(); ctx.translate(0, 10 * s); }

  ctx.save();
  ctx.translate(x + offX, y);
  ctx.scale(s, s);
  ctx.lineJoin = 'round';
  const OUT = 'rgba(18,8,22,.9)';
  ctx.fillStyle = 'rgba(0,0,0,.32)'; ell(ctx, 0, 2, 52, 10); ctx.fill();

  const breathe = Math.sin(t * 3.4) * 1.6;
  // 腿
  ctx.strokeStyle = pal.body; ctx.lineWidth = 9; ctx.lineCap = 'round';
  const legs = [[-34, -34, -38], [-26, -34, -22], [26, -34, 22], [36, -34, 40]];
  for (const [lx, ly, ex] of legs) {
    const sw = pose === 'idle' ? Math.sin(t * 3.4 + lx) * 3 : 0;
    ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(ex + sw, -2); ctx.stroke();
  }
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4;
  for (const [lx, ly, ex] of legs) { ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(ex, -2); ctx.stroke(); }
  // 身体
  ctx.save();
  ctx.rotate(lean * 0.4);
  ctx.beginPath();
  ctx.ellipse(0, -48 + breathe * 0.4, 46, 22, 0, 0, TAU);
  ctx.fillStyle = pal.body; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2.4; ctx.stroke();
  // 背刺
  ctx.fillStyle = pal.trim;
  for (let i = -2; i <= 2; i++) {
    poly(ctx, [[i * 15 - 5, -66], [i * 15, -84], [i * 15 + 5, -66]]); ctx.fill();
  }
  // 尾巴
  ctx.strokeStyle = pal.body; ctx.lineWidth = 10; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-44, -52);
  ctx.quadraticCurveTo(-74, -58 + Math.sin(t * 3) * 8, -92, -78 + Math.sin(t * 3) * 10);
  ctx.stroke();
  // 头
  ctx.save();
  ctx.translate(44, -52);
  ctx.rotate(-0.15 + lean);
  ctx.beginPath(); ctx.ellipse(0, 0, 24, 20, 0, 0, TAU);
  ctx.fillStyle = pal.body; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2.4; ctx.stroke();
  // 口鼻
  ctx.beginPath(); ctx.ellipse(20, 6, 14, 10, 0, 0, TAU);
  ctx.fill(); ctx.stroke();
  // 耳
  ctx.fillStyle = pal.body;
  poly(ctx, [[-10, -16], [-20, -38], [2, -20]]); ctx.fill(); ctx.stroke();
  poly(ctx, [[10, -16], [20, -36], [-2, -20]]); ctx.fill(); ctx.stroke();
  // 眼
  const glow = ctx.createRadialGradient(6, -4, 0, 6, -4, 10);
  glow.addColorStop(0, pal.eye); glow.addColorStop(1, 'rgba(255,60,0,0)');
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(6, -4, 10, 0, TAU); ctx.fill();
  ctx.fillStyle = pal.eye; ell(ctx, 6, -4, 3.4, 2.6); ctx.fill();
  ctx.fillStyle = '#14060a'; ell(ctx, 6, -4, 1.2, 2.2); ctx.fill();
  // 牙
  if (pose === 'strike' || pose === 'hurt') {
    ctx.fillStyle = pal.fang;
    for (let i = 0; i < 3; i++) { poly(ctx, [[14 + i * 7, 10], [17 + i * 7, 20], [20 + i * 7, 10]]); ctx.fill(); }
  }
  ctx.restore();
  ctx.restore();

  if (flash > .02) {
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = flash * .75;
    ctx.fillStyle = '#fff'; ell(ctx, 0, -50, 60, 40); ctx.fill();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
  if (pose === 'dead') ctx.restore();
}

/* ============================================================
   魔物（巨大兽形）
   ============================================================ */
export function drawDemon(ctx, x, y, s, t, pose, p = {}) {
  const pal = { body: p.body || '#2a0c14', trim: p.trim || '#c8a04a', eye: p.eye || '#ff6a1a' };
  let offX = 0, flash = 0, atkR = 0;
  if (p.attackP != null) {
    const ap = p.attackP;
    if (ap < .4) { atkR = -0.7; offX = -8 * s; }
    else if (ap < .62) { const k = (ap - .4) / .22; atkR = -0.7 + k * 2.1; offX = (-8 + k * 40) * s; }
    else { const k = (ap - .62) / .38; atkR = 1.4 * (1 - k); offX = 32 * s * (1 - k); }
  }
  if (pose === 'hurt') { offX = -8 * s; flash = 1; }
  if (p.hurtP != null) flash = Math.max(0, 1 - p.hurtP * 3);

  ctx.save();
  ctx.translate(x + offX, y);
  ctx.scale(s, s);
  ctx.lineJoin = 'round';
  const OUT = 'rgba(10,4,12,.92)';
  ctx.fillStyle = 'rgba(0,0,0,.36)'; ell(ctx, 0, 2, 58, 12); ctx.fill();

  const breathe = Math.sin(t * 2.1) * 3;
  // 腿
  ctx.fillStyle = pal.body;
  for (const k of [-1, 1]) {
    rrect(ctx, k * 24 - 14, -66, 28, 68, 10); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2.6; ctx.stroke();
    rrect(ctx, k * 30 - 18, -4, 36, 10, 4); ctx.fill();
  }
  // 躯干
  ctx.save();
  ctx.rotate(atkR * 0.18);
  ctx.beginPath();
  ctx.moveTo(-40, -60); ctx.quadraticCurveTo(-52, -140, -20, -168);
  ctx.quadraticCurveTo(0, -186 + breathe, 20, -168);
  ctx.quadraticCurveTo(52, -140, 40, -60);
  ctx.closePath();
  ctx.fillStyle = pal.body; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
  // 胸甲纹
  ctx.fillStyle = pal.trim;
  ctx.beginPath();
  ctx.moveTo(-26, -150); ctx.lineTo(0, -180); ctx.lineTo(26, -150); ctx.lineTo(0, -128);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = pal.eye; ell(ctx, 0, -154, 5, 5); ctx.fill();
  // 肩甲
  for (const k of [-1, 1]) {
    ctx.fillStyle = pal.trim;
    ell(ctx, k * 44, -146 + breathe * .5, 17, 13, k * .4); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2.4; ctx.stroke();
    // 尖刺
    ctx.fillStyle = pal.body;
    poly(ctx, [[k * 52, -156], [k * 74, -184], [k * 46, -166]]); ctx.fill(); ctx.stroke();
  }
  // 手臂
  ctx.strokeStyle = pal.body; ctx.lineWidth = 17; ctx.lineCap = 'round';
  for (const k of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(k * 44, -142);
    ctx.quadraticCurveTo(k * 66, (-100 + atkR * k * 30), k * (58 + atkR * k * 10), -48 + (k > 0 ? -atkR * 26 : 0));
    ctx.stroke();
    ctx.fillStyle = '#3a1a22';
    ctx.beginPath(); ctx.arc(k * (58 + atkR * k * 10), -48 + (k > 0 ? -atkR * 26 : 0), 11, 0, TAU); ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = 2.2; ctx.stroke();
  }
  // 头
  ctx.save();
  ctx.translate(0, -182 + breathe);
  ctx.beginPath(); ctx.ellipse(0, 0, 25, 23, 0, 0, TAU);
  ctx.fillStyle = pal.body; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2.8; ctx.stroke();
  // 角
  for (const k of [-1, 1]) {
    ctx.fillStyle = pal.trim;
    poly(ctx, [[k * 15, -18], [k * 40, -48], [k * 26, -12]]); ctx.fill(); ctx.stroke();
  }
  // 眼
  for (const k of [-1, 1]) {
    const g = ctx.createRadialGradient(k * 9, -2, 0, k * 9, -2, 12);
    g.addColorStop(0, pal.eye); g.addColorStop(1, 'rgba(255,60,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(k * 9, -2, 12, 0, TAU); ctx.fill();
    ctx.fillStyle = pal.eye; ell(ctx, k * 9, -2, 4.4, 3); ctx.fill();
    ctx.fillStyle = '#1a0208'; ell(ctx, k * 9, -2, 1.5, 2.8); ctx.fill();
  }
  // 獠牙
  ctx.fillStyle = '#fff0d8';
  for (let i = -2; i <= 2; i++) poly(ctx, [[i * 4.5, 14], [i * 4.5 + 2.4, 26], [i * 4.5 + 5, 14]]), ctx.fill();
  ctx.restore();
  ctx.restore();

  if (flash > .02) {
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = flash * .7;
    ctx.fillStyle = '#fff'; ell(ctx, 0, -100, 66, 100); ctx.fill();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}

/* ============================================================
   魔王
   ============================================================ */
export function drawKing(ctx, x, y, s, t, pose, p = {}) {
  const pal = { body: p.body || '#14060e', trim: p.trim || '#c8a04a', eye: p.eye || '#ff2a3c', cape: p.cape || '#5a0a18' };
  let offX = 0, flash = 0, armR = 0;
  if (p.attackP != null) {
    const ap = p.attackP;
    if (ap < .45) { armR = -1.4; }
    else if (ap < .65) { const k = (ap - .45) / .2; armR = -1.4 + k * 3.2; }
    else { const k = (ap - .65) / .35; armR = 1.8 * (1 - k); }
  }
  if (pose === 'hurt') { offX = -6 * s; flash = 1; }
  if (p.hurtP != null) flash = Math.max(0, 1 - p.hurtP * 3);

  const float = Math.sin(t * 1.6) * 6;
  ctx.save();
  ctx.translate(x + offX, y + float * s * .3);
  ctx.scale(s, s);
  ctx.lineJoin = 'round';
  const OUT = 'rgba(8,2,10,.95)';
  ctx.fillStyle = 'rgba(0,0,0,.4)'; ell(ctx, 0, 2, 46, 10); ctx.fill();

  // 披风
  ctx.save();
  ctx.translate(0, -150);
  const flow = Math.sin(t * 1.9) * 8;
  ctx.beginPath();
  ctx.moveTo(-26, 0);
  ctx.quadraticCurveTo(-90 - flow, 70, -66 - flow * 1.6, 160);
  ctx.lineTo(-20 + flow, 168);
  ctx.lineTo(20 + flow, 168);
  ctx.quadraticCurveTo(90 + flow, 70, 26, 0);
  ctx.closePath();
  const cg = ctx.createLinearGradient(0, 0, 0, 168);
  cg.addColorStop(0, pal.cape); cg.addColorStop(1, '#1a0208');
  ctx.fillStyle = cg; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
  ctx.restore();

  // 腿（长袍）
  ctx.beginPath();
  ctx.moveTo(-26, -110); ctx.lineTo(26, -110); ctx.lineTo(36, 0); ctx.lineTo(-36, 0);
  ctx.closePath();
  ctx.fillStyle = pal.body; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = pal.trim;
  ctx.beginPath(); ctx.moveTo(-26, -110); ctx.lineTo(26, -110); ctx.lineTo(24, -96); ctx.lineTo(-24, -96); ctx.closePath(); ctx.fill();
  // 符文
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = `rgba(255,${80 + i * 40},60,${.4 + .3 * Math.abs(Math.sin(t * 2 + i))})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, -60 + i * 20, 12 - i * 2, 0, TAU); ctx.stroke();
  }

  // 躯干
  ctx.beginPath();
  ctx.moveTo(-28, -116); ctx.lineTo(28, -116); ctx.lineTo(34, -196); ctx.lineTo(-34, -196);
  ctx.closePath();
  ctx.fillStyle = pal.body; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
  // 胸甲
  ctx.fillStyle = pal.trim;
  ctx.beginPath(); ctx.moveTo(-24, -186); ctx.lineTo(0, -212); ctx.lineTo(24, -186); ctx.lineTo(0, -164); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
  const core = ctx.createRadialGradient(0, -186, 1, 0, -186, 16);
  core.addColorStop(0, '#fff'); core.addColorStop(.4, pal.eye); core.addColorStop(1, 'rgba(255,40,60,0)');
  ctx.fillStyle = core; ctx.beginPath(); ctx.arc(0, -186, 16, 0, TAU); ctx.fill();

  // 肩
  for (const k of [-1, 1]) {
    ctx.fillStyle = pal.body;
    ctx.beginPath(); ctx.ellipse(k * 42, -190, 20, 15, k * .35, 0, TAU); ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = 2.6; ctx.stroke();
    ctx.fillStyle = pal.trim;
    poly(ctx, [[k * 46, -202], [k * 76, -238], [k * 40, -212]]); ctx.fill(); ctx.stroke();
  }
  // 手臂
  for (const k of [-1, 1]) {
    const swing = k > 0 ? armR : armR * 0.4;
    ctx.save();
    ctx.translate(k * 44, -186);
    ctx.rotate(swing * k * 0.5);
    ctx.strokeStyle = pal.body; ctx.lineWidth = 15; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(k * 12, 66); ctx.stroke();
    ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#2a0810';
    ctx.beginPath(); ctx.arc(k * 12, 68, 10, 0, TAU); ctx.fill(); ctx.stroke();
    if (k > 0) {
      // 魔剑
      ctx.save();
      ctx.translate(k * 12, 68);
      ctx.rotate(0.5 - armR * 0.7);
      ctx.fillStyle = '#2a2a3a'; ctx.fillRect(-7, -12, 14, 14);
      const bg = ctx.createLinearGradient(-7, -120, 7, -120);
      bg.addColorStop(0, '#ff9a9a'); bg.addColorStop(.5, '#6a1030'); bg.addColorStop(1, '#1a0208');
      ctx.fillStyle = bg;
      poly(ctx, [[-7, -12], [7, -12], [5, -118], [0, -136], [-5, -118]]); ctx.fill();
      ctx.strokeStyle = pal.eye; ctx.lineWidth = 2;
      ctx.shadowColor = pal.eye; ctx.shadowBlur = 14;
      poly(ctx, [[-7, -12], [7, -12], [5, -118], [0, -136], [-5, -118]]); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();
    }
    ctx.restore();
  }

  // 头
  ctx.save();
  ctx.translate(0, -206);
  // 兜帽/王冠
  ctx.fillStyle = pal.body;
  ctx.beginPath(); ctx.ellipse(0, -6, 24, 22, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 2.6; ctx.stroke();
  ctx.fillStyle = pal.trim;
  poly(ctx, [[-22, -18], [-24, -40], [-10, -24], [0, -46], [10, -24], [24, -40], [22, -18]]); ctx.fill(); ctx.stroke();
  // 面部阴影
  ctx.fillStyle = '#08030c';
  ctx.beginPath(); ctx.ellipse(0, -2, 19, 17, 0, 0, TAU); ctx.fill();
  // 眼
  for (const k of [-1, 1]) {
    const g = ctx.createRadialGradient(k * 9, -2, 0, k * 9, -2, 14);
    g.addColorStop(0, '#fff'); g.addColorStop(.3, pal.eye); g.addColorStop(1, 'rgba(255,20,40,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(k * 9, -2, 14, 0, TAU); ctx.fill();
    ctx.fillStyle = pal.eye; ell(ctx, k * 9, -2, 4.6, (pose === 'strike' ? 2.4 : 3.6)); ctx.fill();
  }
  ctx.restore();

  // 环绕魔球
  for (let i = 0; i < 4; i++) {
    const a = t * 1.3 + i * TAU / 4;
    const ox = Math.cos(a) * 92, oy = -140 + Math.sin(a) * 34;
    const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, 16);
    g.addColorStop(0, '#fff'); g.addColorStop(.35, pal.eye); g.addColorStop(1, 'rgba(200,0,40,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ox, oy, 16, 0, TAU); ctx.fill();
  }

  if (flash > .02) {
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = flash * .75;
    ctx.fillStyle = '#fff'; ell(ctx, 0, -120, 60, 120); ctx.fill();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}

/* ============================================================
   怪物图片（可选，优先于代码画的）
   ============================================================
   和立绘一个套路：把图片丢进 art/monsters/，文件名 = 敌人 id，
   清单由 node tools/gen-art.mjs 生成。读不到就静默退回 sprites.js 画的那只。

   图片按「脚底中心」对齐，和 drawWolf / drawHumanoid 的锚点一致，
   所以换成图片之后站位、缩放、血条位置都不用改。 */
let MONSTER_ART = {};
const MIMG = new Map();            // id → HTMLImageElement（loaded 之后才画）

export function setMonsterArt(m) { MONSTER_ART = m || {}; MIMG.clear(); }
export async function loadMonsterArt(url = 'art/monsters/manifest.json') {
  try {
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) return false;
    setMonsterArt(await r.json());
    return Object.keys(MONSTER_ART).length > 0;
  } catch (e) { return false; }
}

function monsterImage(id) {
  const src = MONSTER_ART[id];
  if (!src) return null;
  let im = MIMG.get(id);
  if (im === undefined) {
    im = new Image();
    im.src = src;
    MIMG.set(id, im);
  }
  return im.complete && im.naturalWidth ? im : null;   // 没加载完这一帧先用代码画的
}

/* 图片版怪物：底边贴脚底，宽度按 s 缩放；
   受击闪白、攻击前冲这些节拍沿用代码版的处理，换图之后手感不变。 */
function drawMonsterImage(ctx, im, x, y, s, t, pose, p) {
  const H = 240 * s;                                   // 和代码画的怪物取同一量级
  const W = H * (im.naturalWidth / im.naturalHeight);
  const atk = (p && p.attackP) || 0;
  const hurt = (p && p.hurtP) || 0;
  const bob = pose === 'dead' ? 0 : Math.sin(t * 2.2) * 3 * s;
  ctx.save();
  ctx.translate(x - atk * 26 * s, y + bob);
  if (pose === 'dead') { ctx.rotate(-0.42); ctx.globalAlpha *= 0.9; }
  else if (hurt > 0.02) ctx.translate(Math.sin(hurt * 40) * 5 * s, 0);
  ctx.drawImage(im, -W / 2, -H, W, H);
  if (hurt > 0.02) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = hurt * 0.55;
    ctx.drawImage(im, -W / 2, -H, W, H);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}

export function drawEnemy(ctx, kind, def, x, y, s, t, pose, p) {
  const pal = def.palette || {};
  const im = def.id ? monsterImage(def.id) : null;
  if (im) return drawMonsterImage(ctx, im, x, y, s, t, pose, p);
  if (kind === 'wolf') return drawWolf(ctx, x, y, s, t, pose, { ...pal, attackP: p && p.attackP, hurtP: p && p.hurtP });
  if (kind === 'demon') return drawDemon(ctx, x, y, s, t, pose, { ...pal, attackP: p && p.attackP, hurtP: p && p.hurtP });
  if (kind === 'king') return drawKing(ctx, x, y, s, t, pose, { ...pal, attackP: p && p.attackP, hurtP: p && p.hurtP });
  return drawHumanoid(ctx, x, y, s, t, pose, { ...pal, attackP: p && p.attackP, hurtP: p && p.hurtP });
}

/* ============================================================
   特效
   ============================================================ */
export function drawSlash(ctx, x, y, r, k, ang, col = '#ffffff') {
  // k: 0→1 进度
  if (k < 0 || k > 1) return;
  const a = 1 - k;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.globalCompositeOperation = 'lighter';
  const sweep = 1.5 + k * 2.2;
  ctx.beginPath();
  ctx.arc(0, 0, r * (0.7 + k * 0.6), -sweep / 2, sweep / 2);
  ctx.strokeStyle = col;
  ctx.globalAlpha = a;
  ctx.lineWidth = 26 * (1 - k * .6);
  ctx.lineCap = 'round';
  ctx.shadowColor = col; ctx.shadowBlur = 26;
  ctx.stroke();
  ctx.lineWidth = 9 * (1 - k * .5);
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.restore();
}

export function drawBurst(ctx, x, y, r, k, col = '#ff8a1a', n = 12) {
  if (k < 0 || k > 1) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 1 - k;
  const R = r * (0.3 + k * 1.6);
  // 中心光球
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
  g.addColorStop(0, '#fff');
  g.addColorStop(.25, col);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
  // 尖刺
  ctx.strokeStyle = col; ctx.lineWidth = 5 * (1 - k);
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU + k * 0.7;
    const r1 = R * .35, r2 = R * (1.05 + (i % 3) * .2);
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
    ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawHeal(ctx, x, y, k, col = '#7dffa8') {
  if (k < 0 || k > 1) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.sin(k * Math.PI);
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * TAU + k * 3;
    const rr = 40 + (i % 3) * 18;
    const px = Math.cos(a) * rr, py = Math.sin(a) * rr * .6 - k * 90;
    ctx.fillStyle = col;
    ctx.shadowColor = col; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(px, py, 3.4, 0, TAU); ctx.fill();
  }
  const g = ctx.createRadialGradient(0, -30, 0, 0, -30, 80);
  g.addColorStop(0, 'rgba(180,255,210,.65)'); g.addColorStop(1, 'rgba(60,255,150,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -30, 80, 0, TAU); ctx.fill();
  ctx.restore();
}

export function drawThunder(ctx, x, y, k, col = '#ffe14d') {
  if (k < 0 || k > 1) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 1 - k;
  ctx.strokeStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 24;
  for (let b = 0; b < 3; b++) {
    ctx.lineWidth = 7 - b * 2;
    ctx.beginPath();
    let px = x + (b - 1) * 16, py = 0;
    ctx.moveTo(px, py);
    while (py < y - 20) {
      py += 26 + Math.random() * 18;
      px += (Math.random() - .5) * 42;
      ctx.lineTo(px, py);
    }
    ctx.lineTo(x, y);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawMeteor(ctx, x, y, k, col = '#ff6a1a', W = 960, H = 540) {
  if (k < 0 || k > 1) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // 下落轨迹
  const px = x + (1 - k) * 620, py = y - (1 - k) * 460;
  ctx.globalAlpha = 1 - k * .5;
  const g = ctx.createRadialGradient(px, py, 0, px, py, 90);
  g.addColorStop(0, '#fff'); g.addColorStop(.25, col); g.addColorStop(1, 'rgba(120,0,0,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, 90, 0, TAU); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 12 * (1 - k);
  ctx.beginPath(); ctx.moveTo(px + 90, py - 70); ctx.lineTo(px, py); ctx.stroke();
  // 爆发
  if (k > .7) drawBurst(ctx, x, y, 130, (k - .7) / .3, col, 16);
  ctx.restore();
}

export function drawIce(ctx, x, y, k, col = '#8fe6ff') {
  if (k < 0 || k > 1) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.sin(k * Math.PI) * .95;
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * TAU + k * 2;
    const L = 40 + 70 * Math.sin(k * Math.PI);
    ctx.save();
    ctx.rotate(a);
    ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 18;
    poly(ctx, [[0, -L], [10, 0], [0, L], [-10, 0]]); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

export function drawGuardSpark(ctx, x, y, k, perfect) {
  if (k < 0 || k > 1) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 1 - k;
  ctx.translate(x, y);
  const col = perfect ? '#fff6c0' : '#8fd8ff';
  ctx.strokeStyle = col; ctx.lineWidth = 5 * (1 - k);
  ctx.shadowColor = col; ctx.shadowBlur = 22;
  const R = 26 + k * 50;
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * R * .55, Math.sin(a) * R * .55);
    ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R);
    ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(0, 0, R * .7, 0, TAU); ctx.stroke();
  ctx.restore();
}

/* 数字飘字 */
export function drawFloatText(ctx, txt, x, y, k, col, size = 34, crit = false) {
  if (k < 0 || k > 1) return;
  ctx.save();
  const pop = k < .18 ? 0.4 + (k / .18) * 0.85 : 1.25 - (k - .18) * .25;
  ctx.translate(x, y - k * 78);
  ctx.scale(pop, pop);
  ctx.globalAlpha = k > .72 ? 1 - (k - .72) / .28 : 1;
  ctx.font = `900 ${size}px "Noto Sans SC",system-ui,sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(20,4,10,.95)';
  ctx.strokeText(txt, 0, 0);
  if (crit) { ctx.shadowColor = col; ctx.shadowBlur = 22; }
  ctx.fillStyle = col;
  ctx.fillText(txt, 0, 0);
  ctx.restore();
}

/* 屏幕空间：速度线 */
export function drawSpeedLines(ctx, W, H, t, alpha = .5, cx = W / 2, cy = H / 2) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = '#fff';
  for (let i = 0; i < 34; i++) {
    const a = (i / 34) * TAU + t * .6;
    const r1 = 300 + (i % 5) * 40;
    const r2 = r1 + 240 + (i % 3) * 120;
    ctx.lineWidth = 1 + (i % 3);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1 * .62);
    ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2 * .62);
    ctx.stroke();
  }
  ctx.restore();
}

/* 集中线（漫画式） */
export function drawFocusLines(ctx, W, H, t, alpha = .6, cx = W / 2, cy = H / 2) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#0a0410';
  const n = 40;
  for (let i = 0; i < n; i++) {
    if (i % 2) continue;
    const a1 = (i / n) * TAU, a2 = ((i + 1) / n) * TAU;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a1) * 900, cy + Math.sin(a1) * 900);
    ctx.lineTo(cx + Math.cos(a2) * 900, cy + Math.sin(a2) * 900);
    ctx.lineTo(cx + Math.cos(a2) * 210, cy + Math.sin(a2) * 210);
    ctx.lineTo(cx + Math.cos(a1) * 210, cy + Math.sin(a1) * 210);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

export const util = { clamp, ell, rrect, poly };
export default { drawBackground, drawHumanoid, drawWolf, drawDemon, drawKing, drawEnemy, setMonsterArt, loadMonsterArt, drawSlash, drawBurst, drawHeal, drawThunder, drawIce, drawMeteor, drawGuardSpark, drawFloatText, drawSpeedLines, drawFocusLines, util };
