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
  decodeRemixBeyondRecoveryFile,
  decodeRemixBeyondSave,
  encodeRemixBeyondSave,
  encodeRemixLegacySave,
  importRemixBeyondRecoveryFile,
  loadRemixLegacySaveIntoState,
  type RemixBeyondSaveStorageAdapter,
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
      dateNowReads: number[];
      clockReadCount: number;
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

class MemoryStorage implements RemixBeyondSaveStorageAdapter {
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

const recoveryTimestamp = 1_700_000_000_000;

function freshState() {
  return createInitialRemixLegacySaveApplicationState(
    createInitialRemixSimulationState(corpus.data.mineObjectCatalog),
  );
}

function validSave(theme = "dark") {
  const state = freshState();
  return encodeRemixBeyondSave({
    ...state,
    simulation: { ...state.simulation, lastActiveMs: recoveryTimestamp },
    settings: { ...state.settings, theme },
  });
}

function recoveryBundle(
  beyondPrimary: string | null,
  beyondBackup: string | null,
  remixLegacy: string | null = null,
) {
  return JSON.stringify({
    format: "idle-mine-beyond-recovery",
    version: 1,
    saves: { beyondPrimary, beyondBackup, remixLegacy },
  });
}

it("accepts a direct Beyond save and a primary recovery-bundle save", () => {
  const direct = decodeRemixBeyondRecoveryFile(validSave());
  expect(direct).toMatchObject({ status: "valid", source: "direct" });

  const primary = decodeRemixBeyondRecoveryFile(
    recoveryBundle(validSave(), null, "legacy-slot-is-not-a-Beyond-save"),
  );
  expect(primary).toMatchObject({ status: "valid", source: "primary" });
});

it("uses a valid backup when the recovery bundle primary is damaged", () => {
  const decoded = decodeRemixBeyondRecoveryFile(
    recoveryBundle("damaged-primary", validSave("light")),
  );
  expect(decoded).toMatchObject({ status: "valid", source: "backup" });
  if (decoded.status !== "valid") throw new Error("Backup was not selected.");
  expect(decoded.save.state.settings.theme).toBe("light");
});

it("does not fall back from an unsupported future primary save", () => {
  const future = JSON.stringify({
    format: "idle-mine-beyond",
    version: 2,
    state: {},
  });
  expect(
    decodeRemixBeyondRecoveryFile(recoveryBundle(future, validSave())),
  ).toMatchObject({
    status: "unsupportedVersion",
    source: "primary",
    version: 2,
  });
});

it("rejects malformed bundles and ignores a legacy-only bundle", () => {
  expect(decodeRemixBeyondRecoveryFile("{")).toMatchObject({
    status: "invalid",
  });
  expect(
    decodeRemixBeyondRecoveryFile(
      recoveryBundle(null, null, validSave("dark")),
    ),
  ).toEqual({ status: "empty" });
  expect(
    decodeRemixBeyondRecoveryFile(
      JSON.stringify({
        format: "idle-mine-beyond-recovery",
        version: 1,
        saves: { beyondPrimary: 5, beyondBackup: null, remixLegacy: null },
      }),
    ),
  ).toMatchObject({ status: "invalid" });
});

it("persists a valid imported Beyond file through guarded recovery storage", async () => {
  const storage = new MemoryStorage();
  storage.primary = "damaged-primary";
  storage.backup = "damaged-backup";
  const effects: string[] = [];
  const result = await importRemixBeyondRecoveryFile({
    serialized: recoveryBundle(validSave(), null),
    catalog: corpus.data.mineObjectCatalog,
    clock: { now: () => recoveryTimestamp },
    resolveNumberFormatter() {
      throw new Error("No formatter should be needed at zero elapsed time.");
    },
    storage,
    dispatchEffect(effect) {
      effects.push(
        effect.type === "setTheme" ? `theme:${effect.theme}` : effect.message,
      );
    },
  });

  expect(result.status).toBe("recovered");
  if (result.status !== "recovered") throw new Error("Save recovery failed.");
  expect(result.source).toBe("primary");
  expect(result.state.settings.theme).toBe("dark");
  expect(storage.backup).toBe("damaged-primary");
  expect(decodeRemixBeyondSave(storage.primary ?? "").status).toBe("valid");
  expect(effects).toEqual(["theme:dark"]);
});

it("applies captured offline rewards before persisting an imported Beyond file", async () => {
  const expected = corpus.data.saveOfflineApplicationSemantics;
  const sourceFormatter = createRemixFormatters()[3];
  if (!sourceFormatter) throw new Error("Letters formatter is unavailable.");
  let legacyClockReads = 0;
  const legacy = loadRemixLegacySaveIntoState({
    state: freshState(),
    saveString: encodeRemixLegacySave(JSON.parse(expected.inputJson) as object),
    catalog: corpus.data.mineObjectCatalog,
    clock: {
      now() {
        const value = expected.dateNowReads[legacyClockReads];
        if (value === undefined)
          throw new Error("Unexpected legacy clock read.");
        legacyClockReads += 1;
        return value;
      },
    },
    resolveNumberFormatter() {
      return (value, precision, limit, below1000) =>
        formatNumber(value, sourceFormatter, precision, limit, below1000);
    },
    noOffline: true,
  });
  expect(legacy.status).toBe("loaded");
  if (legacy.status !== "loaded") {
    throw new Error("Could not prepare the captured pre-offline save.");
  }
  expect(legacyClockReads).toBe(2);

  const storage = new MemoryStorage();
  const effects: string[] = [];
  let offlineClockReads = 0;
  const result = await importRemixBeyondRecoveryFile({
    serialized: encodeRemixBeyondSave(legacy.state),
    catalog: corpus.data.mineObjectCatalog,
    clock: {
      now() {
        const value = expected.dateNowReads[offlineClockReads];
        if (value === undefined)
          throw new Error("Unexpected offline clock read.");
        offlineClockReads += 1;
        return value;
      },
    },
    resolveNumberFormatter(index) {
      expect(index).toBe(3);
      return (value, precision, limit, below1000) =>
        formatNumber(value, sourceFormatter, precision, limit, below1000);
    },
    storage,
    dispatchEffect(effect) {
      effects.push(
        effect.type === "setTheme" ? `theme:${effect.theme}` : effect.message,
      );
    },
  });

  expect(result.status).toBe("recovered");
  if (result.status !== "recovered") {
    throw new Error("The offline Beyond recovery did not complete.");
  }
  expect(offlineClockReads).toBe(expected.clockReadCount);
  expect({
    money: result.state.simulation.resources.money.toString(),
    highestMoney: result.state.simulation.resources.highestMoney.toString(),
    gems: result.state.simulation.resources.gems.toString(),
    planetCoins: result.state.simulation.resources.planetCoins.toString(),
    maxPlanetCoins: result.state.simulation.resources.maxPlanetCoins.toString(),
    lastActiveMs: result.state.simulation.lastActiveMs,
  }).toEqual({
    money: expected.stateAfterLoad.money.decimal,
    highestMoney: expected.stateAfterLoad.highestMoney.decimal,
    gems: expected.stateAfterLoad.gems.decimal,
    planetCoins: expected.stateAfterLoad.planetCoins.decimal,
    maxPlanetCoins: expected.stateAfterLoad.maxPlanetCoins.decimal,
    lastActiveMs: expected.stateAfterLoad.lastActive,
  });

  const offlineMessage = expected.events.find(
    (event) =>
      event.type === "logMessage" && event.message?.startsWith("Welcome back!"),
  );
  const confirmation = expected.events.find(
    (event) => event.type === "logMessage" && event.message === "Game Saved!",
  );
  expect(effects).toEqual([
    "theme:dark",
    offlineMessage?.message,
    confirmation?.message,
  ]);
  expect(decodeRemixBeyondSave(storage.primary ?? "").status).toBe("valid");
  expect(storage.calls).toEqual(["readPrimary", "writePrimary"]);
});

it("does not write invalid or unsupported recovery input", async () => {
  const future = JSON.stringify({
    format: "idle-mine-beyond",
    version: 2,
    state: {},
  });
  const storage = new MemoryStorage();
  storage.primary = "damaged-primary";
  storage.backup = "damaged-backup";
  const effects: unknown[] = [];

  for (const serialized of [
    "invalid file",
    recoveryBundle(future, validSave()),
  ]) {
    const result = await importRemixBeyondRecoveryFile({
      serialized,
      catalog: corpus.data.mineObjectCatalog,
      clock: { now: () => recoveryTimestamp },
      resolveNumberFormatter() {
        throw new Error("Rejected data must not reach offline formatting.");
      },
      storage,
      dispatchEffect(effect) {
        effects.push(effect);
      },
    });
    expect(result.status).toBe("fileRejected");
  }

  expect(storage.primary).toBe("damaged-primary");
  expect(storage.backup).toBe("damaged-backup");
  expect(storage.calls).toEqual([]);
  expect(effects).toEqual([]);
});

it("keeps existing future-version storage protected during valid file recovery", async () => {
  const storage = new MemoryStorage();
  storage.primary = JSON.stringify({
    format: "idle-mine-beyond",
    version: 2,
    state: {},
  });
  storage.backup = "preserve-backup";
  const effects: unknown[] = [];
  const result = await importRemixBeyondRecoveryFile({
    serialized: validSave(),
    catalog: corpus.data.mineObjectCatalog,
    clock: { now: () => recoveryTimestamp },
    resolveNumberFormatter() {
      throw new Error("No formatter should be needed at zero elapsed time.");
    },
    storage,
    dispatchEffect(effect) {
      effects.push(effect);
    },
  });

  expect(result.status).toBe("persistenceFailed");
  if (result.status !== "persistenceFailed") {
    throw new Error("Future save protection did not block recovery.");
  }
  expect(result.persistence.status).toBe("incompatibleSave");
  expect(storage.primary).toContain('"version":2');
  expect(storage.backup).toBe("preserve-backup");
  expect(storage.calls).toEqual(["readPrimary"]);
  expect(effects).toEqual([]);
});
