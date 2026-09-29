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
import type { RemixSimulationState } from "./remix-simulation-state.js";

export type RemixSimulationAction =
  { type: "activeClick" } | { type: "idleFrame"; deltaSeconds: number };

export type RemixSimulationEffect = {
  type: "save";
  /** Core state at the source save call, before that frame's Story refresh. */
  state: RemixSimulationState;
};

export type RemixSimulationActionResult = Omit<
  RemixMiningActionResult,
  "state"
> & {
  state: RemixSimulationState;
  effects: RemixSimulationEffect[];
};

/**
 * Composes one player click or animation frame through the platform-independent
 * Remix state boundary. Clock, RNG, content, and persistence remain injected.
 */
export function performRemixSimulationAction(input: {
  state: RemixSimulationState;
  action: RemixSimulationAction;
  catalog: RemixMineObjectCatalog;
  storyMilestones: readonly RemixStoryMilestone[];
  random: RemixMiningRandom;
}): RemixSimulationActionResult {
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

  return { ...mining, state, effects };
}
