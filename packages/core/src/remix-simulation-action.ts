import {
  generateRemixMineObject,
  type RemixMineObjectCatalog,
} from "./mine-objects.js";
import { Decimal } from "./decimal.js";
import {
  performRemixMiningAction,
  resolveRemixMiningInput,
  type RemixMiningActionResult,
  type RemixMiningRandom,
} from "./remix-mining-transitions.js";
import { calculateRemixMiningRates } from "./mining-rates.js";
import {
  refreshRemixStoryNotifications,
  type RemixStoryMilestone,
} from "./remix-story.js";
import {
  attemptRemixPickaxeCraft,
  type RemixPickaxeCraftEvent,
} from "./remix-pickaxe-crafting.js";
import {
  calculateRemixOfflineCapSeconds,
  processRemixOfflineProgress,
  type RemixOfflineClock,
  type RemixOfflineNumberFormatter,
  type RemixOfflineRewards,
} from "./remix-offline-progression.js";
import {
  executeRemixUpgradePurchase,
  type RemixUpgradePurchaseOperation,
} from "./remix-upgrade-purchases.js";
import {
  calculateRemixUpgradeEffect,
  type RemixUpgradeContext,
  type RemixUpgradeGroup,
  type RemixUpgradeKey,
} from "./remix-upgrades.js";
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

export type RemixPickaxeCraftSimulationAction = {
  type: "craftPickaxe";
  shiftHeld: boolean;
};

export type RemixOfflineLoadSimulationAction = {
  type: "offlineLoad";
  /** Mirrors `loadGame`'s third argument. Omitted means offline rewards apply. */
  noOffline?: boolean;
  /**
   * Reuses the eager `lastActive` fallback read from the preceding save load.
   * Standalone offline actions omit it and read their own fallback from clock.
   */
  evaluatedLastActiveFallbackMs?: number;
};

export type RemixSimulationAction =
  | RemixMiningSimulationAction
  | RemixUpgradePurchaseSimulationAction
  | RemixPickaxeCraftSimulationAction
  | RemixOfflineLoadSimulationAction;

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
    }
  | {
      state: RemixSimulationState;
      action: RemixPickaxeCraftSimulationAction;
      catalog: RemixMineObjectCatalog;
      random: RemixMiningRandom;
    }
  | {
      state: RemixSimulationState;
      action: RemixOfflineLoadSimulationAction;
      catalog: RemixMineObjectCatalog;
      clock: RemixOfflineClock;
      formatNumber: RemixOfflineNumberFormatter;
    };

export type RemixSimulationEffect =
  | {
      type: "save";
      /** Full core state at the source save call. */
      state: RemixSimulationState;
    }
  | { type: "logMessage"; message: string; color: string };

export type RemixSimulationActionResult =
  | RemixMiningSimulationActionResult
  | {
      type: "upgradePurchase";
      state: RemixSimulationState;
      purchases: number;
      operationResult: boolean | null;
      effects: [];
    }
  | {
      type: "craftPickaxe";
      state: RemixSimulationState;
      events: RemixPickaxeCraftEvent[];
      effects: RemixSimulationEffect[];
    }
  | {
      type: "offlineLoad";
      state: RemixSimulationState;
      elapsedSeconds: number;
      processedSeconds: number;
      applied: boolean;
      rewards: RemixOfflineRewards;
      effects: RemixSimulationEffect[];
    };

function createUpgradeContext(
  state: RemixSimulationState,
): RemixUpgradeContext {
  return {
    levels: state.upgrades,
    powers: {
      craftsmanship: state.powers.craftsmanship,
      expertise: state.powers.expertise,
      exquisity: state.powers.exquisity,
    },
    highestMineObjectLevel: state.highestMineObjectLevel,
  };
}

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

function performPickaxeCraft(
  state: RemixSimulationState,
  action: RemixPickaxeCraftSimulationAction,
  catalog: RemixMineObjectCatalog,
  random: RemixMiningRandom,
): RemixSimulationActionResult {
  const context = createUpgradeContext(state);
  const craft = attemptRemixPickaxeCraft({
    state: {
      gems: state.resources.gems,
      pickaxe: state.pickaxe,
    },
    craftGems: calculateRemixUpgradeEffect(
      "money",
      "gemWaster",
      state.usedGemsLevel,
      context,
    ),
    shiftHeld: action.shiftHeld,
    context,
    random,
    mineObjectName(level) {
      const baseObject = catalog.base[level];
      return baseObject
        ? baseObject.name
        : generateRemixMineObject(level, catalog).name;
    },
  });
  const makePickaxe = (pickaxe: {
    name: string;
    power: Decimal | number | string;
    quality: Decimal | number | string;
  }): RemixSimulationState["pickaxe"] => ({
    name: pickaxe.name,
    power: new Decimal(pickaxe.power),
    quality: new Decimal(pickaxe.quality),
  });
  const nextState: RemixSimulationState = {
    ...state,
    resources: { ...state.resources, gems: craft.state.gems },
    pickaxe: makePickaxe(craft.state.pickaxe),
  };
  const effects = craft.saveSnapshots.map((snapshot) => ({
    type: "save" as const,
    state: {
      ...state,
      resources: { ...state.resources, gems: snapshot.gems },
      pickaxe: makePickaxe(snapshot.pickaxe),
    },
  }));

  return {
    type: "craftPickaxe",
    state: nextState,
    events: craft.events,
    effects,
  };
}

function performOfflineLoad(
  state: RemixSimulationState,
  action: RemixOfflineLoadSimulationAction,
  input: Extract<RemixSimulationActionInput, { clock: RemixOfflineClock }>,
): RemixSimulationActionResult {
  const context = createUpgradeContext(state);
  const offline = processRemixOfflineProgress({
    state: {
      money: state.resources.money,
      highestMoney: state.resources.highestMoney,
      gems: state.resources.gems,
      planetCoins: state.resources.planetCoins,
      maxPlanetCoins: state.resources.maxPlanetCoins,
      ...(state.lastActiveMs === undefined
        ? {}
        : { lastActiveMs: state.lastActiveMs }),
    },
    clock: input.clock,
    ...(action.evaluatedLastActiveFallbackMs === undefined
      ? {}
      : {
          evaluatedLastActiveFallbackMs: action.evaluatedLastActiveFallbackMs,
        }),
    noOffline: action.noOffline ?? false,
    maxOfflineSeconds: calculateRemixOfflineCapSeconds(
      calculateRemixUpgradeEffect(
        "planetCoins",
        "offlineTime",
        state.upgrades.planetCoins.offlineTime,
        context,
      ),
    ),
    resolveRates: () => {
      const rates = calculateRemixMiningRates(
        resolveRemixMiningInput({ state, catalog: input.catalog }).mining,
      );
      return {
        moneyPerSecond: rates.moneyPerSecond,
        gemsPerSecond: rates.gemsPerSecond,
        planetCoinsPerSecond: rates.planetCoinsPerSecond,
      };
    },
    offlineGemsMultiplier: calculateRemixUpgradeEffect(
      "gems",
      "offlineGems",
      state.upgrades.gems.offlineGems,
      context,
    ),
    offlinePlanetCoinsMultiplier: calculateRemixUpgradeEffect(
      "planetCoins",
      "offlinePC",
      state.upgrades.planetCoins.offlinePC,
      context,
    ),
    formatNumber: input.formatNumber,
  });
  const nextState: RemixSimulationState = {
    ...state,
    lastActiveMs: offline.state.lastActiveMs,
    resources: {
      ...state.resources,
      money: offline.state.money,
      highestMoney: offline.state.highestMoney,
      gems: offline.state.gems,
      planetCoins: offline.state.planetCoins,
      maxPlanetCoins: offline.state.maxPlanetCoins,
    },
  };
  const effects: RemixSimulationEffect[] = offline.effects.map((effect) =>
    effect.type === "logMessage" ? effect : { type: "save", state: nextState },
  );

  return {
    type: "offlineLoad",
    state: nextState,
    elapsedSeconds: offline.elapsedSeconds,
    processedSeconds: offline.processedSeconds,
    applied: offline.applied,
    rewards: offline.rewards,
    effects,
  };
}

export type RemixMiningSimulationActionResult = {
  type: "mining";
  state: RemixSimulationState;
  effects: RemixSimulationEffect[];
} & Omit<RemixMiningActionResult, "state">;

/**
 * Applies one player click, idle frame, upgrade purchase, pickaxe craft, or
 * offline-load transition without platform dependencies. Time, RNG, content,
 * formatting, and save behavior stay at explicit edges.
 */
export function performRemixSimulationAction(
  input: RemixSimulationActionInput,
): RemixSimulationActionResult {
  if ("storyMilestones" in input) {
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

  if ("clock" in input) {
    return performOfflineLoad(input.state, input.action, input);
  }

  if ("catalog" in input) {
    return performPickaxeCraft(
      input.state,
      input.action,
      input.catalog,
      input.random,
    );
  }

  return performUpgradePurchase(input.state, input.action);
}
