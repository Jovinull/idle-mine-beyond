import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import {
  Decimal,
  REMIX_UPGRADE_KEYS,
  generateRemixMineObject,
  type RemixMineObjectCatalog,
  type RemixUpgradeContext,
  type RemixUpgradeLevels,
} from "../../packages/core/src/index.js";
import {
  attemptRemixPickaxeCraft,
  calculateRemixPickaxeCraft,
} from "../../packages/core/src/remix-pickaxe-crafting.js";
import {
  createInitialFormatters,
  formatRemixPickaxeCraftFeedback,
} from "../../packages/formatting/src/index.js";

type DecimalSnapshot = {
  decimal: string;
  mantissa: number | string;
  exponent: number | string;
};

type PickaxeSnapshot = {
  name: string;
  power: DecimalSnapshot;
  quality: DecimalSnapshot;
  damage: DecimalSnapshot;
};

type CraftInput = {
  gems: string;
  highestMineObjectLevel: number;
  powers: string[];
  upgradeLevels: Record<string, Record<string, number>>;
  randomValues?: number[];
};

type CraftCase = {
  name: string;
  input: CraftInput;
  randomCalls: number;
  result: PickaxeSnapshot;
};

type CraftAttemptInput = CraftInput & {
  craftGems: DecimalSnapshot;
  usedGemsLevel: number;
  equippedPickaxe: { name: string; power: string; quality: string };
  shiftHeld: boolean;
  randomValues: number[];
};

type CraftAttemptCase = {
  name: string;
  input: CraftAttemptInput;
  randomCalls: number;
  saveCalls: number;
  saveSnapshots: {
    gems: DecimalSnapshot;
    pickaxe: { name: string; power: DecimalSnapshot; quality: DecimalSnapshot };
  }[];
  eventOrder: string[];
  messageLog: { message: string; color: string }[];
  result: {
    gems: DecimalSnapshot;
    pickaxe: PickaxeSnapshot;
  };
};

type PickaxeCraftingFixture = {
  sourcePaths: string[];
  randomSource: string;
  crafts: CraftCase[];
  deterministic: {
    input: CraftInput;
    randomCalls: number;
    minimum: PickaxeSnapshot;
    average: PickaxeSnapshot;
  };
  attempts: CraftAttemptCase[];
};

const corpus = JSON.parse(
  await readFile(
    new URL("../fixtures/parity/remix-reference-corpus.json", import.meta.url),
    "utf8",
  ),
) as {
  metadata: { sourceCommit: string };
  data: {
    mineObjectCatalog: RemixMineObjectCatalog;
    pickaxeCraftingSemantics: PickaxeCraftingFixture;
  };
};
const fixture = corpus.data.pickaxeCraftingSemantics;

function snapshot(value: Decimal): DecimalSnapshot {
  const safeNumber = (number: number): number | string => {
    if (Number.isNaN(number)) return "NaN";
    if (number === Infinity) return "Infinity";
    if (number === -Infinity) return "-Infinity";
    if (Object.is(number, -0)) return "-0";
    return number;
  };
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

function snapshotPickaxe(pickaxe: {
  name: string;
  power: Decimal;
  quality: Decimal;
  damage: Decimal;
}): PickaxeSnapshot {
  return {
    name: pickaxe.name,
    power: snapshot(pickaxe.power),
    quality: snapshot(pickaxe.quality),
    damage: snapshot(pickaxe.damage),
  };
}

it("matches source-controlled stochastic pickaxe crafts and RNG draw counts", () => {
  expect(corpus.metadata.sourceCommit).toBe(
    "0e0f4bf5a9c66e5603cda2ce4bd54213023dae21",
  );
  expect(fixture.sourcePaths).toContain("Scripts/pickaxe.js");
  expect(fixture.randomSource).toBe("Math.random");

  for (const scenario of fixture.crafts) {
    let randomCalls = 0;
    const random = {
      nextDouble(): number {
        const value = scenario.input.randomValues?.[randomCalls];
        if (value === undefined) {
          throw new Error(
            `${scenario.name} consumed an uncaptured pickaxe RNG draw.`,
          );
        }
        randomCalls++;
        return value;
      },
    };
    const pickaxe = calculateRemixPickaxeCraft({
      gems: scenario.input.gems,
      context: createContext(scenario.input),
      mode: {
        kind: "random",
        random,
        mineObjectName: (level) => {
          const base = corpus.data.mineObjectCatalog.base[level];
          return base
            ? base.name
            : generateRemixMineObject(level, corpus.data.mineObjectCatalog)
                .name;
        },
      },
    });

    expect(randomCalls, scenario.name).toBe(scenario.randomCalls);
    expect(snapshotPickaxe(pickaxe), scenario.name).toEqual(scenario.result);
  }
});

it("matches deterministic minimum and average craft display modes without RNG", () => {
  const { deterministic } = fixture;
  const input = {
    gems: deterministic.input.gems,
    context: createContext(deterministic.input),
  };
  const minimum = calculateRemixPickaxeCraft({
    ...input,
    mode: { kind: "minimum" },
  });
  const average = calculateRemixPickaxeCraft({
    ...input,
    mode: { kind: "average" },
  });

  expect(deterministic.randomCalls).toBe(0);
  expect(snapshotPickaxe(minimum)).toEqual(deterministic.minimum);
  expect(snapshotPickaxe(average)).toEqual(deterministic.average);
});

it("matches source Gem spending, replacement, duds, bulk attempts, and feedback", () => {
  const formatter = createInitialFormatters()[0]!;

  for (const scenario of fixture.attempts) {
    let randomCalls = 0;
    const random = {
      nextDouble(): number {
        const value = scenario.input.randomValues[randomCalls];
        if (value === undefined) {
          throw new Error(
            `${scenario.name} consumed an uncaptured pickaxe RNG draw.`,
          );
        }
        randomCalls++;
        return value;
      },
    };
    const context = createContext(scenario.input);
    const result = attemptRemixPickaxeCraft({
      state: {
        gems: scenario.input.gems,
        pickaxe: scenario.input.equippedPickaxe,
      },
      craftGems: scenario.input.craftGems.decimal,
      shiftHeld: scenario.input.shiftHeld,
      context,
      random,
      mineObjectName: (level) => {
        const base = corpus.data.mineObjectCatalog.base[level];
        return base
          ? base.name
          : generateRemixMineObject(level, corpus.data.mineObjectCatalog).name;
      },
    });

    const feedback = result.events.flatMap((event) => {
      const formatted = formatRemixPickaxeCraftFeedback(event, formatter);
      return formatted ? [formatted] : [];
    });
    const eventOrder = result.events.map((event) => {
      if (event.type === "save") return "save";
      const formatted = formatRemixPickaxeCraftFeedback(event, formatter);
      if (!formatted)
        throw new Error("Craft event unexpectedly had no feedback.");
      return `log:${formatted.message}`;
    });
    const messageLog = [...feedback].reverse();
    const pickaxe = {
      name: result.state.pickaxe.name,
      power: new Decimal(result.state.pickaxe.power),
      quality: new Decimal(result.state.pickaxe.quality),
      damage: new Decimal(result.state.pickaxe.power).mul(
        result.state.pickaxe.quality,
      ),
    };

    expect(randomCalls, scenario.name).toBe(scenario.randomCalls);
    expect(
      result.events.filter((event) => event.type === "save"),
      scenario.name,
    ).toHaveLength(scenario.saveCalls);
    expect(
      result.saveSnapshots.map(({ gems, pickaxe: savedPickaxe }) => ({
        gems: snapshot(gems),
        pickaxe: {
          name: savedPickaxe.name,
          power: snapshot(new Decimal(savedPickaxe.power)),
          quality: snapshot(new Decimal(savedPickaxe.quality)),
        },
      })),
      scenario.name,
    ).toEqual(scenario.saveSnapshots);
    expect(eventOrder, scenario.name).toEqual(scenario.eventOrder);
    expect(messageLog, scenario.name).toEqual(scenario.messageLog);
    expect(
      {
        gems: snapshot(result.state.gems),
        pickaxe: snapshotPickaxe(pickaxe),
      },
      scenario.name,
    ).toEqual(scenario.result);
  }
});
