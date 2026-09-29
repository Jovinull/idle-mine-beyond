import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";

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
      unicodePickaxeRoundTrip: {
        sourceName: string;
        importedName: string;
        preserved: boolean;
      };
    };
  };
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
