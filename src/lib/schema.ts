import { z } from "zod";
import { aiRequestSchema, aiResponseSchema } from "../../shared/ai-contract";
import {
  experienceSchema,
  isExperienceId,
  isExperienceRaw,
  interpretExperience,
} from "../experiences";
const engine = z.enum([
  "tarot",
  "iching",
  "meihua",
  "numerology",
  "runes",
  "geomancy",
  "coffee",
  "ifa",
  "jiaobei",
  "oracle",
]);
const position = z.enum(["现状", "阻力", "提示"]);
const tarotId = z
  .string()
  .regex(/^tarot-(major-(?:[0-9]|1[0-9]|2[01])|[0-3]-(?:[0-9]|1[0-3]))$/);
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
    category: z
      .enum(["日常", "学业", "工作", "人际", "自我探索", "其他"])
      .optional(),
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
    options: z
      .array(z.string().trim().min(1).max(300))
      .min(2)
      .max(10)
      .refine((values) => new Set(values).size === values.length)
      .optional(),
    targetDate: z.string(),
    timezone: z.string(),
    engines: z
      .array(engine)
      .min(1)
      .max(10)
      .refine((values) => new Set(values).size === values.length),
    reversals: z.boolean(),
    everydayOnly: z.boolean(),
  })
  .strict();
const legacyRaw = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("tarot"),
    cards: z
      .array(
        z.object({
          id: tarotId,
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
  z
    .object({
      kind: z.literal("numerology-matrix"),
      cells: z
        .array(
          z
            .object({
              digit,
              count: z.number().int().min(0).max(8),
            })
            .strict(),
        )
        .length(9)
        .refine(
          (cells) =>
            new Set(cells.map((cell) => cell.digit)).size === 9 &&
            cells.reduce((total, cell) => total + cell.count, 0) >= 1 &&
            cells.reduce((total, cell) => total + cell.count, 0) <= 8,
        ),
      trace: z.array(z.string()),
    })
    .strict(),
]);
const raw = z.union([legacyRaw, experienceSchema]);
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
      status: z.literal("pending"),
      engine,
      methodVersion: z.string(),
      raw: raw.optional(),
      observationInterpretations: z
        .array(
          z
            .object({
              id: z.number().int().min(1).max(8),
              interpretation,
              versions: z.object({
                app: z.string(),
                knowledge: z.string(),
                rules: z.string(),
                templates: z.string(),
                calendar: z.string(),
                schema: z.literal(1),
              }),
            })
            .strict(),
        )
        .max(8)
        .optional(),
    })
    .strict()
    .refine((r) =>
      r.engine === "tarot"
        ? r.raw === undefined
        : isExperienceId(r.engine) && r.raw?.kind === r.engine,
    ),
  z
    .object({
      status: z.literal("ok"),
      engine,
      methodVersion: z.string(),
      raw,
      interpretation,
      observationInterpretations: z
        .array(
          z
            .object({
              id: z.number().int().min(1).max(8),
              interpretation,
              versions: z.object({
                app: z.string(),
                knowledge: z.string(),
                rules: z.string(),
                templates: z.string(),
                calendar: z.string(),
                schema: z.literal(1),
              }),
            })
            .strict(),
        )
        .max(8)
        .optional(),
    })
    .refine(
      (r) =>
        r.raw.kind === r.engine ||
        (r.engine === "numerology" && r.raw.kind === "numerology-matrix"),
    ),
  z.object({
    status: z.literal("unavailable"),
    engine,
    methodVersion: z.string(),
    error: z.string(),
  }),
]);
export const savedSchema = z
  .object({
    activeEngine: engine.optional(),
    reading: z.object({
      readingId: z.string().regex(/^zb-[0-9a-f]{32}$/),
      askedAt: z.iso.datetime(),
      input,
      results: z
        .array(result)
        .min(1)
        .max(10)
        .refine(
          (values) =>
            new Set(values.map((r) => r.engine)).size === values.length,
        ),
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
    tarotRevealed: z
      .array(z.number().int().min(0).max(2))
      .max(3)
      .refine((values) => new Set(values).size === values.length)
      .optional(),
    runeRevealed: z
      .array(z.number().int().min(0).max(2))
      .max(3)
      .refine((values) => new Set(values).size === values.length)
      .optional(),
    engineRevealed: z
      .array(z.enum(["iching", "meihua", "numerology"]))
      .max(3)
      .refine((values) => new Set(values).size === values.length)
      .optional(),
    tarotDeck: z
      .array(z.object({ id: tarotId, reversed: z.boolean() }))
      .length(78)
      .refine((cards) => new Set(cards.map((card) => card.id)).size === 78)
      .optional(),
    tarotPicked: z
      .array(z.number().int().min(0).max(77))
      .max(3)
      .refine((picks) => new Set(picks).size === picks.length)
      .optional(),
    coinRounds: z.number().int().min(0).max(6).optional(),
    runeDrawn: z.number().int().min(0).max(3).optional(),
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
  })
  .superRefine((saved, ctx) => {
    const tarot = saved.reading.results.find((r) => r.engine === "tarot");
    const issue = () =>
      ctx.addIssue({ code: "custom", message: "揭晓进度与冻结结果不一致" });
    for (const r of saved.reading.results) {
      if (r.status !== "unavailable" && r.raw?.kind === "coffee") {
        const observations = r.raw.observations;
        const cached = r.observationInterpretations || [];
        if (
          cached.length !== observations.length ||
          observations.some(
            (observation) =>
              !cached.some((entry) => entry.id === observation.id),
          )
        )
          issue();
      }
      if ("observationInterpretations" in r && r.observationInterpretations) {
        if (
          r.raw?.kind !== "coffee" ||
          new Set(r.observationInterpretations.map((entry) => entry.id))
            .size !== r.observationInterpretations.length
        )
          issue();
        else {
          const coffee = r.raw;
          if (
            r.observationInterpretations.some(
              (entry) =>
                !coffee.observations.some(
                  (observation) => observation.id === entry.id,
                ),
            )
          )
            issue();
          if (
            r.status === "ok" &&
            JSON.stringify(
              r.observationInterpretations.find(
                (entry) => entry.id === coffee.activeVersion,
              )?.interpretation,
            ) !== JSON.stringify(r.interpretation)
          )
            issue();
        }
      }
      if (
        r.status !== "unavailable" &&
        r.raw &&
        isExperienceRaw(r.raw) &&
        (r.status === "ok") !==
          !!interpretExperience(r.raw, saved.reading.input)
      )
        issue();
    }
    if (saved.tarotDeck || saved.tarotPicked || tarot?.status === "pending") {
      if (!saved.tarotDeck || !saved.tarotPicked || !tarot) {
        issue();
        return;
      }
      if (tarot.status === "pending" && saved.tarotPicked.length >= 3) issue();
      if (tarot.status === "ok") {
        if (tarot.raw.kind !== "tarot" || saved.tarotPicked.length !== 3) {
          issue();
          return;
        }
        const cards = tarot.raw.cards;
        if (
          saved.tarotPicked.some(
            (slot, index) =>
              cards[index].id !== saved.tarotDeck![slot].id ||
              cards[index].reversed !== saved.tarotDeck![slot].reversed,
          )
        )
          issue();
      }
    }
    if (
      saved.runeDrawn !== undefined &&
      saved.runeDrawn < 3 &&
      saved.runeRevealed?.length
    )
      issue();
  });
