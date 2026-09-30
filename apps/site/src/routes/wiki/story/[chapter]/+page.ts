import { error } from "@sveltejs/kit";
import { chapters, chapterSlug, pageFromSlug } from "$lib/data/story";
import type { EntryGenerator, PageLoad } from "./$types";

export const entries: EntryGenerator = () =>
  chapters.map((_, page) => ({ chapter: chapterSlug(page) }));

export const load: PageLoad = ({ params }) => {
  const page = pageFromSlug(params.chapter);
  if (page === undefined) error(404, "Unknown Story chapter.");
  return { page };
};
