import { Decimal, type DecimalSource } from "./decimal.js";
import {
  calculateRemixUpgradePrice,
  getRemixUpgradeMaxLevel,
  type RemixUpgradeGroup,
  type RemixUpgradeKey,
  type RemixUpgradeLevels,
} from "./remix-upgrades.js";

export type RemixUpgradeResources = Record<RemixUpgradeGroup, DecimalSource>;

export type RemixUpgradePurchaseState = {
  levels: RemixUpgradeLevels;
  resources: RemixUpgradeResources;
};

export type RemixUpgradePurchaseOperation =
  | { method: "buy"; round?: boolean }
  | {
      method: "buyN";
      count: number;
      align?: boolean;
      round?: boolean;
    }
  | { method: "buy10"; round?: boolean }
  | { method: "buy100"; round?: boolean };

export type RemixUpgradePurchaseResult = {
  state: RemixUpgradePurchaseState;
  purchases: number;
  /** `buy` returns a boolean; Remix bulk-buy methods return no value. */
  operationResult: boolean | null;
};

type SinglePurchaseResult = {
  state: RemixUpgradePurchaseState;
  purchased: boolean;
};

function attemptPurchase<Group extends RemixUpgradeGroup>(
  state: RemixUpgradePurchaseState,
  group: Group,
  key: RemixUpgradeKey<Group>,
  round: boolean,
): SinglePurchaseResult {
  const level = state.levels[group][key];
  const price = calculateRemixUpgradePrice(group, key, level);
  const resource = new Decimal(state.resources[group]);
  const canAfford = round
    ? price.round().lte(resource.round())
    : price.lte(resource);

  if (!(level < getRemixUpgradeMaxLevel(group, key) && canAfford)) {
    return { state, purchased: false };
  }

  const subtractionPrice = round
    ? calculateRemixUpgradePrice(group, key, level).round()
    : calculateRemixUpgradePrice(group, key, level);
  let remainingResource = resource.sub(subtractionPrice);
  if (Number.isNaN(remainingResource.toNumber())) {
    remainingResource = new Decimal(0);
  }

  return {
    state: {
      levels: {
        ...state.levels,
        [group]: {
          ...state.levels[group],
          [key]: level + 1,
        },
      } as RemixUpgradeLevels,
      resources: {
        ...state.resources,
        [group]: remainingResource,
      },
    },
    purchased: true,
  };
}

/**
 * Applies one pinned Remix upgrade purchase or one of its bulk-buy operations.
 * Canonical upgrades have no custom `onBuy` hooks, so the base resource and
 * level transition is the complete player-visible source behavior here.
 */
export function executeRemixUpgradePurchase<
  Group extends RemixUpgradeGroup,
>(input: {
  state: RemixUpgradePurchaseState;
  group: Group;
  key: RemixUpgradeKey<Group>;
  operation: RemixUpgradePurchaseOperation;
}): RemixUpgradePurchaseResult {
  const { state, group, key, operation } = input;
  if (operation.method === "buy") {
    const result = attemptPurchase(state, group, key, operation.round ?? false);
    return {
      state: result.state,
      purchases: result.purchased ? 1 : 0,
      operationResult: result.purchased,
    };
  }

  const count =
    operation.method === "buyN"
      ? operation.count
      : operation.method === "buy10"
        ? 10
        : 100;
  const round = operation.round ?? false;
  const alignToMultiple =
    operation.method === "buyN" ? operation.align !== false : true;

  if (Number.isNaN(count) || count <= 0) {
    return { state, purchases: 0, operationResult: null };
  }
  if (!Number.isFinite(count)) {
    throw new RangeError("Remix bulk-buy count must be finite.");
  }

  let nextState = state;
  let remaining = count;
  let purchases = 0;
  while (remaining > 0) {
    const result = attemptPurchase(nextState, group, key, round);
    if (!result.purchased) break;

    nextState = result.state;
    purchases++;
    const level = nextState.levels[group][key];
    if (alignToMultiple && level % count === 0) break;
    remaining--;
  }

  return { state: nextState, purchases, operationResult: null };
}
