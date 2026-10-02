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

export class RemixLegacySaveApplicationError extends Error {
  readonly partialState: RemixLegacySaveApplicationState;
  readonly effects: RemixLegacySaveApplicationEffect[];
  readonly evaluatedLastActiveFallbackMs?: number;

  constructor(input: {
    sourceError: unknown;
    partialState: RemixLegacySaveApplicationState;
    effects: RemixLegacySaveApplicationEffect[];
    evaluatedLastActiveFallbackMs?: number;
  }) {
    super(
      input.sourceError instanceof Error
        ? input.sourceError.message
        : String(input.sourceError),
    );
    this.name =
      input.sourceError instanceof Error ? input.sourceError.name : "Error";
    this.partialState = input.partialState;
    this.effects = input.effects;
    if (input.evaluatedLastActiveFallbackMs !== undefined) {
      this.evaluatedLastActiveFallbackMs = input.evaluatedLastActiveFallbackMs;
    }
    if (input.sourceError instanceof Error && input.sourceError.stack) {
      this.stack = input.sourceError.stack;
    }
  }
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
  let state = input.state;
  let evaluatedLastActiveFallbackMs: number | undefined;
  const commitSimulation = (next: RemixSimulationState) => {
    simulation = next;
    state = { ...state, simulation };
  };
  const commitSettings = (settings: RemixLegacySaveSettings) => {
    state = { ...state, settings };
  };
  const commitUpgradeGroup = (
    group: RemixUpgradeGroup,
    levels: Record<string, number>,
  ) => {
    const upgrades = {
      ...simulation.upgrades,
      [group]: levels,
    } as RemixUpgradeLevels;
    commitSimulation({ ...simulation, upgrades });
  };

  try {
    const resourceFields = [
      "money",
      "highestMoney",
      "gems",
      "planetCoins",
      "maxPlanetCoins",
      "wisdom",
      "maxWisdom",
    ] as const;
    for (const key of resourceFields) {
      const value = loadDecimal(save[key]);
      commitSimulation({
        ...simulation,
        resources: { ...simulation.resources, [key]: value },
      });
    }

    const mineObjectLevel = loadValue(save.mineObjectLevel, 0);
    commitSimulation({ ...simulation, mineObjectLevel });
    const highestMineObjectLevel = loadValue(save.highestMineObjectLevel, 0);
    commitSimulation({
      ...simulation,
      highestMineObjectLevel,
      powersUnlocked: highestMineObjectLevel >= 170,
    });
    commitSimulation({
      ...simulation,
      currentObject: getRemixMineObject(
        simulation.mineObjectLevel,
        input.catalog,
      ),
    });

    const storyPage = loadValue(save.story.page, 0);
    commitSimulation({
      ...simulation,
      story: { ...simulation.story, page: storyPage },
    });
    const storyNotifications = loadValue(save.story.notifications, 0);
    commitSimulation({
      ...simulation,
      story: { ...simulation.story, notifications: storyNotifications },
    });
    const highestUnlocked = loadValue(save.story.highestUnlocked, -1);
    commitSimulation({
      ...simulation,
      story: { ...simulation.story, highestUnlocked },
    });
    state = { ...state, storyScrollY: loadValue(save.story.scrollY, 0) };

    // Date.now() is evaluated as the fallback argument even when present.
    evaluatedLastActiveFallbackMs = input.clock.now();
    commitSimulation({
      ...simulation,
      lastActiveMs: loadValue(save.lastActive, evaluatedLastActiveFallbackMs),
    });

    if (save.settings !== undefined) {
      let settings = state.settings;
      settings = {
        ...settings,
        numberFormatterIndex: loadValue(save.settings.numberFormatterIndex, 0),
      };
      commitSettings(settings);
      settings = {
        ...settings,
        theme: loadValue(save.settings.theme, "light"),
      };
      commitSettings(settings);
      effects.push({ type: "setTheme", theme: settings.theme });
      settings = {
        ...settings,
        showMineObjLevel: loadValue(save.settings.showMineObjLevel, false),
      };
      commitSettings(settings);
      settings = {
        ...settings,
        showMinCraftDamage: loadValue(save.settings.showMinCraftDamage, false),
      };
      commitSettings(settings);
    }

    const applyUpgradeGroup = (
      group: RemixUpgradeGroup,
      incoming: LegacyUpgradeGroup,
    ) => {
      const levels = { ...simulation.upgrades[group] } as Record<
        string,
        number
      >;
      const knownKeys = REMIX_UPGRADE_KEYS[group] as readonly string[];
      for (const key of Object.keys(incoming)) {
        // In the source assignment, the right-hand value is read before the
        // write to an unknown game's upgrade entry throws.
        const level = (incoming as Record<string, { level?: number } | null>)[
          key
        ]!.level;
        if (!knownKeys.includes(key)) {
          throw new TypeError(
            "Cannot set properties of undefined (setting 'level')",
          );
        }
        levels[key] = level as number;
        commitUpgradeGroup(group, levels);
      }
    };

    if (save.upgrades !== undefined) {
      applyUpgradeGroup("money", save.upgrades);
    }
    if (save.gemUpgrades !== undefined) {
      applyUpgradeGroup("gems", save.gemUpgrades);
    } else {
      commitUpgradeGroup(
        "gems",
        resetUpgradeGroup("gems") as RemixUpgradeLevels["gems"],
      );
    }
    if (save.planetCoinUpgrades !== undefined) {
      applyUpgradeGroup("planetCoins", save.planetCoinUpgrades);
    } else {
      commitUpgradeGroup(
        "planetCoins",
        resetUpgradeGroup("planetCoins") as RemixUpgradeLevels["planetCoins"],
      );
    }

    if (save.powers !== undefined) {
      if (save.powers.data !== undefined) {
        for (
          let index = 0;
          index < save.powers.data.values.length;
          index += 1
        ) {
          const key = POWER_VALUE_KEYS[index];
          const value = loadDecimal(save.powers.data.values[index]);
          if (key === undefined) {
            const powerValueExtras = [...state.powerValueExtras];
            powerValueExtras[index - POWER_VALUE_KEYS.length] = value;
            state = { ...state, powerValueExtras };
          } else {
            commitSimulation({
              ...simulation,
              powers: { ...simulation.powers, [key]: value },
            });
          }
        }
      }
      if (save.powers.upgrades !== undefined) {
        applyUpgradeGroup("wisdom", save.powers.upgrades);
      } else {
        commitUpgradeGroup(
          "wisdom",
          resetUpgradeGroup("wisdom") as RemixUpgradeLevels["wisdom"],
        );
      }
    }

    if (save.pickaxe !== undefined) {
      let pickaxe = simulation.pickaxe;
      pickaxe = {
        ...pickaxe,
        name: loadValue(save.pickaxe.name, "Toy Pickaxe"),
      };
      commitSimulation({ ...simulation, pickaxe });
      pickaxe = { ...pickaxe, power: loadDecimal(save.pickaxe.pow) };
      commitSimulation({ ...simulation, pickaxe });
      pickaxe = { ...pickaxe, quality: loadDecimal(save.pickaxe.quality) };
      commitSimulation({ ...simulation, pickaxe });
    }

    return {
      state,
      effects,
      evaluatedLastActiveFallbackMs:
        evaluatedLastActiveFallbackMs ?? Number.NaN,
    };
  } catch (sourceError) {
    throw new RemixLegacySaveApplicationError({
      sourceError,
      partialState: state,
      effects,
      ...(evaluatedLastActiveFallbackMs === undefined
        ? {}
        : { evaluatedLastActiveFallbackMs }),
    });
  }
}
