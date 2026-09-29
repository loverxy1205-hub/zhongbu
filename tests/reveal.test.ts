import { describe, expect, it, vi } from "vitest";
import { createReading } from "../src/engines/reading";
import { advanceReveal, isEngineRevealed } from "../src/lib/reveal";
import { defaultPreferences, loadHistory } from "../src/lib/storage";
import { exportJSON } from "../src/lib/export";
import { savedSchema } from "../src/lib/schema";
import { CORE_ENGINE_IDS as ENGINE_IDS } from "../src/data/meta";
import type { Input, SavedReading } from "../src/types";

const input: Input = {
  question: "怎样安排今天的学习？",
  mode: "explore",
  scene: "任务推进",
  action: "",
  engines: [...ENGINE_IDS],
  targetDate: "2026-09-29",
  timezone: "Asia/Shanghai",
  birthday: "1998-06-15",
  reversals: true,
  everydayOnly: false,
};
function fixture(overrides: Partial<Input> = {}) {
  let seed = 61;
  const rng = vi.fn(() => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed;
  });
  const reading = createReading(
    { ...input, ...overrides },
    "2026-09-29T04:30:00.000Z",
    rng,
  );
  const saved: SavedReading = {
    reading,
    preferences: defaultPreferences(reading),
    savedAt: "",
    tarotRevealed: [],
    runeRevealed: [],
    engineRevealed: [],
  };
  return { saved, rng };
}

describe("independent result reveals", () => {
  it("reveals all five engines without changing their frozen results or drawing again", () => {
    const { saved, rng } = fixture();
    const calls = rng.mock.calls.length;
    const snapshot = JSON.stringify(saved.reading);
    let next = saved;
    for (const engine of ENGINE_IDS) {
      expect(isEngineRevealed(next, engine)).toBe(false);
      if (engine === "tarot" || engine === "runes") {
        for (const index of [2, 0, 1])
          next = advanceReveal(next, engine, index);
      } else next = advanceReveal(next, engine);
      expect(isEngineRevealed(next, engine)).toBe(true);
      expect(next.reading).toBe(saved.reading);
      expect(next.preferences).toBe(saved.preferences);
    }
    expect(JSON.stringify(next.reading)).toBe(snapshot);
    expect(rng).toHaveBeenCalledTimes(calls);
    expect(saved.tarotRevealed).toEqual([]);
    expect(saved.runeRevealed).toEqual([]);
    expect(saved.engineRevealed).toEqual([]);
  });

  it("one rock or one engine cannot unlock another engine's reading", () => {
    const { saved } = fixture();
    let next = advanceReveal(saved, "runes", 1);
    expect(next.runeRevealed).toEqual([1]);
    expect(isEngineRevealed(next, "runes")).toBe(false);
    next = advanceReveal(next, "meihua");
    expect(isEngineRevealed(next, "meihua")).toBe(true);
    for (const engine of ["tarot", "iching", "numerology", "runes"] as const)
      expect(isEngineRevealed(next, engine)).toBe(false);
  });

  it("ignores double clicks and invalid positions instead of writing duplicate progress", () => {
    const { saved } = fixture();
    for (const engine of ["tarot", "runes"] as const) {
      for (const position of [undefined, -1, 3, 0.5, NaN])
        expect(advanceReveal(saved, engine, position)).toBe(saved);
      const next = advanceReveal(saved, engine, 0);
      expect(advanceReveal(next, engine, 0)).toBe(next);
    }
    const next = advanceReveal(saved, "iching");
    expect(advanceReveal(next, "iching")).toBe(next);
  });

  it("opens legacy results while preserving a v1.3 partially opened tarot spread", () => {
    const { saved } = fixture();
    delete saved.engineRevealed;
    delete saved.runeRevealed;
    saved.tarotRevealed = [1];
    for (const engine of ["iching", "meihua", "numerology", "runes"] as const) {
      expect(isEngineRevealed(saved, engine)).toBe(true);
      expect(advanceReveal(saved, engine, 0)).toBe(saved);
    }
    expect(isEngineRevealed(saved, "tarot")).toBe(false);
    delete saved.tarotRevealed;
    expect(isEngineRevealed(saved, "tarot")).toBe(true);
  });

  it("never traps unavailable or unselected engines behind a reveal", () => {
    const { saved } = fixture({
      birthday: "",
      engines: ["numerology", "meihua"],
    });
    expect(isEngineRevealed(saved, "numerology")).toBe(true);
    expect(isEngineRevealed(saved, "tarot")).toBe(true);
    expect(advanceReveal(saved, "numerology")).toBe(saved);
    expect(advanceReveal(saved, "tarot", 0)).toBe(saved);
    const next = advanceReveal(saved, "meihua");
    expect(
      next.reading.results.every((r) => isEngineRevealed(next, r.engine)),
    ).toBe(true);
  });

  it("round trips partial progress through history/export and rejects corrupt progress", () => {
    const { saved } = fixture();
    const partial = advanceReveal(advanceReveal(saved, "runes", 2), "iching");
    const restored = loadHistory({
      getItem: () => `[${exportJSON(partial)}]`,
      setItem: () => {},
      removeItem: () => {},
    });
    expect(restored.error).toBeNull();
    expect(restored.value[0]).toEqual(partial);
    expect(isEngineRevealed(restored.value[0], "runes")).toBe(false);
    expect(isEngineRevealed(restored.value[0], "iching")).toBe(true);
    expect(exportJSON(partial)).not.toContain(input.birthday);
    for (const patch of [
      { runeRevealed: [1, 1] },
      { runeRevealed: [3] },
      { runeRevealed: [-1] },
      { engineRevealed: ["tarot"] },
      { engineRevealed: ["iching", "iching"] },
    ])
      expect(savedSchema.safeParse({ ...partial, ...patch }).success).toBe(
        false,
      );
  });
});
