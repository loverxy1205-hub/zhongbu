interface Context {
  request: Request;
  env: { INTERPRETATION: { fetch(request: Request): Promise<Response> } };
}

function failure(request: Request, error: string, status: number): Response {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    Vary: "Origin",
  });
  const origin = request.headers.get("Origin");
  if (
    origin === "https://zhongbu.pages.dev" ||
    origin === "https://loverxy1205-hub.github.io"
  ) {
    headers.set("Access-Control-Allow-Origin", origin);
  }
  if (status === 405) headers.set("Allow", "POST, OPTIONS");
  return Response.json(
    { error },
    {
      status,
      headers,
    },
  );
}

/** Same-origin gateway. Secrets and accounting remain in the bound Worker. */
export async function onRequest({ request, env }: Context): Promise<Response> {
  const url = new URL(request.url);
  const endpoint =
    url.pathname === "/api/interpret"
      ? "/interpret"
      : url.pathname === "/api/feedback"
        ? "/feedback"
        : null;
  if (!endpoint || url.search) {
    return failure(request, "接口不存在。", 404);
  }
  if (request.method !== "POST" && request.method !== "OPTIONS") {
    return failure(request, "仅支持 POST 请求。", 405);
  }
  // Pages supplies CF-Connecting-IP; never derive identity from user-controlled
  // X-Forwarded-For, query strings, cookies or localStorage IDs.
  if (!request.headers.get("CF-Connecting-IP")) {
    return failure(request, "请求来源无法验证。", 403);
  }
  const upstream = new URL(request.url);
  upstream.pathname = endpoint;
  // Only the request's explicit API headers cross the internal service binding.
  // Do not forward browser cookies, authorization or spoofed forwarding headers.
  const forwardedHeaders = new Headers();
  for (const name of [
    "Content-Type",
    "Content-Length",
    "Origin",
    "CF-Connecting-IP",
    "Access-Control-Request-Method",
    "Access-Control-Request-Headers",
  ]) {
    const value = request.headers.get(name);
    if (value !== null) forwardedHeaders.set(name, value);
  }
  try {
    const forwarded = new Request(new Request(upstream, request), {
      headers: forwardedHeaders,
      redirect: "manual",
    });
    const response = await env.INTERPRETATION.fetch(forwarded);
    // Never follow a misconfigured service redirect with a user's POST body.
    if (response.status >= 300 && response.status < 400) {
      void response.body?.cancel().catch(() => {});
      return failure(request, "在线服务暂时不可用，请稍后再试。", 502);
    }
    return response;
  } catch {
    return failure(request, "在线服务暂时不可用，请稍后再试。", 503);
  }
}
