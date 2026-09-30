# Project site — landing page, wiki, and playable game

Status: in progress (started 2026-09-30).

## Objective

Publish one static site for Idle Mine Beyond with three parts: a landing page, a wiki generated from the project's verified game data, and the playable web build. It must be production-ready, fast, accessible, and readable without JavaScript where possible. Deployment waits for the owner's hosting account.

## Scope

- `apps/site`: SvelteKit 2 + Svelte 5, fully prerendered with `adapter-static`.
- Landing page (`/`), wiki (`/wiki/...`), about and credits (`/about/`), and the game mounted at `/play/`.
- Wiki pages generated from `packages/content`, `packages/core`, and `packages/formatting`: mine objects (fixed catalog plus an explorer for any object number), upgrades for all four currencies, Story chapters, Powers, number notations, and mechanics.
- Mine objects are drawn by the game's own compositor (`apps/web/src/lib/mine-object-rendering.ts`), and Story text by the game's pinned template renderer (`apps/web/src/lib/remix-story-template.ts`). The site imports both read-only, so the wiki cannot drift from the game.
- `pnpm site:build` produces the complete deployable directory; `pnpm site:preview` serves it locally exactly as it will be served in production.

Out of scope: gameplay changes, the unshipped Beyond art pack (`art/beyond`), analytics, accounts, and a hosted deployment.

## Evidence and rules

- Numbers, names, formulas, and Story text come only from tracked, source-derived data and tested core functions. Mechanics prose must cite verified knowledge docs (`game-systems.md`, `mathematics.md`, `pickaxe-crafting.md`, `save-time-offline.md`, `upgrades.md`). Unverified behavior is not stated as fact.
- Remix credits and license notices follow [IP provenance](../knowledge/ip-provenance.md). The site says it is an unofficial remake.
- The game build is unchanged. It only gains an opt-in base path (environment variable) so the site can mount it at `/play/`.

## Architecture decisions

See [ADR 0011](../knowledge/decisions/0011-project-site.md).

## Ordered work

1. Plan, ADR, and plan index. ✅
2. Opt-in base path for the game build (`BEYOND_GAME_BASE_PATH`, `BEYOND_GAME_BUILD_DIR`). ✅
3. Site scaffold: config, shared game static files, layout, theme (light/dark like the game), typography, navigation, footer, 404. ✅
4. Landing page. ✅
5. Mine-object wiki: catalog, one page per fixed object, explorer. ✅
6. Upgrades, Story, Powers, notations, and mechanics pages; site search. ✅
7. Game bundle at `/play/`, production headers, sitemap, robots, social preview image, local preview server. ✅
8. Tests: data unit tests, a crawler E2E that visits every page (status, console errors, broken links, rendered canvases), interaction tests, and the game at `/play/`. ✅
9. CI and docs: architecture map, README, provenance. ✅
10. Deployment to Cloudflare Pages once the owner creates the account: build command `pnpm site:build`, output directory `apps/site/build`, `VITE_SITE_URL` set to the public origin.

## Validation

- `pnpm check`: includes the site typecheck, its data unit tests, and `pnpm site:build`.
- `pnpm test:site`: Playwright against the built site: a crawl of every page (status, one h1, no console errors or failed requests, every object canvas drawn, every linked asset served), interactions (object click, theme, notation, explorer, search, calculator, Story previews, the game at `/play/`), and phone-width layout.
- Manual review of every page in light and dark themes at desktop and phone widths.
- Linux validation in WSL before each push; GitHub Actions green after push.

## Risks and open items

- **Distribution gate.** The owner wants the site, wiki, and game public without access gating. `ip-provenance.md` requires a rights review before public distribution because inherited Idle Mine art and the "Idle Mine" name are not cleared. Deployment remains the owner's decision.
- **Shared checkout.** Codex edits docs, scripts, and tests in the same worktree. Only this plan's own files and hunks are committed.
- **Game asset paths.** The game requests `/Images/...` and `/fonts/...` from the domain root. The site publishes the game's static files at the root, so `/play/` works. A future base-aware game would remove this coupling.

## Progress log

- 2026-09-30: plan and ADR recorded.
- 2026-09-30: site built: 174 prerendered pages plus the game at `/play/`. The wiki's upgrade tables match every captured Remix shop display sample, using the capture state (highest object level 171). Building the search index with `resolve()` in relative mode produced relative links that broke search; the site now uses root-absolute paths.
