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

type PickaxeQualityNameBoundaryCase = {
  name: string;
  boundary: {
    axis: string;
    position: string;
    index?: number;
    qualityRegion?: number;
    transition?: number;
  };
  targetQuality: number;
  qualityTierRoll: number;
  expectedTier: number;
  expectedQualityName: string;
  input: CraftInput;
  randomCalls: number;
  result: PickaxeSnapshot;
};

type DistributionMetrics = {
  min: number;
  p10: number;
  p50: number;
  p90: number;
  max: number;
  mean: number;
};

type DistributionSeedResult = {
  seed: number;
  sampleCount: number;
  randomCalls: number;
  randomDrawCounts: Record<string, number>;
  qualityStreakCounts: number[];
  nameForms: { word: number; object: number };
  values: Record<"power" | "quality" | "damage", DistributionMetrics>;
};

type DistributionScenario = {
  name: string;
  input: CraftInput;
  seedResults: DistributionSeedResult[];
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
  distributions: {
    sourcePaths: string[];
    rng: string;
    sampleCountPerSeed: number;
    seedResults: number[];
    scenarios: DistributionScenario[];
  };
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
    pickaxeQualityNameBoundaries: {
      sourcePaths: string[];
      qualityNames: string[];
      cases: PickaxeQualityNameBoundaryCase[];
    };
  };
};
const fixture = corpus.data.pickaxeCraftingSemantics;
const qualityNameBoundaryFixture = corpus.data.pickaxeQualityNameBoundaries;

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

it("matches source-captured pickaxe quality-name formula boundaries", () => {
  const cases = qualityNameBoundaryFixture.cases;
  const casesByName = new Map(
    cases.map((scenario) => [scenario.name, scenario]),
  );
  const observedTiers = new Set<number>();

  expect(qualityNameBoundaryFixture.sourcePaths).toContain(
    "Scripts/pickaxe.js:Pickaxe.generateName",
  );
  expect(cases).toHaveLength(119);
  expect(casesByName.has("quality-name-lower-limit")).toBe(true);
  expect(casesByName.has("quality-name-upper-cap")).toBe(true);

  for (let index = 1; index <= 13; index++) {
    for (const position of ["below", "at", "above"]) {
      expect(
        casesByName.has("quality-name-quality-" + index + "-" + position),
      ).toBe(true);
    }
  }
  for (let index = 0; index <= 12; index++) {
    for (let transition = 0; transition <= 1; transition++) {
      for (const position of ["below", "at", "above"]) {
        expect(
          casesByName.has(
            "quality-name-rng-" + index + "-" + transition + "-" + position,
          ),
        ).toBe(true);
      }
    }
  }

  for (const scenario of cases) {
    // Math.log can land on opposite sides of an exact integer in Node and
    // Chromium. The canonical exact-threshold comparison runs in the browser
    // harness; this unit test checks the source-captured values on both sides.
    if (scenario.boundary.position === "at") continue;

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
    expect(pickaxe.name.split(" ")[0], scenario.name).toBe(
      scenario.expectedQualityName,
    );
    expect(qualityNameBoundaryFixture.qualityNames[scenario.expectedTier]).toBe(
      scenario.expectedQualityName,
    );
    observedTiers.add(scenario.expectedTier);
  }

  expect([...observedTiers].sort((left, right) => left - right)).toEqual(
    Array.from({ length: 14 }, (_, index) => index),
  );
});

it("matches seeded pickaxe craft distributions and legacy RNG consumption", () => {
  const { distributions } = fixture;
  expect(distributions.sourcePaths).toContain("Scripts/pickaxe.js");
  expect(distributions.rng).toBe(
    "32-bit LCG (1664525, 1013904223, modulo 2^32)",
  );
  expect(distributions.seedResults).toHaveLength(3);
  expect(distributions.sampleCountPerSeed).toBe(512);

  for (const scenario of distributions.scenarios) {
    for (const expected of scenario.seedResults) {
      let randomState = expected.seed >>> 0;
      let randomCalls = 0;
      let sampleRandomValues: number[] = [];
      const random = {
        nextDouble(): number {
          randomState =
            (Math.imul(randomState, 1_664_525) + 1_013_904_223) >>> 0;
          randomCalls++;
          const value = randomState / 0x1_0000_0000;
          sampleRandomValues.push(value);
          return value;
        },
      };
      const randomDrawCounts: Record<string, number> = {};
      const qualityStreakCounts = Array(16).fill(0) as number[];
      const nameForms = { word: 0, object: 0 };
      const values: Record<"power" | "quality" | "damage", number[]> = {
        power: [],
        quality: [],
        damage: [],
      };
      const context = createContext(scenario.input);

      for (let sample = 0; sample < expected.sampleCount; sample++) {
        const drawsBefore = randomCalls;
        sampleRandomValues = [];
        const pickaxe = calculateRemixPickaxeCraft({
          gems: scenario.input.gems,
          context,
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
        const consumed = randomCalls - drawsBefore;
        const isWord = pickaxe.name.includes('"');
        const bonusLevel =
          scenario.input.upgradeLevels["money"]?.["blacksmithBonus"] ?? 0;
        // Remix rolls the expertise upgrade after the quality bonus, even at
        // level zero, then rolls Power and base Quality before the streak.
        const bonusRollCount =
          bonusLevel > 0 && sampleRandomValues[1]! < 0.25 ? 1 : 0;
        const firstQualityRoll = 4 + bonusRollCount;
        let qualityStreak = 0;
        for (
          let roll = 0;
          roll < 15 && sampleRandomValues[firstQualityRoll + roll]! < 0.5;
          roll++
        ) {
          qualityStreak++;
        }
        randomDrawCounts[consumed] = (randomDrawCounts[consumed] ?? 0) + 1;
        qualityStreakCounts[qualityStreak] =
          (qualityStreakCounts[qualityStreak] ?? 0) + 1;
        nameForms[isWord ? "word" : "object"]++;
        values.power.push(pickaxe.power.toNumber());
        values.quality.push(pickaxe.quality.toNumber());
        values.damage.push(pickaxe.damage.toNumber());
      }

      const roundSummary = (value: number) => Number(value.toPrecision(10));
      const summarize = (samples: number[]): DistributionMetrics => {
        const sorted = [...samples].sort((left, right) => left - right);
        const quantile = (probability: number) =>
          roundSummary(sorted[Math.floor((sorted.length - 1) * probability)]!);
        return {
          min: quantile(0),
          p10: quantile(0.1),
          p50: quantile(0.5),
          p90: quantile(0.9),
          max: quantile(1),
          mean: roundSummary(
            samples.reduce((sum, value) => sum + value, 0) / samples.length,
          ),
        };
      };
      const actual: DistributionSeedResult = {
        seed: expected.seed,
        sampleCount: expected.sampleCount,
        randomCalls,
        randomDrawCounts,
        qualityStreakCounts,
        nameForms,
        values: {
          power: summarize(values.power),
          quality: summarize(values.quality),
          damage: summarize(values.damage),
        },
      };
      expect(actual, `${scenario.name}, seed ${expected.seed}`).toEqual(
        expected,
      );
    }

    const totalSamples = scenario.seedResults.reduce(
      (sum, result) => sum + result.sampleCount,
      0,
    );
    const streakCounts = Array(16).fill(0) as number[];
    let wordNames = 0;
    for (const result of scenario.seedResults) {
      result.qualityStreakCounts.forEach((count, index) => {
        streakCounts[index] = (streakCounts[index] ?? 0) + count;
      });
      wordNames += result.nameForms.word;
    }
    for (let streak = 0; streak < streakCounts.length; streak++) {
      const probability = 0.5 ** (streak === 15 ? 15 : streak + 1);
      const expectedCount = totalSamples * probability;
      const tolerance = Math.max(
        5 * Math.sqrt(expectedCount * (1 - probability)),
        2,
      );
      expect(
        Math.abs(streakCounts[streak]! - expectedCount),
        `${scenario.name}, quality streak ${streak}`,
      ).toBeLessThanOrEqual(tolerance);
    }
    const expectedWordNames = totalSamples * 0.3;
    const wordNameTolerance = Math.max(
      5 * Math.sqrt(totalSamples * 0.3 * 0.7),
      2,
    );
    expect(
      Math.abs(wordNames - expectedWordNames),
      `${scenario.name} names`,
    ).toBeLessThanOrEqual(wordNameTolerance);
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
