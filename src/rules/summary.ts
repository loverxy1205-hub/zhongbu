import type { EngineResult, PublicInput, Theme } from "../types";
import { ENGINES } from "../data/meta";
export function summarize(
  results: readonly EngineResult[],
  input: PublicInput,
) {
  const available = results.filter(
    (r) => r.status === "ok" && r.interpretation,
  );
  const map = new Map<Theme, string[]>();
  available.forEach((r) =>
    r.interpretation!.themes.forEach((t) =>
      map.set(t, [...(map.get(t) || []), ENGINES[r.engine].name]),
    ),
  );
  const common = [...map]
    .filter(([, names]) => names.length > 1)
    .map(([t, names]) => `「${t}」同时出现在 ${names.join("、")}。`);
  const differences = available.map(
    (r) =>
      `【${ENGINES[r.engine].name}】强调「${r.interpretation!.themes.join("、")}」；${r.interpretation!.headline}`,
  );
  const go = available.filter((r) => r.interpretation!.themes.includes("推进"));
  const pause = available.filter((r) =>
    r.interpretation!.themes.some((t) => t === "等待" || t === "休整"),
  );
  const conflict =
    go.length && pause.length
      ? `推进与停顿的张力同时存在：${go.map((r) => ENGINES[r.engine].short).join("、")}出现「推进」，${pause.map((r) => ENGINES[r.engine].short).join("、")}出现「等待／休整」。这可能来自不同牌位或变化关系；本次并没有完全一致的方向。`
      : available.length > 1
        ? "各家侧重点如上，主题相近也不代表对现实结果达成一致。"
        : "当前范围不足以比较体系间分歧。";
  const inclinations = [
    ...new Set(available.map((r) => r.interpretation!.inclination)),
  ];
  const inclination =
    input.mode === "explore"
      ? null
      : inclinations.length === 1
        ? inclinations[0]
        : "无明确倾向";
  return {
    common,
    differences,
    conflict,
    inclination,
    scope: results.map((r) => ENGINES[r.engine].name),
    unavailable: results.filter((r) => r.status !== "ok").length,
    related:
      results.some((r) => r.engine === "iching") &&
      results.some((r) => r.engine === "meihua"),
    ruleId: "summary-frozen-themes-v1",
    note:
      input.mode === "explore"
        ? "开放探索只汇总主题。"
        : "只有范围内所有已完成结果的适配倾向一致才复述该倾向；出现分歧即无明确倾向，不按多数投票。",
  };
}
