import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import {
  Decimal,
  createInitialRemixSimulationState,
  getRemixPowerPrestigeRows,
  isRemixPowersUnlocked,
  performRemixSimulationAction,
  type RemixMineObjectCatalog,
  type RemixSimulationState,
} from "../../packages/core/src/index.js";
import {
  createRemixFormatters,
  formatNumber,
} from "../../packages/formatting/src/index.js";

const corpus = JSON.parse(
  await readFile(
    new URL("../fixtures/parity/remix-reference-corpus.json", import.meta.url),
    "utf8",
  ),
) as {
  data: {
    mineObjectCatalog: RemixMineObjectCatalog;
    powersTableSemantics: {
      names: string[];
      icons: string[];
      unlock: { highestMineObjectLevel: number; unlocked: boolean }[];
      scenarios: {
        name: string;
        input: { powerResetKeepLevel: number; values: string[] };
        rows: {
          index: number;
          name: string;
          current: { decimal: string };
          next: { decimal: string } | null;
          prestigeEffect: { decimal: string } | null;
          cell: { visible: boolean; disabled: boolean; text: string } | null;
        }[];
      }[];
      prestiges: {
        name: string;
        input: {
          index: 0 | 1 | 2 | 3;
          powerResetKeepLevel: number;
          values: string[];
        };
        before: { decimal: string }[];
        after: { decimal: string }[];
        changed: boolean;
      }[];
    };
  };
};

const powers = corpus.data.powersTableSemantics;
const formatter = createRemixFormatters()[0]!;

function stateFor(values: readonly string[], retainLevel: number) {
  const state: RemixSimulationState = createInitialRemixSimulationState(
    corpus.data.mineObjectCatalog,
  );
  state.powers = {
    mining: new Decimal(values[0]!),
    craftsmanship: new Decimal(values[1]!),
    expertise: new Decimal(values[2]!),
    wisdom: new Decimal(values[3]!),
    exquisity: new Decimal(values[4]!),
  };
  state.upgrades.wisdom.powerResetKeep = retainLevel;
  return state;
}

it("matches the source Powers unlock, names, icons, and all captured table rows", () => {
  expect(powers.names).toEqual([
    "Power of Mining",
    "Power of Craftsmenship",
    "Power of Expertise",
    "Power of Wisdom",
    "Power of Exquisity",
  ]);
  expect(powers.icons).toEqual([
    "pickaxe.png",
    "upgrades/blacksmith.png",
    "upgrades/blacksmithskill.png",
    "wisdom.png",
    "gem.png",
  ]);
  for (const sample of powers.unlock) {
    expect(isRemixPowersUnlocked(sample.highestMineObjectLevel)).toBe(
      sample.unlocked,
    );
  }

  for (const scenario of powers.scenarios) {
    const state = stateFor(
      scenario.input.values,
      scenario.input.powerResetKeepLevel,
    );
    const rows = getRemixPowerPrestigeRows(state);
    expect(rows).toHaveLength(scenario.rows.length);

    for (const expected of scenario.rows) {
      const row = rows[expected.index]!;
      expect(row.currentValue.toString()).toBe(expected.current.decimal);
      expect(row.nextValue?.toString() ?? null).toBe(
        expected.next?.decimal ?? null,
      );
      expect(row.prestigeEffect?.toString() ?? null).toBe(
        expected.prestigeEffect?.decimal ?? null,
      );
      if (expected.cell === null) {
        expect(row.nextValue).toBeNull();
      } else {
        expect(row.buttonVisible).toBe(expected.cell.visible);
        expect(row.buttonDisabled).toBe(expected.cell.disabled);
        const text = row.buttonVisible
          ? `Prestige: x${formatNumber(row.prestigeEffect!, formatter, 2, 1e9, 2)}`
          : `Req. x${formatNumber(1e3, formatter)}`;
        expect(text).toBe(expected.cell.text);
      }
    }
  }
});

it("covers the strict prestige boundary below, at, and above its effect", () => {
  const cases = [
    ["active-power-prestige-effect", "below"],
    ["button-is-disabled-at-exact-prestige-effect", "equal"],
    ["button-is-disabled-when-next-power-meets-effect", "above"],
  ] as const;

  for (const [name, relation] of cases) {
    const scenario = powers.scenarios.find((entry) => entry.name === name);
    expect(scenario, `missing pinned source boundary ${name}`).toBeDefined();
    if (!scenario) throw new Error(`Missing pinned source boundary ${name}.`);

    const state = stateFor(
      scenario.input.values,
      scenario.input.powerResetKeepLevel,
    );
    const row = getRemixPowerPrestigeRows(state)[0]!;
    expect(row.nextValue).toBeDefined();
    expect(row.prestigeEffect).toBeDefined();
    if (!row.nextValue || !row.prestigeEffect) {
      throw new Error(`Missing next Power or effect for ${name}.`);
    }

    const comparisonMatches =
      relation === "below"
        ? row.nextValue.lt(row.prestigeEffect)
        : relation === "equal"
          ? row.nextValue.eq(row.prestigeEffect)
          : row.nextValue.gt(row.prestigeEffect);
    expect(comparisonMatches, `${name} should be ${relation}`).toBe(true);
    expect(row.buttonDisabled).toBe(relation !== "below");
  }
});

it("matches source Prestige effect floor and 1,000 transition boundaries", () => {
  const boundaries = [
    ["prestige-effect-floor-at-zero", "0"],
    ["prestige-effect-floor-below-threshold", "999"],
    ["prestige-effect-at-threshold", "1000"],
    ["prestige-effect-above-threshold", "1001"],
  ] as const;

  for (const [name, value] of boundaries) {
    const scenario = powers.scenarios.find((entry) => entry.name === name);
    expect(scenario, `missing pinned source boundary ${name}`).toBeDefined();
    if (!scenario) {
      throw new Error(`Missing pinned source boundary ${name}.`);
    }
    expect(scenario.input.values.slice(0, 4)).toEqual(Array(4).fill(value));

    const rows = getRemixPowerPrestigeRows(
      stateFor(scenario.input.values, scenario.input.powerResetKeepLevel),
    );
    for (let index = 0; index < 4; index += 1) {
      expect(rows[index]?.prestigeEffect?.toString()).toBe(
        scenario.rows[index]?.prestigeEffect?.decimal,
      );
    }
  }
});

it("matches source prestige targets, retention, and no-op boundaries", () => {
  expect(powers.prestiges.map(({ input }) => input.index)).toEqual([
    0, 1, 2, 3, 0, 0,
  ]);

  for (const sample of powers.prestiges) {
    const state = stateFor(
      sample.input.values,
      sample.input.powerResetKeepLevel,
    );
    const result = performRemixSimulationAction({
      state,
      action: { type: "prestigePower", index: sample.input.index },
    });
    expect(result.type).toBe("prestigePower");
    if (result.type !== "prestigePower") {
      throw new Error("Expected a Powers prestige transition.");
    }
    const actual = [
      result.state.powers.mining,
      result.state.powers.craftsmanship,
      result.state.powers.expertise,
      result.state.powers.wisdom,
      result.state.powers.exquisity,
    ].map((value) => value.toString());
    expect(actual).toEqual(sample.after.map(({ decimal }) => decimal));
    expect(sample.changed).toBe(
      sample.after.some(
        (value, index) => value.decimal !== sample.before[index]?.decimal,
      ),
    );
    expect(result.effects).toEqual([]);
  }

  const equalityCase = powers.prestiges.find(
    ({ name }) => name === "next-power-at-exact-prestige-effect-is-unchanged",
  );
  expect(equalityCase, "missing exact prestige equality action").toBeDefined();
  expect(equalityCase?.changed).toBe(false);
});
