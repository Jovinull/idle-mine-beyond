import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { Decimal } from "../../packages/core/src/decimal.js";
import { encodeRemixLegacySave } from "../../packages/persistence/src/index.js";
import { createBeyondVisualSaveFromRemixSave } from "./visual-state.js";

type DecimalSnapshot = { readonly decimal: string };

type DropScenario = {
  readonly name: string;
  readonly input: {
    readonly objectId: number;
    readonly pickaxe: { readonly power: string; readonly quality: string };
    readonly powers: readonly [string, string, string, string, string];
    readonly resources: {
      readonly money: string;
      readonly highestMoney: string;
      readonly gems: string;
      readonly planetCoins: string;
      readonly maxPlanetCoins: string;
      readonly wisdom: string;
      readonly maxWisdom: string;
    };
    readonly randomValues: readonly number[];
  };
  readonly result: {
    readonly hitDamage: DecimalSnapshot;
    readonly currentObjectWasReplaced: boolean;
    readonly highestMineObjectLevel: number;
    readonly randomCalls: number;
    readonly resources: {
      readonly money: DecimalSnapshot;
      readonly highestMoney: DecimalSnapshot;
      readonly gems: DecimalSnapshot;
      readonly planetCoins: DecimalSnapshot;
      readonly maxPlanetCoins: DecimalSnapshot;
      readonly wisdom: DecimalSnapshot;
      readonly maxWisdom: DecimalSnapshot;
    };
  };
};

type DropCorpus = {
  readonly metadata: { readonly sourceCommit: string };
  readonly data: {
    readonly saveApplicationSemantics: { readonly inputJson: string };
    readonly objects: readonly {
      readonly id: number;
      readonly name: string;
      readonly totalHp: DecimalSnapshot;
    }[];
    readonly miningHitSemantics: { readonly cases: readonly DropScenario[] };
  };
};

type RemixDropSave = {
  mineObjectLevel: number;
  highestMineObjectLevel: number;
  money: string;
  highestMoney: string;
  gems: string;
  planetCoins: string;
  maxPlanetCoins: string;
  wisdom: string;
  maxWisdom: string;
  lastActive: number;
  settings: {
    theme: string;
    tab: string;
    showMineObjLevel: boolean;
  };
  powers: { data: { values: string[] } };
  pickaxe: { pow: string; quality: string };
};

const sourceCommit = "0e0f4bf5a9c66e5603cda2ce4bd54213023dae21";
const fixedClock = 1_704_067_200_000;
const corpusUrl = new URL(
  "../fixtures/parity/remix-reference-corpus.json",
  import.meta.url,
);

const scenarios = [
  {
    fixtureName: "planet-coin-drop-roll-follows-gem-roll",
    resource: "planetCoins",
    visualId: "planet-coins",
    balanceSelector: "header > span.inline-resource",
    expectedDrop: "Planet Coins",
  },
  {
    fixtureName: "wisdom-drop-scales-with-power-wisdom",
    resource: "wisdom",
    visualId: "wisdom",
    balanceSelector: "[data-wisdom-balance]",
    expectedDrop: "Wisdom",
  },
] as const;

for (const scenario of scenarios) {
  for (const theme of ["light", "dark"] as const) {
    test(`awards and renders the pinned ${scenario.expectedDrop} drop in ${theme} theme`, async ({
      page,
    }) => {
      const corpusText = await readFile(corpusUrl, "utf8");
      const corpus = JSON.parse(corpusText) as DropCorpus;
      expect(corpus.metadata.sourceCommit).toBe(sourceCommit);

      const sourceCase = corpus.data.miningHitSemantics.cases.find(
        ({ name }) => name === scenario.fixtureName,
      );
      const sourceObject = corpus.data.objects.find(
        ({ id }) => id === sourceCase?.input.objectId,
      );
      if (!sourceCase || !sourceObject) {
        throw new Error(
          `Pinned drop fixture ${scenario.fixtureName} is missing.`,
        );
      }
      expect(sourceCase.result.currentObjectWasReplaced).toBe(true);
      expect(sourceCase.result.randomCalls).toBe(
        sourceCase.input.randomValues.length,
      );
      expect(
        new Decimal(sourceCase.result.hitDamage.decimal).gte(
          sourceObject.totalHp.decimal,
        ),
      ).toBe(true);

      const sourceSave = JSON.parse(
        corpus.data.saveApplicationSemantics.inputJson,
      ) as RemixDropSave;
      sourceSave.mineObjectLevel = sourceCase.input.objectId;
      sourceSave.highestMineObjectLevel = sourceCase.input.objectId;
      sourceSave.money = sourceCase.input.resources.money;
      sourceSave.highestMoney = sourceCase.input.resources.highestMoney;
      sourceSave.gems = sourceCase.input.resources.gems;
      sourceSave.planetCoins = sourceCase.input.resources.planetCoins;
      sourceSave.maxPlanetCoins = sourceCase.input.resources.maxPlanetCoins;
      sourceSave.wisdom = sourceCase.input.resources.wisdom;
      sourceSave.maxWisdom = sourceCase.input.resources.maxWisdom;
      sourceSave.powers.data.values = [...sourceCase.input.powers];
      sourceSave.pickaxe.pow = sourceCase.input.pickaxe.power;
      sourceSave.pickaxe.quality = sourceCase.input.pickaxe.quality;
      sourceSave.lastActive = fixedClock;
      sourceSave.settings.theme = theme;
      sourceSave.settings.tab = "main";
      sourceSave.settings.showMineObjLevel = true;
      const serializedSave = await createBeyondVisualSaveFromRemixSave({
        clockMs: fixedClock,
        theme,
        tab: "main",
        saveString: encodeRemixLegacySave(sourceSave),
      });

      await page.setViewportSize({ width: 1440, height: 900 });
      await page.addInitScript(
        ({ now, serializedSave, randomValues }) => {
          localStorage.clear();
          localStorage.setItem("IdleMineBeyond", serializedSave);
          Object.defineProperty(Date, "now", {
            configurable: true,
            value: () => now,
          });

          let draws = 0;
          Object.defineProperty(window, "__idleMineDropDrawCount", {
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
        },
        {
          now: fixedClock,
          serializedSave,
          randomValues: sourceCase.input.randomValues,
        },
      );
      await page.goto("/");
      await expect(page.locator("#app")).toHaveAttribute(
        "data-app-state",
        "ready",
      );
      await expect(page.locator("canvas.mine-object")).toHaveAttribute(
        "data-rendered",
        "true",
      );
      await expect(page.locator("canvas.mine-object")).toHaveAttribute(
        "data-damageable",
        "true",
      );
      await expect(page.locator(".mineobject h2")).toHaveText(
        sourceObject.name,
      );
      await expect(page.locator(".mine-drop img.inline")).toHaveAttribute(
        "alt",
        scenario.expectedDrop,
      );
      expect(
        await page.evaluate(() =>
          (
            window as typeof window & {
              __idleMineDropDrawCount: () => number;
            }
          ).__idleMineDropDrawCount(),
        ),
      ).toBe(0);

      await page.locator("canvas.mine-object[data-damageable='true']").click();

      await expect(page.locator("[data-mine-object-level]")).toHaveText(
        `#${sourceCase.input.objectId + 1}`,
      );
      await expect(
        page.locator("header .inline-resource").first(),
      ).toContainText(sourceCase.result.resources.gems.decimal);
      const balance = page.locator(scenario.balanceSelector);
      if (scenario.resource === "planetCoins") {
        await expect(balance).toHaveCount(2);
        await expect(balance.nth(1).locator("img")).toHaveAttribute(
          "alt",
          scenario.expectedDrop,
        );
        await expect(balance.nth(1)).toContainText(
          sourceCase.result.resources.planetCoins.decimal,
        );
      } else {
        await page.locator("[data-game-tab='powers']").click();
        await expect(balance).toContainText(
          sourceCase.result.resources.wisdom.decimal,
        );
      }

      expect(
        await page.evaluate(() =>
          (
            window as typeof window & {
              __idleMineDropDrawCount: () => number;
            }
          ).__idleMineDropDrawCount(),
        ),
      ).toBe(sourceCase.result.randomCalls);

      await page.evaluate(() => document.fonts.ready);
      await page.addStyleTag({
        content:
          'img[src$="wisdom.png"] { animation: none !important; transform: none !important; }',
      });
      await page.mouse.move(1439, 899);
      await page.evaluate(() => {
        for (const animation of document.getAnimations()) {
          animation.pause();
          animation.currentTime = 0;
        }
      });
      // Windows and Linux each have a pinned source screenshot (`-linux` on Linux).
      if (process.platform === "win32" || process.platform === "linux") {
        await expect(page).toHaveScreenshot(
          `remix-mine-drop-${scenario.visualId}-${theme}-1440x900.png`,
          { maxDiffPixels: 0 },
        );
      }
    });
  }
}
