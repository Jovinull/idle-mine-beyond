import { readFile } from "node:fs/promises";
import fc from "fast-check";
import { expect, it } from "vitest";
import { Decimal } from "../../packages/core/src/index.js";

type DecimalValue = {
  decimal: string;
  mantissa: number | string;
  exponent: number | string;
};

const fixture = JSON.parse(
  await readFile(
    new URL("../fixtures/parity/remix-reference-corpus.json", import.meta.url),
    "utf8",
  ),
) as {
  metadata: { sourceCommit: string };
  data: {
    decimalSemantics: {
      constants: Record<string, DecimalValue>;
      inputs: {
        input: string;
        value: DecimalValue;
        toNumber: number | string;
        json: string;
        wrappedJson: string;
        jsonRoundTrip: DecimalValue;
      }[];
      arithmetic: {
        left: string;
        right: string;
        add: DecimalValue;
        subtract: DecimalValue;
        multiply: DecimalValue;
        divide: DecimalValue;
        compare: number | { error: string };
        max: DecimalValue;
        min: DecimalValue;
      }[];
      rounding: {
        input: string;
        floor: DecimalValue;
        ceil: DecimalValue;
        round: DecimalValue;
        trunc: DecimalValue;
        toFixed0: string;
        toFixed2: string;
      }[];
      powers: { base: string; exponent: string; result: DecimalValue }[];
      logarithms: {
        input: string;
        log10: number | string;
        log2: number | string;
        naturalLog: number | string;
        logBase10: number | string;
      }[];
    };
  };
};

function safeNumber(value: number): number | string {
  if (Number.isNaN(value)) return "NaN";
  if (value === Infinity) return "Infinity";
  if (value === -Infinity) return "-Infinity";
  if (Object.is(value, -0)) return "-0";
  return value;
}

function snapshotDecimal(value: Decimal): DecimalValue {
  return {
    decimal: value.toString(),
    mantissa: safeNumber(value.mantissa),
    exponent: safeNumber(value.exponent),
  };
}

function capture<T>(operation: () => T): T | { error: string } {
  try {
    return operation();
  } catch (error) {
    return { error: String(error) };
  }
}

it("matches the pinned break_infinity.js arithmetic and serialization corpus", () => {
  const expected = fixture.data.decimalSemantics;
  const observed = {
    constants: {
      maxValue: snapshotDecimal(Decimal.MAX_VALUE),
      minValue: snapshotDecimal(Decimal.MIN_VALUE),
      numberMaxValue: snapshotDecimal(Decimal.NUMBER_MAX_VALUE),
      numberMinValue: snapshotDecimal(Decimal.NUMBER_MIN_VALUE),
    },
    inputs: expected.inputs.map(({ input }) => {
      const value = new Decimal(input);
      const json = JSON.stringify(value);
      return {
        input,
        value: snapshotDecimal(value),
        toNumber: safeNumber(value.toNumber()),
        json,
        wrappedJson: JSON.stringify({ value }),
        jsonRoundTrip: capture(() =>
          snapshotDecimal(new Decimal(JSON.parse(json) as string)),
        ),
      };
    }),
    arithmetic: expected.arithmetic.map(({ left, right }) => {
      const lhs = new Decimal(left);
      const rhs = new Decimal(right);
      return {
        left,
        right,
        add: capture(() => snapshotDecimal(lhs.add(rhs))),
        subtract: capture(() => snapshotDecimal(lhs.sub(rhs))),
        multiply: capture(() => snapshotDecimal(lhs.mul(rhs))),
        divide: capture(() => snapshotDecimal(lhs.div(rhs))),
        compare: capture(() => lhs.cmp(rhs)),
        max: capture(() => snapshotDecimal(lhs.max(rhs))),
        min: capture(() => snapshotDecimal(lhs.min(rhs))),
      };
    }),
    rounding: expected.rounding.map(({ input }) => {
      const value = new Decimal(input);
      return {
        input,
        floor: capture(() => snapshotDecimal(Decimal.floor(value))),
        ceil: capture(() => snapshotDecimal(Decimal.ceil(value))),
        round: capture(() => snapshotDecimal(Decimal.round(value))),
        trunc: capture(() => snapshotDecimal(Decimal.trunc(value))),
        toFixed0: capture(() => value.toFixed(0)),
        toFixed2: capture(() => value.toFixed(2)),
      };
    }),
    powers: expected.powers.map(({ base, exponent }) => ({
      base,
      exponent,
      result: capture(() =>
        snapshotDecimal(new Decimal(base).pow(new Decimal(exponent))),
      ),
    })),
    logarithms: expected.logarithms.map(({ input }) => {
      const value = new Decimal(input);
      return {
        input,
        log10: capture(() => safeNumber(value.log10())),
        log2: capture(() => safeNumber(value.log2())),
        naturalLog: capture(() => safeNumber(value.ln())),
        logBase10: capture(() => safeNumber(value.log(10))),
      };
    }),
  };

  expect(fixture.metadata.sourceCommit).toBe(
    "0e0f4bf5a9c66e5603cda2ce4bd54213023dae21",
  );
  expect(observed).toEqual(expected);
});

it("round-trips safe integer values through the legacy JSON string format", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: -1_000_000_000, max: 1_000_000_000 }),
      (input) => {
        const value = new Decimal(input);
        const serialized = JSON.stringify(value);
        if (serialized === undefined) return false;

        const decoded: unknown = JSON.parse(serialized);
        if (typeof decoded !== "string") return false;

        return value.eq(new Decimal(decoded));
      },
    ),
  );
});
