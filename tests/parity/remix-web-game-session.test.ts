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
