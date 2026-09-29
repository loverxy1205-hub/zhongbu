import type { Knowledge } from "../../types";

export const GEOMANCY_SOURCE =
  "https://swh.princeton.edu/~ezb/geomancy/agrippa.html";
export const GEOMANCY_VERSION = "geomancy-shield-1";

export interface GeomanticFigure extends Knowledge {
  code: string;
  latin: string;
  aliases: string[];
  traditional: string;
}

const entries: [
  string,
  string,
  string,
  string[],
  string,
  Knowledge["themes"],
  string,
][] = [
  [
    "via",
    "1111",
    "道路",
    ["Via", "Way"],
    "流动不等于失控。留意正在变化的路径，以及哪些安排需要随着进程调整。",
    ["变化", "推进"],
    "道路",
  ],
  [
    "populus",
    "0000",
    "众人",
    ["Populus", "People"],
    "把个体放回环境之中观察：共同节奏能托住你，也可能遮住自己的判断。",
    ["等待", "沟通"],
    "众人",
  ],
  [
    "fortuna-major",
    "0011",
    "大幸运",
    ["Fortuna Major", "The greater Fortune"],
    "可持续的支撑比一时的热度更值得辨认。先看已经积累的基础，再谈如何延续。",
    ["准备", "推进"],
    "大幸运",
  ],
  [
    "fortuna-minor",
    "1100",
    "小幸运",
    ["Fortuna Minor", "The lesser Fortune"],
    "短暂的助力可能有用，但不宜当成永久保障。辨认哪些便利依赖时机或他人支持。",
    ["推进", "审慎"],
    "小幸运",
  ],
  [
    "acquisitio",
    "0101",
    "获得",
    ["Acquisitio", "Gain"],
    "关注增加的资源、经验或承诺，同时留出容纳它们的空间；得到更多也可能增加负担。",
    ["准备", "推进"],
    "获得",
  ],
  [
    "amissio",
    "1010",
    "失去",
    ["Amissio", "Loss"],
    "减去某项投入也可能腾出空间。区分主动放下与尚未处理的流失，不把失去一概看作惩罚。",
    ["边界", "变化"],
    "失去",
  ],
  [
    "laetitia",
    "1000",
    "喜悦",
    ["Laetitia", "Joy"],
    "注意让事情变轻、让视野打开的条件。把愉悦当作观察线索，而不把好心情当作保证。",
    ["沟通", "推进"],
    "喜悦",
  ],
  [
    "tristitia",
    "0001",
    "忧思",
    ["Tristitia", "Sorrow"],
    "为沉重与缓慢留一个位置。先整理承受范围，再决定是否继续增加要求。",
    ["休整", "审慎"],
    "忧伤",
  ],
  [
    "puella",
    "1011",
    "少女",
    ["Puella", "Girl"],
    "柔和的协调可以减少摩擦，但维持和谐不必以压下自己的需求为代价。",
    ["沟通", "边界"],
    "少女",
  ],
  [
    "puer",
    "1101",
    "少年",
    ["Puer", "Boy"],
    "行动冲劲需要方向和边界。辨认勇于开始与急于取胜之间的差别。",
    ["推进", "审慎"],
    "少年",
  ],
  [
    "albus",
    "0010",
    "白",
    ["Albus", "White"],
    "降低噪声，让信息有机会被听见。清晰可能来自留白、观察和耐心，而非立即回应。",
    ["审慎", "休整"],
    "白",
  ],
  [
    "rubeus",
    "0100",
    "红",
    ["Rubeus", "Red"],
    "热度、欲望与紧张都需要出口。先辨认正在升高的力量，再为它选择不伤人的表达方式。",
    ["边界", "审慎"],
    "红",
  ],
  [
    "conjunctio",
    "0110",
    "会合",
    ["Conjunctio", "Conjunction"],
    "不同路径正在交接。连接能带来合作，也会增加协调成本，值得说清彼此如何配合。",
    ["沟通", "变化"],
    "会合",
  ],
  [
    "carcer",
    "1001",
    "围限",
    ["Carcer", "Prison"],
    "限制既可能保护专注，也可能阻住转身。把必须保留的界线和可以松动的束缚分开。",
    ["边界", "等待"],
    "囚限",
  ],
  [
    "caput-draconis",
    "0111",
    "龙首",
    ["Caput Draconis", "Dragon’s head"],
    "一个入口意味着需要适应新条件。先辨认进入的门槛、需要的准备和愿意承担的角色。",
    ["准备", "变化"],
    "龙首",
  ],
  [
    "cauda-draconis",
    "1110",
    "龙尾",
    ["Cauda Draconis", "Dragon’s tail"],
    "结束也需要收尾。查看哪些联系值得保留、哪些负担可以有意识地告别。",
    ["变化", "边界"],
    "龙尾",
  ],
];

/** Four rows, top to bottom; 1 is one dot, 0 is two dots. Checked against S1 fig. 1. */
export const GEOMANTIC_FIGURES: readonly GeomanticFigure[] = entries.map(
  ([id, code, name, aliases, meaning, themes, historicalName]) => ({
    id: `gm-${id}`,
    code,
    name,
    latin: aliases[0],
    aliases,
    keywords: [name, ...themes],
    meaning,
    themes,
    traditional: `传统图名：${aliases[0]}（${historicalName}）。图形与名称据 Turner 1655 图表核对；此处不引用十二宫断辞。`,
    conditions: "用于本版盾形图中该位置的象征观察；位置与派生关系须一并阅读。",
    limits:
      "中文主题与情境联想由本站整理；不是对人物性别、未来事实或吉凶的判定。",
    source: `${GEOMANCY_SOURCE} · 开篇十六图表 hcafig1.gif`,
  }),
);

export function figureFor(code: string): GeomanticFigure {
  const figure = GEOMANTIC_FIGURES.find((item) => item.code === code);
  if (!figure) throw Error("无效的地占四行编码");
  return figure;
}
