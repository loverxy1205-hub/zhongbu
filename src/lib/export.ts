import type { EngineResult, Reading, SavedReading } from "../types";
import { ENGINES, DISCLAIMER } from "../data/meta";
import { isExperienceId } from "../experiences";
export function resultMarkdown(r: EngineResult) {
  if (r.status === "pending")
    return `## ${ENGINES[r.engine].name}\n等待完成本体系的互动，尚未形成解读。`;
  if (!r.interpretation)
    return `## ${ENGINES[r.engine].name}\n不可用：${r.error}`;
  const i = r.interpretation;
  const originals = i.traditional
    .map(
      (p) =>
        `### ${isExperienceId(r.engine) ? "传统资料" : "传统原文"} · ${p.label}\n${p.text}\n${p.knowledgeId} / ${p.ruleId} / ${p.templateId}`,
    )
    .join("\n\n");
  return [
    `## ${ENGINES[r.engine].name} · ${r.methodVersion}`,
    i.headline,
    `主题：${i.themes.join("、")}`,
    originals,
    ...[...i.paragraphs, ...i.reflection].map(
      (p) =>
        `### ${p.label}\n${p.text}\n\n依据：${p.knowledgeId} / ${p.ruleId} / ${p.templateId}`,
    ),
    `倾向：${i.inclination}\n${i.inclinationReason}`,
    `### 原始计算\n\u0060\u0060\u0060json\n${JSON.stringify(r.raw, null, 2)}\n\u0060\u0060\u0060`,
    `### 来源与限制\n${[...i.sources, ...i.limits].join("\n\n")}`,
    ...(r.observationInterpretations?.map(
      (entry) =>
        `### 观察版本 ${entry.id} · 冻结解释\n${entry.interpretation.headline}\n${[...entry.interpretation.paragraphs, ...entry.interpretation.reflection].map((p) => `${p.label}：${p.text}`).join("\n\n")}\n版本：${JSON.stringify(entry.versions)}`,
    ) || []),
  ].join("\n\n");
}
export function readingMarkdown(
  reading: Reading,
  enhancements?: SavedReading["enhancements"],
) {
  return [
    `# 众卜 · 一个问题，多种视角。`,
    DISCLAIMER,
    `记录：${reading.readingId}\n问卜时刻：${reading.askedAt}\n时区：${reading.input.timezone}\n目标日期：${reading.input.targetDate}`,
    `问题：${reading.input.question}\n场景：${reading.input.scene}\n模式：${reading.input.mode === "action" ? "行动取舍" : "开放探索"}\n${reading.input.options?.length ? reading.input.options.map((option, index) => `选项 ${index + 1}：${option}`).join("\n") : `行动：${reading.input.action}`}`,
    `生日默认不记录；若你在问题或选项中自行填写个人信息，导出仍会包含这些自由文本，请在分享前检查。`,
    ...reading.results.map(resultMarkdown),
    ...reading.results.flatMap((r) => {
      const extra = enhancements?.[r.engine];
      return extra
        ? [
            `## ${ENGINES[r.engine].name} · AI 灵感解读\n\n${extra.response.text}\n\n模型：${extra.response.model}；提示版本：${extra.response.promptVersion}；生成时间：${extra.response.generatedAt}。${extra.contextIncluded ? "包含自愿发送的问题与行动。" : "未发送问题与行动。"}模型生成，不属于传统原文或本地规则结论。`,
          ]
        : [];
    }),
    `版本：${JSON.stringify(reading.versions)}`,
  ].join("\n\n");
}
export function exportJSON(saved: SavedReading) {
  return JSON.stringify(saved, null, 2);
}
export function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
