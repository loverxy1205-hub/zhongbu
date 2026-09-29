import { test, expect } from "@playwright/test";
import { revealAll } from "./helpers";
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
        // Small fixed words avoid rejection-sampling variance while preserving the call count.
        buffer.fill(7);
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
  // ID 4 + coins 18 + runes 3 + all 78 shuffled slots / 78 orientations = 181.
  expect(await page.locator("html").getAttribute("data-random-calls")).toBe(
    "181",
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
    "181",
  );
  await revealAll(page);
  expect(
    await page.evaluate(
      () => JSON.parse(sessionStorage.getItem("zhongbu-active-v1")!).reading,
    ),
  ).toMatchObject({
    readingId: JSON.parse(frozen!).reading.readingId,
    input: JSON.parse(frozen!).reading.input,
  });
  const settled = await page.evaluate(
    () => JSON.parse(sessionStorage.getItem("zhongbu-active-v1")!).reading,
  );
  expect(
    settled.results.filter(
      (result: { engine: string }) => result.engine !== "tarot",
    ),
  ).toEqual(
    JSON.parse(frozen!).reading.results.filter(
      (result: { engine: string }) => result.engine !== "tarot",
    ),
  );
  expect(await page.locator("html").getAttribute("data-random-calls")).toBe(
    "181",
  );
  await page
    .getByTestId("result-tarot")
    .getByRole("button", { name: "我更认同" })
    .click();
  await page.getByRole("button", { name: "规则汇总", exact: true }).click();
  expect(await page.locator("html").getAttribute("data-random-calls")).toBe(
    "181",
  );
  await page.getByRole("button", { name: "暂停动态效果", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "暂停动态效果", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(await page.locator("html").getAttribute("data-random-calls")).toBe(
    "181",
  );
});
