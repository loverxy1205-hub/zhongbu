import { useRef, useState } from "react";
import type { EngineId } from "../types";
import { VERSIONS } from "../data/meta";
import { AI_ENDPOINT } from "../lib/ai";
import { serviceError } from "../lib/service";
import {
  feedbackRequestSchema,
  feedbackResponseSchema,
} from "../../shared/feedback-contract";

export function FeedbackForm({
  question,
  engine,
}: {
  question: string;
  engine?: EngineId;
}) {
  const [kind, setKind] = useState<"问题" | "建议" | "其他">("建议");
  const [message, setMessage] = useState("");
  const [includeQuestion, setIncludeQuestion] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const lock = useRef(false);
  return (
    <details className="feedback-panel" data-testid="feedback-panel">
      <summary>
        <span aria-hidden="true">✉</span> 有什么想告诉众卜？
        <small>问题与意见反馈</small>
      </summary>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (lock.current) return;
          const parsed = feedbackRequestSchema.safeParse({
            kind,
            message,
            appVersion: VERSIONS.app,
            ...(engine ? { engine } : {}),
            ...(includeQuestion && question ? { question } : {}),
          });
          if (!parsed.success) {
            setNotice("请填写5–2000字的意见。");
            return;
          }
          if (!AI_ENDPOINT || !navigator.onLine) {
            setNotice("反馈需要联网；文字仍保留在此表单中。");
            return;
          }
          lock.current = true;
          setBusy(true);
          setNotice("");
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 20000);
          try {
            const endpoint = new URL(AI_ENDPOINT, location.href);
            endpoint.pathname = endpoint.pathname.replace(
              /\/interpret$/,
              "/feedback",
            );
            const response = await fetch(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "omit",
              cache: "no-store",
              body: JSON.stringify(parsed.data),
              signal: controller.signal,
            });
            if (!response.ok) throw Error(await serviceError(response));
            const receipt = feedbackResponseSchema.parse(await response.json());
            setNotice(`反馈已送达，谢谢你。回执 ${receipt.id.slice(0, 8)}`);
            setMessage("");
            setIncludeQuestion(false);
          } catch (error) {
            setNotice(
              error instanceof Error && error.name !== "AbortError"
                ? error.message
                : "暂时无法连接反馈服务，文字仍保留，请稍后重试。",
            );
          } finally {
            clearTimeout(timer);
            lock.current = false;
            setBusy(false);
          }
        }}
      >
        <label className="field">
          反馈类型
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value as typeof kind)}
          >
            <option>建议</option>
            <option>问题</option>
            <option>其他</option>
          </select>
        </label>
        <label className="field">
          你的意见
          <textarea
            minLength={5}
            maxLength={2000}
            required
            rows={4}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="哪里不顺手，或你希望增加什么？"
          />
        </label>
        {!!question && (
          <label className="feedback-consent">
            <input
              type="checkbox"
              checked={includeQuestion}
              onChange={(event) => setIncludeQuestion(event.target.checked)}
            />
            附上本次问题，方便理解反馈
          </label>
        )}
        {includeQuestion && <blockquote>{question}</blockquote>}
        <p className="feedback-privacy">
          仅发送你提交的意见，以及勾选附上的问题。请勿填写生日、密码等私人信息；反馈由站主私下查看，保存90天。
        </p>
        <button className="primary" disabled={busy}>
          {busy ? "正在提交…" : "提交反馈"}
        </button>
        {notice && <p role="status">{notice}</p>}
      </form>
    </details>
  );
}
