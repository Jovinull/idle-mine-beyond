import { Decimal } from "./decimal.js";
import type { RemixSimulationState } from "./remix-simulation-state.js";
import { calculateRemixUpgradeEffect } from "./remix-upgrades.js";

export type RemixCraftGemSelectionDirection = "decrease" | "increase";

export type RemixCraftGemSelectionControls = {
  readonly visible: boolean;
  readonly level: number;
  readonly maximumLevel: number;
  readonly gemCost: Decimal;
  readonly decreaseDisabled: boolean;
  readonly showDecreaseIcon: boolean;
  readonly increaseDisabled: boolean;
  readonly showIncreaseIcon: boolean;
};

/** Describes the source-rendered Gem Waster craft controls for the current state. */
export function getRemixCraftGemSelectionControls(
  state: RemixSimulationState,
): RemixCraftGemSelectionControls {
  const baseLevel = state.upgrades.money.gemWaster;
  const maximumLevel = baseLevel + state.upgrades.gems.gemWaster;
  const context = {
    levels: state.upgrades,
    powers: {
      craftsmanship: state.powers.craftsmanship,
      expertise: state.powers.expertise,
      exquisity: state.powers.exquisity,
    },
    highestMineObjectLevel: state.highestMineObjectLevel,
  };

  return {
    visible: baseLevel > 0,
    level: state.usedGemsLevel,
    maximumLevel,
    gemCost: calculateRemixUpgradeEffect(
      "money",
      "gemWaster",
      state.usedGemsLevel,
      context,
    ),
    decreaseDisabled: state.usedGemsLevel === 0,
    showDecreaseIcon: state.usedGemsLevel > 0,
    increaseDisabled: state.usedGemsLevel === maximumLevel,
    showIncreaseIcon: state.usedGemsLevel < maximumLevel,
  };
}

/** Applies a click only when its corresponding source button is enabled. */
export function changeRemixCraftGemSelection(
  state: RemixSimulationState,
  direction: RemixCraftGemSelectionDirection,
): RemixSimulationState {
  const controls = getRemixCraftGemSelectionControls(state);
  if (!controls.visible) return state;
  if (direction === "decrease" && controls.decreaseDisabled) return state;
  if (direction === "increase" && controls.increaseDisabled) return state;

  return {
    ...state,
    usedGemsLevel: state.usedGemsLevel + (direction === "increase" ? 1 : -1),
  };
}
