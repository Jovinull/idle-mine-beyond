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

The pinned `initialState` capture records the fresh Remix values and the constructor test compares the core simulation subset against it: starting object/progress, all resources and upgrade levels, pickaxe, Powers, timers, and Story page/notification progress. It also checks that two new states do not share mutable objects. This does not compare settings, notation instances, message history, or the complete Remix runtime object.

The web Vite config serves dev-only compatibility harness routes for formatting, mine objects, mining rates, mining transitions/frame events, Story, offline progress, and save codecs. Playwright loads the shared packages in Chromium and compares their outputs with the frozen reference corpus; these routes are not emitted as product pages by the static build.

## Harness folders

| Folder         | Purpose                                                      |
| -------------- | ------------------------------------------------------------ |
| tests/unit     | Unit and property coverage                                   |
| tests/parity   | Reference behavior fixtures and comparison tests             |
| tests/fixtures | Inputs, outputs, imported save samples, deterministic states |
| tests/e2e      | Browser smoke and user-flow checks                           |
| tests/visual   | Screenshot baselines and diffs                               |

`tests/fixtures/visual/remix-story-mine-objects/` contains 47 compressed raw RGBA source baselines for the pinned Remix Story's 48 mine-object preview occurrences at 256×224. `pnpm reference:story-pixels` recaptures from the clean pinned checkout in Playwright Chromium and verifies fixture hashes; `pnpm reference:story-pixels:capture` is an explicit reviewed rewrite. Both Story runtime and Canvas capture require Playwright's pinned Chromium (`pnpm exec playwright install chromium`); an installed Chrome or `PLAYWRIGHT_CHROMIUM_EXECUTABLE` is refused for capture, and checks name a browser-version mismatch. Every Playwright launch passes `--font-render-hinting=none` so Windows and Linux produce identical text layout and Canvas pixels. Golden checks compare decompressed pixels, because gzip headers record the host OS. `tests/e2e/mine-object-renderer.spec.ts` compares the Beyond canvas adapter to those pixels. Alpha must match exactly. Cases with a different whole-image hash currently pass only when RGB channel deltas are at most one and affect no more than 2% of pixels. This measured renderer tolerance is not a gameplay exception or full-screen visual certification.

Do not commit copied upstream game assets or saves as fixtures without provenance review. Prefer minimal synthetic state and scalar outputs.

## Golden fixture envelope

Each fixture should identify the source repository and commit, source file or probe method, capture date, normalized input, output, precision/serialization rules, and any uncertainty. Fixture updates require explaining why the reference output changed; never regenerate expected values merely to make a failure pass.

## Visual targets

Use 1366×768, 1440×900, 1920×1080, and 2560×1440. Capture light and dark themes and states such as initial, gems unlocked, Planet Coins, Wisdom, story, settings, huge numbers, long generated names, and disabled controls.

## Current reference and compatibility harnesses

The Vitest parity suite and Playwright Chromium harness compare nine controlled damage, rate, and mining-factor configurations against oracle outputs from the pinned source/runtime. They include Money/Gem/Planet Coin/Wisdom effect levels, Power of Exquisity above one, a last-damageable-object Gem multiplier, a Planet Coin drop, zero damage, exact/below/above defense boundaries, Number hit-count overflow, and the legacy explicit-target/current-object behavior. The factor evaluator is checked from captured levels; costs, caps, purchases, unlocks, bulk buying, and other upgrade families remain outside this slice.

The oracle corpus records 249 controlled price/effect level samples across all 29 upgrade definitions, including finite caps and known cost softcaps, five interaction scenarios with nine cross-upgrade effect outputs, five controlled Blacksmith Expertise RNG cases with draw counts, and 14 source purchase cases. Vitest compares Beyond's evaluator against the formula, interaction, RNG, and purchase-transition snapshots; Playwright compares formula, interaction, and RNG outputs exactly in Chromium. The sole Node-runtime exception is `gems.idlePower@99`, where Node's `Math.pow` differs from Chromium by one ULP; Node uses a narrow tolerance for that sample and Chromium remains exact. Purchase UI/browser interaction coverage remains pending. `pnpm test:reference` separately replays the source and verifies the oracle corpus.

The Vitest parity suite checks the pinned reference corpus, asserts the 40-formatter boundary matrix and wrapper cutoff samples, and compares the core Decimal facade against captured Remix outputs. A property test also checks legacy JSON round-trips for safe integers. `RemixRandom` is golden-tested against mixed draws for 15 source seeds and property-tested for repeatable in-range streams. A separate golden captures the reference sequence-exhaustion result. The mine-object generator compares all 224 captured object outputs in Chromium and property-checks repeatability over 100 sampled IDs. Node's `Math.sin` differs by a few ulps from Chromium for generated Planet Coin chance values at IDs 118 and 132; Node masks only those two fields while Playwright checks the complete records. `packages/formatting` implements all 40 registered classes. Its unit tests compare Node-stable direct, exponent, and wrapper outputs; the Playwright browser harness compares the full captured corpus for every formatter and wrapper in Chromium. Node's `Math.log10` path returns `999` for `999.5` in Idle Mine Notation while captured Chromium returns `1,000`; the Node comparator omits only that engine-sensitive sample, and the browser test checks it exactly. Do not add rounding to the implementation to erase these runtime differences. Native WebView parity still needs validation.

The mining-transition fixture currently has ten hit cases and four update-frame cases. Vitest compares both low-level transitions and the composed `performRemixMiningAction` boundary: strict idle timer thresholds, one-hit/reset behavior, save threshold/reset behavior, ordered save/story-refresh events, derived damage/factors, same-index object refresh, Money, Gem rounding and strict chance equality, successful and failed Planet Coin/Wisdom drops, maxima, RNG draw count, and Power of Mining growth. Frozen input state guards the reducer boundary. The Playwright Chromium harness calls the same Beyond core action and compares outputs to the captured source snapshots. These cases do not certify persistence effects or full reward distributions.

`simulationFrameSemantics` captures the pinned `main.js` update and active-click functions with controlled state, clock delta, and RNG. Three cases cover a nonbreaking click, an idle frame exactly at the strict hit threshold, and an idle break that crosses the autosave threshold and unlocks two Story milestones. The last case proves the source event sequence is mining → save → Story refresh: the save snapshot contains Money and progress from the break with Story still at `highestUnlocked: -1`/`notifications: 0`; returned state ends at index 1/count 2. `performRemixSimulationAction` compares the core-state subset, event list, random draw count, and save-effect snapshot against this fixture. It does not implement the persistence adapter or full legacy save schema.

The same action boundary now composes all 14 captured `upgradeSemantics.purchaseSemantics` cases into the full fresh simulation state. Coverage includes four resource families, exact and rounded affordability, caps, `buyN` alignment, and `buy10`/`buy100`; the test checks the resulting level/currency, unrelated state, input immutability, and an empty effect list. Source inspection of `Scripts/upgrade.js` and `Scripts/Define/game.js` confirms the pinned `Upgrade.buy()` path has no save call and canonical upgrade definitions have no custom `onBuy` hook. UI modifier mapping and persistence timing after purchase remain separate work.

`pickaxeCraftingSemantics` captures five source-controlled random candidate outputs, minimum/average display outputs, and five `functions.craftPick()` transaction cases. Vitest compares exact Power, Quality, Damage, generated names, draw counts, Gem balances, equipped pickaxes, feedback messages/colors, event order, and save counts. Coverage includes the 15-roll quality cap, Expertise bonus, generated-word branch, ID 210 special-anchor naming fallback, strict equal-damage duds, insufficient Gems without RNG use, bulk crafting, and source rounding of a fractional Gem balance. Repeated-sample distribution analysis and player-facing UI/E2E coverage remain open.

The offline-load corpus contains ten controlled source calls with injected per-second rates: exact/over-threshold boundaries, the default and upgraded caps, `nooffline`, missing/future timestamps, zero rates, and advancing clock reads. The unit and Chromium tests compare elapsed and capped duration, resource deltas and maxima, formatted log effects, source-ordered clock reads, and the state passed to the save effect. The reference verification separately replays the actual pinned `loadGame()` branch with isolated localStorage/log instrumentation. This slice does not cover the full importer, corrupt saves, or all live rate-generation states.

`saveSemantics` in the oracle corpus records the pinned current save's top-level/nested keys, Decimal JSON values, omitted upgrade functions, storage key, encode/decode order, absent and empty optional groups, five malformed/partial-load outcomes, Base64 whitespace/padding variants, and controlled ASCII/Unicode codec vectors. `@idle-mine-beyond/persistence` independently implements the encodeURIComponent → escape → Base64 and Base64 → decodeURIComponent → unescape → JSON stages. Vitest and a Chromium E2E harness compare exact encoded strings, decoded values, and decoder outcomes with the pinned vectors, including the non-ASCII corruption and source error ordering. `pnpm test:reference` separately reconstructs the outputs from the pinned browser runtime. Applying save fields, schema validation, migration, backups, storage, and recovery remain unimplemented.

The story corpus contains nine chapters, 61 ordered milestones and 61 distinct condition expressions. Its oracle probe records boundary samples for every expression, six controlled notification/visibility scenarios, a two-stage high-water skip sequence, the initial story state, 152 dynamic objective outputs at four mine levels, and 80 outputs for formatter-sensitive objectives across all 40 notations. Four `payUSDebt` balances capture the debt joke's alert/log effects and confirm that no Money is deducted. Four tab scenarios capture notification clearing, scroll save/restore, and 30/50 ms delayed effects. Vitest and Chromium compare condition evaluation, notifications, visible milestone keys by page, next objective text, maximum page, page-navigation clamps, dynamic objective rendering, the debt button, and tab transitions. `remix-story-markup.json` preserves the exact pinned Story article template and descriptors for its 62 ordered conditional blocks, including both `mineUniverse` sections and nested Colossia entries. `remix-story-runtime.json` captures the fresh first page and all nine fully unlocked page renders from the pinned application in Chromium at 1440×900, including rendered root block HTML/text, canvas preview dimensions, chapter headings, objectives, computed styles, and preservation of `scrollTop` when navigating from Story page 0 to 1. Both read-only extractors verify the clean pinned checkout; Vitest checks source order, captured runtime output, template translation and escaping. `StoryPanel.svelte` is separately mounted in the browser harness: E2E compares fresh and all-unlocked headings, milestone order/text/image paths/Canvas levels, exercises navigation and captured scroll behavior, checks selected source styles and the `PAY` alert/log event, and waits for all 48 preview canvases to render. `pnpm test:reference` replays source captures. This does not certify full app wiring, in-app log presentation, tab scroll persistence, dark theme, viewport coverage, or Beyond screenshots.

`pnpm test:reference` is a separate read-only browser probe. It loads the pinned Remix checkout, substitutes the SHA-verified CDN response snapshots recorded in `sources/runtime-dependencies.json`, fixes the clock and RNG, suppresses the animation loop, and compares the result with the checked-in oracle corpus. `pnpm reference:preview` writes a disposable capture under ignored `.research/outputs/`. `pnpm reference:extend <field>` adds new fields only if every existing field still matches; `pnpm reference:update <field>` replaces exactly one named field after checking all others. Review every proposed fixture change. These commands never modify the canonical checkout or implement Beyond behavior. Story runtime and pixel checks also require the browser version recorded in the fixture; capture only with Playwright's pinned Chromium, never a system Chrome, and review all proposed golden changes.

CI runs on Ubuntu. To reproduce it from Windows, clone the repository inside a WSL Ubuntu 24.04 filesystem (not `/mnt/c`), install Node 24.21.0 and pnpm 12.6.0, and run the `.github/workflows/ci.yml` steps in order: `pnpm install --frozen-lockfile`, `pnpm research:setup`, `pnpm docs:check`, `pnpm skills:check`, `pnpm check`, `pnpm exec playwright install --with-deps chromium`, `pnpm test:reference`, and `pnpm test:e2e`. Set `CI=true` to match GitHub Actions' Playwright retries, reporter, and fresh web server.

`pnpm test:reference` and `pnpm test:parity` do not certify overall gameplay parity.

## Completion rule

Code presence is not completion. Update the [parity matrix](PARITY_MATRIX.md) only when source understanding, fixture coverage, automated tests, UI/E2E, and visual evidence meet the row's criteria.
