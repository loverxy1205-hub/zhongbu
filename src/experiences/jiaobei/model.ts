import { z } from "zod";
import type { Interpretation, PublicInput } from "../../types";
import { uniformInt, type RandomSource } from "../../lib/random";

export const JIAOBEI_SOURCE =
  "https://tlc.tyc.edu.tw/temples/changxiang-palace/";
const face = z.enum(["flat", "convex"]);
export const jiaobeiSchema = z
  .object({
    kind: z.literal("jiaobei"),
    version: z.literal(1),
    draws: z.array(z.tuple([face, face])).length(3),
    mode: z.enum(["single", "triple"]),
    phase: z.enum(["configure", "ready", "complete"]),
    proposition: z.string().max(300),
    demo: z.boolean(),
    revealed: z.number().int().min(0).max(3),
  })
  .strict()
  .superRefine((s, ctx) => {
    const total = s.mode === "single" ? 1 : 3;
    if (
      (s.phase === "configure" && s.revealed !== 0) ||
      s.revealed > total ||
      (s.phase === "complete" && s.revealed !== total) ||
      (s.phase === "ready" && s.revealed >= total) ||
      (s.phase !== "configure" && !s.demo && !s.proposition.trim())
    )
      ctx.addIssue({ code: "custom", message: "问事命题或揭晓进度不一致" });
  });
export type JiaobeiState = z.infer<typeof jiaobeiSchema>;
export type JiaobeiOutcome = "圣筊" | "笑筊" | "阴筊";
export function classifyJiaobei(
  faces: readonly ["flat" | "convex", "flat" | "convex"],
): JiaobeiOutcome {
  return faces[0] !== faces[1] ? "圣筊" : faces[0] === "flat" ? "笑筊" : "阴筊";
}
export function createJiaobei(rng: RandomSource): JiaobeiState {
  return {
    kind: "jiaobei",
    version: 1,
    draws: Array.from({ length: 3 }, () => [
      uniformInt(2, rng) ? "convex" : "flat",
      uniformInt(2, rng) ? "convex" : "flat",
    ]),
    mode: "single",
    phase: "configure",
    proposition: "",
    demo: false,
    revealed: 0,
  };
}
export function advanceJiaobei(state: JiaobeiState): JiaobeiState {
  if (state.phase !== "ready") return state;
  const revealed = state.revealed + 1;
  return {
    ...state,
    revealed,
    phase:
      revealed === (state.mode === "single" ? 1 : 3) ? "complete" : "ready",
  };
}
export function canTransitionJiaobei(
  previous: JiaobeiState,
  next: JiaobeiState,
): boolean {
  if (JSON.stringify(previous.draws) !== JSON.stringify(next.draws))
    return false;
  if (previous.phase === "complete")
    return JSON.stringify(previous) === JSON.stringify(next);
  if (previous.phase === "configure")
    return (
      next.revealed === 0 &&
      (next.phase === "configure" || next.phase === "ready")
    );
  if (
    previous.mode !== next.mode ||
    previous.demo !== next.demo ||
    previous.proposition !== next.proposition
  )
    return false;
  return JSON.stringify(next) === JSON.stringify(advanceJiaobei(previous));
}
export function interpretJiaobei(
  s: JiaobeiState,
  _input: PublicInput,
): Interpretation | undefined {
  if (s.phase !== "complete") return;
  const outcomes = s.draws.slice(0, s.revealed).map(classifyJiaobei);
  const allHoly = outcomes.every((o) => o === "圣筊");
  const meaning =
    s.mode === "triple"
      ? allHoly
        ? "达到预先选定的三次全圣确认条件"
        : "未获三次全圣确认；这不等同三次全阴"
      : outcomes[0] === "圣筊"
        ? "本次呈现传统上的应允象征"
        : outcomes[0] === "笑筊"
          ? "本次呈现传统上的未明确答复象征，不是反对"
          : "本次呈现传统上的不应允象征";
  return {
    headline: s.demo
      ? `文化演示：${meaning}`
      : `就命题「${s.proposition}」：${meaning}。`,
    themes: [],
    traditional: [],
    reflection: [],
    paragraphs: [
      {
        label: "朝上面与类别",
        text: outcomes
          .map(
            (o, i) =>
              `第${i + 1}次：${s.draws[i].map((f) => (f === "flat" ? "平面" : "凸面")).join("＋")} → ${o}`,
          )
          .join("；"),
        knowledgeId: "jiaobei-faces-v1",
        ruleId: "jiaobei-facing-up-v1",
        templateId: "jiaobei-record-v1",
      },
      {
        label: "本次问事",
        text: s.demo
          ? "未确认命题，仅展示器具与分类，不进入问题的方向汇总。"
          : `记录的命题完整保留为「${s.proposition}」。${meaning}；这是网页数字模拟的文化表达，不是神明对网页的实际答复。`,
        knowledgeId: "jiaobei-scope-v1",
        ruleId: "jiaobei-no-negation-inversion-v1",
        templateId: "jiaobei-proposition-v1",
      },
    ],
    inclination: "无明确倾向",
    inclinationReason:
      "此问事只对应单独确认的命题，不替多个选项投票。圣筊映射为对该命题的应允象征，笑筊未明确，阴筊不应允；不反转否定。",
    sources: [JIAOBEI_SOURCE],
    limits: [
      "双杯独立公平二值是本站数字约定，并非真实筊杯概率测量。圣／笑／阴在该代码分布为1/2、1/4、1/4，不是事情成功概率。",
      "三次全圣是预先选择的本站模式，不代表所有庙宇礼法；三次组成一个结果。",
    ],
  };
}
