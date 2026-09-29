import { describe, expect, it, vi } from "vitest";
import { GEOMANTIC_FIGURES, figureFor } from "../src/experiences/geomancy/data";
import {
  addSandPoint,
  advanceGeomancy,
  calculateGeomancy,
  canTransitionGeomancy,
  clearSandRow,
  combine,
  commitAutomaticCounts,
  commitPhysicalCounts,
  commitSandRow,
  createGeomancy,
  geomancySchema,
  HAND_DOT_LIMIT,
  selectGeomancyMode,
  setPhysicalCount,
} from "../src/experiences/geomancy/state";
import { interpretGeomancy } from "../src/experiences/geomancy/interpret";
import type { PublicInput } from "../src/types";

const input: PublicInput = {
  question: "是否暂缓？",
  mode: "explore",
  scene: "无预设",
  action: "",
  options: [],
  targetDate: "2026-09-30",
  timezone: "Asia/Shanghai",
  engines: [],
  reversals: true,
  everydayOnly: true,
};
const make = () => createGeomancy(() => 0);
const completeAuto = () =>
  advanceGeomancy(
    commitAutomaticCounts(selectGeomancyMode(make(), "auto")),
    true,
  );

describe("地占基本盾图与16图知识", () => {
  it("完整核对十六图编码，不凭名称排列编码", () => {
    const expected = {
      Via: "1111",
      Populus: "0000",
      "Fortuna Major": "0011",
      "Fortuna Minor": "1100",
      Acquisitio: "0101",
      Amissio: "1010",
      Laetitia: "1000",
      Tristitia: "0001",
      Puella: "1011",
      Puer: "1101",
      Albus: "0010",
      Rubeus: "0100",
      Conjunctio: "0110",
      Carcer: "1001",
      "Caput Draconis": "0111",
      "Cauda Draconis": "1110",
    };
    expect(
      Object.fromEntries(GEOMANTIC_FIGURES.map((f) => [f.latin, f.code])),
    ).toEqual(expected);
    expect(new Set(GEOMANTIC_FIGURES.map((f) => f.code)).size).toBe(16);
    for (const f of GEOMANTIC_FIGURES)
      expect(
        [f.id, f.name, f.meaning, f.conditions, f.limits, f.source].every(
          Boolean,
        ),
      ).toBe(true);
  });
  it("已知母图转置为女图，再正确合成侄、证人和裁判", () => {
    const raw = calculateGeomancy([
      1, 1, 1, 1, 1, 2, 1, 2, 2, 2, 1, 1, 1, 2, 2, 1,
    ]);
    expect(raw.positions.map((p) => `${p.id}:${p.code}`)).toEqual([
      "M1:1111",
      "M2:1010",
      "M3:0011",
      "M4:1001",
      "D1:1101",
      "D2:1000",
      "D3:1110",
      "D4:1011",
      "N1:0101",
      "N2:1010",
      "N3:0101",
      "N4:0101",
      "W1:1111",
      "W2:0000",
      "J:1111",
    ]);
    expect(raw.positions[4].rows).toEqual([0, 4, 8, 12]);
    expect(raw.positions[14].parents).toEqual(["W1", "W2"]);
  });
  it("合成同值为0，异值为1；输入不接受空行、小数或超量", () => {
    expect(combine([0, 1, 0, 1], [0, 0, 1, 1])).toEqual([0, 1, 1, 0]);
    for (const value of [0, -1, 1.2, 1000000, Number.NaN])
      expect(() => calculateGeomancy([value, ...Array(15).fill(1)])).toThrow();
    expect(() => calculateGeomancy(Array(15).fill(1))).toThrow();
    expect(() => combine([2, 0, 1, 0], [1, 1, 1, 1])).toThrow();
    expect(() => figureFor("abcd")).toThrow();
  });
  it("全部65536种母图生成15位且裁判含偶数个单点", () => {
    const judges = new Set<string>();
    for (let seed = 0; seed < 65536; seed++) {
      const raw = calculateGeomancy(
        Array.from({ length: 16 }, (_, i) => ((seed >> i) & 1 ? 1 : 2)),
      );
      const judge = raw.positions[14].code;
      if (
        raw.positions.length !== 15 ||
        [...judge].filter((n) => n === "1").length % 2 !== 0
      )
        throw Error(`盾图不变量失败：${seed}`);
      judges.add(judge);
    }
    expect(judges.size).toBe(8);
  });
});

describe("冻结输入与恢复", () => {
  it("仅创建时消耗共享随机源，5–36每种都可出现且奇偶平衡", () => {
    let n = 0;
    const rng = vi.fn(() => n++);
    const a = createGeomancy(rng),
      b = createGeomancy(rng);
    expect([...a.autoCounts, ...b.autoCounts]).toEqual(
      Array.from({ length: 32 }, (_, i) => i + 5),
    );
    const saved = advanceGeomancy(
      commitAutomaticCounts(selectGeomancyMode(a, "auto")),
      true,
    );
    expect(geomancySchema.parse(JSON.parse(JSON.stringify(saved)))).toEqual(
      saved,
    );
    interpretGeomancy(saved, input);
    expect(rng).toHaveBeenCalledTimes(32);
  });
  it("亲手空行不可提交，点ID唯一，清空后不重用ID，限制有明确上限", () => {
    let state = selectGeomancyMode(make(), "hand");
    expect(commitSandRow(state)).toBe(state);
    state = addSandPoint(state);
    const id = state.handRows[0][0].id;
    state = addSandPoint(clearSandRow(state));
    expect(state.handRows[0][0].id).not.toBe(id);
    for (let i = 1; i < HAND_DOT_LIMIT; i++) state = addSandPoint(state);
    expect(state.handRows[0]).toHaveLength(HAND_DOT_LIMIT);
    expect(addSandPoint(state)).toBe(state);
    state = commitSandRow(state);
    expect(clearSandRow(state).handRows[0]).toEqual(state.handRows[0]);
    expect(state.committedCounts).toEqual([HAND_DOT_LIMIT]);
    expect(geomancySchema.safeParse(state).success).toBe(true);
  });
  it("同一位置重复点按仍各自可见，不重叠覆盖，并可验证状态转移", () => {
    let state = selectGeomancyMode(make(), "hand");
    for (let i = 0; i < HAND_DOT_LIMIT; i++) {
      const next = addSandPoint(state, 0.5, 0.5);
      expect(canTransitionGeomancy(state, next)).toBe(true);
      state = next;
    }
    expect(new Set(state.handRows[0].map((p) => `${p.x}/${p.y}`)).size).toBe(
      HAND_DOT_LIMIT,
    );
  });
  it("手点16行产生真实点数盾图，提交后不能继续点或反悔重画", () => {
    let state = selectGeomancyMode(make(), "hand");
    for (let row = 0; row < 16; row++) {
      for (let point = 0; point <= row; point++) state = addSandPoint(state);
      const next = commitSandRow(state);
      expect(canTransitionGeomancy(state, next)).toBe(true);
      state = next;
    }
    expect(state.raw?.rawCounts).toEqual(
      Array.from({ length: 16 }, (_, i) => i + 1),
    );
    expect(state.phase).toBe("reveal");
    expect(clearSandRow(state)).toBe(state);
    expect(addSandPoint(state)).toBe(state);
    expect(selectGeomancyMode(state, "auto")).toBe(state);
    expect(geomancySchema.safeParse(state).success).toBe(true);
  });
  it("实物录入严格接受16个正整数且与自动算法一致", () => {
    let state = selectGeomancyMode(make(), "physical");
    for (const invalid of ["0", "-1", "1.5", "", "1e2", " 5", "0005"]) {
      const partial = setPhysicalCount(state, 0, invalid);
      expect(() => commitPhysicalCounts(partial)).toThrow();
    }
    for (let i = 0; i < 16; i++) {
      const next = setPhysicalCount(state, i, String(i + 5));
      expect(canTransitionGeomancy(state, next)).toBe(true);
      state = next;
    }
    const next = commitPhysicalCounts(state);
    expect(canTransitionGeomancy(state, next)).toBe(true);
    expect(next.raw).toEqual(
      calculateGeomancy(Array.from({ length: 16 }, (_, i) => i + 5)),
    );
    expect(geomancySchema.safeParse(next).success).toBe(true);
  });
  it("恢复拒绝篡改的盾图、重复点ID、伪造进度和不一致原数", () => {
    const complete = completeAuto();
    const malformed = structuredClone(complete);
    malformed.raw!.positions[14].code = "1010";
    expect(geomancySchema.safeParse(malformed).success).toBe(false);
    expect(
      geomancySchema.safeParse({ ...complete, autoCounts: Array(16).fill(6) })
        .success,
    ).toBe(false);
    expect(
      geomancySchema.safeParse({ ...complete, running: true }).success,
    ).toBe(false);
    const hand = addSandPoint(selectGeomancyMode(make(), "hand"));
    hand.handRows[0].push(hand.handRows[0][0]);
    expect(geomancySchema.safeParse(hand).success).toBe(false);
  });
  it("不可跳改种子、模式、已提交行，允许暂停／视图和单步或跳过演示", () => {
    const initial = make();
    expect(
      canTransitionGeomancy(initial, selectGeomancyMode(initial, "auto")),
    ).toBe(true);
    expect(
      canTransitionGeomancy(initial, {
        ...initial,
        autoCounts: Array(16).fill(6),
      }),
    ).toBe(false);
    let hand = addSandPoint(selectGeomancyMode(initial, "hand"));
    expect(canTransitionGeomancy(hand, clearSandRow(hand))).toBe(true);
    hand = commitSandRow(hand);
    const tampered = structuredClone(hand);
    tampered.handRows[0] = [];
    tampered.committedCounts = [];
    expect(canTransitionGeomancy(hand, tampered)).toBe(false);
    const reveal = commitAutomaticCounts(selectGeomancyMode(initial, "auto"));
    expect(canTransitionGeomancy(reveal, { ...reveal, running: false })).toBe(
      true,
    );
    expect(canTransitionGeomancy(reveal, advanceGeomancy(reveal))).toBe(true);
    expect(canTransitionGeomancy(reveal, advanceGeomancy(reveal, true))).toBe(
      true,
    );
    expect(canTransitionGeomancy(reveal, { ...reveal, revealStep: 4 })).toBe(
      false,
    );
    const complete = advanceGeomancy(reveal, true);
    expect(
      canTransitionGeomancy(complete, {
        ...complete,
        view: "shield",
        selectedPosition: "J",
      }),
    ).toBe(true);
    expect(canTransitionGeomancy(complete, reveal)).toBe(false);
  });
  it("逐步与跳过得到相同冻结原图；未完成不生成解读", () => {
    const reveal = commitAutomaticCounts(selectGeomancyMode(make(), "auto"));
    expect(interpretGeomancy(reveal, input)).toBeUndefined();
    let step = reveal;
    for (let i = 0; i < 6; i++) step = advanceGeomancy(step);
    expect(step).toEqual(advanceGeomancy(reveal, true));
    const interpretation = interpretGeomancy(step, input)!;
    expect(interpretation.inclination).toBe("无明确倾向");
    expect(interpretation.paragraphs.map((p) => p.ruleId)).toContain(
      "gm-judge-xor-1",
    );
    expect(interpretation.limits.join("")).toContain("不是独立证据");
  });
});
