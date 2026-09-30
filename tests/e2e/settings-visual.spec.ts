import { expect, test } from "@playwright/test";
import { createFreshBeyondVisualSave } from "./visual-state.js";

test.use({
  colorScheme: "light",
  deviceScaleFactor: 1,
  locale: "en-US",
  timezoneId: "UTC",
  viewport: { width: 1440, height: 900 },
});

for (const theme of ["light", "dark"] as const) {
  test(`matches the fresh Remix Settings ${theme} screen`, async ({ page }) => {
    const fixedClock = 1_704_067_200_000;
    const serialized = await createFreshBeyondVisualSave({
      clockMs: fixedClock,
      theme,
      tab: "settings",
    });
    await page.addInitScript(
      ({ now, save }) => {
        localStorage.clear();
        localStorage.setItem("IdleMineBeyond", save);
        Object.defineProperty(Date, "now", {
          configurable: true,
          value: () => now,
        });
      },
      { now: fixedClock, save: serialized },
    );
    await page.goto("/");
    await expect(page.locator("#app")).toHaveAttribute(
      "data-app-state",
      "ready",
    );
    await expect(page.locator("#app")).toHaveAttribute("data-theme", theme);
    await expect(page.locator("[data-settings-panel]")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Idle Mine", exact: true }),
    ).toHaveAttribute(
      "href",
      "https://www.kongregate.com/games/crovie/idle-mine",
    );
    await expect(
      page.getByRole("link", { name: "ad-notations", exact: true }),
    ).toHaveAttribute(
      "href",
      "https://github.com/antimatter-dimensions/notations",
    );
    const socialLinks = page.locator("article.settings .social a");
    await expect(socialLinks).toHaveCount(3);
    for (const [index, href] of [
      "https://www.youtube.com/veprogames",
      "https://veprogames.github.io",
      "https://idle-mine-remix.fandom.com/wiki/",
    ].entries()) {
      await expect(socialLinks.nth(index)).toHaveAttribute("href", href);
    }
    await page.evaluate(() => document.fonts.ready);
    await page.mouse.move(1439, 899);
    await page.evaluate(() => {
      for (const animation of document.getAnimations()) {
        animation.pause();
        animation.currentTime = 0;
      }
    });

    await expect(page).toHaveScreenshot(
      `settings-fresh-${theme}-1440x900.png`,
      { maxDiffPixels: 0 },
    );
  });
}
