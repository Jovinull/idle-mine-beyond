# Visual regression foundation

## Certified screenshots

`remix-mining-fresh-light-1440x900.png` and `remix-mining-fresh-dark-1440x900.png` are full-screen fresh Mining source baselines from pinned commit `0e0f4bf5a9c66e5603cda2ce4bd54213023dae21`. Both capture level 0 Mud, Money 0, Gems 5, first-page Story notification, and default Money upgrades, in light and dark game themes respectively. The source capture keeps browser color scheme light and switches the game theme using the pinned `functions.setTheme()` behavior. It uses Chromium `153.0.8010.12`, Playwright `1.63.0`, viewport `1440x900`, locale `en-US`, timezone UTC, and a fixed clock. Each sidecar records source, state, computed layout measurements, game/browser themes, and PNG SHA-256. `pnpm reference:mining-screen` recaptures both into ignored `.research/outputs/` and checks the pinned source; the Beyond E2E matches both full screens at zero differing pixels.

`craft-selector-light-1440x900.png` is a source-runtime crop of the Remix Mining craft controls at commit `0e0f4bf5a9c66e5603cda2ce4bd54213023dae21`. It uses Chromium `153.0.8010.12`, Playwright `1.63.0`, viewport `1440x900`, light theme, and Money/Gem Gem Waster levels `1/2` with level `1` selected. The Beyond crop matches at zero pixel tolerance.

`story-all-unlocked-page-0-light-1440x900.png` is a full-screen source baseline from the same pinned commit. Its controlled save has highest mine-object level `215`, Money high-water `5e13`, maximum Planet Coins `1`, Blacksmith and Gem Waster level `1`, first Wisdom upgrade level `1`, all Story milestones unlocked, chapter `0`, no notifications, and Story scroll position `249px`. It uses light theme, Chromium `153.0.8010.12`, Playwright `1.63.0`, and viewport `1440x900`. The Beyond screen matches every pixel in `tests/e2e/story-visual.spec.ts`.

`story-all-unlocked-page-0-dark-1440x900.png` captures the same Story state and viewport with Remix's pinned dark theme. Its JSON sidecar records the state, browser setup, source paths and screenshot SHA-256. The source screen is reproduced by `pnpm reference:story-runtime:capture`; the Beyond screen matches every pixel in the same theme-parameterized Story E2E.

The source and Beyond captures pause CSS animations at time zero to make the rotating Wisdom tab icon deterministic. This only stabilizes screenshots; it does not alter the game's runtime behavior. The Mining, Story, and Settings pairs each certify one state and viewport in both themes. Other Mining states, Story pages and notification states, Settings content states, other screens, and viewports remain open. See [IP provenance](../../docs/knowledge/ip-provenance.md).

`settings-fresh-light-1440x900.png` and `settings-fresh-dark-1440x900.png` capture the source Settings screen in both game themes. Their sidecars record the fresh resources/preferences, one Story notification, pinned source commit, browser, fixed clock, and hashes. The read-only source capture injects that notification in memory to match the first completed idle frame in the Beyond route. `pnpm reference:story-runtime:capture` recreates these under ignored `.research/outputs/story-runtime/`; `tests/e2e/settings-visual.spec.ts` matches both full screens at zero differing pixels.

## Capture workflow

Record the canonical Remix save/state, theme, browser, and viewport for each baseline. Initial desktop target viewports are 1366x768, 1440x900, 1920x1080, and 2560x1440, with light and dark themes. Mobile preserves behavior and hierarchy; there is no authoritative modern Remix mobile visual oracle.

The read-only Remix Story probe produces disposable source screenshots for all-unlocked chapters 1 and 9 and fresh Settings light/dark states in `.research/outputs/story-runtime/`. Recreate them with `pnpm reference:story-runtime:capture`; the first-chapter capture is also the source for the approved Story baseline above. Recreate both fresh Mining themes with `pnpm reference:mining-screen`; explicitly reviewed source-baseline updates use `pnpm reference:mining-screen:capture`. Review each state and fixture metadata before adding or changing a baseline.

## Browser and Canvas requirements

Story runtime, fresh Mining screen, and Canvas captures must use the Chromium version bundled with the pinned Playwright package. Install it with `pnpm exec playwright install chromium`; capture mode rejects system Chrome and an explicit alternate browser. The source capture records Chromium `153.0.8010.12`, and read-only verification rejects a different version. The launcher disables font hinting to reduce platform-dependent text and Canvas differences. Source-only RGBA baselines for the Story's 48 preview occurrences are under `tests/fixtures/visual/remix-story-mine-objects/`; these Canvas baselines do not certify the surrounding UI.
