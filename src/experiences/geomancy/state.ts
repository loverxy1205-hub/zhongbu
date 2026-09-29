import { z } from "zod";
import { uniformInt, type RandomSource } from "../../lib/random";

export const HAND_DOT_LIMIT = 128;
export const PHYSICAL_COUNT_LIMIT = 999999;
export const POSITION_IDS = [
  "M1",
  "M2",
  "M3",
  "M4",
  "D1",
  "D2",
  "D3",
  "D4",
  "N1",
  "N2",
  "N3",
  "N4",
  "W1",
  "W2",
  "J",
] as const;
export type ShieldId = (typeof POSITION_IDS)[number];
export type Figure = [number, number, number, number];
export type GeomancyMode = "hand" | "physical" | "auto";
export type SandPoint = { id: string; x: number; y: number };
export type ShieldPosition = {
  id: ShieldId;
  code: string;
  parents: ShieldId[];
  rows: number[];
};
export type GeomancyRaw = { rawCounts: number[]; positions: ShieldPosition[] };
export interface GeomancyState {
  kind: "geomancy";
  version: 1;
  mode: GeomancyMode | null;
  phase: "mode" | "input" | "reveal" | "complete";
  autoCounts: number[];
  handRows: SandPoint[][];
  nextPointId: number;
  committedCounts: number[];
  physicalDraft: string[];
  raw: GeomancyRaw | null;
  revealStep: number;
  running: boolean;
  view: "sand" | "shield" | "interpret";
  selectedPosition: ShieldId | null;
}

export function combine(a: readonly number[], b: readonly number[]): Figure {
  if (
    a.length !== 4 ||
    b.length !== 4 ||
    [...a, ...b].some((n) => n !== 0 && n !== 1)
  )
    throw Error("合成须使用两个四行单／双点图形");
  return a.map((n, i) => n ^ b[i]) as Figure;
}

export function calculateGeomancy(rawCounts: readonly number[]): GeomancyRaw {
  if (
    rawCounts.length !== 16 ||
    rawCounts.some(
      (n) => !Number.isSafeInteger(n) || n < 1 || n > PHYSICAL_COUNT_LIMIT,
    )
  )
    throw Error("需要16行正整数点数（每行1–999999）");
  const mothers = Array.from(
    { length: 4 },
    (_, i) => rawCounts.slice(i * 4, i * 4 + 4).map((n) => n % 2) as Figure,
  );
  const daughters = Array.from(
    { length: 4 },
    (_, row) => mothers.map((m) => m[row]) as Figure,
  );
  const figures = [...mothers, ...daughters];
  const positions: ShieldPosition[] = POSITION_IDS.slice(0, 8).map((id, i) => ({
    id,
    code: figures[i].join(""),
    parents: i < 4 ? [] : ["M1", "M2", "M3", "M4"],
    rows:
      i < 4
        ? [i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 3]
        : [i - 4, i, i + 4, i + 8],
  }));
  const pairs: [number, number][] = [
    [0, 1],
    [2, 3],
    [4, 5],
    [6, 7],
    [8, 9],
    [10, 11],
    [12, 13],
  ];
  for (const [a, b] of pairs) {
    const id = POSITION_IDS[figures.length];
    const figure = combine(figures[a], figures[b]);
    figures.push(figure);
    positions.push({
      id,
      code: figure.join(""),
      parents: [POSITION_IDS[a], POSITION_IDS[b]],
      rows: [],
    });
  }
  return { rawCounts: [...rawCounts], positions };
}

const pointSchema = z
  .object({
    id: z.string().regex(/^gm-dot-[1-9]\d*$/),
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
  })
  .strict();
const countSchema = z.number().int().min(1).max(PHYSICAL_COUNT_LIMIT);
const rawSchema = z
  .object({
    rawCounts: z.array(countSchema).length(16),
    positions: z
      .array(
        z
          .object({
            id: z.enum(POSITION_IDS),
            code: z.string().regex(/^[01]{4}$/),
            parents: z.array(z.enum(POSITION_IDS)).max(4),
            rows: z.array(z.number().int().min(0).max(15)).max(4),
          })
          .strict(),
      )
      .length(15),
  })
  .strict();

export const geomancySchema: z.ZodType<GeomancyState> = z
  .object({
    kind: z.literal("geomancy"),
    version: z.literal(1),
    mode: z.enum(["hand", "physical", "auto"]).nullable(),
    phase: z.enum(["mode", "input", "reveal", "complete"]),
    autoCounts: z.array(z.number().int().min(5).max(36)).length(16),
    handRows: z.array(z.array(pointSchema).max(HAND_DOT_LIMIT)).length(16),
    nextPointId: z.number().int().min(1).max(10000000),
    committedCounts: z.array(countSchema).max(16),
    physicalDraft: z.array(z.string().max(6)).length(16),
    raw: rawSchema.nullable(),
    revealStep: z.number().int().min(0).max(6),
    running: z.boolean(),
    view: z.enum(["sand", "shield", "interpret"]),
    selectedPosition: z.enum(POSITION_IDS).nullable(),
  })
  .strict()
  .superRefine((state, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    const points = state.handRows.flat();
    if (
      new Set(points.map((p) => p.id)).size !== points.length ||
      points.some((p) => Number(p.id.slice(7)) >= state.nextPointId)
    )
      fail("沙点ID必须唯一且早于下一ID");
    if (state.phase === "mode" ? state.mode !== null : state.mode === null)
      fail("输入模式与阶段不一致");
    if (
      state.phase === "mode" &&
      (state.committedCounts.length ||
        points.length ||
        state.raw ||
        state.physicalDraft.some(Boolean))
    )
      fail("未选模式不应有输入");
    if (state.mode !== "hand" && points.length) fail("仅亲手模式保留沙点");
    if (state.mode !== "physical" && state.physicalDraft.some(Boolean))
      fail("仅实物模式保留录入");
    if (
      state.phase === "input" &&
      state.mode !== "hand" &&
      state.committedCounts.length
    )
      fail("录入／自动模式须一次提交全部点数");
    if (state.mode === "hand") {
      if (
        state.handRows.some(
          (row) => new Set(row.map((p) => `${p.x}/${p.y}`)).size !== row.length,
        )
      )
        fail("每个手点须各自可见，不可重叠");
      if (state.committedCounts.some((n, i) => n !== state.handRows[i].length))
        fail("已提交手点数与可见点不一致");
      if (
        state.handRows.some(
          (row, i) => i > state.committedCounts.length && row.length,
        )
      )
        fail("不能提前填写后续手点行");
    }
    const completedInput =
      state.phase === "reveal" || state.phase === "complete";
    if (completedInput) {
      if (state.committedCounts.length !== 16 || !state.raw)
        fail("完整输入缺失");
      else if (
        JSON.stringify(calculateGeomancy(state.committedCounts)) !==
        JSON.stringify(state.raw)
      )
        fail("盾图与原始点数不一致");
      if (
        state.mode === "auto" &&
        state.autoCounts.some((n, i) => n !== state.committedCounts[i])
      )
        fail("自动点数不得重新抽取");
      if (
        state.mode === "physical" &&
        state.physicalDraft.some(
          (s, i) => Number(s) !== state.committedCounts[i],
        )
      )
        fail("录入点数不一致");
    } else if (
      state.raw ||
      state.revealStep !== 0 ||
      state.running ||
      state.committedCounts.length === 16
    )
      fail("尚未提交不应出现盾图或演示进度");
    if (state.phase === "complete" && (state.revealStep !== 6 || state.running))
      fail("完成状态无效");
    if (state.phase === "reveal" && state.revealStep === 6)
      fail("全部演示后应完成");
    if (state.view === "interpret" && state.phase !== "complete")
      fail("完成前不显示解读");
    if (state.selectedPosition && !state.raw) fail("无盾图时不能选图位");
    if (state.selectedPosition && state.raw) {
      const available =
        state.phase === "complete"
          ? 15
          : [0, 4, 8, 12, 14, 15][state.revealStep];
      if (POSITION_IDS.indexOf(state.selectedPosition) >= available)
        fail("不能选尚未揭示的图位");
    }
  });

export function createGeomancy(rng: RandomSource): GeomancyState {
  return {
    kind: "geomancy",
    version: 1,
    mode: null,
    phase: "mode",
    autoCounts: Array.from({ length: 16 }, () => 5 + uniformInt(32, rng)),
    handRows: Array.from({ length: 16 }, () => []),
    nextPointId: 1,
    committedCounts: [],
    physicalDraft: Array.from({ length: 16 }, () => ""),
    raw: null,
    revealStep: 0,
    running: false,
    view: "sand",
    selectedPosition: null,
  };
}

export function selectGeomancyMode(
  state: GeomancyState,
  mode: GeomancyMode,
): GeomancyState {
  return state.phase === "mode" ? { ...state, mode, phase: "input" } : state;
}
export function addSandPoint(
  state: GeomancyState,
  x?: number,
  y?: number,
): GeomancyState {
  if (state.mode !== "hand" || state.phase !== "input") return state;
  const row = state.committedCounts.length;
  const points = state.handRows[row];
  if (points.length >= HAND_DOT_LIMIT || state.nextPointId >= 10000000)
    return state;
  if (
    (x !== undefined && !Number.isFinite(x)) ||
    (y !== undefined && !Number.isFinite(y))
  )
    return state;
  // Snap to a free cell so repeated taps in one place remain individually visible.
  const occupied = new Set(
    points.map((p) => Math.floor(p.y * 8) * 16 + Math.floor(p.x * 16)),
  );
  const preferred =
    x === undefined || y === undefined
      ? points.length
      : Math.max(0, Math.min(7, Math.floor(y * 8))) * 16 +
        Math.max(0, Math.min(15, Math.floor(x * 16)));
  let index = preferred;
  while (occupied.has(index)) index = (index + 1) % HAND_DOT_LIMIT;
  const point: SandPoint = {
    id: `gm-dot-${state.nextPointId}`,
    x: ((index % 16) + 0.5) / 16,
    y: (Math.floor(index / 16) + 0.5) / 8,
  };
  return {
    ...state,
    nextPointId: state.nextPointId + 1,
    handRows: state.handRows.map((r, i) => (i === row ? [...r, point] : r)),
  };
}
export function clearSandRow(state: GeomancyState): GeomancyState {
  return state.mode === "hand" && state.phase === "input"
    ? {
        ...state,
        handRows: state.handRows.map((row, i) =>
          i === state.committedCounts.length ? [] : row,
        ),
      }
    : state;
}
function finalizeInput(state: GeomancyState, counts: number[]): GeomancyState {
  return {
    ...state,
    phase: "reveal",
    committedCounts: counts,
    raw: calculateGeomancy(counts),
    revealStep: 0,
    running: true,
    view: "sand",
  };
}
export function commitSandRow(state: GeomancyState): GeomancyState {
  if (state.mode !== "hand" || state.phase !== "input") return state;
  const count = state.handRows[state.committedCounts.length].length;
  if (!count) return state;
  const counts = [...state.committedCounts, count];
  return counts.length === 16
    ? finalizeInput(state, counts)
    : { ...state, committedCounts: counts };
}
export function setPhysicalCount(
  state: GeomancyState,
  index: number,
  value: string,
): GeomancyState {
  if (
    state.mode !== "physical" ||
    state.phase !== "input" ||
    !Number.isInteger(index) ||
    index < 0 ||
    index > 15 ||
    value.length > 6
  )
    return state;
  return {
    ...state,
    physicalDraft: state.physicalDraft.map((item, i) =>
      i === index ? value : item,
    ),
  };
}
export function commitPhysicalCounts(state: GeomancyState): GeomancyState {
  if (state.mode !== "physical" || state.phase !== "input") return state;
  if (state.physicalDraft.some((value) => !/^[1-9]\d{0,5}$/.test(value)))
    throw Error("请为全部16行填写1–999999之间的正整数，不接受空行、小数或0。");
  return finalizeInput(state, state.physicalDraft.map(Number));
}
export function commitAutomaticCounts(state: GeomancyState): GeomancyState {
  return state.mode === "auto" && state.phase === "input"
    ? finalizeInput(state, [...state.autoCounts])
    : state;
}
export function advanceGeomancy(
  state: GeomancyState,
  finish = false,
): GeomancyState {
  if (state.phase !== "reveal") return state;
  const revealStep = finish ? 6 : state.revealStep + 1;
  return {
    ...state,
    revealStep,
    phase: revealStep === 6 ? "complete" : "reveal",
    running: revealStep < 6 && state.running,
    view: revealStep === 6 ? "interpret" : revealStep > 0 ? "shield" : "sand",
  };
}

/** Validate a single UI transition, after schema validation; historical restore uses the schema itself. */
export function canTransitionGeomancy(
  previous: GeomancyState,
  next: GeomancyState,
): boolean {
  const equal = (a: unknown, b: unknown) =>
    JSON.stringify(a) === JSON.stringify(b);
  if (!geomancySchema.safeParse(next).success) return false;
  if (equal(previous, next)) return true;
  if (!equal(previous.autoCounts, next.autoCounts)) return false;
  if (previous.phase === "mode")
    return (
      next.mode !== null && equal(selectGeomancyMode(previous, next.mode), next)
    );
  if (previous.phase === "input") {
    if (previous.mode === "auto")
      return equal(commitAutomaticCounts(previous), next);
    if (previous.mode === "physical") {
      for (let i = 0; i < 16; i++)
        if (equal(setPhysicalCount(previous, i, next.physicalDraft[i]), next))
          return true;
      try {
        return equal(commitPhysicalCounts(previous), next);
      } catch {
        return false;
      }
    }
    const row = previous.committedCounts.length;
    const added = next.handRows[row]?.at(-1);
    return (
      equal(clearSandRow(previous), next) ||
      equal(commitSandRow(previous), next) ||
      (added !== undefined &&
        equal(addSandPoint(previous, added.x, added.y), next))
    );
  }
  if (
    previous.phase === "reveal" &&
    (equal(advanceGeomancy(previous), next) ||
      equal(advanceGeomancy(previous, true), next))
  )
    return true;
  const limit =
    previous.phase === "complete"
      ? 15
      : [0, 4, 8, 12, 14, 15][previous.revealStep];
  if (
    next.selectedPosition &&
    POSITION_IDS.indexOf(next.selectedPosition) >= limit
  )
    return false;
  return equal(
    {
      ...previous,
      view: next.view,
      selectedPosition: next.selectedPosition,
      running: previous.phase === "reveal" ? next.running : false,
    },
    next,
  );
}
