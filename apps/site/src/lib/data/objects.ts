import mineContent from "@idle-mine-beyond/content/remix-mine-content";
import {
  getRemixMineObject,
  type MineObject,
  type RemixMineObjectCatalog,
} from "@idle-mine-beyond/core";
import { chapterForLevel, storyQuotes, type StoryQuote } from "./story";

export const catalog = mineContent as unknown as RemixMineObjectCatalog;

/** Levels with a hand-made definition: the 72 base objects and 78 anchors. */
export const fixedLevels: readonly number[] = [
  ...catalog.base.map((entry) => entry.id),
  ...catalog.special.map((entry) => entry.id),
].sort((a, b) => a - b);

const fixedSet = new Set(fixedLevels);
export const lastFixedLevel = fixedLevels.at(-1) ?? 0;

/** The game shows objects as `#level+1` ("#1" is Mud). */
export function objectNumber(level: number): number {
  return level + 1;
}

export function levelFromNumber(number: number): number {
  return number - 1;
}

export function isFixed(level: number): boolean {
  return fixedSet.has(level);
}

export function objectAt(level: number): MineObject {
  return getRemixMineObject(level, catalog);
}

/** The procedural rule that produces objects between the fixed anchors. */
export function proceduralRegion(level: number): string {
  if (level < catalog.base.length) return "Hand-made";
  if (level >= 214) return "Procedural universes";
  if (level >= 115) return "Procedural planets";
  return "Procedural realm";
}

export function quotesFor(level: number): StoryQuote[] {
  return storyQuotes.filter((quote) => quote.level === level);
}

export type ObjectSummary = {
  level: number;
  number: number;
  name: string;
  chapter: number;
  fixed: boolean;
};

export function summarize(level: number): ObjectSummary {
  return {
    level,
    number: objectNumber(level),
    name: objectAt(level).name,
    chapter: chapterForLevel(level),
    fixed: isFixed(level),
  };
}

export const fixedObjects: readonly ObjectSummary[] =
  fixedLevels.map(summarize);
