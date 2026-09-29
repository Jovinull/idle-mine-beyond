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

`apps/web/src/lib/StoryPanel.svelte` is an isolated source-template renderer, not yet the app's Story tab. It uses the captured source article markup, milestone conditions, objective text, page controls, six narrative icons plus two chapter arrows, and source-derived Story CSS. The copied icon files are under `apps/web/static/Images/`; Work Sans and Montserrat WOFF2s are under `apps/web/static/fonts/`. Their upstream revisions, hashes, and license notices are recorded in [IP provenance](ip-provenance.md). The browser smoke mounts the component at test-only routes and compares headings, text, block order, navigation, selected computed styles, image references, and Canvas levels against the captured fresh/all-unlocked runtime. This is structural and rendering smoke coverage; no Beyond screenshot has been certified against the source, and dark-theme styling, tab integration, live Story persistence, and additional viewport captures remain open.

## Mine-object source renderer

At the pinned revision, `Scripts/Components/mine-object.js` renders a 256×224 canvas. It visits `colors` in reverse index order, skips the literal `transparent`, and calls `drawStone` for each remaining layer. `Scripts/main.js` implements `drawStone` by clearing a shared 256×224 cache with `copy`, drawing the `(256 × layer, 256 × skin, 256, 224)` atlas crop, multiplying it by the layer color, masking with the same crop using `destination-in`, then compositing the cache canvas onto the object canvas. The original atlas is `Images/stone_new.png`. Source CSS gives `.mine-object` a 6em height and 200ms filter/transform transitions, and applies brightness 0.75 and scale 0.925 while an enabled canvas is active.

`apps/web/src/lib/MineObjectCanvas.svelte` adapts that drawing sequence and the source class/interaction styling. The dedicated browser harness compares 48 Story preview occurrences over 47 unique levels to raw RGBA baselines captured from the pinned runtime at 1440×900. In Playwright's pinned Chromium 153.0.8010.12, all 48 occurrences have identical pixel hashes on Windows 11 and Ubuntu 24.04. The earlier result of 36 exact hashes and 12 one-LSB RGB differences came from an installed Chrome 154 and does not reproduce in the pinned browser. The E2E test keeps its measured one-unit RGB tolerance, which is not an approved gameplay behavior exception; visual status remains partial because only these previews are compared, not the full UI. The asset and full Remix MIT notice are provenance-recorded in [IP provenance](ip-provenance.md).

## Interaction

The reference includes previous/next object navigation, active mining, upgrade purchases, crafting, tabs for story and settings, manual save/export/import, theme selection, number format selection, and Shift-modified bulk crafting. Index content also advertises modifier keys for bulk upgrades. Capture exact keyboard behavior and focus/disabled states from source and runtime before porting.

## Viewports and states

Future screenshot baselines should include 1366×768, 1440×900, 1920×1080, and 2560×1440, with light and dark themes. Cover initial state, gems, Planet Coin upgrades, Wisdom, story, settings, large values, long generated names, and disabled controls. Save fixtures or deterministic state injection should drive each capture.

## Mobile

No authoritative modern mobile Remix layout has been identified. During compatibility, preserve the same systems, content, state, UI hierarchy, and visual identity. A dedicated ergonomic mobile redesign is post-parity unless recorded as an accepted exception.

## Visual improvement ideas

Do not add generic dashboard patterns, glass effects, decorative gradients, oversized rounded cards, or unrelated visual language during parity. Accessibility improvements must be evaluated for whether they change observable interaction or layout and recorded accordingly.
