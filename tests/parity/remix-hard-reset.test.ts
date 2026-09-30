import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import {
  Decimal,
  createInitialRemixSimulationState,
  createRemixHardResetSimulationState,
  getRemixMineObject,
} from "../../packages/core/src/index.js";

type DecimalSnapshot = { decimal: string; mantissa: number; exponent: number };
type ResetResources = {
  money: DecimalSnapshot;
  highestMoney: DecimalSnapshot;
  gems: DecimalSnapshot;
  planetCoins: DecimalSnapshot;
  maxPlanetCoins: DecimalSnapshot;
  wisdom: DecimalSnapshot;
  maxWisdom: DecimalSnapshot;
};
type ResetSnapshot = {
  resources: ResetResources;
  mineObject: { current: number; highest: number; name: string };
  story: {
    page: number;
    notifications: number;
    highestUnlocked: number;
    scrollY: number;
  };
  settings: {
    tab: string;
    upgradeTab: string;
    exportFieldString: string;
    theme: string;
    numberFormatterIndex: number;
    showMineObjLevel: boolean;
    showMinCraftDamage: boolean;
  };
  upgradeLevels: {
    blacksmith: number;
    gemChance: number;
    offlineTime: number;
    powerResetKeep: number;
  };
  powers: [
    DecimalSnapshot,
    DecimalSnapshot,
    DecimalSnapshot,
    DecimalSnapshot,
    DecimalSnapshot,
  ];
  pickaxe: {
    name: string;
    power: DecimalSnapshot;
    quality: DecimalSnapshot;
    damage: DecimalSnapshot;
  };
  usedGemsLevel: number;
  pickStatus: string;
  messageLog: unknown[];
  lastActive: number;
  timer: { autoPickaxe: number; save: number };
};
type ResetScenario = {
  confirmationPrompts: string[];
  before: ResetSnapshot;
  after: ResetSnapshot;
  storageBefore: [string, string][];
  storageAfter: [string, string][];
};
type HardResetCorpus = {
  data: {
    hardResetSemantics: {
      sourcePaths: string[];
      cancelled: ResetScenario[];
      confirmed: ResetScenario;
      controlledSave: {
        money: string;
        gems: string;
        planetCoins: string;
        wisdom: string;
        mineObjectLevel: number;
        highestMineObjectLevel: number;
        powerValues: string[];
      };
    };
    mineObjectCatalog: Parameters<typeof getRemixMineObject>[1];
  };
};

const corpus = JSON.parse(
  await readFile(
    new URL("../fixtures/parity/remix-reference-corpus.json", import.meta.url),
    "utf8",
  ),
) as HardResetCorpus;

const hardReset = corpus.data.hardResetSemantics;

it("matches all three source Hard Reset confirmation cancellations", () => {
  expect(hardReset.sourcePaths).toEqual([
    "index.html",
    "Scripts/Define/functions.js",
    "Scripts/Define/game.js",
  ]);
  expect(hardReset.cancelled).toHaveLength(3);

  for (const [index, scenario] of hardReset.cancelled.entries()) {
    expect(scenario.confirmationPrompts).toHaveLength(index + 1);
    expect(scenario.confirmationPrompts).toEqual(
      Array.from(
        { length: index + 1 },
        (_, promptIndex) =>
          `Are you sure you want to ENTIRELY reset your savegame? YOu get no reward.Click ${3 - promptIndex} more times to confirm`,
      ),
    );
    expect(scenario.after).toEqual(scenario.before);
    expect(scenario.storageAfter).toEqual(scenario.storageBefore);
  }
});

it("matches the confirmed reset and its preserved legacy state", () => {
  const { confirmed, controlledSave } = hardReset;
  expect(confirmed.confirmationPrompts).toEqual(
    Array.from(
      { length: 3 },
      (_, index) =>
        `Are you sure you want to ENTIRELY reset your savegame? YOu get no reward.Click ${3 - index} more times to confirm`,
    ),
  );
  expect(confirmed.before.resources.money.decimal).toBe(controlledSave.money);
  expect(confirmed.before.mineObject.current).toBe(
    controlledSave.mineObjectLevel,
  );
  expect(confirmed.before.powers.map(({ decimal }) => decimal)).toEqual(
    controlledSave.powerValues,
  );

  expect(confirmed.after.resources).toEqual({
    money: { decimal: "0", mantissa: 0, exponent: 0 },
    highestMoney: { decimal: "0", mantissa: 0, exponent: 0 },
    gems: { decimal: "5", mantissa: 5, exponent: 0 },
    planetCoins: { decimal: "0", mantissa: 0, exponent: 0 },
    maxPlanetCoins: { decimal: "0", mantissa: 0, exponent: 0 },
    wisdom: { decimal: "0", mantissa: 0, exponent: 0 },
    maxWisdom: { decimal: "0", mantissa: 0, exponent: 0 },
  });
  expect(confirmed.after.mineObject).toEqual({
    current: 0,
    highest: 0,
    name: "Mud",
  });
  expect(confirmed.after.powers.map(({ decimal }) => decimal)).toEqual([
    "1",
    "1",
    "1",
    "1",
    "1",
  ]);
  expect(confirmed.after.pickaxe).toEqual({
    name: "Toy Pickaxe",
    power: { decimal: "20", mantissa: 2, exponent: 1 },
    quality: { decimal: "1", mantissa: 1, exponent: 0 },
    damage: { decimal: "20", mantissa: 2, exponent: 1 },
  });
  expect(confirmed.after.story).toEqual({
    page: 0,
    notifications: 0,
    highestUnlocked: -1,
    scrollY: 0,
  });
  expect(confirmed.after.upgradeLevels).toEqual({
    blacksmith: 0,
    gemChance: 0,
    offlineTime: 0,
    powerResetKeep: 0,
  });
  expect(confirmed.after.usedGemsLevel).toBe(0);
  expect(confirmed.after.messageLog).toEqual([]);
  expect(confirmed.storageBefore.map(([key]) => key).sort()).toEqual([
    "IdleMine",
    "unrelated-origin-data",
  ]);
  expect(confirmed.storageAfter).toEqual([]);

  // The pinned reset reloads initialGame but leaves these transient UI/timer
  // fields untouched because loadGame does not assign them.
  expect(confirmed.after.settings.tab).toBe("settings");
  expect(confirmed.after.settings.upgradeTab).toBe("planetcoins");
  expect(confirmed.after.settings.exportFieldString).toBe("old export text");
  expect(confirmed.after.settings.theme).toBe("light");
  expect(confirmed.after.pickStatus).toBe("old pick status");
  expect(confirmed.after.timer).toEqual({ autoPickaxe: 0.25, save: 41 });
  expect(confirmed.after.lastActive).toBe(confirmed.before.lastActive + 10_000);
});

it("matches the core hard-reset state while retaining source loop timers", () => {
  const expected = hardReset.confirmed;
  const before = expected.before;
  const state = createInitialRemixSimulationState(
    corpus.data.mineObjectCatalog,
  );
  state.resources = Object.fromEntries(
    Object.entries(before.resources).map(([key, value]) => [
      key,
      new Decimal(value.decimal),
    ]),
  ) as typeof state.resources;
  state.mineObjectLevel = before.mineObject.current;
  state.highestMineObjectLevel = before.mineObject.highest;
  state.currentObject = getRemixMineObject(
    state.mineObjectLevel,
    corpus.data.mineObjectCatalog,
  );
  state.story = {
    page: before.story.page,
    highestUnlocked: before.story.highestUnlocked,
    notifications: before.story.notifications,
  };
  state.powers = {
    mining: new Decimal(before.powers[0].decimal),
    craftsmanship: new Decimal(before.powers[1].decimal),
    expertise: new Decimal(before.powers[2].decimal),
    wisdom: new Decimal(before.powers[3].decimal),
    exquisity: new Decimal(before.powers[4].decimal),
  };
  state.pickaxe = {
    name: before.pickaxe.name,
    power: new Decimal(before.pickaxe.power.decimal),
    quality: new Decimal(before.pickaxe.quality.decimal),
  };
  state.upgrades.money.blacksmith = before.upgradeLevels.blacksmith;
  state.upgrades.gems.gemChance = before.upgradeLevels.gemChance;
  state.upgrades.planetCoins.offlineTime = before.upgradeLevels.offlineTime;
  state.upgrades.wisdom.powerResetKeep = before.upgradeLevels.powerResetKeep;
  state.autoPickaxeTimer = before.timer.autoPickaxe;
  state.saveTimer = before.timer.save;
  state.usedGemsLevel = before.usedGemsLevel;
  state.powersUnlocked = true;
  state.lastActiveMs = before.lastActive;

  const reset = createRemixHardResetSimulationState(
    state,
    corpus.data.mineObjectCatalog,
    expected.after.lastActive,
  );
  expect(reset.mineObjectLevel).toBe(expected.after.mineObject.current);
  expect(reset.highestMineObjectLevel).toBe(expected.after.mineObject.highest);
  expect(reset.currentObject.name).toBe(expected.after.mineObject.name);
  expect(
    Object.fromEntries(
      Object.entries(reset.resources).map(([key, value]) => [
        key,
        value.toString(),
      ]),
    ),
  ).toEqual(
    Object.fromEntries(
      Object.entries(expected.after.resources).map(([key, value]) => [
        key,
        value.decimal,
      ]),
    ),
  );
  expect(reset.autoPickaxeTimer).toBe(expected.after.timer.autoPickaxe);
  expect(reset.saveTimer).toBe(expected.after.timer.save);
  expect(reset.usedGemsLevel).toBe(expected.after.usedGemsLevel);
  expect(reset.powersUnlocked).toBe(false);
  expect(reset.lastActiveMs).toBe(expected.after.lastActive);
});
