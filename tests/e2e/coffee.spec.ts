import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { CoffeeState } from "../../src/experiences/coffee/state";
import type { SavedReading } from "../../src/types";

const current = (page: Page) =>
  page.evaluate(
    () =>
      JSON.parse(sessionStorage.getItem("zhongbu-active-v1")!) as SavedReading,
  );
const coffee = async (page: Page) =>
  (await current(page)).reading.results.find((r) => r.engine === "coffee")!
    .raw as CoffeeState;
async function start(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  for (const box of await page
    .locator('.engine-picker input[type="checkbox"]')
    .all())
    await box.uncheck();
  await page.getByLabel(/咖啡渣占/).check();
  await page.getByRole("button", { name: "开启这次探索" }).click();
  await expect(page.getByTestId("coffee-experience")).toBeVisible();
  await expect(
    page.getByTestId("coffee-experience").getByRole("combobox"),
  ).toHaveCount(0);
}
async function uncover(page: Page) {
  await page
    .getByRole("button", { name: "覆上杯碟 · 固定杯纹", exact: true })
    .press("Enter");
  const frozen = (await coffee(page)).texture;
  expect(frozen?.patches).toHaveLength(98);
  await page
    .getByRole("button", { name: "翻杯，杯口朝下", exact: true })
    .press("Enter");
  await page
    .getByRole("button", { name: "让杯渣沉降", exact: true })
    .press("Enter");
  await page
    .getByRole("button", { name: "揭杯，开始观察", exact: true })
    .press("Enter");
  await expect(
    page.getByRole("button", { name: "没有看见清楚形状", exact: true }),
  ).toBeVisible();
  expect((await coffee(page)).texture).toEqual(frozen);
  return frozen!;
}

test("coffee keyboard flow accepts an empty observation, keeps the cup frozen and restores it", async ({
  page,
}) => {
  await start(page);
  const original = await coffee(page);
  await page
    .getByRole("button", { name: "开始轻转杯子", exact: true })
    .press("Enter");
  await page
    .getByRole("button", { name: "向右轻转 30°", exact: true })
    .press("Space");
  await page
    .getByRole("button", { name: "向右轻转 30°", exact: true })
    .press("Enter");
  await page
    .getByRole("button", { name: "向左轻转 30°", exact: true })
    .press("Enter");
  expect((await coffee(page)).swirl).toEqual({ angle: 30, travel: 90 });
  const texture = await uncover(page);
  await expect(
    page.getByTestId("coffee-experience").getByRole("combobox"),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "没有看见清楚形状", exact: true })
    .press("Enter");
  const done = await coffee(page);
  expect(done.stage).toBe("complete");
  expect(done.seeds).toEqual(original.seeds);
  expect(done.observations[0].outcome).toBe("unclear");
  expect(done.observations[0].annotations).toEqual([]);
  expect(done.texture).toEqual(texture);
  expect(
    (await current(page)).reading.results[0].interpretation?.inclination,
  ).toBe("无明确倾向");
  await page.reload();
  await expect(page.getByTestId("coffee-experience")).toBeVisible();
  expect(await coffee(page)).toEqual(done);
  await expect(page.getByTestId("coffee-pattern")).toHaveAttribute(
    "data-texture-id",
    texture.id,
  );
  const dimensions = await page.evaluate(() => ({
    width: innerWidth,
    body: document.body.scrollWidth,
  }));
  expect(dimensions.body).toBeLessThanOrEqual(dimensions.width);
});

test("coffee drag, manual framing, view changes and appended observations share the same pattern", async ({
  page,
}) => {
  await start(page);
  await page.getByRole("button", { name: "开始轻转杯子", exact: true }).click();
  const cup = page.getByTestId("coffee-pattern");
  await cup.scrollIntoViewIfNeeded();
  const box = (await cup.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.73, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.78, {
    steps: 8,
  });
  await page.mouse.up();
  expect((await coffee(page)).swirl.travel).toBeGreaterThan(0);
  const texture = await uncover(page);
  await page
    .getByRole("button", { name: "框选一片区域，记录我的联想", exact: true })
    .click();
  await expect(page.getByLabel("我的意象选择")).toHaveValue("");
  await expect(
    page.getByRole("button", { name: "保存这片观察", exact: true }),
  ).toBeDisabled();
  await cup.scrollIntoViewIfNeeded();
  const image = (await cup.boundingBox())!;
  await page.mouse.move(
    image.x + image.width * 0.23,
    image.y + image.height * 0.3,
  );
  await page.mouse.down();
  await page.mouse.move(
    image.x + image.width * 0.48,
    image.y + image.height * 0.65,
    { steps: 5 },
  );
  await page.mouse.up();
  const draft = (await coffee(page)).draft!;
  expect(draft.box).not.toEqual({ u: 350, v: 350, width: 250, height: 250 });
  await page.getByLabel("我的意象选择").selectOption("tree");
  await page
    .getByLabel("我的观察（可选，最多 160 字）")
    .fill("这片流痕让我想到一棵倾斜的树。");
  await page.getByRole("button", { name: "保存这片观察", exact: true }).click();
  expect((await coffee(page)).working[0].symbol).toBe("tree");
  await page.getByRole("button", { name: "杯内俯视", exact: true }).click();
  await page.getByLabel("杯纹观察角度").focus();
  await page.keyboard.press("End");
  await page.getByLabel("杯纹放大").focus();
  await page.keyboard.press("End");
  expect((await coffee(page)).texture).toEqual(texture);
  expect((await coffee(page)).view).toEqual({
    mode: "top",
    rotation: 180,
    zoom: 2,
  });
  await page
    .getByRole("button", { name: "完成本版观察，查阅象征提示", exact: true })
    .click();
  const first = await coffee(page);
  expect(first.observations[0].annotations[0].box).toEqual(draft.box);
  await page
    .getByRole("button", { name: "用同一杯纹再观察一版", exact: true })
    .click();
  await page
    .getByRole("button", { name: "没有看见清楚形状", exact: true })
    .click();
  const second = await coffee(page);
  expect(second.observations).toHaveLength(2);
  expect(second.observations[0]).toEqual(first.observations[0]);
  expect(second.observations.every((o) => o.textureId === texture.id)).toBe(
    true,
  );
  expect(second.texture).toEqual(texture);
  await page.getByLabel("查看咖啡观察版本").selectOption("1");
  await expect(page.getByTestId("coffee-experience")).toContainText(
    "这片流痕让我想到一棵倾斜的树。",
  );
  const audit = await new AxeBuilder({ page })
    .include('[data-testid="coffee-experience"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    audit.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({ html: n.html, summary: n.failureSummary })),
    })),
  ).toEqual([]);
  await page.reload();
  await expect(page.getByTestId("coffee-experience")).toBeVisible();
  expect((await coffee(page)).observations).toEqual(second.observations);
  expect((await coffee(page)).activeVersion).toBe(1);
  const dimensions = await page.evaluate(() => ({
    width: innerWidth,
    body: document.body.scrollWidth,
  }));
  expect(dimensions.body).toBeLessThanOrEqual(dimensions.width);
});
