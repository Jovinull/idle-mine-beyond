import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import {
  createInitialRemixSimulationState,
  type RemixMineObjectCatalog,
} from "../../packages/core/src/index.js";
import { createInitialRemixLegacySaveApplicationState } from "../../packages/persistence/src/remix-legacy-save-application.js";
import { createRemixLegacySaveExportData } from "../../packages/persistence/src/remix-legacy-save-export.js";
import {
  decodeRemixLegacySave,
  encodeRemixLegacySave,
} from "../../packages/persistence/src/remix-save-codec.js";
import { loadRemixLegacySaveIntoState } from "../../packages/persistence/src/remix-legacy-save-load.js";

const corpus = JSON.parse(
  await readFile(
    new URL("../fixtures/parity/remix-reference-corpus.json", import.meta.url),
    "utf8",
  ),
) as {
  data: {
    mineObjectCatalog: RemixMineObjectCatalog;
    saveApplicationSemantics: {
      inputJson: string;
      resources: { money: { decimal: string } };
    };
  };
};

function freshApplicationState() {
  return createInitialRemixLegacySaveApplicationState(
    createInitialRemixSimulationState(corpus.data.mineObjectCatalog),
  );
}

function loadWithoutOffline(saveString: string) {
  return loadRemixLegacySaveIntoState({
    state: freshApplicationState(),
    saveString,
    catalog: corpus.data.mineObjectCatalog,
    clock: { now: () => 1_700_000_000_000 },
    resolveNumberFormatter: () => () => "",
    noOffline: true,
  });
}

it("projects app state onto source loader fields and survives legacy round-trip", () => {
  const sourceInput = JSON.parse(
    corpus.data.saveApplicationSemantics.inputJson,
  ) as object;
  const sourceSave = loadWithoutOffline(encodeRemixLegacySave(sourceInput));
  expect(sourceSave.status).toBe("loaded");
  if (sourceSave.status !== "loaded") {
    throw new Error("The pinned current save fixture could not be loaded.");
  }

  const exported = createRemixLegacySaveExportData(
    sourceSave.state,
    1_700_000_000_000,
  );
  expect(exported).toMatchObject({
    money: corpus.data.saveApplicationSemantics.resources.money.decimal,
    highestMoney: "987.25",
    gems: "23",
    planetCoins: "17",
    maxPlanetCoins: "19",
    wisdom: "101",
    maxWisdom: "205",
    mineObjectLevel: 3,
    highestMineObjectLevel: 8,
    lastActive: 1_700_000_000_000,
    story: { page: 2, notifications: 4, highestUnlocked: 17, scrollY: 123 },
    settings: {
      tab: "main",
      numberFormatterIndex: 3,
      theme: "dark",
      showMineObjLevel: true,
      showMinCraftDamage: true,
    },
    powers: {
      data: { values: ["2", "3", "4", "5", "6"] },
    },
    pickaxe: { name: "Probe Pickaxe", pow: "123", quality: "4" },
  });
  expect(Object.keys(exported.upgrades ?? {})).toHaveLength(8);
  expect(exported.upgrades?.["idleSpeed"]?.level).toBe(4);
  expect(Object.keys(exported.gemUpgrades ?? {})).toHaveLength(7);
  expect(exported.gemUpgrades?.["offlineGems"]?.level).toBe(5);
  expect(Object.keys(exported.planetCoinUpgrades ?? {})).toHaveLength(7);
  expect(exported.planetCoinUpgrades?.["offlinePC"]?.level).toBe(6);
  expect(Object.keys(exported.powers?.upgrades ?? {})).toHaveLength(7);
  expect(exported.powers?.upgrades?.["powerPowerActive"]?.level).toBe(7);

  const decoded = decodeRemixLegacySave(encodeRemixLegacySave(exported));
  expect(decoded.status).toBe("success");
  if (decoded.status !== "success") {
    throw new Error("The exported legacy save did not decode.");
  }
  const restored = loadWithoutOffline(encodeRemixLegacySave(exported));
  expect(restored.status).toBe("loaded");
  if (restored.status !== "loaded") {
    throw new Error("The exported legacy save did not restore.");
  }
  expect(restored.state.simulation.resources.money.toString()).toBe(
    corpus.data.saveApplicationSemantics.resources.money.decimal,
  );
  expect(restored.state.simulation.resources.gems.toString()).toBe("23");
  expect(restored.state.simulation.mineObjectLevel).toBe(3);
  expect(restored.state.simulation.upgrades.money.idleSpeed).toBe(4);
  expect(restored.state.simulation.upgrades.wisdom.powerPowerActive).toBe(7);
  expect(restored.state.settings.numberFormatterIndex).toBe(3);
  expect(restored.state.settings.theme).toBe("dark");
  expect(restored.state.storyScrollY).toBe(123);
});
