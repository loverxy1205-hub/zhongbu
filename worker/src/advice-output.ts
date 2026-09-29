import { z } from "zod";
import type { AiRequest } from "../../shared/ai-contract";

// Brief, user-visible justification only; no private reasoning trace is requested.
// References verify provenance, not whether a symbolic interpretation is true.
const answerSchema = z
  .object({
    analysis: z.string().trim().min(1).max(600),
    evidenceRefs: z.array(z.number().int().min(0).max(15)).max(16),
    recommendation: z
      .object({
        kind: z.enum(["daily", "fact_check", "sensitive"]),
        optionIndex: z.number().int().min(0).max(9).nullable(),
        action: z.string().trim().min(1).max(600),
        nextStep: z.string().trim().max(600),
      })
      .strict(),
  })
  .strict();

export function renderAdvice(content: string, request: AiRequest): string {
  const answer = answerSchema.parse(JSON.parse(content) as unknown);
  const { evidenceRefs, recommendation } = answer;
  const count = request.evidence.paragraphs.length;
  if (
    new Set(evidenceRefs).size !== evidenceRefs.length ||
    evidenceRefs.some((index) => index >= count) ||
    evidenceRefs.length < Math.min(count, 2)
  )
    throw new Error("Invalid evidence references");

  const options =
    request.context.mode === "action" ? request.context.options : undefined;
  let action = recommendation.action;
  if (recommendation.kind === "daily" && options) {
    const index = recommendation.optionIndex;
    if (index === null || index >= options.length)
      throw new Error("Invalid selected option");
    // Exact user wording, including negation, never a provider paraphrase.
    action = `更建议选「${options[index]}」。`;
  } else if (recommendation.optionIndex !== null) {
    throw new Error("Unexpected selected option");
  }
  return `解析：${answer.analysis}\n\n建议：${action}${recommendation.nextStep}`;
}
