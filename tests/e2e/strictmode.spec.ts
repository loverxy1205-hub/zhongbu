import { test, expect } from "@playwright/test";
test("development StrictMode mounts and double submission never repeat draws", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("出生日期").fill("1998-06-15");
  await page.evaluate(() => {
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
  await page.locator("form").evaluate((f) => {
    f.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    f.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await expect(page.getByTestId("result-tarot")).toBeVisible();
  // ID 4 + tarot 3 selections / 3 orientations + coins 18 + runes 3 = 31.
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
});
