/* ============================================================
   portraits.js — 程序化生成日漫风格角色立绘 (SVG)
   ============================================================ */
const C = {
  skin: '#ffe0c8', skinS: '#e8b79b', line: '#1a1020',
};

/* 通用五官（位置：脸中心 cx=150，眼线 y=150） */
function face(opt) {
  const { eye, glow = 'none', brow = '#3a2a4a', blush = '#ff9aa8' } = opt;
  const eyeG = `eye_${opt.id}`;
  return `
  <defs>
    <radialGradient id="${eyeG}" cx="50%" cy="40%" r="70%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="38%" stop-color="${eye}"/>
      <stop offset="100%" stop-color="${shade(eye, -45)}"/>
    </radialGradient>
    <linearGradient id="skin_${opt.id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fff0e2"/><stop offset="100%" stop-color="${C.skin}"/>
    </linearGradient>
  </defs>
  <!-- 脖子 -->
  <path d="M120 232 L120 268 Q150 286 180 268 L180 232 Z" fill="${C.skinS}"/>
  <path d="M120 232 L120 252 Q150 268 180 252 L180 232 Z" fill="${C.skin}"/>
  <!-- 脸 -->
  <path d="M150 78 C112 78 92 108 92 150 C92 200 118 246 150 252 C182 246 208 200 208 150 C208 108 188 78 150 78 Z"
        fill="url(#skin_${opt.id})" stroke="${C.line}" stroke-width="3.5"/>
  <!-- 耳 -->
  <path d="M92 146 q-11 -6 -9 12 q2 16 12 14 Z" fill="${C.skin}" stroke="${C.line}" stroke-width="3"/>
  <path d="M208 146 q11 -6 9 12 q-2 16 -12 14 Z" fill="${C.skin}" stroke="${C.line}" stroke-width="3"/>
  ${glow !== 'none' ? `<ellipse cx="150" cy="158" rx="66" ry="52" fill="${glow}" opacity=".22"/>` : ''}
  <!-- 眉 -->
  <path d="M112 132 q16 -11 32 -3" stroke="${brow}" stroke-width="6" fill="none" stroke-linecap="round"/>
  <path d="M156 129 q16 -8 32 3" stroke="${brow}" stroke-width="6" fill="none" stroke-linecap="round"/>
  <!-- 眼 -->
  <g>
    <path d="M110 152 q20 -20 42 -2 q-20 18 -42 2 Z" fill="#fff" stroke="${C.line}" stroke-width="3.5"/>
    <ellipse cx="131" cy="153" rx="12" ry="13" fill="url(#${eyeG})"/>
    <circle cx="131" cy="153" r="5" fill="#120a1e"/>
    <circle cx="127" cy="148" r="4.2" fill="#fff" opacity=".95"/>
    <path d="M108 145 q22 -20 46 -4" stroke="${C.line}" stroke-width="5.5" fill="none" stroke-linecap="round"/>
  </g>
  <g>
    <path d="M148 150 q22 -18 42 2 q-22 16 -42 -2 Z" fill="#fff" stroke="${C.line}" stroke-width="3.5"/>
    <ellipse cx="169" cy="153" rx="12" ry="13" fill="url(#${eyeG})"/>
    <circle cx="169" cy="153" r="5" fill="#120a1e"/>
    <circle cx="165" cy="148" r="4.2" fill="#fff" opacity=".95"/>
    <path d="M146 143 q22 -16 46 4" stroke="${C.line}" stroke-width="5.5" fill="none" stroke-linecap="round"/>
  </g>
  <!-- 鼻 / 嘴 -->
  <path d="M150 172 q5 9 -3 12" stroke="${C.skinS}" stroke-width="4" fill="none" stroke-linecap="round"/>
  <path d="M134 205 q16 9 32 -1" stroke="${C.line}" stroke-width="4" fill="none" stroke-linecap="round"/>
  <!-- 腮红 -->
  <ellipse cx="114" cy="186" rx="13" ry="7" fill="${blush}" opacity=".35"/>
  <ellipse cx="186" cy="186" rx="13" ry="7" fill="${blush}" opacity=".35"/>`;
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.max(0, Math.min(255, r + amt)); g = Math.max(0, Math.min(255, g + amt)); b = Math.max(0, Math.min(255, b + amt));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
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
  <rect width="300" height="360" fill="url(#vig)"/>`;
}

/* ---------------- 角色定义 ---------------- */
const RECIPES = {
  /* 凯 —— 热血剑士 */
  kaito: () => svgWrap(`
    ${face({ id: 'kaito', eye: '#ff8a1a', glow: '#ff6a1a', brow: '#241a34', blush: '#ff8f8f' })}
    <!-- 头发：刺猬头 -->
    <path d="M150 58 C104 58 84 96 88 140 C82 128 70 100 66 118 C60 96 74 74 92 62 C74 52 96 34 116 44
             C120 24 146 18 158 34 C172 16 202 26 200 48 C224 42 244 62 234 84 C252 84 256 108 244 122
             C250 138 242 152 232 150 C238 118 220 92 200 82 C186 66 168 58 150 58 Z"
          fill="#2b2340" stroke="${C.line}" stroke-width="3.5"/>
    <path d="M104 92 C120 70 150 62 176 70" stroke="#4a3f6b" stroke-width="7" fill="none" stroke-linecap="round"/>
    <path d="M96 128 C102 104 118 88 140 80" stroke="#ff9a3d" stroke-width="6" fill="none" stroke-linecap="round" opacity=".9"/>
    <!-- 前发 -->
    <path d="M92 132 q22 -34 60 -34 q38 0 58 34 q-16 -22 -38 -22 q-6 12 -22 16 q-24 6 -58 6 Z"
          fill="#342a4e" stroke="${C.line}" stroke-width="3"/>
    <!-- 身体：羽织 -->
    <path d="M150 252 q-52 8 -74 34 q-12 26 -6 74 l160 0 q6 -48 -6 -74 q-22 -26 -74 -34 Z"
          fill="#1d2a4a" stroke="${C.line}" stroke-width="3.5"/>
    <path d="M150 254 l-26 8 l26 60 l26 -60 Z" fill="#e8e4f2" stroke="${C.line}" stroke-width="3"/>
    <path d="M124 262 q-30 14 -40 40 l16 8 q10 -24 34 -38 Z" fill="#c8332f" stroke="${C.line}" stroke-width="3"/>
    <path d="M176 262 q30 14 40 40 l-16 8 q-10 -24 -34 -38 Z" fill="#c8332f" stroke="${C.line}" stroke-width="3"/>
    <path d="M150 320 l-14 8 l14 32 l14 -32 Z" fill="#ffb43d" stroke="${C.line}" stroke-width="2.5"/>
    <!-- 刀 -->
    <path d="M232 250 q14 60 4 108" stroke="#3a3a52" stroke-width="9" fill="none" stroke-linecap="round"/>
    <path d="M246 236 q10 56 0 110" stroke="#dfe9ff" stroke-width="7" fill="none" stroke-linecap="round"/>
  `, '#3a1c10', '#100a1e'),

  /* 苍 —— 治愈术士 */
  cang: () => svgWrap(`
    ${face({ id: 'cang', eye: '#57e0ff', glow: '#48d8ff', brow: '#3b2a52', blush: '#ffa8bc' })}
    <path d="M150 56 C104 56 86 94 88 150 C86 186 96 224 112 246 C98 210 96 168 100 140
             C78 150 74 118 88 100 C104 70 124 56 150 56 Z" fill="#7d5fd8" stroke="${C.line}" stroke-width="3.5"/>
    <path d="M150 56 C196 56 214 94 212 150 C214 186 204 224 188 246 C202 210 204 168 200 140
             C222 150 226 118 212 100 C196 70 176 56 150 56 Z" fill="#7d5fd8" stroke="${C.line}" stroke-width="3.5"/>
    <path d="M112 244 q-10 40 4 84 l68 0 q14 -44 4 -84 q-38 16 -76 0 Z" fill="#6a4fc0" stroke="${C.line}" stroke-width="3.5"/>
    <path d="M90 132 q22 -30 60 -30 q38 0 60 30 q-18 -20 -40 -20 q-8 16 -28 18 q-28 4 -52 2 Z"
          fill="#8f74e8" stroke="${C.line}" stroke-width="3"/>
    <ellipse cx="150" cy="52" rx="34" ry="16" fill="#8f74e8" stroke="${C.line}" stroke-width="3"/>
    <path d="M150 252 q-44 8 -60 30 q-10 24 -4 70 l128 0 q6 -46 -4 -70 q-16 -22 -60 -30 Z"
          fill="#efeaf8" stroke="${C.line}" stroke-width="3.5"/>
    <path d="M150 254 l-18 6 l18 52 l18 -52 Z" fill="#6a4fc0" stroke="${C.line}" stroke-width="3"/>
    <path d="M116 258 q-22 26 -14 54" stroke="#c9b6ff" stroke-width="4" fill="none"/>
    <path d="M184 258 q22 26 14 54" stroke="#c9b6ff" stroke-width="4" fill="none"/>
    <path d="M232 240 q10 70 6 116" stroke="#8a6a3a" stroke-width="7" fill="none" stroke-linecap="round"/>
    <circle cx="234" cy="228" r="15" fill="#48d8ff" stroke="${C.line}" stroke-width="3"/>
    <circle cx="234" cy="228" r="7" fill="#e8ffff"/>
  `, '#101a3a', '#080a1c'),

  /* 雷 —— 枪之少女 */
  lei: () => svgWrap(`
    ${face({ id: 'lei', eye: '#9be25a', glow: '#8ee04a', brow: '#3a2b22', blush: '#ff9f9f' })}
    <!-- 短发 -->
    <path d="M150 54 C106 54 88 92 92 142 C90 168 96 196 106 214 C96 182 96 150 102 130
             C82 136 80 108 94 94 C110 68 128 54 150 54 Z" fill="#3a3a48" stroke="${C.line}" stroke-width="3.5"/>
    <path d="M150 54 C194 54 212 92 208 142 C210 168 204 196 194 214 C204 182 204 150 198 130
             C218 136 220 108 206 94 C190 68 172 54 150 54 Z" fill="#3a3a48" stroke="${C.line}" stroke-width="3.5"/>
    <path d="M88 140 q24 -32 62 -32 q40 0 62 32 q-20 -22 -42 -22 q-8 14 -28 16 q-30 4 -54 6 Z"
          fill="#52525f" stroke="${C.line}" stroke-width="3"/>
    <path d="M150 250 q-48 8 -66 32 q-10 26 -4 72 l140 0 q6 -46 -4 -72 q-18 -24 -66 -32 Z"
          fill="#2e3a52" stroke="${C.line}" stroke-width="3.5"/>
    <path d="M150 252 l-22 6 l22 46 l22 -46 Z" fill="#d8dcea" stroke="${C.line}" stroke-width="3"/>
    <path d="M100 280 l-16 20 l24 10 l14 -18 Z" fill="#c8332f" stroke="${C.line}" stroke-width="3"/>
    <path d="M200 280 l16 20 l-24 10 l-14 -18 Z" fill="#c8332f" stroke="${C.line}" stroke-width="3"/>
    <path d="M96 302 q54 26 108 0" stroke="#8ee04a" stroke-width="5" fill="none" opacity=".9"/>
    <!-- 长枪 -->
    <path d="M64 360 L196 96" stroke="#7a5a34" stroke-width="8" stroke-linecap="round"/>
    <path d="M196 96 L188 60 L216 78 L200 104 Z" fill="#e6f0ff" stroke="${C.line}" stroke-width="3"/>
  `, '#141c14', '#0a0d08'),

  /* 璃 —— 冰之魔女 */
  ryze: () => svgWrap(`
    ${face({ id: 'ryze', eye: '#c9a8ff', glow: '#8f6bff', brow: '#2a1c3a', blush: '#ff9fc0' })}
    <path d="M150 56 C102 56 84 96 88 156 C86 200 94 240 108 268 C96 224 96 176 100 146
             C76 158 70 118 86 98 C104 68 124 56 150 56 Z" fill="#d8d2ee" stroke="${C.line}" stroke-width="3.5"/>
    <path d="M150 56 C198 56 216 96 212 156 C214 200 206 240 192 268 C204 224 204 176 200 146
             C224 158 230 118 214 98 C196 68 176 56 150 56 Z" fill="#d8d2ee" stroke="${C.line}" stroke-width="3.5"/>
    <path d="M108 266 q-14 46 0 94 l84 0 q14 -48 0 -94 q-42 18 -84 0 Z" fill="#c8c0e4" stroke="${C.line}" stroke-width="3.5"/>
    <path d="M88 146 q24 -36 62 -36 q40 0 62 36 q-22 -24 -44 -24 q-8 18 -30 20 q-30 4 -50 4 Z"
          fill="#eae6fa" stroke="${C.line}" stroke-width="3"/>
    <path d="M150 254 q-46 8 -64 32 q-10 26 -4 72 l136 0 q6 -46 -4 -72 q-18 -24 -64 -32 Z"
          fill="#2a2050" stroke="${C.line}" stroke-width="3.5"/>
    <path d="M150 256 l-20 6 l20 48 l20 -48 Z" fill="#c9a8ff" stroke="${C.line}" stroke-width="3"/>
    <path d="M92 300 q58 28 116 0" stroke="#8f6bff" stroke-width="5" fill="none"/>
    <circle cx="150" cy="316" r="9" fill="#c9a8ff" stroke="${C.line}" stroke-width="3"/>
    <path d="M60 220 l14 100 l-28 0 Z" fill="#3a2c62" stroke="${C.line}" stroke-width="3"/>
  `, '#231a44', '#0a0818'),

  /* 泽恩 —— 暗影四天王 */
  zain: () => svgWrap(`
    ${face({ id: 'zain', eye: '#ff3b4e', glow: '#ff2a3c', brow: '#12091a', blush: '#a05060' })}
    <path d="M150 54 C100 54 82 96 88 152 C82 128 68 106 60 126 C52 100 74 74 98 66
             C92 44 122 30 142 42 C158 20 196 30 194 54 C222 50 240 74 226 96
             C250 104 250 132 234 144 C240 160 230 174 218 170 C228 128 208 90 150 54 Z"
          fill="#12101e" stroke="${C.line}" stroke-width="3.5"/>
    <path d="M88 146 q24 -38 62 -38 q40 0 62 38 q-22 -26 -46 -26 q-8 18 -30 20 q-30 6 -48 6 Z"
          fill="#221d38" stroke="${C.line}" stroke-width="3"/>
    <path d="M150 252 q-54 8 -76 36 q-12 28 -6 72 l164 0 q6 -44 -6 -72 q-22 -28 -76 -36 Z"
          fill="#1a0f22" stroke="${C.line}" stroke-width="3.5"/>
    <path d="M150 254 l-30 8 l30 62 l30 -62 Z" fill="#7a0f22" stroke="${C.line}" stroke-width="3"/>
    <path d="M118 268 q-38 12 -50 44 l20 10 q12 -28 40 -42 Z" fill="#2c1430" stroke="${C.line}" stroke-width="3"/>
    <path d="M182 268 q38 12 50 44 l-20 10 q-12 -28 -40 -42 Z" fill="#2c1430" stroke="${C.line}" stroke-width="3"/>
    <path d="M96 268 l-30 -46 l16 -10 l34 44 Z" fill="#3a2038" stroke="${C.line}" stroke-width="3"/>
    <path d="M204 268 l30 -46 l-16 -10 l-34 44 Z" fill="#3a2038" stroke="${C.line}" stroke-width="3"/>
    <path d="M64 214 l-16 62 l40 -6 Z" fill="#8f1226" stroke="${C.line}" stroke-width="3"/>
    <path d="M236 214 l16 62 l-40 -6 Z" fill="#8f1226" stroke="${C.line}" stroke-width="3"/>
    <path d="M74 300 q76 34 152 0" stroke="#ff3b4e" stroke-width="4" fill="none" opacity=".85"/>
  `, '#2a0616', '#0a0410'),

  /* 白雪 —— 冰之四天王 */
  baixue: () => svgWrap(`
    ${face({ id: 'baixue', eye: '#8fe6ff', glow: '#7fdcff', brow: '#2c3a52', blush: '#ffa8c0' })}
    <path d="M150 52 C100 52 84 94 90 158 C88 200 94 238 106 264 C96 224 98 178 102 148
             C80 156 74 116 90 96 C108 66 126 52 150 52 Z" fill="#eaf4ff" stroke="${C.line}" stroke-width="3.5"/>
    <path d="M150 52 C200 52 216 94 210 158 C212 200 206 238 194 264 C204 224 202 178 198 148
             C220 156 226 116 210 96 C192 66 174 52 150 52 Z" fill="#eaf4ff" stroke="${C.line}" stroke-width="3.5"/>
    <path d="M106 262 q-16 52 0 98 l88 0 q16 -46 0 -98 q-44 18 -88 0 Z" fill="#dceaf8" stroke="${C.line}" stroke-width="3.5"/>
    <path d="M150 50 l-24 -26 l24 8 l24 -8 Z" fill="#a8d8ff" stroke="${C.line}" stroke-width="3"/>
    <path d="M88 146 q24 -38 62 -38 q40 0 62 38 q-22 -26 -46 -26 q-8 18 -30 20 q-30 6 -48 6 Z"
          fill="#f6fbff" stroke="${C.line}" stroke-width="3"/>
    <path d="M150 252 q-48 8 -66 34 q-10 26 -4 72 l140 0 q6 -46 -4 -72 q-18 -26 -66 -34 Z"
          fill="#1c3a5c" stroke="${C.line}" stroke-width="3.5"/>
    <path d="M150 254 l-22 6 l22 46 l22 -46 Z" fill="#dceaf8" stroke="${C.line}" stroke-width="3"/>
    <path d="M100 268 l-24 40 l22 12 l22 -34 Z" fill="#2c5480" stroke="${C.line}" stroke-width="3"/>
    <path d="M200 268 l24 40 l-22 12 l-22 -34 Z" fill="#2c5480" stroke="${C.line}" stroke-width="3"/>
    <path d="M240 240 q12 74 8 118" stroke="#bfe4ff" stroke-width="6" fill="none"/>
    <path d="M248 200 l-30 40 l30 20 l30 -20 Z" fill="#8fe6ff" stroke="${C.line}" stroke-width="3"/>
  `, '#0d2440', '#06101e'),
};

export const PORTRAITS = {};
for (const k of Object.keys(RECIPES)) {
  PORTRAITS[k] = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(RECIPES[k]());
}
export function portraitURL(id) { return PORTRAITS[id] || PORTRAITS.kaito; }
export default PORTRAITS;
