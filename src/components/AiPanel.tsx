import { useEffect, useState } from "react";
import type { AiEnhancement, EngineId } from "../types";
import { ENGINES } from "../data/meta";
import { AI_ENDPOINT } from "../lib/ai";
import { EngineMeditation } from "./RitualTransition";

export interface AiStatus {
  busy: boolean;
  error?: string;
}
function AdviceWaiting({ engine }: { engine: EngineId }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(
      () => setSeconds((value) => value + 1),
      1000,
    );
    return () => window.clearInterval(timer);
  }, []);
  return (
    <div className="ai-waiting">
      <EngineMeditation engine={engine} />
      <div>
        <p role="status">
          {seconds >= 18
            ? "这次等待稍久，建议完成后会自动显示…"
            : "正在结合你的问题与选项，整理这组结果的建议…"}
        </p>
        <small aria-hidden="true">已等待 {seconds} 秒</small>
      </div>
    </div>
  );
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
  onGenerate: () => void;
}) {
  return (
    <section
      className={`ai-panel ai-panel-${engine}`}
      aria-label={`${ENGINES[engine].name}问题建议`}
      aria-busy={!!status?.busy}
      data-testid={`ai-${engine}`}
    >
      <div className="ai-heading">
        <span aria-hidden="true">✦</span>
        <h3>把答案，放回你的问题</h3>
        <span className="ai-label">DeepSeek · AI</span>
      </div>
      {enhancement ? (
        <>
          <p className="ai-caption">
            {enhancement.contextIncluded
              ? "结合本次问题与选择"
              : "这份旧记录只解读了象征"}
          </p>
          <div className="ai-prose">{enhancement.response.text}</div>
        </>
      ) : (
        <>
          {status?.busy ? (
            <AdviceWaiting engine={engine} />
          ) : (
            <p>简单解析这组结果，给你一个具体建议。</p>
          )}
          <button
            className="ai-generate"
            disabled={!AI_ENDPOINT || status?.busy}
            onClick={onGenerate}
          >
            {status?.busy ? "正在整理建议…" : "✧ 获取针对问题的建议"}
          </button>
          {!AI_ENDPOINT && (
            <p className="ai-caption">建议服务尚未开通，本地结果仍可查看。</p>
          )}
          {status?.error && (
            <p role="status" className="ai-error">
              {status.error}
            </p>
          )}
        </>
      )}
    </section>
  );
}
