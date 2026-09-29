import {
  CancerNotation,
  EngineeringNotation,
  LettersNotation,
  LogarithmNotation,
  ScientificNotation,
  StandardNotation,
  type NotationFormatter,
} from "@antimatter-dimensions/notations/dist/ad-notations.esm.js";
import { Decimal, type DecimalSource } from "@idle-mine-beyond/core";

export type { NotationFormatter };

const limitNotations = new Set(["Standard", "Scientific", "Engineering"]);

export function createInitialFormatters(): NotationFormatter[] {
  return [
    new StandardNotation(),
    new ScientificNotation(),
    new EngineeringNotation(),
    new LettersNotation(),
    new LogarithmNotation(),
    new CancerNotation(),
  ];
}

/** Remix's formatThousands wrapper, with the selected formatter injected. */
export function formatThousands(
  value: DecimalSource,
  formatter: NotationFormatter,
  limit: DecimalSource = "1e12",
  precision = 0,
): string {
  const decimal = new Decimal(value);
  if (decimal.gte(limit)) return formatter.format(decimal);

  return decimal.toNumber().toLocaleString("en-us", {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
}

/** Remix's formatNumber wrapper, including its notation-specific limit path. */
export function formatNumber(
  value: DecimalSource,
  formatter: NotationFormatter,
  precision?: number,
  limit?: DecimalSource,
  below1000?: number,
): string {
  const decimal = new Decimal(value);
  const places = precision ?? 0;
  const under1000 = below1000 ?? 0;
  const decimalLimit = new Decimal(limit ?? 1000);
  if (!limitNotations.has(formatter.name)) {
    return formatter.format(decimal, places, under1000);
  }

  if (decimal.gt(decimalLimit)) {
    return formatter.format(decimal, places, under1000);
  }

  return decimal.lt(1000)
    ? formatThousands(decimal, formatter, Infinity, under1000)
    : formatThousands(decimal, formatter, Infinity, 0);
}

/** Remix multiplies by 100 before invoking formatNumber and appends `%`. */
export function formatPercent(
  value: DecimalSource,
  formatter: NotationFormatter,
  digits?: number,
  limit?: DecimalSource,
): string {
  const precision = digits ?? 2;
  const decimalLimit = new Decimal(limit ?? "1e12");
  return `${formatNumber(
    new Decimal(value).mul(100),
    formatter,
    precision,
    decimalLimit,
    precision,
  )}%`;
}
