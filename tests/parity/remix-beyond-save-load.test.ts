import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import {
  createInitialRemixSimulationState,
  type RemixMineObjectCatalog,
} from "../../packages/core/src/index.js";
import {
  createRemixFormatters,
  formatNumber,
} from "../../packages/formatting/src/index.js";
import {
  createInitialRemixLegacySaveApplicationState,
  encodeRemixBeyondSave,
  encodeRemixLegacySave,
  loadRemixBeyondSaveIntoState,
  loadRemixLegacySaveIntoState,
  persistRemixBeyondSave,
  type RemixBeyondSaveStorageAdapter,
  type RemixLegacySaveApplicationState,
} from "../../packages/persistence/src/index.js";

const corpus = JSON.parse(
  await readFile(
    new URL("../fixtures/parity/remix-reference-corpus.json", import.meta.url),
    "utf8",
  ),
) as {
  data: {
    mineObjectCatalog: RemixMineObjectCatalog;
    saveOfflineApplicationSemantics: {
      inputJson: string;
      elapsedSeconds: number;
      processedSeconds: number;
      clockReadCount: number;
      dateNowReads: number[];
      stateAfterLoad: {
        money: { decimal: string };
        highestMoney: { decimal: string };
        gems: { decimal: string };
        planetCoins: { decimal: string };
        maxPlanetCoins: { decimal: string };
        lastActive: number;
      };
      events: {
        type: string;
        theme?: string;
        message?: string;
        color?: string;
      }[];
    };
  };
};

class MemorySaveStorage implements RemixBeyondSaveStorageAdapter {
  primary: string | null = null;
  backup: string | null = null;
  calls: string[] = [];

  async readPrimary() {
    this.calls.push("readPrimary");
    return this.primary;
  }

  async writePrimary(serialized: string) {
    this.calls.push("writePrimary");
    this.primary = serialized;
  }

  async readBackup() {
    this.calls.push("readBackup");
    return this.backup;
  }

  async writeBackup(serialized: string) {
    this.calls.push("writeBackup");
    this.backup = serialized;
  }
}

function freshState(): RemixLegacySaveApplicationState {
  return createInitialRemixLegacySaveApplicationState(
    createInitialRemixSimulationState(corpus.data.mineObjectCatalog),
  );
}

it("loads Beyond v1 with the captured offline rewards and post-write order", async () => {
  const expected = corpus.data.saveOfflineApplicationSemantics;
  const sourceSave = JSON.parse(expected.inputJson) as object;
  const sourceFormatter = createRemixFormatters()[3];
  if (!sourceFormatter) throw new Error("Letters formatter is unavailable.");

  let setupClockReads = 0;
  const beforeOffline = loadRemixLegacySaveIntoState({
    state: freshState(),
    saveString: encodeRemixLegacySave(sourceSave),
    catalog: corpus.data.mineObjectCatalog,
    clock: {
      now() {
        const value = expected.dateNowReads[setupClockReads];
        if (value === undefined || setupClockReads > 1) {
          throw new Error("The source seed load read its clock unexpectedly.");
        }
        setupClockReads += 1;
        return value;
      },
    },
    resolveNumberFormatter() {
      return (value, precision, limit, below1000) =>
        formatNumber(value, sourceFormatter, precision, limit, below1000);
    },
    noOffline: true,
  });
  expect(beforeOffline.status).toBe("loaded");
  if (beforeOffline.status !== "loaded") {
    throw new Error("Could not prepare the captured pre-offline state.");
  }
  expect(setupClockReads).toBe(2);

  const storage = new MemorySaveStorage();
  const seeded = await persistRemixBeyondSave({
    state: beforeOffline.state,
    saveTimestampMs: beforeOffline.state.simulation.lastActiveMs ?? Number.NaN,
    storage,
    announceConfirmation: false,
  });
  expect(seeded.status).toBe("saved");
  storage.calls = [];

  const trace: string[] = [];
  let clockReads = 0;
  const result = await loadRemixBeyondSaveIntoState({
    storage,
    catalog: corpus.data.mineObjectCatalog,
    clock: {
      now() {
        const value = expected.dateNowReads[clockReads];
        if (value === undefined) {
          throw new Error("Beyond read the source clock too many times.");
        }
        clockReads += 1;
        return value;
      },
    },
    resolveNumberFormatter(index) {
      expect(index).toBe(3);
      return (value, precision, limit, below1000) =>
        formatNumber(value, sourceFormatter, precision, limit, below1000);
    },
    dispatchEffect(effect) {
      trace.push(
        effect.type === "setTheme"
          ? `effect:setTheme:${effect.theme}`
          : `effect:${effect.message}`,
      );
    },
  });

  expect(result.status).toBe("loaded");
  if (result.status !== "loaded") {
    throw new Error(`Beyond save load failed: ${result.status}.`);
  }
  expect(result.source).toBe("primary");
  expect(result.elapsedSeconds).toBe(expected.elapsedSeconds);
  expect(result.processedSeconds).toBe(expected.processedSeconds);
  expect(result.applied).toBe(true);
  expect(clockReads).toBe(expected.clockReadCount);
  expect(result.state.simulation.lastActiveMs).toBe(
    expected.stateAfterLoad.lastActive,
  );
  expect({
    money: result.state.simulation.resources.money.toString(),
    highestMoney: result.state.simulation.resources.highestMoney.toString(),
    gems: result.state.simulation.resources.gems.toString(),
    planetCoins: result.state.simulation.resources.planetCoins.toString(),
    maxPlanetCoins: result.state.simulation.resources.maxPlanetCoins.toString(),
  }).toEqual({
    money: expected.stateAfterLoad.money.decimal,
    highestMoney: expected.stateAfterLoad.highestMoney.decimal,
    gems: expected.stateAfterLoad.gems.decimal,
    planetCoins: expected.stateAfterLoad.planetCoins.decimal,
    maxPlanetCoins: expected.stateAfterLoad.maxPlanetCoins.decimal,
  });

  const expectedOfflineMessage = expected.events.find(
    (event) =>
      event.type === "logMessage" && event.message?.startsWith("Welcome back!"),
  );
  const expectedSaveMessage = expected.events.find(
    (event) => event.type === "logMessage" && event.message === "Game Saved!",
  );
  expect(trace).toEqual([
    "effect:setTheme:dark",
    `effect:${expectedOfflineMessage?.message}`,
    `effect:${expectedSaveMessage?.message}`,
  ]);
  expect(result.effects).toEqual([
    { type: "setTheme", theme: "dark" },
    {
      type: "logMessage",
      message: expectedOfflineMessage?.message,
      color: expectedOfflineMessage?.color,
    },
    {
      type: "logMessage",
      message: expectedSaveMessage?.message,
      color: expectedSaveMessage?.color,
    },
  ]);
  expect(storage.calls).toEqual([
    "readPrimary",
    "readPrimary",
    "readBackup",
    "writeBackup",
    "writePrimary",
  ]);
  expect(storage.backup).toBe(encodeRemixBeyondSave(beforeOffline.state));

  const written = JSON.parse(storage.primary ?? "null") as {
    state: { simulation: { resources: Record<string, string> } };
  };
  expect(written.state.simulation.resources).toMatchObject({
    money: expected.stateAfterLoad.money.decimal,
    highestMoney: expected.stateAfterLoad.highestMoney.decimal,
    gems: expected.stateAfterLoad.gems.decimal,
    planetCoins: expected.stateAfterLoad.planetCoins.decimal,
    maxPlanetCoins: expected.stateAfterLoad.maxPlanetCoins.decimal,
  });
});

it("does not persist or resolve a formatter at the exact 300-second boundary", async () => {
  const storage = new MemorySaveStorage();
  const start = 1_700_000_000_000;
  const saved = await persistRemixBeyondSave({
    state: freshState(),
    saveTimestampMs: start,
    storage,
    announceConfirmation: false,
  });
  expect(saved.status).toBe("saved");
  storage.calls = [];

  const effects: unknown[] = [];
  const clockValues = [start + 300_000, start + 300_000];
  let clockReads = 0;
  const result = await loadRemixBeyondSaveIntoState({
    storage,
    catalog: corpus.data.mineObjectCatalog,
    clock: {
      now() {
        const value = clockValues[clockReads];
        if (value === undefined)
          throw new Error("Unexpected extra clock read.");
        clockReads += 1;
        return value;
      },
    },
    resolveNumberFormatter() {
      throw new Error(
        "The threshold branch must not format an offline message.",
      );
    },
    dispatchEffect(effect) {
      effects.push(effect);
    },
  });

  expect(result.status).toBe("loaded");
  if (result.status !== "loaded") throw new Error("Beyond v1 did not load.");
  expect(result.elapsedSeconds).toBe(300);
  expect(result.applied).toBe(false);
  expect(clockReads).toBe(2);
  expect(effects).toEqual([{ type: "setTheme", theme: "light" }]);
  expect(result.effects).toEqual(effects);
  expect(storage.calls).toEqual(["readPrimary"]);
});
