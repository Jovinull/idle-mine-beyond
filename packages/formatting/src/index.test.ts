import { readFile } from "node:fs/promises";
import { Decimal } from "@idle-mine-beyond/core";
import { expect, it } from "vitest";
import {
  createInitialFormatters,
  formatNumber,
  formatPercent,
  formatThousands,
} from "./index.js";

type FormatterOutput = string | { error: string };
type FormatterValue = { input: string; output: FormatterOutput };

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
    };
  };
};

const formatters = createInitialFormatters();
const formattersByName = new Map(
  formatters.map((formatter) => [formatter.name, formatter]),
);

function firstSix<T extends { notation: string }>(rows: T[]): T[] {
  return rows.filter(({ notation }) => formattersByName.has(notation));
}

it("matches the pinned Remix direct outputs for its six initial formatters", () => {
  const expected = firstSix(
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

  expect(expected.map(({ notation }) => notation)).toEqual(
    fixture.data.initialState.numberFormatters.slice(0, 6),
  );
  expect(fixture.metadata.sourceCommit).toBe(
    "0e0f4bf5a9c66e5603cda2ce4bd54213023dae21",
  );
  expect(observed).toEqual(expected);
});

it("matches Remix number, thousands, and percent wrapper outputs", () => {
  const expectedNumber = firstSix(
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

  const expectedThousands = firstSix(
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

  const expectedPercent = firstSix(
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

  expect(observedNumber).toEqual(expectedNumber);
  expect(observedThousands).toEqual(expectedThousands);
  expect(observedPercent).toEqual(expectedPercent);
});
