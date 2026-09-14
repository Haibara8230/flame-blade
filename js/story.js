/* 《邪龙逆天》流程装配。

   当前活跃流程是 chapter-rebirth.js（序章 ~ 第四章，一转 + 第一场公会战）。

   原《炎之刃》的四个章节文件（chapter-one / journey / finale / beyond）
   仍留在仓库里，但已经从流程中摘出去——它们的台词全部建立在旧角色
   （凯 / 苍 / 雷 / 璃）和旧世界观上，在新阵容下会读成另一个游戏。
   要么整段重写，要么不挂。现在选择不挂，等后续章节按网游文的节拍补齐。 */
import { REBIRTH, REBIRTH_ENDINGS } from './chapter-rebirth.js';

export const ENDINGS = { ...REBIRTH_ENDINGS };
export const SCENES = { ...REBIRTH };

for (const [id, sc] of Object.entries(SCENES)) {
  sc.id = id;
  // 奖励只执行一次，读档重播台词不会重复发装备 / 经验 / 队友。
  sc.once = true;
}

export default { SCENES, ENDINGS };
