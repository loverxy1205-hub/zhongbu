import { describe, expect, it } from "vitest";
import { aiRequestSchema, type AiRequest } from "../shared/ai-contract";
import { renderAdvice } from "../worker/src/advice-output";

const request: AiRequest = aiRequestSchema.parse({
  readingId: "structured-output-test-only",
  engine: "tarot",
  context: {
    mode: "explore",
    scene: "无预设",
    targetDate: "2026-10-01",
    question: "明天可以翘课吗？",
    action: "",
  },
  evidence: {
    methodVersion: "tarot-v1",
    headline: "测试结构",
    themes: ["休整"],
    rawSummary: "现状：皇后逆位；阻力：战车逆位；提示：宝剑四正位。",
    paragraphs: [
      { label: "现状", text: "测试中提供的第一段释义。" },
      { label: "阻力", text: "测试中提供的第二段释义。" },
      { label: "提示", text: "测试中提供的第三段释义。" },
    ],
    reflection: [],
    traditional: [],
  },
});

const answer = {
  analysis: "第一处与第三处的象征提示可以放在一起比较。",
  evidenceRefs: [0, 2],
  recommendation: {
    kind: "daily",
    optionIndex: null,
    action: "明天先暂停这项安排。",
    nextStep: "把空出的时间留给休整。",
  },
};

function actionRequest(options = ["明天不去上课", "明天去上课"]): AiRequest {
  return {
    ...request,
    context: { ...request.context, mode: "action", options },
  };
}
function withRecommendation(
  recommendation: Omit<Partial<typeof answer.recommendation>, "optionIndex"> & {
    optionIndex?: number | null;
  },
) {
  return {
    ...answer,
    recommendation: { ...answer.recommendation, ...recommendation },
  };
}

describe("structured advice output boundary", () => {
  // These tests deliberately do not score whether the provider understood a
  // question, inferred the right kind, or used the cited evidence semantically.
  // They verify only what the Worker can actually validate and preserve.
  it("renders only the public analysis and recommendation without returning provider JSON", () => {
    const text = renderAdvice(JSON.stringify(answer), request);
    expect(text).toBe(
      `解析：${answer.analysis}\n\n建议：${answer.recommendation.action}${answer.recommendation.nextStep}`,
    );
    expect(text).not.toContain("evidenceRefs");
    expect(text).not.toContain("optionIndex");
  });

  it("quotes an exact negative option instead of the model's contradictory paraphrase", () => {
    const options = ["  明天不去上课，但不放弃本学期  ", "明天去上课"];
    const content = withRecommendation({
      optionIndex: 0,
      action: "明天去上课。",
    });
    const before = JSON.stringify(options);
    const text = renderAdvice(JSON.stringify(content), actionRequest(options));
    expect(text).toBe(
      `解析：${answer.analysis}\n\n建议：更建议选「${options[0]}」。${answer.recommendation.nextStep}`,
    );
    expect(text).not.toContain("建议：明天去上课");
    expect(JSON.stringify(options)).toBe(before);
  });

  it("selects the indexed item in the original order, including the last of ten options", () => {
    const options = Array.from(
      { length: 10 },
      (_, index) => `选项${index}：暂不改变安排`,
    );
    const text = renderAdvice(
      JSON.stringify(withRecommendation({ optionIndex: 9 })),
      actionRequest(options),
    );
    expect(text).toContain(`更建议选「${options[9]}」。`);
    expect(text).not.toContain(`更建议选「${options[0]}」。`);
  });

  it.each([null, -1, 2, 9, 0.5, "0"])(
    "rejects an invalid action option index %s",
    (optionIndex) => {
      const content = {
        ...answer,
        recommendation: { ...answer.recommendation, optionIndex },
      };
      expect(() =>
        renderAdvice(JSON.stringify(content), actionRequest()),
      ).toThrow();
    },
  );

  it.each(["fact_check", "sensitive"])(
    "does not force an option choice for kind %s",
    (kind) => {
      const content = withRecommendation({
        kind,
        action: "不能根据符号核实这件事。",
        nextStep: "核对已有事实材料。",
      });
      const text = renderAdvice(JSON.stringify(content), actionRequest());
      expect(text).toContain(
        "建议：不能根据符号核实这件事。核对已有事实材料。",
      );
      expect(text).not.toContain("更建议选");
      expect(() =>
        renderAdvice(
          JSON.stringify({
            ...content,
            recommendation: { ...content.recommendation, optionIndex: 0 },
          }),
          actionRequest(),
        ),
      ).toThrow("Unexpected selected option");
    },
  );

  it("rejects an unknown recommendation kind rather than treating it as ordinary advice", () => {
    expect(() =>
      renderAdvice(
        JSON.stringify(withRecommendation({ kind: "prediction" })),
        request,
      ),
    ).toThrow();
  });

  it("requires null selection for open exploration and legacy requests without options", () => {
    const legacy = {
      ...request,
      context: {
        ...request.context,
        mode: "action" as const,
        action: "不去上课",
      },
    };
    expect(renderAdvice(JSON.stringify(answer), legacy)).toContain(
      answer.recommendation.action,
    );
    for (const input of [request, legacy]) {
      expect(() =>
        renderAdvice(
          JSON.stringify(withRecommendation({ optionIndex: 0 })),
          input,
        ),
      ).toThrow("Unexpected selected option");
    }
  });

  it.each([
    { name: "none", refs: [] },
    { name: "too few for three paragraphs", refs: [0] },
    { name: "duplicate", refs: [0, 0] },
    { name: "outside this reading", refs: [0, 3] },
    { name: "negative", refs: [-1, 2] },
    { name: "fraction", refs: [0, 1.5] },
    { name: "string", refs: ["0", 2] },
    {
      name: "excessive",
      refs: Array.from({ length: 17 }, (_, index) => index),
    },
  ])("rejects $name evidence references", ({ refs }) => {
    expect(() =>
      renderAdvice(JSON.stringify({ ...answer, evidenceRefs: refs }), request),
    ).toThrow();
  });

  it("uses actual supplied paragraph count for short legacy readings without inventing references", () => {
    for (const count of [0, 1, 2]) {
      const input = {
        ...request,
        evidence: {
          ...request.evidence,
          paragraphs: request.evidence.paragraphs.slice(0, count),
        },
      };
      const refs = Array.from({ length: count }, (_, index) => index);
      expect(
        renderAdvice(JSON.stringify({ ...answer, evidenceRefs: refs }), input),
      ).toContain("解析：");
      expect(() =>
        renderAdvice(
          JSON.stringify({ ...answer, evidenceRefs: [...refs, count] }),
          input,
        ),
      ).toThrow();
    }
  });

  it.each([
    "not JSON",
    `\`\`\`json\n${JSON.stringify(answer)}\n\`\`\``,
    JSON.stringify({ ...answer, privateReasoning: "unrequested trace" }),
    JSON.stringify({
      ...answer,
      recommendation: { ...answer.recommendation, extra: "ignored?" },
    }),
    JSON.stringify({ ...answer, analysis: "  " }),
    JSON.stringify({ ...answer, analysis: "字".repeat(601) }),
    JSON.stringify(withRecommendation({ action: " " })),
    JSON.stringify(withRecommendation({ nextStep: "字".repeat(601) })),
  ])(
    "rejects malformed, extra or oversized output without returning a partial answer",
    (content) => {
      expect(() => renderAdvice(content, request)).toThrow();
    },
  );

  it("allows an empty next step and trims outer whitespace without clipping content", () => {
    const content = {
      ...answer,
      analysis: `  ${answer.analysis}  `,
      recommendation: {
        ...answer.recommendation,
        action: "  暂停。  ",
        nextStep: "  ",
      },
    };
    expect(renderAdvice(JSON.stringify(content), request)).toBe(
      `解析：${answer.analysis}\n\n建议：暂停。`,
    );
  });
});
