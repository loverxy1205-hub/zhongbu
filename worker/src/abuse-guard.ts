import { z } from "zod";

export const MINUTE_MS = 60_000;
export const BLOCK_MS = 24 * 60 * MINUTE_MS;
export const ATTEMPT_LIMIT = 60;
export const MODEL_MINUTE_LIMIT = 6;
export const FEEDBACK_MINUTE_LIMIT = 3;
export const FEEDBACK_DAY_LIMIT = 10;

export interface GuardState {
  attempts: number[];
  modelAttempts: number[];
  feedbackAttempts: number[];
  blockedUntil: number;
  expiresAt: number;
}

export const guardDecisionSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("allowed") }).strict(),
  z
    .object({
      status: z.literal("limited"),
      retryAfterSeconds: z.number().int().min(1).max(86400),
    })
    .strict(),
  z
    .object({
      status: z.literal("blocked"),
      blockedUntil: z.number().int().positive(),
      retryAfterSeconds: z.number().int().min(1).max(86400),
    })
    .strict(),
]);
export type GuardDecision = z.infer<typeof guardDecisionSchema>;

const remainingSeconds = (expires: number, now: number) =>
  Math.max(1, Math.min(86400, Math.ceil((expires - now) / 1000)));

/** Rolling (now - 60s, now] window. Called inside one durable transaction. */
export function recordAttempt(
  previous: GuardState | undefined,
  now: number,
  kind: "interpret" | "feedback",
): { state: GuardState; decision: GuardDecision } {
  if (previous && previous.blockedUntil > now) {
    return {
      state: previous,
      decision: {
        status: "blocked",
        blockedUntil: previous.blockedUntil,
        retryAfterSeconds: remainingSeconds(previous.blockedUntil, now),
      },
    };
  }
  const recent = previous && previous.expiresAt > now ? previous : undefined;
  const state: GuardState = {
    attempts: recent?.attempts.filter((at) => at > now - MINUTE_MS) ?? [],
    modelAttempts:
      recent?.modelAttempts.filter((at) => at > now - MINUTE_MS) ?? [],
    feedbackAttempts:
      recent?.feedbackAttempts.filter((at) => at > now - BLOCK_MS) ?? [],
    blockedUntil: 0,
    expiresAt: now + BLOCK_MS,
  };
  // All API attempts count, including invalid payloads and lower quota refusals.
  // Never append a 61st timestamp: storage size stays bounded even under attack.
  if (state.attempts.length >= ATTEMPT_LIMIT) {
    state.blockedUntil = now + BLOCK_MS;
    return {
      state,
      decision: {
        status: "blocked",
        blockedUntil: state.blockedUntil,
        retryAfterSeconds: 86400,
      },
    };
  }
  state.attempts.push(now);
  if (kind === "interpret") {
    if (state.modelAttempts.length >= MODEL_MINUTE_LIMIT) {
      return {
        state,
        decision: {
          status: "limited",
          retryAfterSeconds: remainingSeconds(
            state.modelAttempts[0] + MINUTE_MS,
            now,
          ),
        },
      };
    }
    state.modelAttempts.push(now);
  } else {
    const lastMinute = state.feedbackAttempts.filter(
      (at) => at > now - MINUTE_MS,
    );
    const nextAvailable = Math.max(
      state.feedbackAttempts.length >= FEEDBACK_DAY_LIMIT
        ? state.feedbackAttempts[0] + BLOCK_MS
        : 0,
      lastMinute.length >= FEEDBACK_MINUTE_LIMIT
        ? lastMinute[0] + MINUTE_MS
        : 0,
    );
    if (nextAvailable > now) {
      return {
        state,
        decision: {
          status: "limited",
          retryAfterSeconds: remainingSeconds(nextAvailable, now),
        },
      };
    }
    state.feedbackAttempts.push(now);
  }
  return { state, decision: { status: "allowed" } };
}

interface GuardTransaction {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
  setAlarm(at: number): Promise<void>;
}
interface GuardStorage {
  transaction<T>(
    operation: (transaction: GuardTransaction) => Promise<T>,
  ): Promise<T>;
}
export interface GuardContext {
  storage: GuardStorage;
}
export interface GuardNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): { fetch(request: Request): Promise<Response> };
}

/** One globally routed object per HMAC of Cloudflare's trusted connecting IP. */
export class AbuseGuard {
  private readonly context: GuardContext;
  constructor(context: GuardContext) {
    this.context = context;
  }

  async fetch(request: Request): Promise<Response> {
    const kind = new URL(request.url).pathname.slice(1);
    if (
      request.method !== "POST" ||
      (kind !== "interpret" && kind !== "feedback")
    ) {
      return new Response(null, { status: 404 });
    }
    const decision = await this.context.storage.transaction(
      async (transaction) => {
        const previous = await transaction.get<GuardState>("window");
        const result = recordAttempt(previous, Date.now(), kind);
        // Active bans neither extend nor write on every rejected request.
        if (result.state !== previous) {
          await transaction.put("window", result.state);
          await transaction.setAlarm(result.state.expiresAt);
        }
        return result.decision;
      },
    );
    return Response.json(decision);
  }

  async alarm(): Promise<void> {
    await this.context.storage.transaction(async (transaction) => {
      const state = await transaction.get<GuardState>("window");
      if (!state) return;
      if (state.expiresAt <= Date.now()) await transaction.delete("window");
      else await transaction.setAlarm(state.expiresAt);
    });
  }
}

export async function anonymousIpKey(
  ip: string,
  secret: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`zhongbu-api-ip-v1:${ip}`),
  );
  return Array.from(new Uint8Array(signature), (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
}
