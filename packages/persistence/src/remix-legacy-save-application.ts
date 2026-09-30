import {
  Decimal,
  getRemixMineObject,
  REMIX_UPGRADE_KEYS,
  type DecimalSource,
  type RemixMineObjectCatalog,
  type RemixSimulationState,
  type RemixUpgradeGroup,
  type RemixUpgradeLevels,
} from "@idle-mine-beyond/core";

type LegacyDecimalValue = DecimalSource | null;

type LegacyUpgradeGroup = Record<string, { level?: number }>;

export interface RemixLegacySaveData {
  [key: string]: unknown;
  money?: LegacyDecimalValue;
  highestMoney?: LegacyDecimalValue;
  gems?: LegacyDecimalValue;
  planetCoins?: LegacyDecimalValue;
  maxPlanetCoins?: LegacyDecimalValue;
  wisdom?: LegacyDecimalValue;
  maxWisdom?: LegacyDecimalValue;
  mineObjectLevel?: number;
  highestMineObjectLevel?: number;
  lastActive?: number;
  story: {
    page?: number;
    notifications?: number;
    highestUnlocked?: number;
    scrollY?: number;
  };
  settings?: {
    tab?: string;
    upgradeTab?: string;
    exportFieldString?: string;
    numberFormatterIndex?: number;
    theme?: string;
    showMineObjLevel?: boolean;
    showMinCraftDamage?: boolean;
  };
  upgrades?: LegacyUpgradeGroup;
  gemUpgrades?: LegacyUpgradeGroup;
  planetCoinUpgrades?: LegacyUpgradeGroup;
  powers?: {
    data?: { values: readonly LegacyDecimalValue[] };
    upgrades?: LegacyUpgradeGroup;
  };
  pickaxe?: {
    name?: string;
    pow?: LegacyDecimalValue;
    quality?: LegacyDecimalValue;
  };
}

export interface RemixLegacySaveSettings {
  tab: string;
  upgradeTab: string;
  exportFieldString: string;
  numberFormatterIndex: number;
  theme: string;
  showMineObjLevel: boolean;
  showMinCraftDamage: boolean;
}

export interface RemixLegacySaveApplicationState {
  simulation: RemixSimulationState;
  storyScrollY: number;
  settings: RemixLegacySaveSettings;
  /** Values beyond the five named Remix powers, retained for save round-trips. */
  powerValueExtras: readonly ReturnType<typeof Decimal.fromValue>[];
}

export interface RemixLegacySaveClock {
  now(): number;
}

export type RemixLegacySaveApplicationEffect = {
  type: "setTheme";
  theme: string;
};

export interface ApplyRemixLegacySaveInput {
  state: RemixLegacySaveApplicationState;
  save: RemixLegacySaveData;
  catalog: RemixMineObjectCatalog;
  clock: RemixLegacySaveClock;
}

export interface ApplyRemixLegacySaveResult {
  state: RemixLegacySaveApplicationState;
  effects: RemixLegacySaveApplicationEffect[];
  /** Eager fallback argument evaluated by the pinned loader even when present. */
  evaluatedLastActiveFallbackMs: number;
}

const POWER_VALUE_KEYS = [
  "mining",
  "craftsmanship",
  "expertise",
  "wisdom",
  "exquisity",
] as const;

function loadValue<T>(value: T | undefined, alternative: T): T {
  return value !== undefined ? value : alternative;
}

/**
 * The pinned loader constructs Decimal before checking for undefined. The
 * constructor therefore supplies its own zero value for omitted fields; the
 * source's apparent per-field fallback is not reached.
 */
function loadDecimal(value: LegacyDecimalValue | undefined) {
  return new Decimal(value as DecimalSource | undefined);
}

function resetUpgradeGroup(group: RemixUpgradeGroup) {
  return Object.fromEntries(
    REMIX_UPGRADE_KEYS[group].map((key) => [key, 0]),
  ) as Record<string, number>;
}

function applyUpgradeGroup(
  group: RemixUpgradeGroup,
  current: Record<string, number>,
  incoming: LegacyUpgradeGroup,
) {
  const next = { ...current };
  const knownKeys = REMIX_UPGRADE_KEYS[group] as readonly string[];

  for (const key of Object.keys(incoming)) {
    if (!knownKeys.includes(key)) {
      throw new TypeError(`Unknown Remix ${group} upgrade: ${key}`);
    }
    next[key] = incoming[key]!.level as number;
  }

  return next;
}

/** Creates the pinned fresh-game settings around an initial simulation state. */
export function createInitialRemixLegacySaveApplicationState(
  simulation: RemixSimulationState,
): RemixLegacySaveApplicationState {
  return {
    simulation,
    storyScrollY: 0,
    settings: {
      tab: "main",
      upgradeTab: "money",
      exportFieldString: "Exported String will appear here...",
      numberFormatterIndex: 0,
      theme: "light",
      showMineObjLevel: false,
      showMinCraftDamage: false,
    },
    powerValueExtras: [],
  };
}

/**
 * Applies the fields that the pinned versionless `loadGame()` reads.
 *
 * Call this only with a decoded object whose required `story` group has been
 * established. It performs no browser I/O: theme changes are returned as an
 * ordered effect, and the caller supplies the clock. The separate offline
 * transition runs after these fields have been applied.
 */
export function applyRemixLegacySaveFields(
  input: ApplyRemixLegacySaveInput,
): ApplyRemixLegacySaveResult {
  const { save } = input;
  const effects: RemixLegacySaveApplicationEffect[] = [];
  let simulation = input.state.simulation;
  const mineObjectLevel = loadValue(save.mineObjectLevel, 0);
  const highestMineObjectLevel = loadValue(save.highestMineObjectLevel, 0);

  simulation = {
    ...simulation,
    resources: {
      money: loadDecimal(save.money),
      highestMoney: loadDecimal(save.highestMoney),
      gems: loadDecimal(save.gems),
      planetCoins: loadDecimal(save.planetCoins),
      maxPlanetCoins: loadDecimal(save.maxPlanetCoins),
      wisdom: loadDecimal(save.wisdom),
      maxWisdom: loadDecimal(save.maxWisdom),
    },
    mineObjectLevel,
    highestMineObjectLevel,
    powersUnlocked: highestMineObjectLevel >= 170,
  };
  simulation = {
    ...simulation,
    currentObject: getRemixMineObject(
      simulation.mineObjectLevel,
      input.catalog,
    ),
  };

  simulation = {
    ...simulation,
    story: {
      ...simulation.story,
      page: loadValue(save.story.page, 0),
      notifications: loadValue(save.story.notifications, 0),
      highestUnlocked: loadValue(save.story.highestUnlocked, -1),
    },
  };
  const storyScrollY = loadValue(save.story.scrollY, 0);

  // Date.now() is evaluated as the fallback argument on every successful
  // load, even when the save already has lastActive.
  const now = input.clock.now();
  simulation = {
    ...simulation,
    lastActiveMs: loadValue(save.lastActive, now),
  };

  let settings = input.state.settings;
  if (save.settings !== undefined) {
    settings = {
      ...settings,
      numberFormatterIndex: loadValue(save.settings.numberFormatterIndex, 0),
      theme: loadValue(save.settings.theme, "light"),
      showMineObjLevel: loadValue(save.settings.showMineObjLevel, false),
      showMinCraftDamage: loadValue(save.settings.showMinCraftDamage, false),
    };
    effects.push({ type: "setTheme", theme: settings.theme });
  }

  const upgrades: RemixUpgradeLevels = {
    ...simulation.upgrades,
    money:
      save.upgrades === undefined
        ? simulation.upgrades.money
        : (applyUpgradeGroup(
            "money",
            simulation.upgrades.money,
            save.upgrades,
          ) as RemixUpgradeLevels["money"]),
    gems:
      save.gemUpgrades === undefined
        ? (resetUpgradeGroup("gems") as RemixUpgradeLevels["gems"])
        : (applyUpgradeGroup(
            "gems",
            simulation.upgrades.gems,
            save.gemUpgrades,
          ) as RemixUpgradeLevels["gems"]),
    planetCoins:
      save.planetCoinUpgrades === undefined
        ? (resetUpgradeGroup(
            "planetCoins",
          ) as RemixUpgradeLevels["planetCoins"])
        : (applyUpgradeGroup(
            "planetCoins",
            simulation.upgrades.planetCoins,
            save.planetCoinUpgrades,
          ) as RemixUpgradeLevels["planetCoins"]),
    wisdom: simulation.upgrades.wisdom,
  };

  let powers = simulation.powers;
  const powerValueExtras = [...input.state.powerValueExtras];
  if (save.powers !== undefined) {
    if (save.powers.data !== undefined) {
      powers = { ...powers };
      for (let index = 0; index < save.powers.data.values.length; index += 1) {
        const key = POWER_VALUE_KEYS[index];
        const value = loadDecimal(save.powers.data.values[index]);
        if (key === undefined) {
          powerValueExtras[index - POWER_VALUE_KEYS.length] = value;
        } else {
          powers[key] = value;
        }
      }
    }

    upgrades.wisdom =
      save.powers.upgrades === undefined
        ? (resetUpgradeGroup("wisdom") as RemixUpgradeLevels["wisdom"])
        : (applyUpgradeGroup(
            "wisdom",
            simulation.upgrades.wisdom,
            save.powers.upgrades,
          ) as RemixUpgradeLevels["wisdom"]);
  }

  if (save.pickaxe !== undefined) {
    simulation = {
      ...simulation,
      pickaxe: {
        name: loadValue(save.pickaxe.name, "Toy Pickaxe"),
        power: loadDecimal(save.pickaxe.pow),
        quality: loadDecimal(save.pickaxe.quality),
      },
    };
  }

  simulation = { ...simulation, powers, upgrades };

  return {
    state: {
      ...input.state,
      simulation,
      storyScrollY,
      settings,
      powerValueExtras,
    },
    effects,
    evaluatedLastActiveFallbackMs: now,
  };
}
