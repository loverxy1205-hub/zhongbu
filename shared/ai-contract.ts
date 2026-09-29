import { z } from "zod";

// Deliberately separate from Reading: only a single, explicitly selected result
// and the disclosed context cross this boundary. Unknown fields are rejected.
const paragraphSchema = z
  .object({ label: z.string().max(200), text: z.string().max(4000) })
  .strict();

export const aiRequestSchema = z
  .object({
    readingId: z.string().min(1).max(128),
    engine: z.enum(["tarot", "iching", "meihua", "numerology", "runes"]),
    context: z
      .object({
        // Kept optional for requests and saved enhancements from older clients.
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
        targetDate: z.iso.date(),
        question: z.string().max(2000).optional(),
        action: z.string().max(500).optional(),
        options: z
          .array(
            z
              .string()
              .max(300)
              .refine((text) => text.trim().length > 0),
          )
          .min(2)
          .max(10)
          .refine(
            (options) =>
              new Set(options.map((option) => option.trim())).size ===
              options.length,
          )
          .optional(),
      })
      .strict(),
    evidence: z
      .object({
        methodVersion: z.string().min(1).max(120),
        headline: z.string().max(500),
        themes: z.array(z.string().max(40)).max(12),
        rawSummary: z.string().max(4000),
        paragraphs: z.array(paragraphSchema).max(16),
        reflection: z.array(paragraphSchema).max(16),
        traditional: z.array(paragraphSchema).max(16),
      })
      .strict(),
  })
  .strict();

export const aiResponseSchema = z
  .object({
    text: z.string().min(1).max(12000),
    model: z.string().min(1).max(100),
    generatedAt: z.iso.datetime(),
    promptVersion: z.string().min(1).max(100),
  })
  .strict();

export const aiErrorSchema = z
  .object({
    error: z.string(),
    code: z
      .enum([
        "UPSTREAM_FETCH_FAILED",
        "UPSTREAM_HTTP_ERROR",
        "UPSTREAM_BODY_ERROR",
        "UPSTREAM_JSON_INVALID",
        "UPSTREAM_RESPONSE_INVALID",
        "UPSTREAM_OUTPUT_REJECTED",
        "UPSTREAM_TIMEOUT",
      ])
      .optional(),
    upstreamStatus: z.number().int().min(100).max(599).optional(),
  })
  .strict();

export type AiRequest = z.infer<typeof aiRequestSchema>;
export type AiResponse = z.infer<typeof aiResponseSchema>;
export type AiError = z.infer<typeof aiErrorSchema>;
