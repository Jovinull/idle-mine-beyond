import {
  Decimal,
  getRemixMineObject,
  type RemixMineObjectCatalog,
} from "@idle-mine-beyond/core";

type ProbeInput = { catalog: RemixMineObjectCatalog; ids: number[] };

function safeNumber(value: number): number | string {
  if (Number.isNaN(value)) return "NaN";
  if (value === Infinity) return "Infinity";
  if (value === -Infinity) return "-Infinity";
  if (Object.is(value, -0)) return "-0";
  return value;
}

function snapshotDecimal(value: Decimal) {
  return {
    decimal: value.toString(),
    mantissa: safeNumber(value.mantissa),
    exponent: safeNumber(value.exponent),
  };
}

function normalize(value: unknown): unknown {
  if (value instanceof Decimal) return snapshotDecimal(value);
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalize(item)]),
    );
  }
  if (typeof value === "number") return safeNumber(value);
  return value;
}

const output = document.querySelector<HTMLPreElement>("#result");
if (!output) throw new Error("Mine-object browser probe failed to initialize.");

const browserWindow = window as Window & {
  __idleMineObjectProbe?: (input: ProbeInput) => unknown;
};

browserWindow.__idleMineObjectProbe = ({ catalog, ids }) =>
  ids.map((id) => {
    const object = getRemixMineObject(id, catalog);
    return {
      id: object.id,
      name: object.name,
      hp: snapshotDecimal(object.hp),
      totalHp: snapshotDecimal(object.totalHp),
      defense: snapshotDecimal(object.defense),
      value: snapshotDecimal(object.value),
      colors: [...object.colors],
      skin: object.skin,
      drops: normalize(object.drops),
    };
  });

output.textContent = "Mine-object probe ready";
output.dataset.ready = "true";
