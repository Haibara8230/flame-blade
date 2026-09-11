/* ============================================================
   portraits.js — 程序化立绘

   此前六个角色共用同一个 face()，五官坐标全部写死：
   同一双眼睛、同一个微笑、同一对腮红——暗影四天王和冰晶少女长得一模一样，
   而且全剧没有任何表情变化。

   现在分成三层：
     ① 骨架 —— 脸型 / 眼型 / 瞳距 / 眉粗，决定「这是谁」，建角色时定死
     ② 表情 —— expr 只改眉、眼睑、嘴三条路径，运行时随台词切换
     ③ 配色 —— 瞳色、发色、肤色、腮红

   剧本里给台词加可选的第三项即可：
     ['璃', '……笨蛋……大笨蛋……', 'cry']
   ============================================================ */

const SKIN = { base: '#ffe0c8', shade: '#e8b79b', line: '#1a1020' };

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.max(0, Math.min(255, r + amt));
  g = Math.max(0, Math.min(255, g + amt));
  b = Math.max(0, Math.min(255, b + amt));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

/* ---------------- 脸型 ----------------
   控制下颌与颧骨。round 圆润、oval 标准、sharp 尖削、square 方硬。 */
const FACE_SHAPE = {
  round: 'M150 78 C108 78 88 110 88 152 C88 204 118 250 150 256 C182 250 212 204 212 152 C212 110 192 78 150 78 Z',
  oval: 'M150 78 C112 78 92 108 92 150 C92 200 118 246 150 252 C182 246 208 200 208 150 C208 108 188 78 150 78 Z',
  sharp: 'M150 76 C114 76 94 106 94 148 C94 198 122 244 150 254 C178 244 206 198 206 148 C206 106 186 76 150 76 Z',
  square: 'M150 76 C110 76 90 108 90 150 C90 196 104 238 150 250 C196 238 210 196 210 150 C210 108 190 76 150 76 Z',
};

/* ---------------- 眼型 ----------------
   上眼睑弧线与眼白轮廓。big 大而圆、sharp 上挑、droop 下垂、narrow 细长。 */
const EYE_SHAPE = {
  big: { w: 22, h: 14, lidL: 'q22 -22 46 -4', lidR: 'q22 -18 46 4', pupil: 13 },
  sharp: { w: 22, h: 11, lidL: 'q24 -16 46 -8', lidR: 'q22 -12 46 8', pupil: 11 },
  droop: { w: 21, h: 13, lidL: 'q20 -14 44 2', lidR: 'q24 -10 44 -2', pupil: 12 },
  narrow: { w: 23, h: 9, lidL: 'q24 -10 46 -4', lidR: 'q22 -8 46 4', pupil: 9 },
};

/* ---------------- 表情差分 ----------------
   只动三样：眉的路径、眼睑开合系数、嘴的路径。
   成本极低，但这是「角色像活的」和「像证件照」之间的全部差别。 */
const EXPR = {
  normal: {
    browL: 'M112 132 q16 -11 32 -3', browR: 'M156 129 q16 -8 32 3',
    lid: 1, mouth: 'M134 205 q16 9 32 -1', mouthW: 4, blush: 0.35,
  },
  angry: {
    browL: 'M110 126 q18 6 34 8', browR: 'M156 134 q16 -2 34 -8',
    lid: 0.72, mouth: 'M132 208 q18 -10 36 2', mouthW: 5, blush: 0.2,
    extra: '<path d="M150 118 l-3 -12 M156 118 l3 -12" stroke="#c8332f" stroke-width="3" stroke-linecap="round" opacity=".8"/>',
  },
  hurt: {
    browL: 'M112 128 q16 8 32 6', browR: 'M156 134 q16 -2 32 -6',
    lid: 0.52, mouth: 'M136 206 h28', mouthW: 4, blush: 0.15,
    shadow: true,
  },
  cry: {
    browL: 'M112 128 q16 8 32 6', browR: 'M156 134 q16 -2 32 -6',
    lid: 1.05, mouth: 'M134 204 q16 14 32 0', mouthW: 4.5, blush: 0.5,
    tears: true,
  },
  shout: {
    browL: 'M110 124 q18 -8 34 -2', browR: 'M156 122 q16 -6 34 8',
    lid: 1.22, mouth: 'M132 200 q18 22 36 0 q-18 8 -36 0', mouthW: 4, blush: 0.3,
    pupilK: 0.72,
  },
  smile: {
    browL: 'M112 130 q16 -10 32 -4', browR: 'M156 128 q16 -6 32 4',
    lid: 0.62, mouth: 'M132 202 q18 14 36 -2', mouthW: 4.5, blush: 0.55,
    happyEye: true,
  },
};
export const EXPRESSIONS = Object.keys(EXPR);

/* ---------------- 五官 ---------------- */
function face(o) {
  const id = o.id;
  const ex = EXPR[o.expr] || EXPR.normal;
  const es = EYE_SHAPE[o.eyeShape] || EYE_SHAPE.big;
  const gap = o.eyeSpacing || 1;
  const lx = 150 - 19 * gap, rx = 150 + 19 * gap;   // 左右瞳心
  const lidK = ex.lid;
  const pupil = es.pupil * (ex.pupilK || 1);
  const skin = o.skin || SKIN.base;
  const skinS = shade(skin, -24);
  const brow = o.brow || '#3a2a4a';
  const bw = o.browThick || 6;
  const eyeG = `eye_${id}`;
  const shapePath = FACE_SHAPE[o.faceShape] || FACE_SHAPE.oval;

  /* 一只眼睛：眼白 + 虹膜 + 瞳孔 + 高光 + 上眼睑线 */
  const eye = (cx, lid, flip) => {
    if (ex.happyEye) {
      // 笑眼：画成弯月，不画眼白
      return `<path d="M${cx - es.w} 154 q${es.w} -16 ${es.w * 2} 0" stroke="${SKIN.line}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
    }
    const h = es.h * lidK;
    return `
      <ellipse cx="${cx}" cy="153" rx="${es.w}" ry="${h}" fill="#fff" stroke="${SKIN.line}" stroke-width="3"/>
      <ellipse cx="${cx}" cy="153" rx="${pupil}" ry="${Math.max(6, h * 0.95)}" fill="url(#${eyeG})"/>
      <circle cx="${cx}" cy="153" r="${pupil * 0.42}" fill="#120a1e"/>
      <circle cx="${cx - 4}" cy="149" r="${pupil * 0.34}" fill="#fff" opacity=".95"/>
      <path d="M${cx - es.w - 2} ${151 - h * 0.5} ${flip ? es.lidR : es.lidL}"
            stroke="${SKIN.line}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  };

  return `
  <defs>
    <radialGradient id="${eyeG}" cx="50%" cy="40%" r="70%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="38%" stop-color="${o.eye}"/>
      <stop offset="100%" stop-color="${shade(o.eye, -45)}"/>
    </radialGradient>
    <linearGradient id="skin_${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${shade(skin, 14)}"/><stop offset="100%" stop-color="${skin}"/>
    </linearGradient>
  </defs>
  <!-- 脖子 -->
  <path d="M120 232 L120 268 Q150 286 180 268 L180 232 Z" fill="${skinS}"/>
  <path d="M120 232 L120 252 Q150 268 180 252 L180 232 Z" fill="${skin}"/>
  <!-- 脸 -->
  <path d="${shapePath}" fill="url(#skin_${id})" stroke="${SKIN.line}" stroke-width="3.5"/>
  <!-- 耳 -->
  <path d="M92 146 q-11 -6 -9 12 q2 16 12 14 Z" fill="${skin}" stroke="${SKIN.line}" stroke-width="3"/>
  <path d="M208 146 q11 -6 9 12 q-2 16 -12 14 Z" fill="${skin}" stroke="${SKIN.line}" stroke-width="3"/>
  ${o.glow ? `<ellipse cx="150" cy="158" rx="66" ry="52" fill="${o.glow}" opacity=".2"/>` : ''}
  ${ex.shadow ? '<ellipse cx="150" cy="190" rx="58" ry="30" fill="#4a2a3a" opacity=".18"/>' : ''}
  <!-- 眉 -->
  <path d="${ex.browL}" stroke="${brow}" stroke-width="${bw}" fill="none" stroke-linecap="round"/>
  <path d="${ex.browR}" stroke="${brow}" stroke-width="${bw}" fill="none" stroke-linecap="round"/>
  ${ex.extra || ''}
  <!-- 眼 -->
  ${eye(lx, lidK, false)}
  ${eye(rx, lidK, true)}
  ${ex.tears ? `
    <path d="M${lx} 168 q-4 16 2 26" stroke="#8fd8ff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".9"/>
    <path d="M${rx} 168 q4 16 -2 26" stroke="#8fd8ff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".9"/>
    <circle cx="${lx - 2}" cy="196" r="4" fill="#bfe8ff"/><circle cx="${rx + 2}" cy="196" r="4" fill="#bfe8ff"/>` : ''}
  <!-- 鼻 / 嘴 -->
  <path d="M150 172 q5 9 -3 12" stroke="${skinS}" stroke-width="4" fill="none" stroke-linecap="round"/>
  <path d="${ex.mouth}" stroke="${SKIN.line}" stroke-width="${ex.mouthW}" fill="${o.expr === 'shout' ? '#8f2a3a' : 'none'}" stroke-linecap="round"/>
  <!-- 腮红 -->
  ${o.blush === null ? '' : `
    <ellipse cx="114" cy="186" rx="13" ry="7" fill="${o.blush || '#ff9aa8'}" opacity="${ex.blush}"/>
    <ellipse cx="186" cy="186" rx="13" ry="7" fill="${o.blush || '#ff9aa8'}" opacity="${ex.blush}"/>`}`;
}

function svgWrap(inner, bgFrom, bgTo) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 360" width="300" height="360">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${bgFrom}"/><stop offset="100%" stop-color="${bgTo}"/>
    </linearGradient>
    <radialGradient id="vig" cx="50%" cy="38%" r="62%">
      <stop offset="55%" stop-color="rgba(0,0,0,0)"/><stop offset="100%" stop-color="rgba(0,0,0,.72)"/>
    </radialGradient>
  </defs>
  <rect width="300" height="360" fill="url(#bg)"/>
  ${inner}
  <rect width="300" height="360" fill="url(#vig)"/>
</svg>`;
}

/* ============================================================
   角色定义
   ============================================================
   face 里的骨架参数决定「这是谁」；hair / body 是各自的外观层。
   expr 由调用方传入，同一个角色会生成六张差分。 */
const RECIPES = {
  /* ---- 队伍 ---- */
  kaito: e => svgWrap(`
    ${face({ id: 'kaito' + e, expr: e, eye: '#ff8a1a', glow: '#ff6a1a', brow: '#241a34', blush: '#ff8f8f', faceShape: 'sharp', eyeShape: 'big', browThick: 7 })}
    <path d="M150 58 C104 58 84 96 88 140 C82 128 70 100 66 118 C60 96 74 74 92 62 C74 52 96 34 116 44
             C120 24 146 18 158 34 C172 16 202 26 200 48 C224 42 244 62 234 84 C252 84 256 108 244 122
             C250 138 242 152 232 150 C238 118 220 92 200 82 C186 66 168 58 150 58 Z"
          fill="#2b2340" stroke="${SKIN.line}" stroke-width="3.5"/>
    <path d="M104 92 C120 70 150 62 176 70" stroke="#4a3f6b" stroke-width="7" fill="none" stroke-linecap="round"/>
    <path d="M96 128 C102 104 118 88 140 80" stroke="#ff9a3d" stroke-width="6" fill="none" stroke-linecap="round" opacity=".9"/>
    <path d="M92 132 q22 -34 60 -34 q38 0 58 34 q-16 -22 -38 -22 q-6 12 -22 16 q-24 6 -58 6 Z"
          fill="#342a4e" stroke="${SKIN.line}" stroke-width="3"/>
    <path d="M150 252 q-52 8 -74 34 q-12 26 -6 74 l160 0 q6 -48 -6 -74 q-22 -26 -74 -34 Z"
          fill="#1d2a4a" stroke="${SKIN.line}" stroke-width="3.5"/>
    <path d="M150 254 l-26 8 l26 60 l26 -60 Z" fill="#e8e4f2" stroke="${SKIN.line}" stroke-width="3"/>
    <path d="M124 262 q-30 14 -40 40 l16 8 q10 -24 34 -38 Z" fill="#c8332f" stroke="${SKIN.line}" stroke-width="3"/>
    <path d="M176 262 q30 14 40 40 l-16 8 q-10 -24 -34 -38 Z" fill="#c8332f" stroke="${SKIN.line}" stroke-width="3"/>
    <path d="M150 320 l-14 8 l14 32 l14 -32 Z" fill="#ffb43d" stroke="${SKIN.line}" stroke-width="2.5"/>
    <path d="M232 250 q14 60 4 108" stroke="#3a3a52" stroke-width="9" fill="none" stroke-linecap="round"/>
    <path d="M246 236 q10 56 0 110" stroke="#dfe9ff" stroke-width="7" fill="none" stroke-linecap="round"/>
  `, '#3a1c10', '#100a1e'),

  cang: e => svgWrap(`
    ${face({ id: 'cang' + e, expr: e, eye: '#57e0ff', glow: '#48d8ff', brow: '#3b2a52', blush: '#ffa8bc', faceShape: 'oval', eyeShape: 'narrow', eyeSpacing: 1.04, browThick: 5 })}
    <path d="M150 56 C104 56 86 94 88 150 C86 186 96 224 112 246 C98 210 96 168 100 140
             C78 150 74 118 88 100 C104 70 124 56 150 56 Z" fill="#7d5fd8" stroke="${SKIN.line}" stroke-width="3.5"/>
    <path d="M150 56 C196 56 214 94 212 150 C214 186 204 224 188 246 C202 210 204 168 200 140
             C222 150 226 118 212 100 C196 70 176 56 150 56 Z" fill="#7d5fd8" stroke="${SKIN.line}" stroke-width="3.5"/>
    <path d="M112 244 q-10 40 4 84 l68 0 q14 -44 4 -84 q-38 16 -76 0 Z" fill="#6a4fc0" stroke="${SKIN.line}" stroke-width="3.5"/>
    <path d="M90 132 q22 -30 60 -30 q38 0 60 30 q-18 -20 -40 -20 q-8 16 -28 18 q-28 4 -52 2 Z"
          fill="#8f74e8" stroke="${SKIN.line}" stroke-width="3"/>
    <ellipse cx="150" cy="52" rx="34" ry="16" fill="#8f74e8" stroke="${SKIN.line}" stroke-width="3"/>
    <path d="M150 252 q-44 8 -60 30 q-10 24 -4 70 l128 0 q6 -46 -4 -70 q-16 -22 -60 -30 Z"
          fill="#efeaf8" stroke="${SKIN.line}" stroke-width="3.5"/>
    <path d="M150 254 l-18 6 l18 52 l18 -52 Z" fill="#6a4fc0" stroke="${SKIN.line}" stroke-width="3"/>
    <path d="M232 240 q10 70 6 116" stroke="#8a6a3a" stroke-width="7" fill="none" stroke-linecap="round"/>
    <circle cx="234" cy="228" r="15" fill="#48d8ff" stroke="${SKIN.line}" stroke-width="3"/>
    <circle cx="234" cy="228" r="7" fill="#e8ffff"/>
  `, '#101a3a', '#080a1c'),

  lei: e => svgWrap(`
    ${face({ id: 'lei' + e, expr: e, eye: '#9be25a', glow: '#8ee04a', brow: '#3a2b22', blush: '#ff9f9f', faceShape: 'round', eyeShape: 'sharp', eyeSpacing: 0.96, browThick: 7 })}
    <path d="M150 54 C106 54 88 92 92 142 C90 168 96 196 106 214 C96 182 96 150 102 130
             C82 136 80 108 94 94 C110 68 128 54 150 54 Z" fill="#3a3a48" stroke="${SKIN.line}" stroke-width="3.5"/>
    <path d="M150 54 C194 54 212 92 208 142 C210 168 204 196 194 214 C204 182 204 150 198 130
             C218 136 220 108 206 94 C190 68 172 54 150 54 Z" fill="#3a3a48" stroke="${SKIN.line}" stroke-width="3.5"/>
    <path d="M88 140 q24 -32 62 -32 q40 0 62 32 q-20 -22 -42 -22 q-8 14 -28 16 q-30 4 -54 6 Z"
          fill="#52525f" stroke="${SKIN.line}" stroke-width="3"/>
    <path d="M150 250 q-48 8 -66 32 q-10 26 -4 72 l140 0 q6 -46 -4 -72 q-18 -24 -66 -32 Z"
          fill="#2e3a52" stroke="${SKIN.line}" stroke-width="3.5"/>
    <path d="M150 252 l-22 6 l22 46 l22 -46 Z" fill="#d8dcea" stroke="${SKIN.line}" stroke-width="3"/>
    <path d="M100 280 l-16 20 l24 10 l14 -18 Z" fill="#c8332f" stroke="${SKIN.line}" stroke-width="3"/>
    <path d="M200 280 l16 20 l-24 10 l-14 -18 Z" fill="#c8332f" stroke="${SKIN.line}" stroke-width="3"/>
    <path d="M96 302 q54 26 108 0" stroke="#8ee04a" stroke-width="5" fill="none" opacity=".9"/>
    <path d="M64 360 L196 96" stroke="#7a5a34" stroke-width="8" stroke-linecap="round"/>
    <path d="M196 96 L188 60 L216 78 L200 104 Z" fill="#e6f0ff" stroke="${SKIN.line}" stroke-width="3"/>
  `, '#141c14', '#0a0d08'),

  ryze: e => svgWrap(`
    ${face({ id: 'ryze' + e, expr: e, eye: '#c9a8ff', glow: '#8f6bff', brow: '#2a1c3a', blush: '#ff9fc0', faceShape: 'oval', eyeShape: 'droop', eyeSpacing: 1.02, browThick: 5 })}
    <path d="M150 56 C102 56 84 96 88 156 C86 200 94 240 108 268 C96 224 96 176 100 146
             C76 158 70 118 86 98 C104 68 124 56 150 56 Z" fill="#d8d2ee" stroke="${SKIN.line}" stroke-width="3.5"/>
    <path d="M150 56 C198 56 216 96 212 156 C214 200 206 240 192 268 C204 224 204 176 200 146
             C224 158 230 118 214 98 C196 68 176 56 150 56 Z" fill="#d8d2ee" stroke="${SKIN.line}" stroke-width="3.5"/>
    <path d="M108 266 q-14 46 0 94 l84 0 q14 -48 0 -94 q-42 18 -84 0 Z" fill="#c8c0e4" stroke="${SKIN.line}" stroke-width="3.5"/>
    <path d="M88 146 q24 -36 62 -36 q40 0 62 36 q-22 -24 -44 -24 q-8 18 -30 20 q-30 4 -50 4 Z"
          fill="#eae6fa" stroke="${SKIN.line}" stroke-width="3"/>
    <path d="M150 254 q-46 8 -64 32 q-10 26 -4 72 l136 0 q6 -46 -4 -72 q-18 -24 -64 -32 Z"
          fill="#2a2050" stroke="${SKIN.line}" stroke-width="3.5"/>
    <path d="M150 256 l-20 6 l20 48 l20 -48 Z" fill="#c9a8ff" stroke="${SKIN.line}" stroke-width="3"/>
    <path d="M92 300 q58 28 116 0" stroke="#8f6bff" stroke-width="5" fill="none"/>
    <circle cx="150" cy="316" r="9" fill="#c9a8ff" stroke="${SKIN.line}" stroke-width="3"/>
    <path d="M60 220 l14 100 l-28 0 Z" fill="#3a2c62" stroke="${SKIN.line}" stroke-width="3"/>
  `, '#231a44', '#0a0818'),

  /* ---- 剧情要角（此前全部回落到「变暗的凯」） ---- */

  /* 妹妹·小铃：22 句台词，全剧情感核心 */
  suzu: e => svgWrap(`
    ${face({ id: 'suzu' + e, expr: e, eye: '#ffb43d', brow: '#4a2e1a', blush: '#ffa8a8', faceShape: 'round', eyeShape: 'big', eyeSpacing: 0.92, browThick: 5, skin: '#ffe8d4' })}
    <path d="M150 56 C106 56 86 94 90 148 C88 176 94 206 104 224 C94 190 96 156 102 134
             C84 142 80 112 94 96 C110 68 128 56 150 56 Z" fill="#5a3a26" stroke="${SKIN.line}" stroke-width="3.5"/>
    <path d="M150 56 C194 56 214 94 210 148 C212 176 206 206 196 224 C206 190 204 156 198 134
             C216 142 220 112 206 96 C190 68 172 56 150 56 Z" fill="#5a3a26" stroke="${SKIN.line}" stroke-width="3.5"/>
    <path d="M90 138 q24 -34 60 -34 q38 0 60 34 q-20 -22 -42 -22 q-8 14 -26 16 q-30 4 -52 6 Z"
          fill="#7a5238" stroke="${SKIN.line}" stroke-width="3"/>
    <!-- 两道结的红绳 -->
    <path d="M92 120 q-16 -8 -20 8 q-2 14 12 14" stroke="#c8332f" stroke-width="6" fill="none" stroke-linecap="round"/>
    <circle cx="80" cy="126" r="7" fill="#c8332f" stroke="${SKIN.line}" stroke-width="2.5"/>
    <circle cx="76" cy="140" r="5" fill="#e8544a" stroke="${SKIN.line}" stroke-width="2"/>
    <path d="M150 252 q-44 8 -60 30 q-10 26 -4 72 l128 0 q6 -46 -4 -72 q-16 -22 -60 -30 Z"
          fill="#d8a860" stroke="${SKIN.line}" stroke-width="3.5"/>
    <path d="M150 254 l-18 6 l18 44 l18 -44 Z" fill="#fff2de" stroke="${SKIN.line}" stroke-width="3"/>
    <path d="M96 300 q54 22 108 0" stroke="#c8332f" stroke-width="6" fill="none"/>
  `, '#3a2a12', '#120c08'),

  /* 健次郎：22 句，序章与第五章记忆石两次出场 */
  kenjiro: e => svgWrap(`
    ${face({ id: 'kenjiro' + e, expr: e, eye: '#d88a3a', brow: '#2a2018', blush: null, faceShape: 'square', eyeShape: 'narrow', eyeSpacing: 1.06, browThick: 8, skin: '#f0cfae' })}
    <path d="M150 58 C106 58 86 96 90 146 C86 130 76 112 70 126 C64 104 78 80 96 68
             C112 50 132 46 150 50 C168 46 190 50 206 68 C224 80 238 104 232 126
             C226 112 214 130 210 146 C214 96 194 58 150 58 Z" fill="#2e2a2a" stroke="${SKIN.line}" stroke-width="3.5"/>
    <path d="M92 134 q24 -30 58 -30 q36 0 58 30 q-18 -20 -40 -20 q-8 14 -26 16 q-28 4 -50 4 Z"
          fill="#413c3a" stroke="${SKIN.line}" stroke-width="3"/>
    <!-- 鬓角白发 -->
    <path d="M96 140 q-4 26 2 44" stroke="#b8b0a8" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M204 140 q4 26 -2 44" stroke="#b8b0a8" stroke-width="5" fill="none" stroke-linecap="round"/>
    <!-- 脸上的旧疤 -->
    <path d="M196 140 l-8 26" stroke="#c88a7a" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    <path d="M150 252 q-56 8 -78 34 q-12 26 -6 74 l168 0 q6 -48 -6 -74 q-22 -26 -78 -34 Z"
          fill="#3a3a30" stroke="${SKIN.line}" stroke-width="3.5"/>
    <path d="M150 254 l-28 8 l28 58 l28 -58 Z" fill="#c8c0ae" stroke="${SKIN.line}" stroke-width="3"/>
    <path d="M150 316 l-14 8 l14 30 l14 -30 Z" fill="#8a6a3a" stroke="${SKIN.line}" stroke-width="2.5"/>
    <path d="M236 244 q12 62 2 112" stroke="#4a4438" stroke-width="10" fill="none" stroke-linecap="round"/>
    <path d="M248 232 q10 58 0 116" stroke="#cfd8e8" stroke-width="6" fill="none" stroke-linecap="round"/>
  `, '#2a2418', '#0e0c0a'),

  /* 魔王·阿斯特：14 句最终 BOSS，此前借用泽恩的血红眼睛，与「非常安静的男人」完全相反 */
  aster: e => svgWrap(`
    ${face({ id: 'aster' + e, expr: e, eye: '#c8a04a', glow: '#8a6a20', brow: '#1a1418', blush: null, faceShape: 'sharp', eyeShape: 'narrow', eyeSpacing: 1.08, browThick: 5, skin: '#e0d4d0' })}
    <path d="M150 54 C104 54 84 94 88 152 C86 190 94 226 106 248 C94 212 94 170 98 142
             C76 152 72 114 88 96 C106 66 126 54 150 54 Z" fill="#1c1820" stroke="${SKIN.line}" stroke-width="3.5"/>
    <path d="M150 54 C196 54 216 94 212 152 C214 190 206 226 194 248 C206 212 206 170 202 142
             C224 152 228 114 212 96 C194 66 174 54 150 54 Z" fill="#1c1820" stroke="${SKIN.line}" stroke-width="3.5"/>
    <path d="M90 142 q24 -34 60 -34 q38 0 60 34 q-20 -22 -42 -22 q-8 16 -28 18 q-30 4 -50 4 Z"
          fill="#2c2630" stroke="${SKIN.line}" stroke-width="3"/>
    <!-- 素冠：只有一道细金环，表示「不喜欢张扬」 -->
    <path d="M104 96 q46 -22 92 0" stroke="#c8a04a" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M150 250 q-56 8 -78 36 q-12 28 -6 74 l168 0 q6 -46 -6 -74 q-22 -28 -78 -36 Z"
          fill="#14121a" stroke="${SKIN.line}" stroke-width="3.5"/>
    <path d="M150 252 l-28 8 l28 60 l28 -60 Z" fill="#3a3040" stroke="${SKIN.line}" stroke-width="3"/>
    <path d="M74 296 q76 30 152 0" stroke="#c8a04a" stroke-width="3.5" fill="none" opacity=".85"/>
    <path d="M60 240 l-10 76 l36 -8 Z" fill="#241c2a" stroke="${SKIN.line}" stroke-width="3"/>
    <path d="M240 240 l10 76 l-36 -8 Z" fill="#241c2a" stroke="${SKIN.line}" stroke-width="3"/>
  `, '#181424', '#07060c'),

  /* 泽恩：保留原造型，但换成尖锐的眼型与更薄的嘴，不再和璃共用五官 */
  zain: e => svgWrap(`
    ${face({ id: 'zain' + e, expr: e, eye: '#ff3b4e', glow: '#ff2a3c', brow: '#12091a', blush: null, faceShape: 'sharp', eyeShape: 'sharp', eyeSpacing: 1.06, browThick: 5, skin: '#e8cdc8' })}
    <path d="M150 54 C100 54 82 96 88 152 C82 128 68 106 60 126 C52 100 74 74 98 66
             C92 44 122 30 142 42 C158 20 196 30 194 54 C222 50 240 74 226 96
             C250 104 250 132 234 144 C240 160 230 174 218 170 C228 128 208 90 150 54 Z"
          fill="#12101e" stroke="${SKIN.line}" stroke-width="3.5"/>
    <path d="M88 146 q24 -38 62 -38 q40 0 62 38 q-22 -26 -46 -26 q-8 18 -30 20 q-30 6 -48 6 Z"
          fill="#221d38" stroke="${SKIN.line}" stroke-width="3"/>
    <path d="M150 252 q-54 8 -76 36 q-12 28 -6 72 l164 0 q6 -44 -6 -72 q-22 -28 -76 -36 Z"
          fill="#1a0f22" stroke="${SKIN.line}" stroke-width="3.5"/>
    <path d="M150 254 l-30 8 l30 62 l30 -62 Z" fill="#7a0f22" stroke="${SKIN.line}" stroke-width="3"/>
    <path d="M118 268 q-38 12 -50 44 l20 10 q12 -28 40 -42 Z" fill="#2c1430" stroke="${SKIN.line}" stroke-width="3"/>
    <path d="M182 268 q38 12 50 44 l-20 10 q-12 -28 -40 -42 Z" fill="#2c1430" stroke="${SKIN.line}" stroke-width="3"/>
    <path d="M96 268 l-30 -46 l16 -10 l34 44 Z" fill="#3a2038" stroke="${SKIN.line}" stroke-width="3"/>
    <path d="M204 268 l30 -46 l-16 -10 l-34 44 Z" fill="#3a2038" stroke="${SKIN.line}" stroke-width="3"/>
    <path d="M64 214 l-16 62 l40 -6 Z" fill="#8f1226" stroke="${SKIN.line}" stroke-width="3"/>
    <path d="M236 214 l16 62 l-40 -6 Z" fill="#8f1226" stroke="${SKIN.line}" stroke-width="3"/>
    <path d="M74 300 q76 34 152 0" stroke="#ff3b4e" stroke-width="4" fill="none" opacity=".85"/>
  `, '#2a0616', '#0a0410'),

  baixue: e => svgWrap(`
    ${face({ id: 'baixue' + e, expr: e, eye: '#8fe6ff', glow: '#7fdcff', brow: '#2c3a52', blush: '#ffa8c0', faceShape: 'oval', eyeShape: 'droop', eyeSpacing: 1, browThick: 5, skin: '#ffeef4' })}
    <path d="M150 52 C100 52 84 94 90 158 C88 200 94 238 106 264 C96 224 98 178 102 148
             C80 156 74 116 90 96 C108 66 126 52 150 52 Z" fill="#eaf4ff" stroke="${SKIN.line}" stroke-width="3.5"/>
    <path d="M150 52 C200 52 216 94 210 158 C212 200 206 238 194 264 C204 224 202 178 198 148
             C220 156 226 116 210 96 C192 66 174 52 150 52 Z" fill="#eaf4ff" stroke="${SKIN.line}" stroke-width="3.5"/>
    <path d="M106 262 q-16 52 0 98 l88 0 q16 -46 0 -98 q-44 18 -88 0 Z" fill="#dceaf8" stroke="${SKIN.line}" stroke-width="3.5"/>
    <path d="M150 50 l-24 -26 l24 8 l24 -8 Z" fill="#a8d8ff" stroke="${SKIN.line}" stroke-width="3"/>
    <path d="M88 146 q24 -38 62 -38 q40 0 62 38 q-22 -26 -46 -26 q-8 18 -30 20 q-30 6 -48 6 Z"
          fill="#f6fbff" stroke="${SKIN.line}" stroke-width="3"/>
    <path d="M150 252 q-48 8 -66 34 q-10 26 -4 72 l140 0 q6 -46 -4 -72 q-18 -26 -66 -34 Z"
          fill="#1c3a5c" stroke="${SKIN.line}" stroke-width="3.5"/>
    <path d="M150 254 l-22 6 l22 46 l22 -46 Z" fill="#dceaf8" stroke="${SKIN.line}" stroke-width="3"/>
    <path d="M100 268 l-24 40 l22 12 l22 -34 Z" fill="#2c5480" stroke="${SKIN.line}" stroke-width="3"/>
    <path d="M200 268 l24 40 l-22 12 l-22 -34 Z" fill="#2c5480" stroke="${SKIN.line}" stroke-width="3"/>
    <path d="M240 240 q12 74 8 118" stroke="#bfe4ff" stroke-width="6" fill="none"/>
    <path d="M248 200 l-30 40 l30 20 l30 -20 Z" fill="#8fe6ff" stroke="${SKIN.line}" stroke-width="3"/>
  `, '#0d2440', '#06101e'),

  /* 魔将·古兰：临终那句「那不是火，那是不服气」是全剧最好的台词之一 */
  grang: e => svgWrap(`
    ${face({ id: 'grang' + e, expr: e, eye: '#ff6a1a', glow: '#c84a10', brow: '#1a0c08', blush: null, faceShape: 'square', eyeShape: 'sharp', eyeSpacing: 1.12, browThick: 9, skin: '#c88a6a' })}
    <path d="M150 58 C102 58 84 96 90 150 C84 132 72 116 66 130 C60 106 78 80 100 70
             C118 52 134 48 150 52 C166 48 184 52 200 70 C222 80 240 106 234 130
             C228 116 216 132 210 150 C216 96 198 58 150 58 Z" fill="#2a1410" stroke="${SKIN.line}" stroke-width="3.5"/>
    <!-- 角 -->
    <path d="M96 92 l-30 -40 l6 44 Z" fill="#c8a04a" stroke="${SKIN.line}" stroke-width="3"/>
    <path d="M204 92 l30 -40 l-6 44 Z" fill="#c8a04a" stroke="${SKIN.line}" stroke-width="3"/>
    <path d="M92 140 q24 -32 58 -32 q36 0 58 32 q-18 -20 -40 -20 q-8 16 -28 18 q-28 4 -48 2 Z"
          fill="#40201a" stroke="${SKIN.line}" stroke-width="3"/>
    <path d="M118 188 l16 -6 M182 188 l-16 -6" stroke="#8a4a2a" stroke-width="3" stroke-linecap="round"/>
    <path d="M150 250 q-62 8 -86 36 q-14 28 -8 74 l188 0 q6 -46 -8 -74 q-24 -28 -86 -36 Z"
          fill="#2a0c14" stroke="${SKIN.line}" stroke-width="3.5"/>
    <path d="M150 252 l-32 10 l32 62 l32 -62 Z" fill="#c8a04a" stroke="${SKIN.line}" stroke-width="3"/>
    <path d="M70 292 q80 32 160 0" stroke="#ff6a1a" stroke-width="4" fill="none" opacity=".8"/>
    <path d="M46 230 l-14 74 l42 -10 Z" fill="#4a1a12" stroke="${SKIN.line}" stroke-width="3"/>
    <path d="M254 230 l14 74 l-42 -10 Z" fill="#4a1a12" stroke="${SKIN.line}" stroke-width="3"/>
  `, '#2c0e08', '#0c0604'),

  /* 铁匠：序章唯一有份量的村民，第一章死在火里 */
  smith: e => svgWrap(`
    ${face({ id: 'smith' + e, expr: e, eye: '#8a6a3a', brow: '#2a1c10', blush: '#d88a6a', faceShape: 'square', eyeShape: 'narrow', eyeSpacing: 1.08, browThick: 9, skin: '#e8b088' })}
    <path d="M150 60 C110 60 92 96 96 142 C92 124 82 110 76 124 C70 104 84 82 102 72
             C118 58 134 54 150 58 C166 54 182 58 198 72 C216 82 230 104 224 124
             C218 110 208 124 204 142 C208 96 190 60 150 60 Z" fill="#4a3020" stroke="${SKIN.line}" stroke-width="3.5"/>
    <path d="M96 136 q24 -28 54 -28 q34 0 54 28 q-18 -18 -38 -18 q-8 14 -24 16 q-26 4 -46 2 Z"
          fill="#5e402a" stroke="${SKIN.line}" stroke-width="3"/>
    <!-- 络腮胡 -->
    <path d="M106 178 q4 60 44 72 q40 -12 44 -72 q-16 34 -44 36 q-28 -2 -44 -36 Z"
          fill="#4a3020" stroke="${SKIN.line}" stroke-width="3"/>
    <path d="M150 252 q-58 8 -80 34 q-12 26 -6 74 l172 0 q6 -48 -6 -74 q-22 -26 -80 -34 Z"
          fill="#5a4030" stroke="${SKIN.line}" stroke-width="3.5"/>
    <path d="M112 256 q38 18 76 0 l-8 40 q-30 12 -60 0 Z" fill="#8a6a4a" stroke="${SKIN.line}" stroke-width="3"/>
    <path d="M70 300 q80 26 160 0" stroke="#c8332f" stroke-width="5" fill="none"/>
  `, '#3a2210', '#120a06'),

  /* 船长：第三章的道德困境由他承担 */
  captain: e => svgWrap(`
    ${face({ id: 'captain' + e, expr: e, eye: '#4a8ab8', brow: '#2e2620', blush: '#c88a7a', faceShape: 'oval', eyeShape: 'droop', eyeSpacing: 1.04, browThick: 7, skin: '#dca878' })}
    <path d="M150 62 C112 62 94 98 98 144 C96 124 88 112 82 126 C76 106 90 84 108 74
             C124 62 136 58 150 60 C164 58 176 62 192 74 C210 84 224 106 218 126
             C212 112 204 124 202 144 C206 98 188 62 150 62 Z" fill="#3a3830" stroke="${SKIN.line}" stroke-width="3.5"/>
    <!-- 船帽 -->
    <path d="M84 106 q66 -36 132 0 q-6 -46 -66 -46 q-60 0 -66 46 Z" fill="#1c2a42" stroke="${SKIN.line}" stroke-width="3.5"/>
    <path d="M78 106 q72 16 144 0 l0 10 q-72 16 -144 0 Z" fill="#2c3e5c" stroke="${SKIN.line}" stroke-width="3"/>
    <path d="M118 186 q32 18 64 0 q-8 34 -32 40 q-24 -6 -32 -40 Z" fill="#5a5348" stroke="${SKIN.line}" stroke-width="3"/>
    <path d="M150 252 q-54 8 -74 34 q-12 26 -6 74 l160 0 q6 -48 -6 -74 q-20 -26 -74 -34 Z"
          fill="#24384f" stroke="${SKIN.line}" stroke-width="3.5"/>
    <path d="M150 254 l-24 8 l24 52 l24 -52 Z" fill="#d8dcea" stroke="${SKIN.line}" stroke-width="3"/>
    <path d="M80 300 q70 24 140 0" stroke="#c8a04a" stroke-width="5" fill="none"/>
  `, '#12283a', '#070e18'),

  /* 通用村民：居民 / 药师 / 孩子 / 车夫 / 伤员 / 护卫都靠这三张换色复用 */
  villager: e => svgWrap(`
    ${face({ id: 'villager' + e, expr: e, eye: '#7a6a4a', brow: '#3a2c1c', blush: '#d8a090', faceShape: 'round', eyeShape: 'big', browThick: 6, skin: '#f0c8a4' })}
    <path d="M150 58 C108 58 88 96 92 146 C90 172 96 200 106 218 C96 186 98 154 104 134
             C86 142 82 112 96 96 C112 70 130 58 150 58 Z" fill="#6a5238" stroke="${SKIN.line}" stroke-width="3.5"/>
    <path d="M150 58 C192 58 212 96 208 146 C210 172 204 200 194 218 C204 186 202 154 196 134
             C214 142 218 112 204 96 C188 70 170 58 150 58 Z" fill="#6a5238" stroke="${SKIN.line}" stroke-width="3.5"/>
    <path d="M92 140 q24 -32 58 -32 q36 0 58 32 q-18 -20 -40 -20 q-8 14 -26 16 q-28 4 -50 4 Z"
          fill="#816444" stroke="${SKIN.line}" stroke-width="3"/>
    <path d="M150 252 q-48 8 -66 32 q-10 26 -4 72 l140 0 q6 -46 -4 -72 q-18 -24 -66 -32 Z"
          fill="#8a7a5c" stroke="${SKIN.line}" stroke-width="3.5"/>
    <path d="M150 254 l-20 6 l20 46 l20 -46 Z" fill="#e8dcc4" stroke="${SKIN.line}" stroke-width="3"/>
  `, '#2e2418', '#0e0b06'),

  /* 灵兽·白泽：第七章说出真相的那位 */
  baize: e => svgWrap(`
    ${face({ id: 'baize' + e, expr: e, eye: '#8a7ad8', glow: '#6a5ab8', brow: '#3a3250', blush: null, faceShape: 'oval', eyeShape: 'narrow', eyeSpacing: 1.1, browThick: 5, skin: '#f0ecf8' })}
    <path d="M150 54 C102 54 84 94 88 152 C86 192 94 230 106 252 C94 216 94 172 98 144
             C76 154 72 114 88 96 C106 66 126 54 150 54 Z" fill="#e8e4f2" stroke="${SKIN.line}" stroke-width="3.5"/>
    <path d="M150 54 C198 54 216 94 212 152 C214 192 206 230 194 252 C206 216 206 172 202 144
             C224 154 228 114 212 96 C194 66 174 54 150 54 Z" fill="#e8e4f2" stroke="${SKIN.line}" stroke-width="3.5"/>
    <!-- 独角 -->
    <path d="M150 48 l-9 -40 l9 6 l9 -6 Z" fill="#8a7ad8" stroke="${SKIN.line}" stroke-width="3"/>
    <path d="M90 140 q24 -34 60 -34 q38 0 60 34 q-20 -22 -42 -22 q-8 16 -28 18 q-30 4 -50 4 Z"
          fill="#f6f4fc" stroke="${SKIN.line}" stroke-width="3"/>
    <!-- 额心的「知」纹 -->
    <circle cx="150" cy="118" r="7" fill="none" stroke="#8a7ad8" stroke-width="3"/>
    <path d="M150 250 q-52 8 -72 34 q-12 26 -6 74 l156 0 q6 -48 -6 -74 q-20 -26 -72 -34 Z"
          fill="#c8c0e4" stroke="${SKIN.line}" stroke-width="3.5"/>
    <path d="M150 252 l-24 8 l24 54 l24 -54 Z" fill="#efeaf8" stroke="${SKIN.line}" stroke-width="3"/>
    <path d="M78 298 q72 28 144 0" stroke="#8a7ad8" stroke-width="4" fill="none"/>
  `, '#1e1a34', '#08060e'),
};

/* ============================================================
   预生成
   ============================================================
   每个角色 × 六种表情，全部在模块加载时生成好 data URI。
   总量不大（纯 SVG 文本），换表情时不需要重新拼字符串。 */
export const PORTRAITS = {};
const VARIANTS = {};
for (const key of Object.keys(RECIPES)) {
  VARIANTS[key] = {};
  for (const e of EXPRESSIONS) {
    VARIANTS[key][e] = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(RECIPES[key](e));
  }
  PORTRAITS[key] = VARIANTS[key].normal;   // 兼容旧的 PORTRAITS[id] 用法
}

export function portraitURL(id, expr) {
  const v = VARIANTS[id] || VARIANTS.kaito;
  return v[expr] || v.normal;
}
export function hasPortrait(id) { return !!VARIANTS[id]; }

export default PORTRAITS;
