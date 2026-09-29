import { z } from "zod";
import type { Interpretation, PublicInput } from "../../types";
import type { RandomSource } from "../../lib/random";
import { uniformInt } from "../../lib/random";
import { buildCoffeeTexture, type CoffeeTexture } from "./texture";
import {
  COFFEE_DICTIONARY_VERSION,
  COFFEE_SOURCES,
  COFFEE_SYMBOL_IDS,
  COFFEE_SYMBOLS,
  coffeeSymbolName,
} from "./dictionary";

const integer = (min: number, max: number) =>
  z.number().int().min(min).max(max);
const unit = integer(0, 1000);
const boxSchema = z
  .object({
    u: integer(0, 950),
    v: integer(0, 950),
    width: integer(50, 1000),
    height: integer(50, 1000),
  })
  .strict()
  .refine(
    (b) => b.u + b.width <= 1000 && b.v + b.height <= 1000,
    "观察框必须在杯纹内",
  );
const symbolSchema = z
  .string()
  .refine((s) => COFFEE_SYMBOL_IDS.includes(s), "未知意象");
const annotationSchema = z
  .object({
    id: integer(1, 8),
    box: boxSchema,
    symbol: symbolSchema,
    note: z.string().max(160),
  })
  .strict();
const textureSchema = z
  .object({
    id: z.string().max(95),
    version: z.literal(1),
    patches: z
      .array(
        z
          .object({
            points: z
              .array(z.object({ u: integer(-200, 1200), v: unit }).strict())
              .min(8)
              .max(20),
            tone: integer(0, 3),
          })
          .strict(),
      )
      .length(98),
  })
  .strict();
const observationSchema = z
  .object({
    id: integer(1, 8),
    textureId: z.string().max(95),
    outcome: z.enum(["marked", "unclear"]),
    annotations: z.array(annotationSchema).max(8),
    note: z.string().max(320),
  })
  .strict();
const baseSchema = z
  .object({
    kind: z.literal("coffee"),
    version: z.literal(1),
    dictionaryVersion: z.literal(COFFEE_DICTIONARY_VERSION),
    stage: z.enum([
      "residue",
      "turn",
      "covered",
      "inverted",
      "settling",
      "settled",
      "observe",
      "complete",
    ]),
    seeds: z.tuple([
      integer(0, 4294967295),
      integer(0, 4294967295),
      integer(0, 4294967295),
      integer(0, 4294967295),
    ]),
    swirl: z
      .object({ angle: integer(-1440, 1440), travel: integer(0, 2880) })
      .strict(),
    texture: textureSchema.optional(),
    view: z
      .object({
        mode: z.enum(["top", "unfold"]),
        zoom: z.number().min(1).max(2),
        rotation: integer(-180, 180),
      })
      .strict(),
    working: z.array(annotationSchema).max(8),
    draft: z
      .object({
        box: boxSchema,
        symbol: symbolSchema.optional(),
        note: z.string().max(160),
      })
      .strict()
      .optional(),
    observations: z.array(observationSchema).max(8),
    activeVersion: integer(0, 8),
  })
  .strict();
export type CoffeeState = z.infer<typeof baseSchema>;
export type CoffeeBox = z.infer<typeof boxSchema>;
export type CoffeeAnnotation = z.infer<typeof annotationSchema>;
export const coffeeSchema = baseSchema.superRefine((s, ctx) => {
  const fail = (message: string) => ctx.addIssue({ code: "custom", message });
  const locked = !["residue", "turn"].includes(s.stage);
  if (locked !== Boolean(s.texture)) fail("杯纹冻结状态与流程不符");
  if (s.swirl.travel < Math.abs(s.swirl.angle)) fail("转动距离不能小于净角度");
  if (s.stage === "residue" && (s.swirl.angle || s.swirl.travel))
    fail("开始前不能有转动记录");
  if (
    s.texture &&
    JSON.stringify(s.texture) !==
      JSON.stringify(buildCoffeeTexture(s.seeds, s.swirl))
  )
    fail("冻结杯纹与种子、转动参数或规则版本不符");
  if ((s.working.length || s.draft) && s.stage !== "observe")
    fail("仅观察阶段允许草稿");
  if (
    s.draft &&
    (s.view.mode !== "unfold" || s.view.zoom !== 1 || s.view.rotation !== 0)
  )
    fail("框选须使用未缩放的展开坐标");
  if (s.stage === "complete" && (!s.observations.length || !s.activeVersion))
    fail("完成状态必须有观察版本");
  if (s.activeVersion > s.observations.length) fail("未知观察版本");
  if (s.observations.length && !["observe", "complete"].includes(s.stage))
    fail("未观察不能已有完成版本");
  if (s.working.some((a, i) => a.id !== i + 1)) fail("标注编号须连续");
  s.observations.forEach((o, i) => {
    if (
      o.id !== i + 1 ||
      o.textureId !== s.texture?.id ||
      o.annotations.some((a, j) => a.id !== j + 1)
    )
      fail("观察版本必须引用同一冻结杯纹且编号连续");
    if ((o.outcome === "unclear") !== (o.annotations.length === 0))
      fail("空观察与标注不一致");
  });
});

export function createCoffee(rng: RandomSource): CoffeeState {
  return {
    kind: "coffee",
    version: 1,
    dictionaryVersion: COFFEE_DICTIONARY_VERSION,
    stage: "residue",
    seeds: [
      uniformInt(2 ** 32, rng),
      uniformInt(2 ** 32, rng),
      uniformInt(2 ** 32, rng),
      uniformInt(2 ** 32, rng),
    ],
    swirl: { angle: 0, travel: 0 },
    view: { mode: "top", zoom: 1, rotation: 0 },
    working: [],
    observations: [],
    activeVersion: 0,
  };
}
export function turnCoffee(s: CoffeeState, degrees: number): CoffeeState {
  if (s.stage !== "turn" || !Number.isFinite(degrees)) return s;
  const delta = Math.round(Math.max(-180, Math.min(180, degrees)));
  const angle = Math.max(-1440, Math.min(1440, s.swirl.angle + delta));
  const actual = angle - s.swirl.angle;
  if (s.swirl.travel + Math.abs(actual) > 2880) return s;
  return { ...s, swirl: { angle, travel: s.swirl.travel + Math.abs(actual) } };
}
export function advanceCoffee(s: CoffeeState): CoffeeState {
  if (s.stage === "residue") return { ...s, stage: "turn" };
  if (s.stage === "turn")
    return {
      ...s,
      stage: "covered",
      texture: buildCoffeeTexture(s.seeds, s.swirl),
    };
  const next = {
    covered: "inverted",
    inverted: "settling",
    settling: "settled",
    settled: "observe",
  } as const;
  return s.stage in next
    ? { ...s, stage: next[s.stage as keyof typeof next] }
    : s;
}
export function beginCoffeeAnnotation(s: CoffeeState): CoffeeState {
  if (s.stage !== "observe" || s.working.length >= 8 || s.draft) return s;
  return {
    ...s,
    view: { mode: "unfold", zoom: 1, rotation: 0 },
    draft: { box: { u: 350, v: 350, width: 250, height: 250 }, note: "" },
  };
}
export function saveCoffeeAnnotation(s: CoffeeState): CoffeeState {
  if (!s.draft?.symbol || s.stage !== "observe" || s.working.length >= 8)
    return s;
  const { draft, ...rest } = s;
  return {
    ...rest,
    working: [
      ...s.working,
      {
        id: s.working.length + 1,
        box: draft.box,
        symbol: draft.symbol!,
        note: draft.note.trim(),
      },
    ],
  };
}
export function completeCoffee(s: CoffeeState, unclear = false): CoffeeState {
  if (
    s.stage !== "observe" ||
    !s.texture ||
    s.observations.length >= 8 ||
    s.draft ||
    (!unclear && !s.working.length) ||
    (unclear && s.working.length)
  )
    return s;
  const id = s.observations.length + 1;
  return {
    ...s,
    stage: "complete",
    working: [],
    activeVersion: id,
    observations: [
      ...s.observations,
      {
        id,
        textureId: s.texture.id,
        outcome: unclear ? "unclear" : "marked",
        annotations: s.working,
        note: unclear ? "这次没有看见清楚形状。" : "用户手工选取的联想。",
      },
    ],
  };
}
export function reobserveCoffee(s: CoffeeState): CoffeeState {
  return s.stage === "complete" && s.observations.length < 8
    ? { ...s, stage: "observe", working: [] }
    : s;
}
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
/** Parent-side guard: view changes may never redraw a frozen cup or rewrite history. */
export function canTransitionCoffee(
  previous: CoffeeState,
  next: CoffeeState,
): boolean {
  if (
    !coffeeSchema.safeParse(next).success ||
    !same(previous.seeds, next.seeds) ||
    previous.version !== next.version ||
    previous.dictionaryVersion !== next.dictionaryVersion
  )
    return false;
  if (previous.texture && !same(previous.texture, next.texture)) return false;
  if (previous.stage !== "turn" && !same(previous.swirl, next.swirl))
    return false;
  if (
    next.observations.length < previous.observations.length ||
    !same(
      previous.observations,
      next.observations.slice(0, previous.observations.length),
    )
  )
    return false;
  if (previous.stage === "turn") {
    const delta = next.swirl.angle - previous.swirl.angle;
    if (
      Math.abs(delta) > 180 ||
      next.swirl.travel - previous.swirl.travel !== Math.abs(delta)
    )
      return false;
    if (next.stage !== "turn" && !same(previous.swirl, next.swirl))
      return false;
  }
  const allowed: Record<CoffeeState["stage"], CoffeeState["stage"][]> = {
    residue: ["residue", "turn"],
    turn: ["turn", "covered"],
    covered: ["covered", "inverted"],
    inverted: ["inverted", "settling"],
    settling: ["settling", "settled"],
    settled: ["settled", "observe"],
    observe: ["observe", "complete"],
    complete: ["complete", "observe"],
  };
  if (!allowed[previous.stage].includes(next.stage)) return false;
  if (previous.stage !== "observe" && (next.working.length || next.draft))
    return false;
  if (next.observations.length > previous.observations.length) {
    if (
      previous.stage !== "observe" ||
      next.stage !== "complete" ||
      previous.draft ||
      next.observations.length !== previous.observations.length + 1
    )
      return false;
    const last = next.observations.at(-1)!;
    if (
      !same(last.annotations, previous.working) ||
      next.activeVersion !== last.id
    )
      return false;
  } else if (previous.stage === "observe" && next.stage === "complete")
    return false;
  if (
    previous.stage === "complete" &&
    next.stage === "observe" &&
    (next.working.length || next.draft || next.observations.length >= 8)
  )
    return false;
  if (
    previous.stage !== "complete" &&
    previous.stage === next.stage &&
    previous.activeVersion !== next.activeVersion
  )
    return false;
  if (
    previous.stage === "observe" &&
    next.stage === "observe" &&
    !same(previous.working, next.working)
  ) {
    if (next.working.length === previous.working.length + 1) {
      if (
        !previous.draft?.symbol ||
        next.draft ||
        !same(previous.working, next.working.slice(0, -1))
      )
        return false;
      const last = next.working.at(-1)!;
      if (
        !same(last.box, previous.draft.box) ||
        last.symbol !== previous.draft.symbol ||
        last.note !== previous.draft.note.trim()
      )
        return false;
    } else if (next.working.length === previous.working.length - 1) {
      if (
        previous.draft ||
        next.draft ||
        !previous.working.some((_, index) =>
          same(
            next.working,
            previous.working
              .filter((__, i) => i !== index)
              .map((a, i) => ({ ...a, id: i + 1 })),
          ),
        )
      )
        return false;
    } else return false;
  }
  return true;
}
export function coffeeRegion(box: CoffeeBox): string {
  const depth = box.v + box.height / 2;
  return depth >= 820 ? "杯口附近" : depth < 320 ? "杯底" : "杯壁";
}
export function interpretCoffee(
  state: CoffeeState,
  input: PublicInput,
): Interpretation | undefined {
  if (state.stage !== "complete") return undefined;
  const observation = state.observations[state.activeVersion - 1];
  if (!observation) return undefined;
  const paragraph = (label: string, text: string, id: string) => ({
    label,
    text,
    knowledgeId: id,
    ruleId: "coffee-human-observation-1",
    templateId: "coffee-reflection-1",
  });
  const paragraphs = observation.annotations.map((a) => {
    const entry = COFFEE_SYMBOLS.find((s) => s.id === a.symbol);
    const prompt =
      entry?.prompt ??
      (a.symbol === "other"
        ? "这个联想由你命名，本站不替它附加预言。可以保留它对你的个人含义。"
        : "保留形状的模糊性，不需要为了完成体验而确定它是什么。");
    return paragraph(
      `本站象征提示 · ${coffeeSymbolName(a.symbol)}`,
      `你在${coffeeRegion(a.box)}框出的这片形状让你联想到「${coffeeSymbolName(a.symbol)}」。${a.note ? `你的记录：${a.note}。` : ""}${prompt}`,
      `coffee-${a.symbol}-${state.dictionaryVersion}`,
    );
  });
  if (!paragraphs.length)
    paragraphs.push(
      paragraph(
        "观察记录 · 没有清楚形状",
        "你完成了观察，这一次没有看见清楚形状。它不表示好坏，也不需要补一个答案。浓淡、留白和视角中，哪一部分最吸引你的注意？",
        "coffee-unclear-1",
      ),
    );
  if (input.scene !== "无预设")
    paragraphs.push(
      paragraph(
        "你选择的场景",
        `本次场景是「${input.scene}」。这些联想可以帮助整理感受，不能替代该场景中的事实与条件。`,
        "coffee-scene-1",
      ),
    );
  return {
    headline: `同一杯纹 · 观察版本 ${observation.id} · ${observation.annotations.length ? `${observation.annotations.length} 条手工联想` : "未见清楚形状"}`,
    themes: [
      ...new Set(
        observation.annotations.flatMap(
          (a) => COFFEE_SYMBOLS.find((s) => s.id === a.symbol)?.theme ?? [],
        ),
      ),
    ],
    paragraphs,
    reflection: [],
    traditional: [],
    inclination: "无明确倾向",
    inclinationReason:
      "人工观纹与本站象征提示不参与行动方向投票；多个标注仍是同一杯结果。",
    sources: [
      ...COFFEE_SOURCES,
      `本站原创象征提示词典 ${state.dictionaryVersion}；20条提示不代表通用传统判词。`,
    ],
    limits: [
      "视觉模拟，不是精确流体模拟；未进行自动识别或先抽意象。",
      "杯口、杯壁、杯底只标示图像位置；本版不赋予时间、吉凶或方位含义。",
      "文化来源证明习俗存在，不证明预测有效；所有观察版本共用一个冻结图样。",
    ],
  };
}
export type { CoffeeTexture };
