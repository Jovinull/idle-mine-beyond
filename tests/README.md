# Test boundaries

- `unit/`: focused deterministic package checks.
- `parity/`: reference manifest and, later, source-derived/golden compatibility assertions.
- `fixtures/parity/`: minimized documented oracle fixtures.
- `e2e/`: browser launch and player-visible compatibility flows.
- `visual/`: baseline policy and future screenshot comparisons.

The scaffold smoke checks prove harness operation only; they do not imply gameplay parity.

The Story UI slice is source-derived from `fixtures/parity/remix-story-markup.json` and `remix-story-runtime.json`. `parity/story-template.test.ts` validates the deterministic template translation; `e2e/story-panel.spec.ts` mounts the standalone `StoryPanel` at the dev-only `/__test__/story-panel` route and compares fresh/all-unlocked narrative, navigation, scroll behavior, selected computed styles, images, and mine-object levels. The separate `mine-object-renderer.spec.ts` checks the 48 Canvas previews against compressed raw-RGBA reference files.
