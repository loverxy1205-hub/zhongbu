import { aiErrorSchema } from "../../shared/ai-contract";

export async function serviceError(
  response: Response,
  fallback = response.status === 429
    ? "请求较多，请稍后再试。"
    : "服务暂时不可用，请稍后重试。",
): Promise<string> {
  try {
    const parsed = aiErrorSchema.safeParse(await response.json());
    if (!parsed.success) return fallback;
    if (parsed.data.code === "ABUSE_BLOCKED" && parsed.data.blockedUntil) {
      return `检测到异常频繁请求，疑似脚本刷取，已限制在线服务24小时。可再次使用时间：${new Date(parsed.data.blockedUntil).toLocaleString("zh-CN")}。本地占卜仍可使用。`;
    }
    return parsed.data.error;
  } catch {
    return fallback;
  }
}
