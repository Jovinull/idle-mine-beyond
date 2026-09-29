# Remix Story mine-object source pixels

This folder contains raw RGBA pixel baselines for the 47 unique mine-object levels shown across 48 previews in the pinned Idle Mine: Remix Story pages. Each `level-N.rgba.gz` decompresses to exactly `256 × 224 × 4` bytes. `manifest.json` records the source commit, browser and Playwright versions, capture context, pixel hashes, and compressed-file hashes.

The source is served read-only from the clean checkout at commit `0e0f4bf5a9c66e5603cda2ce4bd54213023dae21`; captures use Chromium `154.0.8037.58`, Playwright `1.63.0`, light color scheme, and viewport 1440×900. Re-run `pnpm reference:story-pixels` to reproduce and verify. To intentionally rewrite baselines after reviewing a reference change, use `pnpm reference:story-pixels:capture`.

These are source reference artifacts for Canvas component comparisons, not Beyond screenshots or full-screen visual approvals. The Story adapter currently matches 36 of 48 preview occurrences by exact pixel hash; the other occurrences meet only the documented one-unit RGB tolerance with exact alpha. See [UI and visuals](../../../../docs/knowledge/ui-and-visuals.md), [Story](../../../../docs/knowledge/story.md), and [testing and parity](../../../../docs/knowledge/testing-and-parity.md).
