import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { RemixMineObjectCatalog } from "../../packages/core/src/mine-objects.js";

type BoundaryCase = {
  name: string;
  input: {
    gems: string;
    highestMineObjectLevel: number;
    powers: string[];
    upgradeLevels: Record<string, Record<string, number>>;
    randomValues: number[];
  };
  randomCalls: number;
  result: {
    name: string;
    power: {
      decimal: string;
      mantissa: number | string;
      exponent: number | string;
    };
    quality: {
      decimal: string;
      mantissa: number | string;
      exponent: number | string;
    };
    damage: {
      decimal: string;
      mantissa: number | string;
      exponent: number | string;
    };
  };
};

test("matches every pinned pickaxe quality-name boundary in Chromium", async ({
  page,
}) => {
  const corpus = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-reference-corpus.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as {
    data: {
      mineObjectCatalog: RemixMineObjectCatalog;
      pickaxeQualityNameBoundaries: {
        sourcePaths: string[];
        cases: BoundaryCase[];
      };
    };
  };
  const fixture = corpus.data.pickaxeQualityNameBoundaries;

  await page.goto("/__test__/pickaxe-quality");
  await expect(page.locator("#result")).toHaveAttribute("data-ready", "true");
  const observed = await page.evaluate(
    (input) => {
      const probe = (
        window as Window & {
          __idleMinePickaxeQualityProbe?: (value: typeof input) => unknown;
        }
      ).__idleMinePickaxeQualityProbe;
      if (!probe) throw new Error("Pickaxe quality browser probe is missing.");
      return probe(input);
    },
    { catalog: corpus.data.mineObjectCatalog, cases: fixture.cases },
  );

  expect(fixture.sourcePaths).toContain(
    "Scripts/pickaxe.js:Pickaxe.generateName",
  );
  expect(observed).toEqual(
    fixture.cases.map(({ name, randomCalls, result }) => ({
      name,
      randomCalls,
      result,
    })),
  );
});
