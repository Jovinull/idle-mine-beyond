# Project status

Last updated: 2026-09-29

## Phase

**Phase 0 — Foundation / Reference Archaeology.** No game simulation, progression, crafting, story, or final UI has been implemented.

## Compatibility target

Idle Mine: Remix, repository default branch main, commit **0e0f4bf5a9c66e5603cda2ce4bd54213023dae21**. Remux is pinned separately as prior art only. See the [source manifest](sources/reference-manifest.json).

## Completed foundation and compatibility work

- Assimilated the initial research into this knowledge base and created a section-by-section trace.
- Cloned the two first-party repositories into ignored .research/upstream and recorded exact pins and license notices.
- Established the evidence hierarchy, parity contract, exception policy, parity matrix, architecture boundary, roadmap, and post-parity backlog.
- Created the pnpm workspace, SvelteKit static SPA shell, Tauri 2 shell, strict TypeScript checks, lint/format tooling, and CI without gameplay.
- Added unit/parity Vitest smoke tests, a Playwright browser smoke test, and a local Remix oracle browser workflow.
- Added six project-local Skills, registered the three requested MCP servers, and verified their protocol initialization; Playwright and Chrome DevTools navigated to the public Remix deployment.
- Extracted a controlled oracle corpus for all IDs 0–214, nine extreme/post-Universe IDs, the initial game state, base formula outputs, upgrade level-0→1 values, 40 formatter outputs at 67 values plus wrapper boundaries, and Decimal arithmetic/rounding/serialization edges. `pnpm test:reference` replays it from the pinned runtime and hash-pinned CDN snapshots.
- Added `break_infinity.js@2.2.0` as the core's only Decimal boundary. The parity suite matches its captured arithmetic/serialization corpus and property-checks safe-integer JSON round-trips; damage/progression simulation remains unimplemented.
- Added `RemixRandom`, an explicit-seed port of the canonical `Random` stream. Fifteen seeds spanning object-region boundaries are golden-tested, including source sequence exhaustion; property tests cover repeatable finite streams for safe nonnegative seeds.
- Added `packages/formatting` with the complete 40-formatter Remix registry, all three custom formatters, and the number/thousands/percent wrappers. The omitted community ESM exports and Remix custom classes are independently implemented from the pinned source. Vitest checks Node-stable golden values; Playwright compares every captured direct, wrapper, and exponent output in Chromium, including the `999.5` Idle Mine Notation boundary.
- Research checkouts match the recorded SHAs and are clean; the reference setup/check script is reproducible.
- Windows Rust/Tauri `cargo check` and native build were validated; the Windows icon is an unbranded transparent scaffold placeholder.

## Not complete

- No complete system extraction, Beyond gameplay simulation, gameplay UI, save importer, PWA, or parity certification. Object/rate corpora remain partial; the procedural generator does not yet consume `RemixRandom`; no full gameplay matrix row is certified.
- No accepted behavioral exceptions.
- No Android/iOS SDK or mobile build setup.
- Upstream game code/assets have not been ported into product code.

## Tooling status

- Node.js 24.21.0 and pnpm 12.6.0 are pinned. The Node archive was installed user-locally after the system MSI installer failed; `.node-version` and CI use 24.21.0.
- `pnpm check` passes formatting, lint, strict TypeScript and Svelte checks, unit tests, Decimal compatibility golden/property tests, and the static web build.
- `pnpm test:e2e` and `pnpm test:reference` use the installed Playwright Chromium when present and otherwise fall back to installed Chrome; `PLAYWRIGHT_CHROMIUM_EXECUTABLE` selects a nonstandard path. CI installs the pinned Playwright Chromium browser.
- `pnpm research:check`, `pnpm docs:check`, `pnpm skills:check`, and `pnpm test:reference` pass. Pinned source checkouts and CDN response snapshots are clean/hash-verified and ignored by Git.
- On this Windows host, `pnpm native:check` and `pnpm native:build` pass. The build emits an unbranded transparent placeholder icon and is not a release package.
- The local GitHub MCP server still needs its separate OAuth flow. A read of pinned public Remix metadata succeeded through the connected Codex GitHub integration; that does not validate the local server. Android SDK/JDK setup and macOS/Xcode are platform prerequisites for future mobile builds.

## Next phase

Continue Phase 0 by extracting fixed/special anchor content and the remaining procedural-generator inputs, then implement mine-object lookup against the complete oracle corpus. Follow with damage/earnings and upgrade/resource boundaries, crafting RNG, save/import, offline-time, and representative story/settings states. Add fixtures before implementing each respective domain; do not treat partial corpora as complete specifications.
