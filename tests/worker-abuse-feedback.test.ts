import { afterEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { aiErrorSchema } from "../shared/ai-contract";
import {
  feedbackRequestSchema,
  feedbackResponseSchema,
} from "../shared/feedback-contract";
import {
  BLOCK_MS,
  MINUTE_MS,
  anonymousIpKey,
  recordAttempt,
  type GuardState,
} from "../worker/src/abuse-guard";
import worker, { handleRequest, type Env } from "../worker/src/index";

const origin = "https://zhongbu.pages.dev";
const feedback = {
  kind: "问题",
  message: "手机上点击解析以后无法连接。",
  appVersion: "test",
};
const req = (
  body: unknown = feedback,
  path = "/feedback",
  ip = "192.0.2.100",
) =>
  new Request(`https://worker.example${path}`, {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      "CF-Connecting-IP": ip,
    },
    body: JSON.stringify(body),
  });

function environment(overrides: Partial<Env> = {}): Env {
  return {
    ENVIRONMENT: "production",
    DEEPSEEK_API_KEY: "public-fake-key",
    DEEPSEEK_MODEL: "deepseek-flash",
    ABUSE_HMAC_KEY: "unit-test-public-hmac-key-at-least-32bytes",
    ABUSE_GUARD: {
      idFromName: (key) => key,
      get: () => ({ fetch: async () => Response.json({ status: "allowed" }) }),
    },
    PER_IP_LIMITER: { limit: async () => ({ success: true }) },
    SHARED_LIMITER: { limit: async () => ({ success: true }) },
    FEEDBACK_DB: {
      prepare: () => ({
        bind: () => ({ run: async () => ({ success: true }) }),
      }),
    },
    ...overrides,
  };
}
afterEach(() => vi.useRealTimers());

describe("durable rolling abuse protection", () => {
  it("counts lower quota refusals, blocks attempt 61, never extends a ban and expires exactly after 24 hours", () => {
    let state: GuardState | undefined;
    const start = Date.UTC(2026, 8, 29, 12);
    for (let count = 1; count <= 60; count++) {
      const result = recordAttempt(state, start, "interpret");
      expect(result.decision.status).toBe(count <= 6 ? "allowed" : "limited");
      state = result.state;
    }
    const ban = recordAttempt(state, start, "interpret");
    expect(ban.decision).toEqual({
      status: "blocked",
      blockedUntil: start + BLOCK_MS,
      retryAfterSeconds: 86400,
    });
    expect(ban.state.attempts).toHaveLength(60);
    const repeated = recordAttempt(ban.state, start + MINUTE_MS, "feedback");
    expect(repeated.state).toBe(ban.state);
    expect(repeated.decision).toEqual({
      status: "blocked",
      blockedUntil: start + BLOCK_MS,
      retryAfterSeconds: 86340,
    });
    expect(
      recordAttempt(ban.state, start + BLOCK_MS - 1, "interpret").decision
        .status,
    ).toBe("blocked");
    expect(
      recordAttempt(ban.state, start + BLOCK_MS, "interpret").decision.status,
    ).toBe("allowed");
  });

  it("uses a sliding boundary rather than allowing double bursts at minute changes", () => {
    let state: GuardState | undefined;
    const start = 1_800_000_059_000;
    for (let i = 0; i < 60; i++)
      state = recordAttempt(state, start, "interpret").state;
    expect(
      recordAttempt(state, start + 2_000, "interpret").decision.status,
    ).toBe("blocked");
    expect(
      recordAttempt(state, start + MINUTE_MS, "interpret").decision.status,
    ).toBe("allowed");
  });

  it("shares the 60-attempt counter across model and feedback endpoints while enforcing feedback quotas", () => {
    let state: GuardState | undefined;
    const now = 1_800_000_000_000;
    for (let i = 0; i < 60; i++) {
      const result = recordAttempt(
        state,
        now,
        i % 2 ? "interpret" : "feedback",
      );
      expect(result.decision.status).not.toBe("blocked");
      state = result.state;
    }
    expect(state?.feedbackAttempts).toHaveLength(3);
    expect(recordAttempt(state, now, "feedback").decision.status).toBe(
      "blocked",
    );
    state = undefined;
    for (let i = 0; i < 10; i++)
      state = recordAttempt(state, now + i * MINUTE_MS, "feedback").state;
    expect(
      recordAttempt(state, now + 11 * MINUTE_MS, "feedback").decision.status,
    ).toBe("limited");
    expect(
      recordAttempt(state, now + BLOCK_MS, "feedback").decision.status,
    ).toBe("allowed");
  });

  it("uses keyed stable anonymous identities without exposing the IP or accepting forwarding headers", async () => {
    const key = await anonymousIpKey("192.0.2.100", "public-test-secret");
    expect(key).toMatch(/^[a-f0-9]{64}$/);
    expect(key).not.toContain("192.0.2.100");
    expect(await anonymousIpKey("192.0.2.100", "public-test-secret")).toBe(key);
    expect(await anonymousIpKey("192.0.2.100", "different-secret")).not.toBe(
      key,
    );
    const idFromName = vi.fn((name: string) => name);
    const env = environment({
      ABUSE_GUARD: {
        idFromName,
        get: () => ({
          fetch: async () => Response.json({ status: "allowed" }),
        }),
      },
    });
    const request = req();
    request.headers.set("X-Forwarded-For", "203.0.113.200");
    await handleRequest(request, env);
    expect(idFromName).toHaveBeenCalledWith(
      await anonymousIpKey("192.0.2.100", env.ABUSE_HMAC_KEY),
    );
  });

  it("fails closed when durable state, response validation or HMAC configuration fails", async () => {
    const fetcher = vi.fn<typeof fetch>();
    for (const overrides of [
      { ABUSE_HMAC_KEY: "" },
      { ABUSE_GUARD: undefined },
      {
        ABUSE_GUARD: {
          idFromName: (name: string) => name,
          get: () => ({
            fetch: async () =>
              Response.json({ status: "allowed", unsafe: true }),
          }),
        },
      },
      {
        ABUSE_GUARD: {
          idFromName: (name: string) => name,
          get: () => ({
            fetch: async () => {
              throw new Error("private-detail");
            },
          }),
        },
      },
    ]) {
      const response = await handleRequest(
        req({}, "/interpret"),
        environment(overrides),
        fetcher,
      );
      expect(response.status).toBe(503);
      expect(await response.text()).not.toContain("private-detail");
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("returns a parseable ban with an exact unlock time without reading the request body or calling the provider", async () => {
    const blockedUntil = Date.UTC(2026, 8, 30, 12);
    const fetcher = vi.fn<typeof fetch>();
    const env = environment({
      ABUSE_GUARD: {
        idFromName: (name) => name,
        get: () => ({
          fetch: async () =>
            Response.json({
              status: "blocked",
              blockedUntil,
              retryAfterSeconds: 86400,
            }),
        }),
      },
    });
    const request = req({ invalid: "private input" }, "/interpret");
    const response = await handleRequest(request, env, fetcher);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("86400");
    expect(aiErrorSchema.parse(await response.json())).toMatchObject({
      code: "ABUSE_BLOCKED",
      blockedUntil: new Date(blockedUntil).toISOString(),
    });
    expect(request.bodyUsed).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("explicit private feedback", () => {
  it("accepts only explicit fields and never needs a model key or provider request", async () => {
    const bind = vi.fn((..._values: (string | number | null)[]) => ({
      run: async () => ({ success: true }),
    }));
    const prepare = vi.fn((_query: string) => ({ bind }));
    const fetcher = vi.fn<typeof fetch>();
    const response = await handleRequest(
      req({ ...feedback, question: "我今天该先做什么？", engine: "runes" }),
      environment({ DEEPSEEK_API_KEY: "", FEEDBACK_DB: { prepare } }),
      fetcher,
    );
    expect(response.status).toBe(201);
    const receipt = feedbackResponseSchema.parse(await response.json());
    expect(bind).toHaveBeenCalledWith(
      receipt.id,
      receipt.receivedAt,
      "问题",
      feedback.message,
      "我今天该先做什么？",
      "runes",
      "test",
    );
    expect(prepare.mock.calls[0][0]).toContain("VALUES (?, ?, ?, ?, ?, ?, ?)");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("does not store a question unless supplied, rejects birth dates/readings and validates lengths", async () => {
    const bind = vi.fn((..._values: (string | number | null)[]) => ({
      run: async () => ({ success: true }),
    }));
    await handleRequest(
      req(),
      environment({ FEEDBACK_DB: { prepare: () => ({ bind }) } }),
    );
    expect(bind.mock.calls[0][4]).toBe(null);
    for (const body of [
      { ...feedback, birthday: "2000-01-01" },
      { ...feedback, reading: {} },
      { ...feedback, ip: "192.0.2.100" },
      { ...feedback, message: "    " },
      { ...feedback, message: "字".repeat(2001) },
      { ...feedback, question: "字".repeat(2001) },
    ]) {
      expect(feedbackRequestSchema.safeParse(body).success).toBe(false);
      expect((await handleRequest(req(body), environment())).status).toBe(400);
    }
  });

  it("returns no database details on a failed write and never exposes a public listing", async () => {
    const env = environment({
      FEEDBACK_DB: {
        prepare: () => {
          throw new Error("private db details");
        },
      },
    });
    const response = await handleRequest(req(), env);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private db details");
    expect(
      (
        await handleRequest(
          new Request("https://worker.example/feedback", {
            headers: { Origin: origin },
          }),
          environment(),
        )
      ).status,
    ).toBe(405);
  });

  it("expires feedback after 90 days through a parameterized scheduled cleanup", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-29T12:00:00Z"));
    const bind = vi.fn(() => ({ run: async () => ({ success: true }) }));
    const prepare = vi.fn(() => ({ bind }));
    await worker.scheduled({}, environment({ FEEDBACK_DB: { prepare } }));
    expect(prepare).toHaveBeenCalledWith(
      "DELETE FROM feedback WHERE received_at < ?",
    );
    expect(bind).toHaveBeenCalledWith("2026-07-01T12:00:00.000Z");
  });

  it("enforces real concurrent DO transactions and writes feedback into private D1 in native workerd", async () => {
    const { build } = await import("esbuild");
    const { Miniflare, convertV4MiniflareOptions } = await import("miniflare");
    const bundled = await build({
      stdin: {
        contents: `
          import { handleRequest } from "./worker/src/index.ts";
          export { AbuseGuard } from "./worker/src/abuse-guard.ts";
          export default { fetch(request, bindings) {
            return handleRequest(request, {
              ...bindings, ENVIRONMENT: "production", DEEPSEEK_API_KEY: "native-public-test-key",
              DEEPSEEK_MODEL: "deepseek-flash", ABUSE_HMAC_KEY: "native-public-test-hmac-key-32bytes",
              PER_IP_LIMITER: { async limit() { return { success: true }; } },
              SHARED_LIMITER: { async limit() { return { success: true }; } }
            }, async () => { throw new Error("Must not call provider"); });
          } };
        `,
        resolveDir: process.cwd(),
        sourcefile: "abuse-runtime-test.ts",
      },
      bundle: true,
      format: "esm",
      platform: "browser",
      target: "es2023",
      write: false,
    });
    const runtime = new Miniflare(
      convertV4MiniflareOptions({
        modules: true,
        compatibilityDate: "2026-09-29",
        script: bundled.outputFiles[0].text,
        durableObjects: {
          ABUSE_GUARD: { className: "AbuseGuard", useSQLite: true },
        },
        d1Databases: ["FEEDBACK_DB"],
      }),
    );
    try {
      const database = await runtime.getD1Database("FEEDBACK_DB");
      const migration = await readFile(
        "worker/migrations/0001_feedback.sql",
        "utf8",
      );
      for (const statement of migration
        .split(";")
        .map((part) => part.trim())
        .filter(Boolean))
        await database.prepare(statement).run();
      const headers = {
        Origin: origin,
        "Content-Type": "application/json",
        "CF-Connecting-IP": "192.0.2.111",
      };
      const invoke = (body: unknown = feedback, path = "/feedback") =>
        runtime.dispatchFetch(`https://worker.example${path}`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });
      const response = await invoke();
      expect(response.status).toBe(201);
      const receipt = feedbackResponseSchema.parse(await response.json());
      const saved = await database
        .prepare("SELECT * FROM feedback WHERE id = ?")
        .bind(receipt.id)
        .first();
      expect(saved).toMatchObject({
        message: feedback.message,
        question: null,
      });
      expect(saved).not.toHaveProperty("ip");
      // Including the feedback above, the 61st concurrent API request must ban.
      const responses = await Promise.all(
        Array.from({ length: 60 }, () =>
          invoke({ invalid: true }, "/interpret"),
        ),
      );
      const bodies = await Promise.all(responses.map((item) => item.json()));
      expect(responses.filter((item) => item.status === 400)).toHaveLength(6);
      expect(
        bodies.filter(
          (body) => (body as { code?: string }).code === "ABUSE_BLOCKED",
        ),
      ).toHaveLength(1);
      const banned = await invoke();
      expect(banned.status).toBe(429);
      expect(aiErrorSchema.parse(await banned.json()).code).toBe(
        "ABUSE_BLOCKED",
      );
      const other = await runtime.dispatchFetch(
        "https://worker.example/feedback",
        {
          method: "POST",
          headers: { ...headers, "CF-Connecting-IP": "192.0.2.112" },
          body: JSON.stringify(feedback),
        },
      );
      expect(other.status).toBe(201);
      expect(
        (
          await database
            .prepare("SELECT COUNT(*) AS total FROM feedback")
            .first<{ total: number }>()
        )?.total,
      ).toBe(2);
    } finally {
      await runtime.dispose();
    }
  }, 25_000);
});
