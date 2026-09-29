import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import {
  Decimal,
  createInitialRemixSimulationState,
  type DecimalSource,
  type RemixMineObjectCatalog,
} from "../../packages/core/src/index.js";
import {
  createRemixFormatters,
  formatNumber,
} from "../../packages/formatting/src/index.js";
import {
  createInitialRemixLegacySaveApplicationState,
  encodeRemixLegacySave,
  loadRemixLegacySaveIntoState,
} from "../../packages/persistence/src/index.js";

type DecimalSnapshot = {
  decimal: string;
  mantissa: number;
  exponent: number;
};

type SavedUpgradeGroup = Record<string, { level: number }>;
type LegacySaveInput = Record<string, unknown> & {
  upgrades: SavedUpgradeGroup;
  gemUpgrades: SavedUpgradeGroup;
  planetCoinUpgrades: SavedUpgradeGroup;
  powers: {
    data: { values: string[] };
    upgrades: SavedUpgradeGroup;
  };
};

const corpus = JSON.parse(
  await readFile(
    new URL("../fixtures/parity/remix-reference-corpus.json", import.meta.url),
    "utf8",
  ),
) as {
  metadata: { sourceCommit: string };
  data: {
    mineObjectCatalog: RemixMineObjectCatalog;
    saveOfflineApplicationSemantics: {
      inputJson: string;
      elapsedSeconds: number;
      processedSeconds: number;
      clockReadCount: number;
      dateNowReads: number[];
      stateAfterLoad: {
        money: DecimalSnapshot;
        highestMoney: DecimalSnapshot;
        gems: DecimalSnapshot;
        planetCoins: DecimalSnapshot;
        maxPlanetCoins: DecimalSnapshot;
        lastActive: number;
        mineObjectLevel: number;
        highestMineObjectLevel: number;
        story: {
          page: number;
          notifications: number;
          highestUnlocked: number;
          scrollY: number;
        };
        settings: {
          tab: string;
          numberFormatterIndex: number;
          theme: string;
          showMineObjLevel: boolean;
          showMinCraftDamage: boolean;
        };
        pickaxe: {
          name: string;
          power: DecimalSnapshot;
          quality: DecimalSnapshot;
        };
      };
      events: {
        type: string;
        theme?: string;
        message?: string;
        color?: string;
      }[];
      storageWrites: {
        key: string;
        save: {
          lastActive: number;
          money: DecimalSnapshot;
          highestMoney: DecimalSnapshot;
          gems: DecimalSnapshot;
          planetCoins: DecimalSnapshot;
          maxPlanetCoins: DecimalSnapshot;
          mineObjectLevel: number;
          highestMineObjectLevel: number;
          pickaxe: {
            name: string;
            power: DecimalSnapshot;
            quality: DecimalSnapshot;
          };
          settings: {
            tab: string;
            numberFormatterIndex: number;
            theme: string;
            showMineObjLevel: boolean;
            showMinCraftDamage: boolean;
          };
        };
      }[];
    };
  };
};

function snapshot(value: DecimalSource): DecimalSnapshot {
  const decimal = new Decimal(value);
  return {
    decimal: decimal.toString(),
    mantissa: decimal.mantissa,
    exponent: decimal.exponent,
  };
}

function upgradeLevels(group: SavedUpgradeGroup) {
  return Object.fromEntries(
    Object.entries(group).map(([key, upgrade]) => [key, upgrade.level]),
  );
}

it("loads a Remix save before deriving and applying its offline rewards", () => {
  expect(corpus.metadata.sourceCommit).toBe(
    "0e0f4bf5a9c66e5603cda2ce4bd54213023dae21",
  );
  const expected = corpus.data.saveOfflineApplicationSemantics;
  const save = JSON.parse(expected.inputJson) as LegacySaveInput;
  const initial = createInitialRemixLegacySaveApplicationState(
    createInitialRemixSimulationState(corpus.data.mineObjectCatalog),
  );
  const state = {
    ...initial,
    settings: { ...initial.settings, tab: "settings" },
  };
  const formatter = createRemixFormatters()[3];
  expect(formatter?.name).toBe("Letters");

  let clockReads = 0;
  const result = loadRemixLegacySaveIntoState({
    state,
    saveString: encodeRemixLegacySave(save),
    catalog: corpus.data.mineObjectCatalog,
    clock: {
      now() {
        const value = expected.dateNowReads[clockReads];
        if (value === undefined) {
          throw new Error("The load read the reference clock too many times.");
        }
        clockReads += 1;
        return value;
      },
    },
    resolveNumberFormatter(formatterIndex) {
      expect(formatterIndex).toBe(3);
      if (!formatter) throw new Error("Missing captured Letters formatter.");
      return (value, precision, limit, below1000) =>
        formatNumber(value, formatter, precision, limit, below1000);
    },
  });

  expect(result.status).toBe("loaded");
  if (result.status !== "loaded") {
    throw new Error(`Expected a loaded result; got ${result.status}.`);
  }

  expect(result.elapsedSeconds).toBe(expected.elapsedSeconds);
  expect(result.processedSeconds).toBe(expected.processedSeconds);
  expect(result.applied).toBe(true);
  expect(clockReads).toBe(expected.clockReadCount);
  expect(
    Object.fromEntries(
      Object.entries(result.state.simulation.resources).map(([key, value]) => [
        key,
        snapshot(value),
      ]),
    ),
  ).toMatchObject({
    money: expected.stateAfterLoad.money,
    highestMoney: expected.stateAfterLoad.highestMoney,
    gems: expected.stateAfterLoad.gems,
    planetCoins: expected.stateAfterLoad.planetCoins,
    maxPlanetCoins: expected.stateAfterLoad.maxPlanetCoins,
  });
  expect(result.state.simulation.lastActiveMs).toBe(
    expected.stateAfterLoad.lastActive,
  );
  expect(result.state.simulation.mineObjectLevel).toBe(
    expected.stateAfterLoad.mineObjectLevel,
  );
  expect(result.state.simulation.highestMineObjectLevel).toBe(
    expected.stateAfterLoad.highestMineObjectLevel,
  );
  expect(result.state.simulation.story).toEqual({
    page: expected.stateAfterLoad.story.page,
    notifications: expected.stateAfterLoad.story.notifications,
    highestUnlocked: expected.stateAfterLoad.story.highestUnlocked,
  });
  expect(result.state.storyScrollY).toBe(expected.stateAfterLoad.story.scrollY);
  expect(result.state.settings).toMatchObject({
    ...expected.stateAfterLoad.settings,
  });
  expect(result.state.simulation.upgrades.money).toMatchObject(
    upgradeLevels(save.upgrades),
  );
  expect(result.state.simulation.upgrades.gems).toMatchObject(
    upgradeLevels(save.gemUpgrades),
  );
  expect(result.state.simulation.upgrades.planetCoins).toMatchObject(
    upgradeLevels(save.planetCoinUpgrades),
  );
  expect(result.state.simulation.upgrades.wisdom).toMatchObject(
    upgradeLevels(save.powers.upgrades),
  );
  expect(
    [
      result.state.simulation.powers.mining,
      result.state.simulation.powers.craftsmanship,
      result.state.simulation.powers.expertise,
      result.state.simulation.powers.wisdom,
      result.state.simulation.powers.exquisity,
    ].map((value) => value.toString()),
  ).toEqual(save.powers.data.values);
  expect(snapshot(result.rewards.gems)).toEqual({
    decimal: "7372",
    mantissa: 7.372,
    exponent: 3,
  });
  expect(result.rewards.planetCoins.toString()).toBe("2");
  expect(result.state.simulation.pickaxe).toMatchObject({
    name: expected.stateAfterLoad.pickaxe.name,
  });
  expect(snapshot(result.state.simulation.pickaxe.power)).toEqual(
    expected.stateAfterLoad.pickaxe.power,
  );
  expect(snapshot(result.state.simulation.pickaxe.quality)).toEqual(
    expected.stateAfterLoad.pickaxe.quality,
  );

  expect(result.effects[0]).toEqual({ type: "setTheme", theme: "dark" });
  expect(result.effects[1]).toEqual({
    type: "logMessage",
    message: expected.events[1]?.message,
    color: expected.events[1]?.color,
  });
  expect(result.effects[2]?.type).toBe("save");
  if (result.effects[2]?.type !== "save") {
    throw new Error("Expected an offline save effect after its log message.");
  }
  const expectedStoredSave = expected.storageWrites[0]?.save;
  if (!expectedStoredSave) {
    throw new Error("The offline-load fixture has no persisted save snapshot.");
  }
  expect({
    lastActive: result.effects[2].state.simulation.lastActiveMs,
    money: snapshot(result.effects[2].state.simulation.resources.money),
    highestMoney: snapshot(
      result.effects[2].state.simulation.resources.highestMoney,
    ),
    gems: snapshot(result.effects[2].state.simulation.resources.gems),
    planetCoins: snapshot(
      result.effects[2].state.simulation.resources.planetCoins,
    ),
    maxPlanetCoins: snapshot(
      result.effects[2].state.simulation.resources.maxPlanetCoins,
    ),
    mineObjectLevel: result.effects[2].state.simulation.mineObjectLevel,
    highestMineObjectLevel:
      result.effects[2].state.simulation.highestMineObjectLevel,
    pickaxe: {
      name: result.effects[2].state.simulation.pickaxe.name,
      power: snapshot(result.effects[2].state.simulation.pickaxe.power),
      quality: snapshot(result.effects[2].state.simulation.pickaxe.quality),
    },
    settings: result.effects[2].state.settings,
  }).toMatchObject(expectedStoredSave);
  expect(result.effects).toHaveLength(3);
});

it("loads fields without offline rewards when Remix disables that branch", () => {
  const expected = corpus.data.saveOfflineApplicationSemantics;
  const save = JSON.parse(expected.inputJson) as LegacySaveInput;
  const initial = createInitialRemixLegacySaveApplicationState(
    createInitialRemixSimulationState(corpus.data.mineObjectCatalog),
  );
  let clockReads = 0;
  const result = loadRemixLegacySaveIntoState({
    state: initial,
    saveString: encodeRemixLegacySave(save),
    catalog: corpus.data.mineObjectCatalog,
    clock: {
      now() {
        const value = expected.dateNowReads[clockReads];
        if (value === undefined) {
          throw new Error(
            "The disabled-offline path read the clock too often.",
          );
        }
        clockReads += 1;
        return value;
      },
    },
    resolveNumberFormatter: () => {
      throw new Error("Remix must not format offline rewards when disabled.");
    },
    noOffline: true,
  });

  expect(result.status).toBe("loaded");
  if (result.status !== "loaded") {
    throw new Error(`Expected a loaded result; got ${result.status}.`);
  }
  expect(clockReads).toBe(2);
  expect(result.elapsedSeconds).toBe(expected.elapsedSeconds);
  expect(result.processedSeconds).toBe(0);
  expect(result.applied).toBe(false);
  expect(result.state.simulation.resources.money.toString()).toBe("100");
  expect(result.state.simulation.resources.gems.toString()).toBe("10");
  expect(result.state.simulation.resources.planetCoins.toString()).toBe("5");
  expect(result.state.simulation.lastActiveMs).toBe(
    JSON.parse(expected.inputJson).lastActive,
  );
  expect(result.effects).toEqual([{ type: "setTheme", theme: "dark" }]);
});

it("preserves decode-error effects without reading time or applying a save", () => {
  const initial = createInitialRemixLegacySaveApplicationState(
    createInitialRemixSimulationState(corpus.data.mineObjectCatalog),
  );
  let clockReads = 0;
  const result = loadRemixLegacySaveIntoState({
    state: initial,
    saveString: "%%%",
    catalog: corpus.data.mineObjectCatalog,
    clock: {
      now() {
        clockReads += 1;
        return 1700000000000;
      },
    },
    resolveNumberFormatter: () => {
      throw new Error("A failed decode cannot request a formatter.");
    },
  });

  expect(result.status).toBe("invalidEncoding");
  if (result.status !== "invalidEncoding") {
    throw new Error(`Expected an encoding error; got ${result.status}.`);
  }
  expect(result.effects).toEqual([{ type: "alertDecodeError" }]);
  expect(clockReads).toBe(0);
  expect(initial.simulation.resources.money.toString()).toBe("0");
});
