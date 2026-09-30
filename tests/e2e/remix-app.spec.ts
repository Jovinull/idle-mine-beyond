import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { encodeRemixLegacySave } from "../../packages/persistence/src/remix-save-codec.js";

type StoryRuntimeFixture = {
  freshGame: {
    chapterHeading: string;
    objectiveHtml: string;
  };
};

type SettingsRuntimeFixture = {
  data: {
    initialState: {
      minimumCraftDamage: { decimal: string };
      numberFormatters: string[];
      settings: {
        numberFormatterIndex: number;
        showMineObjLevel: boolean;
        showMinCraftDamage: boolean;
        theme: string;
      };
      story: { highestUnlocked: number };
    };
    saveApplicationSemantics: {
      inputJson: string;
      resources: { money: { decimal: string } };
    };
    saveExportSemantics: {
      fresh: { object: Record<string, unknown> };
    };
    payUSDebtSemantics: {
      scenarios: {
        name: string;
        events: { type: string; message: string; color?: string }[];
      }[];
    };
    storySemantics: {
      notificationScenarios: {
        name: string;
        after: { highestUnlocked: number; notifications: number };
      }[];
    };
    simulationFrameSemantics: {
      cases: {
        name: string;
        result: {
          highestMineObjectLevel: number;
          story: {
            page: number;
            highestUnlocked: number;
            notifications: number;
          };
        };
      }[];
    };
    pickaxeCraftingSemantics: {
      attempts: {
        randomCalls: number;
        input: {
          name: string;
          gems: string;
          highestMineObjectLevel: number;
          shiftHeld: boolean;
          equippedPickaxe: { name: string; power: string; quality: string };
          randomValues: number[];
        };
        messageLog: { message: string; color: string }[];
        saveSnapshots: {
          gems: { decimal: string };
          pickaxe: {
            name: string;
            power: { decimal: string };
            quality: { decimal: string };
          };
        }[];
        result: {
          gems: { decimal: string };
          pickaxe: {
            name: string;
            power: { decimal: string };
            quality: { decimal: string };
          };
        };
      }[];
    };
    upgradeSemantics: {
      groups: {
        wisdom: Record<string, { name: string; description: string }>;
      };
    };
    powersTableSemantics: { names: string[]; icons: string[] };
  };
};

test("connects the persistent game session to mining and the Story tab", async ({
  page,
}) => {
  const story = JSON.parse(
    await readFile(
      new URL("../fixtures/parity/remix-story-runtime.json", import.meta.url),
      "utf8",
    ),
  ) as StoryRuntimeFixture;
  await page.addInitScript(() => {
    localStorage.clear();
    Date.now = () => 1_700_000_000_000;
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready");
  await expect(
    page.getByRole("heading", { name: "Idle Mine: Remix" }),
  ).toBeVisible();
  await expect(page.locator("[data-mine-object-hp]")).toHaveText("100");

  await page.locator("canvas.mine-object[data-damageable='true']").click();
  await expect(page.locator("[data-mine-object-hp]")).toHaveText("80");

  const moneyUpgrades = page.locator('[data-upgrade-group="money"]');
  await expect(moneyUpgrades).toHaveCount(8);
  await expect(moneyUpgrades.nth(0)).toHaveAttribute(
    "data-upgrade-key",
    "blacksmith",
  );
  await moneyUpgrades.nth(0).hover();
  const blacksmithDetails = page.locator('[data-upgrade-details="blacksmith"]');
  await expect(blacksmithDetails.locator("h3")).toHaveText("Blacksmith");
  await expect(blacksmithDetails).toContainText("20 → 32");
  await expect(blacksmithDetails).toContainText("$ 30");

  const storyTab = page.locator("[data-game-tab='story']");
  await expect(storyTab.locator(".notification")).toBeVisible();
  await storyTab.click();
  await expect(page.locator(".chapter-control h3")).toHaveText(
    story.freshGame.chapterHeading,
  );
  await expect(page.locator(".objective")).toHaveJSProperty(
    "innerHTML",
    story.freshGame.objectiveHtml,
  );
  await expect(storyTab.locator(".notification")).toHaveCount(0);

  await page.locator("[data-story-action='increaseStoryPage']").click();
  await expect(page.locator(".chapter-control h3")).toHaveText(
    story.freshGame.chapterHeading,
  );
  await page.locator("[data-game-tab='mining']").click();
  await page.locator("[data-game-tab='story']").click();
  await expect(page.locator(".chapter-control h3")).toHaveText(
    story.freshGame.chapterHeading,
  );
});

test("refreshes Story notifications from loaded progress and clears them on entry", async ({
  page,
}) => {
  const reference = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-reference-corpus.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as SettingsRuntimeFixture;
  const save = JSON.parse(
    reference.data.saveApplicationSemantics.inputJson,
  ) as {
    highestMoney: string;
    maxPlanetCoins: string;
    mineObjectLevel: number;
    highestMineObjectLevel: number;
    story: {
      page: number;
      notifications: number;
      highestUnlocked: number;
      scrollY: number;
    };
    upgrades: Record<string, { level: number }>;
    powers: { upgrades: Record<string, { level: number }> };
  };
  save.highestMoney = "0";
  save.maxPlanetCoins = "0";
  save.mineObjectLevel = 0;
  save.highestMineObjectLevel = 1;
  save.upgrades["blacksmith"] = { level: 1 };
  save.upgrades["gemWaster"] = { level: 0 };
  save.powers.upgrades = {};
  save.story = {
    page: 0,
    notifications: 0,
    highestUnlocked: -1,
    scrollY: 0,
  };
  const notificationScenario =
    reference.data.storySemantics.notificationScenarios.find(
      ({ name }) =>
        name === "independent-early-milestones-skip-unsatisfied-gap",
    );
  if (!notificationScenario)
    throw new Error("The captured Story notification scenario is missing.");
  await page.addInitScript((legacyJson) => {
    localStorage.clear();
    localStorage.setItem(
      "IdleMine",
      btoa(escape(encodeURIComponent(legacyJson))),
    );
    Date.now = () => 1_700_000_000_000;
  }, JSON.stringify(save));
  await page.goto("/");
  await expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready");

  const storyTab = page.locator("[data-game-tab='story']");
  await expect(storyTab.locator(".notification")).toHaveText(
    String(notificationScenario.after.notifications),
  );
  await storyTab.click();
  await expect(storyTab.locator(".notification")).toHaveCount(0);
  await expect(page.locator(".story-milestones")).toContainText(
    "You mined your first piece of",
  );
});

test("updates Story notifications after an actual idle mining break", async ({
  page,
}) => {
  const reference = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-reference-corpus.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as SettingsRuntimeFixture;
  const save = JSON.parse(
    reference.data.saveApplicationSemantics.inputJson,
  ) as {
    money: string;
    highestMoney: string;
    maxPlanetCoins: string;
    mineObjectLevel: number;
    highestMineObjectLevel: number;
    lastActive: number;
    story: {
      page: number;
      notifications: number;
      highestUnlocked: number;
      scrollY: number;
    };
    settings: { tab: string };
    upgrades: Record<string, { level: number }>;
    powers: { data: { values: string[] }; upgrades: Record<string, unknown> };
    pickaxe: { name: string; pow: string; quality: string };
  };
  const initialNotification =
    reference.data.storySemantics.notificationScenarios.find(
      ({ name }) => name === "fresh-state-refreshes-game-start",
    );
  const idleBreak = reference.data.simulationFrameSemantics.cases.find(
    ({ name }) => name === "idle-break-saves-before-story-notification-refresh",
  );
  if (!initialNotification || !idleBreak) {
    throw new Error("The source Story progression cases are missing.");
  }

  const startTime = 1_700_000_000_000;
  save.money = "0";
  save.highestMoney = "0";
  save.maxPlanetCoins = "0";
  save.mineObjectLevel = 0;
  save.highestMineObjectLevel = 0;
  save.lastActive = startTime;
  save.story = {
    page: 0,
    notifications: 0,
    highestUnlocked: -1,
    scrollY: 0,
  };
  save.settings.tab = "main";
  save.upgrades["blacksmith"] = { level: 0 };
  save.upgrades["gemWaster"] = { level: 0 };
  save.upgrades["idlePower"] = { level: 0 };
  save.upgrades["idleSpeed"] = { level: 0 };
  save.powers.data.values = ["1", "1", "1", "1", "1"];
  save.powers.upgrades = {};
  save.pickaxe = { name: "Story Progress Pickaxe", pow: "1000", quality: "1" };

  await page.addInitScript(
    ({ legacySave, initialNow }) => {
      localStorage.clear();
      localStorage.setItem(
        "IdleMine",
        btoa(escape(encodeURIComponent(legacySave))),
      );
      let now = initialNow;
      Object.defineProperty(window, "__idleMineStoryTestNow", {
        configurable: false,
        get: () => now,
        set: (next: number) => {
          now = next;
        },
      });
      Date.now = () => now;
    },
    { legacySave: JSON.stringify(save), initialNow: startTime },
  );
  await page.goto("/");
  await expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready");

  const storyTab = page.locator("[data-game-tab='story']");
  await expect(storyTab.locator(".notification")).toHaveText(
    String(initialNotification.after.notifications),
  );
  await page.evaluate(() => {
    const testWindow = window as Window & {
      __idleMineStoryTestNow?: number;
    };
    if (testWindow.__idleMineStoryTestNow === undefined) {
      throw new Error("The controlled Story test clock is missing.");
    }
    testWindow.__idleMineStoryTestNow += 2_000;
  });

  await expect(storyTab.locator(".notification")).toHaveText(
    String(idleBreak.result.story.notifications),
  );
  expect(idleBreak.result.highestMineObjectLevel).toBe(1);
  expect(idleBreak.result.story.highestUnlocked).toBe(1);
  await storyTab.click();
  await expect(storyTab.locator(".notification")).toHaveCount(0);
  await expect(
    page.locator('.story-milestones [data-story-milestone-key="firstMud"]'),
  ).toBeVisible();
  await expect(page.locator(".objective")).toContainText(
    "Mine a piece of Paper",
  );
});

test("persists Story page and scroll through a Beyond save and reload", async ({
  page,
}) => {
  const reference = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-reference-corpus.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as SettingsRuntimeFixture;
  const legacySave = JSON.parse(
    reference.data.saveApplicationSemantics.inputJson,
  ) as {
    highestMoney: string;
    maxPlanetCoins: string;
    highestMineObjectLevel: number;
    story: {
      page: number;
      notifications: number;
      highestUnlocked: number;
      scrollY: number;
    };
    upgrades: Record<string, { level: number }>;
  };
  legacySave.highestMoney = "5e13";
  legacySave.maxPlanetCoins = "1";
  legacySave.highestMineObjectLevel = 215;
  legacySave.story = {
    page: 2,
    notifications: 4,
    highestUnlocked: 60,
    scrollY: 123,
  };
  legacySave.upgrades["blacksmith"] = { level: 1 };
  legacySave.upgrades["gemWaster"] = { level: 1 };
  const legacyJson = JSON.stringify(legacySave);
  await page.addInitScript(() => {
    if (sessionStorage.getItem("story-reload-test-started") === null) {
      localStorage.clear();
      sessionStorage.setItem("story-reload-test-started", "true");
    }
    Date.now = () => 1_700_000_000_000;
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready");
  await page.locator("[data-game-tab='settings']").click();

  const settings = page.locator("article.settings");
  const legacyString = await page.evaluate((json) => {
    return btoa(escape(encodeURIComponent(json)));
  }, legacyJson);
  await settings.locator("[data-settings-save-field]").fill(legacyString);
  await settings
    .getByRole("button", { name: "Import (from Text Field)" })
    .click();
  await expect(page.locator("#app")).toHaveAttribute("data-theme", "dark");

  await page.locator("[data-game-tab='story']").click();
  const storyPanel = page.locator(".story-panel-host");
  await expect(storyPanel).toHaveAttribute("data-story-page", "2");
  const storyScroller = page.locator(".story-milestones");
  await expect
    .poll(() => storyScroller.evaluate((element) => element.scrollTop))
    .toBe(123);
  const debtCase = reference.data.payUSDebtSemantics.scenarios.find(
    ({ name }) => name === "above-cost",
  );
  if (!debtCase) throw new Error("The captured Story debt case is missing.");
  const debtAlerts: string[] = [];
  page.on("dialog", async (dialog) => {
    debtAlerts.push(dialog.message());
    await dialog.accept();
  });
  await storyPanel.locator('button[data-story-action="payUSDebt"]').click();
  expect(debtAlerts).toEqual(
    debtCase.events
      .filter(({ type }) => type === "alert")
      .map(({ message }) => message),
  );
  const scrollBeforeMining = await storyScroller.evaluate(
    (element) => element.scrollTop,
  );
  await page.locator("[data-game-tab='mining']").click();
  for (const event of debtCase.events.filter(
    ({ type }) => type === "logMessage",
  )) {
    await expect(page.locator(".messagelog")).toContainText(event.message);
  }
  await page.locator("[data-game-tab='story']").click();
  // Let the source-delayed scroll restore finish before scrolling manually.
  await expect
    .poll(() => storyScroller.evaluate((element) => element.scrollTop))
    .toBe(scrollBeforeMining);

  const savedScrollY = await storyScroller.evaluate((element) => {
    element.scrollTop = 360;
    return element.scrollTop;
  });
  expect(savedScrollY).toBeGreaterThan(0);

  await page.locator("[data-game-tab='settings']").click();
  await page
    .locator("article.settings")
    .getByRole("button", { name: "Save" })
    .click();
  const savedStory = await page.evaluate(() => {
    const serialized = localStorage.getItem("IdleMineBeyond");
    if (!serialized)
      throw new Error("Beyond save is missing after Story save.");
    const parsed = JSON.parse(serialized) as {
      state: {
        simulation: {
          story: {
            page: number;
            highestUnlocked: number;
            notifications: number;
          };
        };
        storyScrollY: number;
      };
    };
    return parsed.state;
  });
  expect(savedStory.simulation.story).toEqual({
    page: 2,
    highestUnlocked: 60,
    notifications: 0,
  });
  expect(savedStory.storyScrollY).toBe(savedScrollY);

  await page.reload();
  await expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready");
  const reloadedStorySave = await page.evaluate(() => {
    const serialized = localStorage.getItem("IdleMineBeyond");
    if (!serialized) throw new Error("Beyond save disappeared after reload.");
    const parsed = JSON.parse(serialized) as {
      state: { simulation: { story: { page: number } } };
    };
    return parsed.state.simulation.story.page;
  });
  expect(reloadedStorySave).toBe(2);
  await page.locator("[data-game-tab='story']").click();
  await expect(page.locator(".story-panel-host")).toHaveAttribute(
    "data-story-page",
    "2",
  );
  await expect
    .poll(() =>
      page
        .locator(".story-milestones")
        .evaluate((element) => element.scrollTop),
    )
    .toBe(savedScrollY);
});

test("crafts and persists a source-compatible stochastic pickaxe", async ({
  page,
}) => {
  const reference = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-reference-corpus.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as SettingsRuntimeFixture;
  const attempt = reference.data.pickaxeCraftingSemantics.attempts.find(
    ({ input }) => input.name === "better-craft-replaces-and-saves",
  );
  if (!attempt) throw new Error("The captured pickaxe craft case is missing.");
  const save = JSON.parse(
    reference.data.saveApplicationSemantics.inputJson,
  ) as {
    gems: string;
    mineObjectLevel: number;
    highestMineObjectLevel: number;
    lastActive: number;
    upgrades: Record<string, { level: number }>;
    gemUpgrades: Record<string, { level: number }>;
    planetCoinUpgrades: Record<string, { level: number }>;
    powers: {
      data: { values: string[] };
      upgrades: Record<string, { level: number }>;
    };
    pickaxe: { name: string; pow: string; quality: string };
  };
  save.gems = attempt.input.gems;
  save.mineObjectLevel = attempt.input.highestMineObjectLevel;
  save.highestMineObjectLevel = attempt.input.highestMineObjectLevel;
  save.lastActive = 1_700_000_000_000;
  save.upgrades = {};
  save.gemUpgrades = {};
  save.planetCoinUpgrades = {};
  save.powers.data.values = ["1", "1", "1", "1", "1"];
  save.powers.upgrades = {};
  save.pickaxe = {
    name: attempt.input.equippedPickaxe.name,
    pow: attempt.input.equippedPickaxe.power,
    quality: attempt.input.equippedPickaxe.quality,
  };

  await page.addInitScript((legacyJson) => {
    localStorage.clear();
    localStorage.setItem(
      "IdleMine",
      btoa(escape(encodeURIComponent(legacyJson))),
    );
    Date.now = () => 1_700_000_000_000;
  }, JSON.stringify(save));
  await page.goto("/");
  await expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready");

  await page.evaluate((values) => {
    let index = 0;
    const browserWindow = window as Window & {
      __remixCraftRandomDraws?: () => number;
    };
    browserWindow.__remixCraftRandomDraws = () => index;
    Math.random = () => values[index++] ?? 0.5;
  }, attempt.input.randomValues);
  await page.locator("[data-craft-pickaxe]").click();

  const pickaxe = attempt.result.pickaxe;
  await expect(
    page.locator(".stats > div").first().locator("p").first(),
  ).toHaveText(pickaxe.name);
  await expect(page.locator(".messagelog")).toContainText(
    attempt.messageLog[0]!.message,
  );
  await expect(page.locator(".messagelog p")).toHaveText([
    "Game Saved!",
    attempt.messageLog[0]!.message,
  ]);
  const stored = await page.evaluate(() => {
    const serialized = localStorage.getItem("IdleMineBeyond");
    if (!serialized) throw new Error("Craft replacement was not persisted.");
    const parsed = JSON.parse(serialized) as {
      state: {
        simulation: {
          resources: { gems: string };
          pickaxe: { name: string; power: string; quality: string };
        };
      };
    };
    return parsed.state.simulation;
  });
  expect(stored.resources.gems).toBe(attempt.result.gems.decimal);
  expect(stored.pickaxe).toEqual({
    name: pickaxe.name,
    power: pickaxe.power.decimal,
    quality: pickaxe.quality.decimal,
  });
  const drawsAfterReplacement = await page.evaluate(() => {
    const browserWindow = window as Window & {
      __remixCraftRandomDraws?: () => number;
    };
    return browserWindow.__remixCraftRandomDraws?.();
  });
  expect(drawsAfterReplacement).toBe(attempt.randomCalls);

  await page.locator("[data-craft-pickaxe]").click();
  await expect(page.locator(".messagelog")).toContainText("Not enough Gems!");
  await expect(page.locator(".messagelog p")).toHaveText([
    "Not enough Gems!",
    "Game Saved!",
    attempt.messageLog[0]!.message,
  ]);
  expect(
    await page.evaluate(() => {
      const browserWindow = window as Window & {
        __remixCraftRandomDraws?: () => number;
      };
      return browserWindow.__remixCraftRandomDraws?.();
    }),
  ).toBe(drawsAfterReplacement);
});

test("matches the pinned Remix Gem Waster craft controls", async ({ page }) => {
  const reference = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-reference-corpus.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as SettingsRuntimeFixture;
  const save = JSON.parse(
    reference.data.saveApplicationSemantics.inputJson,
  ) as {
    gems: string;
    lastActive: number;
    settings: Record<string, unknown>;
    upgrades: Record<string, { level: number }>;
    gemUpgrades: Record<string, { level: number }>;
  };
  save.gems = "1000";
  save.lastActive = 1_700_000_000_000;
  save.settings = {
    ...save.settings,
    theme: "light",
    showMinCraftDamage: false,
  };
  save.upgrades["gemWaster"] = { level: 1 };
  save.gemUpgrades["gemWaster"] = { level: 2 };

  await page.addInitScript((legacyJson) => {
    localStorage.clear();
    localStorage.setItem(
      "IdleMine",
      btoa(escape(encodeURIComponent(legacyJson))),
    );
    Date.now = () => 1_700_000_000_000;
  }, JSON.stringify(save));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready");

  const decrease = page.locator('[data-craft-gem-level="decrease"]');
  const increase = page.locator('[data-craft-gem-level="increase"]');
  const cost = page.locator("[data-craft-gem-cost]");
  await expect(cost).toHaveText("1");
  await expect(decrease).toBeDisabled();
  await expect(decrease.locator("img")).toHaveCount(0);
  await expect(increase).toBeEnabled();
  await expect(increase.locator("img")).toHaveAttribute(
    "src",
    "/Images/btn_right.png",
  );

  await increase.click();
  await expect(cost).toHaveText("3");
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".craft-pickaxe")).toHaveScreenshot(
    "craft-selector-light-1440x900.png",
    { animations: "disabled", maxDiffPixels: 0 },
  );
  await expect(decrease).toBeEnabled();
  await expect(decrease.locator("img")).toHaveAttribute(
    "src",
    "/Images/btn_left.png",
  );
  await increase.click();
  await expect(cost).toHaveText("10");
  await increase.click();
  await expect(cost).toHaveText("35");
  await expect(increase).toBeDisabled();
  await expect(increase.locator("img")).toHaveCount(0);
  await decrease.click();
  await expect(cost).toHaveText("10");
});

test("Shift crafts follow the captured bulk attempts and intermediate save", async ({
  page,
}) => {
  const reference = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-reference-corpus.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as SettingsRuntimeFixture;
  const attempt = reference.data.pickaxeCraftingSemantics.attempts.find(
    ({ input }) => input.name === "bulk-success-dud-then-insufficient",
  );
  if (!attempt) throw new Error("The captured Shift craft case is missing.");

  const save = JSON.parse(
    reference.data.saveApplicationSemantics.inputJson,
  ) as {
    money: string;
    highestMoney: string;
    gems: string;
    planetCoins: string;
    maxPlanetCoins: string;
    mineObjectLevel: number;
    highestMineObjectLevel: number;
    lastActive: number;
    upgrades: Record<string, { level: number }>;
    gemUpgrades: Record<string, { level: number }>;
    planetCoinUpgrades: Record<string, { level: number }>;
    powers: {
      data: { values: string[] };
      upgrades: Record<string, { level: number }>;
    };
    pickaxe: { name: string; pow: string; quality: string };
  };
  save.money = "0";
  save.highestMoney = "0";
  save.gems = attempt.input.gems;
  save.planetCoins = "0";
  save.maxPlanetCoins = "0";
  save.mineObjectLevel = attempt.input.highestMineObjectLevel;
  save.highestMineObjectLevel = attempt.input.highestMineObjectLevel;
  save.lastActive = 1_700_000_000_000;
  save.upgrades = {};
  save.gemUpgrades = {};
  save.planetCoinUpgrades = { bulkCraft: { level: 2 } };
  save.powers.data.values = ["1", "1", "1", "1", "1"];
  save.powers.upgrades = {};
  save.pickaxe = {
    name: attempt.input.equippedPickaxe.name,
    pow: attempt.input.equippedPickaxe.power,
    quality: attempt.input.equippedPickaxe.quality,
  };

  await page.addInitScript((legacyJson) => {
    Date.now = () => 1_700_000_000_000;
    const seedKey = "imb-shift-craft-seeded";
    if (sessionStorage.getItem(seedKey)) return;
    sessionStorage.setItem(seedKey, "1");
    localStorage.clear();
    localStorage.setItem(
      "IdleMine",
      btoa(escape(encodeURIComponent(legacyJson))),
    );
  }, JSON.stringify(save));
  await page.goto("/");
  await expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready");
  await page.evaluate((values) => {
    let index = 0;
    const browserWindow = window as Window & {
      __remixCraftRandomDraws?: () => number;
    };
    browserWindow.__remixCraftRandomDraws = () => index;
    Math.random = () => values[index++] ?? 0.5;
  }, attempt.input.randomValues);

  await page.keyboard.down("Shift");
  await expect(page.locator("[data-craft-pickaxe]")).toContainText("x 3");
  await page.locator("[data-craft-pickaxe]").click();
  await page.keyboard.up("Shift");

  await expect(page.locator("header .inline-resource")).toHaveText("0");
  await expect(
    page.locator(".stats > div").first().locator("p").first(),
  ).toHaveText(attempt.result.pickaxe.name);
  await expect(page.locator(".messagelog p")).toHaveText([
    attempt.messageLog[0]!.message,
    attempt.messageLog[1]!.message,
    "Game Saved!",
    attempt.messageLog[2]!.message,
  ]);
  expect(
    await page.evaluate(() => {
      const browserWindow = window as Window & {
        __remixCraftRandomDraws?: () => number;
      };
      return browserWindow.__remixCraftRandomDraws?.();
    }),
  ).toBe(attempt.randomCalls);

  const savedSimulation = await page.evaluate(() => {
    const serialized = localStorage.getItem("IdleMineBeyond");
    if (!serialized)
      throw new Error("Bulk craft did not persist its replacement.");
    const parsed = JSON.parse(serialized) as {
      state: {
        simulation: {
          resources: { gems: string };
          pickaxe: { name: string; power: string; quality: string };
        };
      };
    };
    return parsed.state.simulation;
  });
  const snapshot = attempt.saveSnapshots[0]!;
  expect(savedSimulation.resources.gems).toBe(snapshot.gems.decimal);
  expect(savedSimulation.pickaxe).toEqual({
    name: snapshot.pickaxe.name,
    power: snapshot.pickaxe.power.decimal,
    quality: snapshot.pickaxe.quality.decimal,
  });

  await page.reload();
  await expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready");
  await expect(page.locator("header .inline-resource")).toHaveText("1");
  await expect(
    page.locator(".stats > div").first().locator("p").first(),
  ).toHaveText(snapshot.pickaxe.name);
});

test("buys the source-priced Blacksmith with single and modifier controls", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const save = {
      money: "1e100",
      gems: 5,
      story: {},
      upgrades: { blacksmith: { level: 0 } },
    };
    const encoded = btoa(escape(encodeURIComponent(JSON.stringify(save))));
    localStorage.setItem("IdleMine", encoded);
    Date.now = () => 1_700_000_000_000;
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready");

  const blacksmith = page.locator(
    '[data-upgrade-group="money"][data-upgrade-key="blacksmith"]',
  );
  await expect(blacksmith).not.toHaveClass(/cantafford/);
  await blacksmith.click();
  await expect(blacksmith).toHaveAttribute("data-upgrade-level", "1");
  await page.keyboard.down("Shift");
  await expect(
    page.locator('[data-upgrade-details="blacksmith"] .multibuy.active'),
  ).toHaveText("Hold SHIFT to buy 10");
  await blacksmith.click();
  await expect(blacksmith).toHaveAttribute("data-upgrade-level", "10");

  await page.keyboard.down("Control");
  await expect(
    page.locator('[data-upgrade-details="blacksmith"] .multibuy.active'),
  ).toHaveText("Hold CTRL to buy 100");
  await blacksmith.click();
  await expect(blacksmith).toHaveAttribute("data-upgrade-level", "100");
  await page.keyboard.up("Control");
  await page.keyboard.up("Shift");
});

test("applies and saves source-backed Settings preferences", async ({
  page,
}) => {
  const reference = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-reference-corpus.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as SettingsRuntimeFixture;
  const { initialState } = reference.data;

  await page.addInitScript(() => {
    if (sessionStorage.getItem("settings-e2e-started") !== "true") {
      localStorage.clear();
      sessionStorage.setItem("settings-e2e-started", "true");
    }
    Date.now = () => 1_700_000_000_000;
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready");
  await page.locator("[data-game-tab='settings']").click();

  const settings = page.locator("article.settings");
  await expect(settings.locator("h2")).toHaveText("Settings");
  const notationSelect = settings.locator("#numberformatselect");
  await expect(notationSelect.locator("option")).toHaveText(
    initialState.numberFormatters,
  );
  await expect(notationSelect).toHaveValue(
    String(initialState.settings.numberFormatterIndex),
  );

  await notationSelect.selectOption("3");
  await expect(page.locator("#app")).toHaveAttribute(
    "data-number-formatter",
    initialState.numberFormatters[3]!,
  );
  await settings.getByLabel("Show Mineral Level").check();
  await settings
    .getByLabel("Show minimum Base Damage for crafted Pickaxes")
    .check();
  await settings.getByRole("button", { name: "Dark" }).click();
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(54, 54, 54)",
  );
  await expect(page.locator("body")).toHaveCSS("color", "rgb(193, 193, 193)");
  await settings.getByRole("button", { name: "Save" }).click();

  await page.locator("[data-game-tab='mining']").click();
  await expect(page.locator("[data-mine-object-level]")).toHaveText("#1");
  await expect(page.locator("[data-minimum-craft-damage]")).toContainText(
    initialState.minimumCraftDamage.decimal,
  );
  await expect(page.locator(".messagelog")).toContainText("Game Saved!");
  const savedSettings = await page.evaluate(() => {
    const serialized = localStorage.getItem("IdleMineBeyond");
    if (!serialized) throw new Error("Manual save was not written.");
    return (JSON.parse(serialized) as { state: { settings: unknown } }).state
      .settings;
  });
  expect(savedSettings).toMatchObject({
    numberFormatterIndex: 3,
    showMineObjLevel: true,
    showMinCraftDamage: true,
    theme: "dark",
  });

  await page.reload();
  await expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready");
  await expect(page.locator("#app")).toHaveAttribute(
    "data-number-formatter",
    initialState.numberFormatters[3]!,
  );
  await page.locator("[data-game-tab='settings']").click();
  await expect(notationSelect).toHaveValue("3");
  await expect(settings.getByLabel("Show Mineral Level")).toBeChecked();
  await expect(
    settings.getByLabel("Show minimum Base Damage for crafted Pickaxes"),
  ).toBeChecked();
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(54, 54, 54)",
  );
});

test("exports and imports the pinned legacy save through the Settings text field", async ({
  page,
}) => {
  const reference = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-reference-corpus.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as SettingsRuntimeFixture;
  await page.addInitScript(() => {
    localStorage.clear();
    Date.now = () => 1_700_000_000_000;
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready");
  await page.locator("[data-game-tab='settings']").click();

  const settings = page.locator("article.settings");
  const saveField = settings.locator("[data-settings-save-field]");
  await settings.getByRole("button", { name: "Export" }).click();
  const exported = await saveField.inputValue();
  expect(exported).not.toBe("Exported String will appear here...");
  const exportedValue = await page.evaluate((encoded) => {
    const decoded = unescape(decodeURIComponent(atob(encoded)));
    return JSON.parse(decoded) as {
      [key: string]: unknown;
      money: string;
      gems: string;
      story: { highestUnlocked: number };
      settings: { tab: string; theme: string };
    };
  }, exported);
  const expectedFreshExport = structuredClone(
    reference.data.saveExportSemantics.fresh.object,
  );
  expectedFreshExport["lastActive"] = 1_700_000_000_000;
  (expectedFreshExport["settings"] as Record<string, unknown>)["tab"] =
    "settings";
  const expectedStory = expectedFreshExport["story"] as Record<string, unknown>;
  expectedStory["highestUnlocked"] = 0;
  expectedStory["notifications"] = 1;
  const expectedEncoded = await page.evaluate((value) => {
    return btoa(escape(encodeURIComponent(JSON.stringify(value))));
  }, expectedFreshExport);
  expect(exported).toBe(expectedEncoded);
  const expectedRoundTrip = await page.evaluate((encoded) => {
    const decoded = unescape(decodeURIComponent(atob(encoded)));
    return JSON.parse(decoded) as unknown;
  }, expectedEncoded);
  expect(exportedValue).toEqual(expectedRoundTrip);
  expect(Object.keys(exportedValue)).toHaveLength(27);
  expect(
    await page.evaluate(() => localStorage.getItem("IdleMineBeyond")),
  ).toBe(null);

  const legacyJson = reference.data.saveApplicationSemantics.inputJson;
  const legacyString = await page.evaluate((json) => {
    return btoa(escape(encodeURIComponent(json)));
  }, legacyJson);
  await saveField.fill(legacyString);
  await settings
    .getByRole("button", { name: "Import (from Text Field)" })
    .click();

  await expect(page.locator("#app")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("#app")).toHaveAttribute(
    "data-number-formatter",
    reference.data.initialState.numberFormatters[3]!,
  );
  await expect(page.locator("[data-game-tab='settings']")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const imported = await page.evaluate(() => {
    const serialized = localStorage.getItem("IdleMineBeyond");
    if (!serialized) throw new Error("Imported save was not persisted.");
    return JSON.parse(serialized) as {
      state: {
        simulation: { resources: { money: string }; mineObjectLevel: number };
        settings: {
          tab: string;
          numberFormatterIndex: number;
          showMineObjLevel: boolean;
          showMinCraftDamage: boolean;
          theme: string;
        };
      };
    };
  });
  expect(imported.state.simulation.resources.money).toBe(
    reference.data.saveApplicationSemantics.resources.money.decimal,
  );
  expect(imported.state.simulation.mineObjectLevel).toBe(3);
  expect(imported.state.settings).toMatchObject({
    tab: "settings",
    numberFormatterIndex: 3,
    showMineObjLevel: true,
    showMinCraftDamage: true,
    theme: "dark",
  });
});

test("unlocks Powers at the source object and renders prestige and Wisdom upgrades", async ({
  page,
}) => {
  const reference = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-reference-corpus.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as SettingsRuntimeFixture;
  const save = JSON.parse(
    reference.data.saveApplicationSemantics.inputJson,
  ) as {
    highestMineObjectLevel: number;
    lastActive: number;
    maxWisdom: string;
    mineObjectLevel: number;
    powers: {
      data: { values: string[] };
      upgrades: Record<string, { level: number }>;
    };
    settings: { tab: string; numberFormatterIndex: number };
    wisdom: string;
  };
  save.highestMineObjectLevel = 170;
  save.mineObjectLevel = 170;
  save.lastActive = 1_700_000_000_000;
  save.wisdom = "100";
  save.maxWisdom = "100";
  save.powers.data.values = ["1e6", "1", "1", "1", "1"];
  save.powers.upgrades = { powerResetKeep: { level: 0 } };
  save.settings.tab = "main";
  save.settings.numberFormatterIndex = 0;
  const legacySave = encodeRemixLegacySave(save);

  await page.addInitScript((encoded) => {
    if (sessionStorage.getItem("powers-test-seeded") !== "true") {
      localStorage.clear();
      localStorage.setItem("IdleMine", encoded);
      sessionStorage.setItem("powers-test-seeded", "true");
    }
    Date.now = () => 1_700_000_000_000;
  }, legacySave);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready");

  const powersTab = page.locator("[data-game-tab='powers']");
  await expect(powersTab).toBeVisible();
  const tabs = await page
    .locator("footer button[data-game-tab]")
    .evaluateAll((buttons) =>
      buttons.map((button) => button.getAttribute("data-game-tab")),
    );
  expect(tabs).toEqual(["mining", "powers", "story", "settings"]);
  await powersTab.click();

  const panel = page.locator("article.powers");
  const rows = panel.locator("[data-power-row]");
  await expect(rows).toHaveCount(
    reference.data.powersTableSemantics.names.length,
  );
  for (const [
    index,
    name,
  ] of reference.data.powersTableSemantics.names.entries()) {
    await expect(rows.nth(index)).toContainText(name);
  }
  await expect(panel.locator("[data-power-row='0']")).toContainText(
    "Prestige: x31.62",
  );
  await expect(panel.locator("[data-power-row='1']")).toContainText(
    "Req. x1,000",
  );
  await expect(panel.locator("[data-power-row='0'] img")).toHaveAttribute(
    "src",
    "/Images/pickaxe.png",
  );

  const wisdomUpgrades = panel.locator("[data-wisdom-upgrade]");
  await expect(wisdomUpgrades).toHaveCount(7);
  for (const [key, upgrade] of Object.entries(
    reference.data.upgradeSemantics.groups.wisdom,
  )) {
    await expect(
      panel.locator(`[data-wisdom-upgrade='${key}'] h4`),
    ).toContainText(upgrade.name);
  }
  await panel.locator("[data-wisdom-upgrade='powerPowerActive']").click();
  await expect(
    panel.locator("[data-wisdom-upgrade='powerPowerActive']"),
  ).toHaveAttribute("data-upgrade-level", "1");
  await expect(panel.locator("[data-wisdom-balance]")).toContainText("99");

  await panel.locator("[data-power-prestige='0']").click();
  await expect(panel.locator("[data-power-row='0']")).toContainText("x 1,000");
  await expect(panel.locator("[data-power-row='1']")).toContainText("x 31.62");

  await page.locator("[data-game-tab='settings']").click();
  await page.locator("[data-settings-save]").click();
  expect(
    await page.evaluate(() => localStorage.getItem("IdleMineBeyond")),
  ).not.toBeNull();
  await page.reload();
  await expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready");
  await page.locator("[data-game-tab='powers']").click();
  await expect(page.locator("[data-power-row='0']")).toContainText("x 1,000");
  await expect(page.locator("[data-power-row='1']")).toContainText("x 31.62");
});

test("performs source Hard Reset after three confirmations and clears origin storage", async ({
  page,
}) => {
  const reference = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-reference-corpus.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as SettingsRuntimeFixture;
  const save = JSON.parse(
    reference.data.saveApplicationSemantics.inputJson,
  ) as { lastActive: number };
  save.lastActive = 1_700_000_000_000;
  const encoded = encodeRemixLegacySave(save);
  await page.addInitScript((legacySave) => {
    localStorage.clear();
    localStorage.setItem("IdleMine", legacySave);
    localStorage.setItem("unrelated-origin-data", "must be removed");
    Date.now = () => 1_700_000_000_000;
  }, encoded);
  const confirmationPrompts: string[] = [];
  page.on("dialog", async (dialog) => {
    confirmationPrompts.push(dialog.message());
    await dialog.accept();
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready");
  await page.locator("[data-game-tab='settings']").click();

  const settings = page.locator("article.settings");
  const saveField = settings.locator("[data-settings-save-field]");
  await saveField.fill("old export text");
  await settings.getByRole("button", { name: "Hard Reset" }).click();

  await expect.poll(() => confirmationPrompts.length).toBe(3);
  expect(confirmationPrompts).toEqual([
    "Are you sure you want to ENTIRELY reset your savegame? YOu get no reward.Click 3 more times to confirm",
    "Are you sure you want to ENTIRELY reset your savegame? YOu get no reward.Click 2 more times to confirm",
    "Are you sure you want to ENTIRELY reset your savegame? YOu get no reward.Click 1 more times to confirm",
  ]);
  await expect(page.locator("[data-game-tab='settings']")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("body")).toHaveAttribute("data-theme", "light");
  await expect(
    settings.locator("[data-setting='showMineObjLevel']"),
  ).not.toBeChecked();
  await expect(saveField).toHaveValue("old export text");
  expect(
    await page.evaluate(() => ({
      length: localStorage.length,
      keys: Object.keys(localStorage),
    })),
  ).toEqual({ length: 0, keys: [] });
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
});

test("exports damaged save slots before recovering from a supplied Remix save", async ({
  page,
}) => {
  const reference = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-reference-corpus.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as SettingsRuntimeFixture;
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem("IdleMineBeyond", "damaged-primary");
    localStorage.setItem("IdleMineBeyondBackup", "damaged-backup");
    localStorage.setItem("IdleMine", "legacy-slot-is-preserved");
    Date.now = () => 1_700_000_000_000;
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator("#app")).toHaveAttribute(
    "data-app-state",
    "recovery",
  );
  await expect(
    page.getByRole("heading", { name: "Save needs attention" }),
  ).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.locator("[data-recovery-export]").click();
  const download = await downloadPromise;
  const downloadedBundle = JSON.parse(
    await readFile(await download.path(), "utf8"),
  ) as {
    saves: {
      beyondPrimary: string | null;
      beyondBackup: string | null;
      remixLegacy: string | null;
    };
  };
  expect(downloadedBundle.saves).toEqual({
    beyondPrimary: "damaged-primary",
    beyondBackup: "damaged-backup",
    remixLegacy: "legacy-slot-is-preserved",
  });
  expect(
    await page.evaluate(() => ({
      primary: localStorage.getItem("IdleMineBeyond"),
      backup: localStorage.getItem("IdleMineBeyondBackup"),
      legacy: localStorage.getItem("IdleMine"),
    })),
  ).toEqual({
    primary: "damaged-primary",
    backup: "damaged-backup",
    legacy: "legacy-slot-is-preserved",
  });

  const legacy = JSON.parse(
    reference.data.saveApplicationSemantics.inputJson,
  ) as { lastActive: number; settings: { theme: string } };
  legacy.lastActive = 1_700_000_000_000;
  legacy.settings.theme = "dark";
  await page.locator("[data-recovery-acknowledgement]").check();
  await page
    .locator("[data-recovery-legacy-save]")
    .fill(encodeRemixLegacySave(legacy));
  await page.locator("[data-recovery-import]").click();

  await expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready");
  await expect(page.locator("body")).toHaveAttribute("data-theme", "dark");
  const recoveredSave = await page.evaluate(() => {
    const primary = localStorage.getItem("IdleMineBeyond");
    if (!primary) throw new Error("The recovered Beyond save is missing.");
    return JSON.parse(primary) as {
      version: number;
      state: {
        settings: { theme: string };
        simulation: { resources: { money: string } };
      };
    };
  });
  expect(recoveredSave.version).toBe(1);
  expect(recoveredSave.state.settings.theme).toBe("dark");
  expect(recoveredSave.state.simulation.resources.money).toBe(
    reference.data.saveApplicationSemantics.resources.money.decimal,
  );
  expect(await page.evaluate(() => localStorage.getItem("IdleMine"))).toBe(
    "legacy-slot-is-preserved",
  );
});

test("recovers a Beyond save from a selected recovery bundle after acknowledgement", async ({
  page,
}) => {
  const reference = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-reference-corpus.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as SettingsRuntimeFixture;
  const legacy = JSON.parse(
    reference.data.saveApplicationSemantics.inputJson,
  ) as { lastActive: number; settings: { theme: string } };
  legacy.lastActive = 1_700_000_000_000;
  legacy.settings.theme = "dark";
  const encodedLegacy = encodeRemixLegacySave(legacy);
  await page.addInitScript((serializedLegacy) => {
    if (sessionStorage.getItem("recovery-test-seeded") !== "true") {
      localStorage.clear();
      localStorage.setItem("IdleMine", serializedLegacy);
      sessionStorage.setItem("recovery-test-seeded", "true");
    }
    Date.now = () => 1_700_000_000_000;
  }, encodedLegacy);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready");
  const validBeyondSave = await page.evaluate(() =>
    localStorage.getItem("IdleMineBeyond"),
  );
  expect(validBeyondSave).not.toBeNull();

  const reloadPromise = page.waitForNavigation();
  await page.evaluate(() => {
    localStorage.setItem("IdleMineBeyond", "damaged-primary");
    localStorage.setItem("IdleMineBeyondBackup", "damaged-backup");
    window.location.reload();
  });
  await reloadPromise;
  await expect(page.locator("#app")).toHaveAttribute(
    "data-app-state",
    "recovery",
  );

  const downloadPromise = page.waitForEvent("download");
  await page.locator("[data-recovery-export]").click();
  await downloadPromise;

  const recoveryBundle = JSON.stringify({
    format: "idle-mine-beyond-recovery",
    version: 1,
    saves: {
      beyondPrimary: "damaged-file-primary",
      beyondBackup: validBeyondSave,
      remixLegacy: encodedLegacy,
    },
  });
  await page.locator("[data-recovery-beyond-file]").setInputFiles({
    name: "idle-mine-beyond-recovery.json",
    mimeType: "application/json",
    buffer: Buffer.from(recoveryBundle),
  });
  const importButton = page.locator("[data-recovery-beyond-import]");
  await expect(importButton).toBeDisabled();
  await page.locator("[data-recovery-acknowledgement]").check();
  await expect(importButton).toBeEnabled();
  await importButton.click();

  await expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready");
  await expect(page.locator("body")).toHaveAttribute("data-theme", "dark");
  const stored = await page.evaluate(() => {
    const serialized = localStorage.getItem("IdleMineBeyond");
    if (!serialized) throw new Error("Recovered Beyond save was not stored.");
    return JSON.parse(serialized) as {
      format: string;
      version: number;
      state: { settings: { theme: string } };
    };
  });
  expect(stored).toMatchObject({
    format: "idle-mine-beyond",
    version: 1,
    state: { settings: { theme: "dark" } },
  });
  expect(await page.evaluate(() => localStorage.getItem("IdleMine"))).toBe(
    encodedLegacy,
  );
});
