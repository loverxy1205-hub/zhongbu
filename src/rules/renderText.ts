import type {
  Knowledge,
  Paragraph,
  Position,
  PublicInput,
  Theme,
} from "../types";
export function renderPosition(
  entry: Knowledge,
  position: Position,
  meaning = entry.meaning,
  orientation = "",
): Paragraph {
  const templates: Record<Position, string> = {
    现状: `「${entry.name}」${orientation}落在现状位，可以用来观察当前的处境：${meaning}`,
    阻力: `「${entry.name}」${orientation}落在阻力位，邀请你检查这个象征的缺失、过度或牵制：${meaning} 这里描述的是需要辨认的阻力，并不是让你照做的行动建议。`,
    提示: `「${entry.name}」${orientation}落在提示位，提供一个可尝试思考的角度：${meaning}`,
  };
  return {
    label: `${position} · ${entry.name}${orientation}`,
    text: templates[position],
    knowledgeId: entry.id,
    ruleId: `position-${position}-v1`,
    templateId: `position-text-${position}-v1`,
  };
}
const themeQuestions: Record<Theme, string> = {
  推进: "哪一个最小步骤能够帮助你检验想法？",
  准备: "目前已有的条件和仍然缺少的条件分别是什么？",
  审慎: "哪些判断来自事实，哪些还只是设想？",
  休整: "你的精力需要怎样的恢复空间？",
  沟通: "哪些期待需要由双方明确说出来？",
  边界: "你愿意承担什么，又希望保留什么界限？",
  变化: "哪些部分值得延续，哪些可以调整？",
  等待: "等待期间你想观察什么信号，何时重新评估？",
};
const sceneQuestions: Record<PublicInput["scene"], string> = {
  无预设: "这个象征与你的实际经历有哪些相似或不同？",
  上课安排:
    "把学习目标、安排要求、出行条件和休息需要列在一起，会看见什么取舍？",
  任务推进: "这项任务的下一处依赖、可用时间与验收标准是什么？",
  休息安排: "当前安排是否容得下恢复？什么样的休息对你有意义？",
  沟通联系: "对方的意愿、你的边界以及表达的时机，哪些已确认，哪些还需要询问？",
  一般选择: "两种安排各需要付出什么，又有哪些可以撤回或调整的部分？",
};
export function renderReflection(
  theme: Theme,
  input: PublicInput,
  knowledgeId: string,
): Paragraph {
  const prefix =
    input.mode === "action"
      ? input.options?.length
        ? `你正在比较${input.options.map((option, index) => `选项 ${index + 1}「${option}」`).join("、")}。把这个提醒分别放进每一种选择，看看条件与代价有什么不同。`
        : `你填写的行动是「${input.action}」。这段话保持该行动的原意。`
      : "这是开放探索，不需要把答案压缩成做或不做。";
  return {
    label: `场景反思 · ${input.scene === "无预设" ? "通用" : input.scene}`,
    text: `${prefix}${themeQuestions[theme]}${sceneQuestions[input.scene]}`,
    knowledgeId,
    ruleId: `scene-${input.scene}-${input.mode}-v1`,
    templateId: `reflection-${theme}-${input.scene}-${input.options?.length ? "options" : input.mode}-v2`,
  };
}
export function renderEvidence(
  label: string,
  text: string,
  knowledgeId: string,
  ruleId: string,
  templateId = "evidence-v1",
): Paragraph {
  return { label, text, knowledgeId, ruleId, templateId };
}
