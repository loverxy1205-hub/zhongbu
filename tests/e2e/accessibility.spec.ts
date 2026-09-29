import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { revealAll } from "./helpers";

async function audit(page: Page) {
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    audit.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => ({ html: n.html, summary: n.failureSummary })),
    })),
  ).toEqual([]);
}
async function settleResults(page: Page) {
  await page.locator(".results-page").evaluate(async (element) => {
    await Promise.all(
      element
        .getAnimations({ subtree: true })
        .filter(
          (animation) =>
            animation.effect?.getComputedTiming().iterations !== Infinity,
        )
        .map((animation) => animation.finished.catch(() => undefined)),
    );
  });
}
test("homepage, concealed and revealed results pass automated WCAG A/AA accessibility checks", async ({
  page,
}) => {
  await page.goto("/");
  await audit(page);
  await page.getByLabel("出生日期").fill("1998-06-15");
  await page.getByRole("button", { name: "开启这次探索" }).click();
  await expect(page.getByTestId("ritual-transition")).toBeVisible();
  await page.getByRole("button", { name: "跳过动画", exact: true }).click();
  await expect(page.getByTestId("result-tarot")).toBeVisible();
  // Audit stable views after finite entrance and reveal animations finish.
  await settleResults(page);
  await audit(page);
  await revealAll(page);
  await settleResults(page);
  await audit(page);
});
