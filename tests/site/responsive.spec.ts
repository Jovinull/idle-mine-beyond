import { expect, test } from "@playwright/test";

// Runs on a phone-sized viewport (see playwright.site.config.ts).

test("pages fit the phone width without horizontal scrolling", async ({
  page,
}) => {
  for (const path of [
    "/",
    "/wiki/",
    "/wiki/objects/",
    "/wiki/objects/61/",
    "/wiki/upgrades/money/",
    "/wiki/story/chapter-3/",
    "/about/",
  ]) {
    await page.goto(path);
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow, path).toBeLessThanOrEqual(1);
  }
});

test("the wiki menu opens on small screens", async ({ page }) => {
  await page.goto("/wiki/objects/");
  const menu = page.locator("details.mobile-nav");
  await expect(menu.getByRole("link", { name: "Story" })).toBeHidden();
  await menu.locator("summary").click();
  await menu.getByRole("link", { name: "Story" }).click();
  await expect(page).toHaveURL(/\/wiki\/story\/$/);
});
