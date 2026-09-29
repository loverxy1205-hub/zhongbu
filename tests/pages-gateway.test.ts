import { describe, expect, it, vi } from "vitest";
import { onRequest } from "../functions/api/[[path]]";

const origin = "https://zhongbu.pages.dev";
const makeRequest = (path = "/api/interpret", method = "POST") =>
  new Request(`${origin}${path}`, {
    method,
    headers: {
      Origin: origin,
      "CF-Connecting-IP": "192.0.2.70",
      "Content-Type": "application/json",
    },
    ...(method === "POST"
      ? { body: JSON.stringify({ question: "只在所选API发送的问题" }) }
      : {}),
  });

describe("Pages same-origin service gateway", () => {
  it.each(["interpret", "feedback"])(
    "forwards %s through the binding with trusted IP and Origin and never workers.dev",
    async (endpoint) => {
      const fetcher = vi.fn(async (request: Request) => {
        expect(request.url).toBe(`${origin}/${endpoint}`);
        expect(request.url).not.toContain("workers.dev");
        expect(request.headers.get("Origin")).toBe(origin);
        expect(request.headers.get("CF-Connecting-IP")).toBe("192.0.2.70");
        expect(request.headers.get("X-Forwarded-For")).toBeNull();
        expect(request.headers.get("Authorization")).toBeNull();
        expect(request.headers.get("Cookie")).toBeNull();
        expect(request.redirect).toBe("manual");
        expect(await request.json()).toEqual({
          question: "只在所选API发送的问题",
        });
        return Response.json(
          { id: "bound-worker-receipt" },
          { status: 201, headers: { "Cache-Control": "no-store" } },
        );
      });
      const request = makeRequest(`/api/${endpoint}`);
      request.headers.set("X-Forwarded-For", "203.0.113.200");
      request.headers.set("Authorization", "not-forwarded-private-value");
      request.headers.set("Cookie", "private-cookie");
      const response = await onRequest({
        request,
        env: { INTERPRETATION: { fetch: fetcher } },
      });
      expect(response.status).toBe(201);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    "/api",
    "/interpret",
    "/api/interpret/",
    "/api/feedback/admin",
    "/api/interpret?target=other",
    "/api/https://evil.example",
    "/api/%69nterpret",
  ])("rejects extra paths and queries: %s", async (path) => {
    const fetcher = vi.fn<typeof fetch>();
    const response = await onRequest({
      request: makeRequest(path),
      env: { INTERPRETATION: { fetch: fetcher } },
    });
    expect(response.status).toBe(404);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects methods and missing platform IP rather than trusting forwarding headers", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const env = { INTERPRETATION: { fetch: fetcher } };
    expect(
      (await onRequest({ request: makeRequest("/api/feedback", "GET"), env }))
        .status,
    ).toBe(405);
    const missing = makeRequest();
    missing.headers.delete("CF-Connecting-IP");
    missing.headers.set("X-Forwarded-For", "192.0.2.70");
    expect((await onRequest({ request: missing, env })).status).toBe(403);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("preserves preflight and backend errors including the ban expiry", async () => {
    const request = makeRequest("/api/feedback", "OPTIONS");
    request.headers.set("Access-Control-Request-Method", "POST");
    request.headers.set("Access-Control-Request-Headers", "Content-Type");
    const fetcher = vi.fn(async (forwarded: Request) => {
      expect(forwarded.method).toBe("OPTIONS");
      expect(forwarded.headers.get("Access-Control-Request-Method")).toBe(
        "POST",
      );
      expect(forwarded.headers.get("Access-Control-Request-Headers")).toBe(
        "Content-Type",
      );
      return new Response(null, { status: 204 });
    });
    expect(
      (
        await onRequest({
          request,
          env: { INTERPRETATION: { fetch: fetcher } },
        })
      ).status,
    ).toBe(204);
    const response = await onRequest({
      request: makeRequest(),
      env: {
        INTERPRETATION: {
          fetch: async () =>
            Response.json(
              {
                error: "blocked",
                code: "ABUSE_BLOCKED",
                blockedUntil: "2026-09-30T12:00:00.000Z",
              },
              { status: 429, headers: { "Retry-After": "86400" } },
            ),
        },
      },
    });
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("86400");
    expect(await response.json()).toMatchObject({
      code: "ABUSE_BLOCKED",
      blockedUntil: "2026-09-30T12:00:00.000Z",
    });
  });

  it("hides binding errors and rejects redirects without exposing private exception details", async () => {
    const response = await onRequest({
      request: makeRequest(),
      env: {
        INTERPRETATION: {
          fetch: async () => {
            throw new Error("private-token-do-not-echo");
          },
        },
      },
    });
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private-token");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const redirected = await onRequest({
      request: makeRequest(),
      env: {
        INTERPRETATION: {
          fetch: async () =>
            new Response(null, {
              status: 307,
              headers: { Location: "https://evil.example" },
            }),
        },
      },
    });
    expect(redirected.status).toBe(502);
    expect(redirected.headers.get("Location")).toBeNull();
    const githubRequest = makeRequest();
    githubRequest.headers.set("Origin", "https://loverxy1205-hub.github.io");
    const githubFailure = await onRequest({
      request: githubRequest,
      env: {
        INTERPRETATION: {
          fetch: async () => {
            throw new Error("private");
          },
        },
      },
    });
    expect(githubFailure.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://loverxy1205-hub.github.io",
    );
  });

  it("constructs and forwards the actual request through a native workerd service binding", async () => {
    const { build } = await import("esbuild");
    const { Miniflare, convertV4MiniflareOptions } = await import("miniflare");
    const bundle = await build({
      stdin: {
        contents: `
      import { onRequest } from "./functions/api/[[path]].ts";
      export default { fetch(request, env) { return onRequest({ request, env }); } };
    `,
        resolveDir: process.cwd(),
        sourcefile: "gateway-runtime-test.ts",
      },
      bundle: true,
      format: "esm",
      platform: "browser",
      target: "es2023",
      write: false,
    });
    const runtime = new Miniflare(
      convertV4MiniflareOptions({
        workers: [
          {
            name: "pages",
            modules: true,
            compatibilityDate: "2026-09-29",
            script: bundle.outputFiles[0].text,
            serviceBindings: { INTERPRETATION: "bound-api" },
          },
          {
            name: "bound-api",
            modules: true,
            compatibilityDate: "2026-09-29",
            script: `export default { async fetch(request) {
        return Response.json({ url: request.url, origin: request.headers.get("Origin"), ip: request.headers.get("CF-Connecting-IP"), redirect: request.redirect, body: await request.json() });
      } };`,
          },
        ],
      }),
    );
    try {
      const response = await runtime.dispatchFetch(`${origin}/api/feedback`, {
        method: "POST",
        headers: {
          Origin: origin,
          "CF-Connecting-IP": "192.0.2.70",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: "native binding works" }),
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        url: `${origin}/feedback`,
        origin,
        ip: "192.0.2.70",
        redirect: "manual",
        body: { message: "native binding works" },
      });
    } finally {
      await runtime.dispose();
    }
  }, 20_000);
});
