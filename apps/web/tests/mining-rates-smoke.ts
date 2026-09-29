import {
  Decimal,
  calculateRemixActiveDamage,
  calculateRemixIdleDamage,
  calculateRemixIdleDps,
  calculateRemixMiningFactors,
  calculateRemixMiningRates,
  getRemixMineObject,
  type RemixMiningFactors,
  type RemixMiningUpgradeLevels,
} from "@idle-mine-beyond/core";
import type { RemixMineObjectCatalog } from "../../../packages/core/src/mine-objects.js";

type DecimalSnapshot = { decimal: string };
type Scenario = {
  input: {
    objectId: number;
    pickaxe: { power: string; quality: string };
    miningPower: string;
    exquisityPower: string;
    upgrades: Record<string, Record<string, number>>;
  };
  effects: Record<string, DecimalSnapshot>;
  result: { highestDamageableObjectLevel: number };
};
type ProbeInput = {
  catalog: RemixMineObjectCatalog;
  scenarios: Scenario[];
  quirk: { currentObjectId: number; explicitTargetId: number };
};

function snapshot(value: {
  toString(): string;
  mantissa: number;
  exponent: number;
}) {
  const safe = (number: number) =>
    Number.isFinite(number) ? number : String(number);
  return {
    decimal: value.toString(),
    mantissa: safe(value.mantissa),
    exponent: safe(value.exponent),
  };
}

function makeInput(scenario: Scenario, catalog: RemixMineObjectCatalog) {
  return {
    object: getRemixMineObject(scenario.input.objectId, catalog),
    pickaxe: scenario.input.pickaxe,
    factors: Object.fromEntries(
      Object.entries(scenario.effects).map(([key, value]) => [
        key,
        value.decimal,
      ]),
    ) as RemixMiningFactors,
  };
}

function levelsForScenario(scenario: Scenario): RemixMiningUpgradeLevels {
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

const output = document.querySelector<HTMLPreElement>("#result");
if (!output) throw new Error("Mining-rate browser probe failed to initialize.");

const browserWindow = window as Window & {
  __idleMineRatesProbe?: (input: ProbeInput) => unknown;
};

browserWindow.__idleMineRatesProbe = ({ catalog, scenarios, quirk }) => {
  const scenarioResults = scenarios.map((scenario) => {
    const rates = calculateRemixMiningRates(makeInput(scenario, catalog));
    return Object.fromEntries(
      Object.entries(rates).map(([key, value]) => [key, snapshot(value)]),
    );
  });
  const factorResults = scenarios.map((scenario) => {
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
    return Object.fromEntries(
      Object.entries(factors).map(([key, value]) => [
        key,
        snapshot(new Decimal(value)),
      ]),
    );
  });

  const scenario = scenarios.find(
    ({ input }) => input.objectId === quirk.currentObjectId,
  );
  if (!scenario) throw new Error("Current-object probe scenario is missing.");
  const input = makeInput(scenario, catalog);
  const target = getRemixMineObject(quirk.explicitTargetId, catalog);

  return {
    scenarios: scenarioResults,
    factors: factorResults,
    currentObjectArgumentQuirk: {
      activeDamage: snapshot(calculateRemixActiveDamage(input, target)),
      idleDamageAtCurrentObject: snapshot(calculateRemixIdleDamage(input)),
      idleDpsWhenPassedTarget: snapshot(calculateRemixIdleDps(input)),
    },
  };
};

output.textContent = "Mining-rate probe ready";
output.dataset.ready = "true";
