import { expect, test, type Browser, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createBeyondVisualSaveFromRemixSave } from "./visual-state.js";
import { routePinnedRemixOracle } from "./remix-oracle-route.js";

const fixedTime = 1_700_000_000_000;
type ShopGroup = "money" | "gems" | "planetCoins";
type PurchaseGroup = ShopGroup | "wisdom";

const groupLabels: Record<ShopGroup, string> = {
  money: "Money Upgrades",
  gems: "Gem Upgrades",
  planetCoins: "PC Upgrades",
};

type DecimalCapture = { decimal: string };

type PurchaseCapture = {
  name: string;
  group: PurchaseGroup;
  key: string;
  currentPrice: DecimalCapture;
  startingLevel: number;
  endingLevel: number;
  purchases: number;
  operation: { method: "buy" | "buy10" | "buy100" };
  startingResources: {
    money: DecimalCapture;
    gems: DecimalCapture;
    planetCoins: DecimalCapture;
    wisdom: DecimalCapture;
  };
  endingResources: {
    money: DecimalCapture;
    gems: DecimalCapture;
    planetCoins: DecimalCapture;
    wisdom: DecimalCapture;
  };
};

type ReferenceCorpus = {
  data: {
    saveApplicationSemantics: { inputJson: string };
    upgradeSemantics: {
      groups: Record<
        PurchaseGroup,
        Record<string, { image: string; name: string }>
      >;
      purchaseSemantics: PurchaseCapture[];
    };
  };
};

type LegacySave = {
  lastActive: number;
  money: string;
  highestMoney: string;
  gems: string;
  planetCoins: string;
  maxPlanetCoins: string;
  maxWisdom: string;
  wisdom: string;
  mineObjectLevel: number;
  highestMineObjectLevel: number;
  settings: {
    tab: string;
    theme: string;
    upgradeTab: string;
  };
  upgrades: Record<string, { level: number }>;
  gemUpgrades: Record<string, { level: number }>;
  planetCoinUpgrades: Record<string, { level: number }>;
  powers: {
    data: { values: string[] };
    upgrades: Record<string, { level: number }>;
  };
  pickaxe: { name: string; pow: string; quality: string };
};

async function encodeWithRemixExpression(page: Page, save: LegacySave) {
  return page.evaluate((value) => {
    const json = JSON.stringify(value);
    if (json === undefined) throw new Error("Remix save input is not JSON.");
    return btoa(escape(encodeURIComponent(json)));
  }, save);
}

function findDifferences(
  beyond: unknown,
  remix: unknown,
  path = "$",
  differences: string[] = [],
): string[] {
  if (Object.is(beyond, remix)) return differences;
  if (
    beyond === null ||
    remix === null ||
    typeof beyond !== "object" ||
    typeof remix !== "object"
  ) {
    differences.push(
      `${path}: Beyond=${JSON.stringify(beyond)} Remix=${JSON.stringify(remix)}`,
    );
    return differences;
  }
  const beyondRecord = beyond as Record<string, unknown>;
  const remixRecord = remix as Record<string, unknown>;
  for (const key of new Set([
    ...Object.keys(beyondRecord),
    ...Object.keys(remixRecord),
  ])) {
    findDifferences(
      beyondRecord[key],
      remixRecord[key],
      `${path}.${key}`,
      differences,
    );
  }
  return differences;
}

function seedSource({ encoded, now }: { encoded: string; now: number }) {
  if (sessionStorage.getItem("save-export-source-seeded") !== "true") {
    localStorage.clear();
    localStorage.setItem("IdleMine", encoded);
    sessionStorage.setItem("save-export-source-seeded", "true");
  }
  Date.now = () => now;
}

function seedBeyond({ encoded, now }: { encoded: string; now: number }) {
  if (sessionStorage.getItem("save-export-beyond-seeded") !== "true") {
    localStorage.clear();
    localStorage.setItem("IdleMineBeyond", encoded);
    sessionStorage.setItem("save-export-beyond-seeded", "true");
  }
  Date.now = () => now;
}

async function capturePinnedUpgradePrice(
  browser: Browser,
  encoded: string,
  group: "gems" | "planetCoins",
  key: string,
) {
  const sourceContext = await browser.newContext({
    locale: "en-US",
    timezoneId: "UTC",
    viewport: { width: 1440, height: 900 },
  });
  try {
    const sourcePage = await sourceContext.newPage();
    const sourceUrl = await routePinnedRemixOracle(sourceContext);
    await sourcePage.addInitScript(seedSource, { encoded, now: fixedTime });
    await sourcePage.goto(sourceUrl);
    await sourcePage.waitForFunction(() =>
      Boolean((window as Window & { game?: unknown }).game),
    );
    return await sourcePage.evaluate(
      ({ group, key }) => {
        const sourceGroup = {
          gems: "gemUpgrades",
          planetCoins: "planetCoinUpgrades",
        }[group];
        const gameState = (
          window as unknown as {
            game?: Record<
              string,
              Record<string, { currentPrice(): { toString(): string } }>
            >;
          }
        ).game;
        const upgrade = gameState?.[sourceGroup]?.[key];
        if (!upgrade) throw new Error(`Pinned ${group} upgrade is missing.`);
        return upgrade.currentPrice().toString();
      },
      { group, key },
    );
  } finally {
    await sourceContext.close().catch(() => undefined);
  }
}

async function comparePurchaseExport(
  browser: Browser,
  page: Page,
  purchaseName: string,
  theme: "light" | "dark" = "light",
) {
  const corpus = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-reference-corpus.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as ReferenceCorpus;
  const purchase = corpus.data.upgradeSemantics.purchaseSemantics.find(
    ({ name }) => name === purchaseName,
  );
  if (!purchase) throw new Error(`Pinned purchase ${purchaseName} is missing.`);
  if (purchaseName === "buy-exact-affordability") {
    expect(purchase).toMatchObject({
      group: "money",
      key: "activePower",
      startingLevel: 0,
      endingLevel: 1,
      operation: { method: "buy" },
    });
    expect(purchase.startingResources.money.decimal).toBe("1000");
    expect(purchase.endingResources.money.decimal).toBe("0");
  }
  if (purchaseName === "buy-uses-gem-resource") {
    expect(purchase).toMatchObject({
      group: "gems",
      key: "offlineGems",
      startingLevel: 0,
      endingLevel: 1,
      operation: { method: "buy" },
    });
    expect(purchase.startingResources.gems.decimal).toBe("4444");
    expect(purchase.endingResources.gems.decimal).toBe("0");
  }
  if (purchaseName === "buy-uses-planet-coin-resource") {
    expect(purchase).toMatchObject({
      group: "planetCoins",
      key: "activePower",
      startingLevel: 0,
      endingLevel: 1,
      operation: { method: "buy" },
    });
    expect(purchase.startingResources.planetCoins.decimal).toBe("100");
    expect(purchase.endingResources.planetCoins.decimal).toBe("0");
  }
  if (purchaseName === "buy-uses-wisdom-resource") {
    expect(purchase).toMatchObject({
      group: "wisdom",
      key: "gemBoostSimple",
      startingLevel: 0,
      endingLevel: 1,
      operation: { method: "buy" },
    });
    expect(purchase.startingResources.wisdom.decimal).toBe("10000000000");
    expect(purchase.endingResources.wisdom.decimal).toBe("0");
  }
  if (purchaseName === "buy10-aligns-current-level") {
    expect(purchase).toMatchObject({
      group: "money",
      key: "activePower",
      startingLevel: 9,
      endingLevel: 10,
      operation: { method: "buy10" },
      startingResources: { money: { decimal: "512000" } },
      endingResources: { money: { decimal: "0" } },
    });
  }
  if (purchaseName === "buy100-aligns-current-level") {
    expect(purchase).toMatchObject({
      group: "money",
      key: "activePower",
      startingLevel: 99,
      endingLevel: 100,
      operation: { method: "buy100" },
      startingResources: {
        money: { decimal: "6.3382530011411475e+32" },
      },
      endingResources: { money: { decimal: "0" } },
    });
  }
  if (purchaseName === "buy10-stops-before-alignment-on-affordability") {
    expect(purchase).toMatchObject({
      group: "money",
      key: "activePower",
      startingLevel: 2,
      endingLevel: 5,
      purchases: 3,
      operation: { method: "buy10" },
      startingResources: { money: { decimal: "28000" } },
      currentPrice: { decimal: "4000" },
      endingResources: { money: { decimal: "0" } },
    });
  }
  if (purchaseName === "buy10-stops-after-two-purchases-on-affordability") {
    expect(purchase).toMatchObject({
      group: "money",
      key: "activePower",
      startingLevel: 2,
      endingLevel: 4,
      purchases: 2,
      operation: { method: "buy10" },
      startingResources: { money: { decimal: "12000" } },
      currentPrice: { decimal: "4000" },
      endingResources: { money: { decimal: "0" } },
    });
  }
  if (
    purchaseName ===
    "buy10-gem-multiplier-stops-before-alignment-on-affordability"
  ) {
    expect(purchase).toMatchObject({
      group: "gems",
      key: "gemMultiply",
      startingLevel: 0,
      endingLevel: 3,
      purchases: 3,
      operation: { method: "buy10" },
      startingResources: { gems: { decimal: "7000" } },
      currentPrice: { decimal: "1000" },
      endingResources: { gems: { decimal: "247.5" } },
    });
  }
  if (
    purchaseName ===
    "buy10-planet-coin-gem-multiplier-stops-before-alignment-on-affordability"
  ) {
    expect(purchase).toMatchObject({
      group: "planetCoins",
      key: "gemMultiply",
      startingLevel: 0,
      endingLevel: 3,
      purchases: 3,
      operation: { method: "buy10" },
      startingResources: { planetCoins: { decimal: "7000" } },
      currentPrice: { decimal: "100" },
      endingResources: { planetCoins: { decimal: "85.71" } },
    });
  }
  if (
    purchaseName ===
    "buy10-wisdom-simple-gem-boost-stops-before-alignment-on-affordability"
  ) {
    expect(purchase).toMatchObject({
      group: "wisdom",
      key: "gemBoostSimple",
      startingLevel: 0,
      endingLevel: 1,
      purchases: 1,
      operation: { method: "buy10" },
      startingResources: { wisdom: { decimal: "100000000000000000000" } },
      currentPrice: { decimal: "10000000000" },
      endingResources: { wisdom: { decimal: "99999999990000000000" } },
    });
  }
  if (
    purchaseName ===
    "buy10-wisdom-power-power-active-buys-two-stops-on-affordability"
  ) {
    expect(purchase).toMatchObject({
      group: "wisdom",
      key: "powerPowerActive",
      startingLevel: 0,
      endingLevel: 2,
      purchases: 2,
      operation: { method: "buy10" },
      startingResources: { wisdom: { decimal: "1001" } },
      currentPrice: { decimal: "1" },
      endingResources: { wisdom: { decimal: "0" } },
    });
  }
  if (purchaseName === "buy100-wisdom-power-power-active-from-zero") {
    expect(purchase).toMatchObject({
      group: "wisdom",
      key: "powerPowerActive",
      startingLevel: 0,
      endingLevel: 100,
      purchases: 100,
      operation: { method: "buy100" },
      startingResources: { wisdom: { decimal: "1e+100000000" } },
      endingResources: { wisdom: { decimal: "1e+100000000" } },
    });
  }
  const alignedResourceCases: Record<
    string,
    { group: "gems" | "planetCoins"; level: 9 | 99; method: "buy10" | "buy100" }
  > = {
    "buy10-gem-multiplier-aligns-current-level": {
      group: "gems",
      level: 9,
      method: "buy10",
    },
    "buy100-gem-multiplier-aligns-current-level": {
      group: "gems",
      level: 99,
      method: "buy100",
    },
    "buy10-planet-coin-gem-multiplier-aligns-current-level": {
      group: "planetCoins",
      level: 9,
      method: "buy10",
    },
    "buy100-planet-coin-gem-multiplier-aligns-current-level": {
      group: "planetCoins",
      level: 99,
      method: "buy100",
    },
  };
  const alignedResourceCase = alignedResourceCases[purchaseName];
  if (alignedResourceCase) {
    const resource = alignedResourceCase.group;
    expect(purchase).toMatchObject({
      group: alignedResourceCase.group,
      key: "gemMultiply",
      startingLevel: alignedResourceCase.level,
      endingLevel: alignedResourceCase.level + 1,
      purchases: 1,
      operation: { method: alignedResourceCase.method },
    });
    expect(purchase.startingResources[resource].decimal).toBe(
      purchase.currentPrice.decimal,
    );
    expect(purchase.endingResources[resource].decimal).toBe("0");
  }
  const upgrade =
    corpus.data.upgradeSemantics.groups[purchase.group]?.[purchase.key];
  if (!upgrade)
    throw new Error(`Pinned purchase upgrade is missing: ${purchase.key}`);
  const imageName = upgrade.image.split("/").at(-1);

  const sourceSave = JSON.parse(
    corpus.data.saveApplicationSemantics.inputJson,
  ) as LegacySave;
  sourceSave.lastActive = fixedTime;
  sourceSave.money = purchase.startingResources.money.decimal;
  sourceSave.gems = purchase.startingResources.gems.decimal;
  sourceSave.planetCoins = purchase.startingResources.planetCoins.decimal;
  sourceSave.maxWisdom = purchase.startingResources.wisdom.decimal;
  sourceSave.wisdom = purchase.startingResources.wisdom.decimal;
  const isWisdomPurchase = purchase.group === "wisdom";
  sourceSave.mineObjectLevel = isWisdomPurchase ? 170 : 1;
  sourceSave.highestMineObjectLevel = isWisdomPurchase ? 170 : 90;
  sourceSave.settings.tab = "main";
  sourceSave.settings.theme = theme;
  sourceSave.settings.upgradeTab = "money";
  const upgradeLevels: Record<ShopGroup, Record<string, { level: number }>> = {
    money: { activePower: { level: 0 } },
    gems: { offlineGems: { level: 0 } },
    planetCoins: { activePower: { level: 0 } },
  };
  if (purchase.group !== "wisdom") {
    upgradeLevels[purchase.group][purchase.key] = {
      level: purchase.startingLevel,
    };
  }
  sourceSave.upgrades = upgradeLevels.money;
  sourceSave.gemUpgrades = upgradeLevels.gems;
  sourceSave.planetCoinUpgrades = upgradeLevels.planetCoins;
  sourceSave.powers.data.values = ["1", "1", "1", "1", "1"];
  sourceSave.powers.upgrades = Object.fromEntries(
    Object.keys(corpus.data.upgradeSemantics.groups.wisdom).map((key) => [
      key,
      { level: 0 },
    ]),
  );
  if (isWisdomPurchase) {
    sourceSave.powers.upgrades[purchase.key] = {
      level: purchase.startingLevel,
    };
  }
  sourceSave.pickaxe = { name: "Probe Pickaxe", pow: "0", quality: "0" };
  if (alignedResourceCase) {
    const balanceKey =
      alignedResourceCase.group === "gems" ? "gems" : "planetCoins";
    const probeSave = structuredClone(sourceSave);
    probeSave[balanceKey] = "0";
    const exactPinnedPrice = await capturePinnedUpgradePrice(
      browser,
      await encodeWithRemixExpression(page, probeSave),
      alignedResourceCase.group,
      purchase.key,
    );
    if (browser.browserType().name() === "chromium") {
      expect(exactPinnedPrice).toBe(purchase.currentPrice.decimal);
    }
    sourceSave[balanceKey] = exactPinnedPrice;
  }
  const encodedSourceSave = await encodeWithRemixExpression(page, sourceSave);
  const encodedBeyondSave = await createBeyondVisualSaveFromRemixSave({
    clockMs: fixedTime,
    theme,
    tab: "main",
    saveString: encodedSourceSave,
  });

  const sourceContext = await browser.newContext({
    colorScheme: theme,
    locale: "en-US",
    timezoneId: "UTC",
    viewport: { width: 1440, height: 900 },
  });
  const sourcePage = await sourceContext.newPage();
  try {
    const sourceUrl = await routePinnedRemixOracle(sourceContext);
    await page.setViewportSize({ width: 1440, height: 900 });
    await Promise.all([
      page.addInitScript(seedBeyond, {
        encoded: encodedBeyondSave,
        now: fixedTime,
      }),
      sourcePage.addInitScript(seedSource, {
        encoded: encodedSourceSave,
        now: fixedTime,
      }),
    ]);
    await Promise.all([page.goto("/"), sourcePage.goto(sourceUrl)]);
    await expect(page.locator("#app")).toHaveAttribute(
      "data-app-state",
      "ready",
    );
    await sourcePage.waitForFunction(() =>
      Boolean((window as Window & { game?: unknown }).game),
    );

    if (purchase.group === "wisdom") {
      await Promise.all([
        page.locator("[data-game-tab='powers']").click(),
        sourcePage
          .locator("footer button")
          .filter({ hasText: "Powers" })
          .click(),
      ]);
    } else if (purchase.group !== "money") {
      await Promise.all([
        page.locator(`[data-upgrade-tab="${purchase.group}"]`).click(),
        sourcePage
          .locator(".upg-tabs button")
          .filter({ hasText: groupLabels[purchase.group] })
          .click(),
      ]);
    }
    const beyondCard = isWisdomPurchase
      ? page.locator(`[data-wisdom-upgrade="${purchase.key}"]`)
      : page.locator(
          `[data-upgrade-group="${purchase.group}"][data-upgrade-key="${purchase.key}"]`,
        );
    const sourceCard = isWisdomPurchase
      ? sourcePage
          .locator("article.powers .powers-upgrades button")
          .filter({ hasText: upgrade.name })
          .first()
      : sourcePage
          .locator(".upgradelist .upgrade")
          .filter({ has: sourcePage.locator(`img[src$="${imageName}"]`) })
          .first();
    const modifier =
      purchase.operation.method === "buy10"
        ? "Shift"
        : purchase.operation.method === "buy100"
          ? "Control"
          : undefined;
    if (modifier) {
      await Promise.all([
        page.keyboard.down(modifier),
        sourcePage.keyboard.down(modifier),
      ]);
    }
    try {
      await Promise.all([beyondCard.click(), sourceCard.click()]);
    } finally {
      if (modifier) {
        await Promise.all([
          page.keyboard.up(modifier),
          sourcePage.keyboard.up(modifier),
        ]);
      }
    }
    await expect(beyondCard).toHaveAttribute(
      "data-upgrade-level",
      String(purchase.endingLevel),
    );
    if (isWisdomPurchase) {
      expect(await sourceCard.innerText()).toBe(await beyondCard.innerText());
    } else {
      await expect(sourceCard.locator(".lvl")).toHaveText(
        await beyondCard.locator(".lvl").innerText(),
      );
    }

    if (
      purchaseName === "buy-exact-affordability" ||
      purchaseName === "buy-uses-gem-resource" ||
      purchaseName === "buy-uses-planet-coin-resource" ||
      purchaseName === "buy-uses-wisdom-resource"
    ) {
      await Promise.all([
        page.mouse.move(1439, 899),
        sourcePage.mouse.move(1439, 899),
        page.evaluate(() => document.fonts.ready),
        sourcePage.evaluate(() => document.fonts.ready),
      ]);
      await Promise.all([
        page.evaluate(
          () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() =>
                requestAnimationFrame(() => resolve()),
              ),
            ),
        ),
        sourcePage.evaluate(
          () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() =>
                requestAnimationFrame(() => resolve()),
              ),
            ),
        ),
      ]);
      const [beyondPng, sourcePng] = await Promise.all([
        page.screenshot({ animations: "disabled" }),
        sourcePage.screenshot({ animations: "disabled" }),
      ]);
      const beyondHash = createHash("sha256").update(beyondPng).digest("hex");
      const sourceHash = createHash("sha256").update(sourcePng).digest("hex");
      if (beyondHash !== sourceHash) {
        await Promise.all([
          test
            .info()
            .attach(`${purchase.group}-post-purchase-beyond-${theme}.png`, {
              body: beyondPng,
              contentType: "image/png",
            }),
          test
            .info()
            .attach(`${purchase.group}-post-purchase-remix-${theme}.png`, {
              body: sourcePng,
              contentType: "image/png",
            }),
        ]);
      }
      expect(
        beyondHash,
        `${purchase.group} post-purchase ${theme} full-screen pixels`,
      ).toBe(sourceHash);
    }

    await Promise.all([
      page.locator("[data-game-tab='settings']").click(),
      sourcePage
        .locator("footer button")
        .filter({ hasText: "Settings" })
        .click(),
    ]);
    if (purchaseName === "buy100-wisdom-power-power-active-from-zero") {
      await Promise.all([
        page.getByRole("button", { name: "Save" }).click(),
        sourcePage.getByRole("button", { name: "Save" }).click(),
      ]);
      await Promise.all([page.reload(), sourcePage.reload()]);
      await expect(page.locator("#app")).toHaveAttribute(
        "data-app-state",
        "ready",
      );
      await sourcePage.waitForFunction(() =>
        Boolean((window as Window & { game?: unknown }).game),
      );
      await Promise.all([
        page.locator("[data-game-tab='settings']").click(),
        sourcePage
          .locator("footer button")
          .filter({ hasText: "Settings" })
          .click(),
      ]);
    }
    const beyondSettings = page.locator("article.settings");
    const sourceSettings = sourcePage.locator("article.settings");
    await Promise.all([
      expect(beyondSettings).toBeVisible(),
      expect(sourceSettings).toBeVisible(),
    ]);
    await Promise.all([
      beyondSettings.getByRole("button", { name: "Export" }).click(),
      sourceSettings.getByRole("button", { name: "Export" }).click(),
    ]);
    const [beyondExport, sourceExport] = await Promise.all([
      beyondSettings.locator("textarea").inputValue(),
      sourceSettings.locator("textarea").inputValue(),
    ]);
    const decode = (target: typeof page, value: string) =>
      target.evaluate((encoded) => {
        const json = unescape(decodeURIComponent(atob(encoded)));
        return JSON.parse(json) as unknown;
      }, value);
    const [beyondValue, sourceValue] = await Promise.all([
      decode(page, beyondExport),
      decode(sourcePage, sourceExport),
    ]);
    expect(
      findDifferences(beyondValue, sourceValue),
      "decoded live save differences after purchase",
    ).toEqual([]);
    expect(beyondExport, "complete encoded live save after purchase").toBe(
      sourceExport,
    );
    if (purchaseName === "buy100-wisdom-power-power-active-from-zero") {
      for (const exportedSave of [beyondValue, sourceValue]) {
        const wisdomSave = exportedSave as LegacySave;
        expect(wisdomSave.powers.upgrades["powerPowerActive"]?.level).toBe(100);
        expect(wisdomSave.wisdom).toBe("1e+100000000");
      }
    }
  } finally {
    await sourceContext.close().catch(() => undefined);
  }
}

for (const purchaseName of [
  "buy-exact-affordability",
  "buy-uses-gem-resource",
  "buy-uses-planet-coin-resource",
  "buy-uses-wisdom-resource",
  "buy10-from-zero-aligns-through-level-ten",
  "buy10-gem-multiplier-from-zero-aligns-through-level-ten",
  "buy10-planet-coin-gem-multiplier-from-zero-aligns-through-level-ten",
  "buy10-gem-multiplier-aligns-current-level",
  "buy100-gem-multiplier-aligns-current-level",
  "buy10-planet-coin-gem-multiplier-aligns-current-level",
  "buy100-planet-coin-gem-multiplier-aligns-current-level",
  "buy100-from-zero-aligns-through-level-one-hundred",
  "buy10-aligns-current-level",
  "buy100-aligns-current-level",
  "buy10-stops-before-alignment-on-affordability",
  "buy10-stops-after-two-purchases-on-affordability",
  "buy10-gem-multiplier-stops-before-alignment-on-affordability",
  "buy10-planet-coin-gem-multiplier-stops-before-alignment-on-affordability",
  "buy10-wisdom-simple-gem-boost-stops-before-alignment-on-affordability",
  "buy10-wisdom-power-power-active-buys-two-stops-on-affordability",
  "buy100-wisdom-power-power-active-from-zero",
]) {
  test(`exports the live save after ${purchaseName}`, async ({
    browser,
    page,
  }) => {
    test.setTimeout(90_000);
    await comparePurchaseExport(browser, page, purchaseName);
  });
}

test("exports the live save after the Gem purchase in dark theme", async ({
  browser,
  page,
}) => {
  test.setTimeout(60_000);
  await comparePurchaseExport(browser, page, "buy-uses-gem-resource", "dark");
});

test("exports the live save after the Money purchase in dark theme", async ({
  browser,
  page,
}) => {
  test.setTimeout(60_000);
  await comparePurchaseExport(browser, page, "buy-exact-affordability", "dark");
});

test("exports the live save after the Planet Coin purchase in dark theme", async ({
  browser,
  page,
}) => {
  test.setTimeout(60_000);
  await comparePurchaseExport(
    browser,
    page,
    "buy-uses-planet-coin-resource",
    "dark",
  );
});

test("exports the live save after the Wisdom purchase in dark theme", async ({
  browser,
  page,
}) => {
  test.setTimeout(60_000);
  await comparePurchaseExport(
    browser,
    page,
    "buy-uses-wisdom-resource",
    "dark",
  );
});

test("exports the full live save after purchasing all 29 upgrades", async ({
  browser,
  page,
}) => {
  test.setTimeout(300_000);
  const corpus = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-reference-corpus.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as ReferenceCorpus;
  const sourceSave = JSON.parse(
    corpus.data.saveApplicationSemantics.inputJson,
  ) as LegacySave;
  const wisdomUpgrades = corpus.data.upgradeSemantics.groups.wisdom;
  sourceSave.highestMineObjectLevel = 170;
  sourceSave.mineObjectLevel = 170;
  sourceSave.lastActive = fixedTime;
  sourceSave.money = "1e10";
  sourceSave.highestMoney = sourceSave.money;
  sourceSave.gems = "1e6";
  sourceSave.planetCoins = "1e20";
  sourceSave.maxPlanetCoins = sourceSave.planetCoins;
  sourceSave.wisdom = "1e150";
  sourceSave.maxWisdom = sourceSave.wisdom;
  sourceSave.settings.tab = "main";
  sourceSave.settings.theme = "light";
  for (const group of ["money", "gems", "planetCoins"] as const) {
    const levels = Object.fromEntries(
      Object.keys(corpus.data.upgradeSemantics.groups[group]).map((key) => [
        key,
        { level: 0 },
      ]),
    );
    if (group === "money") sourceSave.upgrades = levels;
    else if (group === "gems") sourceSave.gemUpgrades = levels;
    else sourceSave.planetCoinUpgrades = levels;
  }
  sourceSave.powers.data.values = ["1", "1", "1", "1", "1"];
  sourceSave.powers.upgrades = Object.fromEntries(
    Object.keys(wisdomUpgrades).map((key) => [key, { level: 0 }]),
  );
  const encodedSourceSave = await encodeWithRemixExpression(page, sourceSave);
  const encodedBeyondSave = await createBeyondVisualSaveFromRemixSave({
    clockMs: fixedTime,
    theme: "light",
    tab: "main",
    saveString: encodedSourceSave,
  });
  const sourceContext = await browser.newContext({
    colorScheme: "light",
    locale: "en-US",
    timezoneId: "UTC",
    viewport: { width: 1440, height: 900 },
  });
  const sourcePage = await sourceContext.newPage();

  try {
    const sourceUrl = await routePinnedRemixOracle(sourceContext);
    await Promise.all([
      page.addInitScript(seedBeyond, {
        encoded: encodedBeyondSave,
        now: fixedTime,
      }),
      sourcePage.addInitScript(seedSource, {
        encoded: encodedSourceSave,
        now: fixedTime,
      }),
    ]);
    await Promise.all([page.goto("/"), sourcePage.goto(sourceUrl)]);
    await expect(page.locator("#app")).toHaveAttribute(
      "data-app-state",
      "ready",
    );
    await sourcePage.waitForFunction(() =>
      Boolean((window as Window & { game?: unknown }).game),
    );
    const shopGroups = ["money", "gems", "planetCoins"] as const;
    for (const group of shopGroups) {
      if (group !== "money") {
        await Promise.all([
          page.locator(`[data-upgrade-tab="${group}"]`).click(),
          sourcePage
            .locator(".upg-tabs button")
            .filter({ hasText: groupLabels[group] })
            .click(),
        ]);
      }
      for (const [key, upgrade] of Object.entries(
        corpus.data.upgradeSemantics.groups[group],
      )) {
        const imageName = upgrade.image.split("/").at(-1);
        if (!imageName)
          throw new Error(`Missing upgrade image for ${group}.${key}.`);
        const beyondCard = page.locator(
          `[data-upgrade-group="${group}"][data-upgrade-key="${key}"]`,
        );
        const sourceCard = sourcePage
          .locator(".upgradelist .upgrade")
          .filter({ has: sourcePage.locator(`img[src$="${imageName}"]`) })
          .first();
        await Promise.all([beyondCard.click(), sourceCard.click()]);
        await expect(beyondCard).toHaveAttribute("data-upgrade-level", "1");
        const sourceLevel = await sourcePage.evaluate(
          ({ group, key }) => {
            const game = (
              window as Window & {
                game?: {
                  upgrades: Record<string, { level: number }>;
                  gemUpgrades: Record<string, { level: number }>;
                  planetCoinUpgrades: Record<string, { level: number }>;
                };
              }
            ).game;
            if (!game)
              throw new Error("Pinned Remix game state is unavailable.");
            const levels =
              group === "money"
                ? game.upgrades
                : group === "gems"
                  ? game.gemUpgrades
                  : game.planetCoinUpgrades;
            return levels[key]!.level;
          },
          { group, key },
        );
        expect(sourceLevel).toBe(1);
      }
    }

    await Promise.all([
      page.locator("[data-game-tab='powers']").click(),
      sourcePage.locator("footer button").filter({ hasText: "Powers" }).click(),
    ]);

    for (const [key, upgrade] of Object.entries(wisdomUpgrades)) {
      const beyondCard = page.locator(`[data-wisdom-upgrade="${key}"]`);
      const sourceCard = sourcePage
        .locator("article.powers .powers-upgrades button.upgrade-standalone")
        .filter({ hasText: upgrade.name })
        .first();
      await Promise.all([beyondCard.click(), sourceCard.click()]);
      await Promise.all([
        expect(beyondCard).toHaveAttribute("data-upgrade-level", "1"),
        expect(sourceCard).toContainText("1"),
      ]);
    }

    const [beyondLevels, sourceLevels] = await Promise.all([
      page.evaluate(
        (keys) =>
          keys.map((key) =>
            Number(
              document
                .querySelector(`[data-wisdom-upgrade="${key}"]`)
                ?.getAttribute("data-upgrade-level"),
            ),
          ),
        Object.keys(wisdomUpgrades),
      ),
      sourcePage.evaluate((keys) => {
        const game = (
          window as Window & {
            game?: {
              powers: { upgrades: Record<string, { level: number }> };
            };
          }
        ).game;
        if (!game) throw new Error("Pinned Remix game state is unavailable.");
        return keys.map((key) => game.powers.upgrades[key]!.level);
      }, Object.keys(wisdomUpgrades)),
    ]);
    expect(beyondLevels).toEqual(Array(7).fill(1));
    expect(beyondLevels).toEqual(sourceLevels);

    await Promise.all([
      page.locator("[data-game-tab='settings']").click(),
      sourcePage
        .locator("footer button")
        .filter({ hasText: "Settings" })
        .click(),
    ]);
    const [beyondSettings, sourceSettings] = await Promise.all([
      page.locator("article.settings"),
      sourcePage.locator("article.settings"),
    ]);
    await Promise.all([
      beyondSettings.getByRole("button", { name: "Export" }).click(),
      sourceSettings.getByRole("button", { name: "Export" }).click(),
    ]);
    const [beyondExport, sourceExport] = await Promise.all([
      beyondSettings.locator("textarea").inputValue(),
      sourceSettings.locator("textarea").inputValue(),
    ]);
    const decode = (target: typeof page, value: string) =>
      target.evaluate((encoded) => {
        const json = unescape(decodeURIComponent(atob(encoded)));
        return JSON.parse(json) as unknown;
      }, value);
    const [beyondValue, sourceValue] = await Promise.all([
      decode(page, beyondExport),
      decode(sourcePage, sourceExport),
    ]);
    expect(
      findDifferences(beyondValue, sourceValue),
      "complete decoded saves after all 29 upgrade purchases",
    ).toEqual([]);
    expect(beyondExport).toBe(sourceExport);
  } finally {
    await sourceContext.close().catch(() => undefined);
  }
});
