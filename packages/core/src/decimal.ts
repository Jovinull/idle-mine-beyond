/**
 * The sole game-core boundary for the Decimal implementation used by Remix.
 * Keep the exact pinned library until parity evidence approves a replacement.
 */
import BreakInfinityDecimal from "break_infinity.js";

export interface Decimal {
  mantissa: number;
  exponent: number;
  m: number;
  e: number;
  s: number;
  add(value: DecimalSource): Decimal;
  sub(value: DecimalSource): Decimal;
  mul(value: DecimalSource): Decimal;
  div(value: DecimalSource): Decimal;
  pow(value: number | Decimal): Decimal;
  cmp(value: DecimalSource): 0 | 1 | -1;
  eq(value: DecimalSource): boolean;
  lt(value: DecimalSource): boolean;
  lte(value: DecimalSource): boolean;
  gt(value: DecimalSource): boolean;
  gte(value: DecimalSource): boolean;
  max(value: DecimalSource): Decimal;
  min(value: DecimalSource): Decimal;
  abs(): Decimal;
  neg(): Decimal;
  round(): Decimal;
  floor(): Decimal;
  ceil(): Decimal;
  trunc(): Decimal;
  log10(): number;
  log2(): number;
  ln(): number;
  log(base: number): number;
  toNumber(): number;
  toFixed(places?: number): string;
  toString(): string;
}

export type DecimalSource = Decimal | number | string;

interface DecimalConstructor {
  new (value?: DecimalSource): Decimal;
  readonly MAX_VALUE: Decimal;
  readonly MIN_VALUE: Decimal;
  readonly NUMBER_MAX_VALUE: Decimal;
  readonly NUMBER_MIN_VALUE: Decimal;
  floor(value: DecimalSource): Decimal;
  ceil(value: DecimalSource): Decimal;
  round(value: DecimalSource): Decimal;
  trunc(value: DecimalSource): Decimal;
  max(left: DecimalSource, right: DecimalSource): Decimal;
  min(left: DecimalSource, right: DecimalSource): Decimal;
  pow(base: DecimalSource, exponent: number | Decimal): Decimal;
  log10(value: DecimalSource): number;
  log(value: DecimalSource, base: number): number;
  fromMantissaExponent(mantissa: number, exponent: number): Decimal;
  fromMantissaExponent_noNormalize(mantissa: number, exponent: number): Decimal;
  fromValue(value: DecimalSource): Decimal;
  fromValue_noAlloc(value: DecimalSource): Decimal;
}

/**
 * The npm declaration targets CommonJS metadata while its `module` file is ESM.
 * Keep the runtime constructor and its narrow game-facing type behind this cast.
 */
export const Decimal = BreakInfinityDecimal as unknown as DecimalConstructor;
