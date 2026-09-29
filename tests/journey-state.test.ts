import { describe, expect, it } from "vitest";
import {
  createJourney,
  pickTarot,
  advanceCoinRound,
  drawRuneStone,
} from "../src/lib/journey";
import { advanceReveal, isEngineRevealed } from "../src/lib/reveal";
import { savedSchema } from "../src/lib/schema";
import type { Input } from "../src/types";
const input: Input = {
  question: "今晚如何安排阅读？",
  mode: "explore",
  scene: "无预设",
  action: "",
  targetDate: "2026-09-29",
  timezone: "Asia/Shanghai",
  engines: ["tarot", "iching", "meihua", "numerology", "runes"],
  birthday: "1998-06-15",
  reversals: true,
  everydayOnly: false,
};
function setup() {
  let calls = 0,
    seed = 98;
  const saved = createJourney(input, "2026-09-29T08:00:00Z", () => {
    calls++;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed;
  });
  return { saved, calls: () => calls };
}
describe("complete committed deck and sequential rituals", () => {
  it("commits 78 distinct cards, and actual chosen slots determine each position without new randomness", () => {
    const { saved, calls } = setup();
    const n = calls();
    expect(saved.tarotDeck).toHaveLength(78);
    expect(new Set(saved.tarotDeck!.map((c) => c.id)).size).toBe(78);
    expect(saved.reading.results[0].status).toBe("pending");
    expect(isEngineRevealed(saved, "tarot")).toBe(false);
    const first = pickTarot(saved, 65);
    expect(first.reading).toBe(saved.reading);
    expect(pickTarot(first, 65)).toBe(first);
    expect(pickTarot(first, 78)).toBe(first);
    const second = pickTarot(first, 12);
    expect(savedSchema.safeParse(second).success).toBe(true);
    const last = pickTarot(second, 40);
    expect(last.tarotPicked).toEqual([65, 12, 40]);
    const raw = last.reading.results[0].raw;
    if (raw?.kind !== "tarot") throw Error("missing final tarot");
    expect(raw.cards).toEqual(
      [65, 12, 40].map((index, order) => ({
        ...saved.tarotDeck![index],
        position: ["现状", "阻力", "提示"][order],
      })),
    );
    expect(pickTarot(last, 0)).toBe(last);
    expect(isEngineRevealed(last, "tarot")).toBe(true);
    expect(calls()).toBe(n);
    expect(Object.isFrozen(last.reading)).toBe(true);
    last.reading.results
      .slice(1)
      .forEach((result, index) =>
        expect(result).toBe(saved.reading.results[index + 1]),
      );
    expect(savedSchema.safeParse(last).success).toBe(true);
  });
  it("restores partial choices and rejects a deck or choice inconsistent with the final result", () => {
    const { saved } = setup();
    const partial = pickTarot(saved, 77);
    const restored = savedSchema.parse(JSON.parse(JSON.stringify(partial)));
    expect(restored.tarotPicked).toEqual([77]);
    expect(
      savedSchema.safeParse({ ...saved, tarotDeck: undefined }).success,
    ).toBe(false);
    const final = pickTarot(pickTarot(partial, 50), 1);
    expect(
      savedSchema.safeParse({ ...final, tarotPicked: [77, 50, 2] }).success,
    ).toBe(false);
    expect(
      savedSchema.safeParse({
        ...saved,
        tarotDeck: Array(78).fill(saved.tarotDeck![0]),
      }).success,
    ).toBe(false);
  });
  it("reveals six existing coin rounds in order and cannot skip ahead or change the hexagram", () => {
    const { saved, calls } = setup();
    const n = calls();
    let next = saved;
    expect(advanceCoinRound(next, 1)).toBe(next);
    expect(advanceReveal(next, "iching")).toBe(next);
    for (let i = 0; i < 6; i++) {
      next = advanceCoinRound(next, i);
      expect(next.coinRounds).toBe(i + 1);
      expect(isEngineRevealed(next, "iching")).toBe(i === 5);
      expect(advanceCoinRound(next, i)).toBe(next);
    }
    expect(next.reading).toBe(saved.reading);
    expect(calls()).toBe(n);
    expect(savedSchema.safeParse(next).success).toBe(true);
  });
  it("draws three stones before allowing any carving reveal", () => {
    const { saved } = setup();
    let next = saved;
    expect(advanceReveal(next, "runes", 0)).toBe(next);
    expect(drawRuneStone(next, 2)).toBe(next);
    for (let i = 0; i < 3; i++) next = drawRuneStone(next, i);
    expect(isEngineRevealed(next, "runes")).toBe(false);
    for (let i = 0; i < 3; i++) next = advanceReveal(next, "runes", i);
    expect(isEngineRevealed(next, "runes")).toBe(true);
    expect(next.reading).toBe(saved.reading);
  });
  it("computes timed and birthday results once but reveals them only after their separate rituals", () => {
    const { saved, calls } = setup();
    const n = calls();
    for (const engine of ["meihua", "numerology"] as const) {
      expect(
        saved.reading.results.find((r) => r.engine === engine)?.status,
      ).toBe("ok");
      expect(isEngineRevealed(saved, engine)).toBe(false);
      const opened = advanceReveal(saved, engine);
      expect(isEngineRevealed(opened, engine)).toBe(true);
      expect(opened.reading).toBe(saved.reading);
      expect(advanceReveal(opened, engine)).toBe(opened);
      expect(
        savedSchema.parse(JSON.parse(JSON.stringify(opened))).engineRevealed,
      ).toContain(engine);
      const old = {
        ...saved,
        engineRevealed: ["meihua", "numerology"] as const,
      };
      expect(
        isEngineRevealed(
          { ...old, engineRevealed: [...old.engineRevealed] },
          engine,
        ),
      ).toBe(true);
    }
    expect(calls()).toBe(n);
  });
});
