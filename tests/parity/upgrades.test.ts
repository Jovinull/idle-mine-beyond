import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import {
  Decimal,
  REMIX_UPGRADE_KEYS,
  calculateRemixUpgradeEffect,
  calculateRemixUpgradePrice,
  executeRemixUpgradePurchase,
  getRemixUpgradeMaxLevel,
  type RemixUpgradeContext,
  type RemixUpgradeGroup,
  type RemixUpgradeKey,
  type RemixUpgradeLevels,
  type RemixUpgradePurchaseOperation,
  type RemixUpgradePurchaseState,
  type RemixUpgradeResources,
} from "../../packages/core/src/index.js";

type DecimalSnapshot = {
  decimal: string;
  mantissa: number | string;
  exponent: number | string;
};

type UpgradeSample = {
  level: number;
  price: DecimalSnapshot;
  effect: DecimalSnapshot | null;
};

type CapturedUpgrade = {
  name: string;
  resource: number;
  maxLevel: number | "Infinity";
  stochasticEffect: boolean;
  samples: UpgradeSample[];
};

type CapturedInteraction = {
  name: string;
  highestMineObjectLevel: number;
  controlledLevels: Record<string, Record<string, number>>;
  otherUpgradeLevels: number;
  controlledPowers: Record<string, string>;
  otherPowers: string;
  effects: Array<{
    group: string;
    key: string;
    level: number;
    effect: DecimalSnapshot;
  }>;
};

type StochasticSample = {
  name: string;
  level: number;
  controlledRandomValues: number[];
  randomCalls: number;
  effect: DecimalSnapshot;
};

type CapturedPurchase = {
  name: string;
  group: string;
  key: string;
  resourceId: number;
  startingLevel: number;
  startingResources: Record<string, DecimalSnapshot>;
  currentPrice: DecimalSnapshot;
  maxLevel: number | "Infinity";
  operation: RemixUpgradePurchaseOperation;
  operationResult: boolean | null;
  endingLevel: number;
  purchases: number;
  endingResources: Record<string, DecimalSnapshot>;
};

type UpgradeSemanticsFixture = {
  controlledState: {
    highestMineObjectLevel: number;
    powerValues: string[];
  };
  groups: Record<string, Record<string, CapturedUpgrade>>;
  stochasticEffects: {
    blacksmithBonus: { samples: StochasticSample[] };
  };
  effectInteractions: CapturedInteraction[];
  purchaseSemantics: CapturedPurchase[];
};

const corpus = JSON.parse(
  await readFile(
    new URL("../fixtures/parity/remix-reference-corpus.json", import.meta.url),
    "utf8",
  ),
) as {
  metadata: { sourceCommit: string };
  data: { upgradeSemantics: UpgradeSemanticsFixture };
};

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

function snapshotResources(
  resources: RemixUpgradeResources,
): Record<string, DecimalSnapshot> {
  return Object.fromEntries(
    Object.entries(resources).map(([key, value]) => [
      key,
      snapshotDecimal(new Decimal(value)),
    ]),
  );
}

function expectReferenceEffect(
  actual: DecimalSnapshot,
  expected: DecimalSnapshot,
  label: string,
): void {
  if (label === "gems.idlePower@99") {
    // Node and Chromium's Math.pow differ by one ulp at this captured input.
    expect(actual.exponent, label).toBe(expected.exponent);
    expect(Number(actual.mantissa), label).toBeCloseTo(
      Number(expected.mantissa),
      14,
    );
    expect(Number(actual.decimal), label).toBeCloseTo(
      Number(expected.decimal),
      12,
    );
    return;
  }
  expect(actual, label).toEqual(expected);
}

function emptyLevels(): RemixUpgradeLevels {
  return Object.fromEntries(
    Object.entries(REMIX_UPGRADE_KEYS).map(([group, keys]) => [
      group,
      Object.fromEntries(keys.map((key) => [key, 0])),
    ]),
  ) as RemixUpgradeLevels;
}

function levelsWith(
  controlledLevels: Record<string, Record<string, number>>,
): RemixUpgradeLevels {
  const levels = emptyLevels();
  const mutableLevels = levels as unknown as Record<
    string,
    Record<string, number>
  >;
  for (const [group, overrides] of Object.entries(controlledLevels)) {
    Object.assign(mutableLevels[group]!, overrides);
  }
  return levels;
}

function upgradeLevel<Group extends RemixUpgradeGroup>(
  levels: RemixUpgradeLevels,
  group: Group,
  key: RemixUpgradeKey<Group>,
): number {
  return levels[group][key];
}

function upgradeContext(input: {
  levels: RemixUpgradeLevels;
  highestMineObjectLevel: number;
  controlledPowers?: Record<string, string>;
  random?: RemixUpgradeContext["random"];
}): RemixUpgradeContext {
  const powerValues = corpus.data.upgradeSemantics.controlledState.powerValues;
  const controlledPowers = input.controlledPowers ?? {};
  return {
    levels: input.levels,
    powers: {
      craftsmanship: controlledPowers["craftsmanship"] ?? powerValues[1]!,
      expertise: controlledPowers["expertise"] ?? powerValues[2]!,
      exquisity: controlledPowers["exquisity"] ?? powerValues[4]!,
    },
    highestMineObjectLevel: input.highestMineObjectLevel,
    ...(input.random ? { random: input.random } : {}),
  };
}

const upgradeGroups = Object.entries(
  corpus.data.upgradeSemantics.groups,
) as Array<[RemixUpgradeGroup, Record<string, CapturedUpgrade>]>;

it("matches all pinned Remix upgrade caps, prices, and deterministic effects", () => {
  expect(corpus.metadata.sourceCommit).toBe(
    "0e0f4bf5a9c66e5603cda2ce4bd54213023dae21",
  );

  let definitionCount = 0;
  let sampleCount = 0;
  for (const [group, upgrades] of upgradeGroups) {
    expect(Object.keys(upgrades).sort()).toEqual(
      [...REMIX_UPGRADE_KEYS[group]].sort(),
    );
    for (const [key, upgrade] of Object.entries(upgrades)) {
      definitionCount++;
      const typedKey = key as RemixUpgradeKey<typeof group>;
      expect(getRemixUpgradeMaxLevel(group, typedKey)).toBe(
        upgrade.maxLevel === "Infinity" ? Infinity : upgrade.maxLevel,
      );

      for (const sample of upgrade.samples) {
        sampleCount++;
        expect(
          snapshotDecimal(
            calculateRemixUpgradePrice(group, typedKey, sample.level),
          ),
        ).toEqual(sample.price);
        if (sample.effect !== null) {
          expectReferenceEffect(
            snapshotDecimal(
              calculateRemixUpgradeEffect(
                group,
                typedKey,
                sample.level,
                upgradeContext({
                  levels: levelsWith({ [group]: { [key]: sample.level } }),
                  highestMineObjectLevel:
                    corpus.data.upgradeSemantics.controlledState
                      .highestMineObjectLevel,
                }),
              ),
            ),
            sample.effect,
            `${group}.${key}@${sample.level}`,
          );
        }
      }
    }
  }
  expect(definitionCount).toBe(29);
  expect(sampleCount).toBe(249);
});

it("matches source-captured cross-upgrade effect interactions", () => {
  for (const interaction of corpus.data.upgradeSemantics.effectInteractions) {
    const context = upgradeContext({
      levels: levelsWith(interaction.controlledLevels),
      highestMineObjectLevel: interaction.highestMineObjectLevel,
      controlledPowers: interaction.controlledPowers,
    });
    expect(interaction.otherUpgradeLevels).toBe(0);
    expect(interaction.otherPowers).toBe("1");

    for (const expected of interaction.effects) {
      const group = expected.group as RemixUpgradeGroup;
      const key = expected.key as RemixUpgradeKey<typeof group>;
      expect(
        snapshotDecimal(
          calculateRemixUpgradeEffect(group, key, expected.level, context),
        ),
      ).toEqual(expected.effect);
    }
  }
});

it("preserves Blacksmith Expertise RNG draw order and outcomes", () => {
  const samples =
    corpus.data.upgradeSemantics.stochasticEffects.blacksmithBonus.samples;
  expect(samples).toHaveLength(5);

  for (const sample of samples) {
    let draw = 0;
    const context = upgradeContext({
      levels: levelsWith({ money: { blacksmithBonus: sample.level } }),
      highestMineObjectLevel:
        corpus.data.upgradeSemantics.controlledState.highestMineObjectLevel,
      random: {
        nextDouble() {
          const value = sample.controlledRandomValues[draw];
          if (value === undefined) {
            throw new Error("Reference RNG fixture exhausted unexpectedly.");
          }
          draw++;
          return value;
        },
      },
    });

    expect(
      snapshotDecimal(
        calculateRemixUpgradeEffect(
          "money",
          "blacksmithBonus",
          sample.level,
          context,
        ),
      ),
    ).toEqual(sample.effect);
    expect(draw).toBe(sample.randomCalls);
    expect(draw).toBe(sample.controlledRandomValues.length);
  }

  expect(() =>
    calculateRemixUpgradeEffect("money", "blacksmithBonus", 1, {
      ...upgradeContext({
        levels: levelsWith({ money: { blacksmithBonus: 1 } }),
        highestMineObjectLevel:
          corpus.data.upgradeSemantics.controlledState.highestMineObjectLevel,
      }),
    }),
  ).toThrow("requires an injected Remix-compatible RNG");
});

it("matches captured Remix single and bulk purchase transitions", () => {
  const scenarios = corpus.data.upgradeSemantics.purchaseSemantics;
  expect(scenarios).toHaveLength(14);

  for (const scenario of scenarios) {
    const group = scenario.group as RemixUpgradeGroup;
    const key = scenario.key as RemixUpgradeKey<typeof group>;
    const initialState: RemixUpgradePurchaseState = {
      levels: levelsWith({
        [group]: { [key]: scenario.startingLevel },
      }),
      resources: Object.fromEntries(
        Object.entries(scenario.startingResources).map(([resource, value]) => [
          resource,
          value.decimal,
        ]),
      ) as RemixUpgradeResources,
    };

    const result = executeRemixUpgradePurchase({
      state: initialState,
      group,
      key,
      operation: scenario.operation,
    });
    const cap = getRemixUpgradeMaxLevel(group, key);
    const expectedMaxLevel = cap === Infinity ? "Infinity" : cap;

    expect(
      {
        currentPrice: snapshotDecimal(
          calculateRemixUpgradePrice(group, key, scenario.startingLevel),
        ),
        maxLevel: expectedMaxLevel,
        operationResult: result.operationResult,
        endingLevel: upgradeLevel(result.state.levels, group, key),
        purchases: result.purchases,
        endingResources: snapshotResources(result.state.resources),
      },
      scenario.name,
    ).toEqual({
      currentPrice: scenario.currentPrice,
      maxLevel: scenario.maxLevel,
      operationResult: scenario.operationResult,
      endingLevel: scenario.endingLevel,
      purchases: scenario.purchases,
      endingResources: scenario.endingResources,
    });

    expect(upgradeLevel(initialState.levels, group, key), scenario.name).toBe(
      scenario.startingLevel,
    );
    expect(
      snapshotResources(initialState.resources),
      `${scenario.name} leaves its input resources unchanged`,
    ).toEqual(scenario.startingResources);
  }
});
