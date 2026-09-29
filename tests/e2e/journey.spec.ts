import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import type { SavedReading } from "../../src/types";
import { revealAll } from "./helpers";

const current = (page: Page) =>
  page.evaluate(
    () =>
      JSON.parse(sessionStorage.getItem("zhongbu-active-v1")!) as SavedReading,
  );
const options = (page: Page) =>
  page.getByRole("textbox", { name: /^选项 \d+$/ });

test("the simpler form omits category, reversal control and repeated notices", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByLabel("类别", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("checkbox", { name: /逆位/ })).toHaveCount(0);
  await expect(
    page.locator(".privacy-note, .small-note, .site-footer p"),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "开启这次探索" }).click();
  await expect(page.getByTestId("result-tarot")).toBeVisible({ timeout: 1000 });
  const reading = (await current(page)).reading;
  expect(reading.input.reversals).toBe(true);
  expect(reading.input).not.toHaveProperty("category");
  await expect(page.locator(".reading-metadata")).toHaveCount(0);
});

test("action mode requires two nonempty options before drawing", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("radio", { name: /行动取舍/ }).check();
  await expect(options(page)).toHaveCount(2);
  await expect(page.getByLabel(/我正在考虑做什么/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^删除选项/ })).toHaveCount(0);
  await page.getByRole("button", { name: "开启这次探索" }).click();
  expect(await current(page)).toBeNull();
  await expect(page.getByTestId("ritual-transition")).toHaveCount(0);
  await page.getByLabel("选项 1", { exact: true }).fill("不联系对方");
  await page.getByRole("button", { name: "开启这次探索" }).click();
  expect(await current(page)).toBeNull();
  await expect(page.locator(".result-card")).toHaveCount(0);
  await page.getByLabel("选项 2", { exact: true }).fill("先整理想说的话");
  await page.getByRole("button", { name: "开启这次探索" }).click();
  await expect(page.getByTestId("ritual-transition")).toBeVisible();
  await page.getByRole("button", { name: "跳过动画", exact: true }).click();
  await expect(page.getByTestId("result-tarot")).toBeVisible();
  expect((await current(page)).reading.input.options).toEqual([
    "不联系对方",
    "先整理想说的话",
  ]);
});

test("adding and removing choices retains their order and negation after refresh", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("radio", { name: /行动取舍/ }).check();
  await page.getByLabel("选项 1", { exact: true }).fill("不联系对方");
  await page.getByLabel("选项 2", { exact: true }).fill("现在联系");
  await page.getByRole("button", { name: /添加更多选项/ }).click();
  await expect(options(page)).toHaveCount(3);
  await page.getByLabel("选项 3", { exact: true }).fill("先整理想说的话");
  await page.getByRole("button", { name: /添加更多选项/ }).click();
  await expect(options(page)).toHaveCount(4);
  await page.getByLabel("选项 4", { exact: true }).fill("等到周末再决定");
  await page.getByRole("button", { name: "删除选项 2", exact: true }).click();
  await expect(options(page)).toHaveCount(3);
  await expect(page.getByLabel("选项 2", { exact: true })).toHaveValue(
    "先整理想说的话",
  );
  await expect(page.getByLabel("选项 3", { exact: true })).toHaveValue(
    "等到周末再决定",
  );
  await page.getByRole("button", { name: "开启这次探索" }).click();
  await expect(page.getByTestId("result-tarot")).toBeVisible();
  const original = (await current(page)).reading;
  expect(original.input.options).toEqual([
    "不联系对方",
    "先整理想说的话",
    "等到周末再决定",
  ]);
  await page.reload();
  await expect(page.getByTestId("result-tarot")).toBeVisible();
  expect((await current(page)).reading).toEqual(original);
  for (const option of original.input.options!)
    await expect(page.getByText(option, { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: /再问一次/ }).click();
  for (const [index, option] of original.input.options!.entries())
    await expect(
      page.getByLabel(`选项 ${index + 1}`, { exact: true }),
    ).toHaveValue(option);
});

test("action choices stop at ten and removal never goes below two", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("radio", { name: /行动取舍/ }).check();
  for (let count = 2; count < 10; count++)
    await page.getByRole("button", { name: /添加更多选项/ }).click();
  await expect(options(page)).toHaveCount(10);
  await expect(
    page.getByRole("button", { name: /添加更多选项/ }),
  ).toBeDisabled();
  for (let count = 10; count > 2; count--)
    await page
      .getByRole("button", { name: `删除选项 ${count}`, exact: true })
      .click();
  await expect(options(page)).toHaveCount(2);
  await expect(page.getByRole("button", { name: /^删除选项/ })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /添加更多选项/ }),
  ).toBeEnabled();
});

test("a global pause stops continuous motion without changing the reading", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const pause = page.getByRole("button", { name: "暂停动态效果", exact: true });
  await expect(pause).toHaveAttribute("aria-pressed", "false");
  await pause.click();
  await expect(pause).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".app-shell")).toHaveClass(/motion-paused/);
  await page.getByRole("button", { name: "开启这次探索" }).click();
  await expect(page.getByTestId("result-tarot")).toBeVisible({ timeout: 1000 });
  const original = (await current(page)).reading;
  await revealAll(page);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document
            .getAnimations()
            .filter((animation) => animation.playState === "running").length,
      ),
    )
    .toBe(0);
  await pause.click();
  await expect(pause).toHaveAttribute("aria-pressed", "false");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document
            .getAnimations()
            .filter((animation) => animation.playState === "running").length,
      ),
    )
    .toBeGreaterThan(0);
  expect((await current(page)).reading).toEqual(original);
});

test("reduced motion starts paused and bypasses the ritual wait", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "暂停动态效果", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "开启这次探索" }).click();
  await expect(page.getByTestId("result-tarot")).toBeVisible({ timeout: 1000 });
  await expect(page.getByTestId("ritual-transition")).toHaveCount(0);
  await revealAll(page);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document
            .getAnimations()
            .filter((animation) => animation.playState === "running").length,
      ),
    )
    .toBe(0);
});
