/* 《邪龙逆天》流程装配。

   当前活跃流程：chapter-destiny.js —— 第一卷「永恒命运之刻」的已实现部分
   （序章 ~ 第八章「杀狼！」）。事件顺序、人物、设定数值按原文，
   台词与场景文字为重写。详见该文件头部说明。

   2026-09-15：《炎之刃》与上一版原创虚构的剧情文件
   （chapter-one / journey / finale / beyond / rebirth）已从仓库删除，
   连同羁绊（bonds.js）、遗物（relics.js）、连携、营地补给、商店、
   三地支援、旅程结算与二周目——这些系统原著中都不存在。 */
import { DESTINY, DESTINY_ENDINGS } from './chapter-destiny.js';

export const ENDINGS = { ...DESTINY_ENDINGS };
export const SCENES = { ...DESTINY };

for (const [id, sc] of Object.entries(SCENES)) {
  sc.id = id;
  // 奖励只执行一次，读档重播台词不会重复发装备 / 经验 / 队友。
  sc.once = true;
}

export default { SCENES, ENDINGS };
