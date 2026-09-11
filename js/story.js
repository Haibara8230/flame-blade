/* 《炎之刃：不熄之约》完整流程，按章节拆分维护。 */
import { CHAPTER_ONE } from './chapter-one.js';
import { JOURNEY } from './chapter-journey.js';
import { FINALE, ENDINGS as P1_ENDINGS } from './chapter-finale.js';
import { BEYOND, BEYOND_ENDINGS } from './chapter-beyond.js';

export const ENDINGS = { ...P1_ENDINGS, ...BEYOND_ENDINGS };
export const SCENES = { ...CHAPTER_ONE, ...JOURNEY, ...FINALE, ...BEYOND };

/* 第一部的 TRUE / SECRET 结局接进第二部：
   把所有人都带回来的人，才有资格回头去问「门后面被关着的是谁」。
   NORMAL / BAD 仍然就此收尾。 */
SCENES.epilogue_true.next = 'part2_open';
SCENES.epilogue_true.ending = null;
SCENES.epilogue_true.partEnding = 'true';
SCENES.secret_resolve.next = 'part2_open';
SCENES.secret_resolve.ending = null;
SCENES.secret_resolve.partEnding = 'secret';
// 旧版稳定场景 ID 的入口映射；新增内容建议从新游戏体验。
const legacy = {
  c3_end: 's_shop', c4_alone: 'c4_believe', c5_sacrifice: 'c5_promise',
  secret_final: 'c5_final',
};
for (const [id, next] of Object.entries(legacy)) SCENES[id] = { lines: [], next };
for (const [id, sc] of Object.entries(SCENES)) {
  sc.id = id;
  // 新版奖励只执行一次，读档重播台词不会重复发装备/经验。
  sc.once = true;
}
export default { SCENES, ENDINGS };
