import {
  Decimal,
  REMIX_UPGRADE_KEYS,
  calculateRemixPickaxeCraft,
  generateRemixMineObject,
  type RemixMineObjectCatalog,
  type RemixUpgradeContext,
  type RemixUpgradeLevels,
} from "@idle-mine-beyond/core";

type CraftInput = {
  gems: string;
  highestMineObjectLevel: number;
  powers: string[];
  upgradeLevels: Record<string, Record<string, number>>;
  randomValues: number[];
};

type BoundaryCase = {
  name: string;
  input: CraftInput;
  randomCalls: number;
  result: {
    name: string;
    power: {
      decimal: string;
      mantissa: number | string;
      exponent: number | string;
    };
    quality: {
      decimal: string;
      mantissa: number | string;
      exponent: number | string;
    };
    damage: {
      decimal: string;
      mantissa: number | string;
      exponent: number | string;
    };
  };
};

type ProbeInput = {
  catalog: RemixMineObjectCatalog;
  cases: BoundaryCase[];
};

function safeNumber(value: number): number | string {
  if (Number.isNaN(value)) return "NaN";
  if (value === Infinity) return "Infinity";
  if (value === -Infinity) return "-Infinity";
  if (Object.is(value, -0)) return "-0";
  return value;
}

function snapshot(value: Decimal) {
  return {
    decimal: value.toString(),
    mantissa: safeNumber(value.mantissa),
    exponent: safeNumber(value.exponent),
  };
}

function createContext(input: CraftInput): RemixUpgradeContext {
  const levels = Object.fromEntries(
    Object.entries(REMIX_UPGRADE_KEYS).map(([group, keys]) => [
      group,
      Object.fromEntries(keys.map((key) => [key, 0])),
    ]),
  ) as unknown as RemixUpgradeLevels;
  for (const [group, groupLevels] of Object.entries(input.upgradeLevels)) {
    Object.assign(levels[group as keyof RemixUpgradeLevels], groupLevels);
  }
  return {
    levels,
    powers: {
      craftsmanship: input.powers[1]!,
      expertise: input.powers[2]!,
      exquisity: input.powers[4]!,
    },
    highestMineObjectLevel: input.highestMineObjectLevel,
  };
}

function run(input: ProbeInput) {
  return input.cases.map((scenario) => {
    let randomCalls = 0;
    const pickaxe = calculateRemixPickaxeCraft({
      gems: scenario.input.gems,
      context: createContext(scenario.input),
      mode: {
        kind: "random",
        random: {
          nextDouble() {
            const value = scenario.input.randomValues[randomCalls];
            if (value === undefined) {
              throw new Error(
                scenario.name + " exhausted its pickaxe RNG fixture.",
              );
            }
            randomCalls++;
            return value;
          },
        },
        mineObjectName(level) {
          const base = input.catalog.base[level];
          return base
            ? base.name
            : generateRemixMineObject(level, input.catalog).name;
        },
      },
    });

    return {
      name: scenario.name,
      randomCalls,
      result: {
        name: pickaxe.name,
        power: snapshot(pickaxe.power),
        quality: snapshot(pickaxe.quality),
        damage: snapshot(pickaxe.damage),
      },
    };
  });
}

const result = document.querySelector<HTMLPreElement>("#result");
if (!result)
  throw new Error("Pickaxe quality browser probe failed to initialize.");

(
  window as Window & {
    __idleMinePickaxeQualityProbe?: (input: ProbeInput) => unknown;
  }
).__idleMinePickaxeQualityProbe = run;
result.dataset.ready = "true";
result.textContent = "ready";
