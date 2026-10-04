# Test boundaries

- `unit/`: focused deterministic package checks.
- `parity/`: reference manifest and, later, source-derived/golden compatibility assertions.
- `fixtures/parity/`: minimized documented oracle fixtures.
- `e2e/`: browser launch and player-visible compatibility flows.
- `visual/`: baseline policy and future screenshot comparisons.

The scaffold smoke checks prove harness operation only; they do not imply gameplay parity.

The Story UI slice is source-derived from `fixtures/parity/remix-story-markup.json` and `remix-story-runtime.json`. `parity/story-template.test.ts` validates the deterministic template translation; `e2e/story-panel.spec.ts` mounts the standalone `StoryPanel` at the dev-only `/__test__/story-panel` route and compares fresh/all-unlocked narrative, navigation, scroll behavior, selected computed styles, images, and mine-object levels. `e2e/mine-object-renderer.spec.ts` checks the 48 Story previews against compressed raw-RGBA files and directly compares live pinned Remix and Beyond Canvas output hashes for all 920 captured mine objects.

`e2e/upgrade-all-caps-differential.spec.ts` replays source-shaped saves against the pinned Remix runtime and Beyond for every finite-capped Money, Gem, and Planet Coin shop card. It compares `cap - 1`, `cap`, and `cap + 1` labels, affordance styles, hovered text, and exact card/detail pixels at 1440x900 in both themes. Run it with `pnpm exec playwright test tests/e2e/upgrade-all-caps-differential.spec.ts --workers=1`.

`e2e/upgrade-affordability-differential.spec.ts` compares source/Beyond affordability boundaries, hovered resource-tab styles after the pinned theme CSS has loaded, and all 22 shop cards with normal, Shift, and Control purchases from the same source-shaped level-zero save. Its card/detail visual differential also checks all 22 cards at levels 0 and 1, in both themes at 1440x900. For Money, Gems, and Planet Coins, it compares complete viewport screenshots at both starting levels in both themes (12 source/Beyond full-screen comparisons). It also compares full viewports at all seven affordability boundaries per theme: zero resource for each group, Money immediately below price, and exact price for each group (14 more full-screen comparisons). Both source and Beyond images finish decoding before capture; fonts, two animation frames, and repeated screenshot hashes stabilize each view. The suite checks resulting levels, card/tooltip presentation, and visible resource balances. Run the full focused suite with `pnpm exec playwright test tests/e2e/upgrade-affordability-differential.spec.ts --workers=1`; run just the exhaustive card-routing case with `pnpm exec playwright test tests/e2e/upgrade-affordability-differential.spec.ts --grep "routes single, Shift, and Control purchases" --workers=1`.

`e2e/upgrade-tab-state-differential.spec.ts` compares live Gem/Planet Coin group selection across Mining/Story navigation, legacy export, and a fresh-page load against pinned Remix. Run it with `pnpm exec playwright test tests/e2e/upgrade-tab-state-differential.spec.ts --workers=1`.
