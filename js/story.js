/* 《邪龙逆天》流程装配。

   当前活跃流程：chapter-destiny.js —— 第一卷「永恒命运之刻」的已实现部分
   （序章 ~ 第八章「杀狼！」）。事件顺序、人物、设定数值按原文，
   台词与场景文字为重写。详见该文件头部说明。

   已退役的文件（保留在仓库，未挂进流程）：
     · chapter-rebirth.js —— 上一版开场。天阙公会战、执圭、逆骨之守、
       苍梧区服等内容为原创虚构，与原著不符，已整体停用。
     · chapter-one / journey / finale / beyond —— 改造前《炎之刃》的剧情。 */
import { DESTINY, DESTINY_ENDINGS } from './chapter-destiny.js';

export const ENDINGS = { ...DESTINY_ENDINGS };
export const SCENES = { ...DESTINY };

for (const [id, sc] of Object.entries(SCENES)) {
  sc.id = id;
  // 奖励只执行一次，读档重播台词不会重复发装备 / 经验 / 队友。
  sc.once = true;
}

export default { SCENES, ENDINGS };
