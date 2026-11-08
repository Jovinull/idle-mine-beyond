import { expect, test, type Browser, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { encodeRemixLegacySave } from "../../packages/persistence/src/remix-save-codec.js";
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
  startingLevel: number;
  endingLevel: number;
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
  gems: string;
  planetCoins: string;
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
  localStorage.clear();
  localStorage.setItem("IdleMine", encoded);
  Date.now = () => now;
}

function seedBeyond({ encoded, now }: { encoded: string; now: number }) {
  localStorage.clear();
  localStorage.setItem("IdleMineBeyond", encoded);
  Date.now = () => now;
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
  const encodedSourceSave = encodeRemixLegacySave(sourceSave);
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

    if (purchaseName === "buy-uses-gem-resource") {
      await Promise.all([
        page.setViewportSize({ width: 1440, height: 900 }),
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
          test.info().attach(`gem-post-purchase-beyond-${theme}.png`, {
            body: beyondPng,
            contentType: "image/png",
          }),
          test.info().attach(`gem-post-purchase-remix-${theme}.png`, {
            body: sourcePng,
            contentType: "image/png",
          }),
        ]);
      }
      expect(beyondHash, `Gem post-purchase ${theme} full-screen pixels`).toBe(
        sourceHash,
      );
    }

    await Promise.all([
      page.locator("[data-game-tab='settings']").click(),
      sourcePage
        .locator("footer button")
        .filter({ hasText: "Settings" })
        .click(),
    ]);
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
  "buy100-from-zero-aligns-through-level-one-hundred",
]) {
  test(`exports the live save after ${purchaseName}`, async ({
    browser,
    page,
  }) => {
    test.setTimeout(60_000);
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
