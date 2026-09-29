import { z } from "zod";
import { uniformInt } from "../../lib/random";
import type { RandomSource } from "../../lib/random";
import type { Interpretation, PublicInput } from "../../types";
import {
  IFA_CATALOG_VERSION,
  IFA_ORIENTATION,
  IFA_SOURCES,
  ORIENTATION_COPY,
  baseForCode,
  signatureId,
} from "./signatureCatalog";
import {
  IFA_CORPUS_VERSION,
  interpretationCorpus,
  MISSING_IFA_TEXT,
} from "./interpretationCorpus";
import {
  IFA_REFLECTION_VERSION,
  renderIfaReflection,
} from "./reflectionTemplates";

const faceSchema = z.union([z.literal(0), z.literal(1)]);
const facesSchema = z.tuple([
  faceSchema,
  faceSchema,
  faceSchema,
  faceSchema,
  faceSchema,
  faceSchema,
  faceSchema,
  faceSchema,
]);
export const ifaSchema = z
  .strictObject({
    kind: z.literal("ifa"),
    version: z.literal(1),
    orientation: z.literal(IFA_ORIENTATION),
    catalogVersion: z.literal(IFA_CATALOG_VERSION),
    corpusVersion: z.literal(IFA_CORPUS_VERSION),
    reflectionVersion: z.literal(IFA_REFLECTION_VERSION),
    phase: z.enum(["intro", "focus", "lifted", "settled", "complete"]),
    faces: facesSchema,
    rightCode: z.string().regex(/^[01]{4}$/),
    leftCode: z.string().regex(/^[01]{4}$/),
    signatureId: z.string().regex(/^ifa-r[01]{4}-l[01]{4}$/),
  })
  .superRefine((value, ctx) => {
    const right = value.faces.slice(0, 4).join("");
    const left = value.faces.slice(4, 8).join("");
    if (
      value.rightCode !== right ||
      value.leftCode !== left ||
      value.signatureId !== signatureId(right, left)
    )
      ctx.addIssue({
        code: "custom",
        message: "Ifá 朝向、左右图式与签名不一致。",
      });
  });

export type IfaState = z.infer<typeof ifaSchema>;
export type IfaFace = IfaState["faces"][number];

export function createIfa(rng: RandomSource): IfaState {
  const faces = facesSchema.parse(
    Array.from({ length: 8 }, () => uniformInt(2, rng)),
  );
  const rightCode = faces.slice(0, 4).join("");
  const leftCode = faces.slice(4, 8).join("");
  return {
    kind: "ifa",
    version: 1,
    phase: "intro",
    faces,
    rightCode,
    leftCode,
    signatureId: signatureId(rightCode, leftCode),
    orientation: IFA_ORIENTATION,
    catalogVersion: IFA_CATALOG_VERSION,
    corpusVersion: IFA_CORPUS_VERSION,
    reflectionVersion: IFA_REFLECTION_VERSION,
  };
}

const NEXT_PHASE: Partial<Record<IfaState["phase"], IfaState["phase"]>> = {
  intro: "focus",
  focus: "lifted",
  lifted: "settled",
  settled: "complete",
};

/** Progression only: cannot recast, flip a face or advance twice with one stale event. */
export function advanceIfa(
  state: IfaState,
  expected: IfaState["phase"],
): IfaState {
  if (state.phase !== expected || !NEXT_PHASE[expected]) return state;
  return { ...state, phase: NEXT_PHASE[expected] };
}

export function canTransitionIfa(previous: IfaState, next: IfaState): boolean {
  return (
    NEXT_PHASE[previous.phase] === next.phase &&
    previous.kind === next.kind &&
    previous.version === next.version &&
    previous.orientation === next.orientation &&
    previous.catalogVersion === next.catalogVersion &&
    previous.corpusVersion === next.corpusVersion &&
    previous.reflectionVersion === next.reflectionVersion &&
    previous.signatureId === next.signatureId &&
    previous.rightCode === next.rightCode &&
    previous.leftCode === next.leftCode &&
    previous.faces.length === next.faces.length &&
    previous.faces.every((face, index) => face === next.faces[index])
  );
}

export function interpretIfa(
  state: IfaState,
  input: PublicInput,
): Interpretation | undefined {
  if (state.phase !== "complete") return undefined;
  const right = baseForCode(state.rightCode),
    left = baseForCode(state.leftCode);
  const texts = interpretationCorpus.filter(
    (entry) => entry.signatureId === state.signatureId,
  );
  return {
    headline: MISSING_IFA_TEXT,
    themes: [],
    inclination: "无明确倾向",
    inclinationReason: "符号与中性反思体验，不参加方向投票；不推断 iré / ìbì。",
    paragraphs: [
      {
        label: "本次图式 · 两列保持顺序",
        text: `右列 ${right.name}（${state.rightCode}），左列 ${left.name}（${state.leftCode}）。${state.rightCode === state.leftCode ? "这是16种同列重复图式之一。" : "这是240种不同列组合之一。"}签名 ${state.signatureId}。基础列名分别标示，不拼造复合 Odù 的传统判词或未经核对的名字。`,
        knowledgeId: state.signatureId,
        ruleId: IFA_ORIENTATION,
        templateId: "ifa-signature-description-v1",
      },
      {
        label: "文本覆盖状态",
        text: MISSING_IFA_TEXT,
        knowledgeId: IFA_CORPUS_VERSION,
        ruleId: "ifa-corpus-explicit-missing-v1",
        templateId: "ifa-corpus-missing-v1",
      },
    ],
    traditional: texts.map((entry) => ({
      label: `传统资料 · ${entry.usage === "verbatim" ? "原文" : "摘要"}`,
      text: entry.text,
      knowledgeId: entry.id,
      ruleId: "ifa-checked-corpus-v1",
      templateId: "ifa-traditional-source-v1",
    })),
    reflection: renderIfaReflection(input),
    sources: Object.values(IFA_SOURCES).map(
      (source) => `${source.title} · ${source.url}`,
    ),
    limits: [
      "这是 òpèlè 占链符号形成体验，不是完整的 Ifá 宗教咨询；不替代受训解释者、口传诗节与具体情境。",
      "8个独立公平二值是本站数字抽样约定，不是对真实占链朝向概率的测量；不表示吉凶均分。",
      "中性反思由本站创作，不是 ẹsẹ Ifá 或本次 Odù 的传统判词；没有祭献、禁忌、医疗或付费化解指令。",
      ...ORIENTATION_COPY,
    ],
  };
}
