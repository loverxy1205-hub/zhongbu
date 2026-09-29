import type { PublicInput, Paragraph } from "../../types";

export const IFA_REFLECTION_VERSION = "ifa-reflection-1";
export const reflectionTemplates = [
  {
    id: "ifa-reflection-observation-v1",
    label: "先区分观察与解释 · 本站创作",
    text: "两列的相同或不同只是图式结构。先把实际看见的凹凸面、单划与双划说清楚，再区分自己联想到的意思；不把形状直接等同于现实答案。",
  },
  {
    id: "ifa-reflection-context-v1",
    label: "把问题放回现实 · 本站创作",
    text: "回到写下的问题，区分已知事实、暂时的猜想与仍缺少的信息。让这次停顿帮助整理关注点；图式本身并没有替你确认事情。",
  },
] as const;

export function renderIfaReflection(input: PublicInput): Paragraph[] {
  return reflectionTemplates.map((template, index) => ({
    label: template.label,
    text:
      index === 1 && input.mode === "action" && input.options?.length
        ? `${template.text} 对你写下的 ${input.options.length} 个选项，可分别记录一个已经确认的条件，不给选项打分。`
        : template.text,
    knowledgeId: "ifa-modern-reflection",
    ruleId: "ifa-neutral-no-direction-v1",
    templateId: template.id,
  }));
}
