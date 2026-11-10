# UI, themes, and interaction behavior

## Visual authority

The desktop Remix UI is the initial visual oracle. Before changing Beyond UI during parity, inspect the pinned index.html, main.css, theme CSS, assets, fonts, and live reference. Use actual screenshots and computed styles where useful. Never infer a redesign from the age of the original.

The pinned `index.html` root has no `lang` attribute. Keep that source metadata
in `apps/web/src/app.html`; `tests/e2e/remix-app.spec.ts` compares the root
attribute and computed `-webkit-locale` with the pinned page. Removing
Beyond's generated `lang="en"` normalizes the computed locale to the source
value, but did not change the strict dark shop screenshot hashes or explain
their corner-pixel difference.

The pinned `index.html` places `#app` directly under `body`. The Beyond
`app.html` keeps SvelteKit's recommended `<div style="display: contents">`
around `%sveltekit.body%`; the installed SvelteKit runtime warns that mounting
directly on `body` can break some browser extensions. The wrapper has no
rendered box. A same-page A/B capture of the dark level-zero Gem catalog was
byte-identical before and after moving its children directly under `body`, so
the wrapper is not the cause of the currently observed card-border pixel
difference. Do not remove it as a visual workaround.

## Source-observed structure

The reference UI includes Money, Gems, conditional Planet Coins, object name and stats, pickaxe name/P/Q/damage, damage-per-click and per-second stats, money/gem/Planet Coin rates, upgrades, crafting, story, and settings. The CSS uses an 8vh / 84vh / 8vh page grid and a 45vw main split. These values are source observations, not a claim that all responsive states have been captured.

The default appearance is a light, sparse browser game. The source includes Work Sans and Montserrat font files and a separate dark theme. Preserve original spacing, color groupings, hierarchy, and native-feeling controls as they are verified.

In pinned `index.html`, `settings.showMinCraftDamage` conditionally renders a
60%-size `Minimum Base Damage` span inside the Mining craft button, while
`settings.showMineObjLevel` conditionally renders the selected mineral-level
heading. These settings change visible labels only. The source-paired
`tests/e2e/mining-preferences-visual.spec.ts` toggles each setting in Settings
and compares complete Mining screens with both labels absent, then each label
present separately in light and dark themes at 1440x900. Windows and Linux
compare all six states at zero pixels. On Linux, a test-only paint refresh of
the pinned Remix page (temporarily hiding and restoring direct body children
across two animation frames) is required before the normal screenshot capture;
the hidden page is never captured, Beyond is not mutated, and the full-screen
SHA-256 comparison remains exact. CI run 97 (2026-11-07) passed all six Linux
comparisons. This closes the specific Mining-preference screenshot gap; it
does not certify other Mining states or the broader desktop UI.

## Story source styles

At the pinned Remix source revision, `main.css` gives `article.story` `1rem` padding and `z-index: -1`. Its `.story-milestones` scroller uses vertical scrolling, `overscroll-behavior: contain`, and `height: 62vh`. The objective has a top border of `1px solid rgba(0, 0, 0, 0.4)`, zero margin, and `0.5rem` top padding. Each direct milestone child has `1rem 0` padding and the same bottom border, except the last child. Images inside the article are `6em` high.

The chapter control is a full-width flex row, spaced between its children, vertically centered, `4rem` tall, and has a matching bottom border. Its heading is `2rem`; its buttons and images are forced to `3rem` square. Quotes use a flex row with centered alignment and `0.5rem 0` margin. Quote text has `2rem` left margin, `3rem` font size, `#404040` color, italic styling, and the source-declared `"Times new Roman", serif` family. The dark theme overrides that quote text color to `#c1c1c1`.

These declarations come from the pinned source (`main.css`, lines 408–468; `Themes/dark.css`, line 22 onward). A controlled Chromium runtime snapshot now confirms the light-theme computed styles at 1440×900: the scroller is 558px high, the article retains `z-index: -1`, the chapter heading is 32px, and the quote text is 48px italic Times New Roman with a 32px left margin. This establishes those values for the captured state and browser; it does not establish every viewport or theme, or a Beyond comparison. Do not “correct” the unusual negative `z-index` by intuition. The Story markup and runtime captures are described in [the Story system record](story.md); source captures are not approved Beyond visual baselines.

`apps/web/src/lib/StoryPanel.svelte` uses the captured source article markup, milestone conditions, objective text, page controls, six narrative icons plus two chapter arrows, and source-derived Story CSS. The Svelte route connects this panel to the game Story tab and source tab-transition behavior. Work Sans and Montserrat WOFF2s are under `apps/web/static/fonts/`.

At the pinned source, the header title uses `flex-grow: 1`, Money uses `flex-grow: 1.1` and centered text, and Gems/Planet Coins use `flex-grow: 1` with right alignment. Footer order is Mining, conditionally Powers, Story, Settings; their source icons are part of the button content. The Story badge is absolutely placed at `left: 1.5rem; bottom: 0.2rem`; while a notification is present the Story icon gets the notification class and a `0.9rem` right margin. Header/footer and icon behavior is reproduced by the route.

The pinned Chromium runtime records native `1px 6px` padding on the chapter arrow buttons. Preserve it: setting padding to zero visibly shifts the right arrow. Tracked source screenshots cover all nine controlled all-unlocked Story pages in both themes at 1440x900; the Beyond route matches all eighteen at zero differing pixels. The dark capture uses the pinned `Themes/dark.css` and its source body colors `#363636` / `#c1c1c1`; the source also overrides the quote text to `#c1c1c1`. The first dark comparison exposed a white Beyond Story host and dark text because the standalone Story renderer sets its own light colors. `remix-story.css` now applies the captured dark background, inherited foreground, and quote color. CSS animations are paused at time zero in all captures. Together with the fresh Game Start, first-Mud, and selected natural progression captures below, this completes the approved Story visual scope at 1440x900. Per-milestone screenshots are not required; every condition, objective, and template branch has source assertions. Other game screens and their viewports remain in the broader desktop UI matrix row.

Natural Story route-end captures for Chapters 3-6 have a live pinned-source
versus Beyond pixel comparison in light and dark themes at 1366x768, 1440x900,
1920x1080, and 2560x1440. The Windows Chromium comparison passed all four routes
exactly in each theme at all four viewports. Ubuntu CI run 42484538684 passed
both themes at 1440x900. Runs 42489378984 and 42490501482 both reproduce a
two-pixel difference on the first “W” in the Chapter 3 light objective at
1366x768 (`(15,632)` and `(15,633)`); the source and Beyond Work Sans files have
identical hashes. Run 42492337106 also reproduces the same coordinates on the Chapter 4 dark objective. Run 42494765267 uploaded the failure JSON: Remix had one loaded Work Sans face at weight 400 and its `document.fonts.check` returned true; Beyond had duplicate `@font-face` entries (one unloaded weight 400 and one loaded `normal`), and the check returned false. Geometry and computed text styles matched. Beyond now declares each font once at the route level with the source's normal/400 descriptors, and the Story differential asserts Work Sans loads in both runtimes. CI run 42496892093 confirms the check and font-face list now match. CI run 42499004054 confirms all captured computed CSS properties, objective geometry, and regular/bold font checks now match. CI run 42500838165 reports exact objective text/markup and `Work Sans` / `WorkSans-Regular` for the bold node in both pages. CI run 42503025927 shows the source article is directly under `main`, while Beyond inserts `.story-panel-host` with the same bounds and `overflow:hidden`; matched ancestor nodes have equal computed CSS and geometry. In CI run 42505857185, all four temporary host variants had the original Beyond hash and retained the same two light pixels, so `overflow`, background, and box generation are not their cause. That run passed the Chapter 4 dark case; only Chapter 3 light failed. The strict comparison remains open without masking or tolerance, and later Linux viewports have not run.
Reviewing the retained CI run 42508151479 PNGs and JSON confirms identical results across both retries. In Chapter 3 light, Remix is `(250,250,250)` at `(15,632)` and `(15,633)`, while Beyond is `(250,250,242)` and `(250,250,226)`. In Chapter 4 dark, Remix is `(54,54,54)` at both coordinates, while Beyond is `(54,54,58)` and `(54,54,67)`. Red and green match; only blue differs at these two objective glyph-edge pixels. The captures still report matching text geometry, computed styles, markup, and platform font. A 2026-11-10 Ubuntu 24.04 WSL run compares all four Chapter 3-6 routes at 1366x768, 1440x900, 1920x1080, and 2560x1440 in both themes. It confirms the exact two-pixel signature on the light objective label at 1366x768 (`y=632,633`) and 1920x1080 (`y=850,851`) on every route, and on the Chapter 4 dark label at 1366x768; the other 23 captures match exactly. The live test asserts the exact changed RGBA values for those nine captures. CI run 273 captured exact equality for the Chapter 4 dark state; that named capture now accepts exact equality or the exact two-pixel signature, while all remaining pixels stay strict. The raster cause remains open.

Tracked source PNG baselines remain Windows-only.

| Story page | Light baseline                                                                  | Dark baseline                                                                  |
| ---------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 0          | [PNG](../../tests/fixtures/visual/story-all-unlocked-page-0-light-1440x900.png) | [PNG](../../tests/fixtures/visual/story-all-unlocked-page-0-dark-1440x900.png) |
| 1          | [PNG](../../tests/fixtures/visual/story-all-unlocked-page-1-light-1440x900.png) | [PNG](../../tests/fixtures/visual/story-all-unlocked-page-1-dark-1440x900.png) |
| 2          | [PNG](../../tests/fixtures/visual/story-all-unlocked-page-2-light-1440x900.png) | [PNG](../../tests/fixtures/visual/story-all-unlocked-page-2-dark-1440x900.png) |
| 3          | [PNG](../../tests/fixtures/visual/story-all-unlocked-page-3-light-1440x900.png) | [PNG](../../tests/fixtures/visual/story-all-unlocked-page-3-dark-1440x900.png) |
| 4          | [PNG](../../tests/fixtures/visual/story-all-unlocked-page-4-light-1440x900.png) | [PNG](../../tests/fixtures/visual/story-all-unlocked-page-4-dark-1440x900.png) |
| 5          | [PNG](../../tests/fixtures/visual/story-all-unlocked-page-5-light-1440x900.png) | [PNG](../../tests/fixtures/visual/story-all-unlocked-page-5-dark-1440x900.png) |
| 6          | [PNG](../../tests/fixtures/visual/story-all-unlocked-page-6-light-1440x900.png) | [PNG](../../tests/fixtures/visual/story-all-unlocked-page-6-dark-1440x900.png) |
| 7          | [PNG](../../tests/fixtures/visual/story-all-unlocked-page-7-light-1440x900.png) | [PNG](../../tests/fixtures/visual/story-all-unlocked-page-7-dark-1440x900.png) |
| 8          | [PNG](../../tests/fixtures/visual/story-all-unlocked-page-8-light-1440x900.png) | [PNG](../../tests/fixtures/visual/story-all-unlocked-page-8-dark-1440x900.png) |

## Fresh Story start visual baseline

The pinned fresh-game capture enters Story through the source tab control, clearing the initial notification, then records page 0 at scrollTop 0. The state contains the source Game Start milestone and the objective to mine the first Mud; Money is 0 and Gems are 5. Both screenshots use the pinned Remix commit, Chromium 153.0.8010.12, and 1440x900. The app route matches each source image at zero differing pixels.

| Theme | Fresh Story baseline                                              |
| ----- | ----------------------------------------------------------------- |
| Light | [PNG](../../tests/fixtures/visual/story-fresh-light-1440x900.png) |
| Dark  | [PNG](../../tests/fixtures/visual/story-fresh-dark-1440x900.png)  |

## First-Mud progress visual baseline

The source capture clicks the initial Mud canvas five times, executes the pinned update loop to refresh Story notifications, then enters Story through its tab control. The five real hits break the Mud and award 2 Money; the current object remains Mud with 100 HP, the Story high-water mark becomes 1, and the notification count becomes 2 before Story entry clears it. The resulting page shows `gameStart` and `firstMud`, with “Mine a piece of Paper” as the next objective. `pnpm reference:story-runtime:capture` recreates both source screenshots and records the pre-entry and captured Story states in ignored `.research/outputs/story-runtime/story-first-mud-visual-metrics.json`.

| Theme | First-Mud Story baseline                                              |
| ----- | --------------------------------------------------------------------- |
| Light | [PNG](../../tests/fixtures/visual/story-first-mud-light-1440x900.png) |
| Dark  | [PNG](../../tests/fixtures/visual/story-first-mud-dark-1440x900.png)  |

The Beyond E2E repeats the five mining clicks and matches both source screenshots at zero differing pixels on Windows. Linux still checks the live state and milestone order, but its screenshot comparison awaits Linux captures for fresh Game Start, first-Mud, first-Paper, first-Blacksmith, and first-Clay; the current managed session cannot start WSL (`Wsl/Service/E_ACCESSDENIED`).

## First-Paper progress visual baseline

The pinned browser probe continues from the captured first-Mud Story entry, returns to Mining, selects Paper, and applies 24 real canvas clicks. Paper starts with 400 HP and 3 defense; the active damage is 17. The source awards 10 Money, leaves the selected Paper at 400 HP, advances `highestMineObjectLevel` to 2 while `mineObjectLevel` stays 1, and raises one Story notification on the next source update. Opening Story clears it. The page shows `gameStart`, `firstMud`, and `firstPaper`, with Money 12 and Gems 5. Its next objective is `Upgrade Your Blacksmith once`, because that false milestone precedes `firstSalt` in source order. Preserve this order even though Salt is the next mine object.

`pnpm reference:story-runtime:capture` recreates both pinned screenshots and records mining setup/progression in ignored `.research/outputs/story-runtime/story-first-paper-visual-metrics.json`. The tracked source hashes are light `9cf9019144b35ddba386d75b2a4deddfc86da7a2fabfc9b3d5ca6ab0d2f16ddf` and dark `3b5f849d53958bb2deaae4ac69f1b7b4f96e27d8b4df5bed573efb6b95e7f9b0`; sidecars record the source state, 24-hit action, source revision, and browser provenance.

The Beyond E2E repeats the real route: five Mud hits, Story entry, next-object selection, 23 Paper hits to 9 HP, and the 24th hit to break Paper. It fixes the clock and uses the source sidecar's RNG seed so stochastic Gem drops cannot change the screenshot state; an initial unseeded dark run demonstrated that an extra Gem can otherwise occur. It verifies Money 12, Gems 5, the one-count badge before Story entry, milestone order, objective text, and both full-screen images at zero differing pixels on Windows. Linux continues to verify the interaction and visible state; Linux screenshot comparisons for this and the fresh Story, first-Mud, first-Blacksmith, and first-Clay states remain pending because this managed session cannot start WSL (`Wsl/Service/E_ACCESSDENIED`).

## First-Blacksmith progress visual baseline

The pinned probe continues through the next-objective route. At Paper, the source asks for a Blacksmith upgrade while the player has 12 Money and the level-zero price is 30. Salt is therefore mined next: it has 700 HP, 15 defense, and value 22; the current pickaxe deals 5 damage, so 140 active hits break it. Money becomes 34, and the source update unlocks `firstSalt`, advances Story `highestUnlocked` from 2 to 4, and adds one notification while `blacksmithUpgrade` remains false. Buying Blacksmith once spends 30 and leaves Money 4. The earlier `blacksmithUpgrade` condition becomes true and renders before `firstSalt`, but notification high-water remains 4 and the count stays 1; Story entry clears the badge. The resulting next objective is `Mine a piece of Clay`.

`pnpm reference:story-runtime:capture` records setup, Salt break, purchase, and post-entry Story states in ignored `.research/outputs/story-runtime/story-first-blacksmith-visual-metrics.json`. The tracked light and dark source screenshots have SHA-256 `209a2a2baabd72be6bd4533ecfb689319992f14e6e0acce889123aaa1601c518` and `c84b2529c3ce6bfc842b1f5fa22ca4467f6c6bbcb0e62e41d24dda6be709f9aa`. The Beyond E2E repeats the complete 5-Mud/24-Paper/140-Salt click route and Blacksmith purchase, checks that the later Blacksmith unlock does not add a second Story notification, and matches both Windows screenshots at zero differing pixels. Linux checks the route state but awaits source screenshots for comparison.

## First-Clay progress visual baseline

After the Blacksmith purchase, the next source objective is Clay. The Toy Pickaxe has raw damage 20, while Clay has 35 defense, so the initial active damage is zero. With the route's fixed RNG seed, the first single-Gem craft replaces the Toy Pickaxe with raw damage `34.13925023767472` but still cannot damage Clay; the second craft replaces it with raw damage `61.80207046534054`, giving `26.802070465340503` active damage. Every attempt spends one Gem. The first effective hit leaves Clay at raw HP `1373.1979295346598` (`HP: 1,373` in the source UI); 53 clicks break it and award 50 Money. Story high-water becomes 5 with one notification, and the next objective changes to `Mine a piece of Stone`. These craft results and attempt count are specific to seed 7454 and the recorded preceding route.

The runtime fixture and sidecars capture the two craft outputs, displayed Mining stats, first-hit HP, post-break resources and Story state. Source screenshot hashes are light `e7748b2222891834f0d26e989da5900007aa22c1d830d5f7a856040436b5fdcf` and dark `e6ef626c7430cdb90061bb0d6a2e9f0a3cb7c6e2f9046518e948fc9ac39ee8ec`. The Beyond E2E repeats the fixed-seed route from first-Blacksmith, verifies both one-Gem attempts and the zero-damage first result, then matches both full-screen Story screenshots at zero differing pixels on Windows. Linux checks interaction/state and awaits this screenshot pair.

## Fresh Mining screen visual baseline

The tracked [light Mining baseline](../../tests/fixtures/visual/remix-mining-fresh-light-1440x900.png) and [dark Mining baseline](../../tests/fixtures/visual/remix-mining-fresh-dark-1440x900.png) are pinned-runtime captures from commit `0e0f4bf5a9c66e5603cda2ce4bd54213023dae21`, Chromium `153.0.8010.12`, and Playwright `1.63.0`. Both record a fresh state at 1440x900: Mud at level 0, Money 0, Gems 5, default Money upgrades, and one Story notification. The source capture keeps browser color scheme light and switches the game's theme through the pinned `functions.setTheme()` behavior. Their adjacent JSON sidecars record state, computed measurements, capture settings, and PNG hashes: light `9ce32e41433f8abde89dbb2d515adf868b2712b5771cf6956c6c85ddedf02193`; dark `ce3586ab83d31fb78dabea0b7eb3de881d4c23ef2ed4e44684cb8161fd31210d`. `pnpm reference:mining-screen` replays both pinned source captures in a read-only local server with verified CDN snapshots and checks their rendered measurements and PNG hashes. `tests/e2e/mining-visual.spec.ts` compares the Beyond route against each source image at zero differing pixels.

The initial full-screen comparison exposed the missing `HP:` label and pickaxe icon in the Mining stats. The route now renders the source label and the already provenance-checked `/Images/pickaxe.png` at the source inline height. The fresh Mining state now matches in both source themes at this viewport; later mine-object states and unselected screens/viewports remain open; selected cases are listed below.

**Non-lethal Mud hit at alternate viewports (2026-11-10):** the source-paired `tests/e2e/priority-visual.spec.ts` now captures a live first click on fresh Mud (HP 100 to 80) at 1366×768 and 1920×1080, in both themes. It compares the complete Remix and Beyond screenshots directly at zero differing pixels; the existing 1440×900 state remains covered. Other Mining progression/resource states remain open.

## Upgrade shop source styles and interaction

The default source shop shows Money upgrade cards in `Scripts/Define/game.js` order. Gem cards become visible at `highestMineObjectLevel >= 61`; Planet Coin cards become visible at `>= 90`. The captured presentation fixture records all 29 definitions, their exact labels/descriptions/icons/resource IDs/caps, and source level/effect/price display strings at every formula sample. `UpgradePanel.svelte` renders the 8 Money, 7 Gem, and 7 Planet Coin cards in source order and displays current/next details on pointer hover.

Pinned `main.css` styles `.upgrade` as an inline-block with 3% margins, `0.4em` padding plus `1.05em` bottom padding, a 2px black border, 3px radius, 75% font size, and a 4em icon. The level marker is absolute at the lower-right. The unaffordable or capped class sets 0.3 opacity and an automatic cursor; affordable Money/Gem/Planet Coin cards use the light backgrounds `#fbfdff`, `#9be5f2`, and `#9596f2`. The dark theme changes those card colors to `#4d4d4d`, `#005177`, and `#2733a3`, with the source hover colors retained in `Themes/dark.css`. The hover detail panel aligns its text and modifier instructions across the width. A pinned source differential covers zero and exact-price states for one card in each resource family plus Money immediately below price, comparing card/detail styles, card interior and detail pixels, and purchase/no-op outcomes in both themes. It also covers delayed Shift/Control hint refresh after keymap changes.

The all-card differential uses a source-shaped level-zero save with `1e100` of each resource. At 1440x900 in both themes, it visits all 8 Money, 7 Gem, and 7 Planet Coin cards, compares their source order, level text, image, affordability class, computed presentation and geometry, captures exact resting-card PNGs, and compares every hovered detail panel at zero differing pixels. This is a catalog presentation state, not exhaustive affordability coverage: other resource balances, card levels, cap/overshoot states, full-screen card-specific states, and all modifier/card combinations remain separately tracked.

All three exact-price affordability states have full-viewport source/Beyond
comparisons at 1366x768 in light and dark themes. The isolated
`matches exact-price shop screens at 1366x768` test in
`tests/e2e/upgrade-affordability-differential.spec.ts` passed 2/2 themes and
compared six PNG pairs with zero differing pixels on Windows Chromium. Linux
evidence for these alternate-viewport captures remains open.

The source `Scripts/Components/upgrade.js` handles a pointer click on its `div`: Control takes precedence and invokes `buy100`; otherwise Shift invokes `buy10`; otherwise it invokes one exact-price `buy`. Hover sets and clears `highlightedUpgrade`, where the detail panel shows the name, description, effect string, current price, and both shortcut instructions. The source card has no keyboard activation; the Beyond component preserves that input boundary during parity. Vitest compares all captured Money/Gem/Planet Coin display strings, and Playwright checks the initial cards/details plus single, Shift, and Ctrl purchase paths. The selected tabs now have full-screen paired comparisons in the visual-baseline set below; other upgrade states remain open.

`upgrade-all-caps-differential.spec.ts` compares every finite Money, Gem, and Planet Coin card and hover detail at cap-1/cap/cap+1. It also compares stabilized full-screen screenshots at the first finite cap in each group (Money Blacksmith Bonus 10, Gem Blacksmith Skill 50, and Planet Coin Active Power 10), in both themes. The focused slow test passed 2/2 on 2026-11-08. These six screens are selected cap states; broader shop balances and screen combinations remain open.

`upgrade-affordability-differential.spec.ts` compares zero, one-cent-below, and exact-price balances for each resource group in both themes (18 full-screen pairs), plus all three shop tabs at levels 0 and 1 in both themes (12 pairs). Each full-screen pair reloads the same controlled save on one Page and captures Beyond and Remix sequentially, with exact hashes and no masking. The 2026-10-04 focused file passed 6/6 and its full E2E run passed 150/150. A 2026-10-05 full-file revalidation passed 4/6 tests and 28/30 full-screen pairs. At that revalidation, the observed differences were the light Planet Coin exact-price corner pixel (697,152; Beyond RGB 17, Remix RGB 19) and five top-left card corners in the dark all-affordable level-1 catalog (Beyond RGB 3, Remix RGB 4 at y=152). A later targeted dark level-1 rerun reproduced the five pixels on the Gem full-screen pair at x=810, 923, 1036, 1149, and 1262, y=152, so the corner mismatch was not specific to the Planet Coin content. The dark exact-price case has also alternated between exact matches and a one-pixel difference across runs. Source state, card geometry, border, and radius match; all assertions remain strict. The affected shop and desktop UI areas stay In progress; other shop states remain open.

**Targeted existing-state rerun (2026-11-03):** the slow E2E for the dark,
all-affordable level-one catalog passed 1/1 in 29.3 seconds. It compared all
three resource tabs, all 22 cards and details, and their complete 1440x900
screens against pinned Remix with exact hashes. The previously recorded dark
corner differences were not reproduced. This does not resolve the intermittent
exact-price result or make the shop state-space exhaustive; the shop and desktop
UI rows remain In Progress.

**Affordability boundary rerun (2026-11-03):** the existing slow E2E passed
1/1 in each theme (1.7 minutes each). It compares the zero,
immediately-below-price, and exact-price states for Money, Gems, and Planet
Coins as full-screen 1440x900 images against pinned Remix with exact hashes.
The prior intermittent exact-price mismatch remains unexplained; keep shop and
desktop UI In Progress.

**Complete Chromium rerun (2026-10-05):** the 164-test suite passed 162/164.
The two failures were the dark Planet Coin exact-price screenshot (one corner
pixel at `(697,152)`, Beyond RGB 3 and Remix RGB 4) and the light all-affordable
level-1 Gem catalog (five top-left corners at y=152, Beyond RGB 17 and Remix
RGB 19 at x=810, 923, 1036, 1149, and 1262). The light affordability test and
dark level-1 catalog passed on this run. Which shop state shows the same
rounded-corner delta varies across repeated runs; no tolerance or mask is used.

**Capture stability follow-up (2026-11-03):** the saved dark Gem level-one pair
differs at exactly `(697,152)` and `(697,276)`, with Beyond RGB 3 and Remix RGB
4 at each pixel. They are rounded-border pixels on the first card in each row;
all seven card rectangles and their border, radius, background, and opacity
match. A viewport screenshot path and an added two-animation-frame plus 100 ms
settle did not remove the discrepancy: three reruns with the settle passed
twice and failed once. The extra wait was removed; comparisons remain exact and
the shop remains In Progress.

**Dark Planet Coin level-two pixel reproduction (2026-11-08):** the focused
slow differential now reproduces one full-screen pixel difference at
`(810,152)` in the 1440x900 dark Planet Coin catalog: Beyond is RGB `(4,4,4)`
and pinned Remix is `(3,3,3)`. All 22 card/detail comparisons pass. The seven
card boxes and all computed styles on the cards and corresponding ancestors
match exactly; both pages report device-pixel ratio 1. The saved source-paired
screenshots and state JSON are attached to the failed test. No source-backed
CSS difference explains the raster delta, so the strict comparison remains
open without a tolerance or mask.

**Dark exact-price rerun (2026-11-08):** the separate slow affordability E2E
reproduced a one-pixel full-viewport delta for the exact-price Planet Coin
Active Power state at `(697,152)` in pinned Chromium 153.0.8010.12, Windows,
1440x900. Remix is RGB `(4,4,4)` and Beyond is `(3,3,3)`. The isolated card
and detail crops matched; the full viewport differed at this one rounded
corner. All computed card properties, card geometry, and matched `body`/`html`
styles are equal. The screenshot pair and state diagnostics were retained in
the Playwright failure output. This reproduces the existing strict visual
gap but does not identify a source-backed CSS discrepancy.

The web route's `main` container has no source-specific CSS declaration in
the pinned `main.css`; scrolling is controlled by `body { overflow-y: hidden; }`
and the source's nested screen scrollers. Beyond previously added
`min-height: 0` and `overflow: hidden` to `main`. Those extra declarations are
removed to match the source cascade. The selected Windows priority visual suite
passed 38/38 after the correction. This did not remove the separate five-pixel
dark level-1 Planet Coin catalog corner difference, which remains an open
strict visual comparison in the [trace map](parity-traceability/web-presentation-and-scope.md).

## Powers and Wisdom upgrades

The Powers footer tab appears at `highestMineObjectLevel >= 170`, between Mining and Story. The panel order is the Wisdom balance and introduction, the five-row Power table, then seven Wisdom upgrade cards. Preserve source labels and icon order, including `Craftsmenship` and `Exquisity`. Rows 0–3 can show a `Prestige` action or a `Req. x1,000` label; row 4 has no action cell. The target and disabled state follow `powersTableSemantics` and [the gameplay systems record](game-systems.md).

The standalone Wisdom cards use the pinned source order and level/effect/price labels. Clicking buys one, Shift buys ten, and Control buys one hundred, with Control precedence. Beyond currently renders the table and cards, dispatches prestige and purchase transitions, and places the tab in source order. The focused E2E verifies the unlock boundary, labels, icon, cards, purchase, and prestige. `PowersPanel.svelte` reproduces source-derived layout and dark table-border color. On Windows, `tests/e2e/powers-prestige-differential.spec.ts` compares complete 1440x900 source/Beyond screenshots before prestige, with the legacy stale table after prestige, and after table remount in both themes; the exact-effect disabled Prestige state is compared at 1366x768 and 1920x1080 in both themes; the new 1920x1080 source/Beyond full-screen pair passed exactly in both themes. Linux asserts source-paired rows and button state because of the known Wisdom-description antialiasing difference. Source-captured row states compare the hidden `current=999,next=1` requirement label, disabled `current=1000,next=1` action, `current=100,next=2` next-Power visibility, exact-effect `current=1e6,next=31.622776601683796`, the 1,001 all-row state, and mixed high balances in both themes. Other balances, prestige inputs, and unselected viewports remain open.

## Priority screen visual baselines

The pinned source and Beyond now have paired full-screen captures for the upgrade shop, Powers, and representative Mining states at 1440x900 in both themes. The upgrade screenshots use the controlled Space phase-start save (object 124) and cover Money, Gem, and Planet Coin tabs. Mining screenshots cover Space/object 124, Wisdom and stars/object 169, and the first galaxy objective/object 198. These are controlled phase-state captures; they do not certify natural progression to those saves.

Powers uses the captured Wisdom/stars phase save with the current object left at 169 and `highestMineObjectLevel` set to 170 so the source tab unlocks. The source refreshes Story at that boundary before the save is recorded. The source/Beyond prestige differential also replays the corpus scenarios `power-row-hidden-below-current-threshold` (`999,1,1,1,1`), `power-row-visible-at-current-threshold` (`1000,1,1,1,1`), `button-shows-from-next-power-above-one` (`100,2,1,1,1`), and `prestige-effect-above-threshold` (`1001,1001,1001,1001,1`) as separate full-table visual states. The `current=100,next=2` screen confirms that the next-Power condition independently reveals the action below 1,000. These explicitly controlled UI fixtures are not natural routes or claims that the saves are historical player saves.

The pinned Remix's global `img.inline` rule applies to icons inside Vue child components. The first Beyond comparisons exposed that Svelte component styles scoped those icons out, making upgrade-tab icons and Wisdom icons render at intrinsic image size. The same comparison found that dark-theme standalone Wisdom buttons need the Remix `#636363` background and `#c1c1c1` text. The Beyond global selectors now reproduce those source rules; all six upgrade-tab and all six Mining state/theme pairs, plus both Powers pairs, are covered by zero-pixel screenshot assertions.

The primary Mining, Story, and Settings screens also have both-theme source/implementation pairs at 1366x768, 1920x1080, and 2560x1440. Across the two visual groups there are 32 screenshot pairs, each with a Linux pair. Their source PNGs and sidecars are under `tests/fixtures/visual/`; `remix-priority-visual-states.json` records the controlled Powers save. `pnpm reference:priority-visuals` replays the source captures against the pinned commit and hashes. Linux E2E compares these states against their `-linux` baselines.

## Settings source controls and current route coverage

The pinned `index.html` Settings panel lists every registered notation, Light/Dark buttons, the `showMineObjLevel` and `showMinCraftDamage` checkboxes, manual Save, Export, Import (from Text Field), Hard Reset, a warning, and a textarea. The source defaults are captured in `initialState.settings`; the same fixture records all 40 notation names in order. Selecting a notation updates both `game.numberFormatter` and `settings.numberFormatterIndex`. The checkboxes directly update their settings fields. The first checkbox shows the one-based mine object number. The second calls `functions.getMinCraftDamage()`, which evaluates `Pickaxe.craft(functions.getUsedGems(), true, 0).getDamage()`; the pinned fresh-state result is 18.

The theme buttons call `setTheme(theme)` and then `saveGame()`. `setTheme` changes `#css_theme` to `Themes/<theme>.css` and sets `settings.theme`. `saveGame` sets `lastActive`, writes `IdleMine`, then logs `Game Saved!`. The animation loop also saves when `game.timer.save > 60`, so notation and checkbox edits are eventually saved even though their controls do not call `saveGame()` directly. These source observations come from `index.html`, `Scripts/Define/functions.js`, `Scripts/Define/game.js`, and `Scripts/main.js` in the pinned checkout.

`SettingsPanel.svelte` provides the notation, theme, checkbox, Save, Export, Import, Hard Reset, and save-text controls. Save writes the Beyond v1 state and confirms only after storage succeeds. Export encodes a loader-compatible projection with the pinned `encodeURIComponent` → `escape` → `btoa` order, changes the textarea, and does not save. Import runs the legacy decoder and field loader, including offline processing, then stores the resulting Beyond state while preserving the source event order. The loader intentionally ignores imported `settings.tab`, so the current tab remains selected. The export is currently a projection of fields consumed by the loader, not a byte- or shape-identical serialization of the full Remix `game` object; save-export parity remains partial. The minimum-damage display uses the source crafting calculation and compares its fresh value with the captured 18.

Hard Reset asks for three confirmations, then clears every origin-local storage key, restores the source initial state, and leaves storage empty until a later autosave. It retains the current Settings tab, upgrade subtab, export text, and loop timers; the theme and preference checkboxes return to their initial values. The route clears its visible message log and applies the reset light theme. Vitest compares the pinned prompt/cancel/reset captures and session boundary; Playwright accepts all three dialogs and verifies storage clearing and the visible retained/reset fields. Fresh Settings matches the source in both themes at 1440x900, and the primary Settings screen matches in both themes at 1366x768, 1920x1080, and 2560x1440. A source-paired E2E compares the combined changed-notation and checked-preference state after manual Save and Export in both dark and light themes at 1440x900, including exact exported text; the exported light and dark states also match at 1366x768. Other Settings states remain open.

The Beyond-only recovery screen is separate from Remix's Settings controls. It can download and display the three raw browser save slots without mutating them, then requires the user to acknowledge keeping that copy before enabling a pasted legacy Remix save import. The session validates and persists that save through the normal migration coordinator; invalid input leaves storage unchanged, and unsupported future Beyond versions remain protected. This is a project-defined recovery path, not a legacy screen or claimed Remix behavior. Playwright verifies the downloaded bundle contents, original values before import, recovered v1 state, and retained legacy key; visual certification of the recovery screen remains open.

Remix's Settings page also includes attribution for Crovie and AD Notations and fixed links to its YouTube, website, and wiki. Beyond preserves that text and link order, and now uses the three PNGs from the pinned `Images/social/` directory. Their SHA-256 values are in the asset manifest; the adjacent Remix license and inherited-art caveat still apply.

Remix's global button style uses a `#cfcfcf` background, no border, and `110%` font size; Settings uses `0.5em` margins. In dark mode, the source cascade sets Settings buttons, the notation selector, and the save textarea to `#636363` with `#c1c1c1` text. The heading uses the global Montserrat family and zero margin. Fresh and changed-preference states are checked by source-paired screenshot tests.

After a successful import while Settings is mounted, Remix updates its internal number formatter but leaves the uncontrolled Number Format `<select>` at `selectedIndex = -1`. Re-entering Settings runs the existing 50 ms `changeTab` refresh and selects the saved formatter index. Beyond preserves both visible states while retaining the imported formatter index in app state. `tests/e2e/legacy-save-historical-shape.spec.ts` checks the live source and Beyond selector values, exact full-screen pixels immediately after import, and the restored index after leaving and re-entering Settings. This evidence covers the synthetic historical-shaped fixture only.

## Fresh Settings full-screen baseline

The tracked [light](../../tests/fixtures/visual/settings-fresh-light-1440x900.png) and [dark](../../tests/fixtures/visual/settings-fresh-dark-1440x900.png) screenshots compare a fresh Settings screen at 1440x900. Their sidecars pin source commit, Chromium 153.0.8010.12, Playwright 1.63.0, fixed time, theme, and a one-count Story notification. The read-only source capture sets that notification in memory to match the Beyond route after its first simulated idle frame; it does not persist a source save. `tests/e2e/settings-visual.spec.ts` compares both screens at zero differing pixels and directly compares the full screen after changing the notation, checking both preferences, switching to dark, saving, and exporting, then switching to light and repeating Save and Export. Both full-screen states and exported field contents match the pinned runtime. Other Settings states, viewports, and save-text contents remain open.

## Mine-object source renderer

At the pinned revision, `Scripts/Components/mine-object.js` renders a 256×224 canvas. It visits `colors` in reverse index order, skips the literal `transparent`, and calls `drawStone` for each remaining layer. `Scripts/main.js` implements `drawStone` by clearing a shared 256×224 cache with `copy`, drawing the `(256 × layer, 256 × skin, 256, 224)` atlas crop, multiplying it by the layer color, masking with the same crop using `destination-in`, then compositing the cache canvas onto the object canvas. The original atlas is `Images/stone_new.png`. Source CSS gives `.mine-object` a 6em height and 200ms filter/transform transitions, and applies brightness 0.75 and scale 0.925 while an enabled canvas is active.

`apps/web/src/lib/MineObjectCanvas.svelte` adapts that drawing sequence and the source class/interaction styling. The dedicated browser harness compares 48 Story preview occurrences over 47 unique levels to raw RGBA baselines captured from the pinned runtime at 1440×900. In Playwright's pinned Chromium 153.0.8010.12, all 48 occurrences have identical pixel hashes on Windows 11 and Ubuntu 24.04. The earlier result of 36 exact hashes and 12 one-LSB RGB differences came from an installed Chrome 154 and does not reproduce in the pinned browser. The E2E test keeps its measured one-unit RGB tolerance, which is not an approved gameplay behavior exception; visual status remains partial because only these previews are compared, not the full UI. The asset and full Remix MIT notice are provenance-recorded in [IP provenance](ip-provenance.md).

## Interaction

The reference includes previous/next object navigation, active mining, upgrade purchases, crafting, tabs for Powers, Story, and Settings, manual save/export/import/reset, theme selection, number-format selection, and modified bulk purchases/crafting. `functions.logMessage()` puts new messages at the start of the visible log. It removes one old entry before insertion when the old list already exceeds five, so the resulting log retains six messages; the route mirrors that order and limit. The crafting route displays source-formatted replacement/dud/insufficient-Gem feedback and persists each replacement in order. Upgrade input and hover behavior are recorded in the source-backed upgrade panel section and [upgrade system record](upgrades.md). Settings, Hard Reset, a focused Powers flow including prestige save/reload, Story page/scroll save-reload plus the debt alert/log flow, a live mining-triggered Story notification, and a controlled pickaxe craft have browser coverage. Broader non-Story control paths, Shift bulk crafting UI, and full visual parity for the other game screens remain open.

## Craft control source styles and visual capture

The source `.craft-pickaxe` row is a centered flex row with a `1rem` top margin. Its three buttons have `0 1rem` margins. The selector arrows use transparent backgrounds and a `3.75rem` minimum width; arrow images are `3rem` tall and scale horizontally on hover/press. The pinned runtime capture at 1440x900 measures the row at 738x55 pixels, each selector button at 60x55, and each unhovered arrow image at 48x48.

`tests/fixtures/visual/craft-selector-light-1440x900.png` captures the source crop with Money/Gem Gem Waster levels 1/2 and selected level 1. The pinned Chromium 153 comparison found identical Beyond/source geometry and an exact screenshot hash match after moving the pointer away from the controls. `tests/e2e/remix-app.spec.ts` enforces zero-difference Playwright screenshot parity for this crop. By itself, this crop does not certify the surrounding Mining page, other viewports, or full-screen visual parity.

The [full Mining captures](../../tests/fixtures/visual/craft-mining-panel-light-1440x900.png) use the same controlled legacy save that the Beyond route imports: Clay at object level 3, 1,000 Gems, Money and Gem Gem Waster levels 1/2, selected Gem cost 3, and minimum-craft damage hidden. The read-only source capture reloads `saveApplicationSemantics.inputJson`, applies those same overrides, then captures both light and dark themes at 1440x900. The matching Playwright screenshots have pinned Windows and Linux captures. `tests/e2e/pickaxe-crafting-visual.spec.ts` now also compares the full source and Beyond Mining screen before crafting at 1366x768 after selecting Gem cost 3; light and dark screenshots match exactly on Windows (2/2). The Linux result for this new dynamic comparison awaits CI. The same test now compares the full screen with Gem cost 10 and cost 35, in both themes at 1440x900 and 1366x768; all eight Windows Chromium cases match exactly, with increase enabled at 10 and disabled at 35. The four craft outcomes (replacement, equal-damage dud, weaker-damage dud, and insufficient Gems) also match source at 1920x1080 in both themes (eight comparisons). Other full-panel states and viewports remain open.

## Post-award drop screenshots

The pinned source and Beyond now have full-screen 1440x900 screenshots for the
Planet Coin award from object 90 and the Wisdom award from object 169, in both
themes. `tests/e2e/mine-object-drops.spec.ts` restores a save derived from the
same legacy input, uses the captured two-draw RNG sequence, performs a real
Mining click, and compares the resulting screen at zero differing pixels.
Before its click, the source capture waits one main-loop frame; Remix refreshes
Story notifications on every frame, so this matches the initialized state that
the Beyond route displays before interaction. The four Windows pairs pass. Linux
continues to assert the live award and RNG results but has no pixel captures for
these states. This limited result does not certify every drop kind or mine
rendering combination.

## Planet Coin shop visibility boundary

Pinned `index.html` gates both the Planet Coin header amount and the third
upgrade tab on `highestMineObjectLevel >= 90`. The controlled states at 89 and
90 are captured at 1440x900 in light and dark themes. `priority-visual.spec.ts`
asserts the tab is absent at 89 and present at 90, checks the source object name
and zero-damage style, then compares the full Beyond screen with the pinned
capture at zero differing pixels on Windows. Linux keeps the visibility
assertions without screenshot baselines.

This comparison also caught a source-derived dark-theme color rule: zero-damage
labels use `#a90500` in the main stylesheet and `#ff6c68` in
`Themes/dark.css`. Beyond now applies the dark override under
`body[data-theme="dark"]`; the E2E checks the computed color in both themes.
The four source pairs are `remix-planetcoin-shop-gate-{89,90}-{light,dark}-1440x900.png`.

## Viewports and states

Future screenshot baselines should include 1366×768, 1440×900, 1920×1080, and 2560×1440, with light and dark themes. Cover initial state, gems, Planet Coin upgrades, Wisdom, story, settings, large values, long generated names, and disabled controls. Save fixtures or deterministic state injection should drive each capture.

## Mobile

No authoritative modern mobile Remix layout has been identified. During compatibility, preserve the same systems, content, state, UI hierarchy, and visual identity. A dedicated ergonomic mobile redesign is post-parity unless recorded as an accepted exception.

## Visual improvement ideas

Do not add generic dashboard patterns, glass effects, decorative gradients, oversized rounded cards, or unrelated visual language during parity. Accessibility improvements must be evaluated for whether they change observable interaction or layout and recorded accordingly.
