import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { SavedReading } from "../../src/types";
import type { GeomancyState } from "../../src/experiences/geomancy/state";

async function snapshot(page: Page) {
  return page.evaluate(
    () =>
      JSON.parse(sessionStorage.getItem("zhongbu-active-v1")!) as SavedReading,
  );
}
async function geomancy(page: Page): Promise<GeomancyState> {
  const result = (await snapshot(page)).reading.results.find(
    (r) => r.engine === "geomancy",
  );
  if (result?.raw?.kind !== "geomancy") throw Error("Missing geomancy state");
  return result.raw;
}
async function begin(page: Page, reduce = true) {
  await page.emulateMedia({
    reducedMotion: reduce ? "reduce" : "no-preference",
  });
  await page.goto("/");
  for (const input of await page.locator(".engine-picker input").all())
    await input.uncheck();
  await page.getByLabel(/地占术/).check();
  await page.getByRole("button", { name: /^开启这次探索/ }).click();
  if (!reduce)
    await page.getByRole("button", { name: "跳过动画", exact: true }).click();
  await expect(page.getByTestId("geomancy-experience")).toBeVisible();
}

test("geomancy hand input counts only visible dots; keyboard, cancellation, cap and partial restore", async ({
  page,
}) => {
  await begin(page);
  const original = await snapshot(page);
  await page.getByRole("button", { name: /亲手点沙/ }).click();
  const pad = page.getByRole("button", {
    name: "点沙面，每次添加一个点",
    exact: true,
  });
  await expect(
    page.getByRole("button", { name: "结束本行", exact: true }),
  ).toBeDisabled();
  await pad.focus();
  await page.keyboard.press("Enter");
  expect((await geomancy(page)).committedCounts).toEqual([]);
  await page.keyboard.press("Space");
  await page.keyboard.press("Space");
  await expect(pad.locator(".gm-sand-dot")).toHaveCount(2);
  const firstIds = (await geomancy(page)).handRows[0].map((p) => p.id);
  await pad.dispatchEvent("pointerdown", {
    pointerType: "touch",
    pointerId: 7,
  });
  await pad.dispatchEvent("pointercancel", {
    pointerType: "touch",
    pointerId: 7,
  });
  expect((await geomancy(page)).handRows[0]).toHaveLength(2);
  expect((await geomancy(page)).committedCounts).toEqual([]);
  await page.getByRole("button", { name: "清空当前行", exact: true }).click();
  await pad.click();
  expect(firstIds).not.toContain((await geomancy(page)).handRows[0][0].id);
  await pad.focus();
  await page.keyboard.press("Enter");
  expect((await geomancy(page)).committedCounts).toEqual([1]);
  // Explicit clicks, each in a separate browser task, exercise the UI cap.
  await pad.evaluate(async (node) => {
    for (let n = 0; n < 130; n++) {
      (node as HTMLButtonElement).click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  });
  await expect(pad.locator(".gm-sand-dot")).toHaveCount(128);
  await expect(
    page.getByText("本行 128 点 · 已达上限，请结束本行"),
  ).toBeVisible();
  const partial = await geomancy(page);
  expect(new Set(partial.handRows[1].map((p) => `${p.x}/${p.y}`)).size).toBe(
    128,
  );
  await page.reload();
  expect(await geomancy(page)).toEqual(partial);
  expect((await snapshot(page)).reading.readingId).toBe(
    original.reading.readingId,
  );
  await page.getByRole("button", { name: "结束本行", exact: true }).click();
  expect((await geomancy(page)).committedCounts).toEqual([1, 128]);
  for (let row = 2; row < 16; row++) {
    await pad.click();
    await page.getByRole("button", { name: "结束本行", exact: true }).click();
  }
  const frozen = (await geomancy(page)).raw;
  await page
    .getByRole("button", { name: "跳过演示，保留结果", exact: true })
    .click();
  expect((await geomancy(page)).raw).toEqual(frozen);
  await expect(
    page.getByRole("button", { name: "点沙面，每次添加一个点" }),
  ).toHaveCount(0);
});

test("geomancy physical rows produce the known transposed shield and visible lineage", async ({
  page,
}) => {
  await begin(page);
  await page.getByRole("button", { name: /实物录入/ }).click();
  await page
    .getByRole("button", { name: "冻结16行，开始推演", exact: true })
    .click();
  expect((await geomancy(page)).phase).toBe("input");
  const counts = [1, 1, 1, 1, 1, 2, 1, 2, 2, 2, 1, 1, 1, 2, 2, 1];
  for (let i = 0; i < 16; i++)
    await page
      .getByLabel(`第${i + 1}行点数`, { exact: true })
      .fill(String(counts[i]));
  await page.getByLabel("第1行点数", { exact: true }).fill("0");
  await page
    .getByRole("button", { name: "冻结16行，开始推演", exact: true })
    .click();
  expect((await geomancy(page)).phase).toBe("input");
  await page.getByLabel("第1行点数", { exact: true }).fill("1");
  await page
    .getByRole("button", { name: "冻结16行，开始推演", exact: true })
    .click();
  const expected = [
    "1111",
    "1010",
    "0011",
    "1001",
    "1101",
    "1000",
    "1110",
    "1011",
    "0101",
    "1010",
    "0101",
    "0101",
    "1111",
    "0000",
    "1111",
  ];
  expect((await geomancy(page)).raw?.positions.map((p) => p.code)).toEqual(
    expected,
  );
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await expect(page.locator(".gm-node-visible")).toHaveCount(4);
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await expect(page.locator(".gm-node-visible")).toHaveCount(8);
  await page.locator('[data-position="D1"]').click();
  await expect(page.locator(".gm-position-detail")).toContainText(
    "第1、5、9、13行",
  );
  await expect(page.locator(".gm-position-detail")).toContainText(
    "转置，不是求和",
  );
  await page
    .getByRole("button", { name: "跳过演示，保留结果", exact: true })
    .click();
  await page.getByRole("button", { name: "看盾图", exact: true }).click();
  await expect(page.locator(".gm-node-visible")).toHaveCount(15);
  await page.locator('[data-position="J"]').click();
  await expect(page.locator(".gm-xor-proof")).toHaveText("1111 ⊕ 0000 = 1111");
  await page.getByRole("button", { name: "看沙迹", exact: true }).click();
  await expect(page.locator(".gm-trace-row")).toHaveCount(16);
});

test("geomancy automatic input freezes randomness, pause and reduced motion stop progression", async ({
  page,
}) => {
  await begin(page, false);
  await page.getByRole("button", { name: /自动点沙/ }).click();
  const seeded = await geomancy(page);
  await page.getByRole("button", { name: "暂停动态效果", exact: true }).click();
  await page.getByRole("button", { name: "展开自动沙迹", exact: true }).click();
  await page.waitForTimeout(1750);
  expect((await geomancy(page)).revealStep).toBe(0);
  expect((await geomancy(page)).raw?.rawCounts).toEqual(seeded.autoCounts);
  await page.getByRole("button", { name: "暂停动态效果", exact: true }).click();
  await page.getByRole("button", { name: "暂停推演", exact: true }).click();
  await page.waitForTimeout(1750);
  expect((await geomancy(page)).revealStep).toBe(0);
  await page.getByRole("button", { name: "继续推演", exact: true }).click();
  await expect
    .poll(async () => (await geomancy(page)).revealStep)
    .toBeGreaterThan(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const paused = await geomancy(page);
  await page.waitForTimeout(1400);
  expect((await geomancy(page)).revealStep).toBe(paused.revealStep);
  await page
    .getByRole("button", { name: "跳过演示，保留结果", exact: true })
    .click();
  const completed = await geomancy(page);
  await page.reload();
  expect(await geomancy(page)).toEqual(completed);
  expect(completed.autoCounts).toEqual(seeded.autoCounts);
  await page.getByRole("button", { name: "保存本次", exact: true }).click();
  await page.getByRole("button", { name: /再问一次/ }).click();
  await page.getByRole("button", { name: /^本机记录/ }).click();
  await page.getByRole("button", { name: "打开原记录", exact: true }).click();
  expect(await geomancy(page)).toEqual(completed);
});

test("geomancy layout is contained and controls are accessible before and after shield completion", async ({
  page,
}) => {
  await begin(page);
  const axe = () =>
    new AxeBuilder({ page }).include(".gm-experience").analyze();
  expect((await axe()).violations).toEqual([]);
  await page.getByRole("button", { name: /自动点沙/ }).click();
  await page.getByRole("button", { name: "展开自动沙迹", exact: true }).click();
  await page
    .getByRole("button", { name: "跳过演示，保留结果", exact: true })
    .click();
  await page.getByRole("button", { name: "看盾图", exact: true }).click();
  await page.locator('[data-position="J"]').click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  expect((await axe()).violations).toEqual([]);
});
