import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.describe.configure({ mode: "serial" });

test("serves the connected Remix session and fresh mine object", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.clear();
    Date.now = () => 1_700_000_000_000;
  });
  await page.goto("/");
  await expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready");
  await expect(
    page.getByRole("heading", { name: "Idle Mine: Remix" }),
  ).toBeVisible();
  await expect(page.locator("[data-mine-object-hp]")).toHaveText("100");
  await expect(page.locator("canvas.mine-object")).toHaveAttribute(
    "data-rendered",
    "true",
  );
});

test("bundles the pinned formatter boundary in a browser", async ({ page }) => {
  await page.goto("/__test__/formatting");

  const result = page.locator("#result");
  await expect(result).toHaveAttribute("data-ready", "true");
  await expect(result).toHaveText(
    JSON.stringify({
      names: [
        "Standard",
        "Scientific",
        "Engineering",
        "Letters",
        "Logarithm",
        "Cancer",
        "ALL",
        "Blind",
        "Brackets",
        "Clock",
        "Dots",
        "Hex",
        "Imperial",
        "Infinity",
        "Mixed engineering",
        "Mixed scientific",
        "Prime",
        "Roman",
        "Shi",
        "Zalgo",
        "Binary",
        "Chinese",
        "Coronavirus",
        "Elemental",
        "Evil",
        "Flags",
        "Greek Letters",
        "Haha Funny",
        "Hexadecimal",
        "Japanese",
        "Mixed Logarithm (Sci)",
        "Nice",
        "Omega",
        "Omega (Short)",
        "Precise Prime",
        "Tritetrated",
        "YesNo",
        "Idle Mine Notation",
        "SI Notation (Current)",
        "SI Notation (2022)",
      ],
      grouped: "1,000",
      percent: "0.50%",
      idleMineHalfBoundary: "1,000",
    }),
  );

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
      notationSemantics: {
        formatterRegistry: { name: string }[];
        directFormatterOutputs: unknown;
        formatNumberScenarios: unknown;
        formatThousands: unknown;
        formatPercent: unknown;
        exponentFormatterInputs: unknown;
        exponentFormatterOutputs: unknown;
      };
    };
  };
  const reference = corpus.data.notationSemantics;
  const observed = await page.evaluate((fixture) => {
    const probe = (
      window as Window & {
        __idleMineFormattingProbe?: (value: typeof fixture) => unknown;
      }
    ).__idleMineFormattingProbe;
    if (!probe) throw new Error("Browser formatting probe did not initialize.");
    return probe(fixture);
  }, reference);

  expect(observed).toEqual({
    formatterNames: reference.formatterRegistry.map(({ name }) => name),
    directFormatterOutputs: reference.directFormatterOutputs,
    formatNumberScenarios: reference.formatNumberScenarios,
    formatThousands: reference.formatThousands,
    formatPercent: reference.formatPercent,
    exponentFormatterOutputs: reference.exponentFormatterOutputs,
  });
});

test("generates the captured mine objects in Chromium", async ({ page }) => {
  await page.goto("/__test__/mine-objects");
  await expect(page.locator("#result")).toHaveAttribute("data-ready", "true");

  const corpus = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-reference-corpus.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as { data: { objects: { id: number }[] } };
  const content = JSON.parse(
    await readFile(
      new URL(
        "../../packages/content/src/remix-mine-content.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as {
    base: unknown[];
    special: unknown[];
    skinLayerAmounts: number[];
    dictionaryEnglish: string[];
  };
  const input = {
    catalog: content,
    ids: corpus.data.objects.map(({ id }) => id),
  };
  const observed = await page.evaluate((probeInput) => {
    const probe = (
      window as Window & {
        __idleMineObjectProbe?: (value: typeof probeInput) => unknown;
      }
    ).__idleMineObjectProbe;
    if (!probe)
      throw new Error("Mine-object browser probe did not initialize.");
    return probe(probeInput);
  }, input);

  expect(observed).toEqual(corpus.data.objects);
});

test("calculates captured mining rates in Chromium", async ({ page }) => {
  await page.goto("/__test__/mining-rates");
  await expect(page.locator("#result")).toHaveAttribute("data-ready", "true");

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
      formulaSemantics: {
        scenarios: {
          input: {
            objectId: number;
            pickaxe: { power: string; quality: string };
            miningPower: string;
            exquisityPower: string;
            upgrades: Record<string, Record<string, number>>;
          };
          effects: Record<string, unknown>;
          result: Record<string, unknown> & {
            highestDamageableObjectLevel: number;
          };
        }[];
        currentObjectArgumentQuirk: {
          currentObjectId: number;
          explicitTargetId: number;
          activeDamage: unknown;
          idleDamageAtCurrentObject: unknown;
          idleDpsWhenPassedTarget: unknown;
        };
      };
    };
  };
  const content = JSON.parse(
    await readFile(
      new URL(
        "../../packages/content/src/remix-mine-content.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as {
    base: unknown[];
    special: unknown[];
    skinLayerAmounts: number[];
    dictionaryEnglish: string[];
  };
  const probe = corpus.data.formulaSemantics;
  const observed = await page.evaluate(
    ({ catalog, scenarios, quirk }) => {
      const run = (
        window as Window & {
          __idleMineRatesProbe?: (input: {
            catalog: typeof catalog;
            scenarios: typeof scenarios;
            quirk: typeof quirk;
          }) => unknown;
        }
      ).__idleMineRatesProbe;
      if (!run)
        throw new Error("Mining-rate browser probe did not initialize.");
      return run({ catalog, scenarios, quirk });
    },
    {
      catalog: content,
      scenarios: probe.scenarios,
      quirk: probe.currentObjectArgumentQuirk,
    },
  );

  const rateKeys = [
    "pickaxeDamage",
    "activeDamage",
    "idleDamage",
    "idleDps",
    "moneyPerClick",
    "moneyPerSecond",
    "gemsPerSecond",
    "planetCoinsPerSecond",
  ];
  const expectedScenarios = probe.scenarios.map(({ result }) =>
    Object.fromEntries(rateKeys.map((key) => [key, result[key]])),
  );
  expect((observed as { scenarios: unknown }).scenarios).toEqual(
    expectedScenarios,
  );
  expect((observed as { factors: unknown }).factors).toEqual(
    probe.scenarios.map(({ effects }) => effects),
  );
  expect(
    (observed as { currentObjectArgumentQuirk: unknown })
      .currentObjectArgumentQuirk,
  ).toEqual({
    activeDamage: probe.currentObjectArgumentQuirk.activeDamage,
    idleDamageAtCurrentObject:
      probe.currentObjectArgumentQuirk.idleDamageAtCurrentObject,
    idleDpsWhenPassedTarget:
      probe.currentObjectArgumentQuirk.idleDpsWhenPassedTarget,
  });
});

test("calculates all captured upgrade formulas and interactions in Chromium", async ({
  page,
}) => {
  await page.goto("/__test__/upgrades");
  await expect(page.locator("#result")).toHaveAttribute("data-ready", "true");

  const corpus = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-reference-corpus.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as {
    data: { upgradeSemantics: Record<string, unknown> };
  };
  const reference = corpus.data.upgradeSemantics;
  const formulaGroups = Object.fromEntries(
    Object.entries(
      reference["groups"] as Record<
        string,
        Record<
          string,
          {
            name: string;
            resource: number;
            maxLevel: number | "Infinity";
            stochasticEffect: boolean;
            samples: { level: number; price: unknown; effect: unknown }[];
          }
        >
      >,
    ).map(([group, upgrades]) => [
      group,
      Object.fromEntries(
        Object.entries(upgrades).map(([key, upgrade]) => [
          key,
          {
            name: upgrade.name,
            resource: upgrade.resource,
            maxLevel: upgrade.maxLevel,
            stochasticEffect: upgrade.stochasticEffect,
            samples: upgrade.samples.map(({ level, price, effect }) => ({
              level,
              price,
              effect,
            })),
          },
        ]),
      ),
    ]),
  );
  const observed = await page.evaluate((input) => {
    const probe = (
      window as Window & {
        __idleMineUpgradeProbe?: (value: typeof input) => unknown;
      }
    ).__idleMineUpgradeProbe;
    if (!probe) throw new Error("Upgrade parity probe did not initialize.");
    return probe(input);
  }, reference);

  expect(observed).toEqual({
    groups: formulaGroups,
    stochasticEffects: reference["stochasticEffects"],
    effectInteractions: reference["effectInteractions"],
  });
});
