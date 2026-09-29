import { Decimal, type DecimalSource } from "./decimal.js";
import {
  calculateRemixUpgradeEffect,
  type RemixUpgradeContext,
  type RemixUpgradeRandom,
} from "./remix-upgrades.js";

export interface RemixPickaxe {
  readonly name: string;
  readonly power: Decimal;
  readonly quality: Decimal;
  readonly damage: Decimal;
}

export type RemixPickaxeCraftMode =
  | { readonly kind: "minimum" }
  | { readonly kind: "average" }
  | {
      readonly kind: "random";
      readonly random: RemixUpgradeRandom;
      readonly mineObjectName: (level: number) => string;
    };

export interface RemixPickaxeCraftInput {
  readonly gems: DecimalSource;
  readonly context: Omit<RemixUpgradeContext, "random">;
  readonly mode: RemixPickaxeCraftMode;
}

export interface RemixEquippedPickaxe {
  readonly name: string;
  readonly power: DecimalSource;
  readonly quality: DecimalSource;
}

export type RemixPickaxeCraftEvent =
  | { readonly type: "pickaxe-replaced"; readonly pickaxe: RemixPickaxe }
  | { readonly type: "dud"; readonly pickaxe: RemixPickaxe }
  | { readonly type: "insufficient-gems" }
  | { readonly type: "save" };

export interface RemixPickaxeCraftAttemptInput {
  readonly state: {
    readonly gems: DecimalSource;
    readonly pickaxe: RemixEquippedPickaxe;
  };
  /** The `gems` argument supplied to Remix's `functions.craftPick(gems)`. */
  readonly craftGems: DecimalSource;
  readonly shiftHeld: boolean;
  readonly context: Omit<RemixUpgradeContext, "random">;
  readonly random: RemixUpgradeRandom;
  readonly mineObjectName: (level: number) => string;
}

export interface RemixPickaxeCraftAttemptResult {
  readonly state: {
    readonly gems: Decimal;
    readonly pickaxe: RemixEquippedPickaxe;
  };
  /** Events retain the source order; a replacement logs before it requests a save. */
  readonly events: RemixPickaxeCraftEvent[];
}

const QUALITY_NAMES = [
  "Bad",
  "Sturdy",
  "Normal",
  "Rare",
  "Epic",
  "Legendary",
  "Superb",
  "Cosmic",
  "Divine",
  "Ultimate",
  "Godly",
  "Demigodly",
  "Supergodly",
  "OMEGA",
] as const;

const VOWELS = "aeiou";
const CONSONANTS = "bcdfghjklmnpqrstvwxyz";

function generateWord(seed: number, length: number): string {
  let word = "";
  for (let index = 0; index < length; index++) {
    const frequency = Math.sin(20_000 * seed) > 0 ? 3 : 2;
    const collection = index % frequency === 0 ? VOWELS : CONSONANTS;
    const characterIndex = Math.floor(
      (0.5 + 0.5 * Math.sin(seed * 5_172 + 13_451 * seed * index * index)) *
        collection.length,
    );
    word += collection[characterIndex];
  }
  return word[0]!.toUpperCase() + word.slice(1);
}

function generateName(input: {
  quality: Decimal;
  bonus: number;
  highestMineObjectLevel: number;
  random: RemixUpgradeRandom;
  mineObjectName: (level: number) => string;
}): string {
  const qualityTier = Math.floor(
    Math.log(input.quality.toNumber()) / Math.log(1.4) +
      input.random.nextDouble() * 2,
  );
  const qualityName = QUALITY_NAMES[Math.max(0, Math.min(qualityTier, 13))];
  const times = Math.floor(
    input.quality.div(200).log10() / Math.log(1.15) +
      input.random.nextDouble() * 3 -
      5,
  );

  let name: string;
  if (input.random.nextDouble() < 0.3) {
    const type =
      Math.floor(input.random.nextDouble() * 2) === 0 ? "Pickaxe" : "Pick";
    const seed = input.random.nextDouble() * 1e6;
    const wordLength = Math.floor(input.random.nextDouble() * 4 + 4);
    name = `${type} "${generateWord(seed, wordLength)}"`;
  } else {
    const mineObjectId = Math.max(
      0,
      input.highestMineObjectLevel -
        12 +
        Math.round(input.random.nextDouble() * 9),
    );
    const mineObjectName = input.mineObjectName(mineObjectId);
    const type =
      Math.floor(input.random.nextDouble() * 2) === 0 ? "Pickaxe" : "Pick";
    name = `${mineObjectName} ${type}`;
  }

  return `${qualityName}${times > 1 ? ` ${times} TIMES` : ""} ${name}${input.bonus > 0 ? ` +${input.bonus}` : ""}`;
}

/**
 * Reproduces the pinned Remix random craft and its separate deterministic
 * minimum/average display calculations. All stochastic draws are injected;
 * the caller resolves generated mine-object names through the source catalog.
 */
export function calculateRemixPickaxeCraft(
  input: RemixPickaxeCraftInput,
): RemixPickaxe {
  const gems = new Decimal(input.gems);
  const average = input.mode.kind !== "random";
  const averageValue =
    input.mode.kind === "minimum"
      ? 0
      : input.mode.kind === "average"
        ? 0.5
        : undefined;
  const random = input.mode.kind === "random" ? input.mode.random : undefined;
  const context: RemixUpgradeContext = random
    ? { ...input.context, random }
    : input.context;
  const powMultiplier = gems.sub(1).div(5).add(1);
  const qualityBonus = new Decimal(
    (gems.toNumber() / 20) * (average ? averageValue! : random!.nextDouble()),
  );
  const bonus = average
    ? 0
    : calculateRemixUpgradeEffect(
        "money",
        "blacksmithBonus",
        input.context.levels.money.blacksmithBonus,
        context,
      ).toNumber();
  const powerRoll = average ? averageValue! : random!.nextDouble();
  const power = calculateRemixUpgradeEffect(
    "money",
    "blacksmith",
    input.context.levels.money.blacksmith,
    context,
  )
    .mul(1 + powerRoll * 1.15)
    .mul(powMultiplier)
    .mul(1 + 0.15 * bonus);
  const qualityRoll = average ? averageValue! : random!.nextDouble();
  let quality = new Decimal(1 + qualityRoll * 0.3)
    .add(qualityBonus)
    .mul(
      calculateRemixUpgradeEffect(
        "money",
        "blacksmithSkill",
        input.context.levels.money.blacksmithSkill,
        context,
      ),
    );

  if (average) {
    return {
      name: "Average Result",
      power,
      quality,
      damage: power.mul(quality),
    };
  }

  for (let roll = 0; roll < 15; roll++) {
    if (random!.nextDouble() < 0.5) quality = quality.mul(1.15);
    else break;
  }

  const name = generateName({
    quality,
    bonus,
    highestMineObjectLevel: input.context.highestMineObjectLevel,
    random: random!,
    mineObjectName:
      input.mode.kind === "random" ? input.mode.mineObjectName : () => "",
  });
  return { name, power, quality, damage: power.mul(quality) };
}

/**
 * Reproduces `functions.craftPick(gems)`, including rounded Gem subtraction,
 * Shift bulk count, insufficient-Gem attempts, duds, strict replacement, and
 * the log-then-save event order. Message formatting remains in the formatting
 * package and platform persistence remains an injected application effect.
 */
export function attemptRemixPickaxeCraft(
  input: RemixPickaxeCraftAttemptInput,
): RemixPickaxeCraftAttemptResult {
  const gemsPerAttempt = new Decimal(input.craftGems);
  const bulkCraftCount = input.shiftHeld
    ? calculateRemixUpgradeEffect(
        "planetCoins",
        "bulkCraft",
        input.context.levels.planetCoins.bulkCraft,
        input.context,
      ).toNumber()
    : 1;
  const events: RemixPickaxeCraftEvent[] = [];
  let gems = new Decimal(input.state.gems);
  let pickaxe = input.state.pickaxe;

  for (let attempt = 0; attempt < bulkCraftCount; attempt++) {
    if (!gems.gte(gemsPerAttempt)) {
      events.push({ type: "insufficient-gems" });
      continue;
    }

    gems = Decimal.round(gems.sub(gemsPerAttempt));
    const candidate = calculateRemixPickaxeCraft({
      gems: gemsPerAttempt,
      context: input.context,
      mode: {
        kind: "random",
        random: input.random,
        mineObjectName: input.mineObjectName,
      },
    });
    const equippedDamage = new Decimal(pickaxe.power).mul(pickaxe.quality);
    if (candidate.damage.gt(equippedDamage)) {
      pickaxe = candidate;
      events.push({ type: "pickaxe-replaced", pickaxe: candidate });
      events.push({ type: "save" });
    } else {
      events.push({ type: "dud", pickaxe: candidate });
    }
  }

  return { state: { gems, pickaxe }, events };
}
