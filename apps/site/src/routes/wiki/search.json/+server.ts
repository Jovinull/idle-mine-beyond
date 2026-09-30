import { resolve } from "$app/paths";
import { json } from "@sveltejs/kit";
import { fixedObjects } from "$lib/data/objects";
import { chapters } from "$lib/data/story";
import { upgradeGroups } from "$lib/data/upgrades";
import { chapterPath, objectPath, upgradeGroupPath } from "$lib/links";
import { wikiSections } from "$lib/wiki-nav";

export const prerender = true;

export function GET() {
  const entries = [
    ...wikiSections.flatMap((section) =>
      section.links.map((link) => ({
        title: link.label,
        href: resolve(link.path),
        kind: "Page",
        terms: section.title.toLowerCase(),
      })),
    ),
    ...fixedObjects.map((object) => ({
      title: object.name,
      href: resolve(objectPath(object.level)),
      kind: `Object #${object.number}`,
      terms: `#${object.number} ${object.number}`,
    })),
    ...chapters.map((title, page) => ({
      title: `Chapter ${page + 1}: ${title}`,
      href: resolve(chapterPath(page)),
      kind: "Story",
      terms: title.toLowerCase(),
    })),
    ...upgradeGroups.flatMap((group) =>
      group.upgrades.map((upgrade) => ({
        title: upgrade.name,
        href: `${resolve(upgradeGroupPath(group.slug))}#${upgrade.key}`,
        kind: `${group.label} upgrade`,
        terms: upgrade.description.toLowerCase(),
      })),
    ),
  ];
  return json(entries);
}
