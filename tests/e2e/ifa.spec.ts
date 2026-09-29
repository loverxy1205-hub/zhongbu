import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { SavedReading } from "../../src/types";
import type { IfaState } from "../../src/experiences/ifa/model";

async function current(page: Page) {
  return page.evaluate(
    () =>
      JSON.parse(sessionStorage.getItem("zhongbu-active-v1")!) as SavedReading,
  );
}
async function raw(page: Page): Promise<IfaState> {
  const value = (await current(page)).reading.results.find(
    (result) => result.engine === "ifa",
  )?.raw;
  if (!value || value.kind !== "ifa") throw Error("Ifá state missing");
  return value;
}
function frozen(state: IfaState) {
  const { phase: _phase, ...unchanging } = state;
  return unchanging;
}
async function randomness(page: Page) {
  return page.evaluate(
    () =>
      (window as typeof window & { __ifaRandomCalls: number }).__ifaRandomCalls,
  );
}
async function openIfa(page: Page, reduced = false) {
  await page.addInitScript(() => {
    const tracked = window as typeof window & { __ifaRandomCalls: number };
    tracked.__ifaRandomCalls = 0;
    Object.defineProperty(crypto, "getRandomValues", {
      value: (buffer: Uint32Array<ArrayBuffer>) => {
        for (let index = 0; index < buffer.length; index++) {
          buffer[index] =
            tracked.__ifaRandomCalls < 4
              ? tracked.__ifaRandomCalls + 17
              : Number("00011101"[(tracked.__ifaRandomCalls - 4) % 8]);
          tracked.__ifaRandomCalls++;
        }
        return buffer;
      },
    });
  });
  await page.emulateMedia({
    reducedMotion: reduced ? "reduce" : "no-preference",
  });
  await page.goto("/");
  for (const checkbox of await page.locator(".engine-picker input").all())
    await checkbox.uncheck();
  await page.getByLabel(/Ifá/).check();
  await page.getByRole("button", { name: "开启这次探索" }).click();
  if (!reduced)
    await page.getByRole("button", { name: "跳过动画", exact: true }).click();
  await expect(page.getByTestId("ifa-experience")).toHaveAttribute(
    "data-phase",
    "intro",
  );
}
async function next(page: Page, phase: string) {
  await page.getByTestId("ifa-next").click();
  await expect(page.getByTestId("ifa-experience")).toHaveAttribute(
    "data-phase",
    phase,
  );
}

test("Ifá connects eight shells, preserves right-first symbols and explicitly omits unverified verses and AI", async ({
  page,
}) => {
  await openIfa(page);
  const initial = await raw(page);
  const count = await randomness(page);
  expect(initial.faces).toHaveLength(8);
  expect(initial.rightCode).toBe("0001");
  expect(initial.leftCode).toBe("1101");
  await expect(page.locator(".if-chain-link")).toHaveCount(1);
  await expect(
    page.locator('[data-testid^="ifa-piece-"][data-face="hidden"]'),
  ).toHaveCount(8);
  await expect(page.getByTestId("ifa-result")).toHaveCount(0);
  await page.getByTestId("ifa-next").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("ifa-experience")).toHaveAttribute(
    "data-phase",
    "focus",
  );
  await page.getByTestId("ifa-next").press("Space");
  await expect(page.getByTestId("ifa-experience")).toHaveAttribute(
    "data-phase",
    "lifted",
  );
  await page.getByTestId("ifa-next").click();
  await expect(page.getByTestId("ifa-next")).toBeDisabled();
  await page.getByRole("button", { name: "跳过抛链动画" }).click();
  await expect(page.getByTestId("ifa-experience")).toHaveAttribute(
    "data-phase",
    "settled",
  );
  for (const [index, face] of initial.faces.entries())
    await expect(page.getByTestId(`ifa-piece-${index}`)).toHaveAttribute(
      "data-face",
      face ? "concave" : "convex",
    );
  await next(page, "complete");
  await expect(page.getByTestId("ifa-signature")).toContainText(
    "ifa-r0001-l1101",
  );
  await expect(page.locator(".if-corpus")).toContainText(
    "符号已生成，本版本尚无该项经核对的文本解读",
  );
  await expect(
    page.getByTestId("result-ifa").getByRole("button", { name: /DeepSeek/ }),
  ).toHaveCount(0);
  expect(frozen(await raw(page))).toEqual(frozen(initial));
  expect(await randomness(page)).toBe(count);
  const interpretation = (await current(page)).reading.results[0]
    .interpretation!;
  expect(interpretation.traditional).toEqual([]);
  expect(interpretation.themes).toEqual([]);
  expect(interpretation.inclinationReason).toContain("不参加方向投票");
});

test("Ifá refresh during a cast restores the same lifted chain, then saves the exact completed signature", async ({
  page,
}) => {
  await openIfa(page);
  const initial = await raw(page);
  const readingId = (await current(page)).reading.readingId;
  await next(page, "focus");
  await next(page, "lifted");
  await page.getByTestId("ifa-next").click();
  await page.reload();
  await expect(page.getByTestId("ifa-experience")).toHaveAttribute(
    "data-phase",
    "lifted",
  );
  expect(frozen(await raw(page))).toEqual(frozen(initial));
  expect((await current(page)).reading.readingId).toBe(readingId);
  expect(await randomness(page)).toBe(0);
  await page.getByTestId("ifa-next").dblclick();
  await expect(page.getByTestId("ifa-next")).toBeDisabled();
  await page.getByRole("button", { name: "跳过抛链动画" }).focus();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("ifa-experience")).toHaveAttribute(
    "data-phase",
    "settled",
  );
  await next(page, "complete");
  await page.getByRole("button", { name: "保存本次", exact: true }).click();
  const completed = (await current(page)).reading;
  await page.reload();
  await expect(page.getByTestId("ifa-result")).toBeVisible();
  expect((await current(page)).reading).toEqual(completed);
  expect(await randomness(page)).toBe(0);
});

test("Ifá works offline with reduced motion, global pause, accessible symbols and no narrow-screen overflow", async ({
  page,
  context,
}) => {
  await openIfa(page, true);
  await context.setOffline(true);
  await next(page, "focus");
  await next(page, "lifted");
  await next(page, "settled");
  await expect(page.getByRole("button", { name: "跳过抛链动画" })).toHaveCount(
    0,
  );
  await next(page, "complete");
  const initial = await raw(page);
  const pause = page.getByRole("button", { name: "暂停动态效果", exact: true });
  if ((await pause.getAttribute("aria-pressed")) !== "true")
    await pause.click();
  await expect(page.getByTestId("ifa-experience")).toHaveClass(
    /if-motion-paused/,
  );
  await expect
    .poll(() =>
      page
        .getByTestId("ifa-experience")
        .evaluate(
          (node) =>
            node
              .getAnimations({ subtree: true })
              .filter((animation) => animation.playState === "running").length,
        ),
    )
    .toBe(0);
  await page.getByText("16种基础图式与资料", { exact: true }).click();
  await expect(page.locator(".if-catalog > div")).toHaveCount(16);
  expect(frozen(await raw(page))).toEqual(frozen(initial));
  const audit = await new AxeBuilder({ page })
    .include(".if-experience")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    audit.violations.map((item) => ({
      id: item.id,
      nodes: item.nodes.map((node) => node.failureSummary),
    })),
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
});
