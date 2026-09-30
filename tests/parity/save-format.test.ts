import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { encodeRemixLegacySave } from "../../packages/persistence/src/index.js";

type SerializableShape = {
  type: string;
  fields?: Record<string, SerializableShape>;
  length?: number;
  elementShapes?: readonly { count: number; shape: SerializableShape }[];
};

const corpus = JSON.parse(
  await readFile(
    new URL("../fixtures/parity/remix-reference-corpus.json", import.meta.url),
    "utf8",
  ),
) as {
  metadata: { sourceCommit: string };
  data: {
    saveSemantics: {
      sourcePaths: string[];
      storageKey: string;
      encoding: {
        encodeOrder: string[];
        decodeOrder: string[];
        decodedMatchesJson: boolean;
        firstDifference: {
          index: number;
          serializedCodeUnit: number;
          decodedCodeUnit: number;
        };
        base64AlphabetOnly: boolean;
      };
      currentShape: {
        versionFieldPresent: boolean;
        topLevelKeys: string[];
        decimalFields: Record<string, { type: string; value: string }>;
        collectionLengths: Record<string, number>;
        nestedKeys: Record<string, readonly string[]>;
        serializableShape: SerializableShape;
        omittedUpgradeFunctions: { price: boolean; effect: boolean };
      };
      missingOptionalGroups: {
        inputKeys: string[];
        resources: Record<string, { decimal: string }>;
        story: {
          page: number;
          notifications: number;
          highestUnlocked: number;
          scrollY: number;
        };
        settings: { tab: string; theme: string };
        upgradeLevels: Record<string, number>;
        power: { upgradeLevel: number; firstValue: { decimal: string } };
        pickaxe: {
          name: string;
          power: { decimal: string };
          quality: { decimal: string };
        };
      };
      fieldApplicationErrors: {
        name: string;
        inputJson: string;
        thrownErrorName: string | null;
        stateAfter: {
          money: { decimal: string };
          mineObjectLevel: number;
          story: {
            page: number;
            notifications: number;
            highestUnlocked: number;
            scrollY: number;
          };
          settings: { theme: string; numberFormatterIndex: number };
          upgradeLevels: Record<string, number>;
          powers: { decimal: string }[];
          pickaxe: {
            name: string;
            power: { decimal: string };
            quality: { decimal: string };
          };
        };
      }[];
      unicodePickaxeRoundTrip: {
        sourceName: string;
        importedName: string;
        preserved: boolean;
      };
    };
    saveExportSemantics: {
      sourcePaths: string[];
      fresh: LegacySaveExportSnapshot;
      controlled: LegacySaveExportSnapshot;
    };
  };
};

type LegacySaveExportSnapshot = {
  object: Record<string, unknown>;
  jsonUtf8Bytes: number;
  jsonSha256: string;
  saveStringAsciiBytes: number;
  saveStringSha256: string;
};

const save = corpus.data.saveSemantics;

it("captures the pinned versionless save shape and encoding order", () => {
  expect(corpus.metadata.sourceCommit).toBe(
    "0e0f4bf5a9c66e5603cda2ce4bd54213023dae21",
  );
  expect(save.sourcePaths).toEqual([
    "Scripts/Define/functions.js",
    "Scripts/Define/game.js",
    "index.html",
  ]);
  expect(save.storageKey).toBe("IdleMine");
  expect(save.encoding.encodeOrder).toEqual([
    "JSON.stringify(game)",
    "encodeURIComponent",
    "escape",
    "btoa",
  ]);
  expect(save.encoding.decodeOrder).toEqual([
    "atob",
    "decodeURIComponent",
    "unescape",
    "JSON.parse",
  ]);
  expect(save.currentShape.versionFieldPresent).toBe(false);
  expect(save.currentShape.topLevelKeys).toContain("story");
  expect(save.currentShape.topLevelKeys).toContain("pickaxe");
  expect(save.currentShape.decimalFields).toMatchObject({
    money: { type: "string", value: "0" },
    gems: { type: "string", value: "5" },
  });
  expect(save.currentShape.collectionLengths).toMatchObject({
    numberFormatters: 40,
    mineObjects: 72,
    specialMineObjects: 78,
    powersValues: 5,
  });
  expect(save.currentShape.omittedUpgradeFunctions).toEqual({
    price: true,
    effect: true,
  });
  expect(save.encoding.base64AlphabetOnly).toBe(true);
});

it("describes every enumerable field in the serialized Remix game object", () => {
  const shape = save.currentShape.serializableShape;
  expect(shape.type).toBe("object");

  const fields = shape.fields ?? {};
  expect(Object.keys(fields)).toEqual(save.currentShape.topLevelKeys);
  const arrays: Record<string, SerializableShape | undefined> = {
    numberFormatters: fields["numberFormatters"],
    mineObjects: fields["mineObjects"],
    specialMineObjects: fields["specialMineObjects"],
    powersValues: fields["powers"]?.fields?.["data"]?.fields?.["values"],
    messageLog: fields["messageLog"],
  };
  for (const [key, length] of Object.entries(
    save.currentShape.collectionLengths,
  )) {
    const arrayShape = arrays[key];
    expect(arrayShape, `${key} should have a shape entry`).toBeDefined();
    expect(arrayShape).toMatchObject({ type: "array", length });
    expect(
      arrayShape?.elementShapes?.reduce((sum, entry) => sum + entry.count, 0),
    ).toBe(length);
  }

  for (const group of [
    "settings",
    "story",
    "upgrades",
    "gemUpgrades",
    "planetCoinUpgrades",
    "powers",
    "pickaxe",
  ]) {
    expect(Object.keys(fields[group]?.fields ?? {})).toEqual(
      save.currentShape.nestedKeys[group],
    );
  }
  expect(Object.keys(fields["powers"]?.fields?.["data"]?.fields ?? {})).toEqual(
    save.currentShape.nestedKeys["powersData"],
  );
});

it("captures full legacy save objects and exact encoded bytes", () => {
  const snapshots = corpus.data.saveExportSemantics;
  expect(snapshots.sourcePaths).toEqual([
    "Scripts/Define/functions.js",
    "Scripts/Define/game.js",
    "Scripts/mineobject.js",
    "Scripts/upgrade.js",
  ]);

  for (const snapshot of [snapshots.fresh, snapshots.controlled]) {
    const json = JSON.stringify(snapshot.object);
    const encoded = encodeRemixLegacySave(snapshot.object);
    expect(Buffer.byteLength(json, "utf8")).toBe(snapshot.jsonUtf8Bytes);
    expect(createHash("sha256").update(json).digest("hex")).toBe(
      snapshot.jsonSha256,
    );
    expect(encoded).toMatch(/^[A-Za-z0-9+/]*={0,2}$/);
    expect(encoded).toHaveLength(snapshot.saveStringAsciiBytes);
    expect(createHash("sha256").update(encoded).digest("hex")).toBe(
      snapshot.saveStringSha256,
    );
    expect(JSON.parse(json)).toEqual(snapshot.object);
  }

  expect(Object.keys(snapshots.fresh.object)).toEqual(
    corpus.data.saveSemantics.currentShape.topLevelKeys,
  );
  expect(snapshots.fresh.object).toMatchObject({
    money: "0",
    gems: "5",
    mineObjectLevel: 0,
    highestMineObjectLevel: 0,
    currentMineObject: { name: "Mud" },
    settings: { theme: "light", numberFormatterIndex: 0 },
  });
  expect(snapshots.controlled.object).toMatchObject({
    money: "123.50000000000001",
    gems: "23",
    mineObjectLevel: 3,
    highestMineObjectLevel: 8,
    currentMineObject: { name: "Clay" },
    pickaxe: { name: "Probe Pickaxe", pow: "123", quality: "4" },
    story: { page: 2, notifications: 4, highestUnlocked: 17, scrollY: 123 },
    settings: {
      tab: "settings",
      numberFormatterIndex: 3,
      theme: "dark",
    },
  });
});

it("preserves the observed Unicode corruption and partial-save defaults", () => {
  expect(save.encoding.decodedMatchesJson).toBe(false);
  expect(save.encoding.firstDifference).toEqual({
    index: 133,
    serializedCodeUnit: 0xd83d,
    decodedCodeUnit: 0x00f0,
  });

  const originalName = "Probe \u2014 \u00c5 \u03a9 \u2192";
  const oneByteCharacters = [...Buffer.from(originalName, "utf8")]
    .map((byte) => String.fromCharCode(byte))
    .join("");
  expect(save.unicodePickaxeRoundTrip).toEqual({
    sourceName: originalName,
    importedName: oneByteCharacters,
    preserved: false,
  });

  expect(save.missingOptionalGroups.inputKeys).toEqual(["story"]);
  expect(
    Object.values(save.missingOptionalGroups.resources).map(
      ({ decimal }) => decimal,
    ),
  ).toEqual(["0", "0", "0", "0", "0"]);
  expect(save.missingOptionalGroups.story).toEqual({
    page: 0,
    notifications: 0,
    highestUnlocked: -1,
    scrollY: 0,
  });
  expect(save.missingOptionalGroups.settings).toEqual({
    tab: "settings",
    theme: "dark",
  });
  expect(save.missingOptionalGroups.upgradeLevels).toMatchObject({
    moneyIdleSpeed: 7,
    gemOfflineGems: 0,
    planetOfflinePC: 0,
  });
  expect(save.missingOptionalGroups.power).toMatchObject({
    upgradeLevel: 6,
    firstValue: { decimal: "9" },
  });
  expect(save.missingOptionalGroups.pickaxe).toMatchObject({
    name: "Probe Pickaxe",
    power: { decimal: "123" },
    quality: { decimal: "4" },
  });
});

it("captures partial Remix field application before malformed saves throw", () => {
  const samples = save.fieldApplicationErrors;
  expect(samples.map(({ name }) => name)).toEqual([
    "json-null-root",
    "null-story-after-resources",
    "null-settings-after-story",
    "null-upgrades-after-settings",
    "unknown-upgrade-key",
    "null-money-upgrade-entry",
    "null-gem-upgrade-group",
    "null-gem-upgrade-entry",
    "null-planet-coin-group",
    "null-planet-coin-upgrade-entry",
    "null-powers-values",
    "null-powers-group",
    "null-powers-data-group",
    "null-powers-upgrade-group-after-values",
    "null-power-upgrade-entry-after-values",
    "null-pickaxe-after-groups",
  ]);
  expect(samples.map(({ thrownErrorName }) => thrownErrorName)).toEqual(
    Array.from({ length: 16 }, () => "TypeError"),
  );
  const byName = Object.fromEntries(
    samples.map((sample) => [sample.name, sample]),
  );

  expect(byName["json-null-root"]?.stateAfter).toMatchObject({
    money: { decimal: "77" },
    mineObjectLevel: 3,
    story: { page: 7, notifications: 8 },
    settings: { theme: "dark", numberFormatterIndex: 2 },
    upgradeLevels: {
      moneyIdleSpeed: 11,
      gemOfflineGems: 12,
      planetOfflinePC: 13,
      wisdomPowerPowerActive: 14,
    },
    pickaxe: { name: "Probe Sentinel", power: { decimal: "23" } },
  });
  expect(byName["null-story-after-resources"]?.stateAfter).toMatchObject({
    money: { decimal: "123" },
    mineObjectLevel: 4,
    story: { page: 7, notifications: 8 },
  });
  expect(byName["null-settings-after-story"]?.stateAfter).toMatchObject({
    money: { decimal: "123" },
    story: { page: 2, notifications: 3, highestUnlocked: 5, scrollY: 6 },
    settings: { theme: "dark", numberFormatterIndex: 2 },
  });
  expect(byName["null-upgrades-after-settings"]?.stateAfter).toMatchObject({
    settings: { theme: "light", numberFormatterIndex: 0 },
    upgradeLevels: {
      moneyIdleSpeed: 11,
      gemOfflineGems: 12,
      planetOfflinePC: 13,
    },
  });
  expect(byName["unknown-upgrade-key"]?.stateAfter).toMatchObject({
    settings: { theme: "dark", numberFormatterIndex: 2 },
    upgradeLevels: {
      moneyIdleSpeed: 11,
      gemOfflineGems: 12,
      planetOfflinePC: 13,
    },
  });
  expect(byName["null-money-upgrade-entry"]?.stateAfter).toMatchObject({
    upgradeLevels: {
      moneyIdleSpeed: 11,
      gemOfflineGems: 12,
      planetOfflinePC: 13,
    },
  });
  expect(byName["null-gem-upgrade-group"]?.stateAfter).toMatchObject({
    upgradeLevels: {
      moneyIdleSpeed: 11,
      gemOfflineGems: 12,
      planetOfflinePC: 13,
    },
  });
  expect(byName["null-gem-upgrade-entry"]?.stateAfter).toMatchObject({
    upgradeLevels: { moneyIdleSpeed: 6, gemOfflineGems: 12 },
  });
  expect(byName["null-planet-coin-group"]?.stateAfter).toMatchObject({
    upgradeLevels: { gemOfflineGems: 4, planetOfflinePC: 13 },
  });
  expect(byName["null-planet-coin-upgrade-entry"]?.stateAfter).toMatchObject({
    upgradeLevels: { gemOfflineGems: 4, planetOfflinePC: 13 },
  });
  for (const name of [
    "null-powers-group",
    "null-powers-data-group",
    "null-powers-upgrade-group-after-values",
    "null-power-upgrade-entry-after-values",
  ]) {
    expect(byName[name]?.stateAfter.upgradeLevels).toMatchObject({
      gemOfflineGems: 0,
      planetOfflinePC: 0,
    });
  }
  expect(
    byName["null-powers-upgrade-group-after-values"]?.stateAfter.powers[0],
  ).toMatchObject({ decimal: "2" });
  expect(
    byName["null-power-upgrade-entry-after-values"]?.stateAfter.powers[0],
  ).toMatchObject({ decimal: "3" });
  for (const name of ["null-powers-values", "null-pickaxe-after-groups"]) {
    expect(byName[name]?.stateAfter.upgradeLevels).toMatchObject({
      gemOfflineGems: 0,
      planetOfflinePC: 0,
      wisdomPowerPowerActive: 14,
    });
    expect(byName[name]?.stateAfter.pickaxe.name).toBe("Probe Sentinel");
  }
});
