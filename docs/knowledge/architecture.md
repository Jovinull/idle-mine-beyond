# Architecture and technology decisions

## Target boundary

The simulation core is platform-independent. Its conceptual interface is state + input + delta + injected services → deterministic next state. It must not depend on Svelte, DOM, browser globals, Canvas, Tauri, localStorage, IndexedDB, filesystem, Steam, CrazyGames, or mobile APIs.

RNG, clock/time, persistence, and platform integrations are explicit interfaces with adapters. UI renders state and dispatches inputs; it does not define game rules.

`packages/core/src/remix-simulation-state.ts` constructs the fresh simulation subset from the pinned mine-object catalog and source-observed defaults. It owns no clock, RNG, storage, notation registry, UI settings, or message buffer. Keep static presentation content in `packages/content` and execute elapsed-time or persistence behavior through injected services when the simulation loop is composed.

`performRemixSimulationAction()` composes active clicks, idle frames, upgrade purchases, source-backed pickaxe crafting, and offline loading. Mining receives frame delta, object catalog, Story milestones, and RNG explicitly. An upgrade purchase receives only the state and source operation; `Upgrade.buy()` does not request a save, so that action returns no effects. Crafting receives the object catalog and RNG explicitly, derives the selected Gem cost from the source upgrade state, preserves the legacy name-resolution path, and returns an ordered save effect for every successful intermediate replacement. Offline loading receives a clock, object catalog, and number formatter; when the source threshold allows rewards, it derives MPS/GPS/PCPS from the loaded object's state using the same mining-factor and highest-damageable scan path as mining actions, then applies upgrade-derived caps and multipliers. It maps the ordered message/save effects onto the full core state. A `save` effect carries the state at the source save call. Persistence coordination writes that snapshot with the captured timestamp and dispatches Remix's `Game Saved!` message only after a successful write. `loadRemixBeyondSaveIntoState()` restores a Beyond save, reapplies offline progression, and persists its source-ordered save effect; legacy imports use the same write/confirmation ordering. `apps/web/src/lib/platform/remix-game-session.ts` coordinates fresh/legacy/Beyond startup, serializes dispatched actions, routes save effects through the selected storage interface, and reports confirmation only after a successful write. Session tests cover fresh autosave, legacy migration, future-version protection, offline clock/effect order, and explicit legacy/Beyond recovery. The Svelte route connects this coordinator to Mining, Story, the upgrade shop, Settings, Powers, and the recovery screen; native WebView runtime validation and complete UI/visual parity remain open. When an idle frame breaks an object and autosaves, its save effect carries the post-mining state before that frame's Story-notification refresh, matching the pinned `update()` order.

`loadRemixLegacySaveIntoState()` in `packages/persistence` composes the wrapped decoder, immutable legacy-field application, and the offline-load action. Field application returns the eager `Date.now()` fallback read so the offline transition can reuse it instead of reading the clock twice for the same source expression. The service resolves the formatter selected by the loaded settings lazily when an offline message is needed, then returns ordered theme/log/save effects and includes the full application state in save snapshots. It does not access storage or emit `Game Saved!`. Browser and native adapters remain responsible for applying theme changes, writing snapshots, and reporting success only after the write completes.

## Repository map

| Path                 | Responsibility                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| apps/web             | SvelteKit static SPA shell, UI, browser adapters                                                                          |
| apps/native          | Tauri 2 shell and native/platform integration only                                                                        |
| packages/core        | Platform-independent simulation, source-backed rate formulas, and compatibility math facade                               |
| packages/formatting  | Source-compatible number display and notation adapters                                                                    |
| packages/content     | Extracted Remix content definitions, separate from engine behavior                                                        |
| packages/persistence | Pure save codecs, legacy field application, versioned schemas, migrations, import/export services, persistence interfaces |
| packages/ui          | Reusable UI components after source inspection                                                                            |
| tests/unit           | Unit and property tests                                                                                                   |
| tests/parity         | Reference fixtures and compatibility assertions                                                                           |
| tests/fixtures       | Versioned test inputs and outputs                                                                                         |
| tests/e2e            | Browser workflows                                                                                                         |
| tests/visual         | Screenshot baselines and diffs                                                                                            |
| docs/knowledge       | Canonical project knowledge and evidence                                                                                  |
| art/beyond           | Unshipped Beyond art pack (post-parity), mirrors the Remix Images tree; verified by the asset check                       |
| scripts              | Reproducible repository operations                                                                                        |
| .agents/skills       | Project-local Codex Skills                                                                                                |
| .research            | Ignored, disposable, read-only upstream checkouts                                                                         |

`packages/persistence` may depend on `packages/core` for immutable legacy-save field application; the dependency is one-way. `packages/core` does not import persistence, storage, or platform APIs.

## Selected stack

Bootstrap versions are pinned by the package manifest and lockfile where applicable. Validation date: 2026-09-29.

- Node.js 24 LTS line. `.node-version` pins 24.21.0, the current LTS patch when this project was bootstrapped. The host began with 24.18.0; a checksum-verified official user-local 24.21.0 archive was installed after the system MSI route returned 1603. The package engine guard accepts Node 24 only.
- pnpm 12.6.0 workspace.
- TypeScript 6.0.3 strict mode.
- Svelte 5.57.1, SvelteKit 2.70.3, Vite 8.3.1, and adapter-static 3.0.10.
- Tauri 2.12.0 for the native shell; Rust stable for integration only.
- DOM/CSS for UI, Canvas 2D for mine-object compositing.
- A compatibility facade around break_infinity.js behavior.
- `@antimatter-dimensions/notations@1.6.0` for Remix's notation classes, behind a project formatting boundary.
- Zod 4.6.5 for external/save schema validation where appropriate.
- Vitest 5.0.2, fast-check 4.10.2, and Playwright 1.63.0.
- ESLint 10.11.0, typescript-eslint 8.71.0, eslint-plugin-svelte 3.23.0, Prettier 3.9.9, prettier-plugin-svelte 4.1.1, and svelte-check 4.7.6.
- GitHub Actions for validation.

`pnpm-workspace.yaml` enforces strict peer dependency compatibility. pnpm 12 also applied its minimum-release-age lockfile policy at install time; exact `minimumReleaseAgeExclude` entries for the just-published pinned TypeScript ESLint 8.71.0 packages are committed explicitly and should be reviewed or removed once the age window passes. Frozen install and supply-chain lockfile validation are part of bootstrap checks.

**Compatibility finding:** npm's current TypeScript 7 release is outside the declared TypeScript peer ranges for SvelteKit 2.70.3 and svelte-check 4.7.6. TypeScript 6.0.3 is the newest compatible major/minor line in those ranges and is pinned intentionally. Re-evaluate this with dependency upgrades.

## Web and native

The web target is a static SvelteKit SPA. Tauri's current SvelteKit guide recommends adapter-static, SPA fallback, and ssr=false when webview APIs are needed at runtime. Native source is a shell only; gameplay remains TypeScript in packages/core.

The current Windows environment has Node, Rust MSVC, WebView2, and a Visual Studio Build Tools installation with the C++ tool component. Android and iOS SDKs are not part of bootstrap.

Tauri's [current platform prerequisites](https://v2.tauri.app/start/prerequisites/) require Android Studio plus Android SDK Platform, Platform Tools, NDK (side by side), Build Tools, and Command-line Tools; configure `JAVA_HOME`, `ANDROID_HOME`, `NDK_HOME`, and the Rust Android targets before Android builds. iOS requires macOS with full Xcode (not only Command Line Tools) and iOS Rust targets; it cannot be built from this Windows host. Desktop builds on Windows need the C++ Build Tools and WebView2, both present here.

PWA installability and service-worker caching are deferred until the browser release phase; the bootstrap SPA does not claim to be a complete PWA.

## Big numbers

Use the narrow `packages/core/src/decimal.ts` facade for all game-domain numbers. It pins `break_infinity.js@2.2.0`, the exact version resolved from the Remix runtime dependency snapshot. Preserve rounding, coercion, overflow, Decimal serialization, notation behavior, and operation order. A replacement library requires a full golden compatibility corpus. `RemixRandom` in the same package implements the explicitly seeded source RNG path; callers supply seeds, and the core never falls back to `Date.now()` or `Math.random()`.

## Number formatting

`packages/formatting` owns player-facing number and percentage strings. It exposes the 20 base AD classes and 15 community classes exported by the pinned package, plus source-derived implementations for two community classes missing from its ESM exports. Direct results and the three Remix wrapper paths are compared against the pinned corpus. Formatting stays outside the simulation core.

The AD Notations 1.6.0 ESM builds import the historical `break_infinity.js/break_infinity` subpath. Remix browser UMD builds instead receive the global Decimal from `break_infinity.js@2.2.0`. The workspace pins that transitive dependency to 2.2.0 and aliases the ESM subpath to the core Decimal bridge in both Vitest and the web Vite config. The canonical community UMD includes `Haha Funny` and `Nice`, but its ESM exports omit them; Beyond implements those two from the pinned Remix source. The three Remix-specific classes (`Idle Mine Notation`, `SI Notation (Current)`, and `SI Notation (2022)`) are independently implemented from `Scripts/customnotations.js`. Chromium compares the entire captured corpus for all 40 classes and wrappers; overall player-facing formatting parity remains in progress until integrated UI and visual behavior are checked.

## Platform adapters

Potential adapters include browser persistence, native persistence, platform achievements/cloud saves/leaderboards, and distribution-specific APIs. The core depends only on project interfaces. Steam, store, and portal integrations are post-parity.

`packages/persistence` is a separate platform-independent boundary; it may parse/serialize save payloads and coordinate storage through `RemixBeyondSaveStorageAdapter`, but it must not access browser or native storage directly. `remix-save-codec.ts` reproduces Remix's JSON/Base64 wrapper. `remix-beyond-save.ts` defines the strict Beyond v1 envelope and restores its JSON-safe state, deriving the current mine object from the object ID and content catalog. `remix-beyond-recovery-file.ts` validates direct v1 saves and recovery bundles with primary-first, backup-fallback, and future-version protection; `remix-beyond-recovery-import.ts` composes restoration, offline progression, and guarded persistence. `remix-beyond-save-storage.ts` implements explicit timestamps, one-generation backup, primary/backup recovery, and post-write confirmation; `remix-legacy-save-import.ts` composes the source loader, ordered effect dispatch, and v1 migration while leaving the legacy key untouched; `remix-beyond-save-load.ts` composes normal v1 restoration, offline progression, and persistence effects. Browser storage lives in `apps/web/src/lib/platform/remix-save-storage.ts`. In Tauri, that same port is backed by a small Rust command allowlist that maps only the primary and backup slots to files under Tauri's `app_data_dir`; synchronous filesystem work runs on Tauri's blocking worker pool. Hard Reset clears those four known save/temp files and then clears the WebView origin storage. The legacy Remix key remains in WebView localStorage for import. The native webview uses Tauri's documented `window.__TAURI__.core.invoke` bridge via `withGlobalTauri`, typed narrowly at the web boundary. Recovery export reads both selected storage slots and the browser legacy key without mutation. Native WebView runtime certification remains open. These Beyond formats and keys are project decisions, not legacy behavior claims.

## References

- [Tauri SvelteKit guide](https://v2.tauri.app/start/frontend/sveltekit/)
- [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)
- [Svelte documentation](https://svelte.dev/docs)
- [SvelteKit documentation](https://svelte.dev/docs/kit/introduction)
- [SvelteKit static adapter](https://svelte.dev/docs/kit/adapter-static)
- [Node.js release policy](https://nodejs.org/en/about/previous-releases)
- [Node.js 24.21.0 LTS release](https://nodejs.org/en/blog/release/v24.21.0)
- [pnpm installation and Node compatibility](https://pnpm.io/installation/)
