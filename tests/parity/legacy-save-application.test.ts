import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import {
  Decimal,
  createInitialRemixSimulationState,
  type RemixMineObjectCatalog,
} from "../../packages/core/src/index.js";
import {
  applyRemixLegacySaveFields,
  createInitialRemixLegacySaveApplicationState,
  type RemixLegacySaveApplicationState,
  type RemixLegacySaveData,
} from "../../packages/persistence/src/index.js";

const corpus = JSON.parse(
  await readFile(
    new URL("../fixtures/parity/remix-reference-corpus.json", import.meta.url),
    "utf8",
  ),
) as {
  metadata: { sourceCommit: string };
  data: {
    mineObjectCatalog: RemixMineObjectCatalog;
    saveSemantics: {
      missingOptionalGroups: { inputJson: string };
      emptyPresentGroups: { inputJson: string };
    };
    saveApplicationSemantics: {
      inputJson: string;
      resources: Record<string, { decimal: string }>;
      mineObjectLevel: number;
      highestMineObjectLevel: number;
      currentObject: {
        name: string;
        hp: { decimal: string };
        totalHp: { decimal: string };
        defense: { decimal: string };
      };
      lastActive: number;
      story: {
        page: number;
        notifications: number;
        highestUnlocked: number;
        scrollY: number;
      };
      settings: {
        tab: string;
        formatterIndex: number;
        theme: string;
        showMineObjLevel: boolean;
        showMinCraftDamage: boolean;
      };
      upgradeLevels: Record<string, number>;
      powers: { decimal: string }[];
      pickaxe: {
        name: string;
        power: { decimal: string };
        quality: { decimal: string };
      };
    };
  };
};

function seedApplicationState(): RemixLegacySaveApplicationState {
  const initial = createInitialRemixLegacySaveApplicationState(
    createInitialRemixSimulationState(corpus.data.mineObjectCatalog),
  );
  const simulation = initial.simulation;

  return {
    ...initial,
    simulation: {
      ...simulation,
      resources: {
        money: new Decimal(77),
        highestMoney: new Decimal(78),
        gems: new Decimal(79),
        planetCoins: new Decimal(80),
        maxPlanetCoins: new Decimal(81),
        wisdom: new Decimal(82),
        maxWisdom: new Decimal(83),
      },
      upgrades: {
        money: { ...simulation.upgrades.money, idleSpeed: 7 },
        gems: { ...simulation.upgrades.gems, offlineGems: 8 },
        planetCoins: { ...simulation.upgrades.planetCoins, offlinePC: 9 },
        wisdom: {
          ...simulation.upgrades.wisdom,
          powerPowerActive: 6,
        },
      },
      powers: { ...simulation.powers, mining: new Decimal(9) },
      pickaxe: {
        name: "Probe Pickaxe",
        power: new Decimal(123),
        quality: new Decimal(4),
      },
      lastActiveMs: 44,
      autoPickaxeTimer: 12,
      saveTimer: 34,
      usedGemsLevel: 2,
    },
    settings: {
      ...initial.settings,
      tab: "settings",
      upgradeTab: "wisdom",
      theme: "dark",
      exportFieldString: "retained input",
    },
  };
}

function decimalValues(state: RemixLegacySaveApplicationState) {
  return Object.fromEntries(
    Object.entries(state.simulation.resources).map(([key, value]) => [
      key,
      value.toString(),
    ]),
  );
}

it("applies all captured fields from a complete current Remix save", () => {
  expect(corpus.metadata.sourceCommit).toBe(
    "0e0f4bf5a9c66e5603cda2ce4bd54213023dae21",
  );
  const expected = corpus.data.saveApplicationSemantics;
  const original = seedApplicationState();
  let clockCalls = 0;
  const result = applyRemixLegacySaveFields({
    state: original,
    save: JSON.parse(expected.inputJson) as RemixLegacySaveData,
    catalog: corpus.data.mineObjectCatalog,
    clock: {
      now: () => {
        clockCalls += 1;
        return 1900000000000;
      },
    },
  });
  const { simulation } = result.state;

  expect(decimalValues(result.state)).toEqual(
    Object.fromEntries(
      Object.entries(expected.resources).map(([key, value]) => [
        key,
        value.decimal,
      ]),
    ),
  );
  expect({
    mineObjectLevel: simulation.mineObjectLevel,
    highestMineObjectLevel: simulation.highestMineObjectLevel,
    currentObject: {
      name: simulation.currentObject.name,
      hp: simulation.currentObject.hp.toString(),
      totalHp: simulation.currentObject.totalHp.toString(),
      defense: simulation.currentObject.defense.toString(),
    },
  }).toEqual({
    mineObjectLevel: expected.mineObjectLevel,
    highestMineObjectLevel: expected.highestMineObjectLevel,
    currentObject: {
      name: expected.currentObject.name,
      hp: expected.currentObject.hp.decimal,
      totalHp: expected.currentObject.totalHp.decimal,
      defense: expected.currentObject.defense.decimal,
    },
  });
  expect(simulation.lastActiveMs).toBe(expected.lastActive);
  expect(simulation.story).toEqual({
    page: expected.story.page,
    notifications: expected.story.notifications,
    highestUnlocked: expected.story.highestUnlocked,
  });
  expect(result.state.storyScrollY).toBe(expected.story.scrollY);
  expect(result.state.settings).toMatchObject({
    tab: expected.settings.tab,
    numberFormatterIndex: expected.settings.formatterIndex,
    theme: expected.settings.theme,
    showMineObjLevel: expected.settings.showMineObjLevel,
    showMinCraftDamage: expected.settings.showMinCraftDamage,
    upgradeTab: "wisdom",
    exportFieldString: "retained input",
  });
  expect({
    moneyIdleSpeed: simulation.upgrades.money.idleSpeed,
    gemOfflineGems: simulation.upgrades.gems.offlineGems,
    planetOfflinePC: simulation.upgrades.planetCoins.offlinePC,
    wisdomPowerPowerActive: simulation.upgrades.wisdom.powerPowerActive,
  }).toEqual(expected.upgradeLevels);
  expect(
    [
      simulation.powers.mining,
      simulation.powers.craftsmanship,
      simulation.powers.expertise,
      simulation.powers.wisdom,
      simulation.powers.exquisity,
    ].map((value) => value.toString()),
  ).toEqual(expected.powers.map(({ decimal }) => decimal));
  expect(result.state.powerValueExtras).toEqual([]);
  expect(simulation.pickaxe).toMatchObject({
    name: expected.pickaxe.name,
    power: expect.objectContaining({
      toString: expect.any(Function),
    }),
    quality: expect.objectContaining({
      toString: expect.any(Function),
    }),
  });
  expect(simulation.pickaxe.power.toString()).toBe(
    expected.pickaxe.power.decimal,
  );
  expect(simulation.pickaxe.quality.toString()).toBe(
    expected.pickaxe.quality.decimal,
  );
  expect(result.effects).toEqual([{ type: "setTheme", theme: "dark" }]);
  expect(clockCalls).toBe(1);

  expect(original.simulation.mineObjectLevel).toBe(0);
  expect(original.simulation.resources.money.toString()).toBe("77");
  expect(original.simulation.pickaxe.name).toBe("Probe Pickaxe");
});

it("preserves the loader's absent and empty-group behavior", () => {
  const semantics = corpus.data.saveSemantics;
  const seed = seedApplicationState();
  const missing = applyRemixLegacySaveFields({
    state: seed,
    save: JSON.parse(
      semantics.missingOptionalGroups.inputJson,
    ) as RemixLegacySaveData,
    catalog: corpus.data.mineObjectCatalog,
    clock: { now: () => 5000 },
  });

  expect(decimalValues(missing.state)).toEqual({
    money: "0",
    highestMoney: "0",
    gems: "0",
    planetCoins: "0",
    maxPlanetCoins: "0",
    wisdom: "0",
    maxWisdom: "0",
  });
  expect(missing.state.simulation.upgrades.money.idleSpeed).toBe(7);
  expect(missing.state.simulation.upgrades.gems.offlineGems).toBe(0);
  expect(missing.state.simulation.upgrades.planetCoins.offlinePC).toBe(0);
  expect(missing.state.simulation.upgrades.wisdom.powerPowerActive).toBe(6);
  expect(missing.state.simulation.powers.mining.toString()).toBe("9");
  expect(missing.state.simulation.pickaxe).toMatchObject({
    name: "Probe Pickaxe",
  });
  expect(missing.state.simulation.pickaxe.power.toString()).toBe("123");
  expect(missing.state.settings.theme).toBe("dark");
  expect(missing.state.simulation.lastActiveMs).toBe(5000);
  expect(missing.effects).toEqual([]);

  const empty = applyRemixLegacySaveFields({
    state: seed,
    save: JSON.parse(
      semantics.emptyPresentGroups.inputJson,
    ) as RemixLegacySaveData,
    catalog: corpus.data.mineObjectCatalog,
    clock: { now: () => 6000 },
  });

  expect(empty.state.settings).toMatchObject({
    tab: "settings",
    numberFormatterIndex: 0,
    theme: "dark",
    showMineObjLevel: false,
    showMinCraftDamage: false,
  });
  expect(empty.state.simulation.upgrades.money.idleSpeed).toBe(7);
  expect(empty.state.simulation.upgrades.gems.offlineGems).toBe(8);
  expect(empty.state.simulation.upgrades.planetCoins.offlinePC).toBe(9);
  expect(empty.state.simulation.upgrades.wisdom.powerPowerActive).toBe(0);
  expect(empty.state.simulation.powers.mining.toString()).toBe("9");
  expect(empty.state.simulation.pickaxe).toMatchObject({
    name: "Toy Pickaxe",
  });
  expect(empty.state.simulation.pickaxe.power.toString()).toBe("0");
  expect(empty.state.simulation.pickaxe.quality.toString()).toBe("0");
  expect(empty.effects).toEqual([{ type: "setTheme", theme: "dark" }]);
  expect(seed.simulation.upgrades.gems.offlineGems).toBe(8);
  expect(seed.simulation.pickaxe.name).toBe("Probe Pickaxe");
});
