# Visual regression foundation

Future full-screen visual baselines should record the canonical Remix state/save, theme, browser, and viewport. Initial desktop target viewports: 1366×768, 1440×900, 1920×1080, and 2560×1440, with light and dark states. Mobile preserves behavior and hierarchy; it is not a pixel-identical modern Remix oracle. Source-only RGBA baselines for Story mine-object canvases exist under `tests/fixtures/visual/remix-story-mine-objects/`; no Beyond full-screen screenshot baseline has been approved.

The read-only Remix Story probe produces exploratory source screenshots for the all-unlocked first and ninth chapters at 1440×900 in `.research/outputs/story-runtime/`. They are disposable research output, not approved Beyond baselines or a visual regression test. Recreate them with `pnpm reference:story-runtime:capture`; inspect the fixture and state metadata before using them as a comparison target.
