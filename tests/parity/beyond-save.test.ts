import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import {
  Decimal,
  createInitialRemixSimulationState,
  getRemixMineObject,
  type DecimalSource,
  type RemixMineObjectCatalog,
} from "../../packages/core/src/index.js";
import {
  createInitialRemixLegacySaveApplicationState,
  decodeRemixBeyondSave,
  encodeRemixBeyondSave,
  REMIX_BEYOND_SAVE_VERSION,
  restoreRemixBeyondSave,
  type RemixLegacySaveApplicationState,
} from "../../packages/persistence/src/index.js";

const corpus = JSON.parse(
  await readFile(
    new URL("../fixtures/parity/remix-reference-corpus.json", import.meta.url),
    "utf8",
  ),
) as { data: { mineObjectCatalog: RemixMineObjectCatalog } };

function decimalRecord(values: Record<string, DecimalSource>) {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      new Decimal(value).toString(),
    ]),
  );
}

function summarize(state: RemixLegacySaveApplicationState) {
  const { simulation } = state;
  return {
    simulation: {
      mineObjectLevel: simulation.mineObjectLevel,
      highestMineObjectLevel: simulation.highestMineObjectLevel,
      currentObject: simulation.currentObject,
      resources: decimalRecord(simulation.resources),
      powers: decimalRecord(simulation.powers),
      pickaxe: {
        name: simulation.pickaxe.name,
        power: simulation.pickaxe.power.toString(),
        quality: simulation.pickaxe.quality.toString(),
      },
      upgrades: simulation.upgrades,
      autoPickaxeTimer: simulation.autoPickaxeTimer,
      saveTimer: simulation.saveTimer,
      powersUnlocked: simulation.powersUnlocked,
      usedGemsLevel: simulation.usedGemsLevel,
      lastActiveMs: simulation.lastActiveMs,
      story: simulation.story,
    },
    storyScrollY: state.storyScrollY,
    settings: state.settings,
    powerValueExtras: state.powerValueExtras.map((value) => value.toString()),
  };
}

function stateWithEveryPersistedField(catalog: RemixMineObjectCatalog) {
  const initial = createInitialRemixLegacySaveApplicationState(
    createInitialRemixSimulationState(catalog),
  );
  const simulation = initial.simulation;
  return {
    ...initial,
    simulation: {
      ...simulation,
      mineObjectLevel: 210,
      highestMineObjectLevel: 214,
      currentObject: getRemixMineObject(210, catalog),
      resources: {
        money: new Decimal("1e+3500"),
        highestMoney: new Decimal("2e+3500"),
        gems: new Decimal(17),
        planetCoins: new Decimal(23),
        maxPlanetCoins: new Decimal(29),
        wisdom: new Decimal("7e+300"),
        maxWisdom: new Decimal("9e+300"),
      },
      powers: {
        mining: new Decimal(2),
        craftsmanship: new Decimal(3),
        expertise: new Decimal(4),
        wisdom: new Decimal(5),
        exquisity: new Decimal(6),
      },
      pickaxe: {
        name: "Écho / Deep Pick",
        power: new Decimal("1e+600"),
        quality: new Decimal("1.25"),
      },
      upgrades: {
        money: { ...simulation.upgrades.money, blacksmith: 4 },
        gems: { ...simulation.upgrades.gems, offlineGems: 2 },
        planetCoins: { ...simulation.upgrades.planetCoins, offlineTime: 3 },
        wisdom: { ...simulation.upgrades.wisdom, damageBoost: 5 },
      },
      autoPickaxeTimer: 12.5,
      saveTimer: 43.75,
      powersUnlocked: true,
      usedGemsLevel: 8,
      lastActiveMs: 1_800_000_123_456,
      story: { page: 7, highestUnlocked: 8, notifications: 2 },
    },
    storyScrollY: 317,
    settings: {
      ...initial.settings,
      tab: "story",
      upgradeTab: "planetCoins",
      exportFieldString: "special field ✓",
      numberFormatterIndex: 39,
      theme: "dark",
      showMineObjLevel: true,
      showMinCraftDamage: true,
    },
    powerValueExtras: [new Decimal("1e+1200"), new Decimal(0.125)],
  } satisfies RemixLegacySaveApplicationState;
}

it("round-trips the complete Beyond v1 state and derives its current object", () => {
  const state = stateWithEveryPersistedField(corpus.data.mineObjectCatalog);
  const encoded = encodeRemixBeyondSave(state);
  const decoded = decodeRemixBeyondSave(encoded);

  expect(decoded.status).toBe("valid");
  if (decoded.status !== "valid") {
    throw new Error(`Expected a valid save, received ${decoded.status}.`);
  }

  expect(decoded.save.version).toBe(REMIX_BEYOND_SAVE_VERSION);
  expect(decoded.save.format).toBe("idle-mine-beyond");
  const restored = restoreRemixBeyondSave(
    decoded.save,
    corpus.data.mineObjectCatalog,
  );
  expect(summarize(restored)).toEqual(summarize(state));
  expect(restored.simulation.currentObject.id).toBe(210);
});

it("rejects malformed JSON, unknown versions, invalid Decimals, and extra fields", () => {
  const state = stateWithEveryPersistedField(corpus.data.mineObjectCatalog);
  const encoded = encodeRemixBeyondSave(state);
  expect(decodeRemixBeyondSave("{")).toMatchObject({ status: "invalidJson" });
  expect(
    decodeRemixBeyondSave(
      JSON.stringify({ format: "idle-mine-beyond", version: 2, state: {} }),
    ),
  ).toMatchObject({ status: "unsupportedVersion", version: 2 });

  const invalidDecimal = JSON.parse(encoded) as {
    state: { simulation: { resources: { money: string } } };
  };
  invalidDecimal.state.simulation.resources.money = "not-a-decimal";
  expect(decodeRemixBeyondSave(JSON.stringify(invalidDecimal))).toMatchObject({
    status: "invalidSchema",
  });

  const extraField = JSON.parse(encoded) as Record<string, unknown>;
  extraField["unrecognized"] = true;
  expect(decodeRemixBeyondSave(JSON.stringify(extraField))).toMatchObject({
    status: "invalidSchema",
  });
});

it("does not share mutable state when restoring one parsed save more than once", () => {
  const state = stateWithEveryPersistedField(corpus.data.mineObjectCatalog);
  const encoded = encodeRemixBeyondSave(state);
  const decoded = decodeRemixBeyondSave(encoded);
  if (decoded.status !== "valid") {
    throw new Error("Expected the encoded save to validate.");
  }

  const restoredFirst = restoreRemixBeyondSave(
    decoded.save,
    corpus.data.mineObjectCatalog,
  );
  const restoredSecond = restoreRemixBeyondSave(
    decoded.save,
    corpus.data.mineObjectCatalog,
  );
  restoredFirst.settings.tab = "settings";
  restoredFirst.simulation.upgrades.wisdom.damageBoost = 99;
  restoredFirst.simulation.story.page = 2;
  expect(restoredSecond.settings.tab).toBe("story");
  expect(restoredSecond.simulation.upgrades.wisdom.damageBoost).toBe(5);
  expect(restoredSecond.simulation.story.page).toBe(7);
});
