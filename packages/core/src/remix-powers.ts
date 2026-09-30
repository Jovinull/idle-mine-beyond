import { Decimal, type DecimalSource } from "./decimal.js";
import type { RemixSimulationState } from "./remix-simulation-state.js";
import { calculateRemixUpgradeEffect } from "./remix-upgrades.js";

export type RemixPowerPrestigeIndex = 0 | 1 | 2 | 3;

export interface RemixPowerPrestigeRow {
  readonly index: number;
  readonly currentValue: Decimal;
  readonly nextValue: Decimal | null;
  readonly prestigeEffect: Decimal | null;
  readonly buttonVisible: boolean;
  readonly buttonDisabled: boolean;
}

function powerValues(
  state: RemixSimulationState,
  extras: readonly DecimalSource[],
): Decimal[] {
  return [
    state.powers.mining,
    state.powers.craftsmanship,
    state.powers.expertise,
    state.powers.wisdom,
    state.powers.exquisity,
    ...extras,
  ].map((value) => new Decimal(value));
}

/** Mirrors `game.powers.unlocked()` from the pinned source. */
export function isRemixPowersUnlocked(highestMineObjectLevel: number): boolean {
  return highestMineObjectLevel >= 170;
}

/** Calculates one source `powers-table` prestige target. */
export function calculateRemixPowerPrestigeEffect(
  value: DecimalSource,
  index: RemixPowerPrestigeIndex,
): Decimal {
  let effect = Decimal.max(
    new Decimal(value).div(1e3).pow(0.5 - index * 0.1),
    1,
  );
  if (index === 3) {
    effect = new Decimal(Decimal.log10(effect) + 1);
  }
  return effect;
}

/** Returns the button and requirement state rendered for each source table row. */
export function getRemixPowerPrestigeRows(
  state: RemixSimulationState,
  extras: readonly DecimalSource[] = [],
): RemixPowerPrestigeRow[] {
  const values = powerValues(state, extras);
  return values.map((currentValue, index) => {
    if (index > 3) {
      return {
        index,
        currentValue,
        nextValue: null,
        prestigeEffect: null,
        buttonVisible: false,
        buttonDisabled: false,
      };
    }

    const nextValue = values[index + 1];
    if (nextValue === undefined) {
      throw new Error(`Remix power row ${index} has no next value.`);
    }
    const prestigeEffect = calculateRemixPowerPrestigeEffect(
      currentValue,
      index as RemixPowerPrestigeIndex,
    );
    const buttonVisible =
      currentValue.gte(1e3) || (index < values.length - 1 && nextValue.gt(1));
    return {
      index,
      currentValue,
      nextValue,
      prestigeEffect,
      buttonVisible,
      buttonDisabled: buttonVisible && nextValue.gte(prestigeEffect),
    };
  });
}

/** Applies the source prestige action without persistence or other effects. */
export function performRemixPowerPrestige(
  state: RemixSimulationState,
  index: RemixPowerPrestigeIndex,
): { state: RemixSimulationState; changed: boolean } {
  const values = powerValues(state, []);
  const currentValue = values[index]!;
  const nextValue = values[index + 1]!;
  const prestigeEffect = calculateRemixPowerPrestigeEffect(currentValue, index);
  if (!nextValue.lt(prestigeEffect)) return { state, changed: false };

  const retainExponent = calculateRemixUpgradeEffect(
    "wisdom",
    "powerResetKeep",
    state.upgrades.wisdom.powerResetKeep,
    {
      levels: state.upgrades,
      powers: {
        craftsmanship: state.powers.craftsmanship,
        expertise: state.powers.expertise,
        exquisity: state.powers.exquisity,
      },
      highestMineObjectLevel: state.highestMineObjectLevel,
    },
  );
  values[index + 1] = prestigeEffect;
  values[index] = currentValue.pow(retainExponent);
  return {
    state: {
      ...state,
      powers: {
        ...state.powers,
        mining: values[0]!,
        craftsmanship: values[1]!,
        expertise: values[2]!,
        wisdom: values[3]!,
        exquisity: values[4]!,
      },
    },
    changed: true,
  };
}
