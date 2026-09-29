import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.describe.configure({ mode: "serial" });

test("serves the foundation shell without implying gameplay exists", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Foundation scaffold" }),
  ).toBeVisible();
  await expect(
    page.getByText("Phase 0 — Foundation / reference archaeology"),
  ).toBeVisible();
  await expect(
    page.getByText("Gameplay implementation has not started."),
  ).toBeVisible();
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
          input: { objectId: number };
          result: Record<string, unknown>;
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
