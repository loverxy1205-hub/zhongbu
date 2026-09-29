import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import type { EngineId } from "../../src/types";

type RevealOptions = { skipAnimation?: boolean };

export async function revealTarot(page: Page) {
  await expect(page.getByTestId("result-tarot")).toBeVisible();
  for (let index = 0; index < 3; index++) {
    const slot = page.getByTestId(`tarot-slot-${index}`);
    if ((await slot.getAttribute("data-revealed")) !== "true")
      await page.getByTestId(`tarot-reveal-${index}`).click();
    await expect(slot).toHaveAttribute("data-revealed", "true");
  }
}

export async function revealEngine(
  page: Page,
  engine: EngineId,
  { skipAnimation = true }: RevealOptions = {},
) {
  const card = page.getByTestId(`result-${engine}`);
  await expect(card).toBeVisible();
  if ((await card.locator(".unavailable").count()) > 0) return;
  if (engine === "tarot") return revealTarot(page);
  if (engine === "runes") {
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
  await expect(page.locator(".result-card").first()).toBeVisible();
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
