import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("homepage and results pass automated WCAG A/AA accessibility checks", async ({
  page,
}) => {
  await page.goto("/");
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
  await page.getByLabel("出生日期").fill("1998-06-15");
  await page.getByRole("button", { name: "开启这次探索" }).click();
  await page.getByRole("button", { name: "跳过动画／减少动态" }).click();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    results.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({ html: n.html, summary: n.failureSummary })),
    })),
  ).toEqual([]);
});
