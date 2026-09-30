import { expect, test } from "@playwright/test";
import { createFreshBeyondVisualSave } from "./visual-state.js";

test.use({
  colorScheme: "light",
  deviceScaleFactor: 1,
  locale: "en-US",
  timezoneId: "UTC",
  viewport: { width: 1440, height: 900 },
});

async function prepareFreshMining(
  page: import("@playwright/test").Page,
  theme: "light" | "dark" = "light",
) {
  const fixedClock = 1_704_067_200_000;
  const serializedDarkState =
    theme === "dark"
      ? await createFreshBeyondVisualSave({
          clockMs: fixedClock,
          theme,
          tab: "main",
        })
      : undefined;
  await page.addInitScript(
    ({ now, serialized }) => {
      localStorage.clear();
      if (serialized) localStorage.setItem("IdleMineBeyond", serialized);
      Object.defineProperty(Date, "now", {
        configurable: true,
        value: () => now,
      });
    },
    { now: fixedClock, serialized: serializedDarkState },
  );
  await page.goto("/");
  await expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready");
}

async function stabilizeScreenshot(page: import("@playwright/test").Page) {
  await expect(page.locator("canvas.mine-object")).toHaveAttribute(
    "data-rendered",
    "true",
  );
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(1439, 899);
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) {
      animation.pause();
      animation.currentTime = 0;
    }
  });
}

test("matches the pinned fresh Remix Mining light screen", async ({ page }) => {
  await prepareFreshMining(page);
  await stabilizeScreenshot(page);

  await expect(page).toHaveScreenshot("remix-mining-fresh-light-1440x900.png", {
    maxDiffPixels: 0,
  });
});

test("matches the pinned fresh Remix Mining dark screen", async ({ page }) => {
  await prepareFreshMining(page, "dark");
  await expect(page.locator("#app")).toHaveAttribute("data-theme", "dark");
  await stabilizeScreenshot(page);

  await expect(page).toHaveScreenshot("remix-mining-fresh-dark-1440x900.png", {
    maxDiffPixels: 0,
  });
});
