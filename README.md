# Idle Mine Beyond

Idle Mine Beyond is a compatibility-focused reimplementation of the final **Idle Mine: Remix**. Its first milestone is faithful observable behavior, with internal architecture modernized only where it does not change player-facing behavior: **identical first, better second**.

## Project phase

**Phase 0 — Foundation / reference archaeology.** This repository contains the engineering foundation and a non-game scaffold. Gameplay has not been implemented.

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

Useful focused commands include `pnpm test:unit`, `pnpm test:parity`, `pnpm test:reference`, `pnpm build`, `pnpm research:setup`, and `pnpm native:check`. `pnpm test:reference` launches the pinned Remix checkout read-only with hash-pinned runtime dependencies and checks the tracked oracle corpus. See `pnpm run` and the canonical [project status](docs/knowledge/project-status.md) for scope.

## Project memory and references

- [`docs/knowledge/README.md`](docs/knowledge/README.md) indexes the durable project knowledge.
- [`AGENTS.md`](AGENTS.md) defines persistent implementation and commit rules.
- `.research/` is a local, disposable, Git-ignored workspace for pinned upstream clones. Recreate it with `pnpm research:setup`; never treat it as product source or edit its canonical checkouts.
- Skills are in `.agents/skills/` and reference the canonical docs instead of duplicating them.

There is no game implementation, release artifact, or selected project license at this stage.
