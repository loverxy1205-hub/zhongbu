import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import type { SavedReading } from "../../src/types";
import { revealAll, showAll } from "./helpers";
const current = (page: Page) =>
  page.evaluate(
    () =>
      JSON.parse(sessionStorage.getItem("zhongbu-active-v1")!) as SavedReading,
  );
async function start(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByLabel("出生日期").fill("1998-06-15");
  await page.getByRole("button", { name: "开启这次探索" }).click();
  await expect(page.getByTestId("result-tarot")).toBeVisible();
}

test("results default to one engine per chapter; active chapter restores and comparison explicitly shows all", async ({
  page,
}) => {
  await start(page);
  const original = (await current(page)).reading;
  await expect(page.locator(".result-card")).toHaveCount(1);
  await expect(page.getByTestId("chapter-tarot")).toHaveAttribute(
    "aria-current",
    "page",
  );
  for (const engine of ["iching", "meihua", "numerology", "runes"]) {
    await page.getByTestId(`chapter-${engine}`).click();
    await expect(page.locator(".result-card")).toHaveCount(1);
    await expect(page.getByTestId(`result-${engine}`)).toBeVisible();
    await expect(page.getByTestId(`chapter-${engine}`)).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect((await current(page)).activeEngine).toBe(engine);
  }
  await page.reload();
  await expect(page.getByTestId("result-runes")).toBeVisible();
  await expect(page.locator(".result-card")).toHaveCount(1);
  await showAll(page);
  await expect(page.locator(".result-card")).toHaveCount(5);
  await expect(page.locator(".chapter-next")).toHaveCount(0);
  await page.getByTestId("chapter-meihua").click();
  await expect(page.locator(".result-card")).toHaveCount(1);
  await expect(
    page.getByTestId("result-meihua").locator(".result-reading"),
  ).toBeVisible();
  expect((await current(page)).reading).toEqual(original);
});

test("the next chapter control remains reachable without covering cards and summary waits for all reveals", async ({
  page,
}, info) => {
  await start(page);
  const next = page.locator(".chapter-next");
  if (info.project.name === "mobile") {
    await expect(next).toHaveCSS("position", "relative");
    const control = await next.boundingBox();
    const cards = await page.getByTestId("result-tarot").boundingBox();
    expect(control!.y).toBeGreaterThanOrEqual(cards!.y + cards!.height);
    expect(
      page.viewportSize()!.width - control!.x - control!.width,
    ).toBeLessThanOrEqual(40);
  } else {
    await expect(next).toHaveCSS("position", "fixed");
    const before = await next.boundingBox();
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight),
    );
    const after = await next.boundingBox();
    const viewport = page.viewportSize()!;
    expect(after!.x).toBeCloseTo(before!.x, 0);
    expect(after!.y).toBeCloseTo(before!.y, 0);
    expect(viewport.width - after!.x - after!.width).toBeLessThanOrEqual(40);
    expect(viewport.height - after!.y - after!.height).toBeLessThanOrEqual(40);
  }
  await next.click();
  await expect(page.getByTestId("result-iching")).toBeVisible();
  await expect(page.locator(".result-card")).toHaveCount(1);
  await page.getByTestId("chapter-runes").click();
  await expect(next).toContainText("查看各家汇总");
  await expect(next).toBeDisabled();
  await revealAll(page);
  await page.getByTestId("chapter-runes").click();
  await expect(next).toBeEnabled();
  await next.click();
  await expect(page.getByText("保留分歧", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
