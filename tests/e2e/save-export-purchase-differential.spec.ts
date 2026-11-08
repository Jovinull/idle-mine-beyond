import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { encodeRemixLegacySave } from "../../packages/persistence/src/remix-save-codec.js";
import { createBeyondVisualSaveFromRemixSave } from "./visual-state.js";
import { routePinnedRemixOracle } from "./remix-oracle-route.js";

const fixedTime = 1_700_000_000_000;

type DecimalCapture = { decimal: string };

type PurchaseCapture = {
  name: string;
  group: "money" | "gems" | "planetCoins";
  key: string;
  startingLevel: number;
  startingResources: {
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
      groups: Record<string, Record<string, { image: string }>>;
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

test("exports the live save after a source-paired upgrade purchase", async ({
  browser,
  page,
}) => {
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
    ({ name }) => name === "buy-exact-affordability",
  );
  if (!purchase)
    throw new Error("Pinned exact-affordability purchase is missing.");
  const imageName = corpus.data.upgradeSemantics.groups[purchase.group]?.[
    purchase.key
  ]?.image
    .split("/")
    .at(-1);
  if (!imageName) throw new Error("Pinned purchase upgrade image is missing.");

  const sourceSave = JSON.parse(
    corpus.data.saveApplicationSemantics.inputJson,
  ) as LegacySave;
  sourceSave.lastActive = fixedTime;
  sourceSave.money = purchase.startingResources.money.decimal;
  sourceSave.gems = purchase.startingResources.gems.decimal;
  sourceSave.planetCoins = purchase.startingResources.planetCoins.decimal;
  sourceSave.maxWisdom = purchase.startingResources.wisdom.decimal;
  sourceSave.mineObjectLevel = 1;
  sourceSave.highestMineObjectLevel = 90;
  sourceSave.settings.tab = "main";
  sourceSave.settings.theme = "light";
  sourceSave.settings.upgradeTab = "money";
  sourceSave.upgrades = {
    [purchase.key]: { level: purchase.startingLevel },
  };
  sourceSave.gemUpgrades = { offlineGems: { level: 0 } };
  sourceSave.planetCoinUpgrades = { activePower: { level: 0 } };
  sourceSave.pickaxe = { name: "Probe Pickaxe", pow: "0", quality: "0" };
  const encodedSourceSave = encodeRemixLegacySave(sourceSave);
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

    const beyondCard = page.locator(
      `[data-upgrade-group="money"][data-upgrade-key="${purchase.key}"]`,
    );
    const sourceCard = sourcePage
      .locator(".upgradelist .upgrade")
      .filter({ has: sourcePage.locator(`img[src$="${imageName}"]`) })
      .first();
    await Promise.all([beyondCard.click(), sourceCard.click()]);
    await expect(beyondCard).toHaveAttribute(
      "data-upgrade-level",
      String(purchase.startingLevel + 1),
    );
    await expect(sourceCard.locator(".lvl")).toHaveText("1");

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
});
