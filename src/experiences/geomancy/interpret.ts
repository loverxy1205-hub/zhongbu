import type {
  Interpretation,
  Paragraph,
  PublicInput,
  Theme,
} from "../../types";
import { figureFor, GEOMANCY_SOURCE } from "./data";
import type { GeomancyState } from "./state";

export function interpretGeomancy(
  state: GeomancyState,
  input: PublicInput,
): Interpretation | undefined {
  if (state.phase !== "complete" || !state.raw) return undefined;
  const [w1, w2, judge] = state.raw.positions
    .slice(12)
    .map((p) => ({ ...p, figure: figureFor(p.code) }));
  const paragraph = (
    label: string,
    text: string,
    knowledgeId: string,
    ruleId: string,
  ): Paragraph => ({
    label,
    text,
    knowledgeId,
    ruleId,
    templateId: "gm-text-1",
  });
  const shared = w1.figure.themes.filter((theme) =>
    w2.figure.themes.includes(theme),
  );
  const relation =
    w1.code === w2.code
      ? `两位证人为同一图形，逐行同值归双点，因此裁判为${judge.figure.name}。这表示本次计算的对称关系，不代表多了一票支持。`
      : `${w1.id}侧重${w1.figure.themes.join("、")}，${w2.id}侧重${w2.figure.themes.join("、")}。${shared.length ? `两者共有${shared.join("、")}的观察线索，` : "两侧重点不同，"}裁判由它们逐行合成，不是独立抽到的第三份判断。`;
  const themes: Theme[] = [...new Set([...judge.figure.themes, ...shared])];
  const context =
    input.scene === "无预设" ? "这次问题" : `你选择的「${input.scene}」场景`;
  return {
    headline: `证人${w1.figure.name}与${w2.figure.name}汇成${judge.figure.name}：${judge.figure.themes.join("与")}值得一并观察。`,
    themes,
    paragraphs: [
      paragraph(
        "第一证人 W1 · 母图一侧",
        `${w1.figure.name}（${w1.figure.latin}，${w1.code}），由N1与N2合成。${w1.figure.meaning}`,
        w1.figure.id,
        "gm-witness-mothers-1",
      ),
      paragraph(
        "第二证人 W2 · 女图一侧",
        `${w2.figure.name}（${w2.figure.latin}，${w2.code}），由N3与N4合成。${w2.figure.meaning}`,
        w2.figure.id,
        "gm-witness-daughters-1",
      ),
      paragraph(
        "裁判 J · 两侧合成",
        `${judge.figure.name}（${judge.figure.latin}，${judge.code}）。${judge.figure.meaning} ${relation}`,
        judge.figure.id,
        "gm-judge-xor-1",
      ),
      paragraph(
        "本站情境联想",
        `面对${context}，可以分别记下「已经具备的支撑」和「正在承受的约束」，再对照这两位证人的不同侧重。图形提供观察词汇，不代替对现实条件的核实。`,
        `${w1.figure.id}+${w2.figure.id}+${judge.figure.id}`,
        "gm-context-generic-1",
      ),
    ],
    traditional: [w1, w2, judge].map((p) =>
      paragraph(
        `${p.id} · 传统图名`,
        p.figure.traditional,
        p.figure.id,
        "gm-historical-name-1",
      ),
    ),
    reflection: [],
    inclination: "无明确倾向",
    inclinationReason:
      "本版只提供盾形图关系和象征观察，没有该行动的专属适配断法，不将15个派生图位作为15票。",
    sources: [
      GEOMANCY_SOURCE,
      "众卜原创中文主题、位置模板与情境联想 · gm-text-1",
    ],
    limits: [
      "范围为4母、4女、4侄、2证人、1裁判的基本盾形图；不含十二宫判断和第16调和者。",
      "传统名称与编码有来源；中文白话与证人两侧的观察方式为本站整理，不冒充传统判辞。",
      "相同派生图位彼此相关，不是独立证据；图形不验证事实，也不能给出专业行动指令。",
    ],
  };
}
