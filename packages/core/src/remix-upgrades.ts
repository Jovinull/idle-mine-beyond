import { Decimal, type DecimalSource } from "./decimal.js";

export const REMIX_UPGRADE_KEYS = {
  money: [
    "blacksmith",
    "blacksmithSkill",
    "blacksmithBonus",
    "gemChance",
    "activePower",
    "idlePower",
    "idleSpeed",
    "gemWaster",
  ],
  gems: [
    "blacksmith",
    "blacksmithSkill",
    "idlePower",
    "gemWaster",
    "gemChance",
    "gemMultiply",
    "offlineGems",
  ],
  planetCoins: [
    "activePower",
    "gemMultiply",
    "lastObjGems",
    "gemChance",
    "offlinePC",
    "offlineTime",
    "bulkCraft",
  ],
  wisdom: [
    "powerPowerActive",
    "powerPowerIdle",
    "damageBoost",
    "gemBoostSimple",
    "damageBoostUpgrades",
    "powerPowerPower",
    "powerResetKeep",
  ],
} as const;

export type RemixUpgradeGroup = keyof typeof REMIX_UPGRADE_KEYS;
export type RemixUpgradeKey<Group extends RemixUpgradeGroup> =
  (typeof REMIX_UPGRADE_KEYS)[Group][number];

export type RemixUpgradeLevels = {
  [Group in RemixUpgradeGroup]: Record<RemixUpgradeKey<Group>, number>;
};

export type RemixUpgradeRandom = {
  nextDouble(): number;
};

export type RemixUpgradeContext = {
  levels: RemixUpgradeLevels;
  powers: {
    craftsmanship: DecimalSource;
    expertise: DecimalSource;
    exquisity: DecimalSource;
  };
  highestMineObjectLevel: number;
  /** Required only when evaluating the stochastic Blacksmith Expertise effect. */
  random?: RemixUpgradeRandom;
};

type UpgradeDefinition = {
  maxLevel: number;
  price(level: number): Decimal;
  effect(level: number, context: RemixUpgradeContext): Decimal;
};

type UpgradeDefinitions = {
  [Group in RemixUpgradeGroup]: Record<
    RemixUpgradeKey<Group>,
    UpgradeDefinition
  >;
};

function roundBase(value: Decimal, digits: number): Decimal {
  const factor = Math.pow(10, digits);
  value.m = Math.round(value.m * factor) / factor;
  return value;
}

function levelOf<Group extends RemixUpgradeGroup>(
  context: RemixUpgradeContext,
  group: Group,
  key: RemixUpgradeKey<Group>,
): number {
  return context.levels[group][key];
}

function boughtWisdomUpgradeLevels(context: RemixUpgradeContext): number {
  let total = 0;
  const levels = context.levels.wisdom as Record<string, number>;
  for (const key of Object.keys(levels)) total += levels[key]!;
  return total;
}

const UPGRADE_DEFINITIONS: UpgradeDefinitions = {
  money: {
    blacksmith: {
      maxLevel: Infinity,
      price: (level) =>
        Decimal.pow(1.2, level)
          .mul(30)
          .add(level * 75),
      effect: (level, context) =>
        Decimal.pow(1.09, level)
          .mul(20)
          .add(level * 10)
          .mul(
            calculateRemixUpgradeEffect(
              "gems",
              "blacksmith",
              levelOf(context, "gems", "blacksmith"),
              context,
            ),
          )
          .mul(context.powers.craftsmanship),
    },
    blacksmithSkill: {
      maxLevel: Infinity,
      price: (level) => new Decimal(80e3).mul(Decimal.pow(3, level)),
      effect: (level, context) =>
        new Decimal(0.9 + 0.05 * level)
          .mul(
            calculateRemixUpgradeEffect(
              "gems",
              "blacksmithSkill",
              levelOf(context, "gems", "blacksmithSkill"),
              context,
            ),
          )
          .mul(context.powers.expertise),
    },
    blacksmithBonus: {
      maxLevel: 10,
      price: (level) => new Decimal(1e6).mul(Decimal.pow(5, level)),
      effect: (level, context) => {
        if (!context.random) {
          throw new Error(
            "Blacksmith Expertise requires an injected Remix-compatible RNG.",
          );
        }
        const chance = context.random.nextDouble();
        if (chance < 0.25 && level > 0) {
          return Decimal.floor(context.random.nextDouble() * level);
        }
        return new Decimal(0);
      },
    },
    gemChance: {
      maxLevel: 20,
      price: (level) => new Decimal(200).mul(Decimal.pow(2.5, level)),
      effect: (level, context) =>
        new Decimal(0.02 + 0.004 * level)
          .add(
            calculateRemixUpgradeEffect(
              "gems",
              "gemChance",
              levelOf(context, "gems", "gemChance"),
              context,
            ),
          )
          .add(
            calculateRemixUpgradeEffect(
              "planetCoins",
              "gemChance",
              levelOf(context, "planetCoins", "gemChance"),
              context,
            ),
          ),
    },
    activePower: {
      maxLevel: Infinity,
      price: (level) => new Decimal(1e3).mul(Decimal.pow(2, level)),
      effect: (level) =>
        new Decimal(1 + 0.15 * level).mul(Decimal.pow(1.03, level)),
    },
    idlePower: {
      maxLevel: Infinity,
      price: (level) => new Decimal(200).mul(Decimal.pow(2, level)),
      effect: (level, context) =>
        new Decimal(0.75 + 0.25 * level)
          .mul(Decimal.pow(1.03, level))
          .mul(
            calculateRemixUpgradeEffect(
              "gems",
              "idlePower",
              levelOf(context, "gems", "idlePower"),
              context,
            ),
          ),
    },
    idleSpeed: {
      maxLevel: 60,
      price: (level) =>
        new Decimal(50).mul(
          Decimal.pow(2.2, level + 3 * Math.max(0, level - 50)),
        ),
      effect: (level) => Decimal.pow(1.05, level),
    },
    gemWaster: {
      maxLevel: 10,
      price: (level) => new Decimal(90e6).mul(Decimal.pow(2000, level * level)),
      effect: (level) => Decimal.floor(Decimal.pow(3.3, level)),
    },
  },
  gems: {
    blacksmith: {
      maxLevel: Infinity,
      price: (level) =>
        new Decimal(100 + 7 * level).mul(
          Decimal.pow(1.025, Math.max(0, level - 25)),
        ),
      effect: (level) => Decimal.pow(1.08, level),
    },
    blacksmithSkill: {
      maxLevel: 50,
      price: (level) =>
        roundBase(new Decimal(250).mul(Decimal.pow(280 / 250, level)), 1),
      effect: (level) => new Decimal(1 + 0.1 * level).pow(1.1131),
    },
    idlePower: {
      maxLevel: 100,
      price: (level) =>
        new Decimal(100 + 10 * level).mul(
          Decimal.pow(1.01, Math.max(0, level - 50)),
        ),
      effect: (level) => new Decimal(1 + 0.15 * level).pow(1.2518),
    },
    gemWaster: {
      maxLevel: 5,
      price: (level) => new Decimal(10e3).mul(Decimal.pow(45, level)),
      effect: (level) => new Decimal(level),
    },
    gemChance: {
      maxLevel: 80,
      price: (level) =>
        new Decimal(50 + 30 * level)
          .pow(1.3354)
          .mul(Decimal.pow(1.125, Math.max(level - 30, 0))),
      effect: (level) => new Decimal(0.005 * level),
    },
    gemMultiply: {
      maxLevel: Infinity,
      price: (level) =>
        new Decimal(1000)
          .mul(Decimal.pow(1.05, level))
          .mul(1 + 0.02 * Math.max(level - 250, 0))
          .add(1200 * level)
          .mul(1 + 0.01 * Math.max(level - 1000, 0))
          .mul(1 + 0.02 * Math.max(level - 2500, 0))
          .mul(Decimal.pow(1.002, Math.max(level - 10000, 0))),
      effect: (level, context) =>
        Decimal.round(
          Decimal.pow(1.05, level)
            .add(level)
            .mul(
              calculateRemixUpgradeEffect(
                "planetCoins",
                "gemMultiply",
                levelOf(context, "planetCoins", "gemMultiply"),
                context,
              ),
            )
            .mul(
              calculateRemixUpgradeEffect(
                "wisdom",
                "gemBoostSimple",
                levelOf(context, "wisdom", "gemBoostSimple"),
                context,
              ),
            )
            .mul(context.powers.exquisity),
        ),
    },
    offlineGems: {
      maxLevel: 15,
      price: (level) => new Decimal(4444).mul(Decimal.pow(4, level)),
      effect: (level) => new Decimal(0.05 * level),
    },
  },
  planetCoins: {
    activePower: {
      maxLevel: 10,
      price: (level) => new Decimal(100).mul(Decimal.pow(10, level)),
      effect: (level) => new Decimal(0.01 * level),
    },
    gemMultiply: {
      maxLevel: Infinity,
      price: (level) => new Decimal(100).mul(Decimal.pow(7.77, level)),
      effect: (level) => new Decimal(1 + 0.1 * level),
    },
    lastObjGems: {
      maxLevel: 19,
      price: (level) => new Decimal(1e6).mul(Decimal.pow(100, level)),
      effect: (level) => new Decimal(1 + level),
    },
    gemChance: {
      maxLevel: 50,
      price: (level) => new Decimal(1000).mul(Decimal.pow(1.4, level)),
      effect: (level) => new Decimal(0.01 * level),
    },
    offlinePC: {
      maxLevel: 10,
      price: (level) => new Decimal(10000).mul(Decimal.pow(10, level)),
      effect: (level) => new Decimal(0.05 * level),
    },
    offlineTime: {
      maxLevel: 42,
      price: (level) => new Decimal(10000).mul(Decimal.pow(4, level)),
      effect: (level) => new Decimal(level),
    },
    bulkCraft: {
      maxLevel: 99,
      price: (level) => new Decimal(1e12).mul(Decimal.pow(10, level)),
      effect: (level) => new Decimal(1 + level),
    },
  },
  wisdom: {
    powerPowerActive: {
      maxLevel: Infinity,
      price: (level) =>
        Decimal.pow(1000, level).pow(
          Decimal.pow(1.05, Math.max(0, level - 50)),
        ),
      effect: (level, context) =>
        new Decimal(
          1 +
            0.00005 *
              Math.cbrt(level) *
              calculateRemixUpgradeEffect(
                "wisdom",
                "powerPowerPower",
                levelOf(context, "wisdom", "powerPowerPower"),
                context,
              ).toNumber(),
        ),
    },
    powerPowerIdle: {
      maxLevel: Infinity,
      price: (level) =>
        Decimal.pow(1000, level)
          .mul(1000)
          .pow(Decimal.pow(1.05, Math.max(0, level - 50))),
      effect: (level, context) =>
        new Decimal(
          1 +
            0.00002 *
              Math.cbrt(level) *
              calculateRemixUpgradeEffect(
                "wisdom",
                "powerPowerPower",
                levelOf(context, "wisdom", "powerPowerPower"),
                context,
              ).toNumber(),
        ),
    },
    damageBoost: {
      maxLevel: 20,
      price: (level) => Decimal.pow(512, level + 2).pow(1 + level / 2),
      effect: (level, context) =>
        level === 0
          ? new Decimal(1)
          : Decimal.pow(
              1.05 + 0.03 * level,
              Math.max(0, context.highestMineObjectLevel - 170),
            ).mul(level),
    },
    gemBoostSimple: {
      maxLevel: 10,
      price: (level) => Decimal.pow(1e10, Math.pow(level, 1.2)).mul(1e10),
      effect: (level) => new Decimal(1 + 0.5 * level),
    },
    damageBoostUpgrades: {
      maxLevel: 10,
      price: (level) => Decimal.pow(1e25, level).mul(1e50),
      effect: (level, context) =>
        Decimal.pow(1 + 0.05 * level, boughtWisdomUpgradeLevels(context)),
    },
    powerPowerPower: {
      maxLevel: Infinity,
      price: (level) =>
        Decimal.pow(1e10, level * level)
          .mul(1e100)
          .pow(Math.max(1, level - 10)),
      effect: (level) => new Decimal(1 + 0.03 * level),
    },
    powerResetKeep: {
      maxLevel: 10,
      price: (level) => Decimal.pow(1e25, level * level).mul(1e25),
      effect: (level) => new Decimal(0.5 + 0.5 * (1 - Math.pow(0.9, level))),
    },
  },
};

function getUpgradeDefinition(
  group: string,
  key: string,
): UpgradeDefinition | undefined {
  return (
    UPGRADE_DEFINITIONS as unknown as Record<
      string,
      Record<string, UpgradeDefinition>
    >
  )[group]?.[key];
}

export function getRemixUpgradeMaxLevel<Group extends RemixUpgradeGroup>(
  group: Group,
  key: RemixUpgradeKey<Group>,
): number {
  const definition = getUpgradeDefinition(group, key);
  if (!definition)
    throw new RangeError(`Unknown Remix upgrade: ${group}.${key}`);
  return definition.maxLevel;
}

export function calculateRemixUpgradePrice<Group extends RemixUpgradeGroup>(
  group: Group,
  key: RemixUpgradeKey<Group>,
  level: number,
): Decimal {
  const definition = getUpgradeDefinition(group, key);
  if (!definition)
    throw new RangeError(`Unknown Remix upgrade: ${group}.${key}`);
  return definition.price(level);
}

export function calculateRemixUpgradeEffect<Group extends RemixUpgradeGroup>(
  group: Group,
  key: RemixUpgradeKey<Group>,
  level: number,
  context: RemixUpgradeContext,
): Decimal {
  const definition = getUpgradeDefinition(group, key);
  if (!definition)
    throw new RangeError(`Unknown Remix upgrade: ${group}.${key}`);
  return definition.effect(level, context);
}
