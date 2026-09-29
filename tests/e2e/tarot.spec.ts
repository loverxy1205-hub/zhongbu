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
async function start(
  page: Page,
  reducedMotion: "reduce" | "no-preference" = "reduce",
) {
  await page.emulateMedia({ reducedMotion });
  await page.goto("/");
  await page.getByRole("button", { name: "开启这次探索" }).click();
  await expect(page.getByTestId("tarot-deck")).toBeVisible();
}

async function expectChosenArt(
  page: Page,
  order: number,
  draw: { id: string; reversed: boolean },
) {
  const chosen = page.getByTestId(`tarot-chosen-${order}`);
  const face = chosen.locator(".deck-preview-face");
  const art = face.locator(".tarot-art");
  await expect(face).toBeVisible();
  await expect(art).toBeVisible();
  await expect(art).toHaveAttribute("data-decoration-id", draw.id);
  await expect(chosen.locator(".deck-preview-back")).toHaveCount(0);
  expect(
    await face.evaluate((element) => element.classList.contains("is-reversed")),
  ).toBe(draw.reversed);
  const rotation = await art.evaluate((element) => {
    const transform = getComputedStyle(element).transform;
    return transform === "none" ? 1 : new DOMMatrix(transform).m11;
  });
  expect(rotation).toBeCloseTo(draw.reversed ? -1 : 1);
  expect(
    await art
      .locator(":scope > text")
      .evaluateAll((labels) =>
        labels.every((label) => getComputedStyle(label).display === "none"),
      ),
  ).toBe(true);
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
  for (let order = 0; order < 3; order++) {
    const chosen = page.getByTestId(`tarot-chosen-${order}`);
    await expect(chosen).toHaveAttribute("data-revealed", "false");
    await expect(chosen.locator(".deck-preview-back > svg")).toBeVisible();
    await expect(
      chosen.locator(".tarot-art, [data-decoration-id]"),
    ).toHaveCount(0);
    await expect(chosen.getByText("尚未选牌", { exact: true })).toBeVisible();
  }
  expect(
    await page
      .getByTestId("tarot-galaxy-flow")
      .evaluate(
        (element) =>
          element
            .getAnimations({ subtree: true })
            .filter((a) => a.playState === "running").length,
      ),
  ).toBe(0);
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
      await expect(
        button.locator(".deck-inplace-art .tarot-art"),
      ).toHaveAttribute("data-decoration-id", draw.id);
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
      await expectChosenArt(page, order, draw);
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
  await expect(page.getByTestId("tarot-deck")).toHaveCount(0);
  await expect(tarot.locator(".tarot-card-front")).toHaveCount(3);
  for (const [order, slot] of slots.entries()) {
    const draw = before.tarotDeck![slot];
    const card = page.getByTestId(`tarot-slot-${order}`);
    await expect(card.locator(".tarot-art")).toHaveAttribute(
      "data-decoration-id",
      draw.id,
    );
    expect(
      await card
        .locator(".tarot-card-front")
        .evaluate((element) => element.classList.contains("reversed")),
    ).toBe(draw.reversed);
  }
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
  for (const [order, slot] of [69, 2].entries()) {
    const draw = original.tarotDeck![slot];
    const name = TAROT.find((card) => card.id === draw.id)!.name;
    const face = page.getByTestId(`tarot-pick-${slot}`);
    await expect(face.locator(".deck-inplace-face")).toBeVisible();
    await expect(face.locator(".deck-face-name")).toHaveText(name);
    await expect(face.locator(".deck-face-orientation")).toHaveText(
      draw.reversed ? "逆位" : "正位",
    );
    await expectChosenArt(page, order, draw);
  }
  await expect(
    page.getByTestId("tarot-chosen-2").locator(".deck-preview-back > svg"),
  ).toBeVisible();
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

test("galaxy motion leaves all real slots stable and clickable, stops on pause or reduced motion, and consumes no entropy", async ({
  page,
}) => {
  await page.addInitScript(() => {
    let word = 0;
    Object.defineProperty(crypto, "getRandomValues", {
      value: (buffer: Uint32Array<ArrayBuffer>) => {
        document.documentElement.dataset.randomCalls = String(
          Number(document.documentElement.dataset.randomCalls || "0") + 1,
        );
        for (let index = 0; index < buffer.length; index++)
          buffer[index] = word++ % 2;
        return buffer;
      },
    });
  });
  await start(page, "no-preference");
  const original = await current(page);
  await expect(page.locator("html")).toHaveAttribute(
    "data-random-calls",
    "181",
  );
  const flow = page.getByTestId("tarot-galaxy-flow");
  await expect(flow).toHaveAttribute("aria-hidden", "true");
  expect(
    await flow.evaluate((element) =>
      [element, ...element.querySelectorAll("*")].every(
        (part) => getComputedStyle(part).pointerEvents === "none",
      ),
    ),
  ).toBe(true);
  await page.evaluate(async () => {
    // Let the result card's one-time entrance settle before measuring the pool.
    await Promise.allSettled(
      document
        .getAnimations()
        .filter(
          (animation) =>
            animation.effect?.getComputedTiming().iterations !== Infinity,
        )
        .map((animation) => animation.finished),
    );
  });
  const first = page.getByTestId("tarot-pick-0");
  await first.scrollIntoViewIfNeeded();
  await first.hover();
  const samples = await page
    .getByTestId("tarot-deck-pool")
    .evaluate(async (pool) => {
      const animationLayer = document.querySelector(
        '[data-testid="tarot-galaxy-flow"]',
      )!;
      const animations = animationLayer.getAnimations({ subtree: true });
      const rectangles = () =>
        Array.from(pool.querySelectorAll("button"), (button) => {
          const { x, y, width, height } = button.getBoundingClientRect();
          return { x, y, width, height };
        });
      const before = rectangles();
      const timesBefore = animations.map((animation) =>
        Number(animation.currentTime),
      );
      for (let frame = 0; frame < 8; frame++)
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
      const after = rectangles();
      const { x, y, width, height } = after[0];
      return {
        before,
        after,
        timesBefore,
        timesAfter: animations.map((animation) =>
          Number(animation.currentTime),
        ),
        running: animations.every(
          (animation) => animation.playState === "running",
        ),
        hit: document
          .elementFromPoint(x + width / 2, y + height / 2)
          ?.closest("button")
          ?.getAttribute("data-testid"),
      };
    });
  expect(samples.before).toHaveLength(78);
  expect(samples.timesBefore.length).toBeGreaterThan(0);
  expect(samples.running).toBe(true);
  for (const [index, time] of samples.timesAfter.entries())
    expect(time).toBeGreaterThan(samples.timesBefore[index]);
  for (const [index, rectangle] of samples.after.entries())
    for (const dimension of ["x", "y", "width", "height"] as const)
      expect(rectangle[dimension]).toBeCloseTo(
        samples.before[index][dimension],
        1,
      );
  expect(samples.hit).toBe("tarot-pick-0");
  await first.click();
  await expectChosenArt(page, 0, original.tarotDeck![0]);
  expect((await current(page)).tarotPicked).toEqual([0]);
  expect((await current(page)).reading).toEqual(original.reading);

  const pause = page.getByRole("button", { name: "暂停动态效果", exact: true });
  await pause.click();
  await expect(pause).toHaveAttribute("aria-pressed", "true");
  const runningCount = () =>
    flow.evaluate(
      (element) =>
        element
          .getAnimations({ subtree: true })
          .filter((animation) => animation.playState === "running").length,
    );
  await expect.poll(runningCount).toBe(0);
  await page.getByTestId("tarot-pick-1").click();
  await expectChosenArt(page, 1, original.tarotDeck![1]);
  await pause.click();
  await expect(pause).toHaveAttribute("aria-pressed", "false");
  await expect.poll(runningCount).toBeGreaterThan(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(runningCount).toBe(0);
  expect((await current(page)).reading).toEqual(original.reading);
  expect((await current(page)).tarotDeck).toEqual(original.tarotDeck);
  await expect(page.locator("html")).toHaveAttribute(
    "data-random-calls",
    "181",
  );

  await page.reload();
  await expect(page.getByTestId("tarot-deck")).toBeVisible();
  await expect.poll(runningCount).toBe(0);
  await expect(page.locator("html")).not.toHaveAttribute("data-random-calls");
  expect((await current(page)).tarotPicked).toEqual([0, 1]);
  expect((await current(page)).tarotDeck).toEqual(original.tarotDeck);
  expect((await current(page)).reading).toEqual(original.reading);
  for (const order of [0, 1])
    await expectChosenArt(page, order, original.tarotDeck![order]);
  await page.getByTestId("tarot-pick-2").click();
  await expect(page.getByTestId("tarot-deck")).toHaveCount(0);
  await expect(
    page.getByTestId("result-tarot").locator(".tarot-card-front"),
  ).toHaveCount(3);
  await expect(page.locator("html")).not.toHaveAttribute("data-random-calls");
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
