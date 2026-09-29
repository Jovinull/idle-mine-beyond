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
