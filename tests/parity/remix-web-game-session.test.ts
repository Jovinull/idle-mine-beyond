import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import {
  Decimal,
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
    pickaxeCraftingSemantics: {
      attempts: {
        input: {
          name: string;
          gems: string;
          equippedPickaxe: { name: string; power: string; quality: string };
          randomValues: number[];
        };
        randomCalls: number;
        saveCalls: number;
        eventOrder: string[];
        saveSnapshots: {
          gems: { decimal: string };
          pickaxe: {
            name: string;
            power: { decimal: string };
            quality: { decimal: string };
          };
        }[];
        result: {
          gems: { decimal: string };
          pickaxe: {
            name: string;
            power: { decimal: string };
            quality: { decimal: string };
          };
        };
      }[];
    };
    hardResetSemantics: {
      cancelled: {
        input: { confirmationAnswers: boolean[] };
        confirmationPrompts: string[];
      }[];
      confirmed: {
        confirmationPrompts: string[];
        after: {
          resources: {
            money: { decimal: string };
            gems: { decimal: string };
          };
          mineObject: { current: number; highest: number; name: string };
          settings: {
            tab: string;
            upgradeTab: string;
            exportFieldString: string;
            theme: string;
          };
          timer: { autoPickaxe: number; save: number };
          usedGemsLevel: number;
          lastActive: number;
        };
      };
    };
  };
};

const legacySaveTemplateDocument = JSON.parse(
  await readFile(
    new URL(
      "../../packages/content/src/remix-legacy-save-template.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as { template: Record<string, unknown> };

class MemoryStorage implements RemixBeyondSaveStorageAdapter {
  primary: string | null = null;
  backup: string | null = null;
  calls: string[] = [];
  primaryWrites: string[] = [];

  async readPrimary() {
    this.calls.push("readPrimary");
    return this.primary;
  }

  async writePrimary(serialized: string) {
    this.calls.push("writePrimary");
    this.primaryWrites.push(serialized);
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
    legacySaveTemplate:
      overrides.legacySaveTemplate ?? legacySaveTemplateDocument.template,
    storyMilestones: overrides.storyMilestones ?? [],
    random: overrides.random ?? new RemixRandom(13579),
    initialGameTimestampMs: overrides.initialGameTimestampMs ?? now,
    clock: overrides.clock ?? {
      now() {
        return now;
      },
    },
    storage: overrides.storage,
    clearAllStorage:
      overrides.clearAllStorage ??
      (async () => {
        overrides.storage.calls.push("clearAll");
        overrides.storage.primary = null;
        overrides.storage.backup = null;
      }),
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
    resolveNotationFormatter(index) {
      const formatter = createRemixFormatters()[index];
      if (!formatter) throw new Error(`Formatter ${index} is unavailable.`);
      return formatter;
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

it("recovers a damaged Beyond save from an explicitly supplied Remix save", async () => {
  const storage = new MemoryStorage();
  storage.primary = "damaged-primary";
  storage.backup = "damaged-backup";
  const test = createSessionInput({ storage });
  const initialized = await test.session.initialize();
  expect(initialized.status).toBe("recoveryRequired");

  const legacy = JSON.parse(corpus.data.saveApplicationSemantics.inputJson) as {
    lastActive: number;
    settings: { theme: string };
  };
  legacy.lastActive = 1_700_000_000_000;
  legacy.settings.theme = "dark";
  const recovered = await test.session.recoverLegacySave(
    encodeRemixLegacySave(legacy),
  );

  expect(recovered.status).toBe("recovered");
  if (recovered.status !== "recovered") {
    throw new Error("The explicit legacy recovery did not complete.");
  }
  expect(recovered.state.settings.theme).toBe("dark");
  expect(storage.backup).toBe("damaged-primary");
  expect(decodeRemixBeyondSave(storage.primary!).status).toBe("valid");
  expect(test.effects).toEqual(["theme:dark"]);
  expect(test.legacyReadCount).toBe(0);

  const afterRecovery = await test.session.initialize();
  expect(afterRecovery).toMatchObject({
    status: "ready",
    source: "legacy",
    state: recovered.state,
  });
});

it("recovers a damaged Beyond save from a selected Beyond recovery file", async () => {
  const sourceStorage = new MemoryStorage();
  const sourceSession = createSessionInput({ storage: sourceStorage });
  expect((await sourceSession.session.initialize()).status).toBe("ready");
  expect((await sourceSession.session.saveNow()).status).toBe("saved");
  const recoveryFile = sourceStorage.primary;
  expect(recoveryFile).not.toBeNull();

  const storage = new MemoryStorage();
  storage.primary = "damaged-primary";
  storage.backup = "damaged-backup";
  const test = createSessionInput({ storage });
  expect((await test.session.initialize()).status).toBe("recoveryRequired");

  const recovered = await test.session.recoverBeyondSaveFile(recoveryFile!);

  expect(recovered.status).toBe("recovered");
  if (recovered.status !== "recovered") {
    throw new Error("The Beyond recovery file did not restore the session.");
  }
  expect(recovered.state.settings.theme).toBe("light");
  expect(storage.backup).toBe("damaged-primary");
  expect(decodeRemixBeyondSave(storage.primary!).status).toBe("valid");
  expect(test.effects).toEqual(["theme:light"]);
  expect(test.legacyReadCount).toBe(0);
  expect(await test.session.initialize()).toMatchObject({
    status: "ready",
    source: "recoveryFile",
  });
});

it("leaves both damaged slots untouched when recovery input is invalid", async () => {
  const storage = new MemoryStorage();
  storage.primary = "damaged-primary";
  storage.backup = "damaged-backup";
  const test = createSessionInput({ storage });
  expect((await test.session.initialize()).status).toBe("recoveryRequired");
  storage.calls = [];

  const recovered = await test.session.recoverLegacySave("not-a-Remix-save");

  expect(recovered.status).toBe("legacyLoadFailed");
  expect(storage.primary).toBe("damaged-primary");
  expect(storage.backup).toBe("damaged-backup");
  expect(storage.calls).toEqual([]);
  expect(storage.primaryWrites).toEqual([]);
  expect(test.effects).toEqual([]);
  expect(test.session.getState()).toBeUndefined();
});

it("keeps an unsupported future save untouched during legacy recovery", async () => {
  const storage = new MemoryStorage();
  storage.primary = JSON.stringify({
    format: "idle-mine-beyond",
    version: 2,
    state: {},
  });
  storage.backup = "keep-backup";
  const test = createSessionInput({ storage });
  expect((await test.session.initialize()).status).toBe("recoveryRequired");

  const legacy = JSON.parse(corpus.data.saveApplicationSemantics.inputJson) as {
    lastActive: number;
  };
  legacy.lastActive = 1_700_000_000_000;
  const recovered = await test.session.recoverLegacySave(
    encodeRemixLegacySave(legacy),
  );

  expect(recovered.status).toBe("persistenceFailed");
  if (recovered.status !== "persistenceFailed") {
    throw new Error("The future version should remain protected.");
  }
  expect(recovered.result.persistence.status).toBe("incompatibleSave");
  expect(storage.primary).toContain('"version":2');
  expect(storage.backup).toBe("keep-backup");
  expect(storage.primaryWrites).toEqual([]);
  expect(test.effects).toEqual([]);
  expect(test.session.getState()).toBeUndefined();
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

it("exports the complete source save without persisting it", async () => {
  const storage = new MemoryStorage();
  const test = createSessionInput({ storage });
  const initialized = await test.session.initialize();
  expect(initialized.status).toBe("ready");
  if (initialized.status !== "ready") throw new Error("Fresh session failed.");

  storage.calls = [];
  const messageLog = [
    { message: "Recent event", color: "#123456" },
    { message: "Older event", color: "#654321" },
  ];
  const result = await test.session.exportLegacySave(messageLog);

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
    currentMineObject: { name: "Mud" },
    messageLog,
    settings: { numberFormatterIndex: 0, theme: "light" },
    story: { page: 0, notifications: 0, highestUnlocked: -1, scrollY: 0 },
  });
  const decodedSave = decoded.value as Record<string, unknown>;
  expect(Object.keys(decodedSave)).toHaveLength(27);
  expect(decodedSave["numberFormatters"]).toHaveLength(40);
  expect(decodedSave["mineObjects"]).toHaveLength(72);
  expect(decodedSave["specialMineObjects"]).toHaveLength(78);
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

it("routes stochastic craft feedback and intermediate saves in Remix order", async () => {
  const attempt = corpus.data.pickaxeCraftingSemantics.attempts.find(
    ({ input }) =>
      input.name === "bulk-replacements-save-each-intermediate-state",
  );
  if (!attempt) throw new Error("The captured bulk craft case is missing.");
  const storage = new MemoryStorage();
  let randomIndex = 0;
  const test = createSessionInput({
    storage,
    random: {
      nextDouble() {
        return attempt.input.randomValues[randomIndex++] ?? 0.5;
      },
    },
  });
  await test.session.initialize();
  test.effects.length = 0;
  storage.calls.length = 0;
  storage.primaryWrites.length = 0;

  await test.session.updateApplicationState((state) => ({
    ...state,
    simulation: {
      ...state.simulation,
      resources: { ...state.simulation.resources, gems: new Decimal("6") },
      usedGemsLevel: 1,
      upgrades: {
        ...state.simulation.upgrades,
        money: { ...state.simulation.upgrades.money, gemWaster: 1 },
        planetCoins: { ...state.simulation.upgrades.planetCoins, bulkCraft: 1 },
      },
    },
  }));
  const dispatched = await test.session.dispatch({
    type: "craftPickaxe",
    shiftHeld: true,
  });
  expect(dispatched.status).toBe("applied");
  if (dispatched.status !== "applied") {
    throw new Error("Captured bulk craft did not complete.");
  }

  expect(randomIndex).toBe(attempt.randomCalls);
  expect(storage.primaryWrites).toHaveLength(attempt.saveCalls);
  expect(test.effects).toEqual(
    attempt.eventOrder.map((event) =>
      event === "save" ? "log:Game Saved!" : event,
    ),
  );
  expect(dispatched.state.simulation.resources.gems.toString()).toBe(
    attempt.result.gems.decimal,
  );
  expect(dispatched.state.simulation.pickaxe).toMatchObject({
    name: attempt.result.pickaxe.name,
    power: new Decimal(attempt.result.pickaxe.power.decimal),
    quality: new Decimal(attempt.result.pickaxe.quality.decimal),
  });

  const persistedSnapshots = storage.primaryWrites.map((serialized) => {
    const decoded = decodeRemixBeyondSave(serialized);
    expect(decoded.status).toBe("valid");
    if (decoded.status !== "valid") {
      throw new Error("Captured craft snapshot failed to decode.");
    }
    return {
      gems: decoded.save.state.simulation.resources.gems,
      pickaxe: decoded.save.state.simulation.pickaxe,
    };
  });
  expect(persistedSnapshots).toEqual(
    attempt.saveSnapshots.map(({ gems, pickaxe }) => ({
      gems: gems.decimal,
      pickaxe: {
        name: pickaxe.name,
        power: pickaxe.power.decimal,
        quality: pickaxe.quality.decimal,
      },
    })),
  );
});

it("formats dud feedback and leaves unaffordable craft RNG untouched", async () => {
  const dud = corpus.data.pickaxeCraftingSemantics.attempts.find(
    ({ input }) => input.name === "equal-damage-is-a-dud",
  );
  const insufficient = corpus.data.pickaxeCraftingSemantics.attempts.find(
    ({ input }) => input.name === "insufficient-gems-consumes-no-rng",
  );
  if (!dud || !insufficient)
    throw new Error("The captured dud or insufficient-Gem case is missing.");
  const storage = new MemoryStorage();
  let randomIndex = 0;
  const test = createSessionInput({
    storage,
    random: {
      nextDouble() {
        return dud.input.randomValues[randomIndex++] ?? 0.5;
      },
    },
  });
  await test.session.initialize();
  test.effects.length = 0;

  await test.session.updateApplicationState((state) => ({
    ...state,
    simulation: {
      ...state.simulation,
      resources: {
        ...state.simulation.resources,
        gems: new Decimal(dud.input.gems),
      },
      pickaxe: {
        name: dud.input.equippedPickaxe.name,
        power: new Decimal(dud.input.equippedPickaxe.power),
        quality: new Decimal(dud.input.equippedPickaxe.quality),
      },
    },
  }));
  const dudResult = await test.session.dispatch({
    type: "craftPickaxe",
    shiftHeld: false,
  });
  expect(dudResult.status).toBe("applied");
  expect(randomIndex).toBe(dud.randomCalls);
  expect(test.effects).toEqual(dud.eventOrder);
  expect(storage.primaryWrites).toEqual([]);

  await test.session.updateApplicationState((state) => ({
    ...state,
    simulation: {
      ...state.simulation,
      resources: { ...state.simulation.resources, gems: new Decimal("0.5") },
    },
  }));
  randomIndex = 0;
  const insufficientResult = await test.session.dispatch({
    type: "craftPickaxe",
    shiftHeld: false,
  });
  expect(insufficientResult.status).toBe("applied");
  expect(randomIndex).toBe(0);
  expect(test.effects).toEqual([...dud.eventOrder, ...insufficient.eventOrder]);
  expect(storage.primaryWrites).toEqual([]);
});

it("matches source Hard Reset cancellations and confirmed storage/state order", async () => {
  const resetFixture = corpus.data.hardResetSemantics;
  const seedCurrentState = async (
    test: ReturnType<typeof createSessionInput>,
  ) => {
    const result = await test.session.updateApplicationState((current) => ({
      ...current,
      simulation: {
        ...current.simulation,
        resources: {
          ...current.simulation.resources,
          money: new Decimal(12345),
        },
        autoPickaxeTimer: 0.25,
        saveTimer: 41,
        lastActiveMs: resetFixture.confirmed.after.lastActive - 10_000,
      },
      settings: {
        ...current.settings,
        tab: "settings",
        upgradeTab: "planetcoins",
        exportFieldString: "old export text",
        theme: "dark",
        showMineObjLevel: true,
        showMinCraftDamage: true,
      },
    }));
    expect(result.status).toBe("updated");
  };

  for (const scenario of resetFixture.cancelled) {
    const storage = new MemoryStorage();
    const test = createSessionInput({ storage });
    const initialized = await test.session.initialize();
    expect(initialized.status).toBe("ready");
    if (initialized.status !== "ready")
      throw new Error("Fresh session failed.");
    await seedCurrentState(test);
    const before = test.session.getState();
    storage.primary = "keep-primary";
    storage.backup = "keep-backup";
    storage.calls = [];
    const prompts: string[] = [];

    const result = await test.session.hardReset((message) => {
      prompts.push(message);
      return scenario.input.confirmationAnswers[prompts.length - 1] ?? false;
    });

    expect(result.status).toBe("cancelled");
    if (result.status !== "cancelled")
      throw new Error("Cancelled reset changed state.");
    expect(result.confirmationPrompts).toEqual(scenario.confirmationPrompts);
    expect(prompts).toEqual(scenario.confirmationPrompts);
    expect(test.session.getState()).toBe(before);
    expect(storage.primary).toBe("keep-primary");
    expect(storage.backup).toBe("keep-backup");
    expect(storage.calls).toEqual([]);
  }

  const storage = new MemoryStorage();
  const test = createSessionInput({
    storage,
    initialGameTimestampMs: resetFixture.confirmed.after.lastActive,
  });
  const initialized = await test.session.initialize();
  expect(initialized.status).toBe("ready");
  if (initialized.status !== "ready") throw new Error("Fresh session failed.");
  await seedCurrentState(test);
  storage.primary = "clear-primary";
  storage.backup = "clear-backup";
  storage.calls = [];
  const prompts: string[] = [];

  const result = await test.session.hardReset((message) => {
    prompts.push(message);
    return true;
  });

  expect(result.status).toBe("reset");
  if (result.status !== "reset")
    throw new Error("Confirmed reset did not complete.");
  expect(result.confirmationPrompts).toEqual(
    resetFixture.confirmed.confirmationPrompts,
  );
  expect(prompts).toEqual(resetFixture.confirmed.confirmationPrompts);
  expect(storage.calls).toEqual(["clearAll"]);
  expect(storage.primary).toBeNull();
  expect(storage.backup).toBeNull();
  expect(result.state.simulation.resources.money.toString()).toBe(
    resetFixture.confirmed.after.resources.money.decimal,
  );
  expect(result.state.simulation.resources.gems.toString()).toBe(
    resetFixture.confirmed.after.resources.gems.decimal,
  );
  expect(result.state.simulation.mineObjectLevel).toBe(
    resetFixture.confirmed.after.mineObject.current,
  );
  expect(result.state.simulation.currentObject.name).toBe(
    resetFixture.confirmed.after.mineObject.name,
  );
  expect(result.state.simulation.autoPickaxeTimer).toBe(
    resetFixture.confirmed.after.timer.autoPickaxe,
  );
  expect(result.state.simulation.saveTimer).toBe(
    resetFixture.confirmed.after.timer.save,
  );
  expect(result.state.simulation.usedGemsLevel).toBe(
    resetFixture.confirmed.after.usedGemsLevel,
  );
  expect(result.state.simulation.lastActiveMs).toBe(
    resetFixture.confirmed.after.lastActive,
  );
  expect(result.state.settings).toMatchObject(
    resetFixture.confirmed.after.settings,
  );
  expect(test.effects).toEqual(["theme:light"]);
});
