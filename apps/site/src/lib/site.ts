/** Site-wide metadata. `VITE_SITE_URL` sets the public origin at build time. */
export const site = {
  name: "Idle Mine Beyond",
  motto: "Identical first. Better second.",
  description:
    "Idle Mine Beyond is a faithful remake of the browser idle game Idle Mine: Remix. Play it in your browser and look up every object, upgrade and Story chapter in the wiki.",
  url: (
    (import.meta.env["VITE_SITE_URL"] as string | undefined) ??
    "https://idle-mine-beyond.pages.dev"
  ).replace(/\/+$/, ""),
  repository: "https://github.com/Jovinull/idle-mine-beyond",
  remixRepository: "https://github.com/veprogames/idle-mine-remix",
  remixPlay: "https://veprogames.github.io/idle-mine-remix/",
  originalGame: "https://www.kongregate.com/games/crovie/idle-mine",
  playPath: "/play/",
} as const;

export function absoluteUrl(pathname: string): string {
  return `${site.url}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}
