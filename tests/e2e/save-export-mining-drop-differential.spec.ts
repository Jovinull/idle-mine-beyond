import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { encodeRemixLegacySave } from "../../packages/persistence/src/index.js";
import { routePinnedRemixOracle } from "./remix-oracle-route.js";
import { createBeyondVisualSaveFromRemixSave } from "./visual-state.js";

type DecimalSnapshot = { decimal: string };
type DropScenario = {
  name: string;
  input: {
    objectId: number;
    pickaxe: { power: string; quality: string };
    powers: readonly string[];
    resources: {
      money: string;
      highestMoney: string;
      gems: string;
      planetCoins: string;
      maxPlanetCoins: string;
      wisdom: string;
      maxWisdom: string;
    };
    randomValues: readonly number[];
  };
  result: {
    highestMineObjectLevel: number;
    randomCalls: number;
    resources: {
      money: DecimalSnapshot;
      gems: DecimalSnapshot;
      planetCoins: DecimalSnapshot;
      wisdom: DecimalSnapshot;
      maxWisdom: DecimalSnapshot;
    };
  };
};
type ReferenceCorpus = {
  data: {
    saveApplicationSemantics: { inputJson: string };
    miningHitSemantics: { cases: readonly DropScenario[] };
  };
};
type LegacySave = {
  money: string;
  highestMoney: string;
  gems: string;
  planetCoins: string;
  maxPlanetCoins: string;
  wisdom: string;
  maxWisdom: string;
  mineObjectLevel: number;
  highestMineObjectLevel: number;
  lastActive: number;
  settings: {
    theme: string;
    tab: string;
    showMineObjLevel: boolean;
  };
  powers: { data: { values: string[] } };
  pickaxe: { pow: string; quality: string };
};

const fixedClock = 1_704_067_200_000;
const liveDropVariants: {
  scenarioName: string;
  name: string;
  randomValues: readonly number[] | undefined;
  expectedResources?: {
    gems?: string;
    planetCoins?: string;
    wisdom?: string;
    maxWisdom?: string;
  };
}[] = [
  {
    scenarioName: "planet-coin-drop-roll-follows-gem-roll",
    name: "captured Planet Coin drop after a failed Gem roll",
    randomValues: undefined,
  },
  {
    scenarioName: "planet-coin-drop-roll-follows-gem-roll",
    name: "successful Gem drop before a failed Planet Coin roll",
    randomValues: [0, 0.9],
    expectedResources: { gems: "6", planetCoins: "4" },
  },
  {
    scenarioName: "wisdom-drop-scales-with-power-wisdom",
    name: "Power of Wisdom scaled drop",
    randomValues: undefined,
    expectedResources: { wisdom: "5", maxWisdom: "5" },
  },
];
const corpusUrl = new URL(
  "../fixtures/parity/remix-reference-corpus.json",
  import.meta.url,
);

function initializeDropSave({
  storageKey,
  encoded,
  now,
  randomValues,
}: {
  storageKey: "IdleMine" | "IdleMineBeyond";
  encoded: string;
  now: number;
  randomValues: readonly number[];
}): void {
  localStorage.clear();
  localStorage.setItem(storageKey, encoded);
  Date.now = () => now;
  let draws = 0;
  Object.defineProperty(window, "__idleMineDropExportDrawCount", {
    configurable: false,
    value: () => draws,
  });
  Math.random = () => {
    const value = randomValues[draws];
    if (value === undefined) {
      throw new Error("The pinned drop RNG fixture was exhausted.");
    }
    draws += 1;
    return value;
  };
}

async function exportValue(page: Page) {
  const encoded = await page.locator("article.settings textarea").inputValue();
  const value = await page.evaluate((saveString) => {
    const json = unescape(decodeURIComponent(atob(saveString)));
    return JSON.parse(json) as {
      mineObjectLevel: number;
      highestMineObjectLevel: number;
      money: string;
      highestMoney: string;
      gems: string;
      planetCoins: string;
      maxPlanetCoins: string;
      wisdom: string;
      maxWisdom: string;
    };
  }, encoded);
  return { encoded, value };
}

for (const theme of ["light", "dark"] as const) {
  for (const variant of liveDropVariants) {
    test(`exports the source-matched save after ${variant.name} (${theme})`, async ({
      browser,
      page,
    }, testInfo) => {
      test.setTimeout(90_000);
      const corpus = JSON.parse(
        await readFile(corpusUrl, "utf8"),
      ) as ReferenceCorpus;
      const scenario = corpus.data.miningHitSemantics.cases.find(
        ({ name }) => name === variant.scenarioName,
      );
      if (!scenario)
        throw new Error(
          `Pinned mining case ${variant.scenarioName} is missing.`,
        );

      const sourceSave = JSON.parse(
        corpus.data.saveApplicationSemantics.inputJson,
      ) as LegacySave;
      sourceSave.mineObjectLevel = scenario.input.objectId;
      sourceSave.highestMineObjectLevel = scenario.input.objectId;
      sourceSave.money = scenario.input.resources.money;
      sourceSave.highestMoney = scenario.input.resources.highestMoney;
      sourceSave.gems = scenario.input.resources.gems;
      sourceSave.planetCoins = scenario.input.resources.planetCoins;
      sourceSave.maxPlanetCoins = scenario.input.resources.maxPlanetCoins;
      sourceSave.wisdom = scenario.input.resources.wisdom;
      sourceSave.maxWisdom = scenario.input.resources.maxWisdom;
      sourceSave.powers.data.values = [...scenario.input.powers];
      sourceSave.pickaxe.pow = scenario.input.pickaxe.power;
      sourceSave.pickaxe.quality = scenario.input.pickaxe.quality;
      sourceSave.lastActive = fixedClock;
      sourceSave.settings.theme = theme;
      sourceSave.settings.tab = "main";
      sourceSave.settings.showMineObjLevel = true;

      const encodedSource = encodeRemixLegacySave(sourceSave);
      const encodedBeyond = await createBeyondVisualSaveFromRemixSave({
        clockMs: fixedClock,
        theme,
        tab: "main",
        saveString: encodedSource,
      });
      const sourceContext = await browser.newContext({
        baseURL: testInfo.project.use.baseURL as string,
        colorScheme: theme,
        locale: "en-US",
        timezoneId: "UTC",
        viewport: { width: 1440, height: 900 },
      });
      const sourcePage = await sourceContext.newPage();
      try {
        const sourceUrl = await routePinnedRemixOracle(sourcePage);
        await Promise.all([
          page.addInitScript(initializeDropSave, {
            storageKey: "IdleMineBeyond" as const,
            encoded: encodedBeyond,
            now: fixedClock,
            randomValues: variant.randomValues ?? scenario.input.randomValues,
          }),
          sourcePage.addInitScript(initializeDropSave, {
            storageKey: "IdleMine" as const,
            encoded: encodedSource,
            now: fixedClock,
            randomValues: variant.randomValues ?? scenario.input.randomValues,
          }),
        ]);
        await Promise.all([
          page.emulateMedia({ colorScheme: theme }),
          sourcePage.emulateMedia({ colorScheme: theme }),
        ]);
        await page.setViewportSize({ width: 1440, height: 900 });
        await Promise.all([page.goto("/"), sourcePage.goto(sourceUrl)]);
        await expect(page.locator("#app")).toHaveAttribute(
          "data-app-state",
          "ready",
        );
        await sourcePage.waitForFunction(() =>
          Boolean((window as Window & { game?: unknown }).game),
        );

        await Promise.all([
          page.locator("canvas.mine-object[data-damageable='true']").click(),
          sourcePage.locator(".mineobject canvas.mine-object").click(),
        ]);
        await expect(page.locator("[data-mine-object-level]")).toHaveText(
          `#${scenario.input.objectId + 1}`,
        );
        await expect(sourcePage.locator(".mineobject h4")).toHaveText(
          `#${scenario.input.objectId + 1}`,
        );
        await expect(
          page.locator("header .inline-resource").first(),
        ).toContainText(
          variant.expectedResources?.gems ??
            scenario.result.resources.gems.decimal,
        );
        await expect(
          sourcePage.locator("header .inline-resource").first(),
        ).toContainText(
          variant.expectedResources?.gems ??
            scenario.result.resources.gems.decimal,
        );
        expect(
          await Promise.all([
            page.evaluate(() =>
              (
                window as typeof window & {
                  __idleMineDropExportDrawCount: () => number;
                }
              ).__idleMineDropExportDrawCount(),
            ),
            sourcePage.evaluate(() =>
              (
                window as typeof window & {
                  __idleMineDropExportDrawCount: () => number;
                }
              ).__idleMineDropExportDrawCount(),
            ),
          ]),
        ).toEqual([scenario.result.randomCalls, scenario.result.randomCalls]);

        await Promise.all([
          page.locator("[data-game-tab='settings']").click(),
          sourcePage
            .locator("footer button")
            .filter({ hasText: "Settings" })
            .click(),
        ]);
        await Promise.all([
          page.getByRole("button", { name: "Export" }).click(),
          sourcePage.getByRole("button", { name: "Export" }).click(),
        ]);
        const [beyondExport, sourceExport] = await Promise.all([
          exportValue(page),
          exportValue(sourcePage),
        ]);
        expect(beyondExport.value).toEqual(sourceExport.value);
        // The displayed next object is #91, while the serialized current index stays 90.
        expect(beyondExport.value.mineObjectLevel).toBe(
          scenario.input.objectId,
        );
        expect(beyondExport.value.highestMineObjectLevel).toBe(
          scenario.result.highestMineObjectLevel,
        );
        expect(beyondExport.value.planetCoins).toBe(
          variant.expectedResources?.planetCoins ??
            scenario.result.resources.planetCoins.decimal,
        );
        expect(beyondExport.value.wisdom).toBe(
          variant.expectedResources && "wisdom" in variant.expectedResources
            ? variant.expectedResources.wisdom
            : scenario.result.resources.wisdom.decimal,
        );
        expect(beyondExport.value.maxWisdom).toBe(
          variant.expectedResources && "maxWisdom" in variant.expectedResources
            ? variant.expectedResources.maxWisdom
            : scenario.result.resources.maxWisdom.decimal,
        );
        if (variant.expectedResources?.gems) {
          expect(beyondExport.value.gems).toBe(variant.expectedResources.gems);
        }
        expect(beyondExport.encoded).toBe(sourceExport.encoded);
      } finally {
        await sourceContext.close().catch(() => undefined);
      }
    });
  }
}
