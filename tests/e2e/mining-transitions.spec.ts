import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { RemixMineObjectCatalog } from "../../packages/core/src/mine-objects.js";

type DecimalSnapshot = {
  decimal: string;
  mantissa: number | string;
  exponent: number | string;
};

type MiningResources = {
  money: string;
  highestMoney: string;
  gems: string;
  planetCoins: string;
  maxPlanetCoins: string;
  wisdom: string;
  maxWisdom: string;
};

type MiningHitCase = {
  name: string;
  highestDamageableMineObjectLevel: number;
  input: {
    action: "activeClick" | "idleTick";
    objectId: number;
    currentHp: string;
    highestMineObjectLevel: number;
    pickaxe: { power: string; quality: string };
    powers: string[];
    resources: MiningResources;
    upgrades: Record<string, Record<string, number>>;
    autoPickaxeTimer: number;
    saveTimer: number;
    elapsedMilliseconds: number;
    randomValues: number[];
  };
  effects: {
    gemChance: DecimalSnapshot;
    gemMultiplier: DecimalSnapshot;
    lastObjectGemMultiplier: DecimalSnapshot;
    powerWisdom: DecimalSnapshot;
    miningPowerGainMultiplier: DecimalSnapshot;
  };
  result: {
    hitOccurred: boolean;
    hitDamage: DecimalSnapshot;
    damagedObjectHp: DecimalSnapshot;
    currentObjectHp: DecimalSnapshot;
    currentObjectWasReplaced: boolean;
    resources: Record<string, DecimalSnapshot>;
    highestMineObjectLevel: number;
    miningPower: DecimalSnapshot;
    autoPickaxeTimer: number;
    saveTimer: number;
    randomCalls: number;
    frameEvents: ("save" | "refreshStoryNotifications")[];
  };
};

test("matches captured mining hit and reward transitions in Chromium", async ({
  page,
}) => {
  await page.goto("/__test__/mining-transitions");
  await expect(page.locator("#result")).toHaveAttribute("data-ready", "true");

  const corpus = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-reference-corpus.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as {
    data: {
      miningHitSemantics: {
        cases: MiningHitCase[];
      };
      mineObjectCatalog: RemixMineObjectCatalog;
    };
  };
  const observed = await page.evaluate(
    (input) => {
      const probe = (
        window as Window & {
          __idleMineMiningTransitionProbe?: (value: typeof input) => unknown;
        }
      ).__idleMineMiningTransitionProbe;
      if (!probe)
        throw new Error("Mining-transition browser probe is missing.");
      return probe(input);
    },
    {
      catalog: corpus.data.mineObjectCatalog,
      cases: corpus.data.miningHitSemantics.cases,
    },
  );

  expect(observed).toEqual(
    corpus.data.miningHitSemantics.cases.map((scenario) => ({
      name: scenario.name,
      highestDamageableMineObjectLevel:
        scenario.highestDamageableMineObjectLevel,
      result: {
        hitOccurred: scenario.result.hitOccurred,
        hitDamage: scenario.result.hitDamage,
        damagedObjectHp: scenario.result.damagedObjectHp,
        currentObjectHp: scenario.result.currentObjectHp,
        currentObjectWasReplaced: scenario.result.currentObjectWasReplaced,
        resources: scenario.result.resources,
        highestMineObjectLevel: scenario.result.highestMineObjectLevel,
        miningPower: scenario.result.miningPower,
        autoPickaxeTimer: scenario.result.autoPickaxeTimer,
        saveTimer: scenario.result.saveTimer,
        randomCalls: scenario.result.randomCalls,
        frameEvents: scenario.result.frameEvents,
      },
    })),
  );
});
