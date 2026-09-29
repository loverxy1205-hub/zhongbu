import { z } from "zod";
import {
  aiRequestSchema,
  aiResponseSchema,
  type AiRequest,
  type AiError,
  type AiResponse,
} from "../../shared/ai-contract";
import {
  feedbackRequestSchema,
  type FeedbackResponse,
} from "../../shared/feedback-contract";
import {
  anonymousIpKey,
  guardDecisionSchema,
  type GuardNamespace,
} from "./abuse-guard";
import { SYSTEM_PROMPT } from "./advice-prompt";
export { SYSTEM_PROMPT } from "./advice-prompt";
import { renderAdvice } from "./advice-output";
export { AbuseGuard } from "./abuse-guard";

interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

interface FeedbackDatabase {
  prepare(query: string): {
    bind(...values: (string | number | null)[]): {
      run(): Promise<{ success: boolean }>;
    };
  };
}

export interface Env {
  DEEPSEEK_API_KEY: string;
  DEEPSEEK_MODEL: string;
  ENVIRONMENT: "production" | "development";
  PER_IP_LIMITER: RateLimitBinding;
  SHARED_LIMITER: RateLimitBinding;
  ABUSE_HMAC_KEY: string;
  ABUSE_GUARD: GuardNamespace;
  FEEDBACK_DB: FeedbackDatabase;
}

export const UPSTREAM_URL = "https://api.deepseek.com/chat/completions";
export const MAX_REQUEST_BYTES = 64 * 1024;
export const UPSTREAM_TIMEOUT_MS = 25_000;
export const PROMPT_VERSION = "zhongbu-single-engine-2026.09.30-11";
const PRODUCTION_ORIGINS = new Set([
  "https://loverxy1205-hub.github.io",
  "https://zhongbu.pages.dev",
]);
const DEVELOPMENT_ORIGINS = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
]);

// Only the selected method's guidance is included in this independent call.
export const ENGINE_GUIDANCE: Record<AiRequest["engine"], string> = {
  tarot:
    "塔罗：区分现状、阻力、提示，结合每张的实际正逆位与给定释义；说明现状与提示如何配合，或提示如何处理阻力。不能把所有阻力位主题反过来当建议，逆位不一律坏、正位不一律好。逆位含义以本条给定白话为准，不用你记忆中的另一套牌义覆盖；例如白话要求重新评估投入，就不能反写成此刻不应评估。提示位的具体含义要真正影响行动方式，不能只给统一的谨慎试探。现状牌不是关于用户现实处境的调查结果，阻力牌也不证明用户动机有错。没有展示的牌不参与判断。",
  iching:
    "周易：把本卦处境、实际动爻所在阶段及其白话、变卦变化视角连起来，指出哪一处实际爻意改变了当前行动的时机或方式。多个动爻要综合权衡，不能只挑有利爻迎合预选立场；无动爻就依据本卦给定释义，不造动爻或变化。不能只凭卦名另套断法，不加入未提供的纳甲、世应或旺衰。变卦不是必然未来。",
  meihua:
    "梅花：以本次明确给出的体用关系为重点，联系本卦、实际动爻与变卦的给定释义，具体说明投入、受助或牵制如何影响所选行动。体生用和用生体不可混淆，生克方向以rawSummary与对应白话为准；不能只凭卦名另套断法。不可补造旺衰、互卦、外应或现实资源事实，不能把不同体用关系一律译为‘先做一点’。",
  runes:
    "卢恩：无逆位。把现状、阻力、提示三枚的具体释义放回各自位置，说明提示如何承接现状或处理阻力，再落到该行动特有的做法；不要只报符文名称后重复通用建议。阻力位是要识别的缺失、过度或牵制，不能直接照做，不能凭某一个关键词忽略其位置。",
  numerology:
    "数字命理先看methodVersion：生日数字九宫格只依据已经冻结的精选主题与白话，区分主视角、补充视角如何共同影响行动，不得补算、推测生日或编造个人日与数字出现次数；没有提供次数、缺位全集或生日，不能自行还原或评分。旧简化个人日以个人日为主要主题，生命数字、个人年和个人月只作背景。把该方法实际主题转成切合问题的安排，不把所有数字都解释成坚持或先做一点；不伪造牌位、正逆位或动爻。",
};

export function systemPromptFor(engine: AiRequest["engine"]): string {
  return `${SYSTEM_PROMPT}\n\n本次体系专用规则：\n${ENGINE_GUIDANCE[engine]}`;
}

const upstreamSchema = z.object({
  model: z
    .string()
    .regex(/^[a-zA-Z0-9._-]{1,100}$/)
    .optional(),
  choices: z
    .array(
      z.object({
        finish_reason: z.literal("stop"),
        message: z.object({ content: z.string().trim().min(1).max(12000) }),
      }),
    )
    .min(1),
});

class TooLargeError extends Error {}
class DeadlineError extends Error {}

function permittedOrigin(request: Request, env: Env): string | null {
  const origin = request.headers.get("Origin");
  if (origin && PRODUCTION_ORIGINS.has(origin)) return origin;
  if (
    env.ENVIRONMENT === "development" &&
    origin &&
    DEVELOPMENT_ORIGINS.has(origin)
  ) {
    return origin;
  }
  return null;
}

function headers(origin: string | null): Headers {
  const result = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    Vary: "Origin",
  });
  if (origin) result.set("Access-Control-Allow-Origin", origin);
  return result;
}

function json(
  body: AiResponse | AiError | FeedbackResponse,
  status: number,
  origin: string | null,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: headers(origin),
  });
}

async function readBounded(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
  signal: AbortSignal,
): Promise<string> {
  if (!body) return "";
  const reader = body.getReader();
  const cancel = () => {
    void reader.cancel().catch(() => {});
  };
  signal.addEventListener("abort", cancel, { once: true });
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let total = 0;
  let text = "";
  try {
    while (true) {
      if (signal.aborted) throw new DeadlineError();
      const chunk = await reader.read();
      if (chunk.done) return text + decoder.decode();
      total += chunk.value.byteLength;
      if (total > maxBytes) throw new TooLargeError();
      text += decoder.decode(chunk.value, { stream: true });
    }
  } catch (error) {
    cancel();
    throw error;
  } finally {
    signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
}

async function withDeadline<T>(
  milliseconds: number,
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new DeadlineError());
      controller.abort();
    }, milliseconds);
  });
  try {
    return await Promise.race([operation(controller.signal), deadline]);
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
}

// Interpretation contents are not stored. Feedback persistence is explicit and
// separate; abuse protection retains only HMAC identities and bounded timestamps.
// fetcher is injected only by tests; the Cloudflare export always uses global fetch.
export async function handleRequest(
  request: Request,
  env: Env,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  const origin = permittedOrigin(request, env);
  if (!origin) return json({ error: "请求来源不受支持。" }, 403, null);

  const url = new URL(request.url);
  if (!["/interpret", "/feedback"].includes(url.pathname) || url.search) {
    return json({ error: "接口不存在。" }, 404, origin);
  }

  if (request.method === "OPTIONS") {
    const requestedHeaders = (
      request.headers.get("Access-Control-Request-Headers") ?? ""
    )
      .toLowerCase()
      .split(",")
      .map((header) => header.trim())
      .filter(Boolean);
    if (
      request.headers.get("Access-Control-Request-Method") !== "POST" ||
      requestedHeaders.some((header) => header !== "content-type")
    ) {
      return json({ error: "预检请求不受支持。" }, 403, origin);
    }
    const responseHeaders = headers(origin);
    responseHeaders.set("Access-Control-Allow-Methods", "POST");
    responseHeaders.set("Access-Control-Allow-Headers", "Content-Type");
    return new Response(null, { status: 204, headers: responseHeaders });
  }

  if (request.method !== "POST") {
    const response = json({ error: "仅支持 POST 请求。" }, 405, origin);
    response.headers.set("Allow", "POST, OPTIONS");
    return response;
  }

  // Count API attempts before content validation and the lower cost quota.
  // Identity comes only from Cloudflare, never X-Forwarded-For/client storage.
  const ip = request.headers.get("CF-Connecting-IP");
  if (!ip && env.ENVIRONMENT !== "development") {
    return json({ error: "请求无法验证。" }, 403, origin);
  }
  let anonymousKey: string;
  if (
    !env.ABUSE_HMAC_KEY ||
    env.ABUSE_HMAC_KEY.length < 32 ||
    !env.ABUSE_GUARD?.get
  ) {
    return json(
      {
        error: "访问保护暂时不可用，请稍后再试。",
        code: "SERVICE_UNAVAILABLE",
      },
      503,
      origin,
    );
  }
  try {
    anonymousKey = await anonymousIpKey(
      ip ?? "local-development",
      env.ABUSE_HMAC_KEY,
    );
    const guard = env.ABUSE_GUARD.get(env.ABUSE_GUARD.idFromName(anonymousKey));
    const check = await guard.fetch(
      new Request(`https://guard.internal${url.pathname}`, { method: "POST" }),
    );
    if (!check.ok) throw new Error("Guard unavailable");
    const decision = guardDecisionSchema.parse(await check.json());
    if (decision.status !== "allowed") {
      const blocked = decision.status === "blocked";
      const response = json(
        {
          error: blocked
            ? "检测到一分钟内超过 60 次 API 请求，疑似恶意脚本刷取，已暂停此网络的在线服务 24 小时。"
            : url.pathname === "/feedback"
              ? "反馈提交较频繁，请在提示时间后再试。"
              : "每分钟最多发起 6 次模型解读，请稍后再试。",
          code: blocked ? "ABUSE_BLOCKED" : "RATE_LIMITED",
          retryAfterSeconds: decision.retryAfterSeconds,
          ...(blocked
            ? { blockedUntil: new Date(decision.blockedUntil).toISOString() }
            : {}),
        },
        429,
        origin,
      );
      response.headers.set("Retry-After", String(decision.retryAfterSeconds));
      return response;
    }
  } catch {
    return json(
      {
        error: "访问保护暂时不可用，请稍后再试。",
        code: "SERVICE_UNAVAILABLE",
      },
      503,
      origin,
    );
  }
  if (
    request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  ) {
    return json({ error: "请求须使用 JSON 格式。" }, 415, origin);
  }
  const isFeedback = url.pathname === "/feedback";
  const requestLimit = isFeedback ? 16 * 1024 : MAX_REQUEST_BYTES;
  const declaredLength = request.headers.get("Content-Length");
  if (declaredLength && Number(declaredLength) > requestLimit) {
    return json({ error: "请求内容过长。" }, 413, origin);
  }
  // Secret input tools can append a line break; normalize only its boundaries.
  const apiKey = env.DEEPSEEK_API_KEY?.trim();
  if (
    !isFeedback &&
    (!apiKey ||
      !/^[a-zA-Z0-9._-]{1,100}$/.test(env.DEEPSEEK_MODEL ?? "") ||
      !env.PER_IP_LIMITER?.limit ||
      !env.SHARED_LIMITER?.limit)
  ) {
    return json({ error: "模型解读暂未就绪，请稍后再试。" }, 503, origin);
  }

  if (!isFeedback)
    try {
      const perIp = await env.PER_IP_LIMITER.limit({
        key: `interpret:${anonymousKey}`,
      });
      const shared = perIp.success
        ? await env.SHARED_LIMITER.limit({ key: "interpret:shared" })
        : { success: false };
      if (!perIp.success || !shared.success) {
        const response = json(
          {
            error: "解读请求较多，请稍等一分钟再试。",
            code: "RATE_LIMITED",
            retryAfterSeconds: 60,
          },
          429,
          origin,
        );
        response.headers.set("Retry-After", "60");
        return response;
      }
    } catch {
      return json({ error: "模型解读暂时不可用，请稍后再试。" }, 503, origin);
    }

  let requestData: unknown;
  try {
    const body = await withDeadline(5_000, (signal) =>
      readBounded(request.body, requestLimit, signal),
    );
    requestData = JSON.parse(body);
  } catch (error) {
    if (error instanceof TooLargeError) {
      return json({ error: "请求内容过长。" }, 413, origin);
    }
    if (error instanceof DeadlineError) {
      return json({ error: "请求读取超时，请稍后再试。" }, 408, origin);
    }
    return json({ error: "请求内容无效。" }, 400, origin);
  }
  if (isFeedback) {
    const parsed = feedbackRequestSchema.safeParse(requestData);
    if (!parsed.success)
      return json(
        { error: "反馈字段无效，请填写 5–2000 字的内容。" },
        400,
        origin,
      );
    if (!env.FEEDBACK_DB?.prepare) {
      return json(
        {
          error: "反馈收集暂未就绪，请稍后再试。",
          code: "SERVICE_UNAVAILABLE",
        },
        503,
        origin,
      );
    }
    const id = crypto.randomUUID();
    const receivedAt = new Date().toISOString();
    try {
      const result = await env.FEEDBACK_DB.prepare(
        "INSERT INTO feedback (id, received_at, kind, message, question, engine, app_version) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
        .bind(
          id,
          receivedAt,
          parsed.data.kind,
          parsed.data.message,
          parsed.data.question ?? null,
          parsed.data.engine ?? null,
          parsed.data.appVersion ?? null,
        )
        .run();
      if (!result.success) throw new Error("Feedback unavailable");
      return json({ id, receivedAt }, 201, origin);
    } catch {
      return json(
        { error: "反馈未能保存，请稍后再试。", code: "SERVICE_UNAVAILABLE" },
        503,
        origin,
      );
    }
  }
  const parsed = aiRequestSchema.safeParse(requestData);
  if (!parsed.success) return json({ error: "请求字段无效。" }, 400, origin);

  // Safe diagnostic values only: no error messages, headers or provider bodies.
  let failureCode: AiError["code"] = "UPSTREAM_FETCH_FAILED";
  let upstreamStatus: number | undefined;
  try {
    // readingId correlates client UI state; the provider does not need it.
    const { engine, context, evidence } = parsed.data;
    const answer = await withDeadline(UPSTREAM_TIMEOUT_MS, async (signal) => {
      const upstream = await fetcher(UPSTREAM_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: env.DEEPSEEK_MODEL,
          messages: [
            { role: "system", content: systemPromptFor(engine) },
            {
              role: "user",
              content: JSON.stringify({
                engine,
                context,
                // Keep specific frozen evidence; shared summary vocabulary and
                // old reflection templates must not become generic advice cues.
                evidence: {
                  methodVersion: evidence.methodVersion,
                  rawSummary: evidence.rawSummary,
                  paragraphs: evidence.paragraphs,
                  traditional: evidence.traditional,
                },
              }),
            },
          ],
          thinking: { type: "disabled" },
          response_format: { type: "json_object" },
          max_tokens: 800,
          stream: false,
        }),
        signal,
        // workerd accepts manual/follow; explicitly reject the returned 3xx
        // below so the Authorization header can never follow a redirect.
        redirect: "manual",
      });
      upstreamStatus = upstream.status;
      if (!upstream.ok) {
        failureCode = "UPSTREAM_HTTP_ERROR";
        void upstream.body?.cancel().catch(() => {});
        throw new Error("Upstream unavailable");
      }
      failureCode = "UPSTREAM_BODY_ERROR";
      const body = await readBounded(upstream.body, 128 * 1024, signal);
      failureCode = "UPSTREAM_JSON_INVALID";
      const decoded: unknown = JSON.parse(body);
      failureCode = "UPSTREAM_RESPONSE_INVALID";
      const result = upstreamSchema.parse(decoded);
      const content = result.choices[0].message.content;
      const model = result.model ?? env.DEEPSEEK_MODEL;
      // Never surface the configured credential, even in an anomalous response.
      if (content.includes(apiKey) || model.includes(apiKey)) {
        failureCode = "UPSTREAM_OUTPUT_REJECTED";
        throw new Error("Invalid output");
      }
      failureCode = "UPSTREAM_OUTPUT_REJECTED";
      const text = renderAdvice(content, parsed.data);
      if (text.includes(apiKey)) throw new Error("Invalid output");
      return aiResponseSchema.parse({
        text,
        model,
        generatedAt: new Date().toISOString(),
        promptVersion: PROMPT_VERSION,
      });
    });
    return json(answer, 200, origin);
  } catch (error) {
    const statusDetail = upstreamStatus ? { upstreamStatus } : {};
    if (error instanceof DeadlineError) {
      return json(
        {
          error: "模型解读超时，请稍后再试。",
          code: "UPSTREAM_TIMEOUT",
          ...statusDetail,
        },
        504,
        origin,
      );
    }
    return json(
      {
        error: "模型解读暂时不可用，请稍后再试。",
        code: failureCode,
        ...statusDetail,
      },
      502,
      origin,
    );
  }
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env);
  },
  async scheduled(_controller: unknown, env: Env): Promise<void> {
    // Explicit feedback only: the website never uploads every user's question.
    const cutoff = new Date(
      Date.now() - 90 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const result = await env.FEEDBACK_DB.prepare(
      "DELETE FROM feedback WHERE received_at < ?",
    )
      .bind(cutoff)
      .run();
    if (!result.success) throw new Error("Feedback retention cleanup failed");
  },
};
