import type { Knowledge, MatrixDigit, Theme } from "../types";
import { SOURCES } from "./meta";
const rows: [string, Theme, string][] = [
  ["起点", "推进", "把意愿集中在一个起点，辨认自己真正想开启的事。"],
  ["协调", "沟通", "关系与配合成为观察重点，给倾听和协商留出余地。"],
  ["表达", "沟通", "让想法获得表达的形式，也留意听众的理解。"],
  ["基础", "准备", "日常秩序与具体练习，为变化提供承托。"],
  ["变化", "变化", "尝试不同路径可以带来启发，仍需辨认现实边界。"],
  ["照料", "休整", "关心与责任需要平衡，别忘了把自己也放进照料范围。"],
  ["内省", "等待", "为观察与独立思考留白，尚未明白的事可以继续探索。"],
  ["统筹", "审慎", "资源与责任相互联系，检查安排的可持续性。"],
  ["收束", "变化", "整理经验、完成收尾，为下一段安排腾出空间。"],
];
export const NUMBERS: Knowledge[] = rows.map(([name, theme, meaning], i) => ({
  id: `number-${i + 1}`,
  name: `${i + 1} · ${name}`,
  keywords: [name, theme],
  meaning,
  themes: [theme],
  conditions: "简化个人日；目标日期为公历。",
  limits: "本站采用的现代象征规则，不描述人格定论或未来事件。",
  source: SOURCES.numbers,
}));

export const MATRIX_DIGITS: readonly MatrixDigit[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9,
];
/** Grid is read row by row, not a Lo Shu magic square. */
export const MATRIX_LAYOUT: readonly MatrixDigit[] = [
  1, 4, 7, 2, 5, 8, 3, 6, 9,
];
export const MATRIX_NUMBERS: Knowledge[] = rows.map(
  ([name, theme, meaning], i) => ({
    id: `matrix-number-${i + 1}`,
    name: `${i + 1} · ${name}`,
    keywords: [name, theme],
    meaning,
    themes: [theme],
    conditions:
      "生日数字九宫格：公历生日原始数字入格，忽略 0，保留重复；不添加四工作数。",
    limits:
      "本站现代象征解读。次数不是能力或人格评分，空格不表示缺陷；不推断健康、智商、财富或命运。",
    source: SOURCES.matrix,
  }),
);
