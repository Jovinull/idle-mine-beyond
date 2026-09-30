import { isFixed, objectNumber } from "./data/objects";

// Typed site paths. Templates pass them to `resolve()` from `$app/paths`, so
// SvelteKit checks every internal link against the real routes.

export type ObjectPath =
  `/wiki/objects/${number}/` | `/wiki/explorer/?n=${number}`;

/** Wiki page of a hand-made object, or the explorer for a generated one. */
export function objectPath(level: number): ObjectPath {
  const number = objectNumber(level);
  return isFixed(level)
    ? `/wiki/objects/${number}/`
    : `/wiki/explorer/?n=${number}`;
}

export function chapterPath(page: number): `/wiki/story/chapter-${number}/` {
  return `/wiki/story/chapter-${page + 1}/`;
}

export function upgradeGroupPath(slug: string): `/wiki/upgrades/${string}/` {
  return `/wiki/upgrades/${slug}/`;
}
