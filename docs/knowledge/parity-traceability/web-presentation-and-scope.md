# Trace map — web presentation and scope

## Visual slice

The matrix's visual summary row groups the following state-specific maps.
It adds no independent coverage claim; its remaining scope is the union of the
gaps below.

### Visual summary function and branch trace

| Matrix roll-up branch                                                                                                                | Source evidence                                                            | Beyond assertion                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shop visual state: Money/Gem/Planet Coin group, light/dark, canonical 1440×900                                                       | pinned priority visual state records                                       | `tests/e2e/priority-visual.spec.ts` compares each source screenshot pair; `tests/parity/visual-baselines.test.ts` validates screenshot hashes and metadata                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Shop modifier-hint full screens: first card in each resource group; Shift, Control, and both keys, light/dark, 1440×900 and 1366×768 | `index.html:85-86` and pinned key-map/hover refresh behavior               | `tests/e2e/upgrade-modifier-visual-differential.spec.ts` checks active hint classes and compares all 36 source/Beyond full-screen pairs across both viewports                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Powers visual state: Wisdom/Stars unlock view, light/dark, canonical 1440×900                                                        | pinned Powers priority visual state records                                | `tests/e2e/priority-visual.spec.ts` compares the screenshot pair; `tests/parity/visual-baselines.test.ts` validates its pinned source assets                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Natural Story route-end screens: Chapters 3-6, both themes, 1366x768/1440x900/1920x1080/2560x1440                                    | pinned `remix-story-runtime.json` route-end saves with controlled theme    | `tests/e2e/story-natural-chapters-differential.spec.ts` compares live pinned Remix and Beyond pixels; Windows passed 4 routes × 4 viewports per theme; Ubuntu CI run 42484538684 passed both themes at 1440x900; runs 42489378984 and 42490501482 both reproduce two differing pixels at (15,632)/(15,633) on the first objective W at 1366x768 light; run 42492337106 reproduces the same pixels on the Chapter 4 dark objective; the first inline diagnostic was absent from the uploaded artifact, and the test now writes JSON to its output directory before attaching it; later Linux viewports remain unverified |
| Mining visual states, controlled full craft panel, and primary screens at canonical and alternate viewports                          | captured Mining phases, craft-panel state, and primary-screen viewport set | `tests/e2e/priority-visual.spec.ts` compares selected states; `tests/e2e/remix-app.spec.ts` compares the full craft panel on Windows and Linux; `tests/parity/visual-baselines.test.ts` validates screenshot metadata and hashes                                                                                                                                                                                                                                                                                                                                                                                        |
| `index.html` document-language metadata: no `lang` attribute on the root element                                                     | Pinned Remix `index.html` root element                                     | `tests/e2e/remix-app.spec.ts` compares the Beyond and pinned root `lang` attributes and computed `-webkit-locale`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

This matrix row is a roll-up, not an additional source function. The function
branches are listed in the state-specific maps below; its status is the union
of those maps.

The pinned `main.css` Work Sans `@font-face` branch declares normal style and
weight 400. The Beyond route uses that single rule for the Story renderer and
the source-paired natural Story E2E asserts `document.fonts.check` after
`document.fonts.ready` in both runtimes. CI run 42494765267 captured the
previous duplicate-face state. Run 42496892093 confirms the font state now
matches, while the pixel delta persists; the raster cause remains open. On
failure, the E2E records all computed styles, objective markup/text, regular
and bold font checks, Chromium's platform font for the objective's bold text
node, and its ancestor chain's computed CSS and geometry. Run 42503025927
shows Beyond's `.story-panel-host` between `main` and `article.story`; its
same-sized `overflow:hidden` box remains a structural difference, with no
confirmed causal link to the two-pixel raster delta. On mismatch, the E2E also
captures diagnostic-only overflow-visible, transparent-background, combined,
and `display:contents` host variants; the production page and exact assertion
are unchanged.

## Settings and input controls

- **Remix source branches:** `Scripts/main.js:onkeydown` records keys and handles
  ArrowRight/ArrowLeft regardless of focused element; both prevent the browser
  default and request selection at current level ±1. `functions.setMineObjectLevel`
  changes the selected object only inside `[0, highestMineObjectLevel]`;
  `main.js:onkeyup` removes the released key; the source has no window-blur
  cleanup handler, so a modifier stays held until a matching keyup arrives.
  `Utils.keyPressed` tests key-map membership for Shift/Control purchase and
  craft modifiers. `functions.changeTab`
  saves Story scroll when leaving, clears notifications on entry, restores
  scroll after 30 ms, and refreshes number selection after 50 ms. Save
  import/export is routed through the Settings text field.
- **Covered:** import/export bytes and decode cases in
  `tests/e2e/save-codec.spec.ts`; settings and session behavior in
  `tests/parity/remix-web-game-session.test.ts` and
  `tests/e2e/remix-app.spec.ts`. `tests/e2e/settings-visual.spec.ts` also
  compares the source and Beyond Settings screen after changing notation,
  enabling both preferences, switching to dark, saving, and exporting, then
  returning to light and comparing manual Save and Export again. The full-screen
  changed-preference/save/export state is compared in both themes at 1440x900. The final light-theme Export state also matches at 1366x768 in the live paired comparison.
  The
  `tests/e2e/mining-preferences-visual.spec.ts` toggles both Mining display
  preferences through Settings and compares the label-present and label-absent
  Mining screens in both themes. The
  pinned `keyboardInputSemantics` fixture
  and arrow-key E2E compare right/left movement, repeats, both bounds, a focused
  text field, selection names, default prevention, and key release. The
  modifier E2E compares the source-observed held state across window blur and
  its removal on keyup, as well as Shift/Control purchase precedence.
- **Sampled:** the controlled test dispatches synthetic `isComposing` keyboard
  events with ArrowLeft/keyCode 37 and Process/keyCode 229 through the Settings
  field. It does not model physical keyboard layouts, trusted IME events, or
  actual operating-system composition. Those input environments and arbitrary
  text edits/multi-control sequences remain open UI evidence, not untested
  source branches.

### Settings/input function and branch trace

| Pinned Remix function/path and branch                                                                                                                                                                                                       | Source evidence                                                                                                             | Beyond assertion                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Scripts/main.js:onkeydown`: insert a key only if absent; ArrowRight, ArrowLeft, and an unbound key; prevent default only for either arrow                                                                                                  | `keyboardInputSemantics.scenarios` includes single/repeated arrows, bounds, focused input, and unbound `a`                  | `tests/e2e/remix-app.spec.ts` replays all scenarios and asserts default prevention and resulting object                                                                                                       |
| `Scripts/main.js:onkeydown` during composition: dispatch uses `event.key`; composing ArrowLeft still prevents default/selects, while composing Process has no arrow effect; no `isComposing`/`keyCode` guard                                | Live pinned Remix run with synthetic bubbling CompositionEvent and KeyboardEvent instances in the focused Settings textarea | `tests/e2e/remix-app.spec.ts` compares event key/keyCode/isComposing/defaultPrevented, focus, and resulting selected level against the pinned Remix runtime                                                   |
| Browser-generated repeated ArrowLeft keydowns while Settings text is focused; both events prevent cursor movement and each event selects one previous object                                                                                | Controlled source save at level 3/high-water 3; two trusted Chromium `keyboard.down` calls before keyup                     | `tests/e2e/remix-app.spec.ts` asserts trusted `repeat=false` then `repeat=true` events, unchanged text caret, and resulting Mining level 2 in Remix and Beyond                                                |
| `Scripts/Define/functions.js:setMineObjectLevel`: accept levels from 0 through high-water; ignore levels below 0 or above high-water                                                                                                        | `keyboardInputSemantics.scenarios` includes both bounds                                                                     | `tests/e2e/remix-app.spec.ts` compares displayed level and object name after each event                                                                                                                       |
| `Scripts/main.js:onkeyup`: remove the released key; source has no blur handler to clear it early                                                                                                                                            | `keyboardInputSemantics.modifierLifecycle` records Shift after keydown, blur, and keyup                                     | `tests/e2e/remix-app.spec.ts` compares modifier UI before/after blur and after keyup                                                                                                                          |
| `Scripts/Define/functions.js:changeTab`: save scroll when leaving Story; clear notifications and schedule 30 ms restoration when entering Story; refresh number selection when entering Settings (50 ms)                                    | `storyTabSemantics` captures source tab transitions and timed effects                                                       | `tests/parity/story.test.ts` and `tests/e2e/story.spec.ts` assert state/effects and live navigation                                                                                                           |
| `index.html`: `settings.showMinCraftDamage` condition includes or omits the minimum-base-damage span in the Mining craft button                                                                                                             | Fresh source save defaults the preference to false; the paired E2E toggles it on and off through Settings                   | `tests/e2e/mining-preferences-visual.spec.ts` asserts label presence/text or absence and compares complete Mining screenshots in both themes                                                                  |
| `index.html`: `settings.showMineObjLevel` condition includes or omits the selected mineral-level heading in Mining                                                                                                                          | Fresh source save defaults the preference to false; the paired E2E toggles it on and off through Settings                   | `tests/e2e/mining-preferences-visual.spec.ts` asserts label states; Windows and Linux full screens exact for all six preference/theme combinations in CI run 97                                               |
| `Scripts/Define/functions.js:exportGame`, `Scripts/Define/functions.js:getSaveString`, and `Scripts/Define/functions.js:saveGame`: serialize the current source game into the Settings field; save path updates time, localStorage, and log | `saveApplicationSemantics` and `saveExportSemantics` pin source output                                                      | `tests/e2e/save-codec.spec.ts` and `tests/e2e/remix-app.spec.ts` compare import/export and persisted state                                                                                                    |
| `index.html` Settings Light/Dark controls, `functions.js:setTheme`, `saveGame`, and `exportGame`: theme selection saves; Save updates persisted state/message; Export fills the text field                                                  | Pinned source handlers; paired runtime session replays dark then light Save/Export                                          | `tests/e2e/settings-visual.spec.ts` compares full-screen changed-preference Save and Export states in light/dark at 1440x900 and final light Export at 1366x768; saved storage and exported text are asserted |
| `Scripts/Define/functions.js:hardReset`: each confirmation returns early without changing game/storage when dismissed; three accepts clear origin storage and reload defaults                                                               | `hardResetSemantics.cancelled` covers each dismissal index; `hardResetSemantics.confirmed` covers three accepts             | `tests/parity/remix-hard-reset.test.ts` checks every source result; `tests/e2e/remix-app.spec.ts` compares each cancellation point with pinned Remix and checks confirmed reset                               |

**Trusted keyboard event differential (2026-11-07):** `tests/e2e/remix-app.spec.ts`
also pairs a real Chromium `ArrowRight` key press in the focused Settings text
field on pinned Remix and Beyond. Both events are trusted and prevented, keep
the text caret at the same position, and move the selected mine object from
level 1 to level 2. The focused test passed 1/1. Physical keyboard layouts,
IME composition, and other browser-generated key variants remain open.

**Trusted key-repeat differential (2026-11-07):** the same E2E now also pairs
two real Chromium ArrowLeft keydowns without an intervening keyup. Remix and
Beyond both receive trusted events with `repeat=false` then `repeat=true`,
prevent caret movement in the focused Settings field, and select the same
previous mine object for each keydown. The resulting level is 2 in both apps;
the focused test passed 1/1. Keyboard layouts and IME behavior remain open.

## Light and dark themes

- **Remix source branches:** `functions.setTheme` applies the selected theme;
  `main.css` supplies shared layout/colors and `Themes/dark.css` overrides the
  dark palette. Theme-specific screen content is otherwise shared.
- **Covered:** theme persistence and reload through app E2E, pinned light/dark
  Story, Mining, Settings, shop/Powers/Mining state screenshots, and source
  screenshot metadata/hash validation in `tests/e2e/story-visual.spec.ts`,
  `tests/e2e/priority-visual.spec.ts`, and
  `tests/parity/visual-baselines.test.ts`.
- **Sampled:** two themes are covered for selected states only; every
  player-visible screen/state has not been compared in both themes.

### Theme function and branch trace

| Pinned Remix function/path and branch                                                                                                                                         | Source evidence                                                                                | Beyond assertion                                                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Scripts/Define/functions.js:setTheme`: assign selected theme and replace `css_theme` stylesheet URL                                                                          | captured light/dark setting states and source stylesheet references                            | `tests/e2e/remix-app.spec.ts` loads/switches both theme states and checks persisted theme; `tests/e2e/settings-visual.spec.ts` compares changed Settings preferences in dark; `tests/e2e/priority-visual.spec.ts` compares source light/dark screenshot pairs |
| `loadGame` theme field: absent value defaults to `light`; present `dark` loads dark CSS                                                                                       | missing-settings default and dark-save cases in `saveSemantics`                                | `tests/parity/legacy-save-application.test.ts` asserts fallback/effect; `tests/e2e/remix-app.spec.ts` asserts the applied theme after load                                                                                                                    |
| `main.css` shared control styles; `Themes/dark.css:button:not(.chapter-control button)` and `textarea, select` override resting Settings controls to `#636363`                | Pinned Settings screenshots and live computed cascade after selecting dark                     | `tests/e2e/settings-visual.spec.ts` compares changed-preference, saved, and export states at zero pixels; `tests/e2e/priority-visual.spec.ts` covers selected screens/themes; visual-baseline tests verify source hashes                                      |
| `main.css:.craft-pickaxe button.level-change` transparent default versus the generic dark button rule; `Themes/dark.css:button.level-change:hover` transparent hover override | pinned source CSS cascade; full-screen shop state that exposed the dark Money level-1 mismatch | `tests/e2e/upgrade-affordability-differential.spec.ts` compares all three shop tabs at levels 0/1 in both themes, including the craft controls, against the pinned source                                                                                     |

Every theme selection/load branch is covered. Uncaptured screen/state combinations
remain visual-state gaps, not unlisted theme-control branches.

## Desktop UI and visual parity

- **Remix source branches:** `index.html` owns Vue templates, tab visibility,
  button/text bindings, and ordered script load; `main.css`, `Themes/`, and
  `Scripts/Components/` define the source appearance and interactions. The
  matching Beyond boundaries are `+page.svelte`, panels, and Canvas renderer.
- **Covered:** captured Story markup and computed style, Story progression,
  source Canvas preview goldens, selected Mining/Settings screens, upgrade
  tabs, Powers unlock boundary, focused craft interactions, and the controlled
  full craft panel are linked in
  the preceding maps, `tests/e2e/story-visual.spec.ts`,
  `tests/e2e/priority-visual.spec.ts`,
  `tests/e2e/mine-object-renderer.spec.ts`, and
  `tests/parity/visual-baselines.test.ts`.
- **Sampled:** screenshots are state-selected, not a complete UI state-space
  enumeration. Every control and every screen remains open unless its matrix
  row names a concrete source-backed assertion.

### Desktop UI function and branch trace

| Pinned Remix function/path and branch                                                                                                             | Source evidence                                                                  | Beyond assertion                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.html` top-level tab conditionals: Mining, unlocked Powers, Story, Settings; Planet Coin shop control has the source high-water gate        | pinned template and source-shaped save states at the tab boundary                | `tests/e2e/remix-app.spec.ts` asserts Mining/Story/Settings routes, Powers unlock, and PC tab absent at 89/present at 90                                                                                                                                                      |
| Source template renders shared resource/header, selected upgrade group, mine object, and Story/Settings/Powers panel by `settings.tab`            | pinned Story markup, priority visual state fixtures, and controlled source saves | `tests/e2e/remix-app.spec.ts`, `tests/e2e/story-panel.spec.ts`, and `tests/e2e/priority-visual.spec.ts` assert each in-scope panel and selected state                                                                                                                         |
| `Scripts/Components/upgrade.js` and `powers-table.js`: selected group cards, source labels, enabled/disabled controls and modifier interaction    | `upgradeSemantics`, `powersTableSemantics`, and paired 1440×900 source captures  | `tests/parity/remix-upgrade-display.test.ts`, `tests/parity/remix-powers.test.ts`, `tests/e2e/remix-app.spec.ts`, and `tests/e2e/priority-visual.spec.ts` compare source text, interaction, and screenshot states                                                             |
| `index.html:85-86`: Shift hint active only without Control; Control hint active whenever Control is held; Vue refresh comes from later card hover | `keyboardInputSemantics.modifierLifecycle` and pinned live render behavior       | `tests/e2e/remix-app.spec.ts` checks delayed refresh and stale release; `tests/e2e/upgrade-modifier-visual-differential.spec.ts` compares Shift, Control, and combined full screens for representative cards in all three groups, both themes, and both viewports             |
| `Scripts/Components/mine-object.js`: Mining click versus `nodamage` preview, zero-damage class, source Canvas availability                        | source Story template prop, `formulaSemantics`, and Canvas RGBA records          | `tests/e2e/remix-app.spec.ts` asserts preview clicks do not mine and zero active damage is marked unavailable; `tests/e2e/mine-object-renderer.spec.ts` compares preview pixels                                                                                               |
| Pinned `index.html`, `main.css`, theme CSS, and ordered source scripts compose player-visible desktop view                                        | extracted Story markup/runtime and selected source screenshots                   | `tests/parity/story-markup.test.ts`, `tests/parity/story-runtime.test.ts`, `tests/e2e/story-visual.spec.ts`, `tests/e2e/story-natural-chapters-differential.spec.ts`, and `tests/e2e/priority-visual.spec.ts` compare markup, runtime pixels, and selected full-screen states |

This is the source-to-test index for UI composition. It does not claim every
interactive state or every screenshot has been captured; those remain the
explicit visual gaps above.

## Visual slice: upgrade shop

- **Remix source branches:** `Components/upgrade.js` renders resource-specific
  price/effect/level labels, max state, affordability/disabled state, and
  modifier buttons; `Upgrade.buyN` and its caller control exact, buy-10, buy-100,
  and Shift paths.
- **Covered:** all captured Money/Gem/PC formula labels and the fresh Money card
  list in `tests/parity/remix-upgrade-display.test.ts`,
  `tests/e2e/foundation.spec.ts`, and `tests/e2e/priority-visual.spec.ts`;
  source/implementation screenshot pairs compare at 1440×900 in both themes.
  A separate 1440×900 paired Chromium differential visits all 22 cards at
  levels zero, one, and two with abundant resources in both themes, comparing source order,
  labels, image, affordability/style/geometry, exact resting-card pixels, and
  each hovered detail panel's exact pixels.
  `tests/e2e/upgrade-affordability-differential.spec.ts` also compares live
  source/Beyond Money, Gem, and Planet Coin cards at zero and exact-price
  boundaries, plus Money immediately below price, including card-interior and
  detail pixels, computed border geometry/style, affordability styling, and
  click/no-op results in both themes. After selecting each resource tab, it
  waits for the pinned theme stylesheet and compares the hovered tab's computed
  background against the live source in both themes. The observed dark source
  cascade resolves the tab hover to `#636363`; Beyond's local `#777777` override
  was corrected to match.
  `tests/e2e/upgrade-tab-state-differential.spec.ts` compares Gem and Planet
  Coin selection across Story/Mining panel remounts, visible cards, decoded
  legacy export, and the pinned fresh-load reset.
  `tests/e2e/upgrade-modifier-visual-differential.spec.ts` compares the full
  viewport at 1440×900 and 1366×768 after a hover-driven refresh for Shift,
  Control, and both keys on the first card in each resource group, in both
  themes.
- **Covered visual boundary:** the selected Space phase-start shop state has
  full-screen pairs for all three resource groups. The Planet Coin gate has
  additional full-screen pairs at high-water 89 (hidden) and 90 (visible), in
  light and dark themes. Those four source captures use
  `tests/e2e/priority-visual.spec.ts` and compare at zero pixels on Windows.
  The Gem group gate also has source/Beyond full-screen pairs at high-water 60
  (hidden) and 61 (visible), with the separate Planet Coin gate still closed;
  `tests/e2e/gem-upgrade-tab-gate-visual.spec.ts` asserts both DOM outcomes and
  exact 1440×900 screenshot hashes in light and dark themes.
- **Sampled / open visual states:** the all-card comparison is one source-shaped
  state with abundant resources at levels zero, one, and two; the affordability
  differential covers representative zero/exact-price resource cases and one
  below-price Money case. Full-screen comparisons cover each Money/Gem/Planet
  Coin tab at levels zero and one in both themes (12 paired viewports); level
  two passes full-screen in light at 1440x900 and in both themes at 1366x768.
  A focused dark level-two run confirms exact decoded-pixel equality for all 22
  cards and details; one run differed in the 1440x900 dark Planet Coins full-
  screen at `(810,152)`, Beyond RGB `(4,4,4)` versus Remix `(3,3,3)`, while a
  subsequent diagnostic rerun passed. Repeated dark 1440x900 comparisons have
  exposed intermittent one- or two-pixel rounded-card differences. These
  states remain open. A separate dark exact-price rerun on 2026-11-08
  reproduced the Planet Coin Active Power full-screen delta at `(697,152)`:
  Remix RGB `(4,4,4)`, Beyond RGB `(3,3,3)`. Card and detail crop hashes
  passed, and the full-screen images differed at only that rounded-corner
  pixel. The card and matched root computed styles were equal; the raster cause
  remains unidentified. These remain strict visual gaps, as do the Money
  below-price boundary and exact-price boundary for all three tabs in both
  themes (eight paired viewports at 1440x900). Zero-resource screens now match
  for each tab at 1440x900 and 1366x768 in both themes (12 paired screens). Other
  balances and broader application-state combinations remain open. All three
  exact-price resource screens also match at 1366×768 in both themes (six
  source/Beyond full-viewport pairs on Windows), asserted in the isolated
  `matches exact-price shop screens at 1366x768` test. Linux evidence for these
  alternate-viewport captures remains open. A dedicated
  full-screen differential covers the immediate stale labels and the refreshed
  active hints for Shift, Control, and Shift+Control on Money Active Power in
  both themes. A second differential now covers the refreshed full-screen hints
  for the first card in all three resource groups, in both themes at 1440×900
  and 1366×768. These remain selected states and do not cover all shop balances
  or screens. The all-cap differential also compares strict full-screen hashes at the
  first finite cap in each Money, Gem, and Planet Coin group (Blacksmith Bonus
  10, Blacksmith Skill 50, and Active Power 10), in both themes. These six
  selected screens match pinned Remix; all-card cap boundaries continue to
  compare card and hover-detail pixels at cap-1/cap/cap+1. Separately, the
  Gem Blacksmith Skill equality-at-cap (50) and saved over-cap (51) states now
  compare card pixels (1px inset) and full hover-detail
  pixels against pinned Remix in both themes, in addition to labels, styles,
  and click/no-op behavior. At exact Gem affordability, three repeated paired
  full-viewport captures per theme matched at zero pixels; the earlier reported
  one-level RGB differences did not reproduce. The source-paired E2E now checks
  the stabilized 1440x900 viewport hash for that state in both themes. This is
  one selected screen state; the complete shop visual state space remains open.

**Dark Planet Coin exact-price repeatability (2026-10-05):** one isolated
full-screen run failed, its immediate rerun passed, and three consecutive
repetitions then passed. The failing run's first-card and ancestor paint
diagnostics matched between Remix and Beyond; the intermittent screenshot
difference remains unexplained. Keep the exact screenshot comparison and the
shop visual row In progress.

**Focused boundary rerun (2026-10-05):** the light and dark affordability
tests each completed successfully (1/1) when the local Vite server was kept in
a separate managed session. Each test compares nine full 1440x900 source/Beyond
states across zero, immediately-below-price, and exact-price cases for Money,
Gems, and Planet Coins. The earlier exact-price rounded-border difference did
not reproduce. The level-one all-affordable catalog corner mismatch and the
unexplained intermittent exact-price result remain separate open visual
evidence; no screenshot tolerance or exception is accepted.

The dark level-one catalog was then rerun as a single source-paired E2E after
removing Beyond-only `main { min-height: 0; overflow: hidden; }` rules; the
pinned `main.css` has no `main` override. The full-screen comparison still
fails at exactly five pixels, each by one channel, on the top-left rounded
border pixels `(810,152)`, `(923,152)`, `(1036,152)`, `(1149,152)`, and
`(1262,152)`. The selected cards and their full ancestor chains have matching
geometry and computed style after the correction, so it did not resolve this
rendering delta. The 38 priority visual E2Es pass after the CSS change; the
shop visual row remains In progress.

**Earlier strict shop screenshot revalidation (2026-11-03):** the complete
seven-test `tests/e2e/upgrade-affordability-differential.spec.ts` rerun passed
4/7 tests in 12.1 minutes: light affordability, both light catalogs, and the
22-card purchase-routing test. Dark Planet Coin exact-price affordability
failed at `(697,152)`; dark Gem catalogs at levels zero and one each failed at
`(697,152)` and `(697,276)`. All differences were one channel (Beyond RGB 3,
Remix RGB 4). The failure attachments compared all computed card/image styles,
pseudo-elements, and the common app ancestor styles; the card presentation,
`body`, and `html` match between runtimes. Beyond has one extra
`display: contents` shell wrapper around `#app`, recommended by the pinned
SvelteKit runtime because direct body mounting can break some browser
extensions. A same-page A/B screenshot of the dark level-zero Gem state was
byte-identical after moving the wrapper's children under `body`; that wrapper
does not explain the pixel difference for that state. The remaining border
antialiasing delta is unexplained. Retain exact screenshots and keep the shop
visual row In Progress; no mask or tolerance is permitted.

**Latest strict shop screenshot revalidation (2026-11-03):**
`pnpm.cmd test:e2e:slow --workers=1 --retries=0` ran all nine slow tests and
passed 8/9 in 19.7 minutes. Both affordability themes, both dark catalog levels,
the level-zero light catalog, all 22 purchase routes, and both finite-cap themes
passed. The only full-suite failure was the level-one light catalog at the
Planet Coin tab. A focused rerun of that catalog failed at the Gem tab instead.
Both failures have the same five top-left corner deltas at `(810,152)`,
`(923,152)`, `(1036,152)`, `(1149,152)`, and `(1262,152)`, with Beyond RGB 17
and Remix RGB 19. The isolated failure attachment reports identical box
geometry and all 477 computed card/image properties for all seven cards; the
common ancestor boxes, computed properties, and pseudo-elements also match.
The earlier dark exact-price and level-zero/level-one Gem failures passed in
the new full run and focused dark reruns.

A fresh-load same-page A/B compared the dark level-zero Gem screen at its flow
position and at forced integer and fractional positions, with zero changed
pixels in each capture. It did not repeat the full catalog hover sequence and
does not locate the intermittent full-screen difference. Keep the strict
comparison and the desktop/shop rows In Progress; no mask or tolerance is
permitted.

**Isolated dark catalog repeat (2026-11-07):** with Vite held in a separate
managed session, the level-one dark catalog comparison first differed on the
Planet Coin full screen at `(810,152)` (Beyond RGB 3, Remix RGB 4), then passed
on immediate rerun. This confirms an intermittent rounded-corner pixel delta;
the strict full-screen comparison remains open and unchanged.

**Focused catalog follow-up (2026-11-04):**
`pnpm.cmd exec playwright test -c playwright.slow.config.ts
tests/e2e/upgrade-affordability-differential.spec.ts --project=chromium
--workers=1 --retries=0 --grep "matches shop cards, details, and full screens
against Remix at level 1 in light theme"` replayed the level-one light catalog
with the full card/detail hover sequence. Its Gem full-screen comparison again
differed at exactly `(810,152)`, `(923,152)`, `(1036,152)`, `(1149,152)`,
and `(1262,152)` (Beyond RGB 17, Remix RGB 19). The failure attachment confirms
matching card boxes and computed styles. Removing the Beyond SvelteKit
`display: contents` shell immediately before a second Beyond capture produced
the same screenshot hash as the original Beyond capture, so the wrapper does
not explain this state either. The visual difference remains unresolved and
the strict assertion remains unchanged.

**Focused shop recheck (2026-11-07):** the existing level-one catalog E2E
passed in light and dark (2/2) at 1440x900, including all three resource tabs,
card/detail interactions, and exact full-screen hashes; the previously reported
level-one corner deltas did not reproduce. The existing nine-state affordability
E2E passed in light. In dark it passed eight full-screen states and failed the
Planet Coin exact-price state at `(697,152)`, Beyond RGB `(4,4,4)` versus Remix
RGB `(3,3,3)`. The first card bounds and recorded computed styles match. A
temporary source-only display hide/restore across two frames changed the Remix
hash from `b0cf6c5a…` to `36028bc8…`; the refreshed capture retained the same
one-pixel mismatch, so this experiment did not establish a fix and was removed.
The prior reported level-one differences are not reproduced in this focused
run, but the affordability mismatch and broader unselected shop states keep
the shop and Desktop UI rows In Progress. No mask, tolerance, or exception was
added. These runs used Windows Chromium `153.0.8010.12`, DPR 1, at 1440x900.
Reproduce with `pnpm.cmd test:e2e:slow --grep "matches shop cards, details,
and full screens against Remix at level 1 in <light|dark> theme" --workers=1
--retries=0` for each theme, and `pnpm.cmd test:e2e:slow --grep "matches Remix
shop affordability boundaries in" --workers=1 --retries=0` for both affordability
themes.

**Dark level-one catalog recheck (2026-11-08):**
`pnpm exec playwright test -c playwright.slow.config.ts
tests/e2e/upgrade-affordability-differential.spec.ts --grep "level 1 in dark
theme"` passed all 22 card and detail pixel checks, then failed the Planet Coin
full-screen hash with exactly one different pixel `(810,152)`, Beyond RGB
`(4,4,4)` and Remix RGB `(3,3,3)`. The attached full-screen pair has no other
pixel differences; the card boxes and all computed card/ancestor styles match.
The pinned `main.css` and Beyond `UpgradePanel.svelte` both specify the same
2px black border and 3px radius. No source-backed rendering difference has
been established, so the exact assertion remains open without a mask/tolerance.

**Affordability mismatch attachment follow-up (2026-11-07):** a fresh dark
affordability run reproduced the Planet Coin exact-price mismatch, then an
immediate rerun passed. The default Playwright failure screenshots were taken
after the helper had navigated back to Beyond, so the two files were identical
and did not preserve the compared pair. The differential now writes and
attaches the actual source and Beyond screenshot buffers when their strict
hashes differ. No rendering change or pixel tolerance was made; the visual
mismatch remains open.

### Upgrade-shop visual function and branch trace

| Pinned Remix function/path and branch                                                                                                                  | Source evidence                                                                             | Beyond assertion                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Scripts/Components/upgrade.js`: render all Money, Gem, and Planet Coin cards in the selected group                                                    | pinned group card counts, formula labels, and source screen captures                        | `tests/e2e/priority-visual.spec.ts` asserts counts and compares source/Beyond 1440×900 screenshots in both themes                                                                    |
| `Scripts/Define/game.js:gemUpgradesUnlocked` plus `index.html` `.upg-tabs` visibility branch at `highestMineObjectLevel >= 61`                         | Pinned source predicate/template and source-shaped saves at high-water 60/61                | `tests/e2e/gem-upgrade-tab-gate-visual.spec.ts` asserts the hidden/visible group and exact full-screen source/Beyond hashes in both themes at 1440×900                               |
| `index.html`: header Planet Coin amount and shop tab appear at `highestMineObjectLevel >= 90`                                                          | Four pinned source screenshots at levels 89/90 in light/dark                                | `tests/e2e/priority-visual.spec.ts` asserts tab hidden/visible and compares all four full-screen source screenshots at zero pixels on Windows                                        |
| Card branches: ordinary/capped label, affordable/unaffordable, enabled/disabled, selected/highlighted                                                  | `upgradeSemantics` display/purchase cases and source captures                               | `tests/parity/remix-upgrade-display.test.ts`, `tests/parity/upgrades.test.ts`, and `tests/e2e/remix-app.spec.ts` assert values and live purchase outcomes                            |
| Every finite Money/Gem/Planet Coin cap boundary: card/detail appearance at cap-1, cap, cap+1; representative group screen at cap                       | Pinned `upgradeSemantics` cap samples and live source rendering                             | `tests/e2e/upgrade-all-caps-differential.spec.ts` compares all capped cards/details and six full-screen cap states (three groups × two themes)                                       |
| `Components/upgrade.js:canAfford` resource selection and exact/insufficient affordability; card and highlighted-detail appearance                      | Pinned zero-resource, below-exact Money, and exact-price cases for all three shop resources | `tests/e2e/upgrade-affordability-differential.spec.ts` compares source/Beyond state, class/style/layout, click result, and exact card/detail PNG hashes in both themes               |
| `Themes/dark.css`: generic important button-hover rule versus `.upg-tabs button:hover`; the pinned cascade keeps a hovered resource tab at `#636363`   | Live source computed style after theme CSS load and selecting each group                    | `tests/e2e/upgrade-affordability-differential.spec.ts` compares computed hovered-tab background for Money/Gem/PC in both themes; Beyond now matches `#636363`                        |
| `Components/upgrade.js` exact `level === maxLevel` dimming versus `Upgrade.buy` strict `level < getMaxLevel()` at Gem cap 50 and saved level 51        | `upgradeSemantics.groups.gems.blacksmithSkill` source displays at 50/51                     | `tests/e2e/upgrade-cap-quirk.spec.ts` compares labels, details, class, opacity, cursor, click no-op, and 1px-inset card/full detail pixel hashes in both themes against pinned Remix |
| Modifier branch priority: Control buys 100, else Shift buys 10, else single buy; selected Gem craft modifier is covered in craft map                   | pinned `buyUpgrade` source and browser modifier cases                                       | `tests/e2e/remix-app.spec.ts` asserts all three purchase modes and control precedence                                                                                                |
| `main.js` global keymap and `index.html` multibuy labels: keydown/up does not itself trigger a Vue render; later reactive render recomputes the labels | Pinned source runtime with fixed clock and controlled key events                            | `tests/e2e/upgrade-affordability-differential.spec.ts` compares stale/immediate, hover-refreshed, stale-after-release, and release-refreshed labels and detail pixels in both themes |

#### Held modifier full-screen differential

The pinned `Scripts/main.js` global `onkeydown`/`onkeyup` handlers mutate
`keymap` without a Vue-observed state assignment for Shift or Control.
`Scripts/Components/upgrade.js` changes `game.highlightedUpgrade` on hover,
which causes the pinned `index.html` computed purchase labels to render again;
`main.css` colors `.highlightedupgrade .multibuy.active` green.
`tests/e2e/upgrade-affordability-differential.spec.ts` starts from a level-zero,
all-affordable save, then captures the full 1440x900 screen immediately after
each keydown and after hovering away/back to trigger a Vue render. It asserts
stale labels `[false,false]`, then Shift `[true,false]`,
Control `[false,true]`, and Shift+Control `[false,true]`. All 12 source/Beyond
image pairs (two frames × three modifier cases × two themes) match exactly.

### Shop-tab selection state branch trace

- **Remix source behavior:** resource buttons mutate `settings.upgradeTab`; the
  selected list persists while the main panel is unmounted. The save encoder
  includes the field, but a fresh `loadGame()` starts from `game.js`'s Money
  default because the loader does not apply it.
- **Beyond assertion:**
  `tests/e2e/upgrade-tab-state-differential.spec.ts` compares Gem and Planet Coin
  selection, Story/Mining navigation, decoded export, and fresh-page behavior.

#### Gem exact-price alternate-viewport differential

The pinned `buy-uses-gem-resource` save is shown with the Gem resource exactly
equal to the selected upgrade price. The focused affordability test now repeats
that full-screen source/Beyond comparison at 1366×768 in light and dark after
its existing 1440×900 comparison; both new pairs match at zero pixels on
Windows Chromium (2/2). Linux evidence for this new viewport is pending CI.
Other shop balances, card levels, and viewport/theme combinations remain open.

#### Zero-resource alternate-viewport differential

`tests/e2e/upgrade-affordability-differential.spec.ts` also compares the full
1366x768 shop screen after selecting each of Money, Gem, and Planet Coin with
the corresponding resource at zero. Both themes match pinned Remix at zero
pixels on Windows Chromium (6 source/Beyond captures; focused test 2/2). These
states already had 1440x900 comparisons; other balances and viewport/theme
combinations remain open.

#### Level-one catalog alternate-viewport differential

The same E2E compares the full Money, Gem, and Planet Coin catalog screens at
level one with abundant resources at 1366x768. It hovers a representative card
in each tab before taking the complete viewport capture. All six source/Beyond
pairs match at zero pixels on Windows Chromium (focused test 2/2); broader
levels and other viewport/theme combinations remain open.

## Visual slice: Powers

- **Remix source branches:** `game.powers.unlocked()` and
  `Components/powers-table.js` row visibility, prestige visibility/disable,
  and reset behavior.
- **Covered:** captured unlock-boundary UI and source/implementation light/dark
  screenshot pairs at 1440×900 in `tests/e2e/priority-visual.spec.ts`;
  formula/prestige state assertions in `tests/parity/remix-powers.test.ts`; and
  live source comparisons for all four prestige actions, the disabled no-op, and
  the stale table until tab re-entry in
  `tests/e2e/powers-prestige-differential.spec.ts`. The captured
  `prestige-effect-above-threshold` input also shows all four prestige rows and
  compares source-captured button text plus full-screen pixels in both themes.
- **Covered boundary:** the current-Power row visibility condition is isolated
  from the next-Power condition: `current=999,next=1` hides the prestige action;
  `current=1000,next=1` displays the disabled action; the alternate
  `current=100,next=2` condition also displays its disabled action. The pinned
  source outputs drive full-screen comparisons for all three cases in both
  themes at 1440x900. At `current=1e6`, a next Power exactly equal to the
  `31.622776601683796` prestige effect keeps the visible button disabled; this
  exact-equality screen also has full-screen comparisons in both themes on
  Windows. Its light/dark comparisons at 1366x768 cover one standard alternate
  viewport there as well; Linux asserts the same source-derived row state.
- **Sampled:** representative full-screen comparisons cover the initial,
  stale-after-prestige, remounted table, the hidden/visible 999/1,000 boundary,
  the alternate `current=100,next=2` visibility condition, the all-row state at
  Power 1,001, the exact-equality disabled button, and a mixed high-balance state
  (`1e12,1e4,1e2,1,1`) at 1440x900 in both themes. The exact-equality state is
  also compared at 1366x768 in both themes. Other balances, prestige inputs,
  and unselected theme/viewport combinations remain open. The full
  Wisdom panel after Shift buys `Power Power (Active)` to level 10 is also
  compared in both themes at 1440x900; Windows pixels match exactly, while
  Linux still asserts state and text because of the known one-pixel description
  antialiasing difference.

### Powers visual function and branch trace

| Pinned Remix function/path and branch                                                                                                                                                                                     | Source evidence                                                                                              | Beyond assertion                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `game.powers.unlocked()`: locked below high-water 170; visible at and above 170                                                                                                                                           | captured 169/170/171 saves and source screenshot state                                                       | `tests/parity/remix-powers.test.ts` asserts the strict gate; `tests/e2e/remix-app.spec.ts` asserts the tab/panel boundary                                                                                                               |
| `Scripts/Components/powers-table.js`: row visibility, current/next-Power labels, prestige control enabled/disabled, indexed-write stale display, observed idle `Vue.set` refresh, tab re-entry refresh, and reset outcome | all source rows and named prestige states in `powersTableSemantics`, plus paired pinned browser observations | `tests/parity/remix-powers.test.ts` compares row outputs and resulting values; `tests/e2e/powers-prestige-differential.spec.ts` compares all four actions, the no-op, stale rows, idle-hit refresh, and tab re-entry with Remix         |
| `prestige-effect-above-threshold`: four visible row/button labels at Power 1,001 with mixed enabled/disabled states                                                                                                       | `powersTableSemantics.scenarios` source output and the captured `1001,1001,1001,1001,1` input                | `tests/e2e/powers-prestige-differential.spec.ts` asserts the rendered text against the source fixture and compares full-screen source/Beyond pixels in both themes at 1440x900                                                          |
| `button-shows-from-next-power-above-one`: first row is visible at current Power 100 because next Power is 2, even below current threshold 1,000                                                                           | `powersTableSemantics.scenarios` source output for `100,2,1,1,1`, with a disabled `Prestige: x1.00` button   | `tests/e2e/powers-prestige-differential.spec.ts` compares every rendered row with Remix and compares the full screen at 1440x900 in both themes                                                                                         |
| `button-is-disabled-at-exact-prestige-effect`: next Power `31.622776601683796` exactly equals the effect at current Mining Power `1e6`; the visible Prestige button stays disabled                                        | `powersTableSemantics.scenarios` source output records equal Decimal values and `Prestige: x31.62` disabled  | `tests/e2e/powers-prestige-differential.spec.ts` compares rows at 1440x900 and the exact state at 1366x768 in both themes                                                                                                               |
| `high-power-balance-mixed-prestige-state`: Mining Power `1e12`, Craftsmanship `1e4`, Expertise `1e2`, and Wisdom/Exquisity `1`; Mining and Craftsmanship rows show distinct enabled/disabled prestige states              | `powersTableSemantics.scenarios` output captured from pinned Remix for `1e12,1e4,1e2,1,1`                    | `tests/e2e/powers-prestige-differential.spec.ts` asserts all rendered rows against the source fixture and compares full-screen source/Beyond pixels in both themes at 1440x900                                                          |
| `upgrade-standalone.js:getBuyAmount()` and card render refresh after modifier purchase: Shift buys ten, and only a card with changed displayed level/effect/price refreshes its label                                     | pinned browser run with Wisdom `1e100`, Shift purchase, released-key card labels, and full-screen captures   | `tests/e2e/wisdom-upgrade-buy-amount-differential.spec.ts` asserts level 10, all card labels and balance against Remix, then compares the complete panel at 1440x900 in both themes (exact Windows pixels; Linux text/state assertions) |

The full-screen prestige differential in `tests/e2e/powers-prestige-differential.spec.ts` also compares the initial, stale-after-prestige, and remounted states against pinned Remix at 1440x900 in both themes on Windows; Linux retains row/state assertions because of the known Wisdom-description antialiasing difference. The exact-effect disabled action is additionally compared at 1366x768 in both themes on Windows. The pinned `Themes/dark.css` selector `button:not(.chapter-control button)` gives non-chapter controls the `#636363` background even at rest; this source branch is included in those screenshot assertions.
| Captured Wisdom/Stars visual state, both themes at 1440×900 | pinned priority source screenshot pair | `tests/e2e/priority-visual.spec.ts` compares the selected screenshot pair; `tests/parity/visual-baselines.test.ts` checks its hashes |

Validation on 2026-11-07: `pnpm.cmd exec playwright test
tests/e2e/powers-prestige-differential.spec.ts --workers=1 --retries=0`
passed 17/17 on Windows Chromium 153.0.8010.12. The eight pinned full-screen
boundary captures and the existing action, disabled no-op, stale-table,
remount, and idle-hit refresh differentials all passed. This revalidates the
mapped scenarios; other balances and unselected visual states remain open.

High-balance visual extension on 2026-11-07: the source probe now captures a
mixed `1e12,1e4,1e2,1,1` Power state. Its row outputs and full 1440x900 screens
match pinned Remix in light and dark themes (2/2). The Beyond shell needed up to
20 seconds to hydrate during the first cold light-theme run, so this visual
scenario allows that readiness interval; other balance and visual states remain
open.

## Visual slice: Mining

- **Remix source branches:** `index.html` selected object/resources/upgrade
  controls; `Components/mine-object.js` animation; `main.js:update` and
  `drawStone` frame/render paths.
- **Covered:** fresh Mining, controlled objects 124, 169, and 198, and fresh
  Mud after one non-lethal click (HP 100 to 80) at 1440×900 in both themes;
  seeded craft replacement, equal-damage dud, and insufficient-Gem outcomes
  also match the pinned
  source screen in both themes. Selected primary-screen pairs cover
  1366×768, 1920×1080, and 2560×1440. See
  `tests/e2e/priority-visual.spec.ts`,
  `tests/e2e/pickaxe-crafting-visual.spec.ts`, and
  `tests/parity/visual-baselines.test.ts`.
- **Sampled:** those are selected states; other progression/resource/render states
  at 1440×900 and other screens at alternate resolutions remain open.

### Mining visual function and branch trace

| Pinned Remix function/path and branch                                                                                                                                                     | Source evidence                                                                                                                                                            | Beyond assertion                                                                                                                                                                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.html`: selected mine-object name/level, resource header, and upgrade controls for Mining tab                                                                                       | fresh and captured Space/Wisdom/Galaxy phase saves                                                                                                                         | `tests/e2e/priority-visual.spec.ts` asserts object names/controls and compares source/Beyond screenshots at 1440×900 in both themes                                                                                                       |
| `Scripts/Components/mine-object.js`: damageable Mining canvas versus non-damageable Story preview; image-loading completion path                                                          | `formulaSemantics`, Story `nodamage` template, and Canvas render records                                                                                                   | `tests/e2e/remix-app.spec.ts` asserts active click, zero-damage state, and non-mining preview; `tests/e2e/mine-object-renderer.spec.ts` asserts pixel output                                                                              |
| `Scripts/Define/functions.js#clickMineObject()` and `Scripts/mineobject.js#MineObject.damage(d)`: a non-lethal active hit subtracts HP without breaking the object or consuming break RNG | Pinned fresh Remix after one real Canvas click; Mud changes from 100 to 80 HP                                                                                              | `tests/e2e/priority-visual.spec.ts` asserts HP 80 and compares live pinned-Remix/Beyond full-screen hashes at zero pixels in both themes; Windows passed 2/2, Linux awaits CI                                                             |
| `Scripts/main.js:update` and `drawStone`: frame-driven mining/render composition and Canvas compositing                                                                                   | `simulationFrameSemantics`, source RGBA goldens, and captured mine objects                                                                                                 | `tests/parity/mining-transitions.test.ts`, `tests/parity/story-runtime.test.ts`, and `tests/e2e/mine-object-renderer.spec.ts` compare frame transitions and pixels                                                                        |
| `functions.craftPick`: strict-damage replacement, equal-damage dud, and insufficient-Gem result in the Mining panel; unaffordable craft consumes no RNG                                   | `pickaxeCraftingSemantics.attempts` with source-captured sequences for `better-craft-replaces-and-saves`, `equal-damage-is-a-dud`, and `insufficient-gems-consumes-no-rng` | `tests/e2e/pickaxe-crafting-visual.spec.ts` asserts all three outcomes and exact pixels at 1440×900 and 1366×768 in light and dark; both runtimes consume the captured draw count (zero for insufficient Gems)                            |
| `index.html`: `settings.showMinCraftDamage` condition renders the minimum-base-damage label in the craft button only when enabled                                                         | Fresh source save with live Settings toggle to true and false                                                                                                              | `tests/e2e/mining-preferences-visual.spec.ts` asserts source/Beyond label text and exact full Mining screen hashes for both preference states and themes                                                                                  |
| `index.html`: `settings.showMineObjLevel` conditional heading shows `#{{mineObjectLevel + 1}}` or is omitted in Mining                                                                    | Fresh source save with live Settings toggle to true and false                                                                                                              | `tests/e2e/mining-preferences-visual.spec.ts` asserts heading text; Windows and Linux full screens exact for all six preference/theme combinations in CI run 97                                                                           |
| Full Mining screen with controlled Clay save and selected Gem craft cost 3 in light and dark at 1440×900                                                                                  | both `craft-mining-panel-{light,dark}-1440x900.json` sidecars pin source state, theme, browser, viewport, and screenshot hashes                                            | `tests/e2e/remix-app.spec.ts` compares both full screens at zero pixels on Windows and Linux                                                                                                                                              |
| Full Mining screen before crafting with the better-replacement input, Gem cost 3, and 1366×768 in light and dark                                                                          | fixed source-shaped input and one Gem Waster selector advance from cost 1 to 3                                                                                             | `tests/e2e/pickaxe-crafting-visual.spec.ts` compares complete source/Beyond screenshots at zero pixels; Windows Chromium passed both themes (2/2)                                                                                         |
| Full Mining screen with the Gem Waster selector at interior cost 10 and maximum cost 35 in both themes at 1440x900 and 1366x768                                                           | controlled legacy save with Gem Waster levels set to reach costs 1, 3, 10, and 35                                                                                          | `tests/e2e/pickaxe-crafting-visual.spec.ts` compares source/Beyond screen hashes at zero pixels and asserts both maximum-level controls are disabled with no arrow image; all eight viewport/theme/state cases passed on Windows Chromium |
| Selected primary Mining screen at 1366×768, 1920×1080, and 2560×1440                                                                                                                      | paired source screenshots for both themes and each viewport                                                                                                                | `tests/e2e/priority-visual.spec.ts` compares each selected viewport; `tests/parity/visual-baselines.test.ts` validates metadata and hashes                                                                                                |

**Linux Mining visual evidence (CI runs 88–97, 2026-11-07):** the
`showMineObjLevel` dark full-screen branch remains open after one pixel differs
at `(7,209)`. Hiding the canvas verifies that the complete screenshots then
match; its visible bitmap hash, bounds, and recorded paint styles match Remix.
Removing the generated Svelte canvas class with layout styles preserved, and
moving the hidden cache canvas to the Remix DOM position, both leave Beyond's
original screenshot hash unchanged. The hidden cache bitmap hash differs from
Remix, but this has not been linked to the screen delta. Setting both visible
canvases to `opacity:0` also makes their full-screen captures identical with
the DOM and layout boxes intact. Thus suppressing visible paint removes the
delta, without distinguishing paint from an associated compositor effect. Run
92 changed the primary comparison to sequential captures and still reproduced
the delta in both retries. Later sequential captures matched after prior
DOM/style diagnostic mutations, so they do not establish serial capture as the
fix. CI run 93's four alternating-order pairs before any page mutation all
reproduced the same two hashes in both retries. In run 94, hiding/restoring all
direct `body` children on both pages was followed by equal captures. Because the
pages were probed together and captured while hidden, this does not identify
which page or operation triggers the repaint. CI 95 found that a two-frame
direct-body-child display toggle on Beyond alone has no effect, while the same
toggle on Remix changes its hash to Beyond's; no hidden-state screenshot is
required. CI 96 found the recorded geometry, paint-related computed styles,
canvas bitmap metadata, and empty active-animation list unchanged around that
source toggle. The test now applies this source-only two-frame display
toggle/restore before its ordinary screenshot capture. CI 97 passed both
workflow jobs and all six Linux preference/theme comparisons at zero pixels.
This specific Mining screenshot gap is closed with strict hashes; the wider
Desktop UI visual scope remains open.

## Visual slice: primary screens

- **Remix source branches:** screen/tab selection and shared source layout in
  `index.html`, `main.css`, and the dark theme override.
- **Covered:** Mining, Story, and Settings selected source states at
  1366×768, 1920×1080, and 2560×1440 in both themes, each with source and
  Beyond screenshot evidence; metadata and hashes are checked by
  `tests/parity/visual-baselines.test.ts`.
- **Sampled:** no claim for all UI states at those resolutions or for unselected
  viewports.

### Primary-screen function and branch trace

| Pinned Remix function/path and branch                                                  | Source evidence                                                     | Beyond assertion                                                                                                                                                               |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `index.html` selected `main`, `story`, and `settings` tab panels                       | paired source screenshots for each primary tab, viewport, and theme | `tests/e2e/priority-visual.spec.ts` switches each tab and compares the matching screenshot; `tests/parity/visual-baselines.test.ts` validates all source metadata/hash entries |
| Light/dark CSS branch across the three primary panels and required alternate viewports | source CSS/theme references and paired screenshot sidecars          | `tests/e2e/priority-visual.spec.ts` compares both themes at 1366×768, 1920×1080, and 2560×1440; baseline integrity is checked in `tests/parity/visual-baselines.test.ts`       |

## Native packaging and platforms

- **Remix source:** no native package. The source game is a browser application.
- **Covered foundation:** current Tauri config/build checks are documented in
  the native test map and project status.
- **Scope:** **Out of web-v1 scope.** Native packaging, native storage, and
  running WebView parity are deferred until a later native milestone.

### Native packaging/platform function and branch trace

| Beyond function/path and branch                                              | Fixture/evidence                                                 | Assertion                                                                                     |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Web SPA/PWA build and browser route are the only release target in parity-v1 | current SvelteKit static-adapter build and browser smoke run     | `tests/e2e/remix-app.spec.ts` plus `pnpm build` validate the web target                       |
| Tauri packaging, native filesystem, mobile SDKs, and WebView runtime parity  | no Remix-native source exists; native implementation is deferred | **Out of web-v1 scope.** No native parity or packaging completion is inferred from web checks |
