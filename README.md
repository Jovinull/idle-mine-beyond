# Idle Mine Beyond

Idle Mine Beyond is a compatibility-focused reimplementation of the final **Idle Mine: Remix**. Its first milestone is faithful observable behavior, with internal architecture modernized only where it does not change player-facing behavior: **identical first, better second**.

## Project phase

**Phase 1 ? Deterministic core and behavioral slices (in progress).** The web shell exercises source-backed Mining, random pickaxe crafting, upgrades, Powers/Wisdom, Story, Settings, save import/export and recovery. Simulation and save boundaries have focused parity tests, and selected full-screen Mining, Story, and Settings states match the pinned source exactly in both themes at 1440x900. This is ongoing implementation work, not a complete game or parity certification.

The canonical source target is pinned in [`docs/knowledge/sources/reference-manifest.json`](docs/knowledge/sources/reference-manifest.json). Original Idle Mine is historical lineage; `idle-mine-remux` is prior art only.

## Development

Requirements: Node.js 24.21.0 (see `.node-version`), pnpm 12.6.0, and Git. Install and run the checks:

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm check
pnpm test:e2e
```

For a first browser run, install Playwright's Chromium with `pnpm exec playwright install chromium`. If its browser binary is unavailable locally, the browser checks fall back to installed Chrome; set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to select a nonstandard Chrome path. CI installs and uses Playwright's pinned Chromium.

Useful focused commands include `pnpm test:unit`, `pnpm test:parity`, `pnpm test:e2e`, `pnpm test:reference`, `pnpm content:check`, `pnpm content:sync`, `pnpm build`, `pnpm research:setup`, and `pnpm native:check`. `pnpm test:reference` launches the pinned Remix checkout read-only with hash-pinned runtime dependencies and checks the tracked oracle corpus. `pnpm content:sync` derives the reviewed product catalog from that oracle; `pnpm content:check` confirms the tracked catalog is reproducible. See `pnpm run` and the canonical [project status](docs/knowledge/project-status.md) for scope.

## Project site

`apps/site` is the project website: a landing page, a wiki generated from the game's own data and code, and the game itself at `/play/`. Every page is prerendered to static files.

```sh
pnpm site:dev       # develop the site (the game is not mounted at /play/ here)
pnpm site:build     # full static site in apps/site/build, game included
pnpm site:preview   # serve that build at http://127.0.0.1:4175/
pnpm test:site      # browser tests against the built site
```

`pnpm site:og` refreshes the social preview image from the built home page. Set `VITE_SITE_URL` to the public origin when building for a deployment. See the [project site plan](docs/plans/project-site.md) and [ADR 0011](docs/knowledge/decisions/0011-project-site.md).

## Project memory and references

- [`docs/knowledge/README.md`](docs/knowledge/README.md) indexes the durable project knowledge.
- [`AGENTS.md`](AGENTS.md) defines persistent implementation and commit rules.
- `.research/` is a local, disposable, Git-ignored workspace for pinned upstream clones. Recreate it with `pnpm research:setup`; never treat it as product source or edit its canonical checkouts.
- Skills are in `.agents/skills/` and reference the canonical docs instead of duplicating them.

There is no complete parity-v1 game or release artifact yet, and Idle Mine Beyond has no selected project license.
