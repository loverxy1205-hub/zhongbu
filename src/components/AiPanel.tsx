import { useState } from "react";
import type { AiEnhancement, EngineId } from "../types";
import { ENGINES } from "../data/meta";
import { AI_ENDPOINT } from "../lib/ai";

export interface AiStatus {
  busy: boolean;
  error?: string;
}
export function AiPanel({
  engine,
  enhancement,
  status,
  onGenerate,
}: {
  engine: EngineId;
  enhancement?: AiEnhancement;
  status?: AiStatus;
  onGenerate: (includeContext: boolean) => void;
}) {
  const [includeContext, setIncludeContext] = useState(false);
  return (
    <section
      className={`ai-panel ai-panel-${engine}`}
      aria-label={`${ENGINES[engine].name}灵感解读`}
      data-testid={`ai-${engine}`}
    >
      <div className="ai-heading">
        <span aria-hidden="true">✦</span>
        <h3>让象征，再多说一点</h3>
        <span className="ai-label">DeepSeek · AI</span>
      </div>
      {enhancement ? (
        <>
          <p className="ai-caption">
            本次灵感解读 ·{" "}
            {enhancement.contextIncluded
              ? "结合了你的问题与行动"
              : "只围绕象征与所选场景"}
          </p>
          <div className="ai-prose">{enhancement.response.text}</div>
          <p className="ai-caption">
            模型生成，可能有误；不属于传统原文或本地规则结论。用于文化体验与自我反思。
          </p>
          <details className="ai-provenance">
            <summary>这段文字的来处</summary>
            <p>
              {enhancement.response.model} ·{" "}
              {enhancement.response.promptVersion}
              <br />
              {new Date(enhancement.response.generatedAt).toLocaleString(
                "zh-CN",
              )}
            </p>
            <p>
              只使用本条冻结结果，未读取其他体系或你的偏好。生成内容随记录保存与导出，刷新不会重新调用。
            </p>
            <p>发送的原始结果：{enhancement.request.evidence.rawSummary}</p>
          </details>
        </>
      ) : (
        <>
          <p>
            用一点想象，把这组象征编成更贴近生活的反思。你仍然可以保留自己的理解。
          </p>
          <label className="check-row">
            <input
              type="checkbox"
              checked={includeContext}
              disabled={status?.busy}
              onChange={(event) => setIncludeContext(event.target.checked)}
            />
            同时发送我的问题与行动
          </label>
          <details className="ai-provenance">
            <summary>点击后会发送什么？</summary>
            <p>
              通过本站代理发送给
              DeepSeek：本条抽取结果、本地释义、类别、模式、场景及目标日期。勾选上方选项才会附上问题与行动原文；如果其中包含个人信息，也会一并发送。
            </p>
            <p>
              不发送生日字段、问卜精确时刻、其他体系结果、收藏或偏好。不自动发送；这项联网功能与本地结果分开。
            </p>
          </details>
          <button
            className="ai-generate"
            disabled={!AI_ENDPOINT || status?.busy}
            onClick={() => onGenerate(includeContext)}
          >
            {status?.busy ? "正在听这组象征说话…" : "✧ 生成灵感解读"}
          </button>
          {!AI_ENDPOINT && (
            <p className="ai-caption">
              灵感解读尚未开通。五套本地体系均可照常使用。
            </p>
          )}
          <p
            role={status?.busy || status?.error ? "status" : undefined}
            className={status?.error ? "ai-error" : "ai-caption"}
          >
            {status?.error ||
              (status?.busy
                ? "通常需要十几秒，无需重复点击。"
                : "点击才联网 · 每条生成一次 · 不改变抽取结果")}
          </p>
        </>
      )}
    </section>
  );
}
