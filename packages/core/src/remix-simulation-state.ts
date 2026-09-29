import { Decimal } from "./decimal.js";
import {
  getRemixMineObject,
  type RemixMineObjectCatalog,
} from "./mine-objects.js";
import type { RemixMiningActionState } from "./remix-mining-transitions.js";
import {
  REMIX_UPGRADE_KEYS,
  type RemixUpgradeLevels,
} from "./remix-upgrades.js";
import type { RemixStoryProgress } from "./remix-story.js";

export type RemixSimulationState = Omit<
  RemixMiningActionState,
  "upgrades" | "powers" | "pickaxe"
> & {
  upgrades: RemixUpgradeLevels;
  powers: RemixMiningActionState["powers"] & {
    craftsmanship: RemixMiningActionState["powers"]["mining"];
    expertise: RemixMiningActionState["powers"]["mining"];
  };
  pickaxe: RemixMiningActionState["pickaxe"] & { name: string };
  powersUnlocked: boolean;
  usedGemsLevel: number;
  /** Last save/load timestamp supplied by the persistence boundary. */
  lastActiveMs?: number;
  story: RemixStoryProgress & { page: number };
};

function createInitialUpgradeLevels(): RemixUpgradeLevels {
  return Object.fromEntries(
    Object.entries(REMIX_UPGRADE_KEYS).map(([group, keys]) => [
      group,
      Object.fromEntries(keys.map((key) => [key, 0])),
    ]),
  ) as RemixUpgradeLevels;
}

/** Builds the source-observed fresh Remix game state from the pinned catalog. */
export function createInitialRemixSimulationState(
  catalog: RemixMineObjectCatalog,
): RemixSimulationState {
  return {
    mineObjectLevel: 0,
    highestMineObjectLevel: 0,
    currentObject: getRemixMineObject(0, catalog),
    resources: {
      money: new Decimal(0),
      highestMoney: new Decimal(0),
      gems: new Decimal(5),
      planetCoins: new Decimal(0),
      maxPlanetCoins: new Decimal(0),
      wisdom: new Decimal(0),
      maxWisdom: new Decimal(0),
    },
    powers: {
      mining: new Decimal(1),
      craftsmanship: new Decimal(1),
      expertise: new Decimal(1),
      wisdom: new Decimal(1),
      exquisity: new Decimal(1),
    },
    pickaxe: {
      name: "Toy Pickaxe",
      power: new Decimal(20),
      quality: new Decimal(1),
    },
    upgrades: createInitialUpgradeLevels(),
    autoPickaxeTimer: 0,
    saveTimer: 0,
    powersUnlocked: false,
    usedGemsLevel: 0,
    story: { page: 0, highestUnlocked: -1, notifications: 0 },
  };
}
