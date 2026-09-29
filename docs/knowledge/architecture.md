# Architecture and technology decisions

## Target boundary

The simulation core is platform-independent. Its conceptual interface is state + input + delta + injected services → deterministic next state. It must not depend on Svelte, DOM, browser globals, Canvas, Tauri, localStorage, IndexedDB, filesystem, Steam, CrazyGames, or mobile APIs.

RNG, clock/time, persistence, and platform integrations are explicit interfaces with adapters. UI renders state and dispatches inputs; it does not define game rules.

`packages/core/src/remix-simulation-state.ts` constructs the fresh simulation subset from the pinned mine-object catalog and source-observed defaults. It owns no clock, RNG, storage, notation registry, UI settings, or message buffer. Keep static presentation content in `packages/content` and execute elapsed-time or persistence behavior through injected services when the simulation loop is composed.

`performRemixSimulationAction()` currently composes active clicks and idle frames through mining, save-request, and Story-notification transitions. It receives the frame delta, object catalog, Story milestones, and RNG explicitly. When an idle frame breaks an object and autosaves, its save effect carries the post-mining state before that frame's Story-notification refresh, matching the pinned `update()` order. Persistence adapters, purchase/craft dispatch, and UI wiring remain separate work.

## Repository map

| Path                 | Responsibility                                                                                  |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| apps/web             | SvelteKit static SPA shell, UI, browser adapters                                                |
| apps/native          | Tauri 2 shell and native/platform integration only                                              |
| packages/core        | Platform-independent simulation, source-backed rate formulas, and compatibility math facade     |
| packages/formatting  | Source-compatible number display and notation adapters                                          |
| packages/content     | Extracted Remix content definitions, separate from engine behavior                              |
| packages/persistence | Pure save codecs, versioned schemas, migrations, import/export services, persistence interfaces |
| packages/ui          | Reusable UI components after source inspection                                                  |
| tests/unit           | Unit and property tests                                                                         |
| tests/parity         | Reference fixtures and compatibility assertions                                                 |
| tests/fixtures       | Versioned test inputs and outputs                                                               |
| tests/e2e            | Browser workflows                                                                               |
| tests/visual         | Screenshot baselines and diffs                                                                  |
| docs/knowledge       | Canonical project knowledge and evidence                                                        |
| scripts              | Reproducible repository operations                                                              |
| .agents/skills       | Project-local Codex Skills                                                                      |
| .research            | Ignored, disposable, read-only upstream checkouts                                               |

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

`packages/persistence` is a separate platform-independent boundary; it may parse/serialize save payloads and produce explicit storage effects, but it must not access browser or native storage directly. The initial `remix-save-codec.ts` slice only reproduces Remix's JSON/Base64 wrapper. It does not define Beyond's versioned save schema, apply imported fields, or claim save compatibility.

## References

- [Tauri SvelteKit guide](https://v2.tauri.app/start/frontend/sveltekit/)
- [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)
- [Svelte documentation](https://svelte.dev/docs)
- [SvelteKit documentation](https://svelte.dev/docs/kit/introduction)
- [SvelteKit static adapter](https://svelte.dev/docs/kit/adapter-static)
- [Node.js release policy](https://nodejs.org/en/about/previous-releases)
- [Node.js 24.21.0 LTS release](https://nodejs.org/en/blog/release/v24.21.0)
- [pnpm installation and Node compatibility](https://pnpm.io/installation/)
