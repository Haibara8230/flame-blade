/* 《炎之刃：不熄之约》完整流程，按章节拆分维护。 */
import { CHAPTER_ONE } from './chapter-one.js';
import { JOURNEY } from './chapter-journey.js';
import { FINALE, ENDINGS } from './chapter-finale.js';
export { ENDINGS };
export const SCENES = { ...CHAPTER_ONE, ...JOURNEY, ...FINALE };
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
