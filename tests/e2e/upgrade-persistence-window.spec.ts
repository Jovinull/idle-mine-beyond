import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { encodeRemixLegacySave } from "../../packages/persistence/src/remix-save-codec.js";
import { routePinnedRemixOracle } from "./remix-oracle-route.js";

type PurchaseGroup = "money" | "gems" | "planetCoins" | "wisdom";

type SaveFixture = {
  data: {
    saveApplicationSemantics: { inputJson: string };
    upgradeSemantics: {
      purchaseSemantics: {
        name: string;
        group: PurchaseGroup;
        key: string;
        currentPrice: { decimal: string };
      }[];
      groups: Record<
        PurchaseGroup,
        Record<string, { image: string; name: string }>
      >;
    };
  };
};

test("an unsaved upgrade purchase is lost on reload like pinned Remix", async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);
  const fixture = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-reference-corpus.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as SaveFixture;
  const save = JSON.parse(fixture.data.saveApplicationSemantics.inputJson) as {
    money: string;
    highestMoney: string;
    highestMineObjectLevel: number;
    mineObjectLevel: number;
    lastActive: number;
    settings: { theme: string; tab: string; upgradeTab?: string };
    upgrades: Record<string, { level: number }>;
  };
  const fixedTime = 1_700_000_000_000;
  save.money = "1000";
  save.highestMoney = "1000";
  save.settings.theme = "light";
  save.settings.tab = "main";
  save.settings.upgradeTab = "money";
  save.upgrades["blacksmith"] = { level: 0 };
  save.lastActive = fixedTime;
  const encodedSave = encodeRemixLegacySave(save);
  const sourceContext = await browser.newContext({
    locale: "en-US",
    timezoneId: "UTC",
    viewport: { width: 1440, height: 900 },
  });
  const sourcePage = await sourceContext.newPage();
  const initializePage = ({
    encoded,
    now,
  }: {
    encoded: string;
    now: number;
  }) => {
    localStorage.clear();
    localStorage.setItem("IdleMine", encoded);
    Date.now = () => now;
  };

  try {
    const sourceUrl = await routePinnedRemixOracle(sourceContext);
    await Promise.all([
      page.addInitScript(initializePage, {
        encoded: encodedSave,
        now: fixedTime,
      }),
      sourcePage.addInitScript(initializePage, {
        encoded: encodedSave,
        now: fixedTime,
      }),
    ]);
    await page.setViewportSize({ width: 1440, height: 900 });
    await Promise.all([page.goto("/"), sourcePage.goto(sourceUrl)]);
    await expect(page.locator("#app")).toHaveAttribute(
      "data-app-state",
      "ready",
    );
    await sourcePage.waitForFunction(() =>
      Boolean(
        (window as Window & { game?: unknown }).game &&
        document.querySelector("#app > footer"),
      ),
    );

    const beyondCard = page.locator(
      '[data-upgrade-group="money"][data-upgrade-key="blacksmith"]',
    );
    const sourceCard = sourcePage
      .locator(".upgradelist .upgrade")
      .filter({ has: sourcePage.locator('img[src$="blacksmith.png"]') })
      .first();
    await expect(beyondCard).toBeVisible();
    await expect(sourceCard).toBeVisible();
    await expect(beyondCard).toHaveAttribute("data-upgrade-level", "0");
    await expect(sourceCard.locator(".lvl")).toHaveText("0");

    const readStorage = () =>
      page.evaluate(() => ({
        legacy: localStorage.getItem("IdleMine"),
        beyond: localStorage.getItem("IdleMineBeyond"),
      }));
    const [beforePurchase, sourceBeforePurchase] = await Promise.all([
      readStorage(),
      sourcePage.evaluate(() => localStorage.getItem("IdleMine")),
    ]);
    expect(beforePurchase.legacy).toBe(encodedSave);
    expect(beforePurchase.beyond).not.toBeNull();
    expect(sourceBeforePurchase).toBe(encodedSave);

    await Promise.all([beyondCard.click(), sourceCard.click()]);
    await expect(beyondCard).toHaveAttribute("data-upgrade-level", "1");
    await expect(sourceCard.locator(".lvl")).toHaveText("1");
    const [afterPurchase, sourceAfterPurchase] = await Promise.all([
      readStorage(),
      sourcePage.evaluate(() => localStorage.getItem("IdleMine")),
    ]);
    expect(afterPurchase).toEqual(beforePurchase);
    expect(sourceAfterPurchase).toBe(sourceBeforePurchase);

    await Promise.all([page.reload(), sourcePage.reload()]);
    await expect(page.locator("#app")).toHaveAttribute(
      "data-app-state",
      "ready",
    );
    await sourcePage.waitForFunction(() =>
      Boolean((window as Window & { game?: unknown }).game),
    );
    await expect(beyondCard).toHaveAttribute("data-upgrade-level", "0");
    await expect(sourceCard.locator(".lvl")).toHaveText("0");
    expect(await readStorage()).toEqual(beforePurchase);
    expect(
      await sourcePage.evaluate(() => localStorage.getItem("IdleMine")),
    ).toBe(sourceBeforePurchase);
  } finally {
    await sourceContext.close().catch(() => undefined);
  }
});

test("an upgrade purchase persists after the source autosave threshold", async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);
  const fixture = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-reference-corpus.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as SaveFixture;
  const save = JSON.parse(fixture.data.saveApplicationSemantics.inputJson) as {
    money: string;
    highestMoney: string;
    mineObjectLevel: number;
    highestMineObjectLevel: number;
    lastActive: number;
    settings: { theme: string; tab: string; upgradeTab?: string };
    upgrades: Record<string, { level: number }>;
    pickaxe: { name: string; pow: string; quality: string };
  };
  const fixedTime = 1_700_000_000_000;
  save.money = "1000";
  save.highestMoney = "1000";
  save.settings.theme = "light";
  save.settings.tab = "main";
  save.settings.upgradeTab = "money";
  save.upgrades["blacksmith"] = { level: 0 };
  save.pickaxe = { ...save.pickaxe, pow: "0", quality: "0" };
  save.lastActive = fixedTime;
  const encodedSave = encodeRemixLegacySave(save);
  const sourceContext = await browser.newContext({
    locale: "en-US",
    timezoneId: "UTC",
    viewport: { width: 1440, height: 900 },
  });
  const sourcePage = await sourceContext.newPage();
  const initializePage = ({
    encoded,
    now,
  }: {
    encoded: string;
    now: number;
  }) => {
    localStorage.clear();
    localStorage.setItem("IdleMine", encoded);
    let currentTime = now;
    Object.defineProperty(window, "__upgradeAutosaveNow", {
      configurable: false,
      get: () => currentTime,
      set: (next: number) => {
        currentTime = next;
      },
    });
    Date.now = () => currentTime;
  };

  try {
    const sourceUrl = await routePinnedRemixOracle(sourceContext);
    await Promise.all([
      page.addInitScript(initializePage, {
        encoded: encodedSave,
        now: fixedTime,
      }),
      sourcePage.addInitScript(initializePage, {
        encoded: encodedSave,
        now: fixedTime,
      }),
    ]);
    await page.setViewportSize({ width: 1440, height: 900 });
    await Promise.all([page.goto("/"), sourcePage.goto(sourceUrl)]);
    await expect(page.locator("#app")).toHaveAttribute(
      "data-app-state",
      "ready",
    );
    await sourcePage.waitForFunction(() =>
      Boolean(
        (window as Window & { game?: unknown }).game &&
        document.querySelector("#app > footer"),
      ),
    );

    const beyondCard = page.locator(
      '[data-upgrade-group="money"][data-upgrade-key="blacksmith"]',
    );
    const sourceCard = sourcePage
      .locator(".upgradelist .upgrade")
      .filter({ has: sourcePage.locator('img[src$="blacksmith.png"]') })
      .first();
    const readBeyondStorage = () =>
      page.evaluate(() => ({
        legacy: localStorage.getItem("IdleMine"),
        primary: localStorage.getItem("IdleMineBeyond"),
      }));
    const [initialBeyondStorage, initialSourceStorage] = await Promise.all([
      readBeyondStorage(),
      sourcePage.evaluate(() => localStorage.getItem("IdleMine")),
    ]);
    expect(initialBeyondStorage.legacy).toBe(encodedSave);
    expect(initialSourceStorage).toBe(encodedSave);

    await Promise.all([beyondCard.click(), sourceCard.click()]);
    await expect(beyondCard).toHaveAttribute("data-upgrade-level", "1");
    await expect(sourceCard.locator(".lvl")).toHaveText("1");
    expect(await readBeyondStorage()).toEqual(initialBeyondStorage);
    expect(
      await sourcePage.evaluate(() => localStorage.getItem("IdleMine")),
    ).toBe(initialSourceStorage);

    const advanceAutosaveClock = (elapsed: number) =>
      Promise.all(
        [page, sourcePage].map((target) =>
          target.evaluate((duration) => {
            const testWindow = window as Window & {
              __upgradeAutosaveNow?: number;
            };
            if (testWindow.__upgradeAutosaveNow === undefined) {
              throw new Error("The controlled autosave clock is missing.");
            }
            testWindow.__upgradeAutosaveNow += duration;
          }, elapsed),
        ),
      );
    await advanceAutosaveClock(60_000);
    await Promise.all([
      page.waitForTimeout(150),
      sourcePage.waitForTimeout(150),
    ]);
    await Promise.all([
      expect(page.locator(".messagelog")).not.toContainText("Game Saved!"),
      expect(sourcePage.locator(".messagelog")).not.toContainText(
        "Game Saved!",
      ),
    ]);
    expect(await readBeyondStorage()).toEqual(initialBeyondStorage);
    expect(
      await sourcePage.evaluate(() => localStorage.getItem("IdleMine")),
    ).toBe(initialSourceStorage);

    await advanceAutosaveClock(1);
    await Promise.all([
      expect(sourcePage.locator(".messagelog")).toContainText("Game Saved!"),
      expect(page.locator(".messagelog")).toContainText("Game Saved!"),
    ]);
    const [savedBeyondStorage, savedSourceStorage] = await Promise.all([
      readBeyondStorage(),
      sourcePage.evaluate(() => localStorage.getItem("IdleMine")),
    ]);
    expect(savedSourceStorage).not.toBe(initialSourceStorage);
    expect(savedBeyondStorage.primary).not.toBe(initialBeyondStorage.primary);
    expect(savedBeyondStorage.legacy).toBe(initialBeyondStorage.legacy);

    await Promise.all([
      page.locator("[data-game-tab='settings']").click(),
      sourcePage
        .locator("footer button")
        .filter({ hasText: "Settings" })
        .click(),
    ]);
    await Promise.all([
      page.locator("[data-settings-export]").click(),
      sourcePage
        .locator("article.settings")
        .getByRole("button", {
          name: "Export",
        })
        .click(),
    ]);
    const [beyondExport, sourceExport] = await Promise.all([
      page.locator("[data-settings-save-field]").inputValue(),
      sourcePage.locator("article.settings textarea").inputValue(),
    ]);
    expect(beyondExport).toBe(sourceExport);
    const decodedSource = await sourcePage.evaluate((encoded) => {
      return JSON.parse(unescape(decodeURIComponent(atob(encoded)))) as {
        upgrades: Record<string, { level: number }>;
        money: string;
      };
    }, sourceExport);
    expect(decodedSource.upgrades["blacksmith"]?.level).toBe(1);
    expect(decodedSource.money).toBe("970");
  } finally {
    await sourceContext.close().catch(() => undefined);
  }
});

test("autosaves exact-price purchases from all four resource families together", async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  const fixture = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-reference-corpus.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as SaveFixture;
  const purchaseNames = [
    "buy-exact-affordability",
    "buy-uses-gem-resource",
    "buy-uses-planet-coin-resource",
    "buy-uses-wisdom-resource",
  ];
  const purchases = purchaseNames.map((name) => {
    const purchase = fixture.data.upgradeSemantics.purchaseSemantics.find(
      (candidate) => candidate.name === name,
    );
    if (!purchase)
      throw new Error(`Pinned purchase capture is missing: ${name}`);
    const upgrade =
      fixture.data.upgradeSemantics.groups[purchase.group][purchase.key];
    if (!upgrade)
      throw new Error(`Pinned upgrade definition is missing: ${purchase.key}`);
    return {
      ...purchase,
      ...upgrade,
      captureName: purchase.name,
    };
  });
  const priceFor = (name: string) => {
    const purchase = purchases.find(
      (candidate) => candidate.captureName === name,
    );
    if (!purchase)
      throw new Error(`Pinned purchase capture is missing: ${name}`);
    return purchase.currentPrice.decimal;
  };
  const fixedTime = 1_700_000_000_000;
  const save = JSON.parse(fixture.data.saveApplicationSemantics.inputJson) as {
    money: string;
    gems: string;
    planetCoins: string;
    wisdom: string;
    maxWisdom: string;
    highestMoney: string;
    highestMineObjectLevel: number;
    mineObjectLevel: number;
    lastActive: number;
    settings: { theme: string; tab: string; upgradeTab?: string };
    upgrades: Record<string, { level: number }>;
    gemUpgrades: Record<string, { level: number }>;
    planetCoinUpgrades: Record<string, { level: number }>;
    powers: {
      data: { values: string[] };
      upgrades: Record<string, { level: number }>;
    };
    pickaxe: { name: string; pow: string; quality: string };
  };
  save.money = priceFor("buy-exact-affordability");
  save.gems = priceFor("buy-uses-gem-resource");
  save.planetCoins = priceFor("buy-uses-planet-coin-resource");
  save.wisdom = priceFor("buy-uses-wisdom-resource");
  save.maxWisdom = save.wisdom;
  save.highestMoney = save.money;
  save.highestMineObjectLevel = 170;
  save.mineObjectLevel = 170;
  save.settings.theme = "light";
  save.settings.tab = "main";
  save.settings.upgradeTab = "money";
  save.upgrades = { activePower: { level: 0 } };
  save.gemUpgrades = { offlineGems: { level: 0 } };
  save.planetCoinUpgrades = { activePower: { level: 0 } };
  save.powers.data.values = ["1", "1", "1", "1", "1"];
  save.powers.upgrades = Object.fromEntries(
    Object.keys(fixture.data.upgradeSemantics.groups["wisdom"]).map((key) => [
      key,
      { level: 0 },
    ]),
  );
  save.pickaxe = { ...save.pickaxe, pow: "0", quality: "0" };
  save.lastActive = fixedTime;
  const encodedSave = encodeRemixLegacySave(save);
  const sourceContext = await browser.newContext({
    locale: "en-US",
    timezoneId: "UTC",
    viewport: { width: 1440, height: 900 },
  });
  const sourcePage = await sourceContext.newPage();
  const initializePage = ({
    encoded,
    now,
  }: {
    encoded: string;
    now: number;
  }) => {
    if (sessionStorage.getItem("__upgradeAutosaveSeeded") !== "true") {
      localStorage.clear();
      localStorage.setItem("IdleMine", encoded);
      sessionStorage.setItem("__upgradeAutosaveSeeded", "true");
    }
    let currentTime = now;
    Object.defineProperty(window, "__upgradeAutosaveNow", {
      configurable: false,
      get: () => currentTime,
      set: (next: number) => {
        currentTime = next;
      },
    });
    Date.now = () => currentTime;
  };

  try {
    const sourceUrl = await routePinnedRemixOracle(sourceContext);
    await Promise.all([
      page.addInitScript(initializePage, {
        encoded: encodedSave,
        now: fixedTime,
      }),
      sourcePage.addInitScript(initializePage, {
        encoded: encodedSave,
        now: fixedTime,
      }),
    ]);
    await page.setViewportSize({ width: 1440, height: 900 });
    await Promise.all([page.goto("/"), sourcePage.goto(sourceUrl)]);
    await expect(page.locator("#app")).toHaveAttribute(
      "data-app-state",
      "ready",
    );
    await sourcePage.waitForFunction(() =>
      Boolean(
        (window as Window & { game?: unknown }).game &&
        document.querySelector("#app > footer"),
      ),
    );

    const initialBeyondStorage = await page.evaluate(() => ({
      legacy: localStorage.getItem("IdleMine"),
      primary: localStorage.getItem("IdleMineBeyond"),
    }));
    const initialSourceStorage = await sourcePage.evaluate(() =>
      localStorage.getItem("IdleMine"),
    );
    expect(initialBeyondStorage.legacy).toBe(encodedSave);
    expect(initialBeyondStorage.primary).not.toBeNull();
    expect(initialSourceStorage).toBe(encodedSave);

    for (const purchase of purchases) {
      if (purchase.group === "wisdom") {
        await Promise.all([
          page.locator('[data-game-tab="powers"]').click(),
          sourcePage
            .locator("footer button")
            .filter({ hasText: "Powers" })
            .click(),
        ]);
      } else if (purchase.group !== "money") {
        const beyondGroup = purchase.group;
        const sourceLabel =
          purchase.group === "planetCoins" ? "PC Upgrades" : "Gem Upgrades";
        await Promise.all([
          page.locator(`[data-upgrade-tab="${beyondGroup}"]`).click(),
          sourcePage
            .locator(".upg-tabs button")
            .filter({ hasText: sourceLabel })
            .click(),
        ]);
      }

      const beyondCard =
        purchase.group === "wisdom"
          ? page.locator(`[data-wisdom-upgrade="${purchase.key}"]`)
          : page.locator(
              `[data-upgrade-group="${purchase.group}"][data-upgrade-key="${purchase.key}"]`,
            );
      const imageName = purchase.image.split("/").at(-1);
      const sourceCard =
        purchase.group === "wisdom"
          ? sourcePage
              .locator("article.powers .powers-upgrades button")
              .filter({ hasText: purchase.name })
              .first()
          : sourcePage
              .locator(".upgradelist .upgrade")
              .filter({ has: sourcePage.locator(`img[src$="${imageName}"]`) })
              .first();
      await Promise.all([beyondCard.click(), sourceCard.click()]);
      await expect(beyondCard).toHaveAttribute("data-upgrade-level", "1");
      if (purchase.group === "wisdom") {
        await expect(beyondCard).toContainText("1");
      } else {
        await expect(sourceCard.locator(".lvl")).toHaveText(/^1(?:\/|$)/);
      }
      expect(
        await page.evaluate(() => ({
          legacy: localStorage.getItem("IdleMine"),
          primary: localStorage.getItem("IdleMineBeyond"),
        })),
      ).toEqual(initialBeyondStorage);
      expect(
        await sourcePage.evaluate(() => localStorage.getItem("IdleMine")),
      ).toBe(initialSourceStorage);
    }

    await Promise.all([
      page.locator('[data-game-tab="mining"]').click(),
      sourcePage.locator("footer button").filter({ hasText: "Mining" }).click(),
    ]);

    const advanceAutosaveClock = (elapsed: number) =>
      Promise.all(
        [page, sourcePage].map((target) =>
          target.evaluate((duration) => {
            const testWindow = window as Window & {
              __upgradeAutosaveNow?: number;
            };
            if (testWindow.__upgradeAutosaveNow === undefined) {
              throw new Error("The controlled autosave clock is missing.");
            }
            testWindow.__upgradeAutosaveNow += duration;
          }, elapsed),
        ),
      );
    await advanceAutosaveClock(60_000);
    await Promise.all([
      page.waitForTimeout(150),
      sourcePage.waitForTimeout(150),
    ]);
    await Promise.all([
      expect(page.locator(".messagelog")).not.toContainText("Game Saved!"),
      expect(sourcePage.locator(".messagelog")).not.toContainText(
        "Game Saved!",
      ),
    ]);
    expect(
      await page.evaluate(() => localStorage.getItem("IdleMineBeyond")),
    ).toBe(initialBeyondStorage.primary);
    expect(
      await sourcePage.evaluate(() => localStorage.getItem("IdleMine")),
    ).toBe(initialSourceStorage);

    await advanceAutosaveClock(1);
    await Promise.all([
      expect(page.locator(".messagelog")).toContainText("Game Saved!"),
      expect(sourcePage.locator(".messagelog")).toContainText("Game Saved!"),
    ]);
    await Promise.all([
      page.locator('[data-game-tab="settings"]').click(),
      sourcePage
        .locator("footer button")
        .filter({ hasText: "Settings" })
        .click(),
    ]);
    await Promise.all([
      page.locator("[data-settings-export]").click(),
      sourcePage.getByRole("button", { name: "Export" }).click(),
    ]);
    const [beyondExport, sourceExport] = await Promise.all([
      page.locator("[data-settings-save-field]").inputValue(),
      sourcePage.locator("article.settings textarea").inputValue(),
    ]);
    expect(beyondExport).toBe(sourceExport);
    const decodedSource = await sourcePage.evaluate((encoded) => {
      return JSON.parse(unescape(decodeURIComponent(atob(encoded)))) as {
        upgrades: Record<string, { level: number }>;
        gemUpgrades: Record<string, { level: number }>;
        planetCoinUpgrades: Record<string, { level: number }>;
        powers: { upgrades: Record<string, { level: number }> };
        money: string;
        gems: string;
        planetCoins: string;
        wisdom: string;
      };
    }, sourceExport);
    expect(decodedSource).toMatchObject({
      money: "0",
      gems: "0",
      planetCoins: "0",
      wisdom: "0",
      upgrades: { activePower: { level: 1 } },
      gemUpgrades: { offlineGems: { level: 1 } },
      planetCoinUpgrades: { activePower: { level: 1 } },
      powers: { upgrades: { gemBoostSimple: { level: 1 } } },
    });

    await Promise.all([page.reload(), sourcePage.reload()]);
    await expect(page.locator("#app")).toHaveAttribute(
      "data-app-state",
      "ready",
    );
    await sourcePage.waitForFunction(() =>
      Boolean((window as Window & { game?: unknown }).game),
    );
    await Promise.all([
      page.locator('[data-game-tab="settings"]').click(),
      sourcePage
        .locator("footer button")
        .filter({ hasText: "Settings" })
        .click(),
    ]);
    await Promise.all([
      page.locator("[data-settings-export]").click(),
      sourcePage.getByRole("button", { name: "Export" }).click(),
    ]);
    const [reloadedBeyondExport, reloadedSourceExport] = await Promise.all([
      page.locator("[data-settings-save-field]").inputValue(),
      sourcePage.locator("article.settings textarea").inputValue(),
    ]);
    const readReloadedPurchaseState = (target: typeof page, encoded: string) =>
      target.evaluate((saveString) => {
        const decoded = JSON.parse(
          unescape(decodeURIComponent(atob(saveString))),
        ) as {
          money: string;
          gems: string;
          planetCoins: string;
          wisdom: string;
          upgrades: Record<string, { level: number }>;
          gemUpgrades: Record<string, { level: number }>;
          planetCoinUpgrades: Record<string, { level: number }>;
          powers: { upgrades: Record<string, { level: number }> };
        };
        return {
          money: decoded.money,
          gems: decoded.gems,
          planetCoins: decoded.planetCoins,
          wisdom: decoded.wisdom,
          moneyUpgrade: decoded.upgrades["activePower"]?.level,
          gemUpgrade: decoded.gemUpgrades["offlineGems"]?.level,
          planetCoinUpgrade: decoded.planetCoinUpgrades["activePower"]?.level,
          wisdomUpgrade: decoded.powers.upgrades["gemBoostSimple"]?.level,
        };
      }, encoded);
    const [reloadedBeyondState, reloadedSourceState] = await Promise.all([
      readReloadedPurchaseState(page, reloadedBeyondExport),
      readReloadedPurchaseState(sourcePage, reloadedSourceExport),
    ]);
    expect(reloadedBeyondState).toEqual(reloadedSourceState);
    expect(reloadedBeyondState).toEqual({
      money: "0",
      gems: "0",
      planetCoins: "0",
      wisdom: "0",
      moneyUpgrade: 1,
      gemUpgrade: 1,
      planetCoinUpgrade: 1,
      wisdomUpgrade: 1,
    });
  } finally {
    await sourceContext.close().catch(() => undefined);
  }
});
