import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import {
  RemixRandom,
  type RemixMineObjectCatalog,
} from "../../packages/core/src/index.js";
import {
  createRemixFormatters,
  formatNumber,
} from "../../packages/formatting/src/index.js";
import {
  decodeRemixBeyondSave,
  decodeRemixLegacySave,
  encodeRemixLegacySave,
  type RemixBeyondSaveStorageAdapter,
} from "../../packages/persistence/src/index.js";
import {
  createRemixWebGameSession,
  type CreateRemixWebGameSessionInput,
} from "../../apps/web/src/lib/platform/remix-game-session.js";

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
      dateNowReads: number[];
      stateAfterLoad: {
        money: { decimal: string };
        lastActive: number;
      };
      events: { type: string; message?: string; theme?: string }[];
    };
    saveApplicationSemantics: {
      inputJson: string;
      resources: { money: { decimal: string } };
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

class FailingPrimaryStorage extends MemoryStorage {
  override async writePrimary() {
    this.calls.push("writePrimary");
    throw new Error("storage denied");
  }
}

function createSessionInput(
  overrides: Partial<CreateRemixWebGameSessionInput> & {
    storage: MemoryStorage;
  },
) {
  let now = 1_700_000_000_000;
  const effects: string[] = [];
  let legacyReadCount = 0;
  const input: CreateRemixWebGameSessionInput = {
    catalog: overrides.catalog ?? corpus.data.mineObjectCatalog,
    storyMilestones: overrides.storyMilestones ?? [],
    random: overrides.random ?? new RemixRandom(13579),
    clock: overrides.clock ?? {
      now() {
        return now;
      },
    },
    storage: overrides.storage,
    readLegacySave() {
      legacyReadCount += 1;
      return overrides.readLegacySave?.() ?? null;
    },
    resolveNumberFormatter(index) {
      const formatter = createRemixFormatters()[index];
      if (!formatter) throw new Error(`Formatter ${index} is unavailable.`);
      return (value, precision, limit, below1000) =>
        formatNumber(value, formatter, precision, limit, below1000);
    },
    dispatchEffect(effect) {
      effects.push(
        effect.type === "setTheme"
          ? `theme:${effect.theme}`
          : `log:${effect.message}`,
      );
      return overrides.dispatchEffect?.(effect);
    },
  };

  return {
    session: createRemixWebGameSession(input),
    effects,
    get legacyReadCount() {
      return legacyReadCount;
    },
    setNow(value: number) {
      now = value;
    },
  };
}

it("starts fresh and persists an ordinary autosave before confirming it", async () => {
  const storage = new MemoryStorage();
  const test = createSessionInput({ storage });
  const initialized = await test.session.initialize();
  expect(initialized.status).toBe("ready");
  if (initialized.status !== "ready") throw new Error("Fresh session failed.");
  expect(initialized.source).toBe("fresh");
  expect(test.legacyReadCount).toBe(1);
  expect(initialized.state.simulation.resources.gems.toString()).toBe("5");

  storage.calls = [];
  const result = await test.session.dispatch({
    type: "idleFrame",
    deltaSeconds: 61,
  });
  expect(result.status).toBe("applied");
  if (result.status !== "applied") {
    throw new Error("Autosave action did not complete.");
  }
  expect(result.result.type).toBe("mining");
  expect(storage.calls).toEqual(["readPrimary", "writePrimary"]);
  expect(test.effects).toEqual(["log:Game Saved!"]);
  expect(result.state.simulation.lastActiveMs).toBe(1_700_000_000_000);

  const decoded = decodeRemixBeyondSave(storage.primary ?? "");
  expect(decoded.status).toBe("valid");
  if (decoded.status !== "valid") throw new Error("Autosave is not valid v1.");
  expect(decoded.save.state.simulation.lastActiveMs).toBe(1_700_000_000_000);
});

it("migrates the legacy key during startup without changing it", async () => {
  const expected = corpus.data.saveOfflineApplicationSemantics;
  const storage = new MemoryStorage();
  let clockReads = 0;
  const test = createSessionInput({
    storage,
    readLegacySave: () =>
      encodeRemixLegacySave(JSON.parse(expected.inputJson) as object),
    clock: {
      now() {
        const value = expected.dateNowReads[clockReads];
        if (value === undefined) throw new Error("Unexpected clock read.");
        clockReads += 1;
        return value;
      },
    },
  });

  const initialized = await test.session.initialize();
  expect(initialized.status).toBe("ready");
  if (initialized.status !== "ready") {
    throw new Error("The pinned legacy save was not imported.");
  }
  expect(initialized.source).toBe("legacy");
  expect(initialized.state.settings.theme).toBe("dark");
  expect(initialized.state.simulation.resources.money.toString()).toBe(
    expected.stateAfterLoad.money.decimal,
  );
  expect(initialized.state.simulation.lastActiveMs).toBe(
    expected.stateAfterLoad.lastActive,
  );
  expect(clockReads).toBe(4);
  expect(test.legacyReadCount).toBe(1);
  expect(storage.primary).not.toBeNull();
  expect(test.effects[0]).toBe("theme:dark");
  expect(test.effects[1]).toBe(
    `log:${expected.events.find((event) => event.message?.startsWith("Welcome back!"))?.message}`,
  );
  expect(test.effects[2]).toMatch(/^log:Game Saved!$/);
});

it("does not fall back to legacy data when Beyond reports an unsupported version", async () => {
  const storage = new MemoryStorage();
  storage.primary = JSON.stringify({
    format: "idle-mine-beyond",
    version: 2,
    state: {},
  });
  let legacyReads = 0;
  const test = createSessionInput({
    storage,
    readLegacySave() {
      legacyReads += 1;
      return "legacy-save-must-not-be-used";
    },
  });

  const initialized = await test.session.initialize();
  expect(initialized.status).toBe("recoveryRequired");
  expect(legacyReads).toBe(0);
  expect(storage.primary).toContain('"version":2');
  expect(storage.calls).toEqual(["readPrimary"]);
});

it("reuses the offline branch's captured timestamp when it persists", async () => {
  const storage = new MemoryStorage();
  const clockValues = [0, 3_601_000, 3_601_100, 3_601_200];
  let clockReads = 0;
  const test = createSessionInput({
    storage,
    clock: {
      now() {
        const value = clockValues[clockReads];
        if (value === undefined) throw new Error("Unexpected clock read.");
        clockReads += 1;
        return value;
      },
    },
  });
  const initialized = await test.session.initialize();
  expect(initialized.status).toBe("ready");

  const result = await test.session.dispatch({
    type: "offlineLoad",
  });
  expect(result.status).toBe("applied");
  if (result.status !== "applied") {
    throw new Error("Offline load action failed to persist.");
  }
  expect(clockReads).toBe(4);
  expect(result.state.simulation.lastActiveMs).toBe(3_601_200);
  expect(test.effects.at(-1)).toBe("log:Game Saved!");
  expect(storage.calls).toEqual([
    "readPrimary",
    "readBackup",
    "readPrimary",
    "writePrimary",
  ]);
});

it("serializes presentation state updates with actions before the next save", async () => {
  const storage = new MemoryStorage();
  const test = createSessionInput({ storage });
  const initialized = await test.session.initialize();
  expect(initialized.status).toBe("ready");
  storage.calls = [];

  const update = await test.session.updateApplicationState((current) => ({
    ...current,
    settings: { ...current.settings, tab: "story" },
    simulation: {
      ...current.simulation,
      story: { ...current.simulation.story, page: 1 },
    },
    storyScrollY: 123,
  }));
  expect(update.status).toBe("updated");
  expect(storage.calls).toEqual([]);

  const frame = await test.session.dispatch({
    type: "idleFrame",
    deltaSeconds: 61,
  });
  expect(frame.status).toBe("applied");
  const saved = decodeRemixBeyondSave(storage.primary ?? "");
  expect(saved.status).toBe("valid");
  if (saved.status !== "valid") throw new Error("Updated state was not saved.");
  expect(saved.save.state.settings.tab).toBe("story");
  expect(saved.save.state.storyScrollY).toBe(123);
  expect(saved.save.state.simulation.story.page).toBe(1);
});

it("saves the latest application state immediately and confirms only after storage succeeds", async () => {
  const storage = new MemoryStorage();
  const test = createSessionInput({ storage });
  const initialized = await test.session.initialize();
  expect(initialized.status).toBe("ready");
  if (initialized.status !== "ready") throw new Error("Fresh session failed.");

  await test.session.updateApplicationState((current) => ({
    ...current,
    settings: { ...current.settings, theme: "dark", numberFormatterIndex: 3 },
  }));
  storage.calls = [];
  test.setNow(1_700_000_123_456);

  const result = await test.session.saveNow();

  expect(result.status).toBe("saved");
  expect(storage.calls).toEqual(["readPrimary", "writePrimary"]);
  expect(test.effects).toEqual(["log:Game Saved!"]);
  const decoded = decodeRemixBeyondSave(storage.primary ?? "");
  expect(decoded.status).toBe("valid");
  if (decoded.status !== "valid") throw new Error("Manual save is not valid.");
  expect(decoded.save.state.settings).toMatchObject({
    theme: "dark",
    numberFormatterIndex: 3,
  });
  expect(decoded.save.state.simulation.lastActiveMs).toBe(1_700_000_123_456);
});

it("does not announce a manual save when storage rejects the write", async () => {
  const storage = new FailingPrimaryStorage();
  const test = createSessionInput({ storage });
  const initialized = await test.session.initialize();
  expect(initialized.status).toBe("ready");
  if (initialized.status !== "ready") throw new Error("Fresh session failed.");

  storage.calls = [];
  test.setNow(1_700_000_123_456);
  const result = await test.session.saveNow();

  expect(result.status).toBe("persistenceFailed");
  if (result.status !== "persistenceFailed") {
    throw new Error("Expected manual save to fail.");
  }
  expect(result.persistence.status).toBe("storageFailed");
  expect(result.state.simulation.lastActiveMs).toBe(1_700_000_123_456);
  expect(storage.calls).toEqual(["readPrimary", "writePrimary"]);
  expect(test.effects).toEqual([]);
});

it("exports the loader-compatible save projection without persisting it", async () => {
  const storage = new MemoryStorage();
  const test = createSessionInput({ storage });
  const initialized = await test.session.initialize();
  expect(initialized.status).toBe("ready");
  if (initialized.status !== "ready") throw new Error("Fresh session failed.");

  storage.calls = [];
  const result = await test.session.exportLegacySave();

  expect(result.status).toBe("exported");
  if (result.status !== "exported") throw new Error("Export did not complete.");
  expect(storage.calls).toEqual([]);
  expect(result.state.settings.exportFieldString).toBe(result.saveString);
  const decoded = decodeRemixLegacySave(result.saveString);
  expect(decoded.status).toBe("success");
  if (decoded.status !== "success") throw new Error("Export did not decode.");
  expect(decoded.value).toMatchObject({
    money: "0",
    gems: "5",
    lastActive: 1_700_000_000_000,
    mineObjectLevel: 0,
    settings: { numberFormatterIndex: 0, theme: "light" },
    story: { page: 0, notifications: 0, highestUnlocked: -1, scrollY: 0 },
  });
});

it("imports a text-field save, applies its theme, and persists Beyond state", async () => {
  const sourceSave = JSON.parse(
    corpus.data.saveApplicationSemantics.inputJson,
  ) as object;
  const storage = new MemoryStorage();
  const test = createSessionInput({ storage });
  const initialized = await test.session.initialize();
  expect(initialized.status).toBe("ready");
  if (initialized.status !== "ready") throw new Error("Fresh session failed.");

  storage.calls = [];
  const result = await test.session.importLegacySave(
    encodeRemixLegacySave(sourceSave),
  );

  expect(result.status).toBe("imported");
  if (result.status !== "imported") throw new Error("Import did not complete.");
  expect(result.state.settings.theme).toBe("dark");
  expect(result.state.simulation.resources.money.toString()).toBe(
    corpus.data.saveApplicationSemantics.resources.money.decimal,
  );
  expect(storage.calls).toEqual(["readPrimary", "writePrimary"]);
  expect(test.effects).toEqual(["theme:dark"]);
  const saved = decodeRemixBeyondSave(storage.primary ?? "");
  expect(saved.status).toBe("valid");
  if (saved.status !== "valid")
    throw new Error("Imported state was not saved.");
  expect(saved.save.state.simulation.resources.money).toBe(
    corpus.data.saveApplicationSemantics.resources.money.decimal,
  );
});

it("leaves current state and storage untouched when text-field decoding fails", async () => {
  const storage = new MemoryStorage();
  const test = createSessionInput({ storage });
  const initialized = await test.session.initialize();
  expect(initialized.status).toBe("ready");
  if (initialized.status !== "ready") throw new Error("Fresh session failed.");
  const originalState = test.session.getState();

  storage.calls = [];
  const result = await test.session.importLegacySave("not a save");

  expect(result.status).toBe("legacyLoadFailed");
  expect(test.session.getState()).toBe(originalState);
  expect(storage.calls).toEqual([]);
  expect(test.effects).toEqual([]);
});
