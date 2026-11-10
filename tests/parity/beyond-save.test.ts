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
) as {
  data: {
    initialState: { numberFormatters: string[] };
    mineObjectCatalog: RemixMineObjectCatalog;
  };
};

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

type JsonPathPart = string | number;

function collectJsonPaths(
  value: unknown,
  path: JsonPathPart[] = [],
): JsonPathPart[][] {
  const paths = [path];
  if (Array.isArray(value)) {
    value.forEach((child, index) => {
      paths.push(...collectJsonPaths(child, [...path, index]));
    });
  } else if (typeof value === "object" && value !== null) {
    for (const [key, child] of Object.entries(value)) {
      paths.push(...collectJsonPaths(child, [...path, key]));
    }
  }
  return paths;
}

function setJsonPath(
  root: unknown,
  path: JsonPathPart[],
  replacement: unknown,
): unknown {
  if (path.length === 0) return replacement;

  let parent = root;
  for (const part of path.slice(0, -1)) {
    if (Array.isArray(parent)) {
      parent = parent[Number(part)];
    } else if (typeof parent === "object" && parent !== null) {
      parent = (parent as Record<string, unknown>)[String(part)];
    } else {
      throw new Error(`JSON path does not exist: ${path.join(".")}`);
    }
  }

  const key = path.at(-1)!;
  if (Array.isArray(parent)) {
    parent[Number(key)] = replacement;
  } else if (typeof parent === "object" && parent !== null) {
    (parent as Record<string, unknown>)[String(key)] = replacement;
  } else {
    throw new Error(`JSON path parent is not a container: ${path.join(".")}`);
  }
  return root;
}

function collectObjectPaths(
  value: unknown,
  path: JsonPathPart[] = [],
): JsonPathPart[][] {
  if (Array.isArray(value)) {
    return value.flatMap((child, index) =>
      collectObjectPaths(child, [...path, index]),
    );
  }
  if (typeof value !== "object" || value === null) return [];

  return [
    path,
    ...Object.entries(value).flatMap(([key, child]) =>
      collectObjectPaths(child, [...path, key]),
    ),
  ];
}

function objectAtJsonPath(
  root: unknown,
  path: JsonPathPart[],
): Record<string, unknown> {
  let value = root;
  for (const part of path) {
    if (Array.isArray(value)) {
      value = value[Number(part)];
    } else if (typeof value === "object" && value !== null) {
      value = (value as Record<string, unknown>)[String(part)];
    } else {
      throw new Error(`JSON path does not exist: ${path.join(".")}`);
    }
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`JSON path is not an object: ${path.join(".")}`);
  }
  return value as Record<string, unknown>;
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
  expect(restored.settings.exportFieldString).toBe(
    "Exported String will appear here...",
  );
  expect(summarize(restored)).toEqual(
    summarize({
      ...state,
      settings: {
        ...state.settings,
        exportFieldString: "Exported String will appear here...",
      },
    }),
  );
  expect(restored.simulation.currentObject.id).toBe(210);
});

it("omits and restores an unset last-active timestamp", () => {
  const state = createInitialRemixLegacySaveApplicationState(
    createInitialRemixSimulationState(corpus.data.mineObjectCatalog),
  );
  expect(state.simulation.lastActiveMs).toBeUndefined();

  const encoded = encodeRemixBeyondSave(state);
  const serialized = JSON.parse(encoded) as {
    state: { simulation: Record<string, unknown> };
  };
  expect(Object.hasOwn(serialized.state.simulation, "lastActiveMs")).toBe(
    false,
  );

  const decoded = decodeRemixBeyondSave(encoded);
  expect(decoded.status).toBe("valid");
  if (decoded.status !== "valid") {
    throw new Error(`Expected a valid save, received ${decoded.status}.`);
  }
  const restored = restoreRemixBeyondSave(
    decoded.save,
    corpus.data.mineObjectCatalog,
  );
  expect(restored.simulation.lastActiveMs).toBeUndefined();
  expect(summarize(restored)).toEqual(summarize(state));
});

it("preserves a safe-integer high-water mark with an earlier object selected", () => {
  const state = stateWithEveryPersistedField(corpus.data.mineObjectCatalog);
  const boundaryState = {
    ...state,
    simulation: {
      ...state.simulation,
      mineObjectLevel: 0,
      highestMineObjectLevel: Number.MAX_SAFE_INTEGER,
    },
  };
  const decoded = decodeRemixBeyondSave(encodeRemixBeyondSave(boundaryState));

  expect(decoded.status).toBe("valid");
  if (decoded.status !== "valid") {
    throw new Error(`Expected a valid save, received ${decoded.status}.`);
  }
  const restored = restoreRemixBeyondSave(
    decoded.save,
    corpus.data.mineObjectCatalog,
  );
  expect(restored.simulation.mineObjectLevel).toBe(0);
  expect(restored.simulation.highestMineObjectLevel).toBe(
    Number.MAX_SAFE_INTEGER,
  );
  expect(restored.simulation.currentObject.id).toBe(0);
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

  const missingVersion = JSON.parse(encoded) as Record<string, unknown>;
  delete missingVersion["version"];
  expect(decodeRemixBeyondSave(JSON.stringify(missingVersion))).toMatchObject({
    status: "invalidSchema",
  });

  const invalidDecimal = JSON.parse(encoded) as {
    state: { simulation: { resources: { money: string } } };
  };
  invalidDecimal.state.simulation.resources.money = "not-a-decimal";
  expect(decodeRemixBeyondSave(JSON.stringify(invalidDecimal))).toMatchObject({
    status: "invalidSchema",
  });

  const formatterCount = corpus.data.initialState.numberFormatters.length;
  expect(formatterCount).toBe(40);
  for (const numberFormatterIndex of [-1, 39.5, formatterCount]) {
    const invalidFormatterIndex = JSON.parse(encoded) as {
      state: { settings: { numberFormatterIndex: number } };
    };
    invalidFormatterIndex.state.settings.numberFormatterIndex =
      numberFormatterIndex;
    expect(
      decodeRemixBeyondSave(JSON.stringify(invalidFormatterIndex)),
      `number formatter index ${numberFormatterIndex}`,
    ).toMatchObject({
      status: "invalidSchema",
      issues: expect.arrayContaining([
        expect.objectContaining({
          path: "state.settings.numberFormatterIndex",
        }),
      ]),
    });
  }
  expect(() =>
    encodeRemixBeyondSave({
      ...state,
      settings: { ...state.settings, numberFormatterIndex: formatterCount },
    }),
  ).toThrow();
  expect(() =>
    encodeRemixBeyondSave({
      ...state,
      simulation: {
        ...state.simulation,
        saveTimer: Number.POSITIVE_INFINITY,
      },
    }),
  ).toThrow();

  const invalidCurrentLevel = {
    ...state,
    simulation: { ...state.simulation, mineObjectLevel: 210.5 },
  };
  expect(() => encodeRemixBeyondSave(invalidCurrentLevel)).toThrow();
  expect(() =>
    encodeRemixBeyondSave({
      ...state,
      simulation: { ...state.simulation, highestMineObjectLevel: 209 },
    }),
  ).toThrow();

  for (const [path, value] of [
    [["state", "simulation", "mineObjectLevel"], -1],
    [["state", "simulation", "mineObjectLevel"], 210.5],
    [["state", "simulation", "mineObjectLevel"], Number.MAX_SAFE_INTEGER + 1],
    [["state", "simulation", "highestMineObjectLevel"], -1],
    [["state", "simulation", "highestMineObjectLevel"], 214.5],
    [
      ["state", "simulation", "highestMineObjectLevel"],
      Number.MAX_SAFE_INTEGER + 1,
    ],
    [["state", "simulation", "highestMineObjectLevel"], 209],
  ] as const) {
    const invalidLevel = setJsonPath(
      JSON.parse(encoded) as unknown,
      [...path],
      value,
    );
    expect(
      decodeRemixBeyondSave(JSON.stringify(invalidLevel)),
      `${path.join(".")}=${value}`,
    ).toMatchObject({
      status: "invalidSchema",
      issues: expect.arrayContaining([
        expect.objectContaining({ path: path.join(".") }),
      ]),
    });
  }

  const extraField = JSON.parse(encoded) as Record<string, unknown>;
  extraField["unrecognized"] = true;
  expect(decodeRemixBeyondSave(JSON.stringify(extraField))).toMatchObject({
    status: "invalidSchema",
  });
});

it("validates every v1 JSON node and rejects unknown keys at every object level", () => {
  const state = stateWithEveryPersistedField(corpus.data.mineObjectCatalog);
  const encoded = encodeRemixBeyondSave(state);
  const valid = JSON.parse(encoded) as unknown;

  for (const path of collectJsonPaths(valid)) {
    const corrupted = setJsonPath(JSON.parse(encoded) as unknown, path, null);
    const expectedStatus =
      path.length === 1 && path[0] === "version"
        ? "unsupportedVersion"
        : "invalidSchema";
    expect(
      decodeRemixBeyondSave(JSON.stringify(corrupted)).status,
      path.length === 0 ? "root" : path.join("."),
    ).toBe(expectedStatus);
  }

  for (const path of collectObjectPaths(valid)) {
    const corrupted = JSON.parse(encoded) as unknown;
    objectAtJsonPath(corrupted, path)["unexpectedAtThisLevel"] = true;
    expect(
      decodeRemixBeyondSave(JSON.stringify(corrupted)).status,
      path.length === 0 ? "root strictness" : `${path.join(".")} strictness`,
    ).toBe("invalidSchema");
  }
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
