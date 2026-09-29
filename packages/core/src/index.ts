export { Decimal } from "./decimal.js";
export type { DecimalSource } from "./decimal.js";
export { generateRemixMineObject, getRemixMineObject } from "./mine-objects.js";
export type {
  MineObject,
  NormalizedDecimal,
  RemixMineObjectCatalog,
  RemixMineObjectDefinition,
} from "./mine-objects.js";
export {
  calculateRemixActiveDamage,
  calculateRemixIdleDamage,
  calculateRemixIdleDps,
  calculateRemixMiningRates,
  calculateRemixPickaxeDamage,
} from "./mining-rates.js";
export type {
  RemixMiningFactors,
  RemixMiningInput,
  RemixMiningRates,
} from "./mining-rates.js";
export {
  advanceRemixAutoPickaxeTimer,
  advanceRemixSaveTimer,
  applyRemixMiningHit,
  calculateRemixHighestDamageableMineObjectLevel,
  performRemixMiningAction,
  resolveRemixMiningInput,
} from "./remix-mining-transitions.js";
export type {
  RemixMiningAction,
  RemixMiningActionResult,
  RemixMiningActionState,
  RemixMiningFrameEvent,
  RemixMiningHitEffects,
  RemixMiningHitResult,
  RemixMiningRandom,
  RemixResolvedMiningInput,
  RemixMiningTransitionResources,
  RemixMiningTransitionState,
} from "./remix-mining-transitions.js";
export {
  calculateRemixMiningFactors,
  calculateRemixMiningPowerGainMultiplier,
} from "./remix-mining-upgrades.js";
export type {
  RemixMiningPowerGainAction,
  RemixMiningUpgradeInput,
  RemixMiningUpgradeLevels,
} from "./remix-mining-upgrades.js";
export {
  decreaseRemixStoryPage,
  formatRemixStoryObjectiveText,
  getNextRemixStoryObjectiveText,
  getNextRemixStoryMilestone,
  getRemixStoryDisplayedMilestones,
  getRemixStoryMaximumPage,
  increaseRemixStoryPage,
  isRemixStoryMilestoneUnlocked,
  refreshRemixStoryNotifications,
} from "./remix-story.js";
export type {
  RemixStoryCondition,
  RemixStoryConditionState,
  RemixStoryMilestone,
  RemixStoryObjective,
  RemixStoryObjectiveFormatters,
  RemixStoryProgress,
} from "./remix-story.js";
export {
  attemptRemixPayUSDebt,
  getRemixPayUSDebtButtonLabel,
} from "./remix-story-interactions.js";
export type {
  RemixStoryInteractionEffect,
  RemixStoryThousandsFormatter,
} from "./remix-story-interactions.js";
export { transitionRemixStoryTab } from "./remix-story-tabs.js";
export type {
  RemixStoryTabEffect,
  RemixStoryTabInput,
  RemixStoryTabState,
  RemixStoryTabTransition,
} from "./remix-story-tabs.js";
export {
  calculateRemixOfflineCapSeconds,
  formatRemixOfflineRewardMessage,
  processRemixOfflineProgress,
  REMIX_OFFLINE_DEFAULT_HOURS,
  REMIX_OFFLINE_MESSAGE_COLOR,
  REMIX_OFFLINE_MONEY_MULTIPLIER,
  REMIX_OFFLINE_THRESHOLD_SECONDS,
} from "./remix-offline-progression.js";
export type {
  RemixOfflineClock,
  RemixOfflineEffect,
  RemixOfflineNumberFormatter,
  RemixOfflineRates,
  RemixOfflineResult,
  RemixOfflineRewards,
  RemixOfflineState,
} from "./remix-offline-progression.js";
export {
  calculateRemixUpgradeEffect,
  calculateRemixUpgradePrice,
  getRemixUpgradeMaxLevel,
  REMIX_UPGRADE_KEYS,
} from "./remix-upgrades.js";
export type {
  RemixUpgradeContext,
  RemixUpgradeGroup,
  RemixUpgradeKey,
  RemixUpgradeLevels,
  RemixUpgradeRandom,
} from "./remix-upgrades.js";
export { executeRemixUpgradePurchase } from "./remix-upgrade-purchases.js";
export type {
  RemixUpgradePurchaseOperation,
  RemixUpgradePurchaseResult,
  RemixUpgradePurchaseState,
  RemixUpgradeResources,
} from "./remix-upgrade-purchases.js";
export {
  attemptRemixPickaxeCraft,
  calculateRemixPickaxeCraft,
} from "./remix-pickaxe-crafting.js";
export type {
  RemixEquippedPickaxe,
  RemixPickaxe,
  RemixPickaxeCraftAttemptInput,
  RemixPickaxeCraftAttemptResult,
  RemixPickaxeCraftEvent,
  RemixPickaxeCraftInput,
  RemixPickaxeCraftMode,
} from "./remix-pickaxe-crafting.js";
export { createInitialRemixSimulationState } from "./remix-simulation-state.js";
export type { RemixSimulationState } from "./remix-simulation-state.js";
export { performRemixSimulationAction } from "./remix-simulation-action.js";
export type {
  RemixSimulationAction,
  RemixSimulationActionInput,
  RemixSimulationActionResult,
  RemixMiningSimulationAction,
  RemixMiningSimulationActionResult,
  RemixSimulationEffect,
  RemixPickaxeCraftSimulationAction,
  RemixOfflineLoadSimulationAction,
  RemixUpgradePurchaseSimulationAction,
} from "./remix-simulation-action.js";
export { RemixRandom } from "./remix-random.js";
