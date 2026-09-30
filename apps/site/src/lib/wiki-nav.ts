import type { Pathname } from "$app/types";

export type WikiLink = { path: Pathname; label: string };
export type WikiSection = { title: string; links: WikiLink[] };

export const wikiSections: WikiSection[] = [
  {
    title: "Start",
    links: [{ path: "/wiki/", label: "Overview" }],
  },
  {
    title: "Mine objects",
    links: [
      { path: "/wiki/objects/", label: "All hand-made objects" },
      { path: "/wiki/explorer/", label: "Object explorer" },
    ],
  },
  {
    title: "Progress",
    links: [
      { path: "/wiki/story/", label: "Story" },
      { path: "/wiki/upgrades/", label: "Upgrades" },
      { path: "/wiki/powers/", label: "Wisdom and Powers" },
    ],
  },
  {
    title: "Reference",
    links: [
      { path: "/wiki/pickaxes/", label: "Pickaxe crafting" },
      { path: "/wiki/mechanics/", label: "Mining and offline" },
      { path: "/wiki/notations/", label: "Number notations" },
    ],
  },
];
