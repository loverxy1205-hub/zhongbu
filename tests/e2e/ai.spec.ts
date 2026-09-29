import { test, expect, devices } from "@playwright/test";
import type { Page, Route } from "@playwright/test";
import type { AiRequest, AiResponse } from "../../shared/ai-contract";
import type { SavedReading } from "../../src/types";
import { revealTarot } from "./helpers";

const endpoint = "http://127.0.0.1:5174/test-ai/interpret";
const question = "我想先不联系对方，怎样理解自己的边界？";
const options = ["不联系", "先整理想说的话", "等到周末再决定"];
const answer: AiResponse = {
  text: "把这组象征当作一面小镜子，留意自己希望保留的空间。它只是一个反思角度，你可以保留不同的理解。",
  model: "deepseek-chat",
  promptVersion: "zhongbu-ai-v1",
  generatedAt: "2026-09-29T04:38:00.000Z",
};
const current = (page: Page) =>
  page.evaluate(
    () =>
      JSON.parse(sessionStorage.getItem("zhongbu-active-v1")!) as SavedReading,
  );
const complete = (route: Route) =>
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(answer),
  });
async function start(
  page: Page,
  reducedMotion: "reduce" | "no-preference" = "reduce",
) {
  await page.emulateMedia({ reducedMotion });
  await page.goto("/");
  await page.getByLabel("你的问题").fill(question);
  await page.getByRole("radio", { name: /行动取舍/ }).check();
  await page.getByLabel("选项 1", { exact: true }).fill(options[0]);
  await page.getByLabel("选项 2", { exact: true }).fill(options[1]);
  await page.getByRole("button", { name: /添加更多选项/ }).click();
  await page.getByLabel("选项 3", { exact: true }).fill(options[2]);
  await page.getByLabel(/预设场景/).selectOption("沟通联系");
  await page.getByLabel("出生日期").fill("1998-06-15");
  await page.getByRole("button", { name: "开启这次探索" }).click();
  await revealTarot(page);
  await expect(page.getByTestId("ai-tarot")).toBeVisible();
}
async function downloadText(page: Page, format: "JSON" | "Markdown") {
  const [file] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: format, exact: true }).click(),
  ]);
  const stream = await file.createReadStream();
  let content = "";
  for await (const chunk of stream!) content += chunk.toString();
  return content;
}

test.beforeEach(async ({ page }) => {
  // Every model response below is synthetic; accidental external requests are blocked.
  await page.route("**/*", async (route) => {
    if (new URL(route.request().url()).origin === "http://127.0.0.1:5174")
      await route.fallback();
    else await route.abort("blockedbyclient");
  });
});

test("AI runs only on explicit click; double click, restoration and exports preserve the frozen reading", async ({
  page,
}) => {
  const requests: AiRequest[] = [];
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(endpoint, async (route) => {
    requests.push(route.request().postDataJSON() as AiRequest);
    await pending;
    await complete(route);
  });
  await start(page, "no-preference");
  await page
    .getByTestId("result-runes")
    .getByRole("button", { name: "置顶体系" })
    .click();
  await page
    .getByTestId("result-tarot")
    .getByRole("button", { name: "我更认同" })
    .click();
  const original = await current(page);
  expect(requests).toEqual([]);
  const panel = page.getByTestId("ai-tarot");
  await panel
    .getByRole("button", { name: "获取针对问题的建议" })
    .evaluate((button) => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
  await expect.poll(() => requests.length).toBe(1);
  await expect(panel).toHaveAttribute("aria-busy", "true");
  await expect(panel.getByTestId("engine-meditation")).toBeVisible();
  await expect
    .poll(() =>
      panel.evaluate(
        (element) =>
          element
            .getAnimations({ subtree: true })
            .filter((animation) => animation.playState === "running").length,
      ),
    )
    .toBeGreaterThan(0);
  await expect(panel.getByRole("status")).toContainText(
    "正在结合你的问题与选项",
  );
  await expect(panel.getByRole("progressbar")).toHaveCount(0);
  await expect(panel.getByText(/\d+\s*%/)).toHaveCount(0);
  await expect(panel.getByRole("button")).toBeDisabled();
  await page.getByRole("button", { name: "暂停动态效果", exact: true }).click();
  await expect
    .poll(() =>
      panel.evaluate(
        (element) =>
          element
            .getAnimations({ subtree: true })
            .filter((animation) => animation.playState === "running").length,
      ),
    )
    .toBe(0);
  release();
  await expect(panel.locator(".ai-prose")).toHaveText(answer.text);
  await expect(panel.getByTestId("engine-meditation")).toHaveCount(0);
  const generated = await current(page);
  expect(generated.reading).toEqual(original.reading);
  expect(generated.preferences).toEqual(original.preferences);
  expect(generated.enhancements?.tarot?.response).toEqual(answer);
  expect(generated.reading).not.toHaveProperty("enhancements");
  expect(Object.keys(generated.enhancements!)).toEqual(["tarot"]);
  await page.reload();
  await expect(page.getByTestId("ai-tarot").locator(".ai-prose")).toHaveText(
    answer.text,
  );
  expect(requests).toHaveLength(1);
  expect((await current(page)).reading).toEqual(original.reading);
  expect((await current(page)).preferences).toEqual(original.preferences);
  await page.getByRole("button", { name: "保存本次", exact: true }).click();
  const history = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("zhongbu-history-v1")!) as SavedReading[],
  );
  expect(history[0].enhancements).toEqual(generated.enhancements);
  expect(history[0].reading).toEqual(original.reading);
  await page.getByText("导出 ↓", { exact: true }).click();
  const json = JSON.parse(await downloadText(page, "JSON")) as SavedReading;
  expect(json.reading).toEqual(original.reading);
  expect(json.preferences).toEqual(original.preferences);
  expect(json.enhancements).toEqual(generated.enhancements);
  const markdown = await downloadText(page, "Markdown");
  expect(markdown).toContain("AI 灵感解读");
  expect(markdown).toContain(answer.text);
  expect(markdown).toContain("不属于传统原文或本地规则结论");
  expect(JSON.stringify(json)).not.toContain("1998-06-15");
  expect(requests).toHaveLength(1);
});

test("clicking advice sends the exact question and ordered options for only that engine", async ({
  page,
}) => {
  const requests: AiRequest[] = [];
  await page.route(endpoint, async (route) => {
    requests.push(route.request().postDataJSON() as AiRequest);
    await complete(route);
  });
  await start(page);
  const original = (await current(page)).reading;
  const tarot = page.getByTestId("ai-tarot");
  await expect(page.getByLabel("同时发送我的问题与行动")).toHaveCount(0);
  await expect(
    tarot.getByText(/点击.*发送|生日字段.*发送|点击才联网/),
  ).toHaveCount(0);
  await tarot.getByRole("button", { name: "获取针对问题的建议" }).click();
  await expect(tarot.locator(".ai-prose")).toBeVisible();
  expect(requests[0].engine).toBe("tarot");
  const runes = page.getByTestId("ai-runes");
  await runes.getByRole("button", { name: "获取针对问题的建议" }).click();
  await expect(runes.locator(".ai-prose")).toBeVisible();
  expect(requests).toHaveLength(2);
  expect(requests[1].engine).toBe("runes");
  for (const request of requests) {
    expect(request.context.question).toBe(question);
    expect(request.context.options).toEqual(options);
    expect(JSON.stringify(request)).not.toContain("1998-06-15");
    expect(JSON.stringify(request)).not.toContain(original.askedAt);
    expect(request).not.toHaveProperty("preferences");
    expect(request).not.toHaveProperty("results");
  }
  expect((await current(page)).reading).toEqual(original);
});

test("an in-flight request survives preference, filter and view changes without redrawing", async ({
  page,
}) => {
  let calls = 0;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(endpoint, async (route) => {
    calls += 1;
    await pending;
    await complete(route);
  });
  await start(page);
  const original = (await current(page)).reading;
  await page
    .getByTestId("ai-tarot")
    .getByRole("button", { name: "获取针对问题的建议" })
    .click();
  await expect.poll(() => calls).toBe(1);
  await page
    .getByTestId("result-runes")
    .getByRole("button", { name: "收藏本条" })
    .click();
  await page.getByRole("button", { name: "只看收藏" }).click();
  await expect(page.getByTestId("result-tarot")).toHaveCount(0);
  await page.getByRole("button", { name: "规则汇总", exact: true }).click();
  await page.getByRole("button", { name: "我的偏好汇总", exact: true }).click();
  await page.getByLabel("周易 · 三枚铜钱", { exact: true }).uncheck();
  const preferences = (await current(page)).preferences;
  release();
  await expect
    .poll(async () => (await current(page)).enhancements?.tarot?.response.text)
    .toBe(answer.text);
  await page.getByRole("button", { name: /看各家/ }).click();
  await page.getByRole("button", { name: "查看全部" }).click();
  await expect(page.getByTestId("ai-tarot").locator(".ai-prose")).toHaveText(
    answer.text,
  );
  expect(calls).toBe(1);
  expect((await current(page)).reading).toEqual(original);
  expect((await current(page)).preferences).toEqual(preferences);
  const saved = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("zhongbu-history-v1")!) as SavedReading[],
  );
  expect(saved[0].enhancements?.tarot?.response.text).toBe(answer.text);
  expect(saved[0].preferences).toEqual(preferences);
  expect(saved[0].reading).toEqual(original);
});

for (const failure of [
  {
    name: "HTTP failure",
    status: 500,
    body: "upstream failed",
    message: "请稍后重试",
  },
  {
    name: "rate limit",
    status: 429,
    body: "rate limited",
    message: "一分钟后再试",
  },
  {
    name: "invalid response",
    status: 200,
    body: "{}",
    message: "无法识别的内容",
  },
]) {
  test(`${failure.name} is explicit and retryable without changing the local result`, async ({
    page,
  }) => {
    let calls = 0;
    await page.route(endpoint, async (route) => {
      calls += 1;
      if (calls === 1)
        await route.fulfill({
          status: failure.status,
          contentType: "application/json",
          body: failure.body,
        });
      else await complete(route);
    });
    await start(page);
    const original = await current(page);
    const panel = page.getByTestId("ai-tarot");
    await panel.getByRole("button", { name: "获取针对问题的建议" }).click();
    await expect(panel.getByRole("status")).toContainText(failure.message);
    await expect(
      panel.getByRole("button", { name: "获取针对问题的建议" }),
    ).toBeEnabled();
    expect((await current(page)).enhancements).toBeUndefined();
    expect((await current(page)).reading).toEqual(original.reading);
    await panel.getByRole("button", { name: "获取针对问题的建议" }).click();
    await expect(panel.locator(".ai-prose")).toHaveText(answer.text);
    expect(calls).toBe(2);
    expect((await current(page)).reading).toEqual(original.reading);
    expect((await current(page)).preferences).toEqual(original.preferences);
  });
}

test("model content stays plain text and cannot execute markup or navigate", async ({
  page,
}) => {
  const text =
    '<img src=x onerror="window.__modelExecuted=true"><script>window.__modelExecuted=true</script><a href="https://example.com">外部内容</a>';
  await page.route(endpoint, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...answer, text }),
    }),
  );
  await start(page);
  const original = (await current(page)).reading;
  const panel = page.getByTestId("ai-tarot");
  await panel.getByRole("button", { name: "获取针对问题的建议" }).click();
  await expect(panel.locator(".ai-prose")).toHaveText(text);
  await expect(
    panel.locator(".ai-prose img, .ai-prose script, .ai-prose a"),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() => Object.hasOwn(window, "__modelExecuted")),
  ).toBe(false);
  expect((await current(page)).reading).toEqual(original);
});

test.describe("mobile browsers with older AbortSignal support", () => {
  test.use({
    viewport: devices["Pixel 7"].viewport,
    userAgent: devices["Pixel 7"].userAgent,
    deviceScaleFactor: devices["Pixel 7"].deviceScaleFactor,
    isMobile: true,
    hasTouch: true,
  });

  test("a network failure can be retried manually without AbortSignal.any or timeout", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Reflect.deleteProperty(AbortSignal, "any");
      Reflect.deleteProperty(AbortSignal, "timeout");
    });
    let calls = 0;
    await page.route(endpoint, async (route) => {
      calls++;
      if (calls === 1) await route.abort("failed");
      else await complete(route);
    });
    await start(page);
    expect(
      await page.evaluate(() => [
        typeof AbortSignal.any,
        typeof AbortSignal.timeout,
      ]),
    ).toEqual(["undefined", "undefined"]);
    const original = (await current(page)).reading;
    const panel = page.getByTestId("ai-tarot");
    await panel.getByRole("button", { name: "获取针对问题的建议" }).click();
    await expect(panel.getByRole("status")).toContainText(/连接|网络/);
    expect(calls).toBe(1);
    await expect(
      panel.getByRole("button", { name: "获取针对问题的建议" }),
    ).toBeEnabled();
    expect((await current(page)).enhancements).toBeUndefined();
    await panel.getByRole("button", { name: "获取针对问题的建议" }).click();
    await expect(panel.locator(".ai-prose")).toHaveText(answer.text);
    expect(calls).toBe(2);
    expect((await current(page)).reading).toEqual(original);
    expect((await current(page)).enhancements?.tarot?.response).toEqual(answer);
  });
});
