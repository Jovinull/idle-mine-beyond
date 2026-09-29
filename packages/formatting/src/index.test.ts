import { readFile } from "node:fs/promises";
import { Decimal } from "@idle-mine-beyond/core";
import { expect, it } from "vitest";
import {
  createRemixFormatters,
  createInitialFormatters,
  formatNumber,
  formatPercent,
  formatThousands,
} from "./index.js";

type FormatterOutput = string | { error: string };
type FormatterValue = { input: string; output: FormatterOutput };

function withoutNodeSensitiveIdleMineBoundary<
  T extends { notation: string; values: { input: string }[] },
>(rows: T[]): T[] {
  return rows.map((row) =>
    row.notation === "Idle Mine Notation"
      ? {
          ...row,
          values: row.values.filter(({ input }) => input !== "999.5"),
        }
      : row,
  );
}

function withoutNodeSensitiveIdleMineScenarioBoundary<
  T extends {
    notation: string;
    scenarios: { name: string; values: { input: string }[] }[];
  },
>(rows: T[]): T[] {
  return rows.map((row) =>
    row.notation === "Idle Mine Notation"
      ? {
          ...row,
          scenarios: row.scenarios.map((scenario) => ({
            ...scenario,
            values: scenario.values.filter(({ input }) => input !== "999.5"),
          })),
        }
      : row,
  );
}

const fixture = JSON.parse(
  await readFile(
    new URL(
      "../../../tests/fixtures/parity/remix-reference-corpus.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as {
  metadata: { sourceCommit: string };
  data: {
    initialState: { numberFormatters: string[] };
    notationSemantics: {
      formatterRegistry: { name: string }[];
      directFormatterOutputs: {
        notation: string;
        values: FormatterValue[];
      }[];
      formatNumberScenarios: {
        notation: string;
        scenarios: { name: string; values: FormatterValue[] }[];
      }[];
      formatThousands: {
        notation: string;
        values: {
          input: string;
          default: FormatterOutput;
          precisionTwo: FormatterOutput;
        }[];
      }[];
      formatPercent: { notation: string; values: FormatterValue[] }[];
      exponentFormatterInputs: number[];
      exponentFormatterOutputs: {
        notation: string;
        values: { input: number; output: FormatterOutput }[];
      }[];
    };
  };
};

const formatters = createRemixFormatters();
const formattersByName = new Map(
  formatters.map((formatter) => [formatter.name, formatter]),
);

function implementedFormatters<T extends { notation: string }>(rows: T[]): T[] {
  return rows.filter(({ notation }) => formattersByName.has(notation));
}

it("matches the pinned Remix outputs for all 40 registered formatters", () => {
  const expected = implementedFormatters(
    fixture.data.notationSemantics.directFormatterOutputs,
  );
  const observed = expected.map(({ notation, values }) => {
    const formatter = formattersByName.get(notation);
    if (!formatter) throw new Error(`Missing formatter: ${notation}`);

    return {
      notation,
      values: values.map(({ input }) => ({
        input,
        output: formatter.format(new Decimal(input), 2, 0),
      })),
    };
  });

  expect(formatters.map(({ name }) => name)).toEqual(
    expected.map(({ notation }) => notation),
  );
  expect(expected.map(({ notation }) => notation)).toEqual(
    fixture.data.notationSemantics.formatterRegistry.map(({ name }) => name),
  );
  expect(createInitialFormatters().map(({ name }) => name)).toEqual(
    fixture.data.initialState.numberFormatters.slice(0, 6),
  );
  expect(fixture.metadata.sourceCommit).toBe(
    "0e0f4bf5a9c66e5603cda2ce4bd54213023dae21",
  );
  // Node and Chromium's Math.log10 paths land on opposite sides of this
  // exact half-integer. The browser parity test checks this visible boundary
  // against the pinned Remix output in Chromium.
  expect(withoutNodeSensitiveIdleMineBoundary(observed)).toEqual(
    withoutNodeSensitiveIdleMineBoundary(expected),
  );
});

it("matches Remix number, thousands, and percent wrapper outputs", () => {
  const expectedNumber = implementedFormatters(
    fixture.data.notationSemantics.formatNumberScenarios,
  );
  const scenarioArguments: Record<string, unknown[]> = {
    defaults: [],
    "precision-two": [2],
    "limit-1000": [2, new Decimal(1000), 0],
    "limit-1e12": [2, new Decimal("1e12"), 0],
  };
  const observedNumber = expectedNumber.map(({ notation, scenarios }) => {
    const formatter = formattersByName.get(notation);
    if (!formatter) throw new Error(`Missing formatter: ${notation}`);

    return {
      notation,
      scenarios: scenarios.map(({ name, values }) => ({
        name,
        values: values.map(({ input }) => ({
          input,
          output: formatNumber(
            input,
            formatter,
            ...(scenarioArguments[name] as [number?, Decimal?, number?]),
          ),
        })),
      })),
    };
  });

  const expectedThousands = implementedFormatters(
    fixture.data.notationSemantics.formatThousands,
  );
  const observedThousands = expectedThousands.map(({ notation, values }) => {
    const formatter = formattersByName.get(notation);
    if (!formatter) throw new Error(`Missing formatter: ${notation}`);

    return {
      notation,
      values: values.map(({ input }) => ({
        input,
        default: formatThousands(input, formatter),
        precisionTwo: formatThousands(input, formatter, Infinity, 2),
      })),
    };
  });

  const expectedPercent = implementedFormatters(
    fixture.data.notationSemantics.formatPercent,
  );
  const observedPercent = expectedPercent.map(({ notation, values }) => {
    const formatter = formattersByName.get(notation);
    if (!formatter) throw new Error(`Missing formatter: ${notation}`);

    return {
      notation,
      values: values.map(({ input }) => ({
        input,
        output: formatPercent(input, formatter),
      })),
    };
  });

  expect(withoutNodeSensitiveIdleMineScenarioBoundary(observedNumber)).toEqual(
    withoutNodeSensitiveIdleMineScenarioBoundary(expectedNumber),
  );
  expect(observedThousands).toEqual(expectedThousands);
  expect(observedPercent).toEqual(expectedPercent);
});

it("matches each base formatter's exponent outputs", () => {
  const expected = implementedFormatters(
    fixture.data.notationSemantics.exponentFormatterOutputs,
  );
  const observed = expected.map(({ notation }) => {
    const formatter = formattersByName.get(notation);
    if (!formatter) throw new Error(`Missing formatter: ${notation}`);

    return {
      notation,
      values: fixture.data.notationSemantics.exponentFormatterInputs.map(
        (input) => ({ input, output: formatter.formatExponent(input) }),
      ),
    };
  });

  expect(observed).toEqual(expected);
});
