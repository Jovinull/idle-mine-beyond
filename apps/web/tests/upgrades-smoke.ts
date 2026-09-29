import {
  Decimal,
  REMIX_UPGRADE_KEYS,
  calculateRemixUpgradeEffect,
  calculateRemixUpgradePrice,
  getRemixUpgradeMaxLevel,
  type RemixUpgradeContext,
  type RemixUpgradeGroup,
  type RemixUpgradeKey,
  type RemixUpgradeLevels,
} from "@idle-mine-beyond/core";

type DecimalSnapshot = {
  decimal: string;
  mantissa: number | string;
  exponent: number | string;
};

type UpgradeSemantics = {
  controlledState: { highestMineObjectLevel: number; powerValues: string[] };
  groups: Record<
    string,
    Record<
      string,
      {
        name: string;
        resource: number;
        maxLevel: number | "Infinity";
        stochasticEffect: boolean;
        samples: Array<{
          level: number;
          price: DecimalSnapshot;
          effect: DecimalSnapshot | null;
        }>;
      }
    >
  >;
  stochasticEffects: {
    blacksmithBonus: {
      sourcePath: string;
      randomSource: string;
      samples: Array<{
        name: string;
        level: number;
        controlledRandomValues: number[];
        randomCalls: number;
        effect: DecimalSnapshot;
      }>;
    };
  };
  effectInteractions: Array<{
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
  }>;
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

function makeContext(input: {
  levels: RemixUpgradeLevels;
  highestMineObjectLevel: number;
  powerValues: string[];
  controlledPowers?: Record<string, string>;
  random?: RemixUpgradeContext["random"];
}): RemixUpgradeContext {
  const powers = input.controlledPowers ?? {};
  return {
    levels: input.levels,
    powers: {
      craftsmanship: powers["craftsmanship"] ?? input.powerValues[1]!,
      expertise: powers["expertise"] ?? input.powerValues[2]!,
      exquisity: powers["exquisity"] ?? input.powerValues[4]!,
    },
    highestMineObjectLevel: input.highestMineObjectLevel,
    ...(input.random ? { random: input.random } : {}),
  };
}

function evaluate(semantics: UpgradeSemantics) {
  const groups = Object.fromEntries(
    Object.entries(semantics.groups).map(([rawGroup, upgrades]) => {
      const group = rawGroup as RemixUpgradeGroup;
      return [
        group,
        Object.fromEntries(
          Object.entries(upgrades).map(([rawKey, upgrade]) => {
            const key = rawKey as RemixUpgradeKey<typeof group>;
            return [
              key,
              {
                name: upgrade.name,
                resource: upgrade.resource,
                maxLevel:
                  getRemixUpgradeMaxLevel(group, key) === Infinity
                    ? "Infinity"
                    : getRemixUpgradeMaxLevel(group, key),
                stochasticEffect: upgrade.stochasticEffect,
                samples: upgrade.samples.map((sample) => {
                  const context = makeContext({
                    levels: levelsWith({ [group]: { [key]: sample.level } }),
                    highestMineObjectLevel:
                      semantics.controlledState.highestMineObjectLevel,
                    powerValues: semantics.controlledState.powerValues,
                  });
                  return {
                    level: sample.level,
                    price: snapshotDecimal(
                      calculateRemixUpgradePrice(group, key, sample.level),
                    ),
                    effect:
                      sample.effect === null
                        ? null
                        : snapshotDecimal(
                            calculateRemixUpgradeEffect(
                              group,
                              key,
                              sample.level,
                              context,
                            ),
                          ),
                  };
                }),
              },
            ];
          }),
        ),
      ];
    }),
  );

  const effectInteractions = semantics.effectInteractions.map((interaction) => {
    const context = makeContext({
      levels: levelsWith(interaction.controlledLevels),
      highestMineObjectLevel: interaction.highestMineObjectLevel,
      powerValues: semantics.controlledState.powerValues,
      controlledPowers: interaction.controlledPowers,
    });
    return {
      name: interaction.name,
      highestMineObjectLevel: interaction.highestMineObjectLevel,
      controlledLevels: interaction.controlledLevels,
      otherUpgradeLevels: interaction.otherUpgradeLevels,
      controlledPowers: interaction.controlledPowers,
      otherPowers: interaction.otherPowers,
      effects: interaction.effects.map((expected) => {
        const group = expected.group as RemixUpgradeGroup;
        const key = expected.key as RemixUpgradeKey<typeof group>;
        return {
          group,
          key,
          level: expected.level,
          effect: snapshotDecimal(
            calculateRemixUpgradeEffect(group, key, expected.level, context),
          ),
        };
      }),
    };
  });

  const blacksmithSamples =
    semantics.stochasticEffects.blacksmithBonus.samples.map((sample) => {
      let draw = 0;
      const context = makeContext({
        levels: levelsWith({ money: { blacksmithBonus: sample.level } }),
        highestMineObjectLevel:
          semantics.controlledState.highestMineObjectLevel,
        powerValues: semantics.controlledState.powerValues,
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
      const effect = calculateRemixUpgradeEffect(
        "money",
        "blacksmithBonus",
        sample.level,
        context,
      );
      return {
        name: sample.name,
        level: sample.level,
        controlledRandomValues: sample.controlledRandomValues,
        randomCalls: draw,
        effect: snapshotDecimal(effect),
      };
    });

  return {
    groups,
    stochasticEffects: {
      blacksmithBonus: {
        sourcePath: semantics.stochasticEffects.blacksmithBonus.sourcePath,
        randomSource: semantics.stochasticEffects.blacksmithBonus.randomSource,
        samples: blacksmithSamples,
      },
    },
    effectInteractions,
  };
}

const output = document.querySelector<HTMLPreElement>("#result");
if (!output) throw new Error("Upgrade parity output element is missing.");

(
  window as Window & {
    __idleMineUpgradeProbe?: (input: UpgradeSemantics) => unknown;
  }
).__idleMineUpgradeProbe = evaluate;
output.textContent = "Upgrade parity probe ready";
output.dataset.ready = "true";
