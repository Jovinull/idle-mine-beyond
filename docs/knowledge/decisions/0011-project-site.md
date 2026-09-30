# ADR 0011: Project site in the monorepo

Date: 2026-09-30

## Status

Accepted

## Context

The project needs a landing page, a wiki, and a playable web build. The game is already a static SvelteKit SPA, and the repository holds verified game data and a tested simulation core. A wiki written by hand would drift from that data; a separate framework would duplicate the mine-object renderer and number formatting.

## Decision

- Build the site as `apps/site`: SvelteKit 2 and Svelte 5 with `adapter-static`, every page prerendered. No second UI framework.
- Generate wiki content at build time from `@idle-mine-beyond/content`, `@idle-mine-beyond/core`, and `@idle-mine-beyond/formatting`. Interactive tools (object explorer, upgrade calculator, notation switcher) run the same functions in the browser.
- Import the game's mine-object compositor and Story template renderer read-only through a `$game` alias to `apps/web/src/lib`. The game keeps ownership of both.
- Publish the game's static files (`Images/`, `fonts/`, `licenses/`) at the site root and mount the game build at `/play/`, built with an opt-in base path. Without the environment variables the game build is unchanged.
- Target static hosting. Cloudflare Pages is the preferred host: free static bandwidth, commercial use allowed, per-branch previews, and root-level URLs. Any static host that serves `404.html` works.

## Consequences

- Wiki numbers, names, sprites, and Story text come from the same code and data as the game.
- Changes to the game's renderer or Story renderer are also site changes; site tests cover them.
- The game at `/play/` depends on root-level static files until the game resolves assets relative to its base path.
- Public deployment is a separate owner decision under the distribution gate in [IP provenance](../ip-provenance.md).

## Evidence

- [Project site plan](../../plans/project-site.md)
- SvelteKit `adapter-static` prerendering and `paths.base` configuration.
- Cloudflare Pages free plan: unlimited static requests and bandwidth; Vercel Hobby is limited to non-commercial use; GitHub Pages project sites are served from a sub-path.
