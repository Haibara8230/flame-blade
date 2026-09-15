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
/* ---------------- 发型模板 ----------------
   第一版我用一串相对 q 命令描头发，首尾自相重叠，填充面积几乎为零——
   渲染出来只有一条细弧线。改成「外廓 + 发际线」两段闭合曲线，
   保证一定有实心的体积。
     vol  顶部蓬松度（越大越高）
     side 鬓角落到多低
     line 发际线压额头的深度（越大额头越窄） */
function hairCap(fill, { vol = 52, side = 158, line = 96 } = {}) {
  return `<path d="M88 ${side} C84 ${vol + 40} 110 ${vol} 150 ${vol}
           C190 ${vol} 216 ${vol + 40} 212 ${side}
           C206 ${line + 24} 196 ${line} 150 ${line}
           C104 ${line} 94 ${line + 24} 88 ${side} Z"
        fill="${fill}" stroke="${SKIN.line}" stroke-width="3.5"/>`;
}
/* 长发：在发帽两侧各挂一片垂下来的头发 */
function hairSide(fill, len = 300) {
  return `<path d="M90 150 C82 200 84 ${len - 40} 96 ${len} L118 ${len} C104 ${len - 50} 98 200 102 152 Z"
        fill="${fill}" stroke="${SKIN.line}" stroke-width="3"/>
      <path d="M210 150 C218 200 216 ${len - 40} 204 ${len} L182 ${len} C196 ${len - 50} 202 200 198 152 Z"
        fill="${fill}" stroke="${SKIN.line}" stroke-width="3"/>`;
}

const RECIPES = {
  /* ---- 叶天邪 / 邪天 ----
     原文序章：「十七八岁的外表，棱角分明的面孔，他身材颀长……一缕碎发不羁的
     垂在他的额前，两弯眉毛浑如刷漆……嘴角挂着的那抹漫不经心的笑和眼眸中
     偶尔闪过的邪灵之芒。」
     棱角分明 → sharp；两弯眉毛浑如刷漆 → 眉最粗、近纯黑；
     「偶尔闪过」——所以瞳色是近黑的深栗，靠 glow 打出那一点邪芒，
     ⚠ 第一版做成常驻红瞳是错的，原文写的是偶尔。 */
  kaito: e => svgWrap(`
    ${face({ id: 'kaito' + e, expr: e, eye: '#3a2028', glow: '#ff5a3c', brow: '#0a0710', blush: null, skin: '#f6dcc2', faceShape: 'sharp', eyeShape: 'sharp', browThick: 9 })}
    ${hairCap('#15101f', { vol: 46, side: 168, line: 92 })}
    <!-- 一缕碎发不羁地垂在额前 -->
    <path d="M158 62 q-10 40 -34 70 q6 -44 16 -72 Z" fill="#241c33" stroke="${SKIN.line}" stroke-width="2.5"/>
    <path d="M118 66 q-8 30 -22 52 q2 -36 10 -56 Z" fill="#1b1528" stroke="${SKIN.line}" stroke-width="2"/>
    <!-- 蓝格子翻领衬衣（第1章：蓝格子翻领衬衣、黑色修身裤） -->
    <path d="M150 252 q-50 8 -72 32 q-12 26 -6 76 l156 0 q6 -50 -6 -76 q-22 -24 -72 -32 Z"
          fill="#2a4a72" stroke="${SKIN.line}" stroke-width="3.5"/>
    <path d="M118 266 h64 M118 292 h64 M118 318 h64" stroke="#6b93c4" stroke-width="2" opacity=".5"/>
    <path d="M130 258 v102 M170 258 v102" stroke="#6b93c4" stroke-width="2" opacity=".5"/>
    <path d="M150 254 l-24 10 l24 44 l24 -44 Z" fill="#141a26" stroke="${SKIN.line}" stroke-width="3"/>
    <!-- 胸前那个七孔黑色挂饰 -->
    <path d="M150 296 l-9 10 v40 l9 10 l9 -10 v-40 Z" fill="#090710" stroke="#5a4a70" stroke-width="2.5"/>
    <circle cx="150" cy="310" r="2.6" fill="#ff4a4a"/><circle cx="145" cy="320" r="2.4" fill="#ffa03a"/>
    <circle cx="155" cy="326" r="2.4" fill="#ffe14a"/><circle cx="147" cy="333" r="2.3" fill="#5ae07a"/>
    <circle cx="154" cy="340" r="2.3" fill="#4ad4ff"/><circle cx="148" cy="346" r="2.2" fill="#5a7aff"/>
    <circle cx="153" cy="352" r="2.2" fill="#b86bff"/>
  `, '#3a1420', '#0c0812'),

  /* ---- 刘桦（序章） ----
     「一个清瘦面孔，满面书生气的少年男子……在他面前要低了半个头，倒是手中拖
       的行李箱要比他的大了两倍有余，背上还背着一个大号的浅色背包。」
     清瘦 → oval + 窄眼距；书生气 → 细眉、圆框眼镜、服帖的短发。 */
  liuhua: e => svgWrap(`
    ${face({ id: 'liuhua' + e, expr: e, eye: '#5a4436', glow: '#a08a6a', brow: '#33281c', blush: '#f0a894', skin: '#f2dcc6', faceShape: 'oval', eyeSpacing: 0.95, eyeShape: 'big', browThick: 4 })}
    ${hairCap('#3b2d22', { vol: 62, side: 150, line: 104 })}
    <circle cx="121" cy="153" r="25" fill="none" stroke="#d8d2c4" stroke-width="3.5"/>
    <circle cx="179" cy="153" r="25" fill="none" stroke="#d8d2c4" stroke-width="3.5"/>
    <path d="M96 150 l-10 -5 M204 150 l10 -5 M146 153 h8" stroke="#d8d2c4" stroke-width="3.5"/>
    <path d="M150 252 q-46 8 -66 30 q-12 26 -6 78 l144 0 q6 -52 -6 -78 q-20 -22 -66 -30 Z"
          fill="#68788a" stroke="${SKIN.line}" stroke-width="3.5"/>
    <!-- 大号浅色背包的两条肩带 -->
    <path d="M126 258 q-8 50 -6 102 M174 258 q8 50 6 102" stroke="#ded5c6" stroke-width="12" fill="none" stroke-linecap="round"/>
  `, '#2a3240', '#0b0d14'),

  /* ---- 承泽湖畔的谪仙女子（序章，原文未具名） ----
     「肌肤莹润如若冰雪，映着粼粼的华丽水光，比那冬日里映着阳光奕奕生辉的霜雪
       还要耀眼，目似皎月、唇似粉樱……弯月般的细长柳眉、明澈潋滟的翦水双瞳、
       光洁玉润的胜雪香腮、花瓣似的柔唇。」
     肌肤如冰雪 → 肤色最白；细长柳眉 → 眉最细；翦水双瞳 → narrow + 冰蓝。 */
  lake: e => svgWrap(`
    ${hairSide('#1d2440', 312)}
    ${face({ id: 'lake' + e, expr: e, eye: '#9fdcff', glow: '#e4f6ff', brow: '#5a5470', blush: '#ffd0da', skin: '#fff2ea', faceShape: 'oval', eyeShape: 'narrow', eyeSpacing: 1.04, browThick: 3 })}
    ${hairCap('#232b4c', { vol: 48, side: 164, line: 100 })}
    <!-- 冰纨银纱 -->
    <path d="M150 252 q-56 10 -78 36 q-10 28 -4 72 l164 0 q6 -44 -4 -72 q-22 -26 -78 -36 Z"
          fill="#a8cfec" stroke="${SKIN.line}" stroke-width="3.5"/>
    <path d="M150 258 q-32 26 -38 102 M150 258 q32 26 38 102" stroke="#f0faff" stroke-width="5" fill="none" opacity=".85"/>
    <path d="M104 290 q46 -18 92 0" stroke="#ffffff" stroke-width="3" fill="none" opacity=".55"/>
  `, '#16324a', '#080c16'),

  /* ---- 大胖子（序章，华夏国最高首长的独生子） ----
     「一个身体粗壮，粗壮中又呈现着明显肥胖的男子……他不但又肥又壮，身高也同样
       惊人，粗看之下足有近两米左右。」「眼睛半眯着看着自己脚尖。」
     半眯 → narrow + 窄眼距；肥 → round 脸 + 最粗的眉 + 不点腮红。 */
  fatman: e => svgWrap(`
    ${face({ id: 'fatman' + e, expr: e, eye: '#6a5030', glow: '#7a5a34', brow: '#120c06', blush: null, skin: '#e8c2a0', faceShape: 'round', eyeShape: 'narrow', eyeSpacing: 0.9, browThick: 10 })}
    ${hairCap('#171310', { vol: 66, side: 150, line: 108 })}
    <path d="M150 250 q-72 10 -96 38 q-10 30 -4 72 l200 0 q6 -42 -4 -72 q-24 -28 -96 -38 Z"
          fill="#3f3a33" stroke="${SKIN.line}" stroke-width="3.5"/>
    <path d="M150 252 l-20 12 l20 40 l20 -40 Z" fill="#1c1c18" stroke="${SKIN.line}" stroke-width="3"/>
  `, '#2e2a1e', '#0c0a08'),

  /* ---- 接待小姐（第1章，《命运》设备发放点） ----
     「接待小姐报以职业化的微笑」「配得上『赏心悦目』四个字的少女」。
     ⚠ 原文没有写她的五官，这里只按「职业装 + 得体」配，属推测。 */
  clerk: e => svgWrap(`
    ${hairSide('#33241a', 286)}
    ${face({ id: 'clerk' + e, expr: e, eye: '#7a5240', glow: '#c89a76', brow: '#40301f', blush: '#ffb4bc', skin: '#fbe2cd', faceShape: 'oval', eyeShape: 'big', browThick: 4 })}
    ${hairCap('#3a2a1e', { vol: 56, side: 158, line: 100 })}
    <path d="M150 252 q-48 8 -68 32 q-12 26 -6 76 l148 0 q6 -50 -6 -76 q-20 -24 -68 -32 Z"
          fill="#eef0f6" stroke="${SKIN.line}" stroke-width="3.5"/>
    <path d="M150 254 l-22 10 l22 40 l22 -40 Z" fill="#3a4258" stroke="${SKIN.line}" stroke-width="3"/>
  `, '#3a3648', '#0c0b12'),

  /* ---- 普洛斯（第6章，天外集团总裁、《命运》主研发者） ----
     「虽然年事已高，但声音依旧中气十足，两只偶尔闪过精芒的双目没有一丝的浑浊。」
     年事已高 → 白发白须、肤色偏枯；双目没有一丝浑浊 → 瞳色最亮。 */
  prolos: e => svgWrap(`
    ${face({ id: 'prolos' + e, expr: e, eye: '#a8e4ff', glow: '#e8f8ff', brow: '#dcd8d0', blush: null, skin: '#e8cdb4', faceShape: 'square', eyeShape: 'sharp', browThick: 6 })}
    ${hairCap('#e6e2da', { vol: 64, side: 152, line: 104 })}
    <!-- 白色的胡须 -->
    <path d="M112 214 q38 28 76 0 q-4 44 -38 48 q-34 -4 -38 -48 Z" fill="#e6e2da" stroke="${SKIN.line}" stroke-width="3"/>
    <path d="M150 252 q-52 8 -74 34 q-10 26 -4 74 l156 0 q6 -48 -4 -74 q-22 -26 -74 -34 Z"
          fill="#232a3e" stroke="${SKIN.line}" stroke-width="3.5"/>
    <path d="M150 254 l-24 12 l24 46 l24 -46 Z" fill="#c8b07a" stroke="${SKIN.line}" stroke-width="3"/>
  `, '#2a2e3e', '#0a0b10'),

  /* ---- 被封印的老人（第8章） ----
     「身体太过干枯瘦小，一张脸也如干枯如树皮，整个身体竟像是和树融合到一起了
       一般……那双腿盘坐在地上一动不动，裸露出的部分竟然呈现着灰暗的颜色。」
     脸如树皮 → 肤色取枯木、不点腮红、脸上加皲裂；双腿石化 → 灰。 */
  sealed: e => svgWrap(`
    ${face({ id: 'sealed' + e, expr: e, eye: '#8a7650', glow: '#7a6a44', brow: '#4e4434', blush: null, skin: '#a89272', faceShape: 'sharp', eyeShape: 'droop', eyeSpacing: 0.97, browThick: 5 })}
    ${hairCap('#6b6354', { vol: 70, side: 146, line: 106 })}
    <!-- 树皮一样的皲裂 -->
    <path d="M116 168 l10 28 M184 168 l-10 28 M150 196 l0 24 M130 214 l8 16 M170 214 l-8 16
             M108 186 l12 6 M192 186 l-12 6"
          stroke="#5e5240" stroke-width="2.5" fill="none" opacity=".8"/>
    <path d="M150 250 q-54 10 -76 36 q-10 28 -4 74 l160 0 q6 -46 -4 -74 q-22 -26 -76 -36 Z"
          fill="#5f5646" stroke="${SKIN.line}" stroke-width="3.5"/>
    <!-- 石化的双腿：灰暗色 -->
    <path d="M104 318 q46 -14 92 0 l0 42 l-92 0 Z" fill="#8f8f8f" stroke="${SKIN.line}" stroke-width="3"/>
    <path d="M120 328 l6 32 M150 324 l0 36 M180 328 l-6 32" stroke="#6e6e6e" stroke-width="2.5" fill="none"/>
  `, '#2e2a1c', '#0a0906'),

  /* ---- 果果（第9章，从黑色挂饰的白光里出来） ----
     原文第9章：「这是一个**头发漆黑，目如星钻，皮肤和衣裙又纯白无暇**的小女孩
       ……不仅仅是她看上去最多十二三岁的年纪，就连她的身体，粗看只看也不过
       三十公分的高度。」
     第10章：「那双**漆黑的眼睛**顿时亮了一下，如同镶嵌了两颗小星星一般扑闪扑闪」
       「她那张小小的脸儿却是无比的精致，可爱之中呈现着不带一丝瑕疵，
         不染一丝凡尘的完美美感。」
     ⚠ 第一版画成了白发白瞳，两处都错——原文写的是**漆黑的头发、漆黑的眼睛**，
     纯白无暇的是**皮肤和衣裙**。「星钻」指的是眼里的星芒，不是瞳色发白。 */
  guoguo: e => svgWrap(`
    ${hairSide('#0e0b16', 320)}
    ${face({ id: 'guoguo' + e, expr: e, eye: '#241c30', glow: '#ffffff', brow: '#1a1424', blush: '#ffc0ce', skin: '#fffaf8', faceShape: 'round', eyeShape: 'big', eyeSpacing: 1.08, browThick: 3 })}
    ${hairCap('#14101c', { vol: 42, side: 168, line: 96 })}
    <!-- 星钻般的眼芒 -->
    <path d="M129 143 l3 -10 l3 10 l10 3 l-10 3 l-3 10 l-3 -10 l-10 -3 Z" fill="#ffffff"/>
    <path d="M168 143 l3 -10 l3 10 l10 3 l-10 3 l-3 10 l-3 -10 l-10 -3 Z" fill="#ffffff"/>
    <!-- 裙裳 -->
    <path d="M150 250 q-38 8 -54 28 q-20 34 -24 82 l156 0 q-4 -48 -24 -82 q-16 -20 -54 -28 Z"
          fill="#fff8fc" stroke="${SKIN.line}" stroke-width="3.5"/>
    <path d="M108 318 q42 -12 84 0" stroke="#ffc6de" stroke-width="4" fill="none"/>
    <path d="M150 252 l-14 10 l14 26 l14 -26 Z" fill="#ffdcec" stroke="${SKIN.line}" stroke-width="2.5"/>
  `, '#3c3458', '#0d0a18'),
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

/* ---------------- 图片立绘（可选，优先于代码画的） ----------------

   程序化 SVG 画到头也就是个几何拼脸，真要好看还得上图。
   所以留一条通道：把图片丢进 `art/portraits/`，游戏自动改用图片，
   没有的角色继续用代码画的那张，不需要改任何代码。

   命名（放在 art/portraits/ 下）：
     kaito.png            该角色的默认立绘，所有表情都用它
     kaito-angry.png      可选，某个表情的专用图；没有就退回默认立绘
   表情名见 EXPRESSIONS：normal / angry / hurt / cry / shout / smile
   支持 .png / .webp / .jpg。

   清单由 `node tools/gen-art.mjs` 扫描目录生成（和装备图鉴一个套路），
   这样浏览器不用去猜文件在不在、也不会满控制台 404。 */
let ART = {};
export function setArtManifest(m) { ART = m || {}; }
/* 启动时异步读一次清单；读不到就当没有图片，静默退回程序化立绘。 */
export async function loadArtManifest(base = 'art/portraits/manifest.json') {
  try {
    const r = await fetch(base, { cache: 'no-cache' });
    if (!r.ok) return false;
    ART = await r.json();
    return true;
  } catch (e) { return false; }
}

export function portraitURL(id, expr) {
  const a = ART[id];
  if (a) {
    if (expr && a[expr]) return a[expr];
    if (a.normal) return a.normal;
  }
  const v = VARIANTS[id] || VARIANTS.kaito;
  return v[expr] || v.normal;
}
/* 这张立绘现在用的是图片还是代码画的——面板与校验脚本要用 */
export function portraitIsArt(id) { return !!(ART[id] && ART[id].normal); }
export function hasPortrait(id) { return !!VARIANTS[id]; }

export default PORTRAITS;
