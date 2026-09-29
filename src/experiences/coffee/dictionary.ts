import type { Theme } from "../../types";

export const COFFEE_DICTIONARY_VERSION = "cf-symbols-1" as const;
export const COFFEE_SOURCES = [
  "https://ich.unesco.org/en/decisions/8.COM/8.28",
  "https://goturkiye.com/blog/turkish-coffee-culture",
] as const;

/** Original reflection prompts, never classifications or predictions. */
export const COFFEE_SYMBOLS: readonly {
  id: string;
  name: string;
  prompt: string;
  theme: Theme;
}[] = [
  {
    id: "bird",
    name: "鸟",
    prompt:
      "把它作为消息与距离的联想：眼下有哪些信息值得核实，而不是凭猜测补足？",
    theme: "沟通",
  },
  {
    id: "tree",
    name: "树",
    prompt: "把它作为积累与支撑的联想：什么基础正在滋养你，什么需要时间生长？",
    theme: "准备",
  },
  {
    id: "road",
    name: "道路",
    prompt:
      "把它作为路径的联想：正在走的方向与想抵达的地方之间，还缺哪一段连接？",
    theme: "推进",
  },
  {
    id: "bridge",
    name: "桥",
    prompt: "把它作为连接的联想：两边各有什么条件，彼此如何才能真正接上？",
    theme: "沟通",
  },
  {
    id: "mountain",
    name: "山",
    prompt:
      "把它作为阻力与尺度的联想：需要面对的是具体障碍，还是被放大的想象？",
    theme: "审慎",
  },
  {
    id: "ring",
    name: "环",
    prompt:
      "把它作为循环与约定的联想：哪些承诺仍然合适，哪些模式值得重新看一遍？",
    theme: "边界",
  },
  {
    id: "key",
    name: "钥匙",
    prompt:
      "把它作为入口的联想：你真正缺的是权限、信息、工具，还是清楚表达的机会？",
    theme: "准备",
  },
  {
    id: "door",
    name: "门",
    prompt:
      "把它作为进入与退出的联想：这道边界由谁决定，你愿意以什么条件跨过？",
    theme: "边界",
  },
  {
    id: "boat",
    name: "船",
    prompt:
      "把它作为承载与同行的联想：这段路上需要带走什么，又有哪些负担可以放下？",
    theme: "变化",
  },
  {
    id: "leaf",
    name: "叶",
    prompt:
      "把它作为季节与节奏的联想：当前的环境适合生长、维持，还是暂时收拢？",
    theme: "休整",
  },
  {
    id: "flower",
    name: "花",
    prompt: "把它作为表达与绽放的联想：什么值得被看见，你又希望怎样表达它？",
    theme: "沟通",
  },
  {
    id: "star",
    name: "星",
    prompt:
      "把它作为参照的联想：有哪些价值能帮助你辨认方向，而不替你保证结果？",
    theme: "准备",
  },
  {
    id: "moon",
    name: "月",
    prompt:
      "把它作为变化与可见性的联想：哪些部分已经清楚，哪些仍需要等待更多信息？",
    theme: "等待",
  },
  {
    id: "sun",
    name: "太阳",
    prompt: "把它作为注意力的联想：现在最值得照亮和说清楚的是哪件事？",
    theme: "推进",
  },
  {
    id: "heart",
    name: "心",
    prompt:
      "把它作为关心的联想：自己的需要与对他人的期待，是否已经分清并表达？",
    theme: "沟通",
  },
  {
    id: "fish",
    name: "鱼",
    prompt:
      "把它作为环境与活动空间的联想：什么条件让你行动自如，什么条件限制了余地？",
    theme: "边界",
  },
  {
    id: "ladder",
    name: "梯",
    prompt: "把它作为层次与顺序的联想：眼前任务之间有哪些真实的前置条件？",
    theme: "准备",
  },
  {
    id: "house",
    name: "屋",
    prompt: "把它作为安顿与归属的联想：哪些人、地点或习惯能提供稳定的支持？",
    theme: "休整",
  },
  {
    id: "wave",
    name: "波浪",
    prompt: "把它作为起伏的联想：哪些变化属于外部环境，哪些节奏能够由你调整？",
    theme: "变化",
  },
  {
    id: "fork",
    name: "分岔",
    prompt:
      "把它作为选择条件的联想：比较方向时，你愿意优先保留什么、承担什么？",
    theme: "审慎",
  },
];
export const COFFEE_SYMBOL_IDS = [
  ...COFFEE_SYMBOLS.map((s) => s.id),
  "other",
  "uncertain",
];
export function coffeeSymbolName(id: string): string {
  return (
    COFFEE_SYMBOLS.find((s) => s.id === id)?.name ??
    (id === "other" ? "其他联想" : "不确定")
  );
}
