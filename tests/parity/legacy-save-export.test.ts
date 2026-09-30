import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import {
  createInitialRemixSimulationState,
  getRemixMineObject,
  type RemixMineObjectCatalog,
} from "../../packages/core/src/index.js";
import { createInitialRemixLegacySaveApplicationState } from "../../packages/persistence/src/remix-legacy-save-application.js";
import type { RemixLegacySaveApplicationState } from "../../packages/persistence/src/remix-legacy-save-application.js";
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
  metadata: { sourceCommit: string };
  data: {
    mineObjectCatalog: RemixMineObjectCatalog;
    saveApplicationSemantics: {
      inputJson: string;
      resources: { money: { decimal: string } };
    };
    saveExportSemantics: {
      fresh: {
        object: Record<string, unknown>;
        jsonUtf8Bytes: number;
        jsonSha256: string;
        saveStringAsciiBytes: number;
        saveStringSha256: string;
      };
      controlled: {
        object: Record<string, unknown>;
        jsonUtf8Bytes: number;
        jsonSha256: string;
        saveStringAsciiBytes: number;
        saveStringSha256: string;
      };
      variants: {
        name: string;
        changedFields: string[];
        decimalFields?: {
          resources: Record<string, string>;
          powerValues: string[];
          pickaxe: { power: string; quality: string };
        };
        mineObjectLevel: number;
        highestMineObjectLevel: number;
        lastActive: number;
        currentMineObject: Record<string, unknown>;
        messageLog: { message: string; color: string }[];
        settings: {
          theme: string;
          tab: string;
          upgradeTab: string;
          numberFormatterIndex: number;
          exportFieldString: string;
          showMineObjLevel: boolean;
          showMinCraftDamage: boolean;
        };
        jsonUtf8Bytes: number;
        jsonSha256: string;
        saveStringAsciiBytes: number;
        saveStringSha256: string;
        inputJson?: string;
      }[];
    };
  };
};

const legacySaveTemplatePackage = JSON.parse(
  await readFile(
    new URL(
      "../../packages/content/src/remix-legacy-save-template.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as { source: { commit: string }; template: Record<string, unknown> };

expect(legacySaveTemplatePackage.source.commit).toBe(
  corpus.metadata.sourceCommit,
);

const legacySaveTemplate = legacySaveTemplatePackage.template;

function freshApplicationState() {
  return createInitialRemixLegacySaveApplicationState(
    createInitialRemixSimulationState(corpus.data.mineObjectCatalog),
  );
}

function loadWithoutOffline(
  saveString: string,
  state: RemixLegacySaveApplicationState = freshApplicationState(),
) {
  return loadRemixLegacySaveIntoState({
    state,
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
    legacySaveTemplate,
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

it("reconstructs exact fresh and controlled full Remix save objects and bytes", () => {
  const snapshots = corpus.data.saveExportSemantics;
  const fresh = createRemixLegacySaveExportData(
    freshApplicationState(),
    snapshots.fresh.object["lastActive"] as number,
    legacySaveTemplate,
  );
  const compareExactSnapshot = (
    actual: Record<string, unknown>,
    expected: (typeof snapshots)["fresh"],
  ) => {
    expect(actual).toEqual(expected.object);
    const json = JSON.stringify(actual);
    const encoded = encodeRemixLegacySave(actual);
    expect(Buffer.byteLength(json, "utf8")).toBe(expected.jsonUtf8Bytes);
    expect(createHash("sha256").update(json).digest("hex")).toBe(
      expected.jsonSha256,
    );
    expect(encoded).toHaveLength(expected.saveStringAsciiBytes);
    expect(createHash("sha256").update(encoded).digest("hex")).toBe(
      expected.saveStringSha256,
    );
  };

  compareExactSnapshot(fresh, snapshots.fresh);

  const loaded = loadWithoutOffline(
    encodeRemixLegacySave(
      JSON.parse(corpus.data.saveApplicationSemantics.inputJson) as object,
    ),
  );
  expect(loaded.status).toBe("loaded");
  if (loaded.status !== "loaded") {
    throw new Error("The controlled source save could not be loaded.");
  }
  const controlledState = {
    ...loaded.state,
    settings: { ...loaded.state.settings, tab: "settings" },
  };
  const controlled = createRemixLegacySaveExportData(
    controlledState,
    snapshots.controlled.object["lastActive"] as number,
    legacySaveTemplate,
  );
  compareExactSnapshot(controlled, snapshots.controlled);
});

it("matches full-save hashes across generated objects and dynamic states", () => {
  const expectedChanges: Record<string, string[]> = {
    "generated-wisdom-drop-215": [
      "currentMineObject",
      "mineObjectLevel",
      "highestMineObjectLevel",
      "settings",
    ],
    "generated-planet-coin-drop-216": [
      "currentMineObject",
      "mineObjectLevel",
      "highestMineObjectLevel",
      "settings",
    ],
    "generated-first-after-base-72": [
      "currentMineObject",
      "mineObjectLevel",
      "highestMineObjectLevel",
      "settings",
    ],
    "generated-first-after-anchor-125": [
      "currentMineObject",
      "mineObjectLevel",
      "highestMineObjectLevel",
      "settings",
    ],
    "generated-late-universe-244": [
      "currentMineObject",
      "mineObjectLevel",
      "highestMineObjectLevel",
      "settings",
    ],
    "message-log-cap": ["messageLog", "settings"],
    "settings-and-notation-only": ["settings"],
    "money-upgrades-only": ["upgrades", "settings"],
    "gem-upgrades-only": ["gemUpgrades", "settings"],
    "planet-coin-upgrades-only": ["planetCoinUpgrades", "settings"],
    "wisdom-upgrades-only": ["powers", "settings"],
    "varied-settings-and-all-upgrades": [
      "lastActive",
      "money",
      "highestMoney",
      "gems",
      "pickaxe",
      "upgrades",
      "gemUpgrades",
      "planetCoins",
      "maxPlanetCoins",
      "planetCoinUpgrades",
      "wisdom",
      "maxWisdom",
      "powers",
      "story",
      "settings",
    ],
    "high-magnitude-decimal-fields": [
      "money",
      "highestMoney",
      "gems",
      "pickaxe",
      "currentMineObject",
      "mineObjectLevel",
      "highestMineObjectLevel",
      "planetCoins",
      "maxPlanetCoins",
      "wisdom",
      "maxWisdom",
      "powers",
      "story",
      "settings",
    ],
  };
  for (const variant of corpus.data.saveExportSemantics.variants) {
    expect(variant.changedFields, variant.name).toEqual(
      expectedChanges[variant.name],
    );
    const initial = freshApplicationState();
    let state: RemixLegacySaveApplicationState;
    let variantInput: Record<string, unknown> | undefined;
    if (variant.inputJson !== undefined) {
      variantInput = JSON.parse(variant.inputJson) as Record<string, unknown>;
      const seededState = {
        ...initial,
        settings: {
          ...initial.settings,
          tab: "powers",
          upgradeTab: "planetcoins",
        },
      };
      const loaded = loadWithoutOffline(
        encodeRemixLegacySave(variantInput),
        seededState,
      );
      expect(loaded.status, variant.name).toBe("loaded");
      if (loaded.status !== "loaded") {
        throw new Error(`The ${variant.name} source save failed to load.`);
      }
      state = loaded.state;
    } else {
      state = {
        ...initial,
        simulation:
          variant.mineObjectLevel === 0
            ? initial.simulation
            : {
                ...initial.simulation,
                mineObjectLevel: variant.mineObjectLevel,
                highestMineObjectLevel: variant.highestMineObjectLevel,
                currentObject: getRemixMineObject(
                  variant.mineObjectLevel,
                  corpus.data.mineObjectCatalog,
                ),
              },
        settings: { ...initial.settings, ...variant.settings },
      };
    }
    const exported = createRemixLegacySaveExportData(
      state,
      variant.lastActive,
      legacySaveTemplate,
      variant.messageLog,
    );
    expect(exported["mineObjectLevel"], variant.name).toBe(
      variant.mineObjectLevel,
    );
    expect(exported["highestMineObjectLevel"], variant.name).toBe(
      variant.highestMineObjectLevel,
    );
    expect(exported["currentMineObject"], variant.name).toEqual(
      variant.currentMineObject,
    );
    expect(exported["messageLog"], variant.name).toEqual(variant.messageLog);
    expect(exported["settings"], variant.name).toEqual(variant.settings);

    if (variantInput !== undefined) {
      const expectedResourceFields = [
        "money",
        "highestMoney",
        "gems",
        "planetCoins",
        "maxPlanetCoins",
        "wisdom",
        "maxWisdom",
      ];
      for (const key of expectedResourceFields) {
        expect(exported[key], `${variant.name}: ${key}`).toBe(
          variant.decimalFields?.resources[key] ?? variantInput[key],
        );
      }
      for (const key of ["upgrades", "gemUpgrades", "planetCoinUpgrades"]) {
        const actual = exported[key] as Record<string, { level: number }>;
        const expected = variantInput[key] as Record<string, { level: number }>;
        expect(Object.keys(actual), `${variant.name}: ${key}`).toEqual(
          Object.keys(expected),
        );
        for (const upgrade of Object.keys(expected)) {
          expect(
            actual[upgrade]?.level,
            `${variant.name}: ${key}.${upgrade}`,
          ).toBe(expected[upgrade]?.level);
        }
      }
      const exportedPowers = exported["powers"] as {
        data: { values: string[] };
      };
      const expectedPowers = variantInput["powers"] as {
        data: { values: string[] };
        upgrades: Record<string, { level: number }>;
      };
      expect(exportedPowers.data.values).toEqual(
        variant.decimalFields?.powerValues ?? expectedPowers.data.values,
      );
      if (variant.decimalFields) {
        expect(Object.keys(variant.decimalFields.resources)).toEqual(
          expectedResourceFields,
        );
        expect(exported["pickaxe"]).toMatchObject({
          pow: variant.decimalFields.pickaxe.power,
          quality: variant.decimalFields.pickaxe.quality,
        });
      }
      const actualWisdomUpgrades = (
        exported["powers"] as {
          upgrades: Record<string, { level: number }>;
        }
      ).upgrades;
      expect(Object.keys(actualWisdomUpgrades)).toEqual(
        Object.keys(expectedPowers.upgrades),
      );
      for (const upgrade of Object.keys(expectedPowers.upgrades)) {
        expect(actualWisdomUpgrades[upgrade]?.level).toBe(
          expectedPowers.upgrades[upgrade]?.level,
        );
      }
      expect(exported["story"]).toMatchObject(
        variantInput["story"] as Record<string, unknown>,
      );
    }

    const json = JSON.stringify(exported);
    const encoded = encodeRemixLegacySave(exported);
    expect(Buffer.byteLength(json, "utf8"), variant.name).toBe(
      variant.jsonUtf8Bytes,
    );
    expect(createHash("sha256").update(json).digest("hex"), variant.name).toBe(
      variant.jsonSha256,
    );
    expect(encoded.length, variant.name).toBe(variant.saveStringAsciiBytes);
    expect(
      createHash("sha256").update(encoded).digest("hex"),
      variant.name,
    ).toBe(variant.saveStringSha256);
  }

  const cappedLog = corpus.data.saveExportSemantics.variants.find(
    (variant) => variant.name === "message-log-cap",
  );
  expect(cappedLog?.messageLog).toHaveLength(6);
  expect(cappedLog?.messageLog[0]?.message).toBe("Export probe 7");
  expect(cappedLog?.messageLog.at(-1)?.message).toBe("Export probe 2");
});

it("covers high-magnitude Decimal fields in a Remix save export", () => {
  const variant = corpus.data.saveExportSemantics.variants.find(
    (candidate) => candidate.name === "high-magnitude-decimal-fields",
  );
  expect(variant).toBeDefined();
  if (!variant?.inputJson) return;

  const input = JSON.parse(variant.inputJson) as {
    money: string;
    highestMoney: string;
    gems: string;
    planetCoins: string;
    maxPlanetCoins: string;
    wisdom: string;
    maxWisdom: string;
    powers: { data: { values: string[] } };
    pickaxe: { pow: string; quality: string };
  };
  expect(input).toMatchObject({
    money: "1.2345678901234567e+100000",
    highestMoney: "9.876543210987654e+100001",
    gems: "3.141592653589793e+75000",
    planetCoins: "2.718281828459045e+50000",
    maxPlanetCoins: "9.999999999999999e+50000",
    wisdom: "1.618033988749895e+25000",
    maxWisdom: "2.414213562373095e+25000",
    powers: {
      data: {
        values: ["1e+15000", "2e+20000", "3e+25000", "4e+30000", "5e+35000"],
      },
    },
    pickaxe: { pow: "6.02214076e+40000", quality: "2.99792458e+35000" },
  });
  expect(variant.changedFields).toContain("powers");
  expect(variant.changedFields).toContain("pickaxe");
  expect(variant.decimalFields).toBeDefined();
  expect(variant.decimalFields?.resources).toHaveProperty(
    "maxPlanetCoins",
    "9.999999999999998e+50000",
  );
});
