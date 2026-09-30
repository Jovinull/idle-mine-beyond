# UI, themes, and interaction behavior

## Visual authority

The desktop Remix UI is the initial visual oracle. Before changing Beyond UI during parity, inspect the pinned index.html, main.css, theme CSS, assets, fonts, and live reference. Use actual screenshots and computed styles where useful. Never infer a redesign from the age of the original.

## Source-observed structure

The reference UI includes Money, Gems, conditional Planet Coins, object name and stats, pickaxe name/P/Q/damage, damage-per-click and per-second stats, money/gem/Planet Coin rates, upgrades, crafting, story, and settings. The CSS uses an 8vh / 84vh / 8vh page grid and a 45vw main split. These values are source observations, not a claim that all responsive states have been captured.

The default appearance is a light, sparse browser game. The source includes Work Sans and Montserrat font files and a separate dark theme. Preserve original spacing, color groupings, hierarchy, and native-feeling controls as they are verified.

## Story source styles

At the pinned Remix source revision, `main.css` gives `article.story` `1rem` padding and `z-index: -1`. Its `.story-milestones` scroller uses vertical scrolling, `overscroll-behavior: contain`, and `height: 62vh`. The objective has a top border of `1px solid rgba(0, 0, 0, 0.4)`, zero margin, and `0.5rem` top padding. Each direct milestone child has `1rem 0` padding and the same bottom border, except the last child. Images inside the article are `6em` high.

The chapter control is a full-width flex row, spaced between its children, vertically centered, `4rem` tall, and has a matching bottom border. Its heading is `2rem`; its buttons and images are forced to `3rem` square. Quotes use a flex row with centered alignment and `0.5rem 0` margin. Quote text has `2rem` left margin, `3rem` font size, `#404040` color, italic styling, and the source-declared `"Times new Roman", serif` family. The dark theme overrides that quote text color to `#c1c1c1`.

These declarations come from the pinned source (`main.css`, lines 408–468; `Themes/dark.css`, line 22 onward). A controlled Chromium runtime snapshot now confirms the light-theme computed styles at 1440×900: the scroller is 558px high, the article retains `z-index: -1`, the chapter heading is 32px, and the quote text is 48px italic Times New Roman with a 32px left margin. This establishes those values for the captured state and browser; it does not establish every viewport or theme, or a Beyond comparison. Do not “correct” the unusual negative `z-index` by intuition. The Story markup and runtime captures are described in [the Story system record](story.md); source captures are not approved Beyond visual baselines.

`apps/web/src/lib/StoryPanel.svelte` uses the captured source article markup, milestone conditions, objective text, page controls, six narrative icons plus two chapter arrows, and source-derived Story CSS. The Svelte route now connects this panel to the game Story tab and source tab-transition behavior. Work Sans and Montserrat WOFF2s are under `apps/web/static/fonts/`. The browser smoke checks both the standalone component and fresh in-app Story navigation, but does not certify the complete screen. No Beyond screenshot has been certified against the source; full theme and viewport comparisons remain open.

## Upgrade shop source styles and interaction

The default source shop shows Money upgrade cards in `Scripts/Define/game.js` order. Gem cards become visible at `highestMineObjectLevel >= 61`; Planet Coin cards become visible at `>= 90`. The captured presentation fixture records all 29 definitions, their exact labels/descriptions/icons/resource IDs/caps, and source level/effect/price display strings at every formula sample. `UpgradePanel.svelte` renders the 8 Money, 7 Gem, and 7 Planet Coin cards in source order and displays current/next details on pointer hover.

Pinned `main.css` styles `.upgrade` as an inline-block with 3% margins, `0.4em` padding plus `1.05em` bottom padding, a 2px black border, 3px radius, 75% font size, and a 4em icon. The level marker is absolute at the lower-right. The unaffordable or capped class sets 0.3 opacity and an automatic cursor; affordable Money/Gem/Planet Coin cards use the light backgrounds `#fbfdff`, `#9be5f2`, and `#9596f2`. The dark theme changes those card colors to `#4d4d4d`, `#005177`, and `#2733a3`, with the source hover colors retained in `Themes/dark.css`. The hover detail panel aligns its text and modifier instructions across the width.

The source `Scripts/Components/upgrade.js` handles a pointer click on its `div`: Control takes precedence and invokes `buy100`; otherwise Shift invokes `buy10`; otherwise it invokes one exact-price `buy`. Hover sets and clears `highlightedUpgrade`, where the detail panel shows the name, description, effect string, current price, and both shortcut instructions. The source card has no keyboard activation; the Beyond component preserves that input boundary during parity. Vitest compares all captured Money/Gem/Planet Coin display strings, and Playwright checks the initial cards/details plus single, Shift, and Ctrl purchase paths. This work is interaction evidence, not full-screen visual certification.

## Powers and Wisdom upgrades

The Powers footer tab appears at `highestMineObjectLevel >= 170`, between Mining and Story. The panel order is the Wisdom balance and introduction, the five-row Power table, then seven Wisdom upgrade cards. Preserve source labels and icon order, including `Craftsmenship` and `Exquisity`. Rows 0–3 can show a `Prestige` action or a `Req. x1,000` label; row 4 has no action cell. The target and disabled state follow `powersTableSemantics` and [the gameplay systems record](game-systems.md).

The standalone Wisdom cards use the pinned source order and level/effect/price labels. Clicking buys one, Shift buys ten, and Control buys one hundred, with Control precedence. Beyond currently renders the table and cards, dispatches prestige and purchase transitions, and places the tab in source order. The focused E2E verifies the unlock boundary, labels, icon, cards, purchase, and prestige. `PowersPanel.svelte` reproduces source-derived layout and dark table-border color; full computed-style/screenshot comparison across viewports and themes is still open.

## Settings source controls and current route coverage

The pinned `index.html` Settings panel lists every registered notation, Light/Dark buttons, the `showMineObjLevel` and `showMinCraftDamage` checkboxes, manual Save, Export, Import (from Text Field), Hard Reset, a warning, and a textarea. The source defaults are captured in `initialState.settings`; the same fixture records all 40 notation names in order. Selecting a notation updates both `game.numberFormatter` and `settings.numberFormatterIndex`. The checkboxes directly update their settings fields. The first checkbox shows the one-based mine object number. The second calls `functions.getMinCraftDamage()`, which evaluates `Pickaxe.craft(functions.getUsedGems(), true, 0).getDamage()`; the pinned fresh-state result is 18.

The theme buttons call `setTheme(theme)` and then `saveGame()`. `setTheme` changes `#css_theme` to `Themes/<theme>.css` and sets `settings.theme`. `saveGame` sets `lastActive`, writes `IdleMine`, then logs `Game Saved!`. The animation loop also saves when `game.timer.save > 60`, so notation and checkbox edits are eventually saved even though their controls do not call `saveGame()` directly. These source observations come from `index.html`, `Scripts/Define/functions.js`, `Scripts/Define/game.js`, and `Scripts/main.js` in the pinned checkout.

`SettingsPanel.svelte` provides the notation, theme, checkbox, Save, Export, Import, Hard Reset, and save-text controls. Save writes the Beyond v1 state and confirms only after storage succeeds. Export encodes a loader-compatible projection with the pinned `encodeURIComponent` → `escape` → `btoa` order, changes the textarea, and does not save. Import runs the legacy decoder and field loader, including offline processing, then stores the resulting Beyond state while preserving the source event order. The loader intentionally ignores imported `settings.tab`, so the current tab remains selected. The export is currently a projection of fields consumed by the loader, not a byte- or shape-identical serialization of the full Remix `game` object; save-export parity remains partial. The minimum-damage display uses the source crafting calculation and compares its fresh value with the captured 18.

Hard Reset asks for three confirmations, then clears every origin-local storage key, restores the source initial state, and leaves storage empty until a later autosave. It retains the current Settings tab, upgrade subtab, export text, and loop timers; the theme and preference checkboxes return to their initial values. The route clears its visible message log and applies the reset light theme. Vitest compares the pinned prompt/cancel/reset captures and session boundary; Playwright accepts all three dialogs and verifies storage clearing and the visible retained/reset fields. Full light/dark styling and Settings screenshots remain open.

The Beyond-only recovery screen is separate from Remix's Settings controls. It can download and display the three raw browser save slots without mutating them, then requires the user to acknowledge keeping that copy before enabling a pasted legacy Remix save import. The session validates and persists that save through the normal migration coordinator; invalid input leaves storage unchanged, and unsupported future Beyond versions remain protected. This is a project-defined recovery path, not a legacy screen or claimed Remix behavior. Playwright verifies the downloaded bundle contents, original values before import, recovered v1 state, and retained legacy key; visual certification of the recovery screen remains open.

## Mine-object source renderer

At the pinned revision, `Scripts/Components/mine-object.js` renders a 256×224 canvas. It visits `colors` in reverse index order, skips the literal `transparent`, and calls `drawStone` for each remaining layer. `Scripts/main.js` implements `drawStone` by clearing a shared 256×224 cache with `copy`, drawing the `(256 × layer, 256 × skin, 256, 224)` atlas crop, multiplying it by the layer color, masking with the same crop using `destination-in`, then compositing the cache canvas onto the object canvas. The original atlas is `Images/stone_new.png`. Source CSS gives `.mine-object` a 6em height and 200ms filter/transform transitions, and applies brightness 0.75 and scale 0.925 while an enabled canvas is active.

`apps/web/src/lib/MineObjectCanvas.svelte` adapts that drawing sequence and the source class/interaction styling. The dedicated browser harness compares 48 Story preview occurrences over 47 unique levels to raw RGBA baselines captured from the pinned runtime at 1440×900. In Playwright's pinned Chromium 153.0.8010.12, all 48 occurrences have identical pixel hashes on Windows 11 and Ubuntu 24.04. The earlier result of 36 exact hashes and 12 one-LSB RGB differences came from an installed Chrome 154 and does not reproduce in the pinned browser. The E2E test keeps its measured one-unit RGB tolerance, which is not an approved gameplay behavior exception; visual status remains partial because only these previews are compared, not the full UI. The asset and full Remix MIT notice are provenance-recorded in [IP provenance](ip-provenance.md).

## Interaction

The reference includes previous/next object navigation, active mining, upgrade purchases, crafting, tabs for Powers, Story, and Settings, manual save/export/import/reset, theme selection, number-format selection, and modified bulk purchases/crafting. `functions.logMessage()` puts new messages at the start of the visible log. It removes one old entry before insertion when the old list already exceeds five, so the resulting log retains six messages; the route mirrors that order and limit. The crafting route displays source-formatted replacement/dud/insufficient-Gem feedback and persists each replacement in order. Upgrade input and hover behavior are recorded in the source-backed upgrade panel section and [upgrade system record](upgrades.md). Settings, Hard Reset, a focused Powers flow including prestige save/reload, Story page/scroll save-reload plus the debt alert/log flow, and a controlled pickaxe craft have browser coverage; broader control interactions, Shift bulk crafting UI, live progression-driven Story notifications, and full visual comparisons remain open.

## Craft control source styles and visual capture

The source `.craft-pickaxe` row is a centered flex row with a `1rem` top margin. Its three buttons have `0 1rem` margins. The selector arrows use transparent backgrounds and a `3.75rem` minimum width; arrow images are `3rem` tall and scale horizontally on hover/press. The pinned runtime capture at 1440x900 measures the row at 738x55 pixels, each selector button at 60x55, and each unhovered arrow image at 48x48.

`tests/fixtures/visual/craft-selector-light-1440x900.png` captures the source crop with Money/Gem Gem Waster levels 1/2 and selected level 1. The pinned Chromium 153 comparison found identical Beyond/source geometry and an exact screenshot hash match after moving the pointer away from the controls. `tests/e2e/remix-app.spec.ts` enforces zero-difference Playwright screenshot parity for this crop. This does not certify the surrounding Mining page, dark theme, other viewports, or full-screen visual parity.

## Viewports and states

Future screenshot baselines should include 1366×768, 1440×900, 1920×1080, and 2560×1440, with light and dark themes. Cover initial state, gems, Planet Coin upgrades, Wisdom, story, settings, large values, long generated names, and disabled controls. Save fixtures or deterministic state injection should drive each capture.

## Mobile

No authoritative modern mobile Remix layout has been identified. During compatibility, preserve the same systems, content, state, UI hierarchy, and visual identity. A dedicated ergonomic mobile redesign is post-parity unless recorded as an accepted exception.

## Visual improvement ideas

Do not add generic dashboard patterns, glass effects, decorative gradients, oversized rounded cards, or unrelated visual language during parity. Accessibility improvements must be evaluated for whether they change observable interaction or layout and recorded accordingly.
