import { describe, expect, it, vi } from "vitest";
import { createReading } from "../src/engines/reading";
import { readingMarkdown, exportJSON } from "../src/lib/export";
import {
  defaultPreferences,
  loadHistory,
  HISTORY_KEY,
} from "../src/lib/storage";
import type { Input, SavedReading } from "../src/types";
import { savedSchema } from "../src/lib/schema";
const input: Input = {
  question: "明天如何安排？",
  mode: "action",
  options: ["去上课", "不去上课"],
  action: "",
  scene: "上课安排",
  targetDate: "2026-09-29",
  timezone: "Asia/Shanghai",
  engines: ["tarot", "iching", "meihua", "numerology", "runes"],
  birthday: "1998-06-15",
  reversals: true,
  everydayOnly: false,
};
const instant = "2026-09-29T04:30:00.000Z";
function rng() {
  let next = 41;
  return () => {
    next = (Math.imul(next, 1664525) + 1013904223) >>> 0;
    return next;
  };
}
describe("multiple action choices", () => {
  it.each([
    undefined,
    [],
    ["去上课"],
    ["去上课", "  "],
    ["去上课", "去上课"],
    [" 去上课 ", "去上课"],
    ["去上课", "字".repeat(301)],
    Array.from({ length: 11 }, (_, index) => `选择${index}`),
  ])("rejects invalid options before drawing: %j", (options) => {
    const random = vi.fn(rng());
    expect(() =>
      createReading({ ...input, options }, instant, random),
    ).toThrow();
    expect(random).not.toHaveBeenCalled();
  });
  it("preserves order and negation without silently selecting an option", () => {
    const reading = createReading(
      {
        ...input,
        category: "工作",
        options: [" 去上课 ", "不去上课", "先沟通再请假"],
      },
      instant,
      rng(),
    );
    expect(reading.input.options).toEqual([
      "去上课",
      "不去上课",
      "先沟通再请假",
    ]);
    expect(reading.input).not.toHaveProperty("category");
    expect(reading.input.action).toBe("");
    expect(Object.isFrozen(reading.input.options)).toBe(true);
    for (const result of reading.results) {
      expect(result.interpretation?.inclination).toBe("无明确倾向");
      expect(result.interpretation?.reflection[0].text).toContain(
        "选项 2「不去上课」",
      );
    }
    const open = createReading({ ...input, mode: "explore" }, instant, rng());
    expect(open.results.map((result) => result.raw)).toEqual(
      reading.results.map((result) => result.raw),
    );
    expect(open.input).not.toHaveProperty("options");
  });
  it("exports and restores all choices while excluding the birthday", () => {
    const reading = createReading(input, instant, rng());
    const saved: SavedReading = {
      reading,
      preferences: defaultPreferences(reading),
      savedAt: instant,
    };
    const json = exportJSON(saved);
    const restored = loadHistory({
      getItem: (key) => (key === HISTORY_KEY ? `[${json}]` : null),
      setItem: () => {},
      removeItem: () => {},
    });
    expect(restored.error).toBeNull();
    expect(restored.value[0].reading).toEqual(reading);
    expect(json).not.toContain(input.birthday);
    expect(readingMarkdown(reading)).toContain("选项 2：不去上课");
  });
  it("still restores legacy category and a single action without regenerating", () => {
    const reading = structuredClone(createReading(input, instant, rng()));
    delete reading.input.options;
    reading.input.category = "人际";
    reading.input.action = "不联系";
    reading.versions.app = "1.1.0";
    const saved: SavedReading = {
      reading,
      preferences: defaultPreferences(reading),
      savedAt: instant,
    };
    const restored = loadHistory({
      getItem: () => JSON.stringify([saved]),
      setItem: () => {},
      removeItem: () => {},
    });
    expect(restored.error).toBeNull();
    expect(restored.value[0].reading).toEqual(reading);
  });

  it("restores partial reveal progress separately from the frozen reading", () => {
    const reading = createReading(input, instant, rng());
    const saved: SavedReading = {
      reading,
      preferences: defaultPreferences(reading),
      savedAt: instant,
      tarotRevealed: [2, 0],
    };
    const restored = loadHistory({
      getItem: () => `[${exportJSON(saved)}]`,
      setItem: () => {},
      removeItem: () => {},
    });
    expect(restored.error).toBeNull();
    expect(restored.value[0].tarotRevealed).toEqual([2, 0]);
    expect(restored.value[0].reading).toEqual(reading);
    expect(Object.isFrozen(restored.value[0].reading)).toBe(true);
    expect(exportJSON(saved)).not.toContain(input.birthday);
    for (const tarotRevealed of [[-1], [3], [0.5], [1, 1], [0, 1, 2, 2]])
      expect(savedSchema.safeParse({ ...saved, tarotRevealed }).success).toBe(
        false,
      );
    expect(
      savedSchema.safeParse({ ...saved, tarotRevealed: undefined }).success,
    ).toBe(true);
  });
});
