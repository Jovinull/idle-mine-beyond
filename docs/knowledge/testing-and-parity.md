# Testing and parity method

## Workflow

Every behavior implementation follows:

**REFERENCE → EXTRACT BEHAVIOR → CREATE FIXTURE/TEST → IMPLEMENT → COMPARE → DOCUMENT → COMMIT**

“Looks plausible” is not parity evidence.

## Test layers

- **Unit tests:** exact formulas and edge cases inside platform-independent packages.
- **Property tests:** invariants and deterministic generated objects under fast-check or equivalent.
- **Compatibility tests:** Beyond output compared with versioned output extracted from the frozen Remix source/runtime.
- **E2E tests:** real browser interactions through Playwright.
- **Visual regression:** screenshot comparisons at fixed viewports, themes, and state fixtures.
- **Native checks:** Tauri shell/config and platform builds when the required SDK/toolchain is available.

The web Vite config serves dev-only compatibility harness routes for formatting, mine objects, and mining rates. Playwright loads the shared packages in Chromium and compares their outputs with the frozen reference corpus; these routes are not emitted as product pages by the static build.

## Harness folders

| Folder         | Purpose                                                      |
| -------------- | ------------------------------------------------------------ |
| tests/unit     | Unit and property coverage                                   |
| tests/parity   | Reference behavior fixtures and comparison tests             |
| tests/fixtures | Inputs, outputs, imported save samples, deterministic states |
| tests/e2e      | Browser smoke and user-flow checks                           |
| tests/visual   | Screenshot baselines and diffs                               |

Do not commit copied upstream game assets or saves as fixtures without provenance review. Prefer minimal synthetic state and scalar outputs.

## Golden fixture envelope

Each fixture should identify the source repository and commit, source file or probe method, capture date, normalized input, output, precision/serialization rules, and any uncertainty. Fixture updates require explaining why the reference output changed; never regenerate expected values merely to make a failure pass.

## Visual targets

Use 1366×768, 1440×900, 1920×1080, and 2560×1440. Capture light and dark themes and states such as initial, gems unlocked, Planet Coins, Wisdom, story, settings, huge numbers, long generated names, and disabled controls.

## Current reference and compatibility harnesses

The Vitest parity suite and Playwright Chromium harness compare nine controlled damage, rate, and mining-factor configurations against oracle outputs from the pinned source/runtime. They include Money/Gem/Planet Coin/Wisdom effect levels, Power of Exquisity above one, a last-damageable-object Gem multiplier, a Planet Coin drop, zero damage, exact/below/above defense boundaries, Number hit-count overflow, and the legacy explicit-target/current-object behavior. The factor evaluator is checked from captured levels; costs, caps, purchases, unlocks, bulk buying, and other upgrade families remain outside this slice.

The Vitest parity suite checks the pinned reference corpus, asserts the 40-formatter boundary matrix and wrapper cutoff samples, and compares the core Decimal facade against captured Remix outputs. A property test also checks legacy JSON round-trips for safe integers. `RemixRandom` is golden-tested against mixed draws for 15 source seeds and property-tested for repeatable in-range streams. A separate golden captures the reference sequence-exhaustion result. The mine-object generator compares all 224 captured object outputs in Chromium and property-checks repeatability over 100 sampled IDs. Node's `Math.sin` differs by a few ulps from Chromium for generated Planet Coin chance values at IDs 118 and 132; Node masks only those two fields while Playwright checks the complete records. `packages/formatting` implements all 40 registered classes. Its unit tests compare Node-stable direct, exponent, and wrapper outputs; the Playwright browser harness compares the full captured corpus for every formatter and wrapper in Chromium. Node's `Math.log10` path returns `999` for `999.5` in Idle Mine Notation while captured Chromium returns `1,000`; the Node comparator omits only that engine-sensitive sample, and the browser test checks it exactly. Do not add rounding to the implementation to erase these runtime differences. Native WebView parity still needs validation.

`pnpm test:reference` is a separate read-only browser probe. It loads the pinned Remix checkout, substitutes the SHA-verified CDN response snapshots recorded in `sources/runtime-dependencies.json`, fixes the clock and RNG, suppresses the animation loop, and compares the result with the checked-in oracle corpus. `pnpm reference:preview` writes a disposable capture under ignored `.research/outputs/`. `pnpm reference:extend` adds new fields only if every existing field still matches; `pnpm reference:update -- <field>` replaces exactly one named field after checking all others. Review every proposed fixture change. These commands never modify the canonical checkout or implement Beyond behavior.

`pnpm test:reference` and `pnpm test:parity` do not certify overall gameplay parity.

## Completion rule

Code presence is not completion. Update the [parity matrix](PARITY_MATRIX.md) only when source understanding, fixture coverage, automated tests, UI/E2E, and visual evidence meet the row's criteria.
