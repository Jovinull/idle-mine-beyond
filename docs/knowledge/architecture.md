# Architecture and technology decisions

## Target boundary

The simulation core is platform-independent. Its conceptual interface is state + input + delta + injected services → deterministic next state. It must not depend on Svelte, DOM, browser globals, Canvas, Tauri, localStorage, IndexedDB, filesystem, Steam, CrazyGames, or mobile APIs.

RNG, clock/time, persistence, and platform integrations are explicit interfaces with adapters. UI renders state and dispatches inputs; it does not define game rules.

## Repository map

| Path                | Responsibility                                               |
| ------------------- | ------------------------------------------------------------ |
| apps/web            | SvelteKit static SPA shell, UI, browser adapters             |
| apps/native         | Tauri 2 shell and native/platform integration only           |
| packages/core       | Pure simulation and compatibility math facade                |
| packages/formatting | Source-compatible number display and notation adapters       |
| packages/content    | Extracted Remix content definitions                          |
| packages/save       | Schemas, migrations, legacy importer, persistence interfaces |
| packages/ui         | Reusable UI components after source inspection               |
| tests/unit          | Unit and property tests                                      |
| tests/parity        | Reference fixtures and compatibility assertions              |
| tests/fixtures      | Versioned test inputs and outputs                            |
| tests/e2e           | Browser workflows                                            |
| tests/visual        | Screenshot baselines and diffs                               |
| docs/knowledge      | Canonical project knowledge and evidence                     |
| scripts             | Reproducible repository operations                           |
| .agents/skills      | Project-local Codex Skills                                   |
| .research           | Ignored, disposable, read-only upstream checkouts            |

## Selected stack

Bootstrap versions are pinned by the package manifest and lockfile where applicable. Validation date: 2026-09-29.

- Node.js 24 LTS line. `.node-version` pins 24.21.0, the current LTS patch when this project was bootstrapped. The host began with 24.18.0; a checksum-verified official user-local 24.21.0 archive was installed after the system MSI route returned 1603. The package engine guard accepts Node 24 only.
- pnpm 12.6.0 workspace.
- TypeScript 6.0.3 strict mode.
- Svelte 5.57.1, SvelteKit 2.70.3, Vite 8.3.1, and adapter-static 3.0.10.
- Tauri 2.12.0 for the native shell; Rust stable for integration only.
- DOM/CSS for UI, Canvas 2D for mine-object compositing.
- A compatibility facade around break_infinity.js behavior.
- `@antimatter-dimensions/notations@1.6.0` for the initial Remix notation classes, behind a project formatting boundary.
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

Use the narrow `packages/core/src/decimal.ts` facade for all game-domain numbers. It pins `break_infinity.js@2.2.0`, the exact version resolved from the Remix runtime dependency snapshot. Preserve rounding, coercion, overflow, Decimal serialization, notation behavior, and operation order. A replacement library requires a full golden compatibility corpus.

## Number formatting

`packages/formatting` owns player-facing number and percentage strings. It exposes the six initial AD notation instances and the other fourteen AD classes registered by Remix; direct results and the `formatNumber`, `formatThousands`, and `formatPercent` wrapper paths are compared against the pinned corpus. Formatting stays outside the simulation core.

The AD Notations 1.6.0 ESM build imports the historical `break_infinity.js/break_infinity` subpath. Its Remix browser UMD build instead receives the global Decimal from `break_infinity.js@2.2.0`. The workspace pins that transitive dependency to 2.2.0 and aliases the ESM subpath to the core Decimal bridge in both Vitest and the web Vite config. This keeps tests and browser output on the same Decimal implementation; the formatter golden tests verify the captured 20-class base slice.

## Platform adapters

Potential adapters include browser persistence, native persistence, platform achievements/cloud saves/leaderboards, and distribution-specific APIs. The core depends only on project interfaces. Steam, store, and portal integrations are post-parity.

## References

- [Tauri SvelteKit guide](https://v2.tauri.app/start/frontend/sveltekit/)
- [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)
- [Svelte documentation](https://svelte.dev/docs)
- [SvelteKit documentation](https://svelte.dev/docs/kit/introduction)
- [SvelteKit static adapter](https://svelte.dev/docs/kit/adapter-static)
- [Node.js release policy](https://nodejs.org/en/about/previous-releases)
- [Node.js 24.21.0 LTS release](https://nodejs.org/en/blog/release/v24.21.0)
- [pnpm installation and Node compatibility](https://pnpm.io/installation/)
