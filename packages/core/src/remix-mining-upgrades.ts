import { Decimal, type DecimalSource } from "./decimal.js";
import type { RemixMiningFactors } from "./mining-rates.js";

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

/** Evaluates the pinned effect functions used by the mining-rate formulas. */
export function calculateRemixMiningFactors(
  input: RemixMiningUpgradeInput,
): RemixMiningFactors {
  const { levels, powers } = input;
  const wisdomLevels = levels.wisdom;
  const boughtWisdomUpgradeLevels = Object.keys(wisdomLevels).reduce(
    (sum, key) => sum + wisdomLevels[key]!,
    0,
  );

  const gemIdlePower = new Decimal(1 + 0.15 * levels.gems.idlePower).pow(
    1.2518,
  );
  const gemChance = new Decimal(0.02 + 0.004 * levels.money.gemChance)
    .add(0.005 * levels.gems.gemChance)
    .add(0.01 * levels.planetCoins.gemChance);
  const gemMultiplier = Decimal.round(
    Decimal.pow(1.05, levels.gems.gemMultiply)
      .add(levels.gems.gemMultiply)
      .mul(1 + 0.1 * levels.planetCoins.gemMultiply)
      .mul(1 + 0.5 * (wisdomLevels["gemBoostSimple"] ?? 0))
      .mul(powers.exquisity),
  );

  const idleDamageBoostLevel = wisdomLevels["damageBoost"] ?? 0;
  const idleDamageBoost =
    idleDamageBoostLevel === 0
      ? new Decimal(1)
      : Decimal.pow(
          1.05 + 0.03 * idleDamageBoostLevel,
          Math.max(0, input.highestMineObjectLevel - 170),
        ).mul(idleDamageBoostLevel);

  const damageUpgradeLevel = wisdomLevels["damageBoostUpgrades"] ?? 0;
  const damageUpgradeBoost = Decimal.pow(
    1 + 0.05 * damageUpgradeLevel,
    boughtWisdomUpgradeLevels,
  );

  return {
    activePower: new Decimal(1 + 0.15 * levels.money.activePower).mul(
      Decimal.pow(1.03, levels.money.activePower),
    ),
    idlePower: new Decimal(0.75 + 0.25 * levels.money.idlePower)
      .mul(Decimal.pow(1.03, levels.money.idlePower))
      .mul(gemIdlePower),
    idleSpeed: Decimal.pow(1.05, levels.money.idleSpeed),
    miningPower: new Decimal(powers.mining),
    idleDamageBoost,
    damageUpgradeBoost,
    planetCoinActivePower: new Decimal(0.01 * levels.planetCoins.activePower),
    gemChance,
    gemMultiplier,
    lastObjectGemMultiplier: new Decimal(
      input.currentObjectIsHighestDamageable
        ? 1 + levels.planetCoins.lastObjGems
        : 1,
    ),
  };
}
