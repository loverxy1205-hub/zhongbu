import { z } from "zod";

// Feedback is explicit and private. A complete reading, birth date, preference,
// IP address or browser fingerprint is never accepted in this contract.
export const feedbackRequestSchema = z
  .object({
    kind: z.enum(["问题", "建议", "其他"]),
    message: z
      .string()
      .trim()
      .min(5)
      .max(2000)
      .refine((text) => Array.from(text).length >= 5),
    question: z.string().trim().max(2000).optional(),
    engine: z
      .enum([
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
      ])
      .optional(),
    appVersion: z.string().max(40).optional(),
  })
  .strict();

export const feedbackResponseSchema = z
  .object({ id: z.uuid(), receivedAt: z.iso.datetime() })
  .strict();

export type FeedbackRequest = z.infer<typeof feedbackRequestSchema>;
export type FeedbackResponse = z.infer<typeof feedbackResponseSchema>;
