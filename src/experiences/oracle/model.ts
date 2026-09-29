import { z } from "zod";
import { uniformInt, type RandomSource } from "../../lib/random";
import type { Interpretation, PublicInput } from "../../types";

export const ORACLE_SOURCES = [
  "https://asia-archive.si.edu/learn/for-educators/teaching-china-with-the-smithsonian/lesson-plans/making-sense-of-the-future-the-oracle-bone-and-shang-dynasty-divination/",
  "https://asia-archive.si.edu/learn/for-educators/teaching-china-with-the-smithsonian/explore-by-object/inscribed-tortoise-shell-oracle-bone/",
];
export const ORACLE_CASES = [
  {
    id: "rain",
    name: "天气与等待",
    title: "S2012.9.445 · 关于雨的两组记载",
    text: "馆方说明这件甲片的三组细刻铭文中，两组与降雨有关。本版仅转述这一经馆方说明的主题，没有已核对的逐字释文，不补写当时的判断或实际天气。",
    source: ORACLE_SOURCES[1],
  },
  {
    id: "hunt",
    name: "行动与收获",
    title: "S2012.9.445 · 一次狩猎的事后记录",
    text: "同一甲片的另一组铭文记下狩猎获得二十头鹿。这里展示的是历史事件的事后记载，不是由本次模拟裂纹推算你的收获，也不意味着某项行动必然有利。",
    source: ORACLE_SOURCES[1],
  },
  {
    id: "record",
    name: "计划与核对",
    title: "教学案例 · 问辞、判断与验辞分开",
    text: "馆方教案举出一条不属于该馆藏甲片的狩猎记载：先记录所问的出行，再记录当时判断，最后记下实际捕获的动物。本站据此把你的问题、个人观察和后来发生的事分栏保存，不把三者当成同一证据。",
    source: ORACLE_SOURCES[0],
  },
] as const;
export const HEAT_SITES = [
  { x: 154, y: 98 },
  { x: 242, y: 116 },
  { x: 141, y: 202 },
  { x: 256, y: 228 },
  { x: 163, y: 318 },
  { x: 231, y: 337 },
] as const;
const point = z
  .object({ x: z.number().min(35).max(365), y: z.number().min(30).max(420) })
  .strict();
export const oracleSchema = z
  .object({
    kind: z.literal("oracle"),
    version: z.literal(1),
    stage: z.number().int().min(0).max(5),
    cracks: z.array(z.array(z.array(point).length(6)).length(3)).length(6),
    site: z.number().int().min(0).max(5),
    observation: z.string().max(1000),
    caseId: z.enum(["rain", "hunt", "record"]),
    outcomes: z
      .array(
        z
          .object({
            text: z.string().trim().min(1).max(1000),
            recordedAt: z.iso.datetime(),
          })
          .strict(),
      )
      .max(20),
  })
  .strict()
  .superRefine((s, ctx) => {
    if (s.stage < 5 && s.outcomes.length)
      ctx.addIssue({
        code: "custom",
        message: "未完成历史体验不能写入事后记录",
      });
    s.cracks.forEach((paths, i) =>
      paths.forEach((path) => {
        if (path[0].x !== HEAT_SITES[i].x || path[0].y !== HEAT_SITES[i].y)
          ctx.addIssue({ code: "custom", message: "裂纹起点与灼点不对应" });
      }),
    );
  });
export type OracleState = z.infer<typeof oracleSchema>;
export function canTransitionOracle(
  previous: OracleState,
  next: OracleState,
): boolean {
  if (JSON.stringify(previous.cracks) !== JSON.stringify(next.cracks))
    return false;
  if (next.stage < previous.stage || next.stage > previous.stage + 1)
    return false;
  if (previous.stage >= 4 && previous.site !== next.site) return false;
  if (
    previous.site !== next.site &&
    !(previous.stage === 3 && next.stage === 3)
  )
    return false;
  if (
    (previous.observation !== next.observation ||
      previous.caseId !== next.caseId) &&
    !(previous.stage === 4 && next.stage === 4)
  )
    return false;
  if (
    previous.stage >= 5 &&
    (previous.observation !== next.observation ||
      previous.caseId !== next.caseId)
  )
    return false;
  if (
    next.outcomes.length < previous.outcomes.length ||
    next.outcomes.length > previous.outcomes.length + 1
  )
    return false;
  if (next.outcomes.length !== previous.outcomes.length && previous.stage !== 5)
    return false;
  return previous.outcomes.every(
    (value, index) =>
      JSON.stringify(value) === JSON.stringify(next.outcomes[index]),
  );
}
export function createOracle(rng: RandomSource): OracleState {
  const cracks = HEAT_SITES.map((start) =>
    [0, 1, 2].map((branch) => {
      let x: number = start.x,
        y: number = start.y;
      const angle =
        ((-80 + branch * 112 + uniformInt(21, rng)) * Math.PI) / 180;
      return [
        { x, y },
        ...Array.from({ length: 5 }, () => {
          x = Math.max(
            65,
            Math.min(
              335,
              x +
                Math.cos(angle) * (9 + uniformInt(13, rng)) +
                uniformInt(13, rng) -
                6,
            ),
          );
          y = Math.max(
            45,
            Math.min(
              405,
              y +
                Math.sin(angle) * (9 + uniformInt(13, rng)) +
                uniformInt(13, rng) -
                6,
            ),
          );
          return { x: Math.round(x), y: Math.round(y) };
        }),
      ];
    }),
  );
  return {
    kind: "oracle",
    version: 1,
    stage: 0,
    cracks,
    site: 0,
    observation: "",
    caseId: "record",
    outcomes: [],
  };
}
export function interpretOracle(
  s: OracleState,
  input: PublicInput,
): Interpretation | undefined {
  if (s.stage !== 5) return;
  const example = ORACLE_CASES.find((c) => c.id === s.caseId)!;
  return {
    headline: "历史流程已完成：裂纹、个人观察与历史案例分别记录。",
    themes: [],
    traditional: [],
    reflection: [],
    paragraphs: [
      {
        label: "当下问题",
        text: input.question || "本次未填写问题，作为历史流程体验保存。",
        knowledgeId: "oracle-modern-note-v1",
        ruleId: "oracle-separate-records-v1",
        templateId: "oracle-question-v1",
      },
      {
        label: "你的观察 · 非传统判词",
        text:
          s.observation || "没有留下个人解释。本版不把模拟裂纹翻译成传统吉凶。",
        knowledgeId: "oracle-user-observation-v1",
        ruleId: "oracle-no-crack-omen-v1",
        templateId: "oracle-observation-v1",
      },
      {
        label: `独立历史案例 · ${example.title}`,
        text: example.text,
        knowledgeId: `oracle-case-${s.caseId}`,
        ruleId: "oracle-case-independent-v1",
        templateId: "oracle-case-summary-v1",
      },
    ],
    inclination: "无明确倾向",
    inclinationReason: "历史流程体验不参与宜忌汇总，也没有中性分数。",
    sources: [...ORACLE_SOURCES],
    limits: [
      "本页使用原创虚拟甲片和冻结参数的程序化裂纹，不是精确材料力学重建，不需要动物材料或真实加热。",
      "资料支持历史操作及具体文物记载，不提供任意现代裂纹的可靠吉凶判读表。",
      "文字均为现代旁注与本站中文概述，没有伪造甲骨字、卜辞原文或把历史收获当作你的未来。",
    ],
  };
}
