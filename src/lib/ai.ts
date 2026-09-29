import { aiRequestSchema, aiResponseSchema } from "../../shared/ai-contract";
import type { AiRequest, AiResponse } from "../../shared/ai-contract";
import type { EngineId, Reading, Raw } from "../types";
import { TAROT } from "../data/tarot";
import { RUNES } from "../data/runes";
import { HEXAGRAMS } from "../data/hexagrams";
import { serviceError } from "./service";
import { isCoreEngine } from "../experiences";

export const AI_ENDPOINT =
  import.meta.env.VITE_INTERPRETATION_API_URL?.trim() || "";
export const AI_REQUEST_TIMEOUT_MS = 40_000;
function rawSummary(raw: Raw): string {
  const hex = (code: string) =>
    HEXAGRAMS.find((h) => h.code === code)?.name || code;
  switch (raw.kind) {
    case "tarot":
      return raw.cards
        .map(
          (c) =>
            `${c.position}：${TAROT.find((t) => t.id === c.id)?.name}（${c.reversed ? "逆位" : "正位"}）`,
        )
        .join("；");
    case "runes":
      return raw.runes
        .map((c) => `${c.position}：${RUNES.find((r) => r.id === c.id)?.name}`)
        .join("；");
    case "iching":
      return `自下而上爻值 ${raw.values.join("、")}；本卦${hex(raw.code)}；动爻${raw.moving.join("、") || "无"}；变卦${hex(raw.changedCode)}`;
    case "meihua":
      return `本卦${hex(raw.code)}；第${raw.moving}爻动；变卦${hex(raw.changedCode)}；体${raw.body}、用${raw.use}；${raw.relationship}`;
    case "numerology":
      return `生命数字${raw.life}；个人年${raw.year}；个人月${raw.month}；个人日${raw.day}。只保留派生数字。`;
    case "numerology-matrix":
      return "生日数字九宫格（现代象征约定）。仅提供已经冻结的精选主题与释义，不发送生日、原始数字串、各格次数或缺位全集。";
    default:
      throw Error("本体验使用本地资料与个人观察，不发送给模型补写判词。");
  }
}
export function buildAiRequest(
  reading: Reading,
  engine: EngineId,
  includeContext: boolean = true,
): AiRequest {
  if (!isCoreEngine(engine))
    throw Error("本体验使用本地资料与个人观察，不发送给模型补写判词。");
  const result = reading.results.find((r) => r.engine === engine);
  if (!result?.raw || !result.interpretation || result.status !== "ok")
    throw Error("这套体系尚无可延伸的结果。");
  const { input } = reading;
  const i = result.interpretation;
  const paragraphs = (entries: typeof i.paragraphs) =>
    entries.map(({ label, text }) => ({ label, text }));
  return aiRequestSchema.parse({
    readingId: reading.readingId,
    engine,
    context: {
      mode: input.mode,
      scene: input.scene,
      targetDate: input.targetDate,
      ...(includeContext
        ? {
            question: input.question,
            action: input.action,
            ...(input.mode === "action" && input.options
              ? { options: [...input.options] }
              : {}),
          }
        : {}),
    },
    evidence: {
      methodVersion: result.methodVersion,
      headline: i.headline,
      themes: i.themes,
      rawSummary: rawSummary(result.raw),
      paragraphs: paragraphs(i.paragraphs),
      // The removed reflection UI is not an instruction for the concise advice.
      // Keep the field for compatibility with earlier Worker request versions.
      reflection: [],
      traditional: paragraphs(i.traditional),
    },
  });
}
export async function requestAi(
  request: AiRequest,
  signal: AbortSignal,
  endpoint = AI_ENDPOINT,
): Promise<AiResponse> {
  if (!endpoint) throw Error("灵感解读暂未开通，本地结果已完整生成。");
  if (!navigator.onLine)
    throw Error("当前离线。灵感解读需要联网，本地结果仍可使用。");
  if (signal.aborted) throw Error("已取消灵感解读。");
  // Basic AbortController also works in mobile browsers without the newer
  // AbortSignal.any/timeout statics. The deadline includes reading the body.
  const controller = new AbortController();
  let timedOut = false;
  const abortError = () =>
    Error(
      timedOut
        ? "连接等待超时，请检查网络后重试。本地结果未改变。"
        : "已取消灵感解读。",
    );
  let rejectAbort: (reason: Error) => void = () => {};
  const aborted = new Promise<never>((_resolve, reject) => {
    rejectAbort = reject;
  });
  const cancel = () => {
    controller.abort();
    rejectAbort(abortError());
  };
  signal.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    cancel();
  }, AI_REQUEST_TIMEOUT_MS);
  const execute = async (): Promise<AiResponse> => {
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "omit",
        cache: "no-store",
        redirect: "error",
        body: JSON.stringify(request),
        signal: controller.signal,
      });
    } catch {
      if (controller.signal.aborted) throw abortError();
      throw Error("暂时没有连接上解读服务，请检查网络后重试。本地结果未改变。");
    }
    if (!response.ok) {
      if (response.status === 429)
        throw Error(
          await serviceError(response, "先让灵感歇一会儿，请一分钟后再试。"),
        );
      if (response.status === 503)
        throw Error("灵感解读暂未就绪，本地结果仍可使用。");
      if (response.status === 504)
        throw Error("解读服务响应超时，请稍后重试。本地结果未改变。");
      throw Error("这次灵感解读没有完成，请稍后重试。本地结果未改变。");
    }
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      if (controller.signal.aborted) throw abortError();
      throw Error("解读服务返回了无法识别的内容，请稍后重试。");
    }
    const parsed = aiResponseSchema.safeParse(payload);
    if (!parsed.success)
      throw Error("解读服务返回了无法识别的内容，请稍后重试。");
    return parsed.data;
  };
  try {
    return await Promise.race([execute(), aborted]);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", cancel);
    controller.abort();
  }
}
