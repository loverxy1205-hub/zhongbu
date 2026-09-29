import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { TAROT } from "../../src/data/tarot";
import type { SavedReading } from "../../src/types";
import { revealTarot } from "./helpers";

const current = (page: Page) =>
  page.evaluate(
    () =>
      JSON.parse(sessionStorage.getItem("zhongbu-active-v1")!) as SavedReading,
  );
async function startConcealed(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "开启这次探索" }).click();
  await expect(page.getByTestId("result-tarot")).toBeVisible();
}

test("three concealed cards reveal individually by keyboard before unlocking the full reading", async ({
  page,
}) => {
  await startConcealed(page);
  const original = await current(page);
  const raw = original.reading.results.find(
    (result) => result.engine === "tarot",
  )?.raw;
  if (raw?.kind !== "tarot") throw new Error("Expected a frozen tarot draw");
  expect(original.tarotRevealed).toEqual([]);
  const tarot = page.getByTestId("result-tarot");
  for (let index = 0; index < 3; index++) {
    const slot = page.getByTestId(`tarot-slot-${index}`);
    const name = TAROT.find((card) => card.id === raw.cards[index].id)!.name;
    await expect(slot).toHaveAttribute("data-revealed", "false");
    await expect(slot.locator(".tarot-card-front")).toHaveCount(0);
    await expect(slot.getByText(name, { exact: true })).toHaveCount(0);
    await expect(slot.getByText(/^(正位|逆位)$/)).toHaveCount(0);
    await expect(
      page.getByRole("button", {
        name: `翻开第 ${index + 1} 张塔罗牌`,
        exact: true,
      }),
    ).toBeEnabled();
  }
  await expect(
    tarot.locator(".result-reading, .reading-headline, .theme-row"),
  ).toHaveCount(0);
  await expect(page.getByTestId("ai-tarot")).toHaveCount(0);
  await expect(
    page.getByTestId("result-iching").locator(".result-reading"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "规则汇总", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "我的偏好汇总", exact: true }),
  ).toBeDisabled();
  await page.getByText("导出 ↓", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "JSON", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Markdown", exact: true }),
  ).toBeDisabled();

  await page.getByTestId("tarot-reveal-0").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("tarot-slot-0")).toHaveAttribute(
    "data-revealed",
    "true",
  );
  await expect(
    page
      .getByTestId("tarot-slot-0")
      .getByText(TAROT.find((card) => card.id === raw.cards[0].id)!.name, {
        exact: true,
      }),
  ).toBeVisible();
  await expect(page.getByTestId("tarot-reveal-0")).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await expect(tarot.locator(".tarot-card-front")).toHaveCount(1);
  expect((await current(page)).tarotRevealed).toEqual([0]);
  expect((await current(page)).reading).toEqual(original.reading);

  await page.getByTestId("tarot-reveal-2").focus();
  await page.keyboard.press("Space");
  await expect(page.getByTestId("tarot-slot-2")).toHaveAttribute(
    "data-revealed",
    "true",
  );
  await expect(page.getByTestId("tarot-slot-1")).toHaveAttribute(
    "data-revealed",
    "false",
  );
  await expect(tarot.locator(".tarot-card-front")).toHaveCount(2);
  await expect(tarot.locator(".result-reading")).toHaveCount(0);
  await expect(page.getByTestId("ai-tarot")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "规则汇总", exact: true }),
  ).toBeDisabled();

  await page.getByTestId("tarot-reveal-1").click();
  await expect(tarot.locator(".tarot-card-front")).toHaveCount(3);
  await expect(tarot.locator(".result-reading")).toBeVisible();
  await expect(page.getByTestId("ai-tarot")).toBeVisible();
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
  expect((await current(page)).tarotRevealed?.toSorted()).toEqual([0, 1, 2]);
  expect((await current(page)).reading).toEqual(original.reading);
});

test("partial reveal survives sorting, navigation, refresh and saved-history restoration", async ({
  page,
}) => {
  await startConcealed(page);
  const original = (await current(page)).reading;
  await page.getByTestId("tarot-reveal-1").click();
  await page
    .getByTestId("result-runes")
    .getByRole("button", { name: "置顶体系" })
    .click();
  await expect(page.locator(".result-card").first()).toHaveAttribute(
    "data-testid",
    "result-runes",
  );
  await expect(page.getByTestId("tarot-slot-1")).toHaveAttribute(
    "data-revealed",
    "true",
  );
  await expect(page.getByTestId("tarot-slot-0")).toHaveAttribute(
    "data-revealed",
    "false",
  );
  await page.getByRole("button", { name: "保存本次", exact: true }).click();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("zhongbu-history-v1")!)[0]
          .tarotRevealed,
    ),
  ).toEqual([1]);
  await page.getByRole("button", { name: "方法与知识", exact: true }).click();
  await page.getByRole("button", { name: "问一件事", exact: true }).click();
  await expect(page.getByTestId("tarot-slot-1")).toHaveAttribute(
    "data-revealed",
    "true",
  );
  await page.reload();
  await expect(page.getByTestId("tarot-slot-1")).toHaveAttribute(
    "data-revealed",
    "true",
  );
  await expect(
    page.getByTestId("result-tarot").locator(".tarot-card-front"),
  ).toHaveCount(1);
  expect((await current(page)).tarotRevealed).toEqual([1]);
  expect((await current(page)).reading).toEqual(original);
  await page.getByRole("button", { name: /本机记录/ }).click();
  await page.getByRole("button", { name: "打开原记录" }).click();
  await expect(page.getByTestId("tarot-slot-1")).toHaveAttribute(
    "data-revealed",
    "true",
  );
  await expect(page.getByTestId("tarot-slot-2")).toHaveAttribute(
    "data-revealed",
    "false",
  );
  await revealTarot(page);
  expect(
    await page.evaluate(() =>
      JSON.parse(
        localStorage.getItem("zhongbu-history-v1")!,
      )[0].tarotRevealed.sort(),
    ),
  ).toEqual([0, 1, 2]);
  expect((await current(page)).reading).toEqual(original);
  await page.getByRole("button", { name: /再问一次/ }).click();
  await page.getByRole("button", { name: "开启这次探索" }).click();
  await expect(page.getByTestId("result-tarot")).toBeVisible();
  expect((await current(page)).tarotRevealed).toEqual([]);
  expect((await current(page)).reading.readingId).not.toBe(original.readingId);
  await expect(
    page.getByTestId("result-tarot").locator(".tarot-card-front"),
  ).toHaveCount(0);
});

test("older records without reveal state remain fully open without a redraw", async ({
  page,
}) => {
  await startConcealed(page);
  const original = (await current(page)).reading;
  await page.evaluate(() => {
    const saved = JSON.parse(sessionStorage.getItem("zhongbu-active-v1")!);
    delete saved.tarotRevealed;
    sessionStorage.setItem("zhongbu-active-v1", JSON.stringify(saved));
  });
  await page.reload();
  for (let index = 0; index < 3; index++)
    await expect(page.getByTestId(`tarot-slot-${index}`)).toHaveAttribute(
      "data-revealed",
      "true",
    );
  await expect(
    page.getByTestId("result-tarot").locator(".tarot-card-front"),
  ).toHaveCount(3);
  await expect(page.getByTestId("ai-tarot")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "规则汇总", exact: true }),
  ).toBeEnabled();
  expect((await current(page)).reading).toEqual(original);
});
