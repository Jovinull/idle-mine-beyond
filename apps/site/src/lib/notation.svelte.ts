import type { DecimalSource } from "@idle-mine-beyond/core";
import {
  createRemixFormatters,
  formatNumber,
  formatPercent,
  type NotationFormatter,
} from "@idle-mine-beyond/formatting";

/** The game's 40 notations, in its Settings order. Index 0 is its default. */
export const formatters: readonly NotationFormatter[] = createRemixFormatters();

const storageKey = "imb-site-notation";

function initialIndex(): number {
  if (typeof localStorage === "undefined") return 0;
  try {
    const saved = Number(localStorage.getItem(storageKey));
    return Number.isInteger(saved) && saved >= 0 && saved < formatters.length
      ? saved
      : 0;
  } catch {
    return 0;
  }
}

/** The reader's chosen notation; prerendered pages use the game default. */
export const notation = $state({ index: 0 });

export function restoreNotation(): void {
  notation.index = initialIndex();
}

export function setNotation(index: number): void {
  notation.index = index;
  try {
    localStorage.setItem(storageKey, String(index));
  } catch {
    // Private windows may refuse storage; the choice still applies here.
  }
}

export function currentFormatter(): NotationFormatter {
  return formatters[notation.index] ?? formatters[0]!;
}

/** Formats like the game's on-screen numbers (two decimals, 1e12 limit). */
export function fmt(
  value: DecimalSource,
  precision = 2,
  limit: DecimalSource = "1e12",
  below1000?: number,
): string {
  return formatNumber(value, currentFormatter(), precision, limit, below1000);
}

export function fmtPercent(value: DecimalSource, precision = 1): string {
  return formatPercent(value, currentFormatter(), precision);
}
