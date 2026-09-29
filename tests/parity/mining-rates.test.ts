import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import {
  Decimal,
  calculateRemixActiveDamage,
  calculateRemixIdleDamage,
  calculateRemixIdleDps,
  calculateRemixMiningFactors,
  calculateRemixMiningRates,
  getRemixMineObject,
  type RemixMiningFactors,
} from "../../packages/core/src/index.js";
import type { RemixMineObjectCatalog } from "../../packages/core/src/mine-objects.js";

type DecimalSnapshot = {
  decimal: string;
  mantissa: number | string;
  exponent: number | string;
};

type FormulaResult = {
  pickaxeDamage: DecimalSnapshot;
  activeDamage: DecimalSnapshot;
  idleDamage: DecimalSnapshot;
  idleDps: DecimalSnapshot;
  moneyPerClick: DecimalSnapshot;
  moneyPerSecond: DecimalSnapshot;
  gemsPerSecond: DecimalSnapshot;
  planetCoinsPerSecond: DecimalSnapshot;
  highestDamageableObjectLevel: number;
};

type FormulaScenario = {
  input: {
    name: string;
    objectId: number;
    pickaxe: { power: string; quality: string };
    miningPower: string;
    exquisityPower: string;
    upgrades: Record<string, Record<string, number>>;
  };
  effects: Record<string, DecimalSnapshot>;
  result: FormulaResult & { highestDamageableObjectLevel: number };
};

const corpus = JSON.parse(
  await readFile(
    new URL("../fixtures/parity/remix-reference-corpus.json", import.meta.url),
    "utf8",
  ),
) as {
  metadata: { sourceCommit: string };
  data: {
    formulaSemantics: {
      scenarios: FormulaScenario[];
      currentObjectArgumentQuirk: {
        currentObjectId: number;
        explicitTargetId: number;
        activeDamage: DecimalSnapshot;
        idleDamageAtCurrentObject: DecimalSnapshot;
        idleDpsWhenPassedTarget: DecimalSnapshot;
      };
    };
    mineObjectCatalog: RemixMineObjectCatalog;
  };
};

const catalog = corpus.data.mineObjectCatalog;

function safeNumber(value: number): number | string {
  if (Number.isNaN(value)) return "NaN";
  if (value === Infinity) return "Infinity";
  if (value === -Infinity) return "-Infinity";
  if (Object.is(value, -0)) return "-0";
  return value;
}

function snapshotDecimal(value: Decimal): DecimalSnapshot {
  return {
    decimal: value.toString(),
    mantissa: safeNumber(value.mantissa),
    exponent: safeNumber(value.exponent),
  };
}

function hydrateFactors(
  effects: FormulaScenario["effects"],
): RemixMiningFactors {
  return Object.fromEntries(
    Object.entries(effects).map(([key, value]) => [key, value.decimal]),
  ) as RemixMiningFactors;
}

function levelsForScenario(scenario: FormulaScenario) {
  const levels = scenario.input.upgrades;
  const get = (family: string, upgrade: string) =>
    levels[family]?.[upgrade] ?? 0;
  return {
    money: {
      activePower: get("money", "activePower"),
      idlePower: get("money", "idlePower"),
      idleSpeed: get("money", "idleSpeed"),
      gemChance: get("money", "gemChance"),
    },
    gems: {
      idlePower: get("gems", "idlePower"),
      gemChance: get("gems", "gemChance"),
      gemMultiply: get("gems", "gemMultiply"),
    },
    planetCoins: {
      activePower: get("planetCoins", "activePower"),
      gemChance: get("planetCoins", "gemChance"),
      gemMultiply: get("planetCoins", "gemMultiply"),
      lastObjGems: get("planetCoins", "lastObjGems"),
    },
    wisdom: levels["wisdom"] ?? {},
  };
}

it("matches captured Remix damage and income formula scenarios", () => {
  expect(corpus.metadata.sourceCommit).toBe(
    "0e0f4bf5a9c66e5603cda2ce4bd54213023dae21",
  );

  for (const scenario of corpus.data.formulaSemantics.scenarios) {
    const object = getRemixMineObject(scenario.input.objectId, catalog);
    const rates = calculateRemixMiningRates({
      object,
      pickaxe: scenario.input.pickaxe,
      factors: hydrateFactors(scenario.effects),
    });

    expect({
      pickaxeDamage: snapshotDecimal(rates.pickaxeDamage),
      activeDamage: snapshotDecimal(rates.activeDamage),
      idleDamage: snapshotDecimal(rates.idleDamage),
      idleDps: snapshotDecimal(rates.idleDps),
      moneyPerClick: snapshotDecimal(rates.moneyPerClick),
      moneyPerSecond: snapshotDecimal(rates.moneyPerSecond),
      gemsPerSecond: snapshotDecimal(rates.gemsPerSecond),
      planetCoinsPerSecond: snapshotDecimal(rates.planetCoinsPerSecond),
    }).toEqual({
      pickaxeDamage: scenario.result.pickaxeDamage,
      activeDamage: scenario.result.activeDamage,
      idleDamage: scenario.result.idleDamage,
      idleDps: scenario.result.idleDps,
      moneyPerClick: scenario.result.moneyPerClick,
      moneyPerSecond: scenario.result.moneyPerSecond,
      gemsPerSecond: scenario.result.gemsPerSecond,
      planetCoinsPerSecond: scenario.result.planetCoinsPerSecond,
    });
  }
});

it("calculates captured mining upgrade effects from their levels", () => {
  for (const scenario of corpus.data.formulaSemantics.scenarios) {
    const factors = calculateRemixMiningFactors({
      levels: levelsForScenario(scenario),
      powers: {
        mining: scenario.input.miningPower,
        exquisity: scenario.input.exquisityPower,
      },
      highestMineObjectLevel: scenario.input.objectId,
      currentObjectIsHighestDamageable:
        scenario.input.objectId ===
        scenario.result.highestDamageableObjectLevel,
    });

    expect(
      Object.fromEntries(
        Object.entries(factors).map(([key, value]) => [
          key,
          snapshotDecimal(new Decimal(value)),
        ]),
      ),
    ).toEqual(scenario.effects);
  }
});

it("preserves the current-object lookup in Remix active damage helpers", () => {
  const quirk = corpus.data.formulaSemantics.currentObjectArgumentQuirk;
  const scenario = corpus.data.formulaSemantics.scenarios.find(
    ({ input }) => input.objectId === quirk.currentObjectId,
  )!;
  const currentObject = getRemixMineObject(quirk.currentObjectId, catalog);
  const targetObject = getRemixMineObject(quirk.explicitTargetId, catalog);
  const input = {
    object: currentObject,
    pickaxe: scenario.input.pickaxe,
    factors: hydrateFactors(scenario.effects),
  };

  expect(
    snapshotDecimal(calculateRemixActiveDamage(input, targetObject)),
  ).toEqual(quirk.activeDamage);
  expect(snapshotDecimal(calculateRemixIdleDamage(input))).toEqual(
    quirk.idleDamageAtCurrentObject,
  );
  expect(snapshotDecimal(calculateRemixIdleDps(input))).toEqual(
    quirk.idleDpsWhenPassedTarget,
  );
});
