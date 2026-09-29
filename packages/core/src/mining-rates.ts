import { Decimal, type DecimalSource } from "./decimal.js";
import type { MineObject } from "./mine-objects.js";

/** Effects evaluated by Remix upgrade and power state before rate calculation. */
export type RemixMiningFactors = {
  activePower: DecimalSource;
  idlePower: DecimalSource;
  idleSpeed: DecimalSource;
  miningPower: DecimalSource;
  idleDamageBoost: DecimalSource;
  damageUpgradeBoost: DecimalSource;
  planetCoinActivePower: DecimalSource;
  gemChance: DecimalSource;
  gemMultiplier: DecimalSource;
  lastObjectGemMultiplier: DecimalSource;
};

export type RemixMiningInput = {
  /** The current object used by the no-argument Remix rate functions. */
  object: MineObject;
  pickaxe: { power: DecimalSource; quality: DecimalSource };
  factors: RemixMiningFactors;
};

export type RemixMiningRates = {
  pickaxeDamage: Decimal;
  activeDamage: Decimal;
  idleDamage: Decimal;
  idleDps: Decimal;
  moneyPerClick: Decimal;
  moneyPerSecond: Decimal;
  gemsPerSecond: Decimal;
  planetCoinsPerSecond: Decimal;
};

export function calculateRemixPickaxeDamage(
  pickaxe: RemixMiningInput["pickaxe"],
): Decimal {
  return new Decimal(pickaxe.power).mul(pickaxe.quality);
}

function idleDamageAt(input: RemixMiningInput, object: MineObject): Decimal {
  const factors = input.factors;
  return Decimal.max(
    0,
    calculateRemixPickaxeDamage(input.pickaxe)
      .mul(factors.idlePower)
      .mul(factors.miningPower)
      .mul(factors.idleDamageBoost)
      .mul(factors.damageUpgradeBoost)
      .sub(object.defense),
  );
}

/** Matches `functions.getIdleDamage(obj)` at the pinned Remix revision. */
export function calculateRemixIdleDamage(
  input: RemixMiningInput,
  object = input.object,
): Decimal {
  return idleDamageAt(input, object);
}

/**
 * Matches Remix's no-argument `getIdleDPS()`. The optional object argument
 * accepted by the legacy function is ignored, so it always uses current state.
 */
export function calculateRemixIdleDps(input: RemixMiningInput): Decimal {
  return idleDamageAt(input, input.object).mul(input.factors.idleSpeed);
}

/**
 * Matches `functions.getActiveDamage(obj)`. Its direct hit uses `obj`, while
 * the idle-DPS addition still reads the current object from game state.
 */
export function calculateRemixActiveDamage(
  input: RemixMiningInput,
  targetObject = input.object,
): Decimal {
  const factors = input.factors;
  const directDamageMultiplier = new Decimal(factors.activePower)
    .mul(factors.miningPower)
    .mul(factors.damageUpgradeBoost);
  const directDamage = Decimal.max(
    0,
    calculateRemixPickaxeDamage(input.pickaxe)
      .mul(directDamageMultiplier)
      .sub(targetObject.defense),
  );
  return directDamage.add(
    calculateRemixIdleDps(input).mul(factors.planetCoinActivePower),
  );
}

function hitsToBreak(totalHp: Decimal, damage: Decimal): number {
  // The original code coerces a break_infinity Decimal through Number in both
  // Math.ceil call paths. `toNumber()` retains that same precision boundary.
  return Math.ceil(totalHp.div(damage).toNumber());
}

/** Calculates the damage and passive income functions captured from Remix. */
export function calculateRemixMiningRates(
  input: RemixMiningInput,
): RemixMiningRates {
  const { object, factors } = input;
  const activeDamage = calculateRemixActiveDamage(input);
  const idleDamage = calculateRemixIdleDamage(input);
  const idleDps = idleDamage.mul(factors.idleSpeed);

  let moneyPerClick = new Decimal(0);
  if (activeDamage.gt(0)) {
    const activeHitsToBreak = hitsToBreak(object.totalHp, activeDamage);
    moneyPerClick = object.value.div(activeHitsToBreak);
  }

  let moneyPerSecond = new Decimal(0);
  if (idleDamage.gt(0)) {
    const idleHitsToBreak = hitsToBreak(object.totalHp, idleDamage);
    moneyPerSecond = new Decimal(1 / idleHitsToBreak)
      .mul(factors.idleSpeed)
      .mul(object.value);
  }

  const gemHitsToBreak = hitsToBreak(object.totalHp, idleDamage);
  const secondsPerBreak =
    gemHitsToBreak / new Decimal(factors.idleSpeed).toNumber();
  const gemsPerSecond = new Decimal(1)
    .div(secondsPerBreak)
    .mul(factors.gemMultiplier)
    .mul(factors.gemChance)
    .mul(factors.lastObjectGemMultiplier);

  let planetCoinsPerSecond = new Decimal(0);
  const planetCoinDrop = object.drops["planetcoin"];
  if (planetCoinDrop !== undefined) {
    const planetCoinHitsToBreak = hitsToBreak(object.totalHp, idleDamage);
    const planetCoinSecondsPerBreak =
      planetCoinHitsToBreak / new Decimal(factors.idleSpeed).toNumber();
    planetCoinsPerSecond = new Decimal(1)
      .div(planetCoinSecondsPerBreak)
      .mul(planetCoinDrop.amount)
      .mul(planetCoinDrop.chance);
  }

  return {
    pickaxeDamage: calculateRemixPickaxeDamage(input.pickaxe),
    activeDamage,
    idleDamage,
    idleDps,
    moneyPerClick,
    moneyPerSecond,
    gemsPerSecond,
    planetCoinsPerSecond,
  };
}
