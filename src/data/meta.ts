import type { EngineId } from "../types";
export const VERSIONS = {
  app: "1.4.0",
  knowledge: "2026.09.29-1",
  rules: "1.1.0",
  templates: "1.1.0",
  calendar: "lunar-typescript@1.8.6",
  schema: 1,
} as const;
export const ENGINE_IDS: EngineId[] = [
  "tarot",
  "iching",
  "meihua",
  "numerology",
  "runes",
];
export const ENGINES: Record<
  EngineId,
  {
    name: string;
    short: string;
    icon: string;
    description: string;
    version: string;
  }
> = {
  tarot: {
    name: "塔罗",
    short: "塔罗",
    icon: "✧",
    description: "78 张牌 · 现状 / 阻力 / 提示",
    version: "RWS 三张牌阵 v1",
  },
  iching: {
    name: "周易 · 三枚铜钱",
    short: "周易",
    icon: "☷",
    description: "六轮掷币 · 本卦与变卦",
    version: "三枚铜钱 v1",
  },
  meihua: {
    name: "梅花易数",
    short: "梅花",
    icon: "❋",
    description: "农历年月日時 · 简化体用",
    version: "年月日時起例 v1",
  },
  numerology: {
    name: "数字命理",
    short: "数字",
    icon: "⑨",
    description: "简化个人日版 · 需要生日",
    version: "简化个人日 v1",
  },
  runes: {
    name: "卢恩符文",
    short: "卢恩",
    icon: "ᚱ",
    description: "24 枚符文 · 现代三符文解读",
    version: "Elder Futhark 三符文 v1",
  },
};
export const DISCLAIMER = "用于文化体验与自我反思，不构成事实预测或专业建议。";
export const SOURCES = {
  tarot:
    "RWS 名称参照 A. E. Waite, The Pictorial Key to the Tarot (1910，公版)。中文释义与主题为本站自行整理，未使用商业牌面。",
  runes:
    "符号核对 Unicode Runic U+16A0–16FF；采用常见重建名称。中文象征解释为本站现代整理，不是统一的古代占卜规则。",
  numbers:
    "本站现代规则 v1：逐位相加归一到 1–9，不保留 11 / 22 / 33。主题及文案为本站整理。",
  meihua:
    "《梅花易數》卷一「年月日時起例」（维基文库公版古籍）；本卦、动爻、变卦共用周易知识库；五行体用为简化版。",
};
