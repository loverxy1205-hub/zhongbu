import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { SavedReading } from "../../src/types";
async function start(
  page: Page,
  engine: "jiaobei" | "oracle",
  motion: "reduce" | "no-preference" = "reduce",
) {
  await page.emulateMedia({ reducedMotion: motion });
  await page.goto("/");
  await page.getByLabel("你的问题").fill("我明天可以不去参加活动吗？");
  for (const checkbox of await page.locator(".engine-picker input").all())
    await checkbox.uncheck();
  await page.locator(`.picker-${engine} input`).check();
  await page.getByRole("button", { name: "开启这次探索" }).click();
  if (motion === "no-preference")
    await page
      .getByRole("button", { name: "跳过动画", exact: true })
      .press("Enter");
  await expect(page.getByTestId(`result-${engine}`)).toBeVisible();
}
const current = (page: Page) =>
  page.evaluate(
    () =>
      JSON.parse(sessionStorage.getItem("zhongbu-active-v1")!) as SavedReading,
  );
async function audit(page: Page) {
  const report = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    report.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({ html: n.html, summary: n.failureSummary })),
    })),
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
}
test("jiaobei locks a negated proposition and three-round mode, preserves facing sides and history", async ({
  page,
}) => {
  await start(page, "jiaobei");
  await audit(page);
  const before = await current(page);
  const raw = before.reading.results[0].raw;
  if (raw?.kind !== "jiaobei") throw Error("jiaobei missing");
  await expect(
    page.getByRole("button", { name: "确认命题", exact: true }),
  ).toBeDisabled();
  await page
    .getByTestId("jiaobei-proposition")
    .fill("我正在考虑明天不去参加这次活动");
  await page.getByLabel("三次全圣确认 · 本站模式").check();
  await page.getByRole("button", { name: "确认命题", exact: true }).click();
  for (let i = 0; i < 3; i++) {
    await page.getByTestId("jiaobei-throw").press("Enter");
    for (let j = 0; j < 2; j++)
      await expect(page.getByTestId(`jiaobei-face-${j}`)).toHaveAttribute(
        "data-side",
        raw.draws[i][j],
      );
    if (i === 0) {
      await page.getByRole("button", { name: "保存本次", exact: true }).click();
      await page.reload();
    }
  }
  await expect(page.getByTestId("jiaobei-throw")).toHaveCount(0);
  await expect(page.getByTestId("ai-jiaobei")).toHaveCount(0);
  const done = await current(page);
  expect(done.reading.results[0].raw).toMatchObject({
    draws: raw.draws,
    proposition: "我正在考虑明天不去参加这次活动",
    revealed: 3,
    phase: "complete",
  });
  await expect(page.locator(".jb-records li")).toHaveCount(3);
  await audit(page);
  await page.reload();
  expect((await current(page)).reading).toEqual(done.reading);
  await page.getByRole("button", { name: "规则汇总", exact: true }).click();
  await expect(
    page.getByText(/掷筊的应允只对应它单独确认的命题/),
  ).toBeVisible();
});
test("jiaobei real toss can be skipped and cultural demo never acts as a directional answer", async ({
  page,
}) => {
  await start(page, "jiaobei", "no-preference");
  await page.getByRole("button", { name: "仅看文化演示", exact: true }).click();
  await page.getByTestId("jiaobei-throw").click();
  await expect(page.locator(".jb-stage")).toHaveClass(/is-playing/);
  await page.getByRole("button", { name: "跳过掷筊动画" }).press("Enter");
  const state = (await current(page)).reading.results[0];
  expect(state.raw).toMatchObject({
    revealed: 1,
    demo: true,
    phase: "complete",
  });
  await page.getByRole("button", { name: "规则汇总", exact: true }).click();
  await expect(page.getByText(/属于资料／历史／演示记录/)).toContainText(
    "掷筊",
  );
});
test("oracle heat originates at the chosen site; observation, case and later outcomes remain separate offline", async ({
  page,
  context,
}) => {
  await start(page, "oracle");
  await audit(page);
  const frozen = (await current(page)).reading.results[0].raw;
  if (frozen?.kind !== "oracle") throw Error("oracle missing");
  await context.setOffline(true);
  await page.getByRole("button", { name: "整治虚拟甲片" }).click();
  await page.getByRole("button", { name: "显现钻凿痕迹" }).click();
  await page.getByRole("button", { name: "记下所问之事" }).click();
  await page.getByRole("button", { name: "灼点 4", exact: true }).click();
  await page.getByTestId("oracle-heat").press("Enter");
  await expect(page.locator(".ob-cracks path")).toHaveCount(3);
  const first = frozen.cracks[3][0][0];
  await expect(page.locator(".ob-cracks path").first()).toHaveAttribute(
    "d",
    new RegExp(`^M${first.x} ${first.y}`),
  );
  await page
    .getByLabel("你的观察（可留空）")
    .fill("这条裂纹让我想到路口，只是我自己的观察。");
  await page.getByLabel("选择独立历史案例").selectOption("hunt");
  await page.getByTestId("oracle-complete").click();
  const done = await current(page);
  await expect(page.getByTestId("ai-oracle")).toHaveCount(0);
  await page
    .getByLabel("实际后来如何？")
    .fill("后来我根据实际安排作出了选择。");
  await page.getByRole("button", { name: "追加事后记录" }).click();
  const later = await current(page);
  expect(later.reading.results[0].interpretation).toEqual(
    done.reading.results[0].interpretation,
  );
  expect(later.reading.results[0].raw).toMatchObject({
    cracks: frozen.cracks,
    site: 3,
    stage: 5,
  });
  await page.getByRole("button", { name: "保存本次", exact: true }).click();
  await audit(page);
  await context.setOffline(false);
  await page.reload();
  expect((await current(page)).reading).toEqual(later.reading);
  await page.getByRole("button", { name: "规则汇总", exact: true }).click();
  await expect(page.getByText(/属于资料／历史／演示记录/)).toContainText(
    "灼甲",
  );
});
