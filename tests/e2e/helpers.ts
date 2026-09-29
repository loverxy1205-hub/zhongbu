import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import type { EngineId } from "../../src/types";

type RevealOptions = { skipAnimation?: boolean };

export async function revealTarot(page: Page) {
  await showEngine(page, "tarot");
  if (await page.getByTestId("tarot-deck").count()) {
    for (const slot of [7, 39, 77]) {
      const pick = page.getByTestId(`tarot-pick-${slot}`);
      if ((await pick.count()) && (await pick.isEnabled())) await pick.click();
    }
    // A restored partial draw may already contain one of the default slots.
    while (await page.getByTestId("tarot-deck").count())
      await page
        .locator('[data-testid^="tarot-pick-"]:enabled')
        .first()
        .click();
  }
  for (let index = 0; index < 3; index++) {
    const slot = page.getByTestId(`tarot-slot-${index}`);
    if ((await slot.getAttribute("data-revealed")) !== "true")
      await page.getByTestId(`tarot-reveal-${index}`).click();
    await expect(slot).toHaveAttribute("data-revealed", "true");
  }
}

export async function showEngine(page: Page, engine: EngineId) {
  if (!(await page.getByTestId(`result-${engine}`).count()))
    await page.getByTestId(`chapter-${engine}`).click();
  await expect(page.getByTestId(`result-${engine}`)).toBeVisible();
}

export async function showAll(page: Page) {
  await expect(page.locator(".result-card").first()).toBeVisible();
  await page.getByRole("button", { name: "查看全部", exact: true }).click();
}

export async function drawRunes(page: Page, skipAnimation = true) {
  await showEngine(page, "runes");
  while (await page.getByTestId("rune-bag-draw").count()) {
    const count = Number(
      await page.getByTestId("rune-bag").getAttribute("data-drawn-count"),
    );
    await page.getByTestId("rune-bag-draw").click();
    const skip = page.getByRole("button", {
      name: "跳过取石动画",
      exact: true,
    });
    if (skipAnimation && (await skip.isVisible())) await skip.click();
    await expect(page.getByTestId("rune-bag")).toHaveAttribute(
      "data-drawn-count",
      String(count + 1),
    );
  }
}

export async function revealEngine(
  page: Page,
  engine: EngineId,
  { skipAnimation = true }: RevealOptions = {},
) {
  await showEngine(page, engine);
  const card = page.getByTestId(`result-${engine}`);
  if ((await card.locator(".unavailable").count()) > 0) return;
  if (engine === "tarot") return revealTarot(page);
  if (engine === "runes") {
    await drawRunes(page, skipAnimation);
    for (let index = 0; index < 3; index++) {
      const slot = page.getByTestId(`rune-slot-${index}`);
      if ((await slot.getAttribute("data-revealed")) !== "true") {
        await page.getByTestId(`rune-reveal-${index}`).click();
        const skip = slot.getByRole("button", {
          name: `跳过第 ${index + 1} 枚卢恩揭晓动画`,
          exact: true,
        });
        if (skipAnimation && (await skip.isVisible())) await skip.click();
      }
      await expect(slot).toHaveAttribute("data-revealed", "true");
    }
  } else if (
    engine === "iching" &&
    (await page.getByTestId("coin-ritual").count())
  ) {
    let count = Number(
      await page.getByTestId("coin-ritual").getAttribute("data-rounds"),
    );
    while (count < 6) {
      await page.getByTestId("coin-round-trigger").click();
      const skip = card.getByRole("button", {
        name: "跳过本轮动画",
        exact: true,
      });
      if (skipAnimation && (await skip.isVisible())) await skip.click();
      await expect(page.getByTestId("coin-ritual")).toHaveAttribute(
        "data-rounds",
        String(++count),
      );
    }
  } else if ((await card.locator(".result-reading").count()) === 0) {
    await page.getByTestId(`reveal-${engine}`).click();
    const skip = card.getByRole("button", {
      name: "跳过揭晓动画",
      exact: true,
    });
    if (skipAnimation && (await skip.isVisible())) await skip.click();
  }
  await expect(card.locator(".result-reading")).toBeVisible();
}

export async function revealAll(page: Page, options: RevealOptions = {}) {
  await showAll(page);
  for (const engine of [
    "tarot",
    "iching",
    "meihua",
    "numerology",
    "runes",
  ] as const)
    if ((await page.getByTestId(`result-${engine}`).count()) > 0)
      await revealEngine(page, engine, options);
}
