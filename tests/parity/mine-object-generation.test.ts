import { readFile } from "node:fs/promises";
import fc from "fast-check";
import { expect, it } from "vitest";
import {
  Decimal,
  getRemixMineObject,
  type RemixMineObjectCatalog,
} from "../../packages/core/src/index.js";

type ReferenceObject = {
  id: number;
  name: string;
  hp: { decimal: string; mantissa: number | string; exponent: number | string };
  totalHp: {
    decimal: string;
    mantissa: number | string;
    exponent: number | string;
  };
  defense: {
    decimal: string;
    mantissa: number | string;
    exponent: number | string;
  };
  value: {
    decimal: string;
    mantissa: number | string;
    exponent: number | string;
  };
  colors: string[];
  skin: number;
  drops: Record<string, unknown>;
};

const corpus = JSON.parse(
  await readFile(
    new URL("../fixtures/parity/remix-reference-corpus.json", import.meta.url),
    "utf8",
  ),
) as {
  metadata: { sourceCommit: string };
  data: { objects: ReferenceObject[] };
};

const catalogFile = JSON.parse(
  await readFile(
    new URL(
      "../../packages/content/src/remix-mine-content.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as {
  source: { commit: string };
  base: RemixMineObjectCatalog["base"];
  special: RemixMineObjectCatalog["special"];
  skinLayerAmounts: number[];
  dictionaryEnglish: string[];
};

const catalog: RemixMineObjectCatalog = {
  base: catalogFile.base,
  special: catalogFile.special,
  skinLayerAmounts: catalogFile.skinLayerAmounts,
  dictionaryEnglish: catalogFile.dictionaryEnglish,
};

function safeNumber(value: number): number | string {
  if (Number.isNaN(value)) return "NaN";
  if (value === Infinity) return "Infinity";
  if (value === -Infinity) return "-Infinity";
  if (Object.is(value, -0)) return "-0";
  return value;
}

function snapshotDecimal(value: Decimal) {
  return {
    decimal: value.toString(),
    mantissa: safeNumber(value.mantissa),
    exponent: safeNumber(value.exponent),
  };
}

function normalize(value: unknown): unknown {
  if (value instanceof Decimal) return snapshotDecimal(value);
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalize(item)]),
    );
  }
  if (typeof value === "number") return safeNumber(value);
  return value;
}

function snapshotMineObject(id: number): ReferenceObject {
  const object = getRemixMineObject(id, catalog);
  return {
    id: object.id,
    name: object.name,
    hp: snapshotDecimal(object.hp),
    totalHp: snapshotDecimal(object.totalHp),
    defense: snapshotDecimal(object.defense),
    value: snapshotDecimal(object.value),
    colors: [...object.colors],
    skin: object.skin,
    drops: normalize(object.drops) as Record<string, unknown>,
  };
}

function withoutNodeSensitiveChanceBoundaries(
  objects: ReferenceObject[],
): ReferenceObject[] {
  return objects.map((object) => {
    if (object.id !== 118 && object.id !== 132) return object;
    const planetCoin = object.drops["planetcoin"] as {
      chance: number;
      [key: string]: unknown;
    };
    return {
      ...object,
      drops: {
        ...object.drops,
        planetcoin: { ...planetCoin, chance: "[Chromium checked]" },
      },
    };
  });
}

it("matches every captured fixed, special, and generated mine object", () => {
  expect(catalogFile.source.commit).toBe(corpus.metadata.sourceCommit);
  expect(catalog.base).toHaveLength(72);
  expect(catalog.special).toHaveLength(78);
  expect(catalog.dictionaryEnglish).toHaveLength(498);
  // Math.sin differs by a few ulps between Node and the pinned Chromium
  // runtime for these chance values. The browser E2E test checks them exactly.
  expect(
    withoutNodeSensitiveChanceBoundaries(
      corpus.data.objects.map(({ id }) => snapshotMineObject(id)),
    ),
  ).toEqual(withoutNodeSensitiveChanceBoundaries(corpus.data.objects));
});

it("generates the same object repeatedly for each requested ID", () => {
  fc.assert(
    fc.property(fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }), (id) => {
      expect(snapshotMineObject(id)).toEqual(snapshotMineObject(id));
    }),
    { numRuns: 100 },
  );
});
