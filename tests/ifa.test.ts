import { describe, expect, it, vi } from "vitest";
import {
  advanceIfa,
  canTransitionIfa,
  createIfa,
  ifaSchema,
  interpretIfa,
} from "../src/experiences/ifa/model";
import type { IfaState } from "../src/experiences/ifa/model";
import {
  baseFigures,
  baseForCode,
  signatureCatalog,
  signatureId,
  IFA_ORIENTATION,
} from "../src/experiences/ifa/signatureCatalog";
import {
  interpretationCorpus,
  MISSING_IFA_TEXT,
} from "../src/experiences/ifa/interpretationCorpus";
import { reflectionTemplates } from "../src/experiences/ifa/reflectionTemplates";
import type { PublicInput } from "../src/types";

const input: PublicInput = {
  question: "我可以不去上学吗？",
  mode: "explore",
  scene: "无预设",
  action: "",
  targetDate: "2026-10-01",
  timezone: "Asia/Shanghai",
  engines: [],
  reversals: true,
  everydayOnly: true,
};
function fromBits(bits: string): IfaState {
  let index = 0;
  return createIfa(() => Number(bits[index++]));
}
function finish(state: IfaState): IfaState {
  return ["intro", "focus", "lifted", "settled"].reduce(
    (current) => advanceIfa(current, current.phase),
    state,
  );
}

describe("Ifá · verified signatures and orientation", () => {
  it("covers all sixteen checked four-row figures, without borrowing geomancy names", () => {
    // Independent transcription of Tubi 2020, p.135, Fig.2; 1=I, 0=II, top-down.
    const expected = {
      Ogbe: "1111",
      Oyeku: "0000",
      Iwori: "0110",
      Odi: "1001",
      Irosun: "1100",
      Owonrin: "0011",
      Obara: "1000",
      Okanran: "0001",
      Ogunda: "1110",
      Osa: "0111",
      Ika: "0100",
      Oturupon: "0010",
      Otura: "1011",
      Irete: "1101",
      Ose: "1010",
      Ofun: "0101",
    };
    expect(
      Object.fromEntries(baseFigures.map((entry) => [entry.name, entry.code])),
    ).toEqual(expected);
    expect(new Set(baseFigures.map((entry) => entry.code)).size).toBe(16);
    expect(baseFigures.every((entry) => entry.sourceIds.length >= 2)).toBe(
      true,
    );
    expect(baseForCode("1001").aliases).toContain("Edi");
    expect(() => baseForCode("10101")).toThrow();
  });

  it("has 256 unique ordered signatures: 16 matching pairs and 240 different pairs", () => {
    expect(signatureCatalog).toHaveLength(256);
    expect(new Set(signatureCatalog.map((entry) => entry.id)).size).toBe(256);
    expect(signatureCatalog.filter((entry) => entry.paired)).toHaveLength(16);
    expect(signatureCatalog.filter((entry) => !entry.paired)).toHaveLength(240);
    expect(
      signatureCatalog.every(
        (entry) => entry.name === null && entry.aliases.length === 0,
      ),
    ).toBe(true);
    expect(
      signatureCatalog.every((entry) => entry.orientation === IFA_ORIENTATION),
    ).toBe(true);
    expect(signatureId("0001", "1101")).not.toBe(signatureId("1101", "0001"));
  });

  it("matches Bascom Figure 2's right Okanran / left Irete without mirroring or reversing rows", () => {
    const state = fromBits("00011101");
    expect(state.rightCode).toBe("0001");
    expect(state.leftCode).toBe("1101");
    expect(baseForCode(state.rightCode).name).toBe("Okanran");
    expect(baseForCode(state.leftCode).name).toBe("Irete");
    expect(state.signatureId).toBe("ifa-r0001-l1101");
    expect(state.faces.slice(0, 4)).toEqual([0, 0, 0, 1]);
    expect(state.faces.slice(4)).toEqual([1, 1, 0, 1]);
  });

  it("freezes exactly eight independent uint32 binary draws, with no birthday or question seed", () => {
    const rng = vi
      .fn()
      .mockReturnValueOnce(4294967295)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(2)
      .mockReturnValueOnce(3)
      .mockReturnValueOnce(10)
      .mockReturnValueOnce(11)
      .mockReturnValueOnce(12)
      .mockReturnValueOnce(13);
    const state = createIfa(rng);
    expect(rng).toHaveBeenCalledTimes(8);
    expect(state.faces).toEqual([1, 0, 0, 1, 0, 1, 0, 1]);
    expect(ifaSchema.safeParse(state).success).toBe(true);
    expect(() => createIfa(() => -1)).toThrow();
  });

  it("all 256 binary casts correspond to one catalog entry and contain no favorable/unfavorable flag", () => {
    for (let value = 0; value < 256; value++) {
      const state = fromBits(value.toString(2).padStart(8, "0"));
      expect(ifaSchema.safeParse(state).success).toBe(true);
      expect(
        signatureCatalog.filter((entry) => entry.id === state.signatureId),
      ).toHaveLength(1);
      expect(Object.keys(state)).not.toContain("luck");
    }
  });

  it("strictly rejects missing faces, unknown fields, wrong versions and altered derived codes", () => {
    const state = fromBits("00011101");
    for (const invalid of [
      { ...state, faces: state.faces.slice(1) },
      { ...state, faces: [...state.faces, 1] },
      { ...state, faces: [2, ...state.faces.slice(1)] },
      { ...state, faces: [0.5, ...state.faces.slice(1)] },
      { ...state, rightCode: "1101", leftCode: "0001" },
      { ...state, signatureId: "ifa-r1101-l0001" },
      { ...state, version: 2 },
      { ...state, orientation: "mirrored" },
      { ...state, corpusVersion: "new" },
      { ...state, traditionalAnswer: "invented" },
    ])
      expect(ifaSchema.safeParse(invalid).success).toBe(false);
  });
});

describe("Ifá · persistent user-paced stages and honest missing text", () => {
  it("advances only along the allowed path and preserves all eight frozen faces", () => {
    const state = fromBits("00101011");
    let current = state;
    for (const expected of ["focus", "lifted", "settled", "complete"]) {
      const next = advanceIfa(current, current.phase);
      expect(next.phase).toBe(expected);
      expect(canTransitionIfa(current, next)).toBe(true);
      expect(next.faces).toBe(state.faces);
      expect(next.signatureId).toBe(state.signatureId);
      expect(ifaSchema.parse(JSON.parse(JSON.stringify(next)))).toEqual(next);
      current = next;
    }
    expect(advanceIfa(current, "complete")).toBe(current);
    expect(advanceIfa(state, "lifted")).toBe(state);
    expect(canTransitionIfa(state, current)).toBe(false);
    expect(canTransitionIfa(current, state)).toBe(false);
    expect(
      canTransitionIfa(state, {
        ...state,
        phase: "focus",
        faces: [1, 0, 1, 0, 1, 0, 1, 1],
      }),
    ).toBe(false);
  });

  it("does not interpret incomplete phases or synthesize unverified traditional verses", () => {
    const state = fromBits("00011101");
    for (const phase of ["intro", "focus", "lifted", "settled"] as const)
      expect(interpretIfa({ ...state, phase }, input)).toBeUndefined();
    expect(interpretationCorpus).toEqual([]);
    const answer = interpretIfa(finish(state), input)!;
    expect(answer.headline).toBe(MISSING_IFA_TEXT);
    expect(answer.traditional).toEqual([]);
    expect(answer.themes).toEqual([]);
    expect(answer.inclination).toBe("无明确倾向");
    expect(answer.inclinationReason).toContain("不参加方向投票");
    expect(answer.paragraphs[0].text).toContain(
      "右列 Okanran（0001），左列 Irete（1101）",
    );
    expect(
      answer.reflection.every((entry) => entry.label.includes("本站创作")),
    ).toBe(true);
    expect(
      answer.limits.some((text) => text.includes("不是完整的 Ifá 宗教咨询")),
    ).toBe(true);
    expect(
      answer.limits.some((text) =>
        text.includes("不是对真实占链朝向概率的测量"),
      ),
    ).toBe(true);
    expect(
      answer.paragraphs.every(
        (entry) => entry.knowledgeId && entry.ruleId && entry.templateId,
      ),
    ).toBe(true);
  });

  it("does not assign direction to any of 256 signatures or reverse the user's negative action", () => {
    const actionInput: PublicInput = {
      ...input,
      mode: "action",
      scene: "上课安排",
      action: "不去上学",
      options: ["不去上学", "去上学"],
    };
    const original = JSON.stringify(actionInput);
    for (let value = 0; value < 256; value++) {
      const answer = interpretIfa(
        finish(fromBits(value.toString(2).padStart(8, "0"))),
        actionInput,
      )!;
      expect(answer.themes).toEqual([]);
      expect(answer.traditional).toEqual([]);
      expect(answer.inclination).toBe("无明确倾向");
      expect(answer.reflection[1].text).toContain("2 个选项");
    }
    expect(JSON.stringify(actionInput)).toBe(original);
    expect(reflectionTemplates).toHaveLength(2);
  });
});
