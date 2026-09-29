export type EngineId = "tarot" | "iching" | "meihua" | "numerology" | "runes";
export type SingleRevealEngine = "iching" | "meihua" | "numerology";
export type Theme =
  "推进" | "准备" | "审慎" | "休整" | "沟通" | "边界" | "变化" | "等待";
export type Category = "日常" | "学业" | "工作" | "人际" | "自我探索" | "其他";
export type Scene =
  "无预设" | "上课安排" | "任务推进" | "休息安排" | "沟通联系" | "一般选择";
export type Position = "现状" | "阻力" | "提示";
export interface Knowledge {
  id: string;
  name: string;
  keywords: string[];
  meaning: string;
  themes: Theme[];
  conditions: string;
  limits: string;
  source: string;
}
export interface TarotCard extends Knowledge {
  kind: string;
  english: string;
  reversedMeaning: string;
  reversedThemes: Theme[];
}
export interface Rune extends Knowledge {
  symbol: string;
}
export interface Hexagram extends Knowledge {
  number: number;
  code: string;
  upper: string;
  lower: string;
  original: string;
  lines: string[];
  lineMeanings: string[];
  extra: string[];
}
export interface Input {
  question: string;
  /** Only retained for reading pre-v1.2 records. New forms do not use categories. */
  category?: Category;
  mode: "action" | "explore";
  scene: Scene;
  action: string;
  options?: string[];
  targetDate: string;
  timezone: string;
  engines: EngineId[];
  birthday: string;
  reversals: boolean;
  everydayOnly: boolean;
}
export type PublicInput = Omit<Input, "birthday">;
export type CardDraw = { id: string; reversed: boolean; position: Position };
export type TarotRaw = { kind: "tarot"; cards: CardDraw[] };
export type RuneRaw = {
  kind: "runes";
  runes: { id: string; position: Position }[];
};
export type CoinValue = 6 | 7 | 8 | 9;
export type IChingRaw = {
  kind: "iching";
  coins: number[][];
  values: CoinValue[];
  code: string;
  changedCode: string;
  moving: number[];
};
export type MeihuaRaw = {
  kind: "meihua";
  Y: number;
  M: number;
  D: number;
  H: number;
  upper: number;
  lower: number;
  moving: number;
  code: string;
  changedCode: string;
  body: string;
  use: string;
  relationship: string;
  lunar: string;
  local: string;
  leap: boolean;
};
export type NumberRaw = {
  kind: "numerology";
  life: number;
  year: number;
  month: number;
  day: number;
  trace: string[];
};
export type Raw = TarotRaw | RuneRaw | IChingRaw | MeihuaRaw | NumberRaw;
export interface Paragraph {
  label: string;
  text: string;
  knowledgeId: string;
  ruleId: string;
  templateId: string;
}
export type Inclination = "倾向行动" | "有条件行动" | "倾向暂缓" | "无明确倾向";
export interface Interpretation {
  headline: string;
  themes: Theme[];
  paragraphs: Paragraph[];
  reflection: Paragraph[];
  traditional: Paragraph[];
  inclination: Inclination;
  inclinationReason: string;
  sources: string[];
  limits: string[];
}
export interface EngineResult {
  engine: EngineId;
  methodVersion: string;
  status: "ok" | "unavailable";
  error?: string;
  raw?: Raw;
  interpretation?: Interpretation;
}
export interface Reading {
  readingId: string;
  askedAt: string;
  input: PublicInput;
  results: EngineResult[];
  versions: {
    app: string;
    knowledge: string;
    rules: string;
    templates: string;
    calendar: string;
    schema: 1;
  };
}
export interface Preferences {
  pinned: EngineId[];
  liked: EngineId[];
  favorites: EngineId[];
  included: EngineId[];
}
export interface SavedReading {
  reading: Reading;
  preferences: Preferences;
  savedAt: string;
  /** Presentation only; absent means a legacy reading already revealed. */
  tarotRevealed?: number[];
  runeRevealed?: number[];
  engineRevealed?: SingleRevealEngine[];
  enhancements?: Partial<Record<EngineId, AiEnhancement>>;
}
export interface AiEnhancement {
  request: import("../shared/ai-contract").AiRequest;
  response: import("../shared/ai-contract").AiResponse;
  contextIncluded: boolean;
}
