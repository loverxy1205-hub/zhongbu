import { test, expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { RUNES } from "../../src/data/runes";
import type { SavedReading } from "../../src/types";
import { revealAll, revealEngine, revealTarot } from "./helpers";

const singleEngines = ["iching", "meihua", "numerology"] as const;
const current = (page: Page) =>
  page.evaluate(
    () =>
      JSON.parse(sessionStorage.getItem("zhongbu-active-v1")!) as SavedReading,
  );
const runningAnimations = (locator: Locator) =>
  locator.evaluate(
    (element) =>
      element
        .getAnimations({ subtree: true })
        .filter((animation) => animation.playState === "running").length,
  );
async function start(
  page: Page,
  reducedMotion: "reduce" | "no-preference" = "reduce",
) {
  await page.emulateMedia({ reducedMotion });
  await page.goto("/");
  await page.getByLabel("出生日期").fill("1998-06-15");
  await page.getByRole("button", { name: "开启这次探索" }).click();
  await expect(page.getByTestId("result-tarot")).toBeVisible();
}

test("every successful engine starts concealed and unlocks only its own result and AI", async ({
  page,
}) => {
  await start(page);
  const original = (await current(page)).reading;
  expect((await current(page)).engineRevealed).toEqual([]);
  expect((await current(page)).runeRevealed).toEqual([]);
  for (const engine of ["tarot", ...singleEngines, "runes"] as const) {
    await expect(
      page
        .getByTestId(`result-${engine}`)
        .locator(".result-reading, .reading-headline, .theme-row"),
    ).toHaveCount(0);
    await expect(page.getByTestId(`ai-${engine}`)).toHaveCount(0);
  }
  await expect(
    page.locator(".hex-figure, .number-visual, .rune-engraving"),
  ).toHaveCount(0);
  for (let index = 0; index < 3; index++)
    await expect(page.getByTestId(`rune-slot-${index}`)).toHaveAttribute(
      "data-revealed",
      "false",
    );
  await page.getByText("导出 ↓", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "JSON", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Markdown", exact: true }),
  ).toBeDisabled();

  await page.getByTestId("reveal-iching").press("Enter");
  await expect(
    page.getByTestId("result-iching").locator(".result-reading"),
  ).toBeVisible({ timeout: 750 });
  await expect(page.getByTestId("ai-iching")).toBeVisible();
  await expect(page.getByTestId("ai-meihua")).toHaveCount(0);
  await page.getByTestId("reveal-meihua").press("Space");
  await expect(
    page.getByTestId("result-meihua").locator(".result-reading"),
  ).toBeVisible({ timeout: 750 });
  await page.getByTestId("reveal-numerology").click();
  await expect(
    page.getByTestId("result-numerology").locator(".result-reading"),
  ).toBeVisible({ timeout: 750 });
  expect((await current(page)).engineRevealed?.toSorted()).toEqual([
    ...singleEngines,
  ]);
  await expect(
    page.getByRole("button", { name: "规则汇总", exact: true }),
  ).toBeDisabled();
  await revealEngine(page, "runes");
  await expect(page.getByTestId("ai-runes")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "规则汇总", exact: true }),
  ).toBeDisabled();
  await expect(page.getByTestId("ai-tarot")).toHaveCount(0);
  await revealTarot(page);
  await expect(
    page.getByRole("button", { name: "规则汇总", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "我的偏好汇总", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "JSON", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Markdown", exact: true }),
  ).toBeEnabled();
  expect((await current(page)).reading).toEqual(original);
});

test("coin, plum and number scenes animate only after activation and reveal the frozen result", async ({
  page,
}) => {
  await start(page, "no-preference");
  const original = (await current(page)).reading;
  for (const engine of singleEngines) {
    const scene = page.getByTestId(`engine-reveal-${engine}`);
    const card = page.getByTestId(`result-${engine}`);
    await expect(scene).toHaveAttribute("data-state", "ready");
    expect(await runningAnimations(scene)).toBe(0);
    await page.getByTestId(`reveal-${engine}`).click();
    await expect(scene).toHaveAttribute("data-state", "playing");
    await expect(page.getByTestId(`reveal-${engine}`)).toBeDisabled();
    await expect(page.getByTestId(`reveal-${engine}`)).toHaveAttribute(
      "aria-busy",
      "true",
    );
    await expect(card.locator(".result-reading")).toHaveCount(0);
    await expect(page.getByTestId(`ai-${engine}`)).toHaveCount(0);
    expect(await runningAnimations(scene)).toBeGreaterThan(0);
    await expect(card.locator(".result-reading")).toBeVisible();
    await expect(page.getByTestId(`ai-${engine}`)).toBeVisible();
    expect((await current(page)).reading).toEqual(original);
  }
});

test("rune stones visibly pry open one at a time before their symbols and reading appear", async ({
  page,
}) => {
  await start(page, "no-preference");
  const original = (await current(page)).reading;
  const raw = original.results.find((result) => result.engine === "runes")?.raw;
  if (raw?.kind !== "runes") throw new Error("Expected frozen rune stones");
  const card = page.getByTestId("result-runes");
  for (let index = 0; index < 3; index++) {
    const rune = RUNES.find((value) => value.id === raw.runes[index].id)!;
    const slot = page.getByTestId(`rune-slot-${index}`);
    await expect(slot).toHaveAttribute("data-state", "covered");
    await expect(slot.getByText(rune.name, { exact: true })).toHaveCount(0);
    await expect(slot.getByText(rune.symbol, { exact: true })).toHaveCount(0);
  }
  for (const index of [0, 2, 1]) {
    const slot = page.getByTestId(`rune-slot-${index}`);
    const rune = RUNES.find((value) => value.id === raw.runes[index].id)!;
    await page
      .getByTestId(`rune-reveal-${index}`)
      .press(index === 0 ? "Space" : "Enter");
    await expect(slot).toHaveAttribute("data-state", "opening");
    await expect(slot).toHaveAttribute("data-revealed", "false");
    await expect(slot.locator(".rune-prybar")).toBeVisible();
    expect(await runningAnimations(slot)).toBeGreaterThan(0);
    await expect(slot.getByText(rune.symbol, { exact: true })).toHaveCount(0);
    await expect(slot).toHaveAttribute("data-revealed", "true");
    await expect(slot.getByText(rune.symbol, { exact: true })).toBeVisible();
    await expect(slot.getByText(rune.name, { exact: true })).toBeVisible();
    await expect(page.getByTestId(`rune-reveal-${index}`)).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    if (index !== 1) {
      await expect(card.locator(".result-reading")).toHaveCount(0);
      await expect(page.getByTestId("ai-runes")).toHaveCount(0);
    }
    expect((await current(page)).reading).toEqual(original);
  }
  await expect(card.locator(".result-reading")).toBeVisible();
  await expect(page.getByTestId("ai-runes")).toBeVisible();
  expect((await current(page)).runeRevealed?.toSorted()).toEqual([0, 1, 2]);
});

test("scoped skip and global pause finish only the reveal the user has activated", async ({
  page,
}) => {
  await start(page, "no-preference");
  const original = (await current(page)).reading;
  await page.getByTestId("reveal-iching").click();
  await page
    .getByTestId("result-iching")
    .getByRole("button", { name: "跳过揭晓动画", exact: true })
    .click();
  await expect(
    page.getByTestId("result-iching").locator(".result-reading"),
  ).toBeVisible();
  await expect(page.getByTestId("reveal-meihua")).toBeVisible();
  await page.getByTestId("reveal-meihua").click();
  await expect(page.getByTestId("engine-reveal-meihua")).toHaveAttribute(
    "data-state",
    "playing",
  );
  await page.getByTestId("reveal-numerology").click();
  await expect(page.getByTestId("engine-reveal-meihua")).toHaveAttribute(
    "data-state",
    "playing",
  );
  await expect(page.getByTestId("engine-reveal-numerology")).toHaveAttribute(
    "data-state",
    "playing",
  );
  const pause = page.getByRole("button", { name: "暂停动态效果", exact: true });
  await pause.click();
  await expect(
    page.getByTestId("result-meihua").locator(".result-reading"),
  ).toBeVisible({ timeout: 750 });
  await expect(
    page.getByTestId("result-numerology").locator(".result-reading"),
  ).toBeVisible({ timeout: 750 });
  expect((await current(page)).engineRevealed?.toSorted()).toEqual([
    ...singleEngines,
  ]);
  await page.getByTestId("rune-reveal-0").click();
  await expect(page.getByTestId("rune-slot-0")).toHaveAttribute(
    "data-revealed",
    "true",
    { timeout: 750 },
  );
  await expect(page.getByTestId("rune-slot-1")).toHaveAttribute(
    "data-revealed",
    "false",
  );
  await pause.click();
  await page.getByTestId("rune-reveal-1").click();
  await page
    .getByTestId("rune-slot-1")
    .getByRole("button", { name: "跳过第 2 枚卢恩揭晓动画", exact: true })
    .click();
  await expect(page.getByTestId("rune-slot-1")).toHaveAttribute(
    "data-revealed",
    "true",
  );
  await expect(page.getByTestId("rune-slot-2")).toHaveAttribute(
    "data-revealed",
    "false",
  );
  await page.getByTestId("rune-reveal-2").click();
  await expect(page.getByTestId("rune-slot-2")).toHaveAttribute(
    "data-state",
    "opening",
  );
  await pause.click();
  await expect(page.getByTestId("rune-slot-2")).toHaveAttribute(
    "data-revealed",
    "true",
    { timeout: 750 },
  );
  await expect
    .poll(() => runningAnimations(page.locator(".app-shell")))
    .toBe(0);
  expect((await current(page)).reading).toEqual(original);
});

test("partial progress across different engines survives saving, sorting, refresh and history", async ({
  page,
}) => {
  await start(page);
  const original = (await current(page)).reading;
  await revealEngine(page, "iching");
  await page.getByTestId("rune-reveal-1").click();
  await page.getByTestId("tarot-reveal-1").click();
  await page
    .getByTestId("result-meihua")
    .getByRole("button", { name: "置顶体系" })
    .click();
  await page.getByRole("button", { name: "保存本次", exact: true }).click();
  const partial = await current(page);
  expect(partial.engineRevealed).toEqual(["iching"]);
  expect(partial.runeRevealed).toEqual([1]);
  expect(partial.tarotRevealed).toEqual([1]);
  await page.getByRole("button", { name: "方法与知识", exact: true }).click();
  await page.getByRole("button", { name: "问一件事", exact: true }).click();
  await page.reload();
  await expect(
    page.getByTestId("result-iching").locator(".result-reading"),
  ).toBeVisible();
  await expect(page.getByTestId("reveal-meihua")).toBeVisible();
  await expect(page.getByTestId("rune-slot-1")).toHaveAttribute(
    "data-revealed",
    "true",
  );
  await expect(page.getByTestId("rune-slot-0")).toHaveAttribute(
    "data-revealed",
    "false",
  );
  expect((await current(page)).reading).toEqual(original);
  expect((await current(page)).engineRevealed).toEqual(partial.engineRevealed);
  expect((await current(page)).runeRevealed).toEqual(partial.runeRevealed);
  await page.getByRole("button", { name: /本机记录/ }).click();
  await page.getByRole("button", { name: "打开原记录" }).click();
  await expect(page.getByTestId("rune-slot-1")).toHaveAttribute(
    "data-revealed",
    "true",
  );
  await revealAll(page);
  const saved = await page.evaluate(
    () =>
      JSON.parse(
        localStorage.getItem("zhongbu-history-v1")!,
      )[0] as SavedReading,
  );
  expect(saved.engineRevealed?.toSorted()).toEqual([...singleEngines]);
  expect(saved.runeRevealed?.toSorted()).toEqual([0, 1, 2]);
  expect(saved.reading).toEqual(original);
  await page.getByRole("button", { name: /再问一次/ }).click();
  await page.getByRole("button", { name: "开启这次探索" }).click();
  await expect(page.getByTestId("result-tarot")).toBeVisible();
  expect((await current(page)).engineRevealed).toEqual([]);
  expect((await current(page)).runeRevealed).toEqual([]);
});

test("legacy engine progress defaults open while existing tarot progress stays partial", async ({
  page,
}) => {
  await start(page);
  const original = (await current(page)).reading;
  await page.getByTestId("tarot-reveal-0").click();
  await page.evaluate(() => {
    const saved = JSON.parse(sessionStorage.getItem("zhongbu-active-v1")!);
    delete saved.engineRevealed;
    delete saved.runeRevealed;
    sessionStorage.setItem("zhongbu-active-v1", JSON.stringify(saved));
  });
  await page.reload();
  for (const engine of [...singleEngines, "runes"] as const) {
    await expect(
      page.getByTestId(`result-${engine}`).locator(".result-reading"),
    ).toBeVisible();
    await expect(page.getByTestId(`ai-${engine}`)).toBeVisible();
  }
  for (let index = 0; index < 3; index++)
    await expect(page.getByTestId(`rune-slot-${index}`)).toHaveAttribute(
      "data-revealed",
      "true",
    );
  await expect(page.getByTestId("tarot-slot-0")).toHaveAttribute(
    "data-revealed",
    "true",
  );
  await expect(page.getByTestId("tarot-slot-1")).toHaveAttribute(
    "data-revealed",
    "false",
  );
  await expect(
    page.getByRole("button", { name: "规则汇总", exact: true }),
  ).toBeDisabled();
  await revealTarot(page);
  await expect(
    page.getByRole("button", { name: "规则汇总", exact: true }),
  ).toBeEnabled();
  expect((await current(page)).reading).toEqual(original);
});
