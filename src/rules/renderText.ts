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
const categoryQuestions: Record<PublicInput["category"], string> = {
  日常: "放回真实的日程中看一看。",
  学业: "以实际学习要求和自己的理解为参照。",
  工作: "结合明确的职责与资源来核对。",
  人际: "不要用象征替代对方亲口表达的意愿。",
  自我探索: "允许自己的答案与这里的象征不同。",
  其他: "这里没有专属领域规则，保留通用反思。",
};
export function renderReflection(
  theme: Theme,
  input: PublicInput,
  knowledgeId: string,
): Paragraph {
  const prefix =
    input.mode === "action"
      ? `你填写的行动是「${input.action}」。这段话保持该行动的原意。`
      : "这是开放探索，不需要把答案压缩成做或不做。";
  return {
    label: `场景反思 · ${input.scene === "无预设" ? "通用" : input.scene}`,
    text: `${prefix}${themeQuestions[theme]}${sceneQuestions[input.scene]}${categoryQuestions[input.category]}`,
    knowledgeId,
    ruleId: `scene-${input.scene}-${input.mode}-v1`,
    templateId: `reflection-${theme}-${input.scene}-${input.category}-v1`,
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
