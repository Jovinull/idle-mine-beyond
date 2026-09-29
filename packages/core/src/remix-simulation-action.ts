import type { RemixMineObjectCatalog } from "./mine-objects.js";
import {
  performRemixMiningAction,
  type RemixMiningActionResult,
  type RemixMiningRandom,
} from "./remix-mining-transitions.js";
import {
  refreshRemixStoryNotifications,
  type RemixStoryMilestone,
} from "./remix-story.js";
import {
  executeRemixUpgradePurchase,
  type RemixUpgradePurchaseOperation,
} from "./remix-upgrade-purchases.js";
import type { RemixUpgradeGroup, RemixUpgradeKey } from "./remix-upgrades.js";
import type { RemixSimulationState } from "./remix-simulation-state.js";

export type RemixMiningSimulationAction =
  { type: "activeClick" } | { type: "idleFrame"; deltaSeconds: number };

export type RemixUpgradePurchaseSimulationAction = {
  [Group in RemixUpgradeGroup]: {
    type: "upgradePurchase";
    group: Group;
    key: RemixUpgradeKey<Group>;
    operation: RemixUpgradePurchaseOperation;
  };
}[RemixUpgradeGroup];

export type RemixSimulationAction =
  RemixMiningSimulationAction | RemixUpgradePurchaseSimulationAction;

export type RemixSimulationActionInput =
  | {
      state: RemixSimulationState;
      action: RemixMiningSimulationAction;
      catalog: RemixMineObjectCatalog;
      storyMilestones: readonly RemixStoryMilestone[];
      random: RemixMiningRandom;
    }
  | {
      state: RemixSimulationState;
      action: RemixUpgradePurchaseSimulationAction;
    };

export type RemixSimulationEffect = {
  type: "save";
  /** Core state at the source save call, before that frame's Story refresh. */
  state: RemixSimulationState;
};

export type RemixSimulationActionResult =
  | RemixMiningSimulationActionResult
  | {
      type: "upgradePurchase";
      state: RemixSimulationState;
      purchases: number;
      operationResult: boolean | null;
      effects: [];
    };

function performUpgradePurchase(
  state: RemixSimulationState,
  action: RemixUpgradePurchaseSimulationAction,
): RemixSimulationActionResult {
  const purchase = executeRemixUpgradePurchase({
    state: {
      levels: state.upgrades,
      resources: {
        money: state.resources.money,
        gems: state.resources.gems,
        planetCoins: state.resources.planetCoins,
        wisdom: state.resources.wisdom,
      },
    },
    group: action.group,
    key: action.key,
    operation: action.operation,
  });
  const resourceByGroup = {
    money: "money",
    gems: "gems",
    planetCoins: "planetCoins",
    wisdom: "wisdom",
  } as const;
  const resourceKey = resourceByGroup[action.group];
  const nextState: RemixSimulationState = {
    ...state,
    resources: {
      ...state.resources,
      [resourceKey]: purchase.state.resources[action.group],
    },
    upgrades: {
      ...state.upgrades,
      [action.group]: purchase.state.levels[action.group],
    } as RemixSimulationState["upgrades"],
  };

  return {
    type: "upgradePurchase",
    state: nextState,
    purchases: purchase.purchases,
    operationResult: purchase.operationResult,
    effects: [],
  };
}

export type RemixMiningSimulationActionResult = {
  type: "mining";
  state: RemixSimulationState;
  effects: RemixSimulationEffect[];
} & Omit<RemixMiningActionResult, "state">;

/**
 * Applies one player click, idle frame, or upgrade purchase without platform
 * dependencies. Time, RNG, content, and save behavior stay at explicit edges.
 */
export function performRemixSimulationAction(
  input: RemixSimulationActionInput,
): RemixSimulationActionResult {
  if (!("catalog" in input)) {
    return performUpgradePurchase(input.state, input.action);
  }

  const mining = performRemixMiningAction({
    state: input.state,
    action: input.action.type === "activeClick" ? "activeClick" : "idleTick",
    deltaSeconds:
      input.action.type === "idleFrame" ? input.action.deltaSeconds : 0,
    catalog: input.catalog,
    random: input.random,
  });
  let state: RemixSimulationState = {
    ...input.state,
    ...mining.state,
    pickaxe: input.state.pickaxe,
    powers: { ...input.state.powers, ...mining.state.powers },
    upgrades: input.state.upgrades,
    story: input.state.story,
  };
  const effects: RemixSimulationEffect[] = [];

  if (mining.frameEvents.includes("save")) {
    effects.push({ type: "save", state });
  }

  if (mining.frameEvents.includes("refreshStoryNotifications")) {
    const story = refreshRemixStoryNotifications(
      state.story,
      input.storyMilestones,
      {
        highestMineObjectLevel: state.highestMineObjectLevel,
        highestMoney: state.resources.highestMoney,
        maxPlanetCoins: state.resources.maxPlanetCoins,
        moneyUpgradeLevels: state.upgrades.money,
        wisdomUpgradeLevels: state.upgrades.wisdom,
      },
    );
    state = { ...state, story: { ...state.story, ...story } };
  }

  return { type: "mining", ...mining, state, effects };
}
