import { describe, expect, it } from "vitest";
import {
  createJiaobei,
  advanceJiaobei,
  classifyJiaobei,
  interpretJiaobei,
  jiaobeiSchema,
  canTransitionJiaobei,
} from "../src/experiences/jiaobei";
import {
  createOracle,
  oracleSchema,
  interpretOracle,
  canTransitionOracle,
  HEAT_SITES,
  ORACLE_CASES,
} from "../src/experiences/oracle";
import { createJourney, updateExperience } from "../src/lib/journey";
import { ENGINE_IDS } from "../src/data/meta";
import { savedSchema } from "../src/lib/schema";
import { loadSession, saveSession, SESSION_KEY } from "../src/lib/storage";
import { buildAiRequest } from "../src/lib/ai";
import { summarize } from "../src/rules/summary";
import { exportJSON, readingMarkdown } from "../src/lib/export";
import {
  advanceCoffee,
  completeCoffee,
  reobserveCoffee,
} from "../src/experiences/coffee";
import type { Input } from "../src/types";
const input: Input = {
  question: "我明天可以不去参加活动吗？",
  mode: "explore",
  action: "",
  scene: "无预设",
  targetDate: "2026-10-01",
  timezone: "Asia/Shanghai",
  birthday: "1998-06-15",
  engines: [...ENGINE_IDS],
  reversals: true,
  everydayOnly: false,
};
const at = "2026-09-30T02:00:00.000Z";
function rng(seed = 19) {
  let n = seed;
  return () => (n = (Math.imul(n, 1664525) + 1013904223) >>> 0);
}
describe("jiaobei is two faces, not three equiprobable outcomes", () => {
  it("classifies all four face pairs as 2 holy / 1 laugh / 1 yin", () => {
    const outcomes = (["flat", "convex"] as const).flatMap((a) =>
      (["flat", "convex"] as const).map((b) => classifyJiaobei([a, b])),
    );
    expect(outcomes.filter((o) => o === "圣筊")).toHaveLength(2);
    expect(classifyJiaobei(["flat", "flat"])).toBe("笑筊");
    expect(classifyJiaobei(["convex", "convex"])).toBe("阴筊");
  });
  it("draws six independent bits once, then locks mode, proposition and faces", () => {
    let calls = 0;
    const s = createJiaobei(() => calls++);
    expect(calls).toBe(6);
    expect(s.draws).toEqual([
      ["flat", "convex"],
      ["flat", "convex"],
      ["flat", "convex"],
    ]);
    const ready = {
      ...s,
      proposition: "明天不去参加活动",
      phase: "ready" as const,
    };
    expect(canTransitionJiaobei(s, ready)).toBe(true);
    expect(canTransitionJiaobei(ready, { ...ready, mode: "triple" })).toBe(
      false,
    );
    const done = advanceJiaobei(ready);
    expect(done.phase).toBe("complete");
    expect(advanceJiaobei(done)).toBe(done);
    expect(interpretJiaobei(done, input)?.headline).toContain(
      "明天不去参加活动",
    );
    expect(
      canTransitionJiaobei(done, { ...done, proposition: "明天去参加活动" }),
    ).toBe(false);
    expect(calls).toBe(6);
  });
  it("three holy confirmation finishes all three and keeps non-holy records", () => {
    let s = {
      ...createJiaobei(() => 0),
      mode: "triple" as const,
      phase: "ready" as const,
      proposition: "今天休息",
    };
    const one = advanceJiaobei(s),
      two = advanceJiaobei(one),
      three = advanceJiaobei(two);
    expect(one.phase).toBe("ready");
    expect(two.phase).toBe("ready");
    expect(three.phase).toBe("complete");
    const text = interpretJiaobei(three, input)!;
    expect(text.headline).toContain("未获三次全圣确认");
    expect(text.paragraphs[0].text.match(/笑筊/g)).toHaveLength(3);
    expect(text.headline).toContain("不等同三次全阴");
    expect(
      jiaobeiSchema.safeParse({ ...s, proposition: "", demo: false }).success,
    ).toBe(false);
    expect(
      jiaobeiSchema.safeParse({ ...s, proposition: "", demo: true }).success,
    ).toBe(true);
    expect(
      jiaobeiSchema.safeParse({ ...s, phase: "complete", revealed: 1 }).success,
    ).toBe(false);
  });
});
describe("oracle bone is historical process, not fabricated omen decoding", () => {
  it("freezes deterministic cracks beginning at each matching heat site", () => {
    const s = createOracle(rng());
    expect(createOracle(rng())).toEqual(s);
    expect(oracleSchema.safeParse(s).success).toBe(true);
    for (let i = 0; i < 6; i++)
      for (const path of s.cracks[i]) expect(path[0]).toEqual(HEAT_SITES[i]);
    const bad = structuredClone(s);
    bad.cracks[0][0][0].x++;
    expect(oracleSchema.safeParse(bad).success).toBe(false);
    expect(canTransitionOracle(s, { ...s, stage: 5 })).toBe(false);
    expect(ORACLE_CASES).toHaveLength(3);
  });
  it("separates observation and historical case, appends outcome without rewriting first reading", () => {
    const s = {
      ...createOracle(rng()),
      stage: 5,
      observation: "我想到两条不同的路线。",
    };
    const interpretation = interpretOracle(s, input)!;
    expect(interpretation.themes).toEqual([]);
    expect(interpretation.traditional).toEqual([]);
    expect(interpretation.paragraphs[1].text).toBe(s.observation);
    const next = {
      ...s,
      outcomes: [{ text: "后来按自己的计划完成了活动。", recordedAt: at }],
    };
    expect(canTransitionOracle(s, next)).toBe(true);
    expect(interpretOracle(next, input)).toEqual(interpretation);
    expect(canTransitionOracle(s, { ...s, site: 1 })).toBe(false);
    expect(canTransitionOracle(s, { ...s, observation: "改写首次观察" })).toBe(
      false,
    );
  });
});
describe("ten-engine persistence and separation", () => {
  it("freezes each coffee observation interpretation, clears pending text and restores prior versions", () => {
    let saved = createJourney({ ...input, engines: ["coffee"] }, at, rng());
    const coffee = () => {
      const raw = saved.reading.results[0].raw;
      if (raw?.kind !== "coffee") throw Error("missing coffee");
      return raw;
    };
    while (coffee().stage !== "observe")
      saved = updateExperience(saved, advanceCoffee(coffee()));
    saved = updateExperience(saved, completeCoffee(coffee(), true));
    const first = saved.reading.results[0].interpretation!;
    expect(saved.reading.results[0].observationInterpretations).toHaveLength(1);
    saved = updateExperience(saved, reobserveCoffee(coffee()));
    expect(saved.reading.results[0].status).toBe("pending");
    expect(saved.reading.results[0].interpretation).toBeUndefined();
    expect(savedSchema.safeParse(saved).success).toBe(true);
    saved = updateExperience(saved, completeCoffee(coffee(), true));
    expect(saved.reading.results[0].observationInterpretations).toHaveLength(2);
    saved = updateExperience(saved, { ...coffee(), activeVersion: 1 });
    expect(saved.reading.results[0].interpretation).toBe(first);
    expect(savedSchema.safeParse(saved).success).toBe(true);
    expect(readingMarkdown(saved.reading)).toContain("观察版本 2 · 冻结解释");
    const incomplete = structuredClone(saved);
    incomplete.reading.results[0].observationInterpretations =
      incomplete.reading.results[0].observationInterpretations!.slice(0, 1);
    expect(savedSchema.safeParse(incomplete).success).toBe(false);
    delete incomplete.reading.results[0].observationInterpretations;
    expect(savedSchema.safeParse(incomplete).success).toBe(false);
  });
  it("creates all selected engines locally and restores pending input progress without birthday or reroll", () => {
    const journey = createJourney(input, at, rng());
    expect(journey.reading.results).toHaveLength(10);
    expect(
      journey.reading.results.filter((r) => r.status === "pending"),
    ).toHaveLength(6);
    expect(savedSchema.safeParse(journey).success).toBe(true);
    const data = new Map<string, string>();
    const storage = {
      getItem: (k: string) => data.get(k) || null,
      setItem: (k: string, v: string) => {
        data.set(k, v);
      },
      removeItem: (k: string) => {
        data.delete(k);
      },
    };
    expect(saveSession(storage, journey)).toBeNull();
    expect(loadSession(storage).value).toEqual(journey);
    expect(data.get(SESSION_KEY)).not.toContain(input.birthday);
    expect(exportJSON(journey)).not.toContain(input.birthday);
  });
  it("advances only the selected engine; blocks forged redraws and excludes historical records from votes and AI", () => {
    const journey = createJourney(input, at, rng());
    const raw = journey.reading.results.find(
      (r) => r.engine === "jiaobei",
    )!.raw;
    if (raw?.kind !== "jiaobei") throw Error("missing jiaobei");
    const next = updateExperience(journey, {
      ...raw,
      phase: "ready",
      proposition: "明天不去参加活动",
    });
    expect(next.reading.results.filter((r) => r.engine !== "jiaobei")).toEqual(
      journey.reading.results.filter((r) => r.engine !== "jiaobei"),
    );
    const forged = structuredClone(raw);
    forged.draws[0][0] = forged.draws[0][0] === "flat" ? "convex" : "flat";
    expect(updateExperience(journey, forged)).toBe(journey);
    expect(buildAiRequest.bind(null, next.reading, "jiaobei")).toThrow(
      /不发送给模型/,
    );
    const summary = summarize(journey.reading.results, journey.reading.input);
    expect(summary.excluded).toHaveLength(2);
    expect(summary.differences.join("")).not.toContain("Ifá");
    expect(summary.differences.join("")).not.toContain("灼甲");
    expect(readingMarkdown(journey.reading)).toContain("地占术");
    expect(savedSchema.safeParse(next).success).toBe(true);
  });
});
