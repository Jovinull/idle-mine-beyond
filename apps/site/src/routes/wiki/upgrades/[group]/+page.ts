import { error } from "@sveltejs/kit";
import { groupBySlug, upgradeGroups } from "$lib/data/upgrades";
import type { EntryGenerator, PageLoad } from "./$types";

export const entries: EntryGenerator = () =>
  upgradeGroups.map((group) => ({ group: group.slug }));

export const load: PageLoad = ({ params }) => {
  if (!groupBySlug(params.group)) error(404, "Unknown upgrade group.");
  return { slug: params.group };
};
