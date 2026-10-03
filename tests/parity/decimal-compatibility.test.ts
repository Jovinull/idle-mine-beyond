import { readFile } from "node:fs/promises";
import fc from "fast-check";
import { expect, it } from "vitest";
import { Decimal } from "../../packages/core/src/index.js";

type DecimalValue = {
  decimal: string;
  mantissa: number | string;
  exponent: number | string;
};

type DecimalBranchSemantics = {
  additionZeroCases: {
    left: string;
    right: string;
    add: DecimalValue;
    subtract: DecimalValue;
  }[];
  additionExponentGapCases: {
    exponentGap: number;
    left: string;
    right: string;
    add: DecimalValue;
    subtract: DecimalValue;
  }[];
  numericMultiplicationLimitCases: {
    multiplier: string;
    result: DecimalValue;
  }[];
  roundingExponentBoundaryCases: {
    input: string;
    floor: DecimalValue;
    ceil: DecimalValue;
    round: DecimalValue;
    trunc: DecimalValue;
    toFixed0: string;
  }[];
  stringExponentBoundaryCases: {
    input: string;
    toString: string;
    json: string;
  }[];
  extremeSentinelCases: {
    name: string;
    value: DecimalValue;
    toString: string;
    toFixed0: string;
  }[];
  seededOperandSample: {
    algorithm: string;
    seed: number;
    cases: {
      left: string;
      right: string;
      add: DecimalValue;
      subtract: DecimalValue;
      multiply: DecimalValue;
      divide: DecimalValue;
      compare: number;
    }[];
  };
};

const fixture = JSON.parse(
  await readFile(
    new URL("../fixtures/parity/remix-reference-corpus.json", import.meta.url),
    "utf8",
  ),
) as {
  metadata: { sourceCommit: string };
  data: {
    decimalBranchSemantics: DecimalBranchSemantics;
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

function seededDecimalOperandPairs(seed: number, count: number) {
  let randomState = seed >>> 0;
  const nextUint32 = () => {
    randomState = (Math.imul(1664525, randomState) + 1013904223) >>> 0;
    return randomState;
  };
  const nextInput = () => {
    const sign = (nextUint32() & 1) === 0 ? "" : "-";
    const mantissaDigits = 1_000_000 + (nextUint32() % 9_000_000);
    const exponent = (nextUint32() % 101) - 50;
    const mantissa = `${Math.floor(mantissaDigits / 1_000_000)}.${String(mantissaDigits % 1_000_000).padStart(6, "0")}`;
    return `${sign}${mantissa}e${exponent}`;
  };
  return Array.from({ length: count }, () => ({
    left: nextInput(),
    right: nextInput(),
  }));
}

it("matches source addition exponent-gap boundaries and a recorded seeded sample", () => {
  const expected = fixture.data.decimalBranchSemantics;
  const additionZeroCases = expected.additionZeroCases.map(
    ({ left, right }) => {
      const lhs = new Decimal(left);
      const rhs = new Decimal(right);
      return {
        left,
        right,
        add: snapshotDecimal(lhs.add(rhs)),
        subtract: snapshotDecimal(lhs.sub(rhs)),
      };
    },
  );
  const additionExponentGapCases = expected.additionExponentGapCases.map(
    ({ exponentGap, left, right }) => {
      const lhs = new Decimal(left);
      const rhs = new Decimal(right);
      return {
        exponentGap,
        left,
        right,
        add: snapshotDecimal(lhs.add(rhs)),
        subtract: snapshotDecimal(lhs.sub(rhs)),
      };
    },
  );
  const numericMultiplicationLimitCases =
    expected.numericMultiplicationLimitCases.map(({ multiplier }) => ({
      multiplier,
      result: snapshotDecimal(
        new Decimal("1.23456789012345").mul(Number(multiplier)),
      ),
    }));
  const roundingExponentBoundaryCases =
    expected.roundingExponentBoundaryCases.map(({ input }) => {
      const value = new Decimal(input);
      return {
        input,
        floor: snapshotDecimal(Decimal.floor(value)),
        ceil: snapshotDecimal(Decimal.ceil(value)),
        round: snapshotDecimal(Decimal.round(value)),
        trunc: snapshotDecimal(Decimal.trunc(value)),
        toFixed0: value.toFixed(0),
      };
    });
  const stringExponentBoundaryCases = expected.stringExponentBoundaryCases.map(
    ({ input }) => {
      const value = new Decimal(input);
      return {
        input,
        toString: value.toString(),
        json: JSON.stringify(value),
      };
    },
  );
  const extremeSentinelCases = [
    { name: "MAX_VALUE", value: Decimal.MAX_VALUE },
    { name: "MIN_VALUE", value: Decimal.MIN_VALUE },
  ].map(({ name, value }) => ({
    name,
    value: snapshotDecimal(value),
    toString: value.toString(),
    toFixed0: value.toFixed(0),
  }));
  const seeded = expected.seededOperandSample;
  const seededInputs = seededDecimalOperandPairs(
    seeded.seed,
    seeded.cases.length,
  );
  expect(seeded.algorithm).toBe(
    "LCG32(Math.imul(1664525, state) + 1013904223)",
  );
  expect(seeded.cases.map(({ left, right }) => ({ left, right }))).toEqual(
    seededInputs,
  );
  const seededOperandSample = seededInputs.map(({ left, right }) => {
    const lhs = new Decimal(left);
    const rhs = new Decimal(right);
    return {
      left,
      right,
      add: snapshotDecimal(lhs.add(rhs)),
      subtract: snapshotDecimal(lhs.sub(rhs)),
      multiply: snapshotDecimal(lhs.mul(rhs)),
      divide: snapshotDecimal(lhs.div(rhs)),
      compare: lhs.cmp(rhs),
    };
  });
  expect(additionZeroCases).toEqual(expected.additionZeroCases);
  expect(additionExponentGapCases).toEqual(expected.additionExponentGapCases);
  expect(numericMultiplicationLimitCases).toEqual(
    expected.numericMultiplicationLimitCases,
  );
  expect(roundingExponentBoundaryCases).toEqual(
    expected.roundingExponentBoundaryCases,
  );
  expect(stringExponentBoundaryCases).toEqual(
    expected.stringExponentBoundaryCases,
  );
  expect(extremeSentinelCases).toEqual(expected.extremeSentinelCases);
  expect(seededOperandSample).toEqual(seeded.cases);
});
