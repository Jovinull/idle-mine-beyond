import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";

type DecimalValue = {
  decimal: string;
  mantissa: number | string;
  exponent: number | string;
};
type FormatterValue = { input: string; output: string | { error: string } };

const fixture = JSON.parse(
  await readFile(
    new URL("../fixtures/parity/remix-reference-corpus.json", import.meta.url),
    "utf8",
  ),
) as {
  metadata: {
    sourceCommit: string;
    licenseNotice: string;
    dependencies: { package: string; version: string; sha256: string }[];
  };
  data: {
    initialState: {
      numberFormatters: string[];
      minimumCraftDamage: DecimalValue;
      settings: {
        theme: string;
        tab: string;
        numberFormatterIndex: number;
        showMineObjLevel: boolean;
        showMinCraftDamage: boolean;
      };
      progress: {
        mineObjectLevel: number;
        mineObjectCount: number;
        specialObjectCount: number;
      };
      resources: { money: { decimal: string }; gems: { decimal: string } };
    };
    initialRates: {
      activeDamage: { decimal: string };
      idleDamage: { decimal: string };
      moneyPerClick: { decimal: string };
    };
    objects: {
      id: number;
      name: string;
      hp: { decimal: string };
      defense: { decimal: string };
      value: { decimal: string };
    }[];
    notationOutputs: { notation: string; values: unknown[] }[];
    notationSemantics: {
      formatterRegistry: { name: string }[];
      directFormatterInputs: string[];
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
          default: string | { error: string };
          precisionTwo: string | { error: string };
        }[];
      }[];
      formatPercent: { notation: string; values: FormatterValue[] }[];
      exponentFormatterInputs: number[];
      exponentFormatterOutputs: {
        notation: string;
        values: { input: number; output: string | { error: string } }[];
      }[];
    };
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

it("records the complete indexed mine-object range and high-ID oracle probes", () => {
  expect(fixture.metadata.sourceCommit).toBe(
    "0e0f4bf5a9c66e5603cda2ce4bd54213023dae21",
  );
  expect(fixture.metadata.licenseNotice).toContain(
    "Copyright (c) 2023 veprogames",
  );
  expect(fixture.data.objects.map((object) => object.id)).toEqual([
    ...Array.from({ length: 513 }, (_, id) => id),
    1_000,
    10_000,
    1_000_000,
    2_147_483_647,
    Number.MAX_SAFE_INTEGER,
  ]);
  expect(fixture.data.initialState.progress).toMatchObject({
    mineObjectLevel: 0,
    mineObjectCount: 72,
    specialObjectCount: 78,
  });
});

it("records independently observed starting values and reference outputs", () => {
  const mud = fixture.data.objects[0];
  const universe = fixture.data.objects.find((object) => object.id === 214);
  const maximumSafeId = fixture.data.objects.find(
    (object) => object.id === Number.MAX_SAFE_INTEGER,
  );

  expect(mud).toMatchObject({
    name: "Mud",
    hp: { decimal: "100" },
    defense: { decimal: "0" },
    value: { decimal: "2" },
  });
  expect(universe?.name).toBe("THE UNIVERSE");
  expect(maximumSafeId?.hp.decimal).toBe("Infinity");
  expect(fixture.data.initialState.resources).toMatchObject({
    money: { decimal: "0" },
    gems: { decimal: "5" },
  });
  expect(fixture.data.initialRates).toMatchObject({
    activeDamage: { decimal: "20" },
    idleDamage: { decimal: "15" },
    moneyPerClick: { decimal: "0.4" },
  });
  expect(fixture.data.initialState).toMatchObject({
    minimumCraftDamage: { decimal: "18" },
    settings: {
      theme: "light",
      tab: "main",
      numberFormatterIndex: 0,
      showMineObjLevel: false,
      showMinCraftDamage: false,
    },
  });
  expect(fixture.data.notationOutputs.length).toBeGreaterThanOrEqual(6);
});

it("captures formatting boundaries for every registered Remix formatter", () => {
  const notation = fixture.data.notationSemantics;
  const names = fixture.data.initialState.numberFormatters;

  expect(notation.formatterRegistry.map(({ name }) => name)).toEqual(names);
  expect(
    notation.directFormatterOutputs.map(({ notation: name }) => name),
  ).toEqual(names);
  expect(
    notation.formatNumberScenarios.map(({ notation: name }) => name),
  ).toEqual(names);
  expect(notation.formatPercent.map(({ notation: name }) => name)).toEqual(
    names,
  );
  expect(notation.exponentFormatterOutputs).toHaveLength(names.length);
  expect(notation.directFormatterInputs).toContain("1e100");
  expect(notation.directFormatterInputs).toContain("1e91");
  expect(notation.directFormatterInputs).toContain("1e99");

  const outputsFor = (
    rows: { notation: string; values: FormatterValue[] }[],
    formatter: string,
  ) => rows.find(({ notation: name }) => name === formatter)?.values;
  const standard = notation.formatNumberScenarios.find(
    ({ notation: name }) => name === "Standard",
  );
  const standardLimit = standard?.scenarios.find(
    ({ name }) => name === "limit-1e12",
  );
  const findOutput = (values: FormatterValue[] | undefined, input: string) =>
    values?.find((value) => value.input === input)?.output;

  expect(findOutput(standardLimit?.values, "1e12")).toBe("1,000,000,000,000");
  expect(findOutput(standardLimit?.values, "1000000000001")).toBe("1.00 T");
  const idleMineScenarios = notation.formatNumberScenarios.find(
    ({ notation: name }) => name === "Idle Mine Notation",
  );
  const idleMineLimit = idleMineScenarios?.scenarios.find(
    ({ name }) => name === "limit-1e12",
  );
  expect(findOutput(idleMineLimit?.values, "1e12")).toBe("1,000.00b");
  const standardThousands = notation.formatThousands.find(
    ({ notation: name }) => name === "Standard",
  );
  expect(
    standardThousands?.values.find(({ input }) => input === "999999999999")
      ?.default,
  ).toBe("999,999,999,999");
  expect(
    standardThousands?.values.find(({ input }) => input === "1e12")?.default,
  ).toBe("1 T");
  expect(
    outputsFor(notation.formatPercent, "Standard")?.find(
      ({ input }) => input === "0.005",
    )?.output,
  ).toBe("0.50%");

  const idleMine = outputsFor(
    notation.directFormatterOutputs,
    "Idle Mine Notation",
  );
  expect(findOutput(idleMine, "1e10")).toBe("10.00b");
  expect(findOutput(idleMine, "1e19")).toBe("10.00qt");

  const siCurrent = outputsFor(
    notation.directFormatterOutputs,
    "SI Notation (Current)",
  );
  const si2022 = outputsFor(
    notation.directFormatterOutputs,
    "SI Notation (2022)",
  );
  expect(findOutput(siCurrent, "1e27")).toBe("1.00 KY");
  expect(findOutput(si2022, "1e27")).toBe("1.00 Ronna");
  expect(findOutput(si2022, "1e30")).toBe("1.00 Quecca");
});
