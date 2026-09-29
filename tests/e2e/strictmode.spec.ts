import { test, expect } from "@playwright/test";
import { revealTarot } from "./helpers";
test("development StrictMode mounts and double submission never repeat draws", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = crypto.getRandomValues.bind(crypto);
    Object.defineProperty(crypto, "getRandomValues", {
      value: (buffer: Uint32Array<ArrayBuffer>) => {
        document.documentElement.dataset.randomCalls = String(
          Number(document.documentElement.dataset.randomCalls || "0") + 1,
        );
        original(buffer);
        return buffer;
      },
    });
  });
  await page.goto("/");
  await page.getByLabel("出生日期").fill("1998-06-15");
  expect(
    await page.locator("html").getAttribute("data-random-calls"),
  ).toBeNull();
  await page.locator("form").evaluate((f) => {
    f.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    f.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await expect(page.getByTestId("ritual-transition")).toBeVisible();
  await expect(page.locator(".result-card")).toHaveCount(0);
  // ID 4 + tarot 3 selections / 3 orientations + coins 18 + runes 3 = 31.
  expect(await page.locator("html").getAttribute("data-random-calls")).toBe(
    "31",
  );
  const frozen = await page.evaluate(() =>
    sessionStorage.getItem("zhongbu-active-v1"),
  );
  await page.getByRole("button", { name: "跳过动画", exact: true }).click();
  await expect(page.getByTestId("result-tarot")).toBeVisible();
  expect(
    await page.evaluate(() => sessionStorage.getItem("zhongbu-active-v1")),
  ).toBe(frozen);
  expect(await page.locator("html").getAttribute("data-random-calls")).toBe(
    "31",
  );
  await revealTarot(page);
  expect(
    await page.evaluate(
      () => JSON.parse(sessionStorage.getItem("zhongbu-active-v1")!).reading,
    ),
  ).toEqual(JSON.parse(frozen!).reading);
  expect(await page.locator("html").getAttribute("data-random-calls")).toBe(
    "31",
  );
  await page
    .getByTestId("result-tarot")
    .getByRole("button", { name: "我更认同" })
    .click();
  await page.getByRole("button", { name: "规则汇总", exact: true }).click();
  expect(await page.locator("html").getAttribute("data-random-calls")).toBe(
    "31",
  );
  await page.getByRole("button", { name: "暂停动态效果", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "暂停动态效果", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(await page.locator("html").getAttribute("data-random-calls")).toBe(
    "31",
  );
});
