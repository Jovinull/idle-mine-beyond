# Project status

Last updated: 2026-09-29

## Phase

**Phase 0 — Foundation / Reference Archaeology.** Source-backed Decimal, RNG, formatter, mine-object, mining-rate, and mining-upgrade-factor slices are implemented and tested. The full upgrade formulas and purchase rules are researched and captured but not implemented as a Beyond subsystem. No playable mining loop, full progression, crafting, story, or final UI has been implemented.

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
- Added `packages/content` with 72 base objects, 78 special anchors, 25 skin-layer counts, and the 498-word source dictionary. `getRemixMineObject` reproduces source lookup and all three generation branches; Chromium matches all 224 captured object probes.
- Added `calculateRemixMiningRates` with source-ordered active/idle damage and Money/Gem/Planet Coin rate formulas, plus `calculateRemixMiningFactors` for the mining-related upgrade effect subset. Nine controlled Chromium scenarios cover Money, Gem, Planet Coin, and selected Wisdom effects, Power of Exquisity above one, the last-damageable gem bonus, drop and no-drop rates, zero damage, defense boundaries, and hit-count overflow; a separate assertion preserves the current-object argument quirk. Factor outputs are checked from captured levels in Vitest and Chromium. Upgrade costs/caps/purchases, damage application, and resource updates remain separate work.
- Added `calculateRemixUpgradePrice`, `calculateRemixUpgradeEffect`, and `getRemixUpgradeMaxLevel` for all 29 pinned definitions. Vitest checks 249 price/effect samples, nine cross-upgrade outputs, caps, and five injected-RNG cases; Chromium checks those snapshots exactly. The mining-factor evaluator delegates to the shared formulas. Fourteen purchase scenarios are now captured from Remix; Beyond affordability and purchase/bulk-buy mutation remain unimplemented.
- Added `packages/formatting` with the complete 40-formatter Remix registry, all three custom formatters, and the number/thousands/percent wrappers. The omitted community ESM exports and Remix custom classes are independently implemented from the pinned source. Vitest checks Node-stable golden values; Playwright compares every captured direct, wrapper, and exponent output in Chromium, including the `999.5` Idle Mine Notation boundary.
- Research checkouts match the recorded SHAs and are clean; the reference setup/check script is reproducible.
- Windows Rust/Tauri `cargo check` and native build were validated; the Windows icon is an unbranded transparent scaffold placeholder.

## Not complete

- No complete system extraction, playable Beyond simulation, gameplay UI, save importer, PWA, or parity certification. Object and rate corpora remain partial; purchase/affordability transitions, damage ticks, reward rolls, resource updates, crafting, persistence, offline-time, and full progression are not implemented. No full gameplay matrix row is certified.
- No accepted behavioral exceptions.
- No Android/iOS SDK or mobile build setup.
- Upstream game code and artwork have not been ported. The source-derived mine content data is deliberately extracted and provenance-recorded under `packages/content`.

## Tooling status

- Node.js 24.21.0 and pnpm 12.6.0 are pinned. The Node archive was installed user-locally after the system MSI installer failed; `.node-version` and CI use 24.21.0.
- `pnpm check` passes formatting, lint, strict TypeScript and Svelte checks, unit/parity tests for Decimal, RNG, object generation, all captured upgrade formulas, and controlled damage/rate/factor formulas, plus the static web build.
- `pnpm test:e2e` and `pnpm test:reference` use the installed Playwright Chromium when present and otherwise fall back to installed Chrome; `PLAYWRIGHT_CHROMIUM_EXECUTABLE` selects a nonstandard path. CI installs the pinned Playwright Chromium browser.
- `pnpm research:check`, `pnpm docs:check`, `pnpm skills:check`, and `pnpm test:reference` pass. Pinned source checkouts and CDN response snapshots are clean/hash-verified and ignored by Git.
- On this Windows host, `pnpm native:check` and `pnpm native:build` pass. The build emits an unbranded transparent placeholder icon and is not a release package.
- The local GitHub MCP server still needs its separate OAuth flow. A read of pinned public Remix metadata succeeded through the connected Codex GitHub integration; that does not validate the local server. Android SDK/JDK setup and macOS/Xcode are platform prerequisites for future mobile builds.

## Next phase

Continue Phase 0 by implementing and comparing the captured generic purchase/bulk-buy transitions, then connect validated upgrade factors and rates to deterministic mining ticks and source-matched payouts/drop rolls. Follow with crafting, save/import, offline-time, and representative story/settings states. Add fixtures before implementing each respective domain; do not treat partial corpora as complete specifications.
