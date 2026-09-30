import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

for (let pageIndex = 0; pageIndex < 9; pageIndex += 1) {
  for (const theme of ["light", "dark"] as const) {
    test(`matches the pinned all-unlocked Remix Story page ${pageIndex} ${theme} screen`, async ({
      page,
    }) => {
      const screenshotMetadata = JSON.parse(
        await readFile(
          new URL(
            "../fixtures/visual/story-all-unlocked-page-" +
              pageIndex +
              "-" +
              theme +
              "-1440x900.json",
            import.meta.url,
          ),
          "utf8",
        ),
      ) as {
        gameTheme: string;
        state: { story: { page: number; scrollTop: number } };
      };
      expect(screenshotMetadata.gameTheme).toBe(theme);
      expect(screenshotMetadata.state.story.page).toBe(pageIndex);
      const reference = JSON.parse(
        await readFile(
          new URL(
            "../fixtures/parity/remix-reference-corpus.json",
            import.meta.url,
          ),
          "utf8",
        ),
      ) as {
        data: { saveApplicationSemantics: { inputJson: string } };
      };
      const save = JSON.parse(
        reference.data.saveApplicationSemantics.inputJson,
      ) as {
        money: string;
        gems: string;
        planetCoins: string;
        maxWisdom: string;
        highestMoney: string;
        maxPlanetCoins: string;
        mineObjectLevel: number;
        highestMineObjectLevel: number;
        lastActive: number;
        settings: { tab: string; theme: string };
        story: {
          page: number;
          notifications: number;
          highestUnlocked: number;
          scrollY: number;
        };
        upgrades: Record<string, { level: number }>;
        gemUpgrades: Record<string, { level: number }>;
        planetCoinUpgrades: Record<string, { level: number }>;
        powers: {
          data: { values: string[] };
          upgrades: Record<string, { level: number }>;
        };
      };
      const fixedClock = 1_704_067_200_000;
      save.money = "0";
      save.gems = "5";
      save.planetCoins = "0";
      save.maxWisdom = "0";
      save.highestMoney = "5e13";
      save.maxPlanetCoins = "1";
      save.mineObjectLevel = 0;
      save.highestMineObjectLevel = 215;
      save.lastActive = fixedClock;
      save.settings.tab = "story";
      save.settings.theme = theme;
      save.story = {
        page: pageIndex,
        notifications: 0,
        highestUnlocked: 60,
        scrollY: screenshotMetadata.state.story.scrollTop,
      };
      for (const upgrade of Object.values(save.upgrades)) upgrade.level = 0;
      for (const upgrade of Object.values(save.gemUpgrades)) upgrade.level = 0;
      for (const upgrade of Object.values(save.planetCoinUpgrades)) {
        upgrade.level = 0;
      }
      save.upgrades["blacksmith"] = { level: 1 };
      save.upgrades["gemWaster"] = { level: 1 };
      save.powers.data.values = ["1", "1", "1", "1", "1"];
      for (const upgrade of Object.values(save.powers.upgrades)) {
        upgrade.level = 0;
      }
      const firstWisdomUpgrade = Object.values(save.powers.upgrades)[0];
      if (!firstWisdomUpgrade)
        throw new Error("The source Wisdom upgrade is missing.");
      firstWisdomUpgrade.level = 1;

      await page.addInitScript(
        ({ legacySave, now }) => {
          localStorage.clear();
          localStorage.setItem(
            "IdleMine",
            btoa(escape(encodeURIComponent(legacySave))),
          );
          Date.now = () => now;
        },
        { legacySave: JSON.stringify(save), now: fixedClock },
      );
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto("/");
      await expect(page.locator("#app")).toHaveAttribute(
        "data-app-state",
        "ready",
      );
      await page.locator("[data-game-tab='story']").click();
      await expect(page.locator("article.story")).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      for (const canvas of await page
        .locator(".story-milestones canvas")
        .all()) {
        await expect(canvas).toHaveAttribute("data-rendered", "true");
      }
      await page.locator(".story-milestones").evaluate((node, scrollTop) => {
        node.scrollTop = scrollTop;
      }, screenshotMetadata.state.story.scrollTop);
      await expect
        .poll(() =>
          page.locator(".story-milestones").evaluate((node) => node.scrollTop),
        )
        .toBe(screenshotMetadata.state.story.scrollTop);
      await page.mouse.move(1400, 800);
      await page.evaluate(() => {
        for (const animation of document.getAnimations()) {
          animation.pause();
          animation.currentTime = 0;
        }
      });
      await expect(page).toHaveScreenshot(
        `story-all-unlocked-page-${pageIndex}-${theme}-1440x900.png`,
        { maxDiffPixels: 0 },
      );
    });
  }
}
