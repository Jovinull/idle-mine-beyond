# Test boundaries

- `unit/`: focused deterministic package checks.
- `parity/`: reference manifest and, later, source-derived/golden compatibility assertions.
- `fixtures/parity/`: minimized documented oracle fixtures.
- `e2e/`: browser launch and player-visible compatibility flows.
- `visual/`: baseline policy and future screenshot comparisons.

The scaffold smoke checks prove harness operation only; they do not imply gameplay parity.

`e2e/offline-progression.spec.ts` compares the production cold-start path in
the pinned Remix and Beyond apps using the same encoded legacy save and a
frozen clock. It checks the visible welcome-back message text/color and full
legacy exports for a capped seven-hour restore in light and dark themes and a
backward-clock restore. The `.messagelog` crop must match the pinned Remix at
1440×900 with exact pixels in both themes. It complements the isolated source-captured timing/rate cases. A source-paired controlled-clock case advances the clock between fallback, elapsed-time, timestamp-update, and save reads, compares the clock prefixes and full message/export result, and freezes later framework reads at the final time. This does not simulate real operating-system/browser background suspension. Run it with
`pnpm exec playwright test tests/e2e/offline-progression.spec.ts --workers=1`.

The Story UI slice is source-derived from `fixtures/parity/remix-story-markup.json` and `remix-story-runtime.json`. `parity/story-template.test.ts` validates the deterministic template translation; `e2e/story-panel.spec.ts` mounts the standalone `StoryPanel` at the dev-only `/__test__/story-panel` route and compares fresh/all-unlocked narrative, navigation, scroll behavior, selected computed styles, images, and mine-object levels. `e2e/mine-object-renderer.spec.ts` checks the 48 Story previews against compressed raw-RGBA files and directly compares live pinned Remix and Beyond Canvas output hashes for all 920 captured mine objects.

`e2e/upgrade-all-caps-differential.spec.ts` replays source-shaped saves against the pinned Remix runtime and Beyond for every finite-capped Money, Gem, and Planet Coin shop card. It compares `cap - 1`, `cap`, and `cap + 1` labels, affordance styles, hovered text, and exact target-card/detail pixels at 1440x900 in both themes. The target card uses its established one-pixel inset crop; its full detail panel is captured separately so the crop does not include unrelated cards between the two elements. Remix and Beyond run in pages within the same browser context. Each crop must stabilize across consecutive screenshots and match exactly. The `@slow` cases have a ten-minute per-theme timeout and stay excluded from default `pnpm test:e2e`. Run them with `pnpm exec playwright test -c playwright.slow.config.ts tests/e2e/upgrade-all-caps-differential.spec.ts --workers=1`.

`e2e/upgrade-affordability-differential.spec.ts` compares source/Beyond affordability boundaries, hovered resource-tab styles after the pinned theme stylesheet has loaded, and all 22 shop cards with single, Shift, Control, and simultaneous Shift+Control purchases from the same source-shaped level-zero save (88 actions). This covers Remix's Control-first branch when both modifiers are held. Its card/detail visual differential also checks all 22 cards at levels 0 and 1, in both themes at 1440x900. For Money, Gems, and Planet Coins, it compares complete viewport screenshots at both starting levels in both themes (12 source/Beyond full-screen comparisons). It also compares full viewports at nine affordability boundaries per theme: zero, one-cent-below, and exact price for each resource group (18 more full-screen comparisons). The Money below-price value is source-captured; Gem and Planet Coin below-price values are derived from the pinned `currentPrice` captures. Affordability screenshots use a fresh context seeded before first navigation, then capture Remix and Beyond sequentially on one Page; catalog screenshots retain paired pages. Both source and Beyond images finish decoding before capture; fonts and two animation frames precede capture. Full-screen parity requires two consecutive identical captures on each side and matching exact source/Beyond hashes, with no pixel tolerance or masking. The suite checks resulting levels, card/tooltip presentation, and visible resource balances. Run the full focused suite with `pnpm exec playwright test tests/e2e/upgrade-affordability-differential.spec.ts --workers=1`; run its `@slow` card-routing case with `pnpm test:e2e:slow --workers=1 --grep "routes single, Shift, Control, and Shift+Control purchases"` (ten-minute timeout).

`e2e/upgrade-tab-state-differential.spec.ts` compares live Gem/Planet Coin group selection across Mining/Story navigation, legacy export, and a fresh-page load against pinned Remix. Run it with `pnpm exec playwright test tests/e2e/upgrade-tab-state-differential.spec.ts --workers=1`.

`e2e/priority-visual.spec.ts` also compares the pinned full Mining screen after
one non-lethal active click on fresh Mud (100 to 80 HP) in both themes at
1440x900. Verify or recapture those source baselines with
`pnpm reference:priority-visuals:mining-damage` or
`pnpm reference:priority-visuals:mining-damage:capture`. Linux checks the source
state but defers the two pixel baselines to the external WSL workflow.

`e2e/browser-storage-failure.spec.ts` injects `QuotaExceededError` through the real Chromium `Storage.prototype.setItem` boundary for both Beyond save keys. It verifies the Settings error, no false save confirmation, preservation of the previous primary, and successful retry. This exercises Beyond's web adapter contract; it does not claim to reproduce actual browser quota policy. Run it with `pnpm exec playwright test tests/e2e/browser-storage-failure.spec.ts --workers=1`.

`e2e/browser-storage-read-failure.spec.ts` injects `SecurityError` through Chromium's `Storage.prototype.getItem` for the Beyond primary and backup. It verifies startup recovery, no fallback to the legacy key, no writes, retained slot contents, and a safely surfaced recovery-export error. Run it with `pnpm exec playwright test tests/e2e/browser-storage-read-failure.spec.ts --workers=1`.
