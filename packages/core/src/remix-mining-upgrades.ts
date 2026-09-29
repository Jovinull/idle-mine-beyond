import { Decimal, type DecimalSource } from "./decimal.js";
import type { RemixMiningFactors } from "./mining-rates.js";
import {
  calculateRemixUpgradeEffect,
  type RemixUpgradeContext,
  type RemixUpgradeGroup,
  type RemixUpgradeKey,
  type RemixUpgradeLevels,
} from "./remix-upgrades.js";

export type RemixMiningUpgradeLevels = {
  money: {
    activePower: number;
    idlePower: number;
    idleSpeed: number;
    gemChance: number;
  };
  gems: {
    idlePower: number;
    gemChance: number;
    gemMultiply: number;
  };
  planetCoins: {
    activePower: number;
    gemChance: number;
    gemMultiply: number;
    lastObjGems: number;
  };
  /** Include every Wisdom upgrade level; Remix counts all purchased Wisdom levels. */
  wisdom: Record<string, number>;
};

export type RemixMiningUpgradeInput = {
  levels: RemixMiningUpgradeLevels;
  powers: {
    mining: DecimalSource;
    exquisity: DecimalSource;
  };
  /** The saved `highestMineObjectLevel` used by Increasing Damage Boost. */
  highestMineObjectLevel: number;
  /** Pass the result of Remix's current-ID/highest-damageable comparison. */
  currentObjectIsHighestDamageable: boolean;
};

export type RemixMiningPowerGainAction = "activeClick" | "idleTick";

function completeLevels(levels: RemixMiningUpgradeLevels): RemixUpgradeLevels {
  return {
    money: {
      blacksmith: 0,
      blacksmithSkill: 0,
      blacksmithBonus: 0,
      gemChance: levels.money.gemChance,
      activePower: levels.money.activePower,
      idlePower: levels.money.idlePower,
      idleSpeed: levels.money.idleSpeed,
      gemWaster: 0,
    },
    gems: {
      blacksmith: 0,
      blacksmithSkill: 0,
      idlePower: levels.gems.idlePower,
      gemWaster: 0,
      gemChance: levels.gems.gemChance,
      gemMultiply: levels.gems.gemMultiply,
      offlineGems: 0,
    },
    planetCoins: {
      activePower: levels.planetCoins.activePower,
      gemMultiply: levels.planetCoins.gemMultiply,
      lastObjGems: levels.planetCoins.lastObjGems,
      gemChance: levels.planetCoins.gemChance,
      offlinePC: 0,
      offlineTime: 0,
      bulkCraft: 0,
    },
    wisdom: {
      powerPowerActive: 0,
      powerPowerIdle: 0,
      damageBoost: 0,
      gemBoostSimple: 0,
      damageBoostUpgrades: 0,
      powerPowerPower: 0,
      powerResetKeep: 0,
      ...levels.wisdom,
    },
  };
}

function createUpgradeContext(
  input: RemixMiningUpgradeInput,
): RemixUpgradeContext {
  return {
    levels: completeLevels(input.levels),
    powers: {
      craftsmanship: 1,
      expertise: 1,
      exquisity: input.powers.exquisity,
    },
    highestMineObjectLevel: input.highestMineObjectLevel,
  };
}

/** Evaluates the pinned effect functions used by the mining-rate formulas. */
export function calculateRemixMiningFactors(
  input: RemixMiningUpgradeInput,
): RemixMiningFactors {
  const context = createUpgradeContext(input);
  const levels = context.levels;
  const effect = <Group extends RemixUpgradeGroup>(
    group: Group,
    key: RemixUpgradeKey<Group>,
  ) => {
    const level = (levels[group] as Record<string, number>)[key]!;
    return calculateRemixUpgradeEffect(group, key, level, context);
  };

  return {
    activePower: effect("money", "activePower"),
    idlePower: effect("money", "idlePower"),
    idleSpeed: effect("money", "idleSpeed"),
    miningPower: new Decimal(input.powers.mining),
    idleDamageBoost: effect("wisdom", "damageBoost"),
    damageUpgradeBoost: effect("wisdom", "damageBoostUpgrades"),
    planetCoinActivePower: effect("planetCoins", "activePower"),
    gemChance: effect("money", "gemChance"),
    gemMultiplier: effect("gems", "gemMultiply"),
    lastObjectGemMultiplier: new Decimal(
      input.currentObjectIsHighestDamageable
        ? effect("planetCoins", "lastObjGems")
        : 1,
    ),
  };
}

/** Evaluates the source Power of Mining growth upgrade for one action. */
export function calculateRemixMiningPowerGainMultiplier(input: {
  upgradeInput: RemixMiningUpgradeInput;
  action: RemixMiningPowerGainAction;
}): Decimal {
  const context = createUpgradeContext(input.upgradeInput);
  const key =
    input.action === "activeClick" ? "powerPowerActive" : "powerPowerIdle";
  return calculateRemixUpgradeEffect(
    "wisdom",
    key,
    context.levels.wisdom[key],
    context,
  );
}
