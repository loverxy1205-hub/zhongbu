import { z } from "zod";
import { aiRequestSchema, aiResponseSchema } from "../../shared/ai-contract";
const engine = z.enum(["tarot", "iching", "meihua", "numerology", "runes"]);
const position = z.enum(["现状", "阻力", "提示"]);
const theme = z.enum([
  "推进",
  "准备",
  "审慎",
  "休整",
  "沟通",
  "边界",
  "变化",
  "等待",
]);
const code = z.string().regex(/^[01]{6}$/);
const digit = z.number().int().min(1).max(9),
  line = z.number().int().min(1).max(6);
const para = z.object({
  label: z.string(),
  text: z.string(),
  knowledgeId: z.string(),
  ruleId: z.string(),
  templateId: z.string(),
});
const input = z
  .object({
    question: z.string().max(2000),
    category: z.enum(["日常", "学业", "工作", "人际", "自我探索", "其他"]),
    mode: z.enum(["action", "explore"]),
    scene: z.enum([
      "无预设",
      "上课安排",
      "任务推进",
      "休息安排",
      "沟通联系",
      "一般选择",
    ]),
    action: z.string().max(300),
    targetDate: z.string(),
    timezone: z.string(),
    engines: z.array(engine).min(1).max(5),
    reversals: z.boolean(),
    everydayOnly: z.boolean(),
  })
  .strict();
const raw = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("tarot"),
    cards: z
      .array(
        z.object({
          id: z
            .string()
            .regex(
              /^tarot-(major-(?:[0-9]|1[0-9]|2[01])|[0-3]-(?:[0-9]|1[0-3]))$/,
            ),
          reversed: z.boolean(),
          position,
        }),
      )
      .length(3),
  }),
  z.object({
    kind: z.literal("runes"),
    runes: z
      .array(
        z.object({
          id: z.string().regex(/^rune-([1-9]|1[0-9]|2[0-4])$/),
          position,
        }),
      )
      .length(3),
  }),
  z.object({
    kind: z.literal("iching"),
    coins: z
      .array(z.array(z.union([z.literal(2), z.literal(3)])).length(3))
      .length(6),
    values: z
      .array(z.union([z.literal(6), z.literal(7), z.literal(8), z.literal(9)]))
      .length(6),
    code,
    changedCode: code,
    moving: z.array(line).max(6),
  }),
  z.object({
    kind: z.literal("meihua"),
    Y: z.number().int().min(1).max(12),
    M: z.number().int().min(1).max(12),
    D: z.number().int().min(1).max(30),
    H: z.number().int().min(1).max(12),
    upper: z.number().int().min(1).max(8),
    lower: z.number().int().min(1).max(8),
    moving: line,
    code,
    changedCode: code,
    body: z.string(),
    use: z.string(),
    relationship: z.string(),
    lunar: z.string(),
    local: z.string(),
    leap: z.boolean(),
  }),
  z.object({
    kind: z.literal("numerology"),
    life: digit,
    year: digit,
    month: digit,
    day: digit,
    trace: z.array(z.string()),
  }),
]);
const interpretation = z.object({
  headline: z.string(),
  themes: z.array(theme),
  paragraphs: z.array(para),
  reflection: z.array(para),
  traditional: z.array(para),
  inclination: z.enum(["倾向行动", "有条件行动", "倾向暂缓", "无明确倾向"]),
  inclinationReason: z.string(),
  sources: z.array(z.string()),
  limits: z.array(z.string()),
});
const result = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("ok"),
      engine,
      methodVersion: z.string(),
      raw,
      interpretation,
    })
    .refine((r) => r.raw.kind === r.engine),
  z.object({
    status: z.literal("unavailable"),
    engine,
    methodVersion: z.string(),
    error: z.string(),
  }),
]);
export const savedSchema = z.object({
  reading: z.object({
    readingId: z.string().regex(/^zb-[0-9a-f]{32}$/),
    askedAt: z.iso.datetime(),
    input,
    results: z.array(result).min(1).max(5),
    versions: z.object({
      app: z.string(),
      knowledge: z.string(),
      rules: z.string(),
      templates: z.string(),
      calendar: z.string(),
      schema: z.literal(1),
    }),
  }),
  preferences: z.object({
    pinned: z.array(engine),
    liked: z.array(engine),
    favorites: z.array(engine),
    included: z.array(engine),
  }),
  savedAt: z.string(),
  enhancements: z
    .partialRecord(
      engine,
      z.object({
        request: aiRequestSchema,
        response: aiResponseSchema,
        contextIncluded: z.boolean(),
      }),
    )
    .optional(),
});
