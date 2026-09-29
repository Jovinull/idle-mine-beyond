import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";

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
  metadata: {
    sourceCommit: string;
    licenseNotice: string;
    dependencies: { package: string; version: string; sha256: string }[];
  };
  data: {
    initialState: {
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
  expect(fixture.data.objects.slice(0, 215).map((object) => object.id)).toEqual(
    Array.from({ length: 215 }, (_, id) => id),
  );
  expect(fixture.data.objects.map((object) => object.id)).toContain(
    Number.MAX_SAFE_INTEGER,
  );
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
  expect(fixture.data.notationOutputs.length).toBeGreaterThanOrEqual(6);
});
