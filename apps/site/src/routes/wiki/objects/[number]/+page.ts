import { error } from "@sveltejs/kit";
import {
  fixedLevels,
  isFixed,
  levelFromNumber,
  objectNumber,
} from "$lib/data/objects";
import type { EntryGenerator, PageLoad } from "./$types";

export const entries: EntryGenerator = () =>
  fixedLevels.map((level) => ({ number: String(objectNumber(level)) }));

export const load: PageLoad = ({ params }) => {
  const number = Number(params.number);
  const level = levelFromNumber(number);
  if (!Number.isInteger(number) || !isFixed(level)) {
    error(404, "No hand-made object has this number.");
  }
  return { level };
};
