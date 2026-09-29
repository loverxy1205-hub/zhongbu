import { test, expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { RUNES } from "../../src/data/runes";
import type { SavedReading } from "../../src/types";
import {
  drawRunes,
  installAlternatingRandom,
  revealAll,
  revealEngine,
  revealTarot,
  showAll,
} from "./helpers";

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
async function expectCoinFaces(page: Page, values: readonly number[]) {
  for (const [index, value] of values.entries()) {
    const face = page.getByTestId(`coin-face-${index}`);
    await expect(face).toHaveAttribute("data-value", String(value));
    await expect(face).toHaveAttribute(
      "data-side",
      value === 3 ? "yang" : "yin",
    );
    const normal = await face
      .locator(".coin-spinner")
      .evaluate(
        (element) =>
          new DOMMatrixReadOnly(getComputedStyle(element).transform).m33,
      );
    // The coins rest at a slight decorative tilt; the normal still faces
    // forward for yang and backward for yin instead of remaining edge-on.
    expect(Math.sign(normal)).toBe(value === 3 ? 1 : -1);
    expect(Math.abs(normal)).toBeGreaterThan(0.9);
    await expect(
      page
        .getByTestId("coin-round-result")
        .locator(`.coin-values > span`)
        .nth(index),
    ).toHaveAttribute("data-side", value === 3 ? "yang" : "yin");
  }
}
async function start(
  page: Page,
  reducedMotion: "reduce" | "no-preference" = "reduce",
  birthday = true,
) {
  await page.emulateMedia({ reducedMotion });
  await page.goto("/");
  if (birthday) await page.getByLabel("出生日期").fill("1998-06-15");
  await page.getByRole("button", { name: "开启这次探索" }).click();
  await showAll(page);
}

test("all engines independently reveal their frozen results before unlocking their own AI and exports", async ({
  page,
}) => {
  await start(page);
  const before = await current(page);
  expect(before.coinRounds).toBe(0);
  expect(before.runeDrawn).toBe(0);
  for (const engine of ["meihua", "numerology"]) {
    await expect(
      page.getByTestId(`result-${engine}`).locator(".result-reading"),
    ).toHaveCount(0);
    await expect(page.getByTestId(`ai-${engine}`)).toHaveCount(0);
    await expect(page.getByTestId(`reveal-${engine}`)).toBeVisible();
  }
  expect(
    before.reading.results.find((r) => r.engine === "numerology")?.raw?.kind,
  ).toBe("numerology-matrix");
  for (const engine of ["tarot", "iching", "runes"])
    await expect(page.getByTestId(`ai-${engine}`)).toHaveCount(0);
  await page.getByText("导出 ↓", { exact: true }).click();
  for (const name of ["JSON", "Markdown", "规则汇总", "我的偏好汇总"])
    await expect(
      page.getByRole("button", { name, exact: true }),
    ).toBeDisabled();
  await revealEngine(page, "iching");
  await expect(page.getByTestId("ai-iching")).toBeVisible();
  await expect(page.getByTestId("ai-runes")).toHaveCount(0);
  await revealEngine(page, "runes");
  await expect(page.getByTestId("ai-runes")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "规则汇总", exact: true }),
  ).toBeDisabled();
  expect((await current(page)).reading).toEqual(before.reading);
  await page.getByTestId("reveal-meihua").press("Enter");
  await expect(
    page.getByTestId("result-meihua").locator(".result-reading"),
  ).toBeVisible({ timeout: 750 });
  await expect(page.getByTestId("ai-meihua")).toBeVisible();
  await expect(page.getByTestId("ai-numerology")).toHaveCount(0);
  await page.getByTestId("reveal-numerology").press("Space");
  await expect(page.getByTestId("number-matrix")).toBeVisible({ timeout: 750 });
  await revealTarot(page);
  for (const name of ["JSON", "Markdown", "规则汇总", "我的偏好汇总"])
    await expect(page.getByRole("button", { name, exact: true })).toBeEnabled();
  expect(
    (await current(page)).reading.results.filter((r) => r.engine !== "tarot"),
  ).toEqual(before.reading.results.filter((r) => r.engine !== "tarot"));
});

for (const engine of ["meihua", "numerology"] as const) {
  for (const completion of ["natural", "skip"] as const) {
    test(`${engine} ${completion} completion reveals only its frozen result and restores progress`, async ({
      page,
    }) => {
      await start(page, "no-preference");
      const original = (await current(page)).reading;
      const card = page.getByTestId(`result-${engine}`);
      const scene = page.getByTestId(`engine-reveal-${engine}`);
      await expect(scene).toHaveAttribute("data-state", "ready");
      expect(await runningAnimations(scene)).toBe(0);
      if (engine === "numerology") {
        await expect(page.getByTestId("number-matrix")).toHaveCount(0);
        await expect(scene.locator(".reveal-number-wheel text")).toHaveText([
          "1",
          "2",
          "3",
          "4",
          "5",
          "6",
          "7",
          "8",
          "9",
        ]);
      }
      await page.getByTestId(`reveal-${engine}`).press("Enter");
      await expect(scene).toHaveAttribute("data-state", "playing");
      await expect(page.getByTestId(`reveal-${engine}`)).toHaveAttribute(
        "aria-busy",
        "true",
      );
      await expect(page.getByTestId(`reveal-${engine}`)).toBeDisabled();
      await page.getByTestId(`reveal-${engine}`).dispatchEvent("click");
      expect(await runningAnimations(scene)).toBeGreaterThan(0);
      await expect(card.locator(".result-reading")).toHaveCount(0);
      await expect(page.getByTestId(`ai-${engine}`)).toHaveCount(0);
      if (completion === "skip")
        await card
          .getByRole("button", { name: "跳过揭晓动画", exact: true })
          .press("Enter");
      await expect(card.locator(".result-reading")).toBeVisible();
      await expect(page.getByTestId(`ai-${engine}`)).toBeVisible();
      expect((await current(page)).engineRevealed).toEqual([engine]);
      expect((await current(page)).reading).toEqual(original);
      await page.reload();
      await showAll(page);
      await expect(page.getByTestId(`reveal-${engine}`)).toHaveCount(0);
      await expect(card.locator(".result-reading")).toBeVisible();
      expect((await current(page)).reading).toEqual(original);
    });
  }
}

test("pausing simultaneous plum and number reveals preserves both completions without recalculating", async ({
  page,
}) => {
  await start(page, "no-preference");
  const original = (await current(page)).reading;
  await page.evaluate(() => {
    for (const engine of ["meihua", "numerology"])
      (
        document.querySelector(
          `[data-testid="reveal-${engine}"]`,
        ) as HTMLButtonElement
      ).click();
  });
  for (const engine of ["meihua", "numerology"])
    await expect(page.getByTestId(`engine-reveal-${engine}`)).toHaveAttribute(
      "data-state",
      "playing",
    );
  await page.getByRole("button", { name: "暂停动态效果", exact: true }).click();
  for (const engine of ["meihua", "numerology"])
    await expect(
      page.getByTestId(`result-${engine}`).locator(".result-reading"),
    ).toBeVisible({ timeout: 750 });
  expect((await current(page)).engineRevealed?.toSorted()).toEqual([
    "meihua",
    "numerology",
  ]);
  expect((await current(page)).coinRounds).toBe(0);
  expect((await current(page)).runeDrawn).toBe(0);
  expect((await current(page)).tarotPicked).toEqual([]);
  expect((await current(page)).reading).toEqual(original);
  await expect
    .poll(() => runningAnimations(page.locator(".app-shell")))
    .toBe(0);
  await page.reload();
  await showAll(page);
  for (const engine of ["meihua", "numerology"])
    await expect(page.getByTestId(`reveal-${engine}`)).toHaveCount(0);
  expect((await current(page)).reading).toEqual(original);
});

test("six deliberate coin rounds reveal actual values bottom to top and skip advances only one round", async ({
  page,
}) => {
  await installAlternatingRandom(page);
  await start(page, "no-preference");
  const original = (await current(page)).reading;
  const raw = original.results.find((r) => r.engine === "iching")?.raw;
  if (raw?.kind !== "iching") throw Error("Expected coin raw");
  const card = page.getByTestId("result-iching");
  const scene = page.getByTestId("coin-ritual");
  expect(new Set(raw.coins.flat()).size).toBe(2);
  expect(await runningAnimations(scene)).toBe(0);
  await expect(card.locator(".coin-face-legend")).toContainText("阳（3）");
  await expect(card.locator(".coin-face-legend")).toContainText("阴（2）");
  for (let index = 0; index < 3; index++) {
    const face = page.getByTestId(`coin-face-${index}`);
    await expect(face).toHaveAttribute("data-side", "preview");
    expect(await face.getAttribute("data-value")).toBeNull();
    expect(
      (
        await face.locator('[data-coin-face="yang"] text').allTextContents()
      ).join(""),
    ).toBe("乾隆通宝");
    await expect(face.locator('[data-coin-face="yin"] text')).toHaveCount(0);
    await expect(face.locator('[data-coin-face="yang"]')).toHaveCSS(
      "backface-visibility",
      "hidden",
    );
    await expect(face.locator('[data-coin-face="yin"]')).toHaveCSS(
      "backface-visibility",
      "hidden",
    );
  }
  for (let index = 0; index < 6; index++) {
    const trigger = page.getByTestId("coin-round-trigger");
    await trigger.press(index % 2 ? "Space" : "Enter");
    await expect(trigger).toBeDisabled();
    await expect(trigger).toHaveAttribute("aria-busy", "true");
    await trigger.dispatchEvent("click");
    await expect(page.getByTestId(`coin-line-${index}`)).toHaveAttribute(
      "data-revealed",
      "false",
    );
    expect(await runningAnimations(scene)).toBeGreaterThan(0);
    for (let coin = 0; coin < 3; coin++) {
      await expect(page.getByTestId(`coin-face-${coin}`)).toHaveAttribute(
        "data-side",
        "tossing",
      );
      expect(
        await page.getByTestId(`coin-face-${coin}`).getAttribute("data-value"),
      ).toBeNull();
    }
    if (index > 0) {
      const skip = card.getByRole("button", {
        name: "跳过本轮动画",
        exact: true,
      });
      await expect(skip).toBeVisible();
      // Keyboard activation does not wait for a transient button to stop moving.
      await skip.press("Enter");
    }
    await expect(scene).toHaveAttribute("data-rounds", String(index + 1));
    await expect(page.getByTestId(`coin-line-${index}`)).toHaveAttribute(
      "data-revealed",
      "true",
    );
    await expect(page.getByTestId(`coin-line-${index}`)).toHaveAttribute(
      "aria-label",
      new RegExp(`爻值 ${raw.values[index]}`),
    );
    await expect(page.getByTestId("coin-round-result")).toContainText(
      `= ${raw.values[index]}`,
    );
    await expectCoinFaces(page, raw.coins[index]);
    if (index < 5) {
      await expect(page.getByTestId(`coin-line-${index + 1}`)).toHaveAttribute(
        "data-revealed",
        "false",
      );
      await expect(card.locator(".result-reading")).toHaveCount(0);
      await expect(page.getByTestId("ai-iching")).toHaveCount(0);
    }
    expect((await current(page)).reading).toEqual(original);
  }
  await expect(page.getByTestId("coin-round-trigger")).toBeDisabled();
  await expect(card.locator(".result-reading")).toBeVisible();
  await expect(page.getByTestId("ai-iching")).toBeVisible();
  await page.reload();
  await showAll(page);
  await expect(page.getByTestId("coin-ritual")).toHaveAttribute(
    "data-rounds",
    "6",
  );
  await expectCoinFaces(page, raw.coins[5]);
  expect((await current(page)).reading).toEqual(original);
});

test("runes leave the bag in three steps then pry open individually without exposing symbols early", async ({
  page,
}) => {
  await start(page, "no-preference");
  const original = (await current(page)).reading;
  const raw = original.results.find((r) => r.engine === "runes")?.raw;
  if (raw?.kind !== "runes") throw Error("Expected runes");
  const card = page.getByTestId("result-runes");
  for (let index = 0; index < 3; index++) {
    await expect(card.locator(".rune-engraving")).toHaveCount(0);
    await expect(page.locator('[data-testid^="rune-reveal-"]')).toHaveCount(0);
    await page
      .getByTestId("rune-bag-draw")
      .press(index % 2 ? "Space" : "Enter");
    await expect(page.getByTestId("rune-bag-draw")).toHaveAttribute(
      "aria-busy",
      "true",
    );
    await expect(page.getByTestId("rune-bag-draw")).toBeDisabled();
    expect(
      await runningAnimations(page.getByTestId("rune-bag")),
    ).toBeGreaterThan(0);
    await card
      .getByRole("button", { name: "跳过取石动画", exact: true })
      .press("Enter");
    await expect(page.getByTestId("rune-bag")).toHaveAttribute(
      "data-drawn-count",
      String(index + 1),
    );
  }
  for (const index of [0, 2, 1]) {
    const rune = RUNES.find((value) => value.id === raw.runes[index].id)!;
    const slot = page.getByTestId(`rune-slot-${index}`);
    await expect(slot.getByText(rune.name, { exact: true })).toHaveCount(0);
    await expect(slot.getByText(rune.symbol, { exact: true })).toHaveCount(0);
    await page
      .getByTestId(`rune-reveal-${index}`)
      .press(index === 0 ? "Space" : "Enter");
    await expect(slot).toHaveAttribute("data-state", "opening");
    await expect(slot.locator(".rune-prybar")).toBeVisible();
    expect(await runningAnimations(slot)).toBeGreaterThan(0);
    await expect(slot.getByText(rune.symbol, { exact: true })).toHaveCount(0);
    await expect(slot).toHaveAttribute("data-revealed", "true");
    await expect(slot.getByText(rune.symbol, { exact: true })).toBeVisible();
    await expect(slot.getByText(rune.name, { exact: true })).toBeVisible();
    if (index !== 1) await expect(page.getByTestId("ai-runes")).toHaveCount(0);
    expect((await current(page)).reading).toEqual(original);
  }
  await expect(page.getByTestId("ai-runes")).toBeVisible();
});

test("pausing concurrent coin and bag animations retains both steps and only opens activated stones", async ({
  page,
}) => {
  await start(page, "no-preference");
  const original = (await current(page)).reading;
  await page.evaluate(() => {
    (
      document.querySelector(
        '[data-testid="coin-round-trigger"]',
      ) as HTMLButtonElement
    ).click();
    (
      document.querySelector(
        '[data-testid="rune-bag-draw"]',
      ) as HTMLButtonElement
    ).click();
  });
  await expect(page.getByTestId("coin-round-trigger")).toHaveAttribute(
    "aria-busy",
    "true",
  );
  await expect(page.getByTestId("rune-bag-draw")).toHaveAttribute(
    "aria-busy",
    "true",
  );
  const pause = page.getByRole("button", { name: "暂停动态效果", exact: true });
  await pause.click();
  await expect(page.getByTestId("coin-ritual")).toHaveAttribute(
    "data-rounds",
    "1",
  );
  const coins = original.results.find(
    (result) => result.engine === "iching",
  )?.raw;
  if (coins?.kind !== "iching") throw Error("Expected coin raw");
  await expectCoinFaces(page, coins.coins[0]);
  await expect(page.getByTestId("rune-bag")).toHaveAttribute(
    "data-drawn-count",
    "1",
  );
  await drawRunes(page);
  await pause.click();
  await page.evaluate(() => {
    for (const index of [0, 1])
      (
        document.querySelector(
          `[data-testid="rune-reveal-${index}"]`,
        ) as HTMLButtonElement
      ).click();
  });
  for (const index of [0, 1])
    await expect(page.getByTestId(`rune-slot-${index}`)).toHaveAttribute(
      "data-state",
      "opening",
    );
  await pause.click();
  for (const index of [0, 1])
    await expect(page.getByTestId(`rune-slot-${index}`)).toHaveAttribute(
      "data-revealed",
      "true",
    );
  await expect(page.getByTestId("rune-slot-2")).toHaveAttribute(
    "data-revealed",
    "false",
  );
  expect((await current(page)).runeRevealed?.toSorted()).toEqual([0, 1]);
  await expect
    .poll(() => runningAnimations(page.locator(".app-shell")))
    .toBe(0);
  expect((await current(page)).reading).toEqual(original);
});

test("partial coin, bag and chosen-slot progress survives refresh and saved history", async ({
  page,
}) => {
  await start(page);
  const original = await current(page);
  for (let index = 0; index < 2; index++)
    await page.getByTestId("coin-round-trigger").click();
  await page.getByTestId("rune-bag-draw").click();
  await page.getByTestId("tarot-pick-19").click();
  await page.getByRole("button", { name: "保存本次", exact: true }).click();
  await page.reload();
  await showAll(page);
  await expect(page.getByTestId("coin-ritual")).toHaveAttribute(
    "data-rounds",
    "2",
  );
  await expect(page.getByTestId("rune-bag")).toHaveAttribute(
    "data-drawn-count",
    "1",
  );
  await expect(page.getByTestId("tarot-pick-19")).toBeDisabled();
  expect((await current(page)).reading).toEqual(original.reading);
  await page.getByRole("button", { name: /本机记录/ }).click();
  await page.getByRole("button", { name: "打开原记录" }).click();
  await showAll(page);
  await expect(page.getByTestId("coin-ritual")).toHaveAttribute(
    "data-rounds",
    "2",
  );
  await drawRunes(page);
  await page.getByTestId("rune-reveal-1").click();
  await page.reload();
  await showAll(page);
  await expect(page.getByTestId("rune-slot-1")).toHaveAttribute(
    "data-revealed",
    "true",
  );
  await expect(page.getByTestId("rune-slot-0")).toHaveAttribute(
    "data-revealed",
    "false",
  );
  await revealAll(page);
  const final = await current(page);
  const saved = await page.evaluate(
    () =>
      JSON.parse(
        localStorage.getItem("zhongbu-history-v1")!,
      )[0] as SavedReading,
  );
  expect(saved.coinRounds).toBe(6);
  expect(saved.runeDrawn).toBe(3);
  expect(saved.runeRevealed?.toSorted()).toEqual([0, 1, 2]);
  expect(saved.reading).toEqual(final.reading);
  expect(final.reading.results.filter((r) => r.engine !== "tarot")).toEqual(
    original.reading.results.filter((r) => r.engine !== "tarot"),
  );
});

test("legacy progress keeps partial tarot visible without inventing new coin rounds or bag draws", async ({
  page,
}) => {
  await start(page, "reduce", false);
  await revealTarot(page);
  const original = (await current(page)).reading;
  await page.evaluate(() => {
    const saved = JSON.parse(sessionStorage.getItem("zhongbu-active-v1")!);
    for (const field of [
      "tarotDeck",
      "tarotPicked",
      "coinRounds",
      "runeDrawn",
      "activeEngine",
      "engineRevealed",
      "runeRevealed",
    ])
      delete saved[field];
    saved.tarotRevealed = [0];
    sessionStorage.setItem("zhongbu-active-v1", JSON.stringify(saved));
  });
  await page.reload();
  await showAll(page);
  for (const engine of ["iching", "meihua", "runes"])
    await expect(page.getByTestId(`ai-${engine}`)).toBeVisible();
  await expect(page.getByTestId("tarot-slot-0")).toHaveAttribute(
    "data-revealed",
    "true",
  );
  await expect(page.getByTestId("tarot-slot-1")).toHaveAttribute(
    "data-revealed",
    "false",
  );
  await expect(page.getByTestId("coin-ritual")).toHaveCount(0);
  await expect(page.getByTestId("rune-bag")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "规则汇总", exact: true }),
  ).toBeDisabled();
  await revealTarot(page);
  await expect(
    page.getByRole("button", { name: "规则汇总", exact: true }),
  ).toBeEnabled();
  expect((await current(page)).reading).toEqual(original);
});
