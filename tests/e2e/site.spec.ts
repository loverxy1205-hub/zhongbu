import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import type { SavedReading } from "../../src/types";
import { revealAll } from "./helpers";
const current = (page: Page) =>
  page.evaluate(
    () =>
      JSON.parse(sessionStorage.getItem("zhongbu-active-v1")!) as SavedReading,
  );
async function start(page: Page, birthday = true) {
  await page.goto("/");
  await page.getByLabel("你的问题").fill("接下来的一周，我可以留意些什么？");
  if (birthday) await page.getByLabel("出生日期").fill("1998-06-15");
  await page.getByRole("button", { name: "开启这次探索" }).click();
  await expect(page.getByTestId("result-tarot")).toBeVisible();
  await revealAll(page);
}
test("all five engines work, no remote runtime requests or keys", async ({
  page,
}) => {
  const external: string[] = [];
  page.on("request", (r) => {
    if (!r.url().startsWith("http://127.0.0.1:4173/")) external.push(r.url());
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await start(page);
  for (const id of ["tarot", "iching", "meihua", "numerology", "runes"])
    await expect(page.getByTestId(`result-${id}`)).toBeVisible();
  expect(
    (await current(page)).reading.results.every(
      (r: { status: string }) => r.status === "ok",
    ),
  ).toBeTruthy();
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
  await expect(page.getByRole("button", { name: /看各家/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
test("birthday omitted retains an unavailable card and four complete engines", async ({
  page,
}) => {
  await start(page, false);
  await expect(page.getByTestId("result-numerology")).toContainText(
    "未提供出生日期",
  );
  expect(
    (await current(page)).reading.results.filter(
      (r: { status: string }) => r.status === "ok",
    ),
  ).toHaveLength(4);
  await expect(page.getByTestId("reveal-numerology")).toHaveCount(0);
  await expect(page.getByTestId("ai-numerology")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "规则汇总", exact: true }),
  ).toBeEnabled();
});
test("preferences, saved history and refresh never redraw; delete and clear work", async ({
  page,
}) => {
  await start(page);
  const original = (await current(page)).reading;
  await page
    .getByTestId("result-runes")
    .getByRole("button", { name: "置顶体系" })
    .click();
  await page
    .getByTestId("result-tarot")
    .getByRole("button", { name: "我更认同" })
    .click();
  await page
    .getByTestId("result-tarot")
    .getByRole("button", { name: "收藏本条" })
    .click();
  await page.getByRole("button", { name: "只看收藏" }).click();
  await expect(page.locator(".result-card")).toHaveCount(1);
  await page.getByRole("button", { name: "查看全部" }).click();
  await expect(page.locator(".result-card")).toHaveCount(5);
  await page.getByRole("button", { name: "恢复默认排序" }).click();
  await expect(page.locator(".result-card").first()).toHaveAttribute(
    "data-testid",
    "result-tarot",
  );
  await page.reload();
  await expect(page.getByTestId("result-tarot")).toBeVisible();
  expect((await current(page)).reading).toEqual(original);
  await page.getByRole("button", { name: /本机记录/ }).click();
  await page.getByRole("button", { name: "打开原记录" }).click();
  expect((await current(page)).reading).toEqual(original);
  await page.getByRole("button", { name: /本机记录/ }).click();
  await page.getByRole("button", { name: "删除", exact: true }).click();
  await expect(page.getByText("还没有留下的记录")).toBeVisible();
  await page.getByRole("button", { name: "问一件事", exact: true }).click();
  await page.getByRole("button", { name: "保存本次", exact: true }).click();
  await page.getByRole("button", { name: /本机记录/ }).click();
  await page.getByRole("button", { name: "清空记录", exact: true }).click();
  await page.getByRole("button", { name: "确认清空", exact: true }).click();
  await expect(page.getByText("还没有留下的记录")).toBeVisible();
});
test("full and personal summaries retain scope and do not rewrite results", async ({
  page,
}) => {
  await start(page);
  const original = (await current(page)).reading;
  await page.getByRole("button", { name: "规则汇总", exact: true }).click();
  await expect(page.getByText("保留分歧", { exact: true })).toBeVisible();
  await expect(page.locator(".related-note")).toContainText(
    "不是两份独立科学证据",
  );
  await page.getByRole("button", { name: "我的偏好汇总", exact: true }).click();
  await page.getByLabel("周易 · 三枚铜钱", { exact: true }).uncheck();
  await expect(page.locator(".scope-note")).not.toContainText(
    "周易 · 三枚铜钱",
  );
  expect((await current(page)).reading).toEqual(original);
  await page.getByRole("button", { name: /看各家/ }).click();
  await expect(page.locator(".result-card")).toHaveCount(5);
});
test("double submit generates one record, explicit again generates a new one", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("出生日期").fill("1998-06-15");
  await page.locator("form").evaluate((f) => {
    f.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    f.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  const first = (await current(page)).reading;
  await expect(page.getByTestId("ritual-transition")).toBeVisible();
  await expect(page.locator(".result-card")).toHaveCount(0);
  await page.getByRole("button", { name: "跳过动画", exact: true }).click();
  await expect(page.getByTestId("result-tarot")).toBeVisible();
  expect((await current(page)).reading).toEqual(first);
  await page.getByRole("button", { name: /再问一次/ }).click();
  await page.getByRole("button", { name: "开启这次探索" }).click();
  await expect(page.getByTestId("ritual-transition")).toBeVisible();
  expect((await current(page)).reading.readingId).not.toBe(first.readingId);
});
test("offline calculation, source library and offline refresh after caching", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);
  await page.getByLabel("出生日期").fill("1998-06-15");
  await page.getByRole("button", { name: "开启这次探索" }).click();
  await expect(page.locator(".result-card")).toHaveCount(5);
  await revealAll(page);
  const first = (await current(page)).reading;
  expect(
    first.results.every((r: { status: string }) => r.status === "ok"),
  ).toBeTruthy();
  await page.reload();
  await expect(page.getByTestId("result-tarot")).toBeVisible();
  expect((await current(page)).reading).toEqual(first);
  await page.getByRole("button", { name: "方法与知识", exact: true }).click();
  await page.getByRole("button", { name: "周易 64", exact: true }).click();
  await expect(page.locator(".knowledge-entry")).toHaveCount(64);
  await page.getByRole("button", { name: "问一件事", exact: true }).click();
  await page.getByRole("button", { name: /再问一次/ }).click();
  await page.getByRole("button", { name: "开启这次探索" }).click();
  await expect(page.getByTestId("result-tarot")).toBeVisible();
});
test("raw birthday absent from local/session persistence and exports", async ({
  page,
}) => {
  await start(page);
  await page.getByRole("button", { name: "保存本次", exact: true }).click();
  const stores = await page.evaluate(() =>
    JSON.stringify([
      localStorage.getItem("zhongbu-history-v1"),
      sessionStorage.getItem("zhongbu-active-v1"),
    ]),
  );
  expect(stores).not.toContain("1998-06-15");
  expect(stores).not.toContain("birthday");
  await page.getByText("导出 ↓", { exact: true }).click();
  const [file] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "JSON", exact: true }).click(),
  ]);
  const stream = await file.createReadStream();
  let content = "";
  for await (const chunk of stream!) content += chunk.toString();
  expect(content).not.toContain("1998-06-15");
  expect(JSON.parse(content).reading.readingId).toBe(
    (await current(page)).reading.readingId,
  );
});
test("blocked storage reports an error but still calculates and exports", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new Error("blocked");
    };
    Storage.prototype.setItem = () => {
      throw new Error("blocked");
    };
  });
  await start(page);
  await page.getByRole("button", { name: "保存本次", exact: true }).click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: /读取失败|存储不可用|保存失败/ }),
  ).toBeVisible();
  await expect(page.locator(".result-card")).toHaveCount(5);
  await page.getByText("导出 ↓", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Markdown", exact: true }),
  ).toBeVisible();
});
test("ordered options preserve negation without forcing a local tendency", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("行动取舍", { exact: false }).check();
  await page.getByLabel("选项 1", { exact: true }).fill("不联系对方");
  await page.getByLabel("选项 2", { exact: true }).fill("先整理想说的话");
  await page.getByLabel("预设场景").selectOption("沟通联系");
  await page.getByRole("button", { name: "开启这次探索" }).click();
  await expect(page.getByTestId("result-tarot")).toBeVisible();
  await expect(
    page.getByText("不联系对方", { exact: true }).first(),
  ).toBeVisible();
  const r = (await current(page)).reading;
  expect(r.input.options).toEqual(["不联系对方", "先整理想说的话"]);
  expect(
    r.results
      .filter((x: { status: string }) => x.status === "ok")
      .every((x) => x.interpretation?.inclination === "无明确倾向"),
  ).toBeTruthy();
});
test("method library is complete and keyboard-accessible; layout has no horizontal overflow", async ({
  page,
}, info) => {
  await page.goto("/");
  await expect(page).toHaveTitle("众卜 · 一个问题，多种视角。");
  await page.keyboard.press("Tab");
  await expect(page.getByText("跳到主要内容")).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: `test-results/${info.project.name}-home.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "方法与知识", exact: true }).click();
  await expect(page.locator(".knowledge-entry")).toHaveCount(78);
  await page.getByRole("button", { name: "卢恩 24", exact: true }).click();
  await expect(page.locator(".knowledge-entry")).toHaveCount(24);
  await page.getByRole("button", { name: "周易 64", exact: true }).click();
  await page.getByLabel("搜索知识条目").fill("革");
  await page.locator(".knowledge-entry").first().locator("summary").click();
  await expect(page.getByText("传统原文", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
test("raw results and basic interpretations remain while reflections and technical disclosures are removed", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await start(page);
  const coin = page.getByTestId("result-iching");
  await expect(coin.locator(".hex-figure")).toHaveCount(2);
  await expect(
    page.getByTestId("result-tarot").locator(".symbol-slot"),
  ).toHaveCount(3);
  await expect(coin.locator(".result-reading")).toBeVisible();
  await expect(page.locator(".result-card .reflection-box")).toHaveCount(0);
  await expect(page.locator(".result-card").getByText(/场景反思/)).toHaveCount(
    0,
  );
  await expect(page.locator(".result-card details")).toHaveCount(0);
  for (const text of ["追溯依据", "计算或抽取过程", "来源与限制"])
    await expect(
      page.locator(".result-card").getByText(text, { exact: true }),
    ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: `test-results/${info.project.name}-results.png`,
    fullPage: true,
  });
});
