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

// 调查项目一次性完成，三条线索收齐才开放出口；存档保留每项进度。
export function investigation(id, chapter, intro, entries, next) {
  const nodes = {};
  const keys = entries.map((_, i) => `${id}_${i}`);
  nodes[id] = scene(chapter, intro, null, { choices: [
    ...entries.map((entry, i) => ({ ...choice(entry.title, keys[i]), unless: keys[i] })),
    { ...choice('整理线索，继续前进。', next, [], '完成上方所有调查后可继续。'), requireAll: keys },
  ] });
  entries.forEach((entry, i) => {
    nodes[keys[i]] = scene(chapter, entry.lines, id, { pre: [flag(keys[i]), ...(entry.actions || [])] });
  });
  return nodes;
}
