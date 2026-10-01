import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import {
  createBeyondStoryVisualSave,
  createBeyondStoryVisualSaveFromRemixSave,
  createFreshBeyondVisualSave,
} from "./visual-state.js";

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

for (const theme of ["light", "dark"] as const) {
  test(
    "matches the pinned fresh Remix Story " + theme + " screen",
    async ({ page }) => {
      const fixedClock = 1_704_067_200_000;
      const screenshotMetadata = JSON.parse(
        await readFile(
          new URL(
            "../fixtures/visual/story-fresh-" + theme + "-1440x900.json",
            import.meta.url,
          ),
          "utf8",
        ),
      ) as {
        gameTheme: string;
        state: {
          story: {
            page: number;
            notifications: number;
            scrollTop: number;
            nextObjective: string;
          };
        };
      };
      expect(screenshotMetadata.gameTheme).toBe(theme);
      const serialized = await createFreshBeyondVisualSave({
        clockMs: fixedClock,
        theme,
        tab: "main",
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
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto("/");
      await expect(page.locator("#app")).toHaveAttribute(
        "data-app-state",
        "ready",
      );
      await expect(page.locator("#app")).toHaveAttribute("data-theme", theme);
      await page.locator("[data-game-tab='story']").click();
      await expect(page.locator("article.story")).toBeVisible();
      await expect(page.locator(".chapter-control h3")).toHaveText(
        "Chapter 1: Welcome to Idle Mine: Remix!",
      );
      await expect(
        page.locator(".story-milestones > div[data-story-milestone-key]"),
      ).toHaveAttribute("data-story-milestone-key", "gameStart");
      await expect(page.locator(".objective")).toContainText(
        screenshotMetadata.state.story.nextObjective,
      );
      await expect(
        page.locator("[data-game-tab='story'] .notification"),
      ).toHaveCount(screenshotMetadata.state.story.notifications);
      await page.locator(".story-milestones").evaluate((node, scrollTop) => {
        node.scrollTop = scrollTop;
      }, screenshotMetadata.state.story.scrollTop);
      await expect
        .poll(() =>
          page.locator(".story-milestones").evaluate((node) => node.scrollTop),
        )
        .toBe(screenshotMetadata.state.story.scrollTop);
      await page.evaluate(() => document.fonts.ready);
      await page.mouse.move(1439, 899);
      await page.evaluate(() => {
        for (const animation of document.getAnimations()) {
          animation.pause();
          animation.currentTime = 0;
        }
      });
      if (process.platform !== "linux") {
        await expect(page).toHaveScreenshot(
          "story-fresh-" + theme + "-1440x900.png",
          { maxDiffPixels: 0 },
        );
      }
    },
  );
}

for (const theme of ["light", "dark"] as const) {
  test(`matches the pinned first-Mud Remix Story ${theme} screen`, async ({
    page,
  }) => {
    const screenshotName = `story-first-mud-${theme}-1440x900`;
    const screenshotMetadata = JSON.parse(
      await readFile(
        new URL(`../fixtures/visual/${screenshotName}.json`, import.meta.url),
        "utf8",
      ),
    ) as {
      gameTheme: string;
      randomSeed: number;
      state: {
        page: number;
        notifications: number;
        highestUnlocked: number;
        highestMineObjectLevel: number;
        currentObjectName: string;
        currentObjectHp: string;
        money: string;
        gems: string;
        scrollTop: number;
        visibleMilestones: string[];
        nextObjective: string;
      };
    };
    expect(screenshotMetadata.gameTheme).toBe(theme);
    expect(screenshotMetadata.state).toMatchObject({
      page: 0,
      notifications: 0,
      highestUnlocked: 1,
      highestMineObjectLevel: 1,
      currentObjectName: "Mud",
      currentObjectHp: "100",
      money: "2",
      gems: "5",
      scrollTop: 0,
      visibleMilestones: ["gameStart", "firstMud"],
      nextObjective: "Mine a piece of Paper",
    });

    const fixedClock = 1_704_067_200_000;
    const serialized = await createFreshBeyondVisualSave({
      clockMs: fixedClock,
      theme,
      tab: "main",
    });
    await page.addInitScript(
      ({ now, save, seed }) => {
        localStorage.clear();
        localStorage.setItem("IdleMineBeyond", save);
        Object.defineProperty(Date, "now", {
          configurable: true,
          value: () => now,
        });
        let randomState = seed >>> 0;
        Math.random = () => {
          randomState =
            (Math.imul(randomState, 1_664_525) + 1_013_904_223) >>> 0;
          return randomState / 0x1_0000_0000;
        };
      },
      {
        now: fixedClock,
        save: serialized,
        seed: screenshotMetadata.randomSeed,
      },
    );
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(page.locator("#app")).toHaveAttribute(
      "data-app-state",
      "ready",
    );
    await expect(page.locator("#app")).toHaveAttribute("data-theme", theme);
    const mineCanvas = page.locator("canvas.mine-object").first();
    for (let hit = 0; hit < 5; hit += 1) await mineCanvas.click();

    const storyTab = page.locator("[data-game-tab='story']");
    await expect(storyTab.locator("span.notification")).toHaveText("2");
    await storyTab.click();
    await expect(page.locator("article.story")).toBeVisible();
    await expect(storyTab.locator("span.notification")).toHaveCount(0);
    const milestones = page.locator(
      ".story-milestones > div[data-story-milestone-key]",
    );
    await expect(milestones.nth(1)).toHaveAttribute(
      "data-story-milestone-key",
      "firstMud",
    );
    expect(
      await milestones.evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("data-story-milestone-key")),
      ),
    ).toEqual(screenshotMetadata.state.visibleMilestones);
    await expect(page.locator(".objective")).toContainText(
      screenshotMetadata.state.nextObjective,
    );
    await page.locator(".story-milestones").evaluate((node, scrollTop) => {
      node.scrollTop = scrollTop;
    }, screenshotMetadata.state.scrollTop);
    await expect
      .poll(() =>
        page.locator(".story-milestones").evaluate((node) => node.scrollTop),
      )
      .toBe(screenshotMetadata.state.scrollTop);
    await page.evaluate(() => document.fonts.ready);
    await page.mouse.move(1439, 899);
    await page.evaluate(() => {
      for (const animation of document.getAnimations()) {
        animation.pause();
        animation.currentTime = 0;
      }
    });
    if (process.platform !== "linux") {
      await expect(page).toHaveScreenshot(`${screenshotName}.png`, {
        maxDiffPixels: 0,
      });
    }
  });
}

for (const theme of ["light", "dark"] as const) {
  test(`matches the natural millionaire-to-Spooky-Bone Remix Story ${theme} screen`, async ({
    page,
  }) => {
    const screenshotName = `story-natural-spooky-bone-${theme}-1440x900`;
    const metadata = JSON.parse(
      await readFile(
        new URL(`../fixtures/visual/${screenshotName}.json`, import.meta.url),
        "utf8",
      ),
    ) as {
      gameTheme: string;
      state: {
        page: number;
        highestUnlocked: number;
        mineObjectLevel: number;
        highestMineObjectLevel: number;
        currentObjectName: string;
        currentObjectHp: string;
        money: string;
        highestMoney: string;
        gems: string;
        pickaxeName: string;
        pickaxePower: string;
        pickaxeQuality: string;
        blacksmithLevel: number;
        notifications: number;
        scrollTop: number;
        visibleMilestones: string[];
        firstSpookyBoneUnlocked: boolean;
        nextObjective: string;
        chapterHeading: string;
      };
    };
    expect(metadata.gameTheme).toBe(theme);
    expect(metadata.state).toMatchObject({
      page: 1,
      highestUnlocked: 9,
      mineObjectLevel: 12,
      highestMineObjectLevel: 13,
      currentObjectName: "Spooky Bone",
      currentObjectHp: "92000",
      money: "37105.410590093",
      highestMoney: "1000053.0000000001",
      gems: "181",
      pickaxeName: 'Normal Pick "Igico"',
      blacksmithLevel: 47,
      notifications: 0,
      scrollTop: 0,
      visibleMilestones: [
        "firstStone",
        "tenThousand",
        "firstSpookyBone",
        "millionaire",
      ],
      firstSpookyBoneUnlocked: true,
      nextObjective: "Reach Emerald",
      chapterHeading: "Chapter 2: The real Adventure begins!",
    });

    const fixedClock = 1_704_067_200_000;
    const serialized = await createBeyondStoryVisualSave({
      clockMs: fixedClock,
      theme,
      source: {
        mineObjectLevel: metadata.state.mineObjectLevel,
        highestMineObjectLevel: metadata.state.highestMineObjectLevel,
        currentObjectHp: metadata.state.currentObjectHp,
        money: metadata.state.money,
        highestMoney: metadata.state.highestMoney,
        gems: metadata.state.gems,
        pickaxeName: metadata.state.pickaxeName,
        pickaxePower: metadata.state.pickaxePower,
        pickaxeQuality: metadata.state.pickaxeQuality,
        blacksmithLevel: metadata.state.blacksmithLevel,
        story: {
          page: metadata.state.page,
          highestUnlocked: metadata.state.highestUnlocked,
          notifications: metadata.state.notifications,
        },
      },
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
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(page.locator("#app")).toHaveAttribute(
      "data-app-state",
      "ready",
    );
    await expect(page.locator("#app")).toHaveAttribute("data-theme", theme);
    await expect(page.locator("article.story")).toBeVisible();
    await expect(page.locator("[data-story-page]")).toHaveAttribute(
      "data-story-page",
      "1",
    );
    await expect(page.locator(".chapter-control h3")).toHaveText(
      metadata.state.chapterHeading,
    );
    const milestones = page.locator(
      ".story-milestones > div[data-story-milestone-key]",
    );
    await expect(milestones).toHaveCount(4);
    expect(
      await milestones.evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("data-story-milestone-key")),
      ),
    ).toEqual(metadata.state.visibleMilestones);
    await expect(
      page.locator('[data-story-milestone-key="firstSpookyBone"]'),
    ).toContainText("Ohhhh, Spooky!");
    await expect(page.locator(".objective")).toContainText(
      metadata.state.nextObjective,
    );
    await expect(page.locator("header")).toContainText("37,105 $");
    await expect(page.locator("header")).toContainText("181");
    await expect(
      page.locator("[data-game-tab='story'] .notification"),
    ).toHaveCount(0);
    await expect
      .poll(() =>
        page.locator(".story-milestones").evaluate((node) => node.scrollTop),
      )
      .toBe(metadata.state.scrollTop);
    await page.evaluate(() => document.fonts.ready);
    for (const canvas of await page.locator(".story-milestones canvas").all()) {
      await expect(canvas).toHaveAttribute("data-rendered", "true");
    }
    await page.mouse.move(1439, 899);
    await page.evaluate(() => {
      for (const animation of document.getAnimations()) {
        animation.pause();
        animation.currentTime = 0;
      }
    });
    if (process.platform !== "linux") {
      await expect(page).toHaveScreenshot(`${screenshotName}.png`, {
        maxDiffPixels: 0,
      });
    }
  });
}

for (const theme of ["light", "dark"] as const) {
  test(`matches the pinned first-Paper Remix Story ${theme} screen`, async ({
    page,
  }) => {
    const screenshotName = `story-first-paper-${theme}-1440x900`;
    const screenshotMetadata = JSON.parse(
      await readFile(
        new URL(`../fixtures/visual/${screenshotName}.json`, import.meta.url),
        "utf8",
      ),
    ) as {
      gameTheme: string;
      randomSeed: number;
      state: {
        page: number;
        notifications: number;
        highestUnlocked: number;
        mineObjectLevel: number;
        highestMineObjectLevel: number;
        currentObjectName: string;
        currentObjectHp: string;
        money: string;
        gems: string;
        scrollTop: number;
        visibleMilestones: string[];
        nextObjective: string;
      };
    };
    expect(screenshotMetadata.gameTheme).toBe(theme);
    expect(screenshotMetadata.state).toMatchObject({
      page: 0,
      notifications: 0,
      highestUnlocked: 2,
      mineObjectLevel: 1,
      highestMineObjectLevel: 2,
      currentObjectName: "Paper",
      currentObjectHp: "400",
      money: "12",
      gems: "5",
      scrollTop: 0,
      visibleMilestones: ["gameStart", "firstMud", "firstPaper"],
      nextObjective: "Upgrade Your Blacksmith once",
    });

    const fixedClock = 1_704_067_200_000;
    const serialized = await createFreshBeyondVisualSave({
      clockMs: fixedClock,
      theme,
      tab: "main",
    });
    await page.addInitScript(
      ({ now, save, seed }) => {
        localStorage.clear();
        localStorage.setItem("IdleMineBeyond", save);
        Object.defineProperty(Date, "now", {
          configurable: true,
          value: () => now,
        });
        let randomState = seed >>> 0;
        Math.random = () => {
          randomState =
            (Math.imul(randomState, 1_664_525) + 1_013_904_223) >>> 0;
          return randomState / 0x1_0000_0000;
        };
      },
      {
        now: fixedClock,
        save: serialized,
        seed: screenshotMetadata.randomSeed,
      },
    );
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(page.locator("#app")).toHaveAttribute(
      "data-app-state",
      "ready",
    );
    await expect(page.locator("#app")).toHaveAttribute("data-theme", theme);

    const mineCanvas = page.locator(".mineobject canvas.mine-object");
    for (let hit = 0; hit < 5; hit += 1) await mineCanvas.click();
    const storyTab = page.locator("[data-game-tab='story']");
    await expect(storyTab.locator("span.notification")).toHaveText("2");
    await storyTab.click();
    await expect(
      page.locator('.story-milestones [data-story-milestone-key="firstMud"]'),
    ).toBeVisible();
    await page.locator("[data-game-tab='mining']").click();

    await page.locator('button[aria-label="Next mine object"]').click();
    await expect(
      page.locator(".mineobject canvas.mine-object"),
    ).toHaveAttribute("data-level", "1");
    await expect(page.locator(".mineobject h2")).toHaveText("Paper");
    await expect(page.locator("[data-mine-object-hp]")).toHaveText("HP: 400");
    for (let hit = 0; hit < 23; hit += 1) await mineCanvas.click();
    await expect(page.locator("[data-mine-object-hp]")).toHaveText("HP: 9");
    await mineCanvas.click();
    await expect(page.locator("[data-mine-object-hp]")).toHaveText("HP: 400");
    await expect(page.locator("header")).toContainText("12 $");
    await expect(page.locator("header")).toContainText("5");
    await expect(storyTab.locator("span.notification")).toHaveText("1");

    await storyTab.click();
    await expect(page.locator("article.story")).toBeVisible();
    await expect(storyTab.locator("span.notification")).toHaveCount(0);
    const milestones = page.locator(
      ".story-milestones > div[data-story-milestone-key]",
    );
    await expect(milestones).toHaveCount(3);
    expect(
      await milestones.evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("data-story-milestone-key")),
      ),
    ).toEqual(screenshotMetadata.state.visibleMilestones);
    await expect(page.locator(".objective")).toContainText(
      screenshotMetadata.state.nextObjective,
    );
    await expect(page.locator("header")).toContainText("12 $");
    await expect(page.locator("header")).toContainText("5");
    await page.locator(".story-milestones").evaluate((node, scrollTop) => {
      node.scrollTop = scrollTop;
    }, screenshotMetadata.state.scrollTop);
    await expect
      .poll(() =>
        page.locator(".story-milestones").evaluate((node) => node.scrollTop),
      )
      .toBe(screenshotMetadata.state.scrollTop);
    await page.evaluate(() => document.fonts.ready);
    for (const canvas of await page.locator(".story-milestones canvas").all()) {
      await expect(canvas).toHaveAttribute("data-rendered", "true");
    }
    await page.mouse.move(1439, 899);
    await page.evaluate(() => {
      for (const animation of document.getAnimations()) {
        animation.pause();
        animation.currentTime = 0;
      }
    });
    if (process.platform !== "linux") {
      await expect(page).toHaveScreenshot(`${screenshotName}.png`, {
        maxDiffPixels: 0,
      });
    }
  });
}

for (const theme of ["light", "dark"] as const) {
  test(`matches the pinned first-Blacksmith and first-Clay Remix Story ${theme} screens`, async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const screenshotName = `story-first-blacksmith-${theme}-1440x900`;
    const screenshotMetadata = JSON.parse(
      await readFile(
        new URL(`../fixtures/visual/${screenshotName}.json`, import.meta.url),
        "utf8",
      ),
    ) as {
      gameTheme: string;
      randomSeed: number;
      state: {
        page: number;
        notifications: number;
        highestUnlocked: number;
        mineObjectLevel: number;
        highestMineObjectLevel: number;
        currentObjectName: string;
        currentObjectHp: string;
        money: string;
        gems: string;
        blacksmithLevel: number;
        scrollTop: number;
        visibleMilestones: string[];
        nextObjective: string;
      };
    };
    const clayScreenshotName = `story-first-clay-${theme}-1440x900`;
    const clayMetadata = JSON.parse(
      await readFile(
        new URL(
          `../fixtures/visual/${clayScreenshotName}.json`,
          import.meta.url,
        ),
        "utf8",
      ),
    ) as {
      gameTheme: string;
      randomSeed: number;
      activeDamage: string;
      activeCanvasClicks: number;
      craftAttempts: Array<{
        attempt: number;
        gemsBefore: string;
        gems: string;
        activeDamage: string;
        miningStatsText: string;
      }>;
      clayFirstHitState: { currentObjectHpText: string };
      state: {
        page: number;
        notifications: number;
        highestUnlocked: number;
        mineObjectLevel: number;
        highestMineObjectLevel: number;
        currentObjectName: string;
        currentObjectHp: string;
        money: string;
        gems: string;
        pickaxeName: string;
        pickaxePower: string;
        pickaxeQuality: string;
        pickaxeDamage: string;
        blacksmithLevel: number;
        scrollTop: number;
        visibleMilestones: string[];
        nextObjective: string;
      };
    };
    expect(screenshotMetadata.gameTheme).toBe(theme);
    expect(clayMetadata.gameTheme).toBe(theme);
    expect(clayMetadata.randomSeed).toBe(screenshotMetadata.randomSeed);
    expect(clayMetadata.craftAttempts).toHaveLength(2);
    expect(clayMetadata.craftAttempts[0]).toMatchObject({
      attempt: 1,
      gemsBefore: "5",
      gems: "4",
      activeDamage: "0",
    });
    expect(clayMetadata.craftAttempts[1]).toMatchObject({
      attempt: 2,
      gemsBefore: "4",
      gems: "3",
      activeDamage: clayMetadata.activeDamage,
    });
    expect(clayMetadata.activeCanvasClicks).toBe(53);
    expect(screenshotMetadata.state).toMatchObject({
      page: 0,
      notifications: 0,
      highestUnlocked: 4,
      mineObjectLevel: 2,
      highestMineObjectLevel: 3,
      currentObjectName: "Salt",
      currentObjectHp: "700",
      money: "4",
      gems: "5",
      blacksmithLevel: 1,
      scrollTop: 0,
      visibleMilestones: [
        "gameStart",
        "firstMud",
        "firstPaper",
        "blacksmithUpgrade",
        "firstSalt",
      ],
      nextObjective: "Mine a piece of Clay",
    });

    const fixedClock = 1_704_067_200_000;
    const serialized = await createFreshBeyondVisualSave({
      clockMs: fixedClock,
      theme,
      tab: "main",
    });
    await page.addInitScript(
      ({ now, save, seed }) => {
        localStorage.clear();
        localStorage.setItem("IdleMineBeyond", save);
        Object.defineProperty(Date, "now", {
          configurable: true,
          value: () => now,
        });
        let randomState = seed >>> 0;
        Math.random = () => {
          randomState =
            (Math.imul(randomState, 1_664_525) + 1_013_904_223) >>> 0;
          return randomState / 0x1_0000_0000;
        };
      },
      {
        now: fixedClock,
        save: serialized,
        seed: screenshotMetadata.randomSeed,
      },
    );
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(page.locator("#app")).toHaveAttribute(
      "data-app-state",
      "ready",
    );
    await expect(page.locator("#app")).toHaveAttribute("data-theme", theme);

    const mineCanvas = page.locator(".mineobject canvas.mine-object");
    const storyTab = page.locator("[data-game-tab='story']");
    for (let hit = 0; hit < 5; hit += 1) await mineCanvas.click();
    await expect(storyTab.locator("span.notification")).toHaveText("2");
    await storyTab.click();
    await expect(
      page.locator('.story-milestones [data-story-milestone-key="firstMud"]'),
    ).toBeVisible();

    await page.locator("[data-game-tab='mining']").click();
    await page.locator('button[aria-label="Next mine object"]').click();
    await expect(mineCanvas).toHaveAttribute("data-level", "1");
    for (let hit = 0; hit < 24; hit += 1) await mineCanvas.click();
    await expect(page.locator("[data-mine-object-hp]")).toHaveText("HP: 400");
    await expect(page.locator("header")).toContainText("12 $");
    await expect(storyTab.locator("span.notification")).toHaveText("1");
    await storyTab.click();
    await expect(
      page.locator('.story-milestones [data-story-milestone-key="firstPaper"]'),
    ).toBeVisible();

    await page.locator("[data-game-tab='mining']").click();
    await page.locator('button[aria-label="Next mine object"]').click();
    await expect(mineCanvas).toHaveAttribute("data-level", "2");
    await expect(page.locator(".mineobject h2")).toHaveText("Salt");
    await expect(page.locator("[data-mine-object-hp]")).toHaveText("HP: 700");
    for (let hit = 0; hit < 139; hit += 1) await mineCanvas.click();
    await expect(page.locator("[data-mine-object-hp]")).toHaveText("HP: 5");
    await mineCanvas.click();
    await expect(page.locator("[data-mine-object-hp]")).toHaveText("HP: 700");
    await expect(page.locator("header")).toContainText("34 $");
    await expect(storyTab.locator("span.notification")).toHaveText("1");

    const blacksmith = page.locator(
      '[data-upgrade-group="money"][data-upgrade-key="blacksmith"]',
    );
    await expect(blacksmith).toHaveAttribute("data-upgrade-level", "0");
    await expect(blacksmith).not.toHaveClass(/cantafford/);
    await blacksmith.click();
    await expect(blacksmith).toHaveAttribute("data-upgrade-level", "1");
    await expect(page.locator("header")).toContainText("4 $");
    await expect(storyTab.locator("span.notification")).toHaveText("1");

    await storyTab.click();
    await expect(page.locator("article.story")).toBeVisible();
    await expect(storyTab.locator("span.notification")).toHaveCount(0);
    const milestones = page.locator(
      ".story-milestones > div[data-story-milestone-key]",
    );
    await expect(milestones).toHaveCount(5);
    expect(
      await milestones.evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("data-story-milestone-key")),
      ),
    ).toEqual(screenshotMetadata.state.visibleMilestones);
    await expect(page.locator(".objective")).toContainText(
      screenshotMetadata.state.nextObjective,
    );
    await expect(page.locator("header")).toContainText("4 $");
    await expect(page.locator("header")).toContainText("5");
    await page.locator(".story-milestones").evaluate((node, scrollTop) => {
      node.scrollTop = scrollTop;
    }, screenshotMetadata.state.scrollTop);
    await expect
      .poll(() =>
        page.locator(".story-milestones").evaluate((node) => node.scrollTop),
      )
      .toBe(screenshotMetadata.state.scrollTop);
    await page.evaluate(() => document.fonts.ready);
    for (const canvas of await page.locator(".story-milestones canvas").all()) {
      await expect(canvas).toHaveAttribute("data-rendered", "true");
    }
    await page.mouse.move(1439, 899);
    await page.evaluate(() => {
      for (const animation of document.getAnimations()) {
        animation.pause();
        animation.currentTime = 0;
      }
    });
    if (process.platform !== "linux") {
      await expect(page).toHaveScreenshot(`${screenshotName}.png`, {
        maxDiffPixels: 0,
      });
    }

    await page.locator("[data-game-tab='mining']").click();
    await page.locator('button[aria-label="Next mine object"]').click();
    await expect(mineCanvas).toHaveAttribute("data-level", "3");
    await expect(page.locator(".mineobject h2")).toHaveText("Clay");
    const clayHp = page.locator("[data-mine-object-hp]");
    await expect(clayHp).toContainText("1,400");
    await expect(page.locator("header > span").first()).toHaveText("4 $");
    await expect(page.locator("header > span.inline-resource")).toHaveText("5");
    const stats = page.locator(".stats");
    const normalizeStats = (value: string) => value.replace(/\s+/g, " ").trim();
    const initialClayHp = await clayHp.innerText();
    await expect(stats).toContainText("Toy Pickaxe");
    await expect(stats).toContainText("Damage/click");
    await expect(stats).toContainText("Base Dmg: 20");
    await mineCanvas.click();
    await expect(clayHp).toHaveText(initialClayHp);

    for (const attempt of clayMetadata.craftAttempts) {
      await page.locator("[data-craft-pickaxe]").click();
      await expect(page.locator("header > span.inline-resource")).toHaveText(
        attempt.gems,
      );
      await expect
        .poll(async () => normalizeStats(await stats.innerText()))
        .toBe(normalizeStats(attempt.miningStatsText));
      if (attempt.activeDamage === "0") {
        await expect(clayHp).toHaveText(initialClayHp);
      }
    }

    await mineCanvas.click();
    await expect(clayHp).toHaveText(
      clayMetadata.clayFirstHitState.currentObjectHpText,
    );
    for (let hit = 1; hit < clayMetadata.activeCanvasClicks; hit += 1) {
      await mineCanvas.click();
    }
    await expect(clayHp).toContainText("1,400");
    await expect(page.locator("header > span").first()).toHaveText("54 $");
    await expect(page.locator("header > span.inline-resource")).toHaveText("3");
    await expect(storyTab.locator("span.notification")).toHaveText("1");
    await storyTab.click();
    await expect(page.locator("article.story")).toBeVisible();
    await expect(storyTab.locator("span.notification")).toHaveCount(0);
    await expect(milestones).toHaveCount(6);
    expect(
      await milestones.evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("data-story-milestone-key")),
      ),
    ).toEqual(clayMetadata.state.visibleMilestones);
    await expect(page.locator(".objective")).toContainText(
      clayMetadata.state.nextObjective,
    );
    await expect(page.locator("header > span").first()).toHaveText("54 $");
    await expect(page.locator("header > span.inline-resource")).toHaveText("3");
    await page.locator(".story-milestones").evaluate((node, scrollTop) => {
      node.scrollTop = scrollTop;
    }, clayMetadata.state.scrollTop);
    await expect
      .poll(() =>
        page.locator(".story-milestones").evaluate((node) => node.scrollTop),
      )
      .toBe(clayMetadata.state.scrollTop);
    await page.evaluate(() => document.fonts.ready);
    for (const canvas of await page.locator(".story-milestones canvas").all()) {
      await expect(canvas).toHaveAttribute("data-rendered", "true");
    }
    await page.mouse.move(1439, 899);
    await page.evaluate(() => {
      for (const animation of document.getAnimations()) {
        animation.pause();
        animation.currentTime = 0;
      }
    });
    if (process.platform !== "linux") {
      await expect(page).toHaveScreenshot(`${clayScreenshotName}.png`, {
        maxDiffPixels: 0,
      });
    }
  });
}

for (const theme of ["light", "dark"] as const) {
  test(`matches the pinned first-Stone Remix Story ${theme} screen`, async ({
    page,
  }) => {
    const screenshotName = `story-first-stone-${theme}-1440x900`;
    const metadata = JSON.parse(
      await readFile(
        new URL(`../fixtures/visual/${screenshotName}.json`, import.meta.url),
        "utf8",
      ),
    ) as {
      gameTheme: string;
      state: {
        page: number;
        highestUnlocked: number;
        mineObjectLevel: number;
        highestMineObjectLevel: number;
        currentObjectName: string;
        currentObjectHp: string;
        money: string;
        gems: string;
        pickaxeName: string;
        pickaxePower: string;
        pickaxeQuality: string;
        blacksmithLevel: number;
        notifications: number;
        scrollTop: number;
        visibleMilestones: string[];
        nextObjective: string;
        chapterHeading: string;
      };
    };
    expect(metadata.gameTheme).toBe(theme);

    const fixedClock = 1_704_067_200_000;
    const serialized = await createBeyondStoryVisualSave({
      clockMs: fixedClock,
      theme,
      source: {
        ...metadata.state,
        story: {
          page: metadata.state.page,
          highestUnlocked: metadata.state.highestUnlocked,
          notifications: metadata.state.notifications,
        },
      },
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
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(page.locator("#app")).toHaveAttribute(
      "data-app-state",
      "ready",
    );
    await expect(page.locator("#app")).toHaveAttribute("data-theme", theme);
    await expect(page.locator("article.story")).toBeVisible();
    await expect(page.locator(".chapter-control h3")).toHaveText(
      metadata.state.chapterHeading,
    );
    await expect(page.locator("[data-story-page]")).toHaveAttribute(
      "data-story-page",
      String(metadata.state.page),
    );
    const milestones = page.locator(
      ".story-milestones > div[data-story-milestone-key]",
    );
    await expect(milestones).toHaveCount(
      metadata.state.visibleMilestones.length,
    );
    expect(
      await milestones.evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("data-story-milestone-key")),
      ),
    ).toEqual(metadata.state.visibleMilestones);
    await expect(page.locator(".objective")).toContainText(
      metadata.state.nextObjective,
    );
    await expect(
      page.locator("[data-game-tab='story'] .notification"),
    ).toHaveCount(metadata.state.notifications);
    await page.locator(".story-milestones").evaluate((node, scrollTop) => {
      node.scrollTop = scrollTop;
    }, metadata.state.scrollTop);
    await expect
      .poll(() =>
        page.locator(".story-milestones").evaluate((node) => node.scrollTop),
      )
      .toBe(metadata.state.scrollTop);
    await page.evaluate(() => document.fonts.ready);
    for (const canvas of await page.locator(".story-milestones canvas").all()) {
      await expect(canvas).toHaveAttribute("data-rendered", "true");
    }
    await page.mouse.move(1439, 899);
    await page.evaluate(() => {
      for (const animation of document.getAnimations()) {
        animation.pause();
        animation.currentTime = 0;
      }
    });
    if (process.platform !== "linux") {
      await expect(page).toHaveScreenshot(`${screenshotName}.png`, {
        maxDiffPixels: 0,
      });
    }
  });
}

for (const theme of ["light", "dark"] as const) {
  test(`matches the pinned 10,000-Money Remix Story ${theme} screen`, async ({
    page,
  }) => {
    const screenshotName = `story-ten-thousand-${theme}-1440x900`;
    const metadata = JSON.parse(
      await readFile(
        new URL(`../fixtures/visual/${screenshotName}.json`, import.meta.url),
        "utf8",
      ),
    ) as {
      gameTheme: string;
      state: {
        page: number;
        highestUnlocked: number;
        mineObjectLevel: number;
        highestMineObjectLevel: number;
        currentObjectName: string;
        currentObjectHp: string;
        money: string;
        gems: string;
        pickaxeName: string;
        pickaxePower: string;
        pickaxeQuality: string;
        blacksmithLevel: number;
        notifications: number;
        scrollTop: number;
        visibleMilestones: string[];
        nextObjective: string;
        chapterHeading: string;
      };
    };
    expect(metadata.gameTheme).toBe(theme);
    expect(metadata.state).toMatchObject({
      page: 1,
      highestUnlocked: 7,
      mineObjectLevel: 4,
      highestMineObjectLevel: 5,
      currentObjectName: "Rock",
      currentObjectHp: "2200",
      money: "10053",
      gems: "7",
      blacksmithLevel: 2,
      notifications: 0,
      visibleMilestones: ["firstStone", "tenThousand"],
      nextObjective:
        "Mine a Spooky Bone (6 / 14) (Reach Mineral number 13 and break it to reach mineral number 14)",
      chapterHeading: "Chapter 2: The real Adventure begins!",
    });

    const fixedClock = 1_704_067_200_000;
    const serialized = await createBeyondStoryVisualSave({
      clockMs: fixedClock,
      theme,
      source: {
        ...metadata.state,
        story: {
          page: metadata.state.page,
          highestUnlocked: metadata.state.highestUnlocked,
          notifications: metadata.state.notifications,
        },
      },
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
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(page.locator("#app")).toHaveAttribute(
      "data-app-state",
      "ready",
    );
    await expect(page.locator("#app")).toHaveAttribute("data-theme", theme);
    await expect(page.locator("article.story")).toBeVisible();
    await expect(page.locator("[data-story-page]")).toHaveAttribute(
      "data-story-page",
      "1",
    );
    await expect(page.locator(".chapter-control h3")).toHaveText(
      metadata.state.chapterHeading,
    );
    const milestones = page.locator(
      ".story-milestones > div[data-story-milestone-key]",
    );
    await expect(milestones).toHaveCount(2);
    expect(
      await milestones.evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("data-story-milestone-key")),
      ),
    ).toEqual(metadata.state.visibleMilestones);
    await expect(page.locator(".objective")).toContainText(
      metadata.state.nextObjective,
    );
    await expect(page.locator("header")).toContainText("10,053 $");
    await expect(
      page.locator("[data-game-tab='story'] .notification"),
    ).toHaveCount(0);
    await page.locator(".story-milestones").evaluate((node, scrollTop) => {
      node.scrollTop = scrollTop;
    }, metadata.state.scrollTop);
    await expect
      .poll(() =>
        page.locator(".story-milestones").evaluate((node) => node.scrollTop),
      )
      .toBe(metadata.state.scrollTop);
    await page.evaluate(() => document.fonts.ready);
    for (const canvas of await page.locator(".story-milestones canvas").all()) {
      await expect(canvas).toHaveAttribute("data-rendered", "true");
    }
    await page.mouse.move(1439, 899);
    await page.evaluate(() => {
      for (const animation of document.getAnimations()) {
        animation.pause();
        animation.currentTime = 0;
      }
    });
    if (process.platform !== "linux") {
      await expect(page).toHaveScreenshot(`${screenshotName}.png`, {
        maxDiffPixels: 0,
      });
    }
  });
}

for (const theme of ["light", "dark"] as const) {
  test(`matches the natural millionaire Remix Story ${theme} screen`, async ({
    page,
  }) => {
    const screenshotName = `story-millionaire-${theme}-1440x900`;
    const metadata = JSON.parse(
      await readFile(
        new URL(`../fixtures/visual/${screenshotName}.json`, import.meta.url),
        "utf8",
      ),
    ) as {
      gameTheme: string;
      state: {
        page: number;
        highestUnlocked: number;
        mineObjectLevel: number;
        highestMineObjectLevel: number;
        currentObjectName: string;
        currentObjectHp: string;
        money: string;
        highestMoney: string;
        gems: string;
        pickaxeName: string;
        pickaxePower: string;
        pickaxeQuality: string;
        blacksmithLevel: number;
        notifications: number;
        scrollTop: number;
        visibleMilestones: string[];
        firstSpookyBoneUnlocked: boolean;
        millionaireUnlocked: boolean;
        nextObjective: string;
        chapterHeading: string;
      };
    };
    expect(metadata.gameTheme).toBe(theme);
    expect(metadata.state).toMatchObject({
      page: 1,
      highestUnlocked: 9,
      mineObjectLevel: 4,
      highestMineObjectLevel: 5,
      currentObjectName: "Rock",
      currentObjectHp: "2200",
      money: "1000053.0000000001",
      highestMoney: "1000053.0000000001",
      gems: "182",
      blacksmithLevel: 2,
      notifications: 0,
      visibleMilestones: ["firstStone", "tenThousand", "millionaire"],
      firstSpookyBoneUnlocked: false,
      millionaireUnlocked: true,
      nextObjective:
        "Mine a Spooky Bone (6 / 14) (Reach Mineral number 13 and break it to reach mineral number 14)",
      chapterHeading: "Chapter 2: The real Adventure begins!",
    });

    const fixedClock = 1_704_067_200_000;
    const serialized = await createBeyondStoryVisualSave({
      clockMs: fixedClock,
      theme,
      source: {
        ...metadata.state,
        story: {
          page: metadata.state.page,
          highestUnlocked: metadata.state.highestUnlocked,
          notifications: metadata.state.notifications,
        },
      },
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
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(page.locator("#app")).toHaveAttribute(
      "data-app-state",
      "ready",
    );
    await expect(page.locator("#app")).toHaveAttribute("data-theme", theme);
    await expect(page.locator("article.story")).toBeVisible();
    await expect(page.locator("[data-story-page]")).toHaveAttribute(
      "data-story-page",
      "1",
    );
    await expect(page.locator(".chapter-control h3")).toHaveText(
      metadata.state.chapterHeading,
    );
    const milestones = page.locator(
      ".story-milestones > div[data-story-milestone-key]",
    );
    await expect(milestones).toHaveCount(3);
    expect(
      await milestones.evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("data-story-milestone-key")),
      ),
    ).toEqual(metadata.state.visibleMilestones);
    await expect(page.locator(".objective")).toContainText(
      metadata.state.nextObjective,
    );
    await expect(page.locator("header")).toContainText("1,000,053 $");
    await expect(
      page.locator("[data-game-tab='story'] .notification"),
    ).toHaveCount(0);
    await page.locator(".story-milestones").evaluate((node, scrollTop) => {
      node.scrollTop = scrollTop;
    }, metadata.state.scrollTop);
    await expect
      .poll(() =>
        page.locator(".story-milestones").evaluate((node) => node.scrollTop),
      )
      .toBe(metadata.state.scrollTop);
    await page.evaluate(() => document.fonts.ready);
    for (const canvas of await page.locator(".story-milestones canvas").all()) {
      await expect(canvas).toHaveAttribute("data-rendered", "true");
    }
    await page.mouse.move(1439, 899);
    await page.evaluate(() => {
      for (const animation of document.getAnimations()) {
        animation.pause();
        animation.currentTime = 0;
      }
    });
    if (process.platform !== "linux") {
      await expect(page).toHaveScreenshot(`${screenshotName}.png`, {
        maxDiffPixels: 0,
      });
    }
  });
}

for (const theme of ["light", "dark"] as const) {
  test(`matches the scrolled natural millionaire Remix Story ${theme} screen`, async ({
    page,
  }) => {
    const screenshotName = `story-millionaire-scrolled-${theme}-1440x900`;
    const metadata = JSON.parse(
      await readFile(
        new URL(`../fixtures/visual/${screenshotName}.json`, import.meta.url),
        "utf8",
      ),
    ) as {
      gameTheme: string;
      state: {
        page: number;
        highestUnlocked: number;
        mineObjectLevel: number;
        highestMineObjectLevel: number;
        currentObjectHp: string;
        money: string;
        highestMoney: string;
        gems: string;
        pickaxeName: string;
        pickaxePower: string;
        pickaxeQuality: string;
        blacksmithLevel: number;
        notifications: number;
        visibleMilestones: string[];
        nextObjective: string;
        chapterHeading: string;
      };
      scrollCapture: {
        beforeScrollTop: number;
        targetFullyVisibleAtInitial: boolean;
        scrollTop: number;
        maxScrollTop: number;
        targetFullyVisible: boolean;
      };
    };
    expect(metadata.gameTheme).toBe(theme);
    expect(metadata.scrollCapture).toMatchObject({
      beforeScrollTop: 0,
      targetFullyVisibleAtInitial: false,
      targetFullyVisible: true,
    });

    const fixedClock = 1_704_067_200_000;
    const serialized = await createBeyondStoryVisualSave({
      clockMs: fixedClock,
      theme,
      source: {
        ...metadata.state,
        story: {
          page: metadata.state.page,
          highestUnlocked: metadata.state.highestUnlocked,
          notifications: metadata.state.notifications,
        },
      },
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
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(page.locator("#app")).toHaveAttribute(
      "data-app-state",
      "ready",
    );
    await expect(page.locator("#app")).toHaveAttribute("data-theme", theme);
    await expect(page.locator("[data-story-page]")).toHaveAttribute(
      "data-story-page",
      "1",
    );
    await expect(page.locator(".chapter-control h3")).toHaveText(
      metadata.state.chapterHeading,
    );
    const milestones = page.locator(
      ".story-milestones > div[data-story-milestone-key]",
    );
    await expect(milestones).toHaveCount(3);
    expect(
      await milestones.evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("data-story-milestone-key")),
      ),
    ).toEqual(metadata.state.visibleMilestones);
    const millionaire = page.locator(
      '[data-story-milestone-key="millionaire"]',
    );
    await expect(millionaire).toContainText("you've just reached a Million");
    await expect(page.locator(".objective")).toContainText(
      metadata.state.nextObjective,
    );
    await expect(page.locator("header")).toContainText("1,000,053 $");
    await page.locator(".story-milestones").evaluate((node) => {
      node.scrollTop = node.scrollHeight - node.clientHeight;
    });
    const scrollMetrics = await millionaire.evaluate((target) => {
      const scroller = target.closest(".story-milestones");
      if (!scroller) throw new Error("Millionaire has no Story scroller.");
      const scrollerBounds = scroller.getBoundingClientRect();
      const targetBounds = target.getBoundingClientRect();
      return {
        scrollTop: scroller.scrollTop,
        maxScrollTop: scroller.scrollHeight - scroller.clientHeight,
        targetFullyVisible:
          targetBounds.top >= scrollerBounds.top &&
          targetBounds.bottom <= scrollerBounds.bottom,
      };
    });
    expect(scrollMetrics.targetFullyVisible).toBe(true);
    expect(scrollMetrics.maxScrollTop).toBeGreaterThan(0);
    expect(scrollMetrics.scrollTop).toBe(scrollMetrics.maxScrollTop);
    if (process.platform !== "linux") {
      expect(scrollMetrics.scrollTop).toBe(metadata.scrollCapture.scrollTop);
      expect(scrollMetrics.maxScrollTop).toBe(
        metadata.scrollCapture.maxScrollTop,
      );
    }
    await page.evaluate(() => document.fonts.ready);
    for (const canvas of await page.locator(".story-milestones canvas").all()) {
      await expect(canvas).toHaveAttribute("data-rendered", "true");
    }
    await page.mouse.move(1439, 899);
    await page.evaluate(() => {
      for (const animation of document.getAnimations()) {
        animation.pause();
        animation.currentTime = 0;
      }
    });
    if (process.platform !== "linux") {
      await expect(page).toHaveScreenshot(`${screenshotName}.png`, {
        maxDiffPixels: 0,
      });
    }
  });
}

for (const theme of ["light", "dark"] as const) {
  test(`matches the controlled first-Spooky-Bone Remix Story ${theme} screen`, async ({
    page,
  }) => {
    const screenshotName = `story-spooky-bone-${theme}-1440x900`;
    const metadata = JSON.parse(
      await readFile(
        new URL(`../fixtures/visual/${screenshotName}.json`, import.meta.url),
        "utf8",
      ),
    ) as {
      gameTheme: string;
      state: {
        page: number;
        highestUnlocked: number;
        mineObjectLevel: number;
        highestMineObjectLevel: number;
        currentObjectName: string;
        currentObjectHp: string;
        money: string;
        gems: string;
        pickaxeName: string;
        pickaxePower: string;
        pickaxeQuality: string;
        blacksmithLevel: number;
        notifications: number;
        scrollTop: number;
        visibleMilestones: string[];
        firstSpookyBoneUnlocked: boolean;
        nextObjective: string;
        chapterHeading: string;
      };
    };
    expect(metadata.gameTheme).toBe(theme);
    expect(metadata.state).toMatchObject({
      page: 1,
      highestUnlocked: 8,
      mineObjectLevel: 12,
      highestMineObjectLevel: 13,
      currentObjectName: "Spooky Bone",
      currentObjectHp: "92000",
      money: "10053",
      gems: "7",
      blacksmithLevel: 2,
      notifications: 0,
      visibleMilestones: ["firstStone", "tenThousand", "firstSpookyBone"],
      firstSpookyBoneUnlocked: true,
      nextObjective: "Have 1,000,000 $ on hand",
      chapterHeading: "Chapter 2: The real Adventure begins!",
    });

    const fixedClock = 1_704_067_200_000;
    const serialized = await createBeyondStoryVisualSave({
      clockMs: fixedClock,
      theme,
      source: {
        ...metadata.state,
        story: {
          page: metadata.state.page,
          highestUnlocked: metadata.state.highestUnlocked,
          notifications: metadata.state.notifications,
        },
      },
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
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(page.locator("#app")).toHaveAttribute(
      "data-app-state",
      "ready",
    );
    await expect(page.locator("#app")).toHaveAttribute("data-theme", theme);
    await expect(page.locator("article.story")).toBeVisible();
    await expect(page.locator("[data-story-page]")).toHaveAttribute(
      "data-story-page",
      "1",
    );
    await expect(page.locator(".chapter-control h3")).toHaveText(
      metadata.state.chapterHeading,
    );
    const milestones = page.locator(
      ".story-milestones > div[data-story-milestone-key]",
    );
    await expect(milestones).toHaveCount(3);
    expect(
      await milestones.evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("data-story-milestone-key")),
      ),
    ).toEqual(metadata.state.visibleMilestones);
    await expect(page.locator(".objective")).toContainText(
      metadata.state.nextObjective,
    );
    await expect(page.locator("header")).toContainText("10,053 $");
    await expect(
      page.locator("[data-game-tab='story'] .notification"),
    ).toHaveCount(0);
    await page.locator(".story-milestones").evaluate((node, scrollTop) => {
      node.scrollTop = scrollTop;
    }, metadata.state.scrollTop);
    await expect
      .poll(() =>
        page.locator(".story-milestones").evaluate((node) => node.scrollTop),
      )
      .toBe(metadata.state.scrollTop);
    await page.evaluate(() => document.fonts.ready);
    for (const canvas of await page.locator(".story-milestones canvas").all()) {
      await expect(canvas).toHaveAttribute("data-rendered", "true");
    }
    await page.mouse.move(1439, 899);
    await page.evaluate(() => {
      for (const animation of document.getAnimations()) {
        animation.pause();
        animation.currentTime = 0;
      }
    });
    if (process.platform !== "linux") {
      await expect(page).toHaveScreenshot(`${screenshotName}.png`, {
        maxDiffPixels: 0,
      });
    }
  });
}

test("matches the natural Chapter 3 Remix Story screen", async ({ page }) => {
  const screenshotName = "story-natural-chapter-3-light-1440x900";
  const metadata = JSON.parse(
    await readFile(
      new URL(`../fixtures/visual/${screenshotName}.json`, import.meta.url),
      "utf8",
    ),
  ) as {
    gameTheme: string;
    clockMs: number;
    randomSeed: number;
    state: {
      page: number;
      highestUnlocked: number;
      maxStoryPage: number;
      mineObjectLevel: number;
      highestMineObjectLevel: number;
      currentObjectHp: string;
      money: string;
      highestMoney: string;
      gems: string;
      pickaxeName: string;
      pickaxePower: string;
      pickaxeQuality: string;
      blacksmithLevel: number;
      gemWasterLevel?: number;
      notifications: number;
      scrollTop: number;
      visibleMilestones: string[];
      nextObjective: string;
      chapterHeading: string;
    };
    route: {
      seed: number;
      startingDraws: number;
      checkpoints: number;
    };
  };
  expect(metadata.gameTheme).toBe("light");
  expect(metadata.route).toMatchObject({
    seed: 7454,
    startingDraws: 8461,
    checkpoints: 212,
  });
  expect(metadata.state).toMatchObject({
    page: 2,
    highestUnlocked: 12,
    maxStoryPage: 2,
    mineObjectLevel: 26,
    highestMineObjectLevel: 27,
    money: "4816780575.35893",
    gems: "146",
    notifications: 0,
    scrollTop: 0,
    visibleMilestones: ["unrealStones"],
    nextObjective: "Upgrade Gem Waster to Level 1",
    chapterHeading: "Chapter 3: Mysterious Materials",
  });

  const fixedClock = metadata.clockMs;
  const serialized = await createBeyondStoryVisualSave({
    clockMs: fixedClock,
    theme: "light",
    source: {
      mineObjectLevel: metadata.state.mineObjectLevel,
      highestMineObjectLevel: metadata.state.highestMineObjectLevel,
      currentObjectHp: metadata.state.currentObjectHp,
      money: metadata.state.money,
      highestMoney: metadata.state.highestMoney,
      gems: metadata.state.gems,
      pickaxeName: metadata.state.pickaxeName,
      pickaxePower: metadata.state.pickaxePower,
      pickaxeQuality: metadata.state.pickaxeQuality,
      blacksmithLevel: metadata.state.blacksmithLevel,
      ...(metadata.state.gemWasterLevel === undefined
        ? {}
        : { gemWasterLevel: metadata.state.gemWasterLevel }),
      story: {
        page: metadata.state.page,
        highestUnlocked: metadata.state.highestUnlocked,
        notifications: metadata.state.notifications,
      },
    },
  });
  await page.addInitScript(
    ({ now, save, seed }) => {
      localStorage.clear();
      localStorage.setItem("IdleMineBeyond", save);
      Object.defineProperty(Date, "now", {
        configurable: true,
        value: () => now,
      });
      let randomState = seed >>> 0;
      Math.random = () => {
        randomState = (Math.imul(randomState, 1_664_525) + 1_013_904_223) >>> 0;
        return randomState / 0x1_0000_0000;
      };
    },
    { now: fixedClock, save: serialized, seed: metadata.randomSeed },
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready");
  await expect(page.locator("#app")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("article.story")).toBeVisible();
  await expect(page.locator("[data-story-page]")).toHaveAttribute(
    "data-story-page",
    "2",
  );
  await expect(page.locator(".chapter-control h3")).toHaveText(
    metadata.state.chapterHeading,
  );
  const milestones = page.locator(
    ".story-milestones > div[data-story-milestone-key]",
  );
  await expect(milestones).toHaveCount(1);
  await expect(milestones).toHaveAttribute(
    "data-story-milestone-key",
    "unrealStones",
  );
  await expect(page.locator(".objective")).toContainText(
    metadata.state.nextObjective,
  );
  await expect(page.locator("header")).toContainText("4,816,780,575 $");
  await expect(page.locator("header")).toContainText("146");
  await expect(
    page.locator("[data-game-tab='story'] .notification"),
  ).toHaveCount(0);
  await expect
    .poll(() =>
      page.locator(".story-milestones").evaluate((node) => node.scrollTop),
    )
    .toBe(metadata.state.scrollTop);
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(1439, 899);
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) {
      animation.pause();
      animation.currentTime = 0;
    }
  });
  if (process.platform !== "linux") {
    await expect(page).toHaveScreenshot(`${screenshotName}.png`, {
      maxDiffPixels: 0,
    });
  }
});

test("matches the natural Chapter 4 Remix Story screen", async ({ page }) => {
  const screenshotName = "story-natural-chapter-4-light-1440x900";
  const metadata = JSON.parse(
    await readFile(
      new URL(`../fixtures/visual/${screenshotName}.json`, import.meta.url),
      "utf8",
    ),
  ) as {
    gameTheme: string;
    clockMs: number;
    randomSeed: number;
    state: {
      page: number;
      highestUnlocked: number;
      maxStoryPage: number;
      mineObjectLevel: number;
      highestMineObjectLevel: number;
      currentObjectHp: string;
      money: string;
      highestMoney: string;
      gems: string;
      pickaxeName: string;
      pickaxePower: string;
      pickaxeQuality: string;
      blacksmithLevel: number;
      gemWasterLevel: number;
      notifications: number;
      scrollTop: number;
      visibleMilestones: string[];
      nextObjective: string;
      chapterHeading: string;
    };
    route: {
      seed: number;
      startingDraws: number;
      checkpoints: number;
    };
  };
  expect(metadata.gameTheme).toBe("light");
  expect(metadata.route).toMatchObject({
    seed: 7454,
    startingDraws: 8922,
    checkpoints: 1689,
  });
  expect(metadata.state).toMatchObject({
    page: 3,
    highestUnlocked: 19,
    maxStoryPage: 3,
    mineObjectLevel: 54,
    highestMineObjectLevel: 55,
    money: "20034557385697100000",
    gems: "0",
    notifications: 0,
    scrollTop: 0,
    visibleMilestones: ["infinitum"],
    nextObjective: "Reach THE GEM (56 / 61)",
    chapterHeading: "Chapter 4: It's NOT over",
  });

  const fixedClock = metadata.clockMs;
  const serialized = await createBeyondStoryVisualSave({
    clockMs: fixedClock,
    theme: "light",
    source: {
      mineObjectLevel: metadata.state.mineObjectLevel,
      highestMineObjectLevel: metadata.state.highestMineObjectLevel,
      currentObjectHp: metadata.state.currentObjectHp,
      money: metadata.state.money,
      highestMoney: metadata.state.highestMoney,
      gems: metadata.state.gems,
      pickaxeName: metadata.state.pickaxeName,
      pickaxePower: metadata.state.pickaxePower,
      pickaxeQuality: metadata.state.pickaxeQuality,
      blacksmithLevel: metadata.state.blacksmithLevel,
      gemWasterLevel: metadata.state.gemWasterLevel,
      story: {
        page: metadata.state.page,
        highestUnlocked: metadata.state.highestUnlocked,
        notifications: metadata.state.notifications,
      },
    },
  });
  await page.addInitScript(
    ({ now, save, seed }) => {
      localStorage.clear();
      localStorage.setItem("IdleMineBeyond", save);
      Object.defineProperty(Date, "now", {
        configurable: true,
        value: () => now,
      });
      let randomState = seed >>> 0;
      Math.random = () => {
        randomState = (Math.imul(randomState, 1_664_525) + 1_013_904_223) >>> 0;
        return randomState / 0x1_0000_0000;
      };
    },
    { now: fixedClock, save: serialized, seed: metadata.randomSeed },
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready");
  await expect(page.locator("#app")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("article.story")).toBeVisible();
  await expect(page.locator("[data-story-page]")).toHaveAttribute(
    "data-story-page",
    "3",
  );
  await expect(page.locator(".chapter-control h3")).toHaveText(
    metadata.state.chapterHeading,
  );
  const milestones = page.locator(
    ".story-milestones > div[data-story-milestone-key]",
  );
  await expect(milestones).toHaveCount(1);
  await expect(milestones).toHaveAttribute(
    "data-story-milestone-key",
    "infinitum",
  );
  await expect(page.locator(".objective")).toContainText(
    metadata.state.nextObjective,
  );
  await expect(page.locator("header")).toContainText("20.03 Qt $");
  await expect(page.locator("header")).toContainText("0");
  await expect(
    page.locator("[data-game-tab='story'] .notification"),
  ).toHaveCount(0);
  await expect
    .poll(() =>
      page.locator(".story-milestones").evaluate((node) => node.scrollTop),
    )
    .toBe(metadata.state.scrollTop);
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(1439, 899);
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) {
      animation.pause();
      animation.currentTime = 0;
    }
  });
  if (process.platform !== "linux") {
    await expect(page).toHaveScreenshot(`${screenshotName}.png`, {
      maxDiffPixels: 0,
    });
  }
});

test("matches the natural Chapter 5 Remix Story screen", async ({ page }) => {
  const screenshotName = "story-natural-chapter-5-light-1440x900";
  const metadata = JSON.parse(
    await readFile(
      new URL(`../fixtures/visual/${screenshotName}.json`, import.meta.url),
      "utf8",
    ),
  ) as {
    gameTheme: string;
    clockMs: number;
    route: { seed: number; startingDraws: number; checkpoints: number };
    state: {
      page: number;
      highestUnlocked: number;
      maxStoryPage: number;
      highestMineObjectLevel: number;
      notifications: number;
      scrollTop: number;
      visibleMilestones: string[];
      nextObjective: string;
      chapterHeading: string;
    };
  };
  const runtime = JSON.parse(
    await readFile(
      new URL("../fixtures/parity/remix-story-runtime.json", import.meta.url),
      "utf8",
    ),
  ) as {
    spookyBoneProgression: {
      millionaireProgression: {
        chapter5Progression: {
          saveString: string;
          trace: { records: number };
        };
      };
    };
  };
  const sourceRoute =
    runtime.spookyBoneProgression.millionaireProgression.chapter5Progression;
  expect(metadata.gameTheme).toBe("light");
  expect(metadata.route).toMatchObject({
    seed: 7454,
    startingDraws: 9697,
    checkpoints: sourceRoute.trace.records,
  });
  expect(metadata.state).toMatchObject({
    page: 4,
    highestMineObjectLevel: 71,
    highestUnlocked: 23,
    maxStoryPage: 4,
    notifications: 0,
    scrollTop: 0,
    visibleMilestones: ["reachPortal"],
    nextObjective: "Break through THE PORTAL",
    chapterHeading: "Chapter 5: New Dimensions",
  });

  const serialized = await createBeyondStoryVisualSaveFromRemixSave({
    clockMs: metadata.clockMs,
    theme: "light",
    saveString: sourceRoute.saveString,
  });
  await page.addInitScript(
    ({ now, save, seed }) => {
      localStorage.clear();
      localStorage.setItem("IdleMineBeyond", save);
      Object.defineProperty(Date, "now", {
        configurable: true,
        value: () => now,
      });
      let randomState = seed >>> 0;
      Math.random = () => {
        randomState = (Math.imul(randomState, 1_664_525) + 1_013_904_223) >>> 0;
        return randomState / 0x1_0000_0000;
      };
    },
    { now: metadata.clockMs, save: serialized, seed: 7454 },
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready");
  await expect(page.locator("#app")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("article.story")).toBeVisible();
  await expect(page.locator("[data-story-page]")).toHaveAttribute(
    "data-story-page",
    "4",
  );
  await expect(page.locator(".chapter-control h3")).toHaveText(
    metadata.state.chapterHeading,
  );
  const milestones = page.locator(
    ".story-milestones > div[data-story-milestone-key]",
  );
  await expect(milestones).toHaveCount(1);
  await expect(milestones).toHaveAttribute(
    "data-story-milestone-key",
    "reachPortal",
  );
  await expect(page.locator(".objective")).toContainText(
    metadata.state.nextObjective,
  );
  await expect(
    page.locator("[data-game-tab='story'] .notification"),
  ).toHaveCount(0);
  await expect
    .poll(() =>
      page.locator(".story-milestones").evaluate((node) => node.scrollTop),
    )
    .toBe(metadata.state.scrollTop);
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(1439, 899);
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) {
      animation.pause();
      animation.currentTime = 0;
    }
  });
  if (process.platform !== "linux") {
    await expect(page).toHaveScreenshot(`${screenshotName}.png`, {
      maxDiffPixels: 0,
    });
  }
});
