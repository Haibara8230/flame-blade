export const CHAPTERS = {
  forest: '第二章 · 森林记得名字', harbor: '第三章 · 没有开走的船',
  snow: '第四章 · 雪里的人', ruins: '第五章 · 父亲没有说完的话',
  castle: '第六章 · 逆着人群上城', final: '终章 · 让世界继续吵闹',
};
const BG = { forest: 'forest', harbor: 'harbor', snow: 'snow', ruins: 'void', castle: 'castle', final: 'void' };
export const scene = (chapter, lines, next, extra = {}) => ({ chapter: CHAPTERS[chapter], bg: BG[chapter], music: chapter === 'forest' ? 'forest' : chapter === 'snow' ? 'snow' : 'calm', lines, next, ...extra });
export const battle = (chapter, enemies, level, next, extra = {}) => ({ chapter: CHAPTERS[chapter], bg: BG[chapter], enemies: enemies.map(ref => ({ ref, level })), escape: false, next, ...extra });
export const choice = (text, goto, action = [], hint = '') => ({ text, goto, action, hint });
export const flag = (name, value = true) => ({ set: { [name]: value } });
export const branch = (name, yes, no) => ({ branch: { branch: name, yes, no } });

// 调查段落改为线性叙述：三条线索依次播完，不再让玩家逐项点选。
export function investigation(id, chapter, intro, entries, next) {
  // 原本的选项标题保留成旁白，衔接三段线索，读起来不会突然跳场。
  const lines = [...intro, ...entries.flatMap(e => [['旁白', `（${e.title}）`], ...e.lines])];
  const pre = entries.flatMap(e => e.actions || []);
  return { [id]: scene(chapter, lines, next, pre.length ? { pre } : {}) };
}
