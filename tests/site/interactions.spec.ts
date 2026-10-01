import { expect, test } from "@playwright/test";
import mineContent from "../../packages/content/src/remix-mine-content.json" with { type: "json" };
import {
  getRemixMineObject,
  type RemixMineObjectCatalog,
} from "../../packages/core/src/index.js";

const catalog = mineContent as unknown as RemixMineObjectCatalog;

test("the home page object advances when mined", async ({ page }) => {
  await page.goto("/");
  const figure = page.locator(".hero-object");
  await expect(figure.locator(".name")).toHaveText("Mud");
  await figure.getByRole("button").click();
  await expect(figure.locator(".name")).toHaveText("Paper");
  await expect(figure.locator("canvas")).toHaveAttribute("data-state", "ready");
});

test("the theme toggle switches and is remembered", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/about/");
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(
    page.getByRole("button", { name: "Switch to light theme" }),
  ).toBeVisible();
});

test("the notation picker rewrites wiki numbers and persists", async ({
  page,
}) => {
  await page.goto("/wiki/objects/61/");
  const hp = page.locator(".stats dd").first();
  await expect(hp).toHaveText("3.33 Qt");
  await page
    .getByLabel("Number notation")
    .selectOption({ label: "Scientific" });
  await expect(hp).toHaveText("3.33e18");
  await page.goto("/wiki/objects/1/");
  await expect(page.getByLabel("Number notation")).toHaveValue("1");
});

test("the explorer matches the game's generator for any object", async ({
  page,
}) => {
  await page.goto("/wiki/explorer/?n=300");
  const expected = getRemixMineObject(299, catalog).name;
  await expect(page.locator(".result > h2")).toContainText(expected);
  await page.getByLabel("Object number").fill("12345");
  await page.getByRole("button", { name: "Show" }).click();
  await expect(page.locator(".result > h2")).toContainText(
    getRemixMineObject(12344, catalog).name,
  );
  await expect(page).toHaveURL(/\/wiki\/explorer\/\?n=12345$/);
  await page.getByLabel("Object number").fill("abc");
  await page.getByRole("button", { name: "Show" }).click();
  await expect(page.getByText(/Enter a whole number/)).toBeVisible();
});

test("search finds objects and opens them", async ({ page }) => {
  await page.goto("/wiki/");
  const search = page.getByRole("combobox", { name: "Search the wiki" });
  await search.fill("portal to");
  await expect(
    page.getByRole("listbox").getByRole("option").first(),
  ).toContainText("PORTAL TO SPACE");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/wiki\/objects\/90\/$/);
  await expect(page.locator("h1")).toHaveText("PORTAL TO SPACE");
});

test("the upgrade calculator totals prices up to a level", async ({ page }) => {
  await page.goto("/wiki/upgrades/money/");
  const blacksmith = page.locator("#blacksmith");
  await blacksmith.getByLabel("Level").fill("3");
  await expect(blacksmith.locator(".calculator")).toContainText(
    "Reaching level 3 from 0 costs 334 in total",
  );
});

test("Story chapters draw the same previews as the game", async ({ page }) => {
  await page.goto("/wiki/story/chapter-1/");
  await expect(page.locator("h1")).toHaveText("Welcome to Idle Mine: Remix!");
  await expect(page.locator(".story-quote").first()).toContainText(
    "Just some ordinary Mud",
  );
  await expect(
    page.locator(".story-text canvas[data-rendered='true']"),
  ).toHaveCount(4);
});

test("the game runs at /play/ with the shared assets", async ({ page }) => {
  const failed: string[] = [];
  page.on("response", (response) => {
    if (response.status() >= 400) failed.push(response.url());
  });
  await page.goto("/play/");
  await expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready");
  await expect(page.locator("canvas.mine-object")).toHaveAttribute(
    "data-rendered",
    "true",
  );
  expect(failed).toEqual([]);
});

test("the notation table keeps its scrollbars and labels in view", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/wiki/notations/");
  const wrap = page.getByRole("region", { name: "Notation examples" });
  await wrap.scrollIntoViewIfNeeded();
  const box = (await wrap.boundingBox())!;
  expect(box.height).toBeLessThanOrEqual(800);
  expect(
    await wrap.evaluate((element) => element.scrollWidth > element.clientWidth),
  ).toBe(true);

  await wrap.evaluate((element) => {
    element.scrollTop = 600;
    element.scrollLeft = 400;
  });
  const header = (await wrap.locator("thead th").first().boundingBox())!;
  const name = (await wrap.locator("tbody th").nth(20).boundingBox())!;
  expect(Math.abs(header.y - box.y)).toBeLessThan(3);
  expect(Math.abs(name.x - box.x)).toBeLessThan(3);
});
