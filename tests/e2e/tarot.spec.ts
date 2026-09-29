import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { TAROT } from "../../src/data/tarot";
import type { SavedReading } from "../../src/types";
import {
  installAlternatingRandom,
  revealAll,
  revealTarot,
  showAll,
  showEngine,
} from "./helpers";

const current = (page: Page) =>
  page.evaluate(
    () =>
      JSON.parse(sessionStorage.getItem("zhongbu-active-v1")!) as SavedReading,
  );
async function start(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "开启这次探索" }).click();
  await expect(page.getByTestId("tarot-deck")).toBeVisible();
}

test("78 real slots map keyboard choices to three distinct frozen cards and unlock tarot only after the third", async ({
  page,
}) => {
  await installAlternatingRandom(page);
  await start(page);
  const before = await current(page);
  const tarot = page.getByTestId("result-tarot");
  expect(before.reading.results.find((r) => r.engine === "tarot")?.status).toBe(
    "pending",
  );
  expect(before.tarotDeck).toHaveLength(78);
  expect(new Set(before.tarotDeck!.map((card) => card.id)).size).toBe(78);
  await expect(page.locator('[data-testid^="tarot-pick-"]')).toHaveCount(78);
  await expect(
    tarot.locator(".deck-inplace-face, .deck-picked-mark"),
  ).toHaveCount(0);
  await expect(
    tarot.locator(".tarot-card-front, .result-reading, .theme-row"),
  ).toHaveCount(0);
  await expect(page.getByTestId("ai-tarot")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "规则汇总", exact: true }),
  ).toBeDisabled();
  await page.getByText("导出 ↓", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "JSON", exact: true }),
  ).toBeDisabled();
  const slots = [7, 24, 77];
  expect(
    new Set(slots.map((slot) => before.tarotDeck![slot].reversed)).size,
  ).toBe(2);
  for (const [order, slot] of slots.entries()) {
    const draw = before.tarotDeck![slot];
    const name = TAROT.find((card) => card.id === draw.id)!.name;
    const button = page.getByTestId(`tarot-pick-${slot}`);
    await button.press(order === 1 ? "Space" : "Enter");
    if (order < 2) {
      await expect(button).toBeDisabled();
      await expect(button).toHaveAttribute("data-selected", "true");
      await expect(button).toHaveAccessibleName(
        `${["现状", "阻力", "提示"][order]}：${name}，${draw.reversed ? "逆位" : "正位"}，已选择`,
      );
      await expect(button.locator(".deck-inplace-face")).toBeVisible();
      await expect(button.locator(".deck-face-name")).toHaveText(name);
      await expect(button.locator(".deck-face-orientation")).toHaveText(
        draw.reversed ? "逆位" : "正位",
      );
      await expect(
        button.locator(".deck-inplace-art .tarot-art"),
      ).toBeVisible();
      expect(
        await button
          .locator(".deck-inplace-art")
          .evaluate((element) => element.classList.contains("is-reversed")),
      ).toBe(draw.reversed);
      await expect(tarot.locator(".deck-picked-mark")).toHaveCount(0);
      await expect(tarot.locator(".deck-inplace-face")).toHaveCount(order + 1);
      await expect(
        page.getByTestId("tarot-pick-1").locator(".deck-inplace-face"),
      ).toHaveCount(0);
      const chosen = page.getByTestId(`tarot-chosen-${order}`);
      await expect(chosen).toHaveAttribute("data-revealed", "true");
      await expect(chosen.getByText(name, { exact: true })).toBeVisible();
      await expect(
        chosen.getByText(draw.reversed ? "逆位" : "正位", { exact: true }),
      ).toBeVisible();
      // Dispatching a second event on a selected slot cannot select it twice.
      await button.dispatchEvent("click");
      expect((await current(page)).tarotPicked).toEqual(
        slots.slice(0, order + 1),
      );
      expect((await current(page)).reading).toEqual(before.reading);
      await expect(page.getByTestId("ai-tarot")).toHaveCount(0);
    }
  }
  const selected = await current(page);
  const result = selected.reading.results.find((r) => r.engine === "tarot")!;
  expect(result.status).toBe("ok");
  expect(result.raw).toEqual({
    kind: "tarot",
    cards: slots.map((slot, index) => ({
      ...before.tarotDeck![slot],
      position: ["现状", "阻力", "提示"][index],
    })),
  });
  expect(selected.reading.readingId).toBe(before.reading.readingId);
  expect(selected.reading.results.filter((r) => r.engine !== "tarot")).toEqual(
    before.reading.results.filter((r) => r.engine !== "tarot"),
  );
  expect(selected.tarotDeck).toEqual(before.tarotDeck);
  await expect(tarot.locator(".tarot-card-front")).toHaveCount(3);
  await expect(tarot.locator(".result-reading")).toBeVisible();
  await expect(page.getByTestId("ai-tarot")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "规则汇总", exact: true }),
  ).toBeDisabled();
  await revealAll(page);
  await expect(
    page.getByRole("button", { name: "规则汇总", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Markdown", exact: true }),
  ).toBeEnabled();
  expect((await current(page)).reading).toEqual(selected.reading);
});

test("partial slot choices survive sorting, refresh and saved history before finalization", async ({
  page,
}) => {
  await start(page);
  const original = await current(page);
  await page.getByTestId("tarot-pick-69").click();
  await page.getByTestId("tarot-pick-2").click();
  await showAll(page);
  await page
    .getByTestId("result-runes")
    .getByRole("button", { name: "置顶体系" })
    .click();
  await expect(page.locator(".result-card").first()).toHaveAttribute(
    "data-testid",
    "result-runes",
  );
  await page.getByRole("button", { name: "保存本次", exact: true }).click();
  await page.getByRole("button", { name: "方法与知识", exact: true }).click();
  await page.getByRole("button", { name: "问一件事", exact: true }).click();
  await page.reload();
  await showEngine(page, "tarot");
  await expect(page.getByTestId("tarot-chosen-1")).toHaveAttribute(
    "data-revealed",
    "true",
  );
  await expect(page.getByTestId("tarot-chosen-2")).toHaveAttribute(
    "data-revealed",
    "false",
  );
  expect((await current(page)).tarotPicked).toEqual([69, 2]);
  expect((await current(page)).tarotDeck).toEqual(original.tarotDeck);
  expect((await current(page)).reading).toEqual(original.reading);
  for (const slot of [69, 2]) {
    const draw = original.tarotDeck![slot];
    const name = TAROT.find((card) => card.id === draw.id)!.name;
    const face = page.getByTestId(`tarot-pick-${slot}`);
    await expect(face.locator(".deck-inplace-face")).toBeVisible();
    await expect(face.locator(".deck-face-name")).toHaveText(name);
    await expect(face.locator(".deck-face-orientation")).toHaveText(
      draw.reversed ? "逆位" : "正位",
    );
  }
  await expect(page.locator(".deck-picked-mark")).toHaveCount(0);
  await page.getByRole("button", { name: /本机记录/ }).click();
  await page.getByRole("button", { name: "打开原记录" }).click();
  await showEngine(page, "tarot");
  await expect(page.getByTestId("tarot-pick-69")).toBeDisabled();
  await page.getByTestId("tarot-pick-55").click();
  await expect(page.getByTestId("ai-tarot")).toBeVisible();
  const final = await current(page);
  const saved = await page.evaluate(
    () =>
      JSON.parse(
        localStorage.getItem("zhongbu-history-v1")!,
      )[0] as SavedReading,
  );
  expect(saved.tarotPicked).toEqual([69, 2, 55]);
  expect(saved.reading).toEqual(final.reading);
  expect(final.reading.readingId).toBe(original.reading.readingId);
  await page.reload();
  await showEngine(page, "tarot");
  await expect(page.getByTestId("ai-tarot")).toBeVisible();
  expect((await current(page)).reading).toEqual(final.reading);
  await page.getByRole("button", { name: /再问一次/ }).click();
  await page.getByRole("button", { name: "开启这次探索" }).click();
  await expect(page.getByTestId("tarot-deck")).toBeVisible();
  expect((await current(page)).tarotPicked).toEqual([]);
  expect((await current(page)).reading.readingId).not.toBe(
    original.reading.readingId,
  );
});

test("legacy complete draws without journey fields remain open without changing their frozen result", async ({
  page,
}) => {
  await start(page);
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
      "tarotRevealed",
      "engineRevealed",
      "runeRevealed",
    ])
      delete saved[field];
    sessionStorage.setItem("zhongbu-active-v1", JSON.stringify(saved));
  });
  await page.reload();
  await showAll(page);
  await expect(page.getByTestId("tarot-deck")).toHaveCount(0);
  await expect(page.getByTestId("coin-ritual")).toHaveCount(0);
  await expect(page.getByTestId("rune-bag")).toHaveCount(0);
  for (const engine of ["tarot", "iching", "meihua", "runes"])
    await expect(page.getByTestId(`ai-${engine}`)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "规则汇总", exact: true }),
  ).toBeEnabled();
  expect((await current(page)).reading).toEqual(original);
});
