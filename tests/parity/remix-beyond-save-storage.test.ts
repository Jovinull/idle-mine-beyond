import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import {
  Decimal,
  createInitialRemixSimulationState,
  type RemixMineObjectCatalog,
} from "../../packages/core/src/index.js";
import {
  createRemixFormatters,
  formatNumber,
} from "../../packages/formatting/src/index.js";
import {
  createInitialRemixLegacySaveApplicationState,
  encodeRemixLegacySave,
  importRemixLegacySaveToBeyond,
  loadRemixBeyondSaveFromStorage,
  persistRemixBeyondSave,
  REMIX_BEYOND_BACKUP_SAVE_KEY,
  REMIX_BEYOND_PRIMARY_SAVE_KEY,
  type RemixBeyondSaveStorageAdapter,
  type RemixLegacySaveApplicationState,
  type LoadRemixLegacySaveInput,
} from "../../packages/persistence/src/index.js";
import { createBrowserRemixSaveStorage } from "../../apps/web/src/lib/platform/remix-save-storage.js";

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
      events: { type: string; message?: string; color?: string }[];
    };
  };
};

class MemorySaveStorage implements RemixBeyondSaveStorageAdapter {
  primary: string | null = null;
  backup: string | null = null;
  calls: string[] = [];
  trace: string[] = [];
  failAt: "backup" | "primary" | null = null;

  private record(operation: string) {
    this.calls.push(operation);
    this.trace.push(`storage:${operation}`);
  }

  async readPrimary() {
    this.record("readPrimary");
    return this.primary;
  }

  async writePrimary(serialized: string) {
    this.record("writePrimary");
    if (this.failAt === "primary") throw new Error("primary write failed");
    this.primary = serialized;
  }

  async readBackup() {
    this.record("readBackup");
    return this.backup;
  }

  async writeBackup(serialized: string) {
    this.record("writeBackup");
    if (this.failAt === "backup") throw new Error("backup write failed");
    this.backup = serialized;
  }
}

function createState(money: number): RemixLegacySaveApplicationState {
  const initial = createInitialRemixLegacySaveApplicationState(
    createInitialRemixSimulationState(corpus.data.mineObjectCatalog),
  );
  return {
    ...initial,
    simulation: {
      ...initial.simulation,
      resources: { ...initial.simulation.resources, money: new Decimal(money) },
    },
  };
}

function createLegacyLoadInput(noOffline = false): LoadRemixLegacySaveInput {
  const captured = corpus.data.saveOfflineApplicationSemantics;
  const initial = createInitialRemixLegacySaveApplicationState(
    createInitialRemixSimulationState(corpus.data.mineObjectCatalog),
  );
  const formatter = createRemixFormatters()[3];
  if (!formatter) throw new Error("Captured Letters formatter is unavailable.");
  let clockReads = 0;
  return {
    state: initial,
    saveString: encodeRemixLegacySave(JSON.parse(captured.inputJson) as object),
    catalog: corpus.data.mineObjectCatalog,
    clock: {
      now() {
        const value = captured.dateNowReads[clockReads];
        if (value === undefined) throw new Error("Unexpected clock read.");
        clockReads += 1;
        return value;
      },
    },
    resolveNumberFormatter(formatterIndex) {
      expect(formatterIndex).toBe(3);
      return (value, precision, limit, below1000) =>
        formatNumber(value, formatter, precision, limit, below1000);
    },
    ...(noOffline ? { noOffline: true } : {}),
  };
}

async function save(
  storage: RemixBeyondSaveStorageAdapter,
  money: number,
  saveTimestampMs: number,
) {
  return persistRemixBeyondSave({
    state: createState(money),
    saveTimestampMs,
    storage,
  });
}

it("backs up the previous primary and confirms only after the v1 write", async () => {
  const storage = new MemorySaveStorage();
  const first = await save(storage, 10, 1_700_000_000_100);
  expect(first.status).toBe("saved");
  if (first.status !== "saved") throw new Error("First save did not succeed.");
  expect(storage.calls).toEqual(["readPrimary", "writePrimary"]);
  expect(first.state.simulation.lastActiveMs).toBe(1_700_000_000_100);

  storage.calls = [];
  const second = await save(storage, 20, 1_700_000_000_200);
  expect(second.status).toBe("saved");
  if (second.status !== "saved")
    throw new Error("Second save did not succeed.");
  expect(storage.calls).toEqual([
    "readPrimary",
    "readBackup",
    "writeBackup",
    "writePrimary",
  ]);
  expect(storage.backup).toBe(first.serialized);
  expect(storage.primary).toBe(second.serialized);

  const confirmation = corpus.data.saveOfflineApplicationSemantics.events.find(
    (event) => event.type === "logMessage" && event.message === "Game Saved!",
  );
  expect(second.confirmation).toEqual({
    type: "logMessage",
    message: confirmation?.message,
    color: confirmation?.color,
  });
});

it("preserves the current save and emits no confirmation when a write fails", async () => {
  const storage = new MemorySaveStorage();
  const first = await save(storage, 10, 1_700_000_000_100);
  if (first.status !== "saved")
    throw new Error("Initial save did not succeed.");

  storage.calls = [];
  storage.failAt = "backup";
  const backupFailure = await save(storage, 20, 1_700_000_000_200);
  expect(backupFailure).toMatchObject({ status: "storageFailed" });
  expect(storage.calls).toEqual(["readPrimary", "readBackup", "writeBackup"]);
  expect(storage.primary).toBe(first.serialized);
  expect("confirmation" in backupFailure).toBe(false);

  storage.calls = [];
  storage.failAt = null;
  const prepared = await save(storage, 20, 1_700_000_000_200);
  if (prepared.status !== "saved") {
    throw new Error("Save setup for primary failure did not succeed.");
  }
  const previousPrimary = prepared.serialized;
  storage.calls = [];
  storage.failAt = "primary";
  const primaryFailure = await save(storage, 30, 1_700_000_000_300);
  expect(primaryFailure).toMatchObject({ status: "storageFailed" });
  expect(storage.calls).toEqual([
    "readPrimary",
    "readBackup",
    "writeBackup",
    "writePrimary",
  ]);
  expect(storage.primary).toBe(previousPrimary);
  expect(storage.backup).toBe(previousPrimary);
  expect("confirmation" in primaryFailure).toBe(false);

  storage.calls = [];
  storage.primary = "corrupt primary";
  storage.backup = first.serialized;
  storage.failAt = "primary";
  const recoveredSaveFailure = await save(storage, 40, 1_700_000_000_400);
  expect(recoveredSaveFailure.status).toBe("storageFailed");
  expect(storage.calls).toEqual(["readPrimary", "readBackup", "writePrimary"]);
  expect(storage.primary).toBe("corrupt primary");
  expect(storage.backup).toBe(first.serialized);
});

it("loads the primary or reports backup recovery without modifying storage", async () => {
  const storage = new MemorySaveStorage();
  const primary = await save(storage, 10, 1_700_000_000_100);
  if (primary.status !== "saved") throw new Error("Save did not succeed.");
  const newer = await save(storage, 20, 1_700_000_000_200);
  if (newer.status !== "saved") throw new Error("Save did not succeed.");

  storage.calls = [];
  const current = await loadRemixBeyondSaveFromStorage({
    storage,
    catalog: corpus.data.mineObjectCatalog,
  });
  expect(current.status).toBe("loaded");
  if (current.status !== "loaded") throw new Error("Primary did not load.");
  expect(current.source).toBe("primary");
  expect(current.state.simulation.resources.money.toString()).toBe("20");
  expect(storage.calls).toEqual(["readPrimary"]);

  storage.calls = [];
  storage.primary = "corrupt primary";
  const recovered = await loadRemixBeyondSaveFromStorage({
    storage,
    catalog: corpus.data.mineObjectCatalog,
  });
  expect(recovered.status).toBe("loaded");
  if (recovered.status !== "loaded") {
    throw new Error("Valid backup did not load.");
  }
  expect(recovered.source).toBe("backup");
  expect(recovered.state.simulation.resources.money.toString()).toBe("10");
  expect(storage.primary).toBe("corrupt primary");
  expect(storage.calls).toEqual(["readPrimary", "readBackup"]);
});

it("distinguishes empty and invalid storage and rejects invalid state before I/O", async () => {
  const storage = new MemorySaveStorage();
  const empty = await loadRemixBeyondSaveFromStorage({
    storage,
    catalog: corpus.data.mineObjectCatalog,
  });
  expect(empty).toEqual({ status: "empty" });

  storage.primary = "corrupt primary";
  storage.backup = "corrupt backup";
  const invalid = await loadRemixBeyondSaveFromStorage({
    storage,
    catalog: corpus.data.mineObjectCatalog,
  });
  expect(invalid).toMatchObject({ status: "invalid" });

  storage.primary = null;
  storage.backup = null;
  storage.calls = [];
  const state = createState(10);
  const invalidState = await persistRemixBeyondSave({
    state: {
      ...state,
      simulation: {
        ...state.simulation,
        resources: {
          ...state.simulation.resources,
          money: new Decimal("NaN"),
        },
      },
    },
    saveTimestampMs: 1_700_000_000_100,
    storage,
  });
  expect(invalidState.status).toBe("invalidState");
  expect(storage.calls).toEqual([]);
  expect("confirmation" in invalidState).toBe(false);
});

it("does not load a backup over or overwrite a save from an unknown newer version", async () => {
  const storage = new MemorySaveStorage();
  const backup = await save(storage, 10, 1_700_000_000_100);
  if (backup.status !== "saved") throw new Error("Backup setup failed.");
  storage.primary = JSON.stringify({
    format: "idle-mine-beyond",
    version: 2,
    state: {},
  });
  storage.backup = backup.serialized;
  storage.calls = [];

  const loaded = await loadRemixBeyondSaveFromStorage({
    storage,
    catalog: corpus.data.mineObjectCatalog,
  });
  expect(loaded).toMatchObject({
    status: "unsupportedVersion",
    source: "primary",
    version: 2,
  });
  expect(storage.calls).toEqual(["readPrimary"]);

  storage.calls = [];
  const attemptedWrite = await save(storage, 20, 1_700_000_000_200);
  expect(attemptedWrite).toMatchObject({
    status: "incompatibleSave",
    version: 2,
  });
  expect(storage.calls).toEqual(["readPrimary"]);
});

it("does not replace an unknown newer backup while writing a valid primary", async () => {
  const storage = new MemorySaveStorage();
  const current = await save(storage, 10, 1_700_000_000_100);
  if (current.status !== "saved") throw new Error("Save setup failed.");
  const newer = JSON.stringify({
    format: "idle-mine-beyond",
    version: 2,
    state: {},
  });
  storage.backup = newer;
  storage.calls = [];

  const result = await save(storage, 20, 1_700_000_000_200);
  expect(result).toMatchObject({ status: "incompatibleSave", version: 2 });
  expect(storage.primary).toBe(current.serialized);
  expect(storage.backup).toBe(newer);
  expect(storage.calls).toEqual(["readPrimary", "readBackup"]);
});

it("keeps browser primary and backup keys separate from the Remix key", async () => {
  const values = new Map<string, string>();
  const browserStorage = createBrowserRemixSaveStorage({
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  });
  await browserStorage.writePrimary("primary-v1");
  await browserStorage.writeBackup("backup-v1");

  expect(values.get(REMIX_BEYOND_PRIMARY_SAVE_KEY)).toBe("primary-v1");
  expect(values.get(REMIX_BEYOND_BACKUP_SAVE_KEY)).toBe("backup-v1");
  expect(values.has("IdleMine")).toBe(false);
});

it("imports the captured legacy save in source effect order into Beyond v1", async () => {
  const storage = new MemorySaveStorage();
  const result = await importRemixLegacySaveToBeyond({
    load: createLegacyLoadInput(),
    storage,
    dispatchEffect(effect) {
      storage.trace.push(
        effect.type === "logMessage"
          ? `effect:${effect.message}`
          : `effect:${effect.type}`,
      );
    },
  });
  expect(result.status).toBe("imported");
  if (result.status !== "imported") {
    throw new Error(`Legacy import failed: ${result.status}.`);
  }

  const expectedEvents = corpus.data.saveOfflineApplicationSemantics.events;
  const offlineMessage = expectedEvents.find(
    (event) =>
      event.type === "logMessage" && event.message?.startsWith("Welcome back!"),
  );
  const saveMessage = expectedEvents.find(
    (event) => event.type === "logMessage" && event.message === "Game Saved!",
  );
  expect(storage.trace).toEqual([
    "effect:setTheme",
    `effect:${offlineMessage?.message}`,
    "storage:readPrimary",
    "storage:writePrimary",
    `effect:${saveMessage?.message}`,
  ]);
  expect(result.effects.at(-1)).toEqual({
    type: "logMessage",
    message: saveMessage?.message,
    color: saveMessage?.color,
  });
  expect(result.persisted).toHaveLength(1);
  expect(storage.primary).toBe(result.persisted[0]?.serialized);
  expect(storage.backup).toBeNull();
});

it("migrates non-offline imports silently and retains legacy data on write failure", async () => {
  const storage = new MemorySaveStorage();
  const noOffline = await importRemixLegacySaveToBeyond({
    load: createLegacyLoadInput(true),
    storage,
    dispatchEffect(effect) {
      storage.trace.push(
        effect.type === "logMessage"
          ? `effect:${effect.message}`
          : `effect:${effect.type}`,
      );
    },
  });
  expect(noOffline.status).toBe("imported");
  expect(storage.trace).toEqual([
    "effect:setTheme",
    "storage:readPrimary",
    "storage:writePrimary",
  ]);
  expect(noOffline.status === "imported" ? noOffline.effects : []).toEqual([
    { type: "setTheme", theme: "dark" },
  ]);

  const previousBeyondSave = storage.primary;
  storage.trace = [];
  storage.failAt = "primary";
  const failed = await importRemixLegacySaveToBeyond({
    load: createLegacyLoadInput(),
    storage,
    dispatchEffect(effect) {
      storage.trace.push(
        effect.type === "logMessage"
          ? `effect:${effect.message}`
          : `effect:${effect.type}`,
      );
    },
  });
  expect(failed.status).toBe("persistenceFailed");
  expect(storage.primary).toBe(previousBeyondSave);
  expect(storage.trace.at(-1)).toBe("storage:writePrimary");
  expect(storage.trace.some((item) => item === "effect:Game Saved!")).toBe(
    false,
  );
});
