import { describe, expect, it } from "vitest";
import type { PublicInput } from "../src/types";
import {
  advanceCoffee,
  beginCoffeeAnnotation,
  buildCoffeeTexture,
  canTransitionCoffee,
  coffeeRegion,
  coffeeSchema,
  completeCoffee,
  COFFEE_SYMBOLS,
  createCoffee,
  interpretCoffee,
  reobserveCoffee,
  saveCoffeeAnnotation,
  turnCoffee,
  type CoffeeState,
} from "../src/experiences/coffee";

const input: PublicInput = {
  question: "整理这周的观察",
  mode: "explore",
  scene: "无预设",
  action: "",
  targetDate: "2026-09-30",
  timezone: "Asia/Shanghai",
  engines: [],
  reversals: true,
  everydayOnly: false,
};
const fixture = () => {
  let i = 0;
  return createCoffee(() => [19, 87345, 4294967295, 1234567][i++]);
};
function observed(): CoffeeState {
  let s = advanceCoffee(fixture());
  s = turnCoffee(turnCoffee(s, 90), -30);
  while (s.stage !== "observe") s = advanceCoffee(s);
  return s;
}
function marked(s = observed(), symbol = "bird"): CoffeeState {
  const draft = beginCoffeeAnnotation(s);
  return saveCoffeeAnnotation({
    ...draft,
    draft: { ...draft.draft!, symbol, note: "  一条自己的观察  " },
  });
}

describe("coffee texture is frozen before a person names shapes", () => {
  it("takes exactly four shared uint32 draws only at creation", () => {
    let calls = 0;
    const initial = createCoffee(() => {
      calls++;
      return calls;
    });
    expect(calls).toBe(4);
    expect(initial.texture).toBeUndefined();
    let state = advanceCoffee(initial);
    state = turnCoffee(state, 60);
    for (let i = 0; i < 5; i++) state = advanceCoffee(state);
    expect(state.stage).toBe("observe");
    expect(calls).toBe(4);
    expect(state.texture?.patches).toHaveLength(98);
    expect(state.observations).toEqual([]);
    expect(state.working).toEqual([]);
  });
  it("replays the exact stored geometry from seeds and recorded turning, independent of views", () => {
    const state = observed();
    const restored = coffeeSchema.parse(JSON.parse(JSON.stringify(state)));
    expect(restored.texture).toEqual(
      buildCoffeeTexture(restored.seeds, restored.swirl),
    );
    const rotated = {
      ...restored,
      view: { mode: "unfold" as const, zoom: 1.7, rotation: -90 },
    };
    expect(canTransitionCoffee(restored, rotated)).toBe(true);
    expect(rotated.texture).toBe(restored.texture);
    expect(buildCoffeeTexture(state.seeds, { angle: 60, travel: 120 })).toEqual(
      state.texture,
    );
    expect(
      buildCoffeeTexture(state.seeds, { angle: 90, travel: 90 }),
    ).not.toEqual(state.texture);
    expect(JSON.stringify(state)).not.toMatch(
      /bird|ring|prediction|recognized/,
    );
  });
  it("does not allow a drag, second generation, skipped workflow or altered seeds after cover", () => {
    let state = advanceCoffee(fixture());
    expect(
      canTransitionCoffee(fixture(), { ...fixture(), stage: "observe" }),
    ).toBe(false);
    const next = turnCoffee(state, 30);
    expect(canTransitionCoffee(state, next)).toBe(true);
    expect(
      canTransitionCoffee(state, { ...next, swirl: { angle: 30, travel: 60 } }),
    ).toBe(false);
    state = advanceCoffee(next);
    expect(turnCoffee(state, 90)).toBe(state);
    const forged = {
      ...state,
      seeds: [20, ...state.seeds.slice(1)] as CoffeeState["seeds"],
    };
    forged.texture = buildCoffeeTexture(forged.seeds, forged.swirl);
    expect(coffeeSchema.safeParse(forged).success).toBe(true);
    expect(canTransitionCoffee(state, forged)).toBe(false);
    expect(canTransitionCoffee(state, advanceCoffee(state))).toBe(true);
  });
});

describe("human observation and original dictionary", () => {
  it("offers twenty unique authored prompts plus legal uncertain/other observations", () => {
    expect(COFFEE_SYMBOLS).toHaveLength(20);
    expect(new Set(COFFEE_SYMBOLS.map((s) => s.id)).size).toBe(20);
    expect(COFFEE_SYMBOLS.every((s) => s.name && s.prompt.length > 20)).toBe(
      true,
    );
    for (const symbol of [
      "other",
      "uncertain",
      ...COFFEE_SYMBOLS.map((s) => s.id),
    ]) {
      const state = completeCoffee(marked(observed(), symbol));
      expect(coffeeSchema.safeParse(state).success).toBe(true);
      const result = interpretCoffee(state, input)!;
      expect(result.inclination).toBe("无明确倾向");
      expect(result.traditional).toEqual([]);
      expect(result.paragraphs[0].text).toContain("你在杯壁框出的这片形状");
      expect(result.paragraphs[0].label).toContain("本站象征提示");
    }
  });
  it("a completely empty observation is a valid completed result and never gains a forced symbol", () => {
    const before = observed(),
      state = completeCoffee(before, true);
    expect(canTransitionCoffee(before, state)).toBe(true);
    expect(coffeeSchema.safeParse(state).success).toBe(true);
    expect(state.observations[0].annotations).toEqual([]);
    expect(interpretCoffee(state, input)?.themes).toEqual([]);
    expect(interpretCoffee(state, input)?.paragraphs[0].text).toContain(
      "没有看见清楚形状",
    );
    expect(interpretCoffee(before, input)).toBeUndefined();
    expect(completeCoffee(before)).toBe(before);
  });
  it("only saves explicit selections and records true image regions rather than temporal predictions", () => {
    const start = observed(),
      draft = beginCoffeeAnnotation(start);
    expect(canTransitionCoffee(start, draft)).toBe(true);
    expect(saveCoffeeAnnotation(draft)).toBe(draft);
    const named = {
      ...draft,
      draft: { ...draft.draft!, symbol: "tree", note: "自述" },
    };
    const saved = saveCoffeeAnnotation(named);
    expect(canTransitionCoffee(named, saved)).toBe(true);
    expect(saved.working[0].symbol).toBe("tree");
    expect(saved.draft).toBeUndefined();
    expect(coffeeRegion({ u: 0, v: 0, width: 200, height: 100 })).toBe("杯底");
    expect(coffeeRegion({ u: 0, v: 800, width: 200, height: 100 })).toBe(
      "杯口附近",
    );
    expect(completeCoffee(saved, true)).toBe(saved);
  });
  it("multiple versions all point to one texture without changing older annotations", () => {
    const first = completeCoffee(marked());
    const again = reobserveCoffee(first);
    expect(canTransitionCoffee(first, again)).toBe(true);
    const second = completeCoffee(again, true);
    expect(canTransitionCoffee(again, second)).toBe(true);
    expect(second.observations).toHaveLength(2);
    expect(second.observations[0]).toEqual(first.observations[0]);
    expect(new Set(second.observations.map((o) => o.textureId)).size).toBe(1);
    expect(second.texture).toBe(first.texture);
    expect(canTransitionCoffee(second, { ...second, activeVersion: 1 })).toBe(
      true,
    );
    const tampered = structuredClone(second);
    tampered.observations[0].annotations[0].symbol = "mountain";
    expect(canTransitionCoffee(second, tampered)).toBe(false);
  });
  it("bounds annotations and versions instead of silently truncating", () => {
    let state = observed();
    for (let i = 0; i < 8; i++) state = marked(state, "uncertain");
    expect(state.working).toHaveLength(8);
    expect(beginCoffeeAnnotation(state)).toBe(state);
    state = completeCoffee(state);
    for (let i = 1; i < 8; i++)
      state = completeCoffee(reobserveCoffee(state), true);
    expect(state.observations).toHaveLength(8);
    expect(reobserveCoffee(state)).toBe(state);
    expect(coffeeSchema.safeParse(state).success).toBe(true);
  });
});

describe("strict coffee restoration", () => {
  it("rejects wrong versions, oversized annotations, corrupt geometry and unsupported labels", () => {
    const state = completeCoffee(marked());
    const mutations: ((s: Record<string, unknown>) => void)[] = [
      (s) => {
        s.version = 2;
      },
      (s) => {
        s.dictionaryVersion = "unverified";
      },
      (s) => {
        s.unknownField = true;
      },
      (s) => {
        s.activeVersion = 3;
      },
      (s) => {
        (s.texture as CoffeeState["texture"])!.patches[0].points[0].u++;
      },
      (s) => {
        (s.observations as CoffeeState["observations"])[0].annotations[0].note =
          "字".repeat(161);
      },
      (s) => {
        (
          s.observations as CoffeeState["observations"]
        )[0].annotations[0].symbol = "auto-positive";
      },
      (s) => {
        (s.observations as CoffeeState["observations"])[0].textureId =
          "different-cup";
      },
      (s) => {
        (s.observations as CoffeeState["observations"])[0].annotations[0].box =
          { u: 990, v: 0, width: 200, height: 100 };
      },
    ];
    for (const mutate of mutations) {
      const bad = structuredClone(state) as unknown as Record<string, unknown>;
      mutate(bad);
      expect(coffeeSchema.safeParse(bad).success).toBe(false);
    }
  });
  it("requires the same unscaled unfold frame for an unfinished annotation", () => {
    const state = beginCoffeeAnnotation(observed());
    expect(coffeeSchema.safeParse(state).success).toBe(true);
    expect(
      coffeeSchema.safeParse({ ...state, view: { ...state.view, zoom: 2 } })
        .success,
    ).toBe(false);
    expect(
      coffeeSchema.safeParse({ ...state, view: { ...state.view, mode: "top" } })
        .success,
    ).toBe(false);
  });
});
