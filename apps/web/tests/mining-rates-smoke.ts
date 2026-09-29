import {
  calculateRemixActiveDamage,
  calculateRemixIdleDamage,
  calculateRemixIdleDps,
  calculateRemixMiningRates,
  getRemixMineObject,
  type RemixMiningFactors,
} from "@idle-mine-beyond/core";
import type { RemixMineObjectCatalog } from "../../../packages/core/src/mine-objects.js";

type DecimalSnapshot = { decimal: string };
type Scenario = {
  input: {
    objectId: number;
    pickaxe: { power: string; quality: string };
  };
  effects: Record<string, DecimalSnapshot>;
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

  const scenario = scenarios.find(
    ({ input }) => input.objectId === quirk.currentObjectId,
  );
  if (!scenario) throw new Error("Current-object probe scenario is missing.");
  const input = makeInput(scenario, catalog);
  const target = getRemixMineObject(quirk.explicitTargetId, catalog);

  return {
    scenarios: scenarioResults,
    currentObjectArgumentQuirk: {
      activeDamage: snapshot(calculateRemixActiveDamage(input, target)),
      idleDamageAtCurrentObject: snapshot(calculateRemixIdleDamage(input)),
      idleDpsWhenPassedTarget: snapshot(calculateRemixIdleDps(input)),
    },
  };
};

output.textContent = "Mining-rate probe ready";
output.dataset.ready = "true";
