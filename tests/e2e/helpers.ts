import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

export async function revealTarot(page: Page) {
  await expect(page.getByTestId("result-tarot")).toBeVisible();
  for (let index = 0; index < 3; index++) {
    const slot = page.getByTestId(`tarot-slot-${index}`);
    if ((await slot.getAttribute("data-revealed")) !== "true")
      await page.getByTestId(`tarot-reveal-${index}`).click();
    await expect(slot).toHaveAttribute("data-revealed", "true");
  }
}
