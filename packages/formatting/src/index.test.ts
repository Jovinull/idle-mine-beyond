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
  metadata: { sourceCommit: string; random: { seed: number } };
  data: {
    initialState: { numberFormatters: string[] };
    notationSemantics: {
      formatterRegistry: { name: string }[];
      directFormatterInputs: string[];
      seededSample: {
        algorithm: string;
        seed: number;
        inputs: string[];
      };
      randomCallsBeforeDirectOutputs: number;
      randomCallsAfterDirectOutputs: number;
      directFormatterOutputs: {
        notation: string;
        values: FormatterValue[];
      }[];
      adMethodOutputs: {
        imperialNotation: {
          sourcePath: string;
          constants: {
            volumeUnits: [number, string, number][];
            adjectives: string[];
            maxVolume: number;
            logMaxVolume: number;
            reduceRatio: number;
          };
          findVolumeUnit: {
            label: string;
            value: number;
            expectedIndex: number;
            output: number | { error: string };
          }[];
          formatMetric: { input: number; output: FormatterOutput }[];
          checkSmallUnits: {
            label: string;
            adjective: string;
            value: number;
            volumeIndex: number;
            output: FormatterOutput | null;
          }[];
          checkAlmost: {
            label: string;
            adjective: string;
            value: number;
            numBig: number;
            bigIndex: number;
            output: FormatterOutput | null;
          }[];
          convertToVolume: {
            label: string;
            value: number;
            volumeIndex: number;
            output: FormatterOutput;
          }[];
          formatUnder1000: { input: number; output: FormatterOutput }[];
          formatDecimal: FormatterValue[];
          maxFiniteFormatDecimal: FormatterOutput;
          formattedValues: FormatterValue[];
          phrases: {
            method: "pluralOrArticle" | "addArticle";
            num?: number;
            value: string;
            output: FormatterOutput;
          }[];
          infinite: string;
        };
      };
      communityMethodOutputs: {
        coronavirusInfect: {
          sourcePath: string;
          values: FormatterValue[];
        };
        japaneseFormatter: {
          sourcePath: string;
          values: FormatterValue[];
        };
        omegaNotations: {
          sourcePath: string;
          formatters: {
            notation: string;
            values: FormatterValue[];
          }[];
        };
        tritetratedNotation: {
          sourcePath: string;
          values: FormatterValue[];
        };
        flagsNotation: {
          sourcePath: string;
          base: number;
          letters: string[];
          transcriptionBoundaries: {
            engineeringExponent: number;
            output: (string | null)[] | { error: string };
          }[];
          values: FormatterValue[];
        };
        elementalNotation: {
          sourcePath: string;
          listLengths: number[];
          lookups: {
            listIndex: number;
            elementIndex: number;
            input: number;
            output: [string, number] | { error: string };
          }[];
          partFormatting: {
            abbreviation: string;
            amount: number;
            output: FormatterOutput;
          }[];
          methodValues: FormatterValue[];
          formattedValues: FormatterValue[];
          infinite: string;
        };
        precisePrimeNotation: {
          sourcePath: string;
          constants: {
            maxSafeInteger: number;
            maxFactor: number;
            maxSafeIntegerLog10: number;
            decimalMaxMantissa: number;
            decimalMaxExponent: number;
            decimalMaxLog10: number;
            decimalMaxTowerExponent: number;
          };
          primeFactorizations: {
            input: number;
            output: number[] | { error: string };
          }[];
          factorListFormatting: {
            factors: number[];
            output: FormatterOutput;
          }[];
          parenthesization: {
            value: string;
            parenthesize: boolean;
            output: FormatterOutput;
          }[];
          powerTowers: {
            exponents: number[];
            output: FormatterOutput;
          }[];
          primifyValues: FormatterValue[];
          maxFinitePrimify: FormatterOutput;
          maxFiniteFormatted: FormatterOutput;
          formatUnder1000Values: {
            input: number;
            output: FormatterOutput;
          }[];
          formattedValues: FormatterValue[];
          infinite: string;
        };
      };
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

function captureFormatterOutput(operation: () => string): FormatterOutput {
  try {
    return operation();
  } catch (error) {
    return { error: String(error) };
  }
}

function withReferenceRandom<T>(run: (calls: () => number) => T): T {
  const originalRandom = Math.random;
  let state = fixture.metadata.random.seed >>> 0;
  let callCount = 0;
  const seededRandom = () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    callCount++;
    return state / 0x1_0000_0000;
  };

  Math.random = seededRandom;
  for (
    let index = 0;
    index < fixture.data.notationSemantics.randomCallsBeforeDirectOutputs;
    index++
  ) {
    seededRandom();
  }

  try {
    return run(() => callCount);
  } finally {
    Math.random = originalRandom;
  }
}

function dotsBranchBoundaryInputs(): string[] {
  const around = (boundary: number) =>
    [-0.000001, 0, 0.000001].map((offset) => String(boundary + offset));

  return [
    ...around(253.5 / 254),
    ...around(64515.5 / 254),
    "254",
    "16387063.997",
    "16387063.9980315",
    "16387063.999",
  ];
}

function bracketsLoopBoundaryInputs(): string[] {
  return [
    "46655.999",
    "46656",
    "46656.001",
    "1.03144247984904e28",
    "1.03144247984905e28",
    "1.03144247984906e28",
  ];
}

function standardAbbreviationBoundaryInputs(): string[] {
  return [
    "1e303",
    "1e306",
    "1e3003",
    "1e30003",
    "1e3000003",
    "1e3000000003",
    "1e3000000000003",
    "1e3000000000000003",
  ];
}

function infinityNotationBoundaryInputs(): string[] {
  return ["1e308254", "1e308255"];
}

function mixedLogarithmBoundaryInputs(): string[] {
  return [
    "1e32",
    "1e33",
    "1e34",
    "1e99999",
    "1e100000",
    "1e100001",
    "1e999999999",
    "1e1000000000",
    "1e1000000001",
  ];
}

function hexadecimalNotationBoundaryInputs(): string[] {
  return [
    "-1e9000000000000001",
    "1e9000000000000001",
    "-1e8999999999999999",
    "1e8999999999999999",
    "-1e-301",
    "32769.75524902344",
    "1e-301",
    "-1000",
    "-1",
    "-0.5",
    "0",
    "0.5",
    "1",
    "999.999",
    "1000",
    "1e308",
  ];
}

function primeNotationBoundaryInputs(): string[] {
  return [
    "2",
    "8192",
    "8193",
    "9972",
    "9973",
    "9974",
    "10005.999",
    "10006",
    "10006.001",
    "4.041554734111906e+40026",
    "4.041554738153461e+40026",
    "4.041554742195015e+40026",
  ];
}

function allNotationDispatchBoundaryInputs(): string[] {
  return Array.from({ length: 16 }, (_, index) => {
    if (index === 0) return "0.5";
    if (index === 1) return "4";
    if (index === 2) return "16";
    if (index === 3) return "256";
    if (index === 4) return "65536";
    if (index === 5) return "4294967296";
    return `1e${Math.floor(Math.log10(2) * 2 ** index) + 1}`;
  });
}

function chineseNotationBoundaryInputs(): string[] {
  return [
    "0",
    "10",
    "9999",
    "10000",
    "10005.999",
    "1e51",
    "1e52",
    "1.2345e52",
    "1e287",
    "1e288",
    "1e289",
  ];
}

function hahaFunnyLoopBoundaryInputs(): string[] {
  return [
    new Decimal(69).pow(68.999).toString(),
    new Decimal(69).pow(69).toString(),
  ];
}

function evilNotationBoundaryInputs(): string[] {
  return [
    5.49, 5.749, 5.75, 6, 6.25, 6.251, 6.749, 6.75, 7, 7.249, 7.25, 7.251,
  ].map((logLogValue) => new Decimal(2).pow(2 ** logLogValue).toString());
}

function greekLetterBoundaryInputs(): string[] {
  return [
    "1e3",
    "1e102",
    "1e105",
    "1e111",
    "1e117",
    "1e135",
    "1e141",
    "1e144",
    "1e147",
    "1e7197",
    "1e7200",
    "1e7203",
  ];
}

function scientificEngineeringRolloverInputs(): string[] {
  return [
    "9.9949999999999e12",
    "9.995e12",
    "9.9950000000001e12",
    "999.994999999999e6",
    "999.995e6",
    "999.995000000001e6",
  ];
}

function clockBoundaryInputsForExponent(exponent: number): string[] {
  const boundary = new Decimal(12).pow(exponent);
  // Separate huge exponent cases enough for the pinned Number log quotient
  // to represent both sides of the branch.
  const factors =
    exponent < 200
      ? ["0.99999999999999", "1", "1.00000000000001"]
      : ["0.999999999", "1", "1.000000001"];
  return factors.map((factor) => boundary.mul(factor).toString());
}

function clockBoundaryInputs(): string[] {
  return [
    "11.9",
    "11.999999999999",
    "12",
    "12.000000000001",
    ...clockBoundaryInputsForExponent(13),
    ...clockBoundaryInputsForExponent(157),
    ...clockBoundaryInputsForExponent(301),
    ...clockBoundaryInputsForExponent(2029),
    ...clockBoundaryInputsForExponent(22765),
    "1e8999999999999999",
  ];
}

function customBaseBoundaryInputs(): string[] {
  return [
    "0",
    "1.4999999999999",
    "1.5",
    "1.5000000000001",
    "15.4999999999999",
    "15.5",
    "15.5000000000001",
    "1919.999999999",
    "1920",
    "1920.000000001",
    "4095.499999999999",
    "4095.5",
    "4095.500000000001",
  ];
}

function blindDispatchInputs(): string[] {
  return [
    "-0.5",
    "-1000",
    "-1e-301",
    "1e-301",
    "1",
    "1000",
    "1e9000000000000001",
    "-1e9000000000000001",
  ];
}

function yesNoDispatchCases(): { input: string; branch: string }[] {
  return [
    { input: "1e9000000000000001", branch: "infinite" },
    { input: "-1e9000000000000001", branch: "negativeInfinite" },
    { input: "-1e-301", branch: "formatVerySmallNegativeDecimal" },
    { input: "1e-301", branch: "formatVerySmallDecimal" },
    { input: "-0.5", branch: "formatNegativeUnder1000" },
    { input: "0", branch: "formatUnder1000 (zero)" },
    { input: "1", branch: "formatUnder1000 (nonzero)" },
    { input: "-1000", branch: "formatNegativeDecimal" },
    { input: "1000", branch: "formatDecimal" },
  ];
}

const ROMAN_SYMBOL_THRESHOLDS = [
  1, 4, 5, 9, 10, 40, 50, 90, 100, 400, 500, 900, 1000, 4000, 5000, 9000, 10000,
  40000, 50000, 90000, 100000, 400000, 500000, 900000, 1000000,
];

function romanBoundaryInputs(): string[] {
  const around = (boundary: number) =>
    [boundary - 0.01, boundary, boundary + 0.01].map(String);
  const aroundFraction = (boundary: number) =>
    [boundary - 0.001, boundary, boundary + 0.001].map(String);

  return [
    ...ROMAN_SYMBOL_THRESHOLDS.flatMap(around),
    ...Array.from({ length: 9 }, (_, index) =>
      aroundFraction((index + 1) / 10),
    ).flat(),
    ...around(4000000),
    ...around(-4000000),
    "0",
  ];
}

function letterTranscriptionBoundaryInputs(): string[] {
  return [
    "1e75",
    "1e78",
    "1e81",
    "1e153",
    "1e156",
    "1e159",
    "1e2106",
    "1e2109",
    "1e2112",
    "1e4131",
    "1e4134",
    "1e4137",
  ];
}

function japaneseNotationBoundaryInputs(): string[] {
  return [
    "1000",
    ...Array.from({ length: 17 }, (_, index) => `1e${(index + 1) * 4}`),
    "1.0001e8",
    "1.2345e8",
    "1e71",
    "1e72",
    "1e73",
  ];
}

function omegaOrderBoundaryInputs(order: number): string[] {
  const boundary = new Decimal(8000).pow(order);
  return ["0.999999999", "1", "1.000000001"].map((factor) =>
    boundary.mul(factor).toString(),
  );
}

function omegaNotationBoundaryInputs(): string[] {
  return [
    "0",
    "7999",
    "8000",
    "8001",
    "15999",
    "16000",
    "16001",
    "23999",
    "24000",
    "24001",
    "31999",
    "32000",
    "32001",
    "71999",
    "72000",
    "72001",
    "79999",
    "80000",
    "80001",
    ...omegaOrderBoundaryInputs(3),
    ...omegaOrderBoundaryInputs(6),
    new Decimal(Number.MAX_SAFE_INTEGER).mul(1000).toString(),
    new Decimal(Number.MAX_SAFE_INTEGER).add(1).mul(1000).toString(),
  ];
}

it("matches the pinned Remix outputs for all 40 registered formatters", () =>
  withReferenceRandom((randomCalls) => {
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
          output: captureFormatterOutput(() =>
            formatter.format(new Decimal(input), 2, 0),
          ),
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
    expect(randomCalls()).toBe(
      fixture.data.notationSemantics.randomCallsAfterDirectOutputs,
    );
  }));

it("matches Dots rounding, recursive encoding, and formatter cutoffs", () => {
  const inputs = dotsBranchBoundaryInputs();
  const source = fixture.data.notationSemantics.directFormatterOutputs.find(
    ({ notation }) => notation === "Dots",
  );
  const formatter = formattersByName.get("Dots");
  if (!source || !formatter) throw new Error("Missing Dots formatter oracle.");

  const expected = inputs.map((input) => {
    const value = source.values.find((candidate) => candidate.input === input);
    if (!value) throw new Error(`Missing Dots source input: ${input}`);
    return value;
  });
  const observed = inputs.map((input) => ({
    input,
    output: formatter.format(new Decimal(input), 2, 0),
  }));
  expect(observed).toEqual(expected);

  const outputByInput = new Map(
    expected.map(({ input, output }) => [input, output]),
  );
  expect(outputByInput.get(inputs[0]!)).not.toBe(outputByInput.get(inputs[1]!));
  expect(outputByInput.get(inputs[3]!)).not.toBe(outputByInput.get(inputs[4]!));
  expect(outputByInput.get("16387063.997")).not.toBe(
    outputByInput.get("16387063.9980315"),
  );
});

it("matches Brackets base-six loop transitions at 6^6 and 6^36", () => {
  const inputs = bracketsLoopBoundaryInputs();
  const source = fixture.data.notationSemantics.directFormatterOutputs.find(
    ({ notation }) => notation === "Brackets",
  );
  const formatter = formattersByName.get("Brackets");
  if (!source || !formatter)
    throw new Error("Missing Brackets formatter oracle.");

  const expected = inputs.map((input) => {
    const value = source.values.find((candidate) => candidate.input === input);
    if (!value) throw new Error(`Missing Brackets source input: ${input}`);
    return value;
  });
  const observed = inputs.map((input) => ({
    input,
    output: formatter.format(new Decimal(input), 2, 0),
  }));

  expect(observed).toEqual(expected);
  expect(observed[0]!.output).not.toBe(observed[1]!.output);
  expect(observed[3]!.output).not.toBe(observed[4]!.output);
});

it("matches Standard abbreviation groups, padding, and legacy suffix corrections", () => {
  const inputs = standardAbbreviationBoundaryInputs();
  const source = fixture.data.notationSemantics.directFormatterOutputs.find(
    ({ notation }) => notation === "Standard",
  );
  const formatter = formattersByName.get("Standard");
  if (!source || !formatter)
    throw new Error("Missing Standard formatter oracle.");

  const expected = inputs.map((input) => {
    const value = source.values.find((candidate) => candidate.input === input);
    if (!value) throw new Error(`Missing Standard source input: ${input}`);
    return value;
  });
  const observed = inputs.map((input) => ({
    input,
    output: formatter.format(new Decimal(input), 2, 0),
  }));

  expect(observed).toEqual(expected);
  const outputByInput = new Map(
    expected.map(({ input, output }) => [input, output]),
  );
  expect(outputByInput.get("1e303")).not.toBe(outputByInput.get("1e306"));
  expect(outputByInput.get("1e3003")).not.toMatch(/-$/);
  expect(outputByInput.get("1e3003")).toMatch(/MI$/);
  expect(outputByInput.get("1e30003")).toMatch(/DcMI$/);
  expect(outputByInput.get("1e3000003")).toMatch(/MC-MI$/);
  expect(outputByInput.get("1e3000000003")).toMatch(/NA-MC-MI$/);
  expect(outputByInput.get("1e3000000000003")).toMatch(/PC-NA-MC-MI$/);
  expect(outputByInput.get("1e3000000000000003")).toMatch(/FM-PC-NA-MC-MI$/);
});

it("matches Infinity precision and thousands formatting across its 1000 boundary", () => {
  const inputs = infinityNotationBoundaryInputs();
  const source = fixture.data.notationSemantics.directFormatterOutputs.find(
    ({ notation }) => notation === "Infinity",
  );
  const formatter = formattersByName.get("Infinity");
  if (!source || !formatter)
    throw new Error("Missing Infinity formatter oracle.");

  const expected = inputs.map((input) => {
    const value = source.values.find((candidate) => candidate.input === input);
    if (!value) throw new Error(`Missing Infinity source input: ${input}`);
    return value;
  });
  const observed = inputs.map((input) => ({
    input,
    output: formatter.format(new Decimal(input), 2, 0),
  }));

  expect(observed).toEqual(expected);
  expect(expected[0]!.output).toMatch(/\.\d{4}∞$/);
  expect(expected[0]!.output).not.toContain(",");
  expect(expected[1]!.output).toMatch(/,\d{3}\.\d{3}∞$/);
});

it("matches Mixed Logarithm Scientific and comma cutoffs", () => {
  const inputs = mixedLogarithmBoundaryInputs();
  const source = fixture.data.notationSemantics.directFormatterOutputs.find(
    ({ notation }) => notation === "Mixed Logarithm (Sci)",
  );
  const formatter = formattersByName.get("Mixed Logarithm (Sci)");
  if (!source || !formatter)
    throw new Error("Missing Mixed Logarithm (Sci) formatter oracle.");

  const expected = inputs.map((input) => {
    const value = source.values.find((candidate) => candidate.input === input);
    if (!value)
      throw new Error(`Missing Mixed Logarithm source input: ${input}`);
    return value;
  });
  const observed = inputs.map((input) => ({
    input,
    output: formatter.format(new Decimal(input), 2, 0),
  }));
  expect(observed).toEqual(expected);

  const outputByInput = new Map(
    expected.map(({ input, output }) => [input, output]),
  );
  expect(outputByInput.get("1e32")).toBe("1.00e32");
  expect(outputByInput.get("1e33")).toBe("e33.00");
  expect(outputByInput.get("1e99999")).toBe("e99999.00");
  expect(outputByInput.get("1e100000")).toBe("e100,000.00");
  expect(outputByInput.get("1e999999999")).toBe("e999,999,999.00");
  expect(outputByInput.get("1e1000000000")).toBe("e1.000e9");
});

it("matches Hex sign encoding, finite dispatch, and infinity sentinels", () => {
  const inputs = hexadecimalNotationBoundaryInputs();
  const source = fixture.data.notationSemantics.directFormatterOutputs.find(
    ({ notation }) => notation === "Hex",
  );
  const formatter = formattersByName.get("Hex");
  if (!source || !formatter) throw new Error("Missing Hex formatter oracle.");

  const expected = inputs.map((input) => {
    const value = source.values.find((candidate) => candidate.input === input);
    if (!value) throw new Error(`Missing Hex source input: ${input}`);
    return value;
  });
  const observed = inputs.map((input) => ({
    input,
    output: formatter.format(new Decimal(input), 2, 0),
  }));
  expect(observed).toEqual(expected);

  const outputByInput = new Map(
    expected.map(({ input, output }) => [input, output]),
  );
  expect(outputByInput.get("-1e9000000000000001")).toBe("00000000");
  expect(outputByInput.get("1e9000000000000001")).toBe("FFFFFFFF");
  expect(outputByInput.get("0")).toBe("80000000");
  expect(outputByInput.get("-1")).toBe("40000000");
  expect(outputByInput.get("1")).toBe("C0000000");
  expect(outputByInput.get("-1e8999999999999999")).toBe("01C655C6");
  expect(outputByInput.get("1e8999999999999999")).toBe("FE39AA3A");
  expect(outputByInput.get("-1e-301")).not.toBe(outputByInput.get("1e-301"));
});

it("matches Hex's terminal tie-to-even branch from the pinned reference", () => {
  const input = "32769.75524902344";
  const source = fixture.data.notationSemantics.directFormatterOutputs.find(
    ({ notation }) => notation === "Hex",
  );
  const formatter = formattersByName.get("Hex");
  if (!source || !formatter) throw new Error("Missing Hex formatter oracle.");

  const expected = source.values.find((value) => value.input === input);
  if (!expected) throw new Error(`Missing Hex source input: ${input}`);

  const hex = formatter as unknown as {
    rawValue(value: Decimal, bits: number): number;
    modifiedLogarithm(value: Decimal): number;
  };
  const decimalStatics = Decimal as unknown as {
    lt(left: Decimal | number, right: Decimal | number): boolean;
  };
  const originalModifiedLogarithm = hex.modifiedLogarithm;
  const originalLessThan = decimalStatics.lt;
  const transformed: number[] = [];
  const signBits: boolean[] = [];
  let encoded: number;

  try {
    hex.modifiedLogarithm = (value) => {
      const result = originalModifiedLogarithm.call(hex, value);
      transformed.push(result);
      return result;
    };
    decimalStatics.lt = (left, right) => {
      const result = originalLessThan.call(Decimal, left, right);
      if (right === 0) signBits.push(result);
      return result;
    };

    encoded = hex.rawValue(new Decimal(input), 32);
  } finally {
    hex.modifiedLogarithm = originalModifiedLogarithm;
    decimalStatics.lt = originalLessThan;
  }

  const unrounded = Number.parseInt(
    signBits.map((isNegative) => (isNegative ? "0" : "1")).join(""),
    2,
  );
  expect(signBits).toHaveLength(32);
  expect(transformed).toHaveLength(32);
  expect(transformed.at(-1)).toBe(0);
  expect(unrounded % 2).toBe(1);
  expect(encoded).toBe(unrounded + 1);
  expect(formatter.format(new Decimal(input), 2, 0)).toBe(expected.output);
});

it("matches Prime factorization and logarithmic-region boundaries", () => {
  const inputs = primeNotationBoundaryInputs();
  const source = fixture.data.notationSemantics.directFormatterOutputs.find(
    ({ notation }) => notation === "Prime",
  );
  const formatter = formattersByName.get("Prime");
  if (!source || !formatter) throw new Error("Missing Prime formatter oracle.");

  const expected = inputs.map((input) => {
    const value = source.values.find((candidate) => candidate.input === input);
    if (!value) throw new Error(`Missing Prime source input: ${input}`);
    return value;
  });
  const observed = inputs.map((input) => ({
    input,
    output: formatter.format(new Decimal(input), 2, 0),
  }));
  expect(observed).toEqual(expected);

  const outputByInput = new Map(
    expected.map(({ input, output }) => [input, output]),
  );
  expect(outputByInput.get("2")).toBe("2");
  expect(outputByInput.get("8192")).toBe("2¹³");
  expect(outputByInput.get("8193")).toBe("3×2731");
  expect(outputByInput.get("9973")).toBe("9973");
  expect(outputByInput.get("10006.001")).toBe("(2²×5²)^(2)");
  expect(outputByInput.get("4.041554742195015e+40026")).toBe(
    "(2×19×241)^(101)²",
  );
});

it("compares every source branch in the ALL notation dispatch table", () => {
  const inputs = allNotationDispatchBoundaryInputs();
  const source = fixture.data.notationSemantics.directFormatterOutputs.find(
    ({ notation }) => notation === "ALL",
  );
  const formatter = formattersByName.get("ALL");
  if (!source || !formatter) throw new Error("Missing ALL formatter oracle.");

  const expected = inputs.map((input) => {
    const value = source.values.find((candidate) => candidate.input === input);
    if (!value) throw new Error(`Missing ALL source input: ${input}`);
    return value;
  });
  const observed = inputs.map((input) => ({
    input,
    output: formatter.format(new Decimal(input), 2, 0),
  }));
  const dispatchIndices = inputs.map(
    (input) =>
      Math.floor(Math.log2(new Decimal(input).abs().add(2).log2())) % 16,
  );

  expect(observed).toEqual(expected);
  expect(dispatchIndices).toEqual(Array.from({ length: 16 }, (_, i) => i));
});

it("covers the Shi formatter loop and all 33 source character lookups", () => {
  const sourceAlphabet = Array.from(
    "世使侍勢十史嗜士始室實屍市恃拭拾施是時氏濕獅矢石視試詩誓識逝適釋食",
  );
  const source = fixture.data.notationSemantics.directFormatterOutputs.find(
    ({ notation }) => notation === "Shi",
  );
  const formatter = formattersByName.get("Shi");
  if (!source || !formatter) throw new Error("Missing Shi formatter oracle.");

  const observed = source.values.map(({ input }) => ({
    input,
    output: formatter.format(new Decimal(input), 2, 0),
  }));
  const coveredCharacters = new Set(
    observed.flatMap(({ output }) =>
      typeof output === "string" ? Array.from(output) : [],
    ),
  );

  expect(observed).toEqual(source.values);
  expect(sourceAlphabet).toHaveLength(33);
  expect(
    sourceAlphabet.filter((character) => !coveredCharacters.has(character)),
  ).toEqual([]);
  expect(
    observed.every(({ output }) => {
      if (typeof output !== "string") return false;
      const characters = Array.from(output);
      const body = output.startsWith("-") ? characters.slice(1) : characters;
      return body.length === 3;
    }),
  ).toBe(true);
});

it("matches Chinese formatter magnitude, carry, and suffix boundaries", () => {
  const inputs = chineseNotationBoundaryInputs();
  const source = fixture.data.notationSemantics.directFormatterOutputs.find(
    ({ notation }) => notation === "Chinese",
  );
  const formatter = formattersByName.get("Chinese");
  if (!source || !formatter)
    throw new Error("Missing Chinese formatter oracle.");

  const expected = inputs.map((input) => {
    const value = source.values.find((candidate) => candidate.input === input);
    if (!value) throw new Error(`Missing Chinese source input: ${input}`);
    return value;
  });
  const observed = inputs.map((input) => ({
    input,
    output: formatter.format(new Decimal(input), 2, 0),
  }));

  expect(observed).toEqual(expected);
});

it("matches Zalgo transforms and its seeded positive/negative sentinel draws", () => {
  const inputs = [
    "0",
    "-1e-301",
    "999.999",
    "1000",
    "1e308",
    "1e8999999999999999",
    "-1e8999999999999999",
    "1e9000000000000000",
    "-1e9000000000000000",
    "1e9000000000000001",
    "-1e9000000000000001",
  ];
  const source = fixture.data.notationSemantics.directFormatterOutputs.find(
    ({ notation }) => notation === "Zalgo",
  );
  const formatter = formattersByName.get("Zalgo");
  if (!source || !formatter) throw new Error("Missing Zalgo formatter oracle.");

  const expected = inputs.map((input) => {
    const value = source.values.find((candidate) => candidate.input === input);
    if (!value) throw new Error(`Missing Zalgo source input: ${input}`);
    return value;
  });

  withReferenceRandom((randomCalls) => {
    const drawsAfterEachInput: number[] = [];
    const observed = inputs.map((input) => {
      const output = formatter.format(new Decimal(input), 2, 0);
      drawsAfterEachInput.push(randomCalls());
      return { input, output };
    });

    expect(observed).toEqual(expected);
    expect(drawsAfterEachInput).toEqual([0, 0, 0, 0, 0, 0, 0, 8, 16, 24, 32]);
    expect(randomCalls()).toBe(32);
  });
});

it("matches Haha Funny zero, reciprocal, and minimum-to-extra-loop boundaries", () => {
  const inputs = ["0", "0.999", "1", ...hahaFunnyLoopBoundaryInputs()];
  const source = fixture.data.notationSemantics.directFormatterOutputs.find(
    ({ notation }) => notation === "Haha Funny",
  );
  const formatter = formattersByName.get("Haha Funny");
  if (!source || !formatter)
    throw new Error("Missing Haha Funny formatter oracle.");

  const expected = inputs.map((input) => {
    const value = source.values.find((candidate) => candidate.input === input);
    if (!value) throw new Error(`Missing Haha Funny source input: ${input}`);
    return value;
  });
  const observed = inputs.map((input) => ({
    input,
    output: formatter.format(new Decimal(input), 2, 0),
  }));

  expect(observed).toEqual(expected);
  expect(expected[0]?.output).toBe("42069");
});

it("matches Nice negative-log formatting and sentinel paths", () => {
  const inputs = [
    "-0.5",
    "0",
    "0.5",
    "1",
    "1000",
    "1e9000000000000000",
    "-1e9000000000000000",
  ];
  const source = fixture.data.notationSemantics.directFormatterOutputs.find(
    ({ notation }) => notation === "Nice",
  );
  const formatter = formattersByName.get("Nice");
  if (!source || !formatter) throw new Error("Missing Nice formatter oracle.");

  const expected = inputs.map((input) => {
    const value = source.values.find((candidate) => candidate.input === input);
    if (!value) throw new Error(`Missing Nice source input: ${input}`);
    return value;
  });
  const observed = inputs.map((input) => ({
    input,
    output: formatter.format(new Decimal(input), 2, 0),
  }));

  expect(observed).toEqual(expected);
  expect(expected[0]?.output).toEqual(expect.stringContaining("^"));
  expect(expected[5]?.output).toBe("69420");
  expect(expected[6]?.output).toBe("-69420");
});

it("matches Evil formatter threshold and even/odd power branches", () => {
  const inputs = evilNotationBoundaryInputs();
  const source = fixture.data.notationSemantics.directFormatterOutputs.find(
    ({ notation }) => notation === "Evil",
  );
  const formatter = formattersByName.get("Evil");
  if (!source || !formatter) throw new Error("Missing Evil formatter oracle.");

  // `Decimal.pow` goes through Math.pow, whose last digit can round differently
  // per OS, so match each source input by value and format the source's string.
  const expected = inputs.map((input) => {
    const value = source.values.find(
      (candidate) =>
        candidate.input === input ||
        Math.abs(Number(candidate.input) / Number(input) - 1) <
          4 * Number.EPSILON,
    );
    if (!value) throw new Error(`Missing Evil source input: ${input}`);
    return value;
  });
  const observed = expected.map(({ input }) => ({
    input,
    output: formatter.format(new Decimal(input), 2, 0),
  }));
  const branches = expected.map(({ input }) => {
    const logLogValue = Math.log(new Decimal(input).log(2)) / Math.log(2);
    const nearestInteger = Math.round(logLogValue);
    return nearestInteger < 6 || Math.abs(logLogValue - nearestInteger) > 0.25
      ? "original"
      : nearestInteger % 2 === 0
        ? "square"
        : "square-root";
  });

  expect(branches).toEqual([
    "original",
    "original",
    "square",
    "square",
    "square",
    "original",
    "original",
    "square-root",
    "square-root",
    "square-root",
    "original",
    "original",
  ]);
  expect(observed).toEqual(expected);
});

it("matches Greek Letters formatter base-49 digit and loop boundaries", () => {
  const inputs = greekLetterBoundaryInputs();
  const source = fixture.data.notationSemantics.directFormatterOutputs.find(
    ({ notation }) => notation === "Greek Letters",
  );
  const formatter = formattersByName.get("Greek Letters");
  if (!source || !formatter)
    throw new Error("Missing Greek Letters formatter oracle.");

  const expected = inputs.map((input) => {
    const value = source.values.find((candidate) => candidate.input === input);
    if (!value) throw new Error(`Missing Greek Letters source input: ${input}`);
    return value;
  });
  const observed = inputs.map((input) => ({
    input,
    output: formatter.format(new Decimal(input), 2, 0),
  }));
  const suffixLengths = observed.map(
    ({ output }) => output.split(" ")[1]?.length,
  );
  const allObserved = source.values.map(({ input }) => ({
    input,
    output: formatter.format(new Decimal(input), 2, 0),
  }));
  const coveredSymbols = new Set(
    allObserved.flatMap(({ output }) =>
      typeof output === "string"
        ? Array.from(output).filter(
            (character) =>
              character.codePointAt(0)! >= 0x370 &&
              character.codePointAt(0)! <= 0x3ff,
          )
        : [],
    ),
  );

  expect(suffixLengths).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 3]);
  expect(allObserved).toEqual(source.values);
  expect(coveredSymbols.size).toBe(49);
  expect(observed).toEqual(expected);
});

it("matches Coronavirus replacement branches for every emoji and preserves other characters", () => {
  const source =
    fixture.data.notationSemantics.communityMethodOutputs.coronavirusInfect;
  const baseFormatter = formattersByName.get("Coronavirus");
  if (!baseFormatter) throw new Error("Missing Coronavirus formatter.");
  const formatter = baseFormatter as typeof baseFormatter & {
    infect(input: string): string;
  };

  const observed = source.values.map(({ input }) => ({
    input,
    output: formatter.infect(input),
  }));
  const distinctOutputs = observed.map(({ output }) => {
    const characters = Array.from(output);
    const emoji = characters.at(-1);
    if (!emoji)
      throw new Error("Coronavirus formatter emitted an empty result.");
    return emoji;
  });

  expect(source.sourcePath).toBe("Scripts/adcommunitynotations.js");
  expect(observed).toEqual(source.values);
  expect(observed.every(({ output }) => output.startsWith("01234."))).toBe(
    true,
  );
  expect(new Set(distinctOutputs).size).toBe(10);
});

it("matches Japanese suffix-table, residual-suffix, and exponent branches", () => {
  const source =
    fixture.data.notationSemantics.communityMethodOutputs.japaneseFormatter;
  const formatter = formattersByName.get("Japanese");
  if (!formatter) throw new Error("Missing Japanese formatter.");
  const inputs = japaneseNotationBoundaryInputs();

  const observed = inputs.map((input) => ({
    input,
    output: captureFormatterOutput(() =>
      formatter.format(new Decimal(input), 2, 0),
    ),
  }));
  const outputByInput = new Map(
    observed.map(({ input, output }) => [input, output]),
  );

  expect(source.sourcePath).toBe(
    "@antimatter-dimensions/notations@1.6.0/dist/ad-notations.community.esm.js",
  );
  expect(source.values).toHaveLength(inputs.length);
  expect(observed).toEqual(source.values);
  expect(outputByInput.get("1e4")).toBe("1万");
  expect(outputByInput.get("1e8")).toBe("1億");
  expect(outputByInput.get("1.0001e8")).toBe("1億1万");
  expect(outputByInput.get("1.2345e8")).toBe("1億2345万");
  expect(outputByInput.get("1e68")).toBe("1無量大数");
  expect(outputByInput.get("1e71")).toBe("1000無量大数");
  expect(outputByInput.get("1e72")).toBe("1.00×10の72乗");
  expect(outputByInput.get("1e73")).toBe("1.00×10の73乗");
});

it("matches Omega and Omega Short branch and safe-integer boundaries", () => {
  const source =
    fixture.data.notationSemantics.communityMethodOutputs.omegaNotations;
  const inputs = omegaNotationBoundaryInputs();

  expect(source.sourcePath).toBe(
    "@antimatter-dimensions/notations@1.6.0/dist/ad-notations.community.esm.js",
  );
  expect(source.formatters.map(({ notation }) => notation)).toEqual([
    "Omega",
    "Omega (Short)",
  ]);

  for (const { notation, values } of source.formatters) {
    const formatter = formattersByName.get(notation);
    if (!formatter) throw new Error(`Missing ${notation} formatter.`);

    const observed = inputs.map((input) => ({
      input,
      output: captureFormatterOutput(() =>
        formatter.format(new Decimal(input), 2, 0),
      ),
    }));
    expect(values).toHaveLength(inputs.length);
    expect(observed).toEqual(values);
  }
});

it("matches Tritetrated binary-search boundaries", () => {
  const source =
    fixture.data.notationSemantics.communityMethodOutputs.tritetratedNotation;
  const inputs = [
    "0",
    "0.5",
    "0.9999999",
    "1",
    "1.0000001",
    "15.999999",
    "16",
    "16.000001",
    "1e6",
    "1e100",
  ];
  const formatter = formattersByName.get("Tritetrated");
  if (!formatter) throw new Error("Missing Tritetrated formatter.");
  const tritetrated = formatter as typeof formatter & {
    tritetrated(value: Decimal): string;
  };

  expect(source.sourcePath).toBe(
    "@antimatter-dimensions/notations@1.6.0/dist/ad-notations.community.esm.js",
  );
  expect(source.values).toHaveLength(inputs.length);
  expect(
    inputs.map((input) => ({
      input,
      output: captureFormatterOutput(() =>
        tritetrated.tritetrated(new Decimal(input)),
      ),
    })),
  ).toEqual(source.values);
});

it("matches Flags table, base transitions, and exponent boundaries", () => {
  const source =
    fixture.data.notationSemantics.communityMethodOutputs.flagsNotation;
  const formatter = formattersByName.get("Flags");
  if (!formatter) throw new Error("Missing Flags formatter.");
  const flags = formatter as typeof formatter & {
    letters: string[];
    transcribe(normalizedExponent: number): string[];
  };
  const base = flags.letters.length;
  const engineeringExponents = [
    -3,
    0,
    3,
    (base - 1) * 3,
    base * 3,
    (base + 1) * 3,
    (base * 2 - 1) * 3,
    base * 2 * 3,
    (base * 2 + 1) * 3,
    base * base * 3,
    (base * base + 1) * 3,
  ];
  const inputs = [
    ...new Set([
      "1e-3",
      "1",
      ...Array.from({ length: base }, (_, index) => `1e${(index + 1) * 3}`),
      ...engineeringExponents.map((exponent) => `1e${exponent}`),
    ]),
  ];

  expect(source.sourcePath).toBe(
    "@antimatter-dimensions/notations@1.6.0/dist/ad-notations.community.esm.js",
  );
  expect(source.base).toBe(base);
  expect(source.letters).toEqual(flags.letters);
  expect(source.transcriptionBoundaries).toEqual(
    engineeringExponents.map((engineeringExponent) => ({
      engineeringExponent,
      output: flags
        .transcribe(engineeringExponent)
        .map((letter) => letter ?? null),
    })),
  );
  expect(source.values).toHaveLength(inputs.length);
  expect(
    inputs.map((input) => ({
      input,
      output: captureFormatterOutput(() =>
        flags.format(new Decimal(input), 2, 0),
      ),
    })),
  ).toEqual(source.values);
});

it("matches Elemental lookup tables and output-assembly branches", () => {
  const source =
    fixture.data.notationSemantics.communityMethodOutputs.elementalNotation;
  const formatter = formattersByName.get("Elemental");
  if (!formatter) throw new Error("Missing Elemental formatter.");
  const elemental = formatter as typeof formatter & {
    getAbbreviationAndValue(value: number): [string, number];
    formatElementalPart(abbreviation: string, amount: number): string;
    elemental(value: Decimal, places: number): string;
    infinite: string;
  };

  expect(source.sourcePath).toBe(
    "@antimatter-dimensions/notations@1.6.0/dist/ad-notations.community.esm.js",
  );
  expect(source.listLengths).toEqual([1, 8, 8, 18, 18, 32, 32, 1]);
  expect(source.lookups).toHaveLength(118);
  const sourceSymbols = source.lookups.map(({ output }) => {
    if (!Array.isArray(output)) throw new Error("Elemental lookup failed.");
    return output[0];
  });
  expect(new Set(sourceSymbols).size).toBe(118);
  expect(
    source.lookups.map(({ listIndex, elementIndex, input }) => ({
      listIndex,
      elementIndex,
      input,
      output: elemental.getAbbreviationAndValue(input),
    })),
  ).toEqual(source.lookups);
  expect(source.partFormatting).toHaveLength(2);
  expect(
    source.partFormatting.map(({ abbreviation, amount }) => ({
      abbreviation,
      amount,
      output: elemental.formatElementalPart(abbreviation, amount),
    })),
  ).toEqual(source.partFormatting);
  expect(source.methodValues).toHaveLength(12);
  expect(
    source.methodValues.map(({ input }) => ({
      input,
      output: captureFormatterOutput(() =>
        elemental.elemental(new Decimal(input), 2),
      ),
    })),
  ).toEqual(source.methodValues);
  expect(source.formattedValues).toHaveLength(14);
  expect(
    source.formattedValues.map(({ input }) => ({
      input,
      output: captureFormatterOutput(() =>
        elemental.format(new Decimal(input), 2, 0),
      ),
    })),
  ).toEqual(source.formattedValues);
  expect(source.infinite).toBe(elemental.infinite);
});

it("matches Precise Prime factorization, tower, and numeric-limit branches", () => {
  const source =
    fixture.data.notationSemantics.communityMethodOutputs.precisePrimeNotation;
  const formatter = formattersByName.get("Precise Prime");
  if (!formatter) throw new Error("Missing Precise Prime formatter.");
  const precisePrime = formatter as typeof formatter & {
    primify(value: Decimal): string;
    maybeParenthesize(value: string, parenthesize: boolean): string;
    formatPowerTower(exponents: number[]): string;
    formatFromList(factors: number[]): string;
    primesFromInt(value: number): number[];
    formatUnder1000(value: number): string;
    format(value: Decimal, places: number, placesUnder1000: number): string;
    infinite: string;
  };

  expect(source.sourcePath).toBe(
    "@antimatter-dimensions/notations@1.6.0/dist/ad-notations.community.esm.js",
  );
  expect(source.constants.maxSafeInteger).toBe(Number.MAX_SAFE_INTEGER);
  expect(source.constants.maxFactor).toBe(10_000);
  expect(source.constants.decimalMaxMantissa).toBe(Decimal.MAX_VALUE.m);
  expect(source.constants.decimalMaxExponent).toBe(Decimal.MAX_VALUE.e);
  expect(source.constants.decimalMaxLog10).toBe(Decimal.MAX_VALUE.log10());
  expect(source.constants.decimalMaxTowerExponent).toBeLessThan(
    source.constants.maxSafeInteger,
  );

  expect(source.primeFactorizations).toHaveLength(18);
  expect(
    source.primeFactorizations.map(({ input }) => ({
      input,
      output: precisePrime.primesFromInt(input),
    })),
  ).toEqual(source.primeFactorizations);
  expect(
    source.primeFactorizations.find(({ input }) => input === 100_160_063)
      ?.output,
  ).toEqual([100_160_063]);
  expect(
    source.factorListFormatting.map(({ factors }) => ({
      factors,
      output: precisePrime.formatFromList(factors),
    })),
  ).toEqual(source.factorListFormatting);
  expect(
    source.parenthesization.map(({ value, parenthesize }) => ({
      value,
      parenthesize,
      output: precisePrime.maybeParenthesize(value, parenthesize),
    })),
  ).toEqual(source.parenthesization);
  expect(
    source.powerTowers.map(({ exponents }) => ({
      exponents,
      output: precisePrime.formatPowerTower(exponents),
    })),
  ).toEqual(source.powerTowers);
  expect(
    source.primifyValues.map(({ input }) => ({
      input,
      output: captureFormatterOutput(() =>
        precisePrime.primify(new Decimal(input)),
      ),
    })),
  ).toEqual(source.primifyValues);
  expect(
    captureFormatterOutput(() => precisePrime.primify(Decimal.MAX_VALUE)),
  ).toBe(source.maxFinitePrimify);
  expect(
    captureFormatterOutput(() => precisePrime.format(Decimal.MAX_VALUE, 2, 0)),
  ).toBe(source.maxFiniteFormatted);
  expect(source.maxFiniteFormatted).toBe(precisePrime.infinite);
  expect(
    source.formatUnder1000Values.map(({ input }) => ({
      input,
      output: captureFormatterOutput(() => precisePrime.formatUnder1000(input)),
    })),
  ).toEqual(source.formatUnder1000Values);
  expect(
    source.formattedValues.map(({ input }) => ({
      input,
      output: captureFormatterOutput(() =>
        precisePrime.format(new Decimal(input), 2, 0),
      ),
    })),
  ).toEqual(source.formattedValues);
  expect(source.infinite).toBe(precisePrime.infinite);
});

it("matches Scientific and Engineering mantissa carry boundaries", () => {
  const inputs = scientificEngineeringRolloverInputs();

  for (const [notation, branchInputs] of [
    ["Scientific", inputs.slice(0, 3)],
    ["Engineering", inputs.slice(3)],
  ] as const) {
    const source = fixture.data.notationSemantics.directFormatterOutputs.find(
      (row) => row.notation === notation,
    );
    const formatter = formattersByName.get(notation);
    if (!source || !formatter)
      throw new Error(`Missing ${notation} formatter oracle.`);

    const expected = branchInputs.map((input) => {
      const value = source.values.find(
        (candidate) => candidate.input === input,
      );
      if (!value) throw new Error(`Missing ${notation} source input: ${input}`);
      return value;
    });
    const observed = branchInputs.map((input) => ({
      input,
      output: formatter.format(new Decimal(input), 2, 0),
    }));

    expect(observed).toEqual(expected);
    if (notation === "Scientific") {
      // The pinned Number multiplication leaves the textual 9.995 below the
      // carry; the adjacent higher decimal crosses it in Chromium.
      expect(observed[0]!.output).toBe(observed[1]!.output);
      expect(observed[1]!.output).not.toBe(observed[2]!.output);
    } else {
      expect(observed[0]!.output).not.toBe(observed[1]!.output);
      expect(observed[1]!.output).toBe(observed[2]!.output);
    }
  }
});

it("matches Clock base-12 thresholds and repeated high-exponent loop paths", () => {
  const inputs = clockBoundaryInputs();
  const source = fixture.data.notationSemantics.directFormatterOutputs.find(
    ({ notation }) => notation === "Clock",
  );
  const formatter = formattersByName.get("Clock");
  if (!source || !formatter) throw new Error("Missing Clock formatter oracle.");

  const expected = inputs.map((input) => {
    const value = source.values.find((candidate) => candidate.input === input);
    if (!value) throw new Error(`Missing Clock source input: ${input}`);
    return value;
  });
  const observed = inputs.map((input) => ({
    input,
    output: formatter.format(new Decimal(input), 2, 0),
  }));

  expect(observed).toEqual(expected);
  const outputs = observed.map(({ output }) => output);
  expect(outputs.slice(0, 4)).toEqual(["🕚", "🕛🕛", "🕛🕛", "🕛🕛"]);
  expect(outputs[4]).not.toBe(outputs[5]);
  expect(outputs[7]).toBe(outputs[8]);
  expect(outputs[8]).not.toBe(outputs[9]);
  expect(outputs[10]).not.toBe(outputs[11]);
  expect(outputs[13]).not.toBe(outputs[14]);
  expect(outputs[16]).not.toBe(outputs[17]);
  expect(outputs[19]).toBe("🕚🕔🕓🕙");
});

it("matches custom-base digit rounding and mantissa carry for Binary and Hexadecimal", () => {
  const inputs = customBaseBoundaryInputs();
  const cases = [
    {
      notation: "Binary",
      digitRounding: ["1.4999999999999", "1.5", "1.5000000000001"],
      mantissaCarry: ["1919.999999999", "1920", "1920.000000001"],
      carriesAtBoundary: true,
    },
    {
      notation: "Hexadecimal",
      digitRounding: ["15.4999999999999", "15.5", "15.5000000000001"],
      mantissaCarry: ["4095.499999999999", "4095.5", "4095.500000000001"],
      carriesAtBoundary: false,
    },
  ] as const;

  for (const {
    notation,
    digitRounding,
    mantissaCarry,
    carriesAtBoundary,
  } of cases) {
    const source = fixture.data.notationSemantics.directFormatterOutputs.find(
      (row) => row.notation === notation,
    );
    const formatter = formattersByName.get(notation);
    if (!source || !formatter)
      throw new Error(`Missing ${notation} formatter oracle.`);

    const expected = inputs.map((input) => {
      const value = source.values.find(
        (candidate) => candidate.input === input,
      );
      if (!value) throw new Error(`Missing ${notation} source input: ${input}`);
      return value;
    });
    const observed = inputs.map((input) => ({
      input,
      output: formatter.format(new Decimal(input), 2, 0),
    }));
    expect(observed).toEqual(expected);

    const outputByInput = new Map(
      expected.map(({ input, output }) => [input, output]),
    );
    expect(outputByInput.get("0")).toBe("");
    expect(outputByInput.get(digitRounding[0])).not.toBe(
      outputByInput.get(digitRounding[1]),
    );
    expect(outputByInput.get(digitRounding[1])).toBe(
      outputByInput.get(digitRounding[2]),
    );
    if (carriesAtBoundary) {
      expect(outputByInput.get(mantissaCarry[0])).not.toBe(
        outputByInput.get(mantissaCarry[1]),
      );
      expect(outputByInput.get(mantissaCarry[1])).toBe(
        outputByInput.get(mantissaCarry[2]),
      );
    } else {
      expect(outputByInput.get(mantissaCarry[0])).toBe(
        outputByInput.get(mantissaCarry[1]),
      );
      expect(outputByInput.get(mantissaCarry[1])).not.toBe(
        outputByInput.get(mantissaCarry[2]),
      );
    }
  }
});

it("matches every pinned Blind formatter dispatch and override", () => {
  const inputs = blindDispatchInputs();
  const source = fixture.data.notationSemantics.directFormatterOutputs.find(
    ({ notation }) => notation === "Blind",
  );
  const formatter = formattersByName.get("Blind");
  if (!source || !formatter) throw new Error("Missing Blind formatter oracle.");

  const expected = inputs.map((input) => {
    const value = source.values.find((candidate) => candidate.input === input);
    if (!value) throw new Error(`Missing Blind source input: ${input}`);
    return value;
  });
  const observed = inputs.map((input) => ({
    input,
    output: formatter.format(new Decimal(input), 2, 0),
  }));
  expect(observed).toEqual(expected);
  expect(observed.map(({ output }) => output)).toEqual(inputs.map(() => " "));
});

it("matches every pinned YesNo formatter dispatch and zero boundary", () => {
  const cases = yesNoDispatchCases();
  const source = fixture.data.notationSemantics.directFormatterOutputs.find(
    ({ notation }) => notation === "YesNo",
  );
  const formatter = formattersByName.get("YesNo");
  if (!source || !formatter) throw new Error("Missing YesNo formatter oracle.");

  for (const { input, branch } of cases) {
    const expected = source.values.find((value) => value.input === input);
    if (!expected) throw new Error(`Missing YesNo source input: ${input}`);

    const observed = formatter.format(new Decimal(input), 2, 0);
    expect(observed, branch).toBe(expected.output);
    expect(expected.output, `${branch} source outcome`).toBe(
      input === "0" ? "NO" : "YES",
    );
  }
});

it("matches Roman symbol, fractional, and recursive-scale boundaries", () => {
  const inputs = romanBoundaryInputs();
  const source = fixture.data.notationSemantics.directFormatterOutputs.find(
    ({ notation }) => notation === "Roman",
  );
  const formatter = formattersByName.get("Roman");
  if (!source || !formatter) throw new Error("Missing Roman formatter oracle.");

  const expected = inputs.map((input) => {
    const value = source.values.find((candidate) => candidate.input === input);
    if (!value) throw new Error(`Missing Roman source input: ${input}`);
    return value;
  });
  const observed = inputs.map((input) => ({
    input,
    output: formatter.format(new Decimal(input), 2, 0),
  }));
  expect(observed).toEqual(expected);

  const outputFor = (input: string) => {
    const output = observed.find((value) => value.input === input)?.output;
    if (typeof output !== "string") {
      throw new Error(`Missing Roman string output for ${input}`);
    }
    return output;
  };
  expect(outputFor("3999999.99")).not.toContain("↑");
  expect(outputFor("4000000")).toContain("↑");
  expect(outputFor("4000000.01")).toContain("↑");
  expect(outputFor("-4000000")).toContain("↑");
  expect(outputFor("0")).toBe("nulla");
  expect(outputFor("0.1")).not.toBe(outputFor("0.099"));
  expect(outputFor("0.5")).toContain("Ｓ");
});

it("matches Custom Letters and Cancer base-26 transcription boundaries", () => {
  const inputs = letterTranscriptionBoundaryInputs();
  for (const notation of ["Letters", "Cancer"] as const) {
    const source = fixture.data.notationSemantics.directFormatterOutputs.find(
      (entry) => entry.notation === notation,
    );
    const formatter = formattersByName.get(notation);
    if (!source || !formatter) {
      throw new Error(`Missing ${notation} formatter oracle.`);
    }

    const expected = inputs.map((input) => {
      const value = source.values.find(
        (candidate) => candidate.input === input,
      );
      if (!value) throw new Error(`Missing ${notation} source input: ${input}`);
      return value;
    });
    const observed = inputs.map((input) => ({
      input,
      output: formatter.format(new Decimal(input), 2, 0),
    }));

    expect(observed).toEqual(expected);
  }
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

it("matches Imperial volume units and source method branches", () => {
  const source =
    fixture.data.notationSemantics.adMethodOutputs.imperialNotation;
  const formatter = formattersByName.get("Imperial");
  if (!formatter) throw new Error("Missing Imperial formatter.");
  const imperial = formatter as typeof formatter & {
    formatUnder1000(value: number): string;
    formatDecimal(value: Decimal): string;
    convertToVolume(value: number, adjective: string): string;
    formatMetric(value: number): string;
    checkSmallUnits(
      adjective: string,
      value: number,
      volumeIndex: number,
    ): string | undefined;
    findVolumeUnit(value: number): number;
    checkAlmost(
      adjective: string,
      value: number,
      numBig: number,
      bigIndex: number,
    ): string | undefined;
    bigAndSmall(
      adjective: string,
      numBig: number,
      big: [number, string, number],
      numSmall: number,
      small: [number, string, number],
    ): string;
    almost(
      adjective: string,
      numBig: number,
      big: [number, string, number],
    ): string;
    almostOrShortOf(
      value: number,
      adjective: string,
      numBig: number,
      big: [number, string, number],
      small: [number, string, number],
    ): string;
    shortOf(
      adjective: string,
      numBig: number,
      big: [number, string, number],
      numSmall: number,
      small: [number, string, number],
    ): string;
    pluralOrArticle(num: number, value: string): string;
    addArticle(value: string): string;
    infinite: string;
  };
  const minim = 61_611_520;
  const gallon = minim * 60 * 8 * 4 * 2 * 2 * 2 * 4;
  const volumeUnits: [number, string, number][] = [
    [0, "pL", 0],
    [minim, "minim", 0],
    [minim * 60, "dram", 1],
    [minim * 60 * 8, "ounce", 2],
    [minim * 60 * 8 * 4, "gill", 2],
    [minim * 60 * 8 * 4 * 2, "cup", 3],
    [minim * 60 * 8 * 4 * 2 * 2, "pint", 4],
    [minim * 60 * 8 * 4 * 2 * 2 * 2, "quart", 4],
    [gallon, "gallon", 4],
    [gallon * 4.5, "pin", 3],
    [gallon * 9, "firkin", 3],
    [gallon * 18, "kilderkin", 4],
    [gallon * 36, "barrel", 4],
    [gallon * 54, "hogshead", 5],
    [gallon * 72, "puncheon", 6],
    [gallon * 108, "butt", 7],
    [gallon * 216, "tun", 7],
  ];
  const adjectives = [
    "minute ",
    "tiny ",
    "petite ",
    "small ",
    "modest ",
    "medium ",
    "generous ",
    "large ",
    "great ",
    "grand ",
    "huge ",
    "gigantic ",
    "immense ",
    "colossal ",
    "vast ",
    "galactic ",
    "cosmic ",
    "infinite ",
    "eternal ",
  ];
  const maxVolume = 10 * volumeUnits[volumeUnits.length - 1]![0];

  expect(source.sourcePath).toBe(
    "@antimatter-dimensions/notations@1.6.0/dist/ad-notations.umd.js",
  );
  expect(fixture.data.notationSemantics.seededSample).toMatchObject({
    algorithm: "xorshift32",
    seed: 0x494d4231,
  });
  expect(fixture.data.notationSemantics.seededSample.inputs).toHaveLength(32);
  expect(
    fixture.data.notationSemantics.seededSample.inputs.every((input) =>
      fixture.data.notationSemantics.directFormatterInputs.includes(input),
    ),
  ).toBe(true);
  expect(source.constants).toEqual({
    volumeUnits,
    adjectives,
    maxVolume,
    logMaxVolume: Math.log10(maxVolume),
    reduceRatio: Math.log10(maxVolume / minim),
  });

  expect(source.findVolumeUnit).toHaveLength(50);
  expect(
    source.findVolumeUnit.map(({ label, value, expectedIndex }) => ({
      label,
      value,
      expectedIndex,
      output: imperial.findVolumeUnit(value),
    })),
  ).toEqual(source.findVolumeUnit);
  expect(
    source.findVolumeUnit.every(
      ({ expectedIndex, output }) =>
        typeof output === "number" && output === expectedIndex,
    ),
  ).toBe(true);

  expect(
    source.formatMetric.map(({ input }) => ({
      input,
      output: captureFormatterOutput(() => imperial.formatMetric(input)),
    })),
  ).toEqual(source.formatMetric);
  const optionalStringOutput = (operation: () => string | undefined) => {
    try {
      return operation() ?? null;
    } catch (error) {
      return { error: String(error) };
    }
  };
  expect(
    source.checkSmallUnits.map(({ label, adjective, value, volumeIndex }) => ({
      label,
      adjective,
      value,
      volumeIndex,
      output: optionalStringOutput(() =>
        imperial.checkSmallUnits(adjective, value, volumeIndex),
      ),
    })),
  ).toEqual(source.checkSmallUnits);
  expect(source.checkSmallUnits.map(({ label }) => label)).toEqual(
    expect.arrayContaining([
      "vol-1-next-unit-9.5-minims-below",
      "vol-1-next-unit-9.5-minims-at",
      "vol-1-next-unit-9.5-minims-above",
      "minim-article",
      "minim-one-decimal-place",
      "minim-zero-decimal-places",
      "dram-remainder-at-50-minims",
      "dram-remainder-at-50.5-minims",
      "dram-remainder-at-51-minims",
      "other-volume-index-returns-undefined",
    ]),
  );
  expect(
    source.checkAlmost.map(({ label, adjective, value, numBig, bigIndex }) => ({
      label,
      adjective,
      value,
      numBig,
      bigIndex,
      output: optionalStringOutput(() =>
        imperial.checkAlmost(adjective, value, numBig, bigIndex),
      ),
    })),
  ).toEqual(source.checkAlmost);
  expect(source.checkAlmost.map(({ label }) => label)).toEqual(
    expect.arrayContaining([
      "unit-3-almost-below",
      "unit-3-almost-at",
      "unit-3-short-below",
      "unit-3-short-at",
      "unit-3-no-match",
      "unit-16-almost-at",
      "unit-16-short-at",
    ]),
  );

  expect(
    source.convertToVolume.map(({ label, value }) => ({
      label,
      value,
      volumeIndex: imperial.findVolumeUnit(value),
      output: captureFormatterOutput(() =>
        imperial.convertToVolume(value, "minute "),
      ),
    })),
  ).toEqual(source.convertToVolume);
  expect(source.convertToVolume.map(({ label }) => label)).toEqual(
    expect.arrayContaining([
      "metric-zero",
      "metric-sub-10",
      "metric-nanolitre",
      "metric-microlitre",
      "volume-5-almost-next-pint",
      "volume-5-short-of-next-pint",
      "near-next-tun-almost",
      "near-next-tun-short-of",
      "tun-only-below-small-unit",
      "third-unit-count-over-9-break",
      "third-unit-exact-error",
    ]),
  );
  const highThirdUnitCase = source.convertToVolume.find(
    ({ label }) => label === "third-unit-count-over-9-break",
  );
  if (!highThirdUnitCase) throw new Error("Missing third-unit cap boundary.");
  expect(
    Math.floor(
      (highThirdUnitCase.value % source.constants.volumeUnits[16]![0]) /
        source.constants.volumeUnits[10]![0],
    ),
  ).toBe(11);
  // The loop's strict lower bound is always at least one, so index 1 is unreachable.
  expect(
    volumeUnits
      .slice(1)
      .every(([, , unitLevels], offset) => offset + 1 - unitLevels >= 1),
  ).toBe(true);

  expect(
    source.formatUnder1000.map(({ input }) => ({
      input,
      output: captureFormatterOutput(() => imperial.formatUnder1000(input)),
    })),
  ).toEqual(source.formatUnder1000);
  expect(
    source.formatDecimal.map(({ input }) => ({
      input,
      output: captureFormatterOutput(() =>
        imperial.formatDecimal(new Decimal(input)),
      ),
    })),
  ).toEqual(source.formatDecimal);
  expect(
    captureFormatterOutput(() => imperial.formatDecimal(Decimal.MAX_VALUE)),
  ).toEqual(source.maxFiniteFormatDecimal);
  expect(source.formatDecimal.slice(3, 6).map(({ output }) => output)).toEqual([
    "almost 10 minute tuns",
    "a tiny minim",
    "a tiny minim",
  ]);
  expect(source.formatDecimal.slice(6, 9).map(({ output }) => output)).toEqual([
    "almost 10 tiny tuns",
    "10 petite minims",
    "10 petite minims",
  ]);
  expect(
    source.formattedValues.map(({ input }) => ({
      input,
      output: captureFormatterOutput(() =>
        imperial.format(new Decimal(input), 2, 0),
      ),
    })),
  ).toEqual(source.formattedValues);
  expect(
    source.phrases.map(({ method, num, value }) => ({
      method,
      ...(num === undefined ? {} : { num }),
      value,
      output:
        method === "addArticle"
          ? imperial.addArticle(value)
          : imperial.pluralOrArticle(num ?? 0, value),
    })),
  ).toEqual(source.phrases);
  expect(source.infinite).toBe(imperial.infinite);
});
