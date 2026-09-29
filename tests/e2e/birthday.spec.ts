import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import type { SavedReading } from "../../src/types";
const memoryKey = "zhongbu-birthday-consent-v1";
const memory = (page: Page) =>
  page.evaluate((key) => localStorage.getItem(key), memoryKey);
const current = (page: Page) =>
  page.evaluate(
    () =>
      JSON.parse(sessionStorage.getItem("zhongbu-active-v1")!) as SavedReading,
  );

test("typing and declining birthday memory never persists the birthday", async ({
  page,
}) => {
  await page.goto("/");
  const panel = page.getByTestId("birthday-memory");
  await expect(
    panel.getByRole("button", { name: "同意保存生日", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("出生日期").fill("1998-06-15");
  expect(await memory(page)).toBeNull();
  await panel.getByRole("button", { name: "这次不保存", exact: true }).click();
  await page.getByRole("button", { name: "开启这次探索" }).click();
  await expect(page.getByTestId("result-tarot")).toBeVisible();
  await page.getByRole("button", { name: "保存本次", exact: true }).click();
  expect(await memory(page)).toBeNull();
  expect(JSON.stringify(await current(page))).not.toContain("1998-06-15");
  await page.reload();
  await page.getByRole("button", { name: /再问一次/ }).click();
  await expect(page.getByLabel("出生日期")).toHaveValue("");
});

test("birthday memory requires separate consent, auto-fills next time and can be replaced or forgotten", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("出生日期").fill("1998-06-15");
  await page.getByRole("button", { name: "同意保存生日", exact: true }).click();
  expect(JSON.parse((await memory(page))!)).toEqual({
    version: 1,
    consent: true,
    birthday: "1998-06-15",
  });
  await page.getByLabel("出生日期").fill("1999-07-16");
  expect(JSON.parse((await memory(page))!).birthday).toBe("1998-06-15");
  await page.reload();
  await expect(page.getByLabel("出生日期")).toHaveValue("1998-06-15");
  await page.getByLabel("出生日期").fill("1999-07-16");
  await page
    .getByRole("button", { name: "同意改为当前生日", exact: true })
    .click();
  expect(JSON.parse((await memory(page))!).birthday).toBe("1999-07-16");
  await page.reload();
  await expect(page.getByLabel("出生日期")).toHaveValue("1999-07-16");
  await page
    .getByRole("button", { name: "忘记保存的生日", exact: true })
    .click();
  expect(await memory(page)).toBeNull();
  await expect(page.getByLabel("出生日期")).toHaveValue("");
  await page.reload();
  await expect(page.getByLabel("出生日期")).toHaveValue("");
});

test("future remembered birthdays are ignored without silently rewriting the stored value", async ({
  page,
}) => {
  const invalid = JSON.stringify({
    version: 1,
    consent: true,
    birthday: "2099-12-31",
  });
  await page.addInitScript(
    ({ key, value }) => localStorage.setItem(key, value),
    { key: memoryKey, value: invalid },
  );
  await page.goto("/");
  await expect(page.getByLabel("出生日期")).toHaveValue("");
  await expect(
    page.getByTestId("birthday-memory").getByRole("status"),
  ).toContainText("无法读取");
  expect(await memory(page)).toBe(invalid);
  await page.getByRole("button", { name: "忘记已存生日", exact: true }).click();
  expect(await memory(page)).toBeNull();
});

test("birthday matrix retains repeated digits and interactive cell details never alter the frozen record", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByLabel("出生日期").fill("1998-06-15");
  await page.getByRole("button", { name: "同意保存生日", exact: true }).click();
  await page.getByRole("button", { name: "开启这次探索" }).click();
  await expect(page.getByTestId("result-tarot")).toBeVisible();
  await page.getByTestId("chapter-numerology").click();
  await expect(page.getByTestId("number-matrix")).toHaveCount(0);
  await page.getByTestId("reveal-numerology").click();
  const original = await current(page);
  expect(
    original.reading.results.find((r) => r.engine === "numerology")?.raw?.kind,
  ).toBe("numerology-matrix");
  await expect(page.getByTestId("number-matrix")).toBeVisible();
  expect(
    await page
      .locator(".matrix-cell")
      .evaluateAll((cells) =>
        cells.map((cell) => cell.getAttribute("data-testid")),
      ),
  ).toEqual([1, 4, 7, 2, 5, 8, 3, 6, 9].map((digit) => `matrix-cell-${digit}`));
  for (const [digit, count] of [
    [1, 2],
    [2, 0],
    [3, 0],
    [4, 0],
    [5, 1],
    [6, 1],
    [7, 0],
    [8, 1],
    [9, 2],
  ]) {
    const cell = page.getByTestId(`matrix-cell-${digit}`);
    await expect(cell).toHaveAttribute(
      "aria-label",
      new RegExp(`出现 ${count} 次`),
    );
    await cell.click();
    await expect(cell).toHaveAttribute("aria-pressed", "true");
  }
  await page.getByTestId("matrix-cell-2").press("Enter");
  await expect(page.locator(".matrix-detail")).toContainText("不代表你缺少");
  expect((await current(page)).reading).toEqual(original.reading);
  await page.getByRole("button", { name: "保存本次", exact: true }).click();
  const records = await page.evaluate(() =>
    [
      sessionStorage.getItem("zhongbu-active-v1"),
      localStorage.getItem("zhongbu-history-v1"),
    ].join(""),
  );
  expect(records).not.toContain("1998-06-15");
  expect(records).not.toContain('"birthday"');
  expect(await memory(page)).toContain("1998-06-15");
});
