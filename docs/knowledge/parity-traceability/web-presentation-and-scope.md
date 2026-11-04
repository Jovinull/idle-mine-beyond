# Trace map — web presentation and scope

## Visual slice

The matrix's visual summary row groups the following state-specific maps.
It adds no independent coverage claim; its remaining scope is the union of the
gaps below.

### Visual summary function and branch trace

| Matrix roll-up branch                                                                                       | Source evidence                                                            | Beyond assertion                                                                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shop visual state: Money/Gem/Planet Coin group, light/dark, canonical 1440×900                              | pinned priority visual state records                                       | `tests/e2e/priority-visual.spec.ts` compares each source screenshot pair; `tests/parity/visual-baselines.test.ts` validates screenshot hashes and metadata                                                                       |
| Powers visual state: Wisdom/Stars unlock view, light/dark, canonical 1440×900                               | pinned Powers priority visual state records                                | `tests/e2e/priority-visual.spec.ts` compares the screenshot pair; `tests/parity/visual-baselines.test.ts` validates its pinned source assets                                                                                     |
| Mining visual states, controlled full craft panel, and primary screens at canonical and alternate viewports | captured Mining phases, craft-panel state, and primary-screen viewport set | `tests/e2e/priority-visual.spec.ts` compares selected states; `tests/e2e/remix-app.spec.ts` compares the full craft panel on Windows and Linux; `tests/parity/visual-baselines.test.ts` validates screenshot metadata and hashes |
| `index.html` document-language metadata: no `lang` attribute on the root element                            | Pinned Remix `index.html` root element                                     | `tests/e2e/remix-app.spec.ts` compares the Beyond and pinned root `lang` attributes and computed `-webkit-locale`                                                                                                                |

This matrix row is a roll-up, not an additional source function. The function
branches are listed in the state-specific maps below; its status is the union
of those maps.

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
  enabling both preferences, switching to dark, saving, and exporting. The
  `tests/e2e/mining-preferences-visual.spec.ts` toggles both Mining display
  preferences through Settings and compares the label-present and label-absent
  Mining screens in both themes. The
  pinned `keyboardInputSemantics` fixture
  and arrow-key E2E compare right/left movement, repeats, both bounds, a focused
  text field, selection names, default prevention, and key release. The
  modifier E2E compares the source-observed held state across window blur and
  its removal on keyup, as well as Shift/Control purchase precedence.
- **Sampled:** physical keyboard layout/IME and browser-generated key-event variants
  are not captured. The named save-field, import, and reset interactions cover
  their mapped source paths; arbitrary text edits and multi-control sequences
  remain non-exhaustive UI states rather than untested source branches.

### Settings/input function and branch trace

| Pinned Remix function/path and branch                                                                                                                                                                                                       | Source evidence                                                                                                 | Beyond assertion                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Scripts/main.js:onkeydown`: insert a key only if absent; ArrowRight, ArrowLeft, and an unbound key; prevent default only for either arrow                                                                                                  | `keyboardInputSemantics.scenarios` includes single/repeated arrows, bounds, focused input, and unbound `a`      | `tests/e2e/remix-app.spec.ts` replays all scenarios and asserts default prevention and resulting object                                                                         |
| `Scripts/Define/functions.js:setMineObjectLevel`: accept levels from 0 through high-water; ignore levels below 0 or above high-water                                                                                                        | `keyboardInputSemantics.scenarios` includes both bounds                                                         | `tests/e2e/remix-app.spec.ts` compares displayed level and object name after each event                                                                                         |
| `Scripts/main.js:onkeyup`: remove the released key; source has no blur handler to clear it early                                                                                                                                            | `keyboardInputSemantics.modifierLifecycle` records Shift after keydown, blur, and keyup                         | `tests/e2e/remix-app.spec.ts` compares modifier UI before/after blur and after keyup                                                                                            |
| `Scripts/Define/functions.js:changeTab`: save scroll when leaving Story; clear notifications and schedule 30 ms restoration when entering Story; refresh number selection when entering Settings (50 ms)                                    | `storyTabSemantics` captures source tab transitions and timed effects                                           | `tests/parity/story.test.ts` and `tests/e2e/story.spec.ts` assert state/effects and live navigation                                                                             |
| `index.html`: `settings.showMinCraftDamage` condition includes or omits the minimum-base-damage span in the Mining craft button                                                                                                             | Fresh source save defaults the preference to false; the paired E2E toggles it on and off through Settings       | `tests/e2e/mining-preferences-visual.spec.ts` asserts label presence/text or absence and compares complete Mining screenshots in both themes                                    |
| `index.html`: `settings.showMineObjLevel` condition includes or omits the selected mineral-level heading in Mining                                                                                                                          | Fresh source save defaults the preference to false; the paired E2E toggles it on and off through Settings       | `tests/e2e/mining-preferences-visual.spec.ts` asserts heading presence/text or absence and compares complete Mining screenshots in both themes                                  |
| `Scripts/Define/functions.js:exportGame`, `Scripts/Define/functions.js:getSaveString`, and `Scripts/Define/functions.js:saveGame`: serialize the current source game into the Settings field; save path updates time, localStorage, and log | `saveApplicationSemantics` and `saveExportSemantics` pin source output                                          | `tests/e2e/save-codec.spec.ts` and `tests/e2e/remix-app.spec.ts` compare import/export and persisted state                                                                      |
| `Scripts/Define/functions.js:hardReset`: each confirmation returns early without changing game/storage when dismissed; three accepts clear origin storage and reload defaults                                                               | `hardResetSemantics.cancelled` covers each dismissal index; `hardResetSemantics.confirmed` covers three accepts | `tests/parity/remix-hard-reset.test.ts` checks every source result; `tests/e2e/remix-app.spec.ts` compares each cancellation point with pinned Remix and checks confirmed reset |

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

| Pinned Remix function/path and branch                                                                                                          | Source evidence                                                                  | Beyond assertion                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.html` top-level tab conditionals: Mining, unlocked Powers, Story, Settings; Planet Coin shop control has the source high-water gate     | pinned template and source-shaped save states at the tab boundary                | `tests/e2e/remix-app.spec.ts` asserts Mining/Story/Settings routes, Powers unlock, and PC tab absent at 89/present at 90                                                                                             |
| Source template renders shared resource/header, selected upgrade group, mine object, and Story/Settings/Powers panel by `settings.tab`         | pinned Story markup, priority visual state fixtures, and controlled source saves | `tests/e2e/remix-app.spec.ts`, `tests/e2e/story-panel.spec.ts`, and `tests/e2e/priority-visual.spec.ts` assert each in-scope panel and selected state                                                                |
| `Scripts/Components/upgrade.js` and `powers-table.js`: selected group cards, source labels, enabled/disabled controls and modifier interaction | `upgradeSemantics`, `powersTableSemantics`, and paired 1440×900 source captures  | `tests/parity/remix-upgrade-display.test.ts`, `tests/parity/remix-powers.test.ts`, `tests/e2e/remix-app.spec.ts`, and `tests/e2e/priority-visual.spec.ts` compare source text, interaction, and screenshot states    |
| `Scripts/Components/mine-object.js`: Mining click versus `nodamage` preview, zero-damage class, source Canvas availability                     | source Story template prop, `formulaSemantics`, and Canvas RGBA records          | `tests/e2e/remix-app.spec.ts` asserts preview clicks do not mine and zero active damage is marked unavailable; `tests/e2e/mine-object-renderer.spec.ts` compares preview pixels                                      |
| Pinned `index.html`, `main.css`, theme CSS, and ordered source scripts compose player-visible desktop view                                     | extracted Story markup/runtime and selected source screenshots                   | `tests/parity/story-markup.test.ts`, `tests/parity/story-runtime.test.ts`, `tests/e2e/story-visual.spec.ts`, and `tests/e2e/priority-visual.spec.ts` compare markup, runtime pixels, and selected full-screen states |

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
  level zero with abundant resources in both themes, comparing source order,
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
- **Covered visual boundary:** the selected Space phase-start shop state has
  full-screen pairs for all three resource groups. The Planet Coin gate has
  additional full-screen pairs at high-water 89 (hidden) and 90 (visible), in
  light and dark themes. Those four source captures use
  `tests/e2e/priority-visual.spec.ts` and compare at zero pixels on Windows.
- **Sampled / open visual states:** the all-card comparison is one source-shaped
  level-zero state with abundant resources; the affordability differential
  covers representative zero/exact-price resource cases and one below-price
  Money case. Full-screen comparisons cover each Money/Gem/Planet Coin tab at
  levels zero and one in both themes (12 paired viewports), plus the zero-
  resource boundary for each tab, the Money below-price boundary, and the exact-
  price boundary for all three tabs in both themes (14 paired viewports). Other
  balances and broader application-state combinations remain open. A dedicated
  full-screen differential covers the immediate stale labels and the refreshed
  active hints for Shift, Control, and Shift+Control on Money Active Power in
  both themes; it does not cover all shop states. The
  Gem Blacksmith Skill equality-at-cap (50) and saved
  over-cap (51) states now compare card pixels (1px inset) and full hover-detail
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

### Upgrade-shop visual function and branch trace

| Pinned Remix function/path and branch                                                                                                                  | Source evidence                                                                             | Beyond assertion                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Scripts/Components/upgrade.js`: render all Money, Gem, and Planet Coin cards in the selected group                                                    | pinned group card counts, formula labels, and source screen captures                        | `tests/e2e/priority-visual.spec.ts` asserts counts and compares source/Beyond 1440×900 screenshots in both themes                                                                    |
| `index.html`: header Planet Coin amount and shop tab appear at `highestMineObjectLevel >= 90`                                                          | Four pinned source screenshots at levels 89/90 in light/dark                                | `tests/e2e/priority-visual.spec.ts` asserts tab hidden/visible and compares all four full-screen source screenshots at zero pixels on Windows                                        |
| Card branches: ordinary/capped label, affordable/unaffordable, enabled/disabled, selected/highlighted                                                  | `upgradeSemantics` display/purchase cases and source captures                               | `tests/parity/remix-upgrade-display.test.ts`, `tests/parity/upgrades.test.ts`, and `tests/e2e/remix-app.spec.ts` assert values and live purchase outcomes                            |
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
  `current=1000,next=1` displays the disabled action. The corresponding pinned
  source outputs drive full-screen comparisons in both themes at 1440x900.
- **Sampled:** representative full-screen comparisons cover the initial,
  stale-after-prestige, remounted table, the hidden/visible 999/1,000 boundary,
  and the all-row state at Power 1,001 at 1440x900 in both themes. Other
  balances, prestige inputs, and unselected theme/viewport combinations remain
  open.

### Powers visual function and branch trace

| Pinned Remix function/path and branch                                                                                                                                                                                     | Source evidence                                                                                              | Beyond assertion                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `game.powers.unlocked()`: locked below high-water 170; visible at and above 170                                                                                                                                           | captured 169/170/171 saves and source screenshot state                                                       | `tests/parity/remix-powers.test.ts` asserts the strict gate; `tests/e2e/remix-app.spec.ts` asserts the tab/panel boundary                                                                                                       |
| `Scripts/Components/powers-table.js`: row visibility, current/next-Power labels, prestige control enabled/disabled, indexed-write stale display, observed idle `Vue.set` refresh, tab re-entry refresh, and reset outcome | all source rows and named prestige states in `powersTableSemantics`, plus paired pinned browser observations | `tests/parity/remix-powers.test.ts` compares row outputs and resulting values; `tests/e2e/powers-prestige-differential.spec.ts` compares all four actions, the no-op, stale rows, idle-hit refresh, and tab re-entry with Remix |
| `prestige-effect-above-threshold`: four visible row/button labels at Power 1,001 with mixed enabled/disabled states                                                                                                       | `powersTableSemantics.scenarios` source output and the captured `1001,1001,1001,1001,1` input                | `tests/e2e/powers-prestige-differential.spec.ts` asserts the rendered text against the source fixture and compares full-screen source/Beyond pixels in both themes at 1440x900                                                  |

The full-screen prestige differential in `tests/e2e/powers-prestige-differential.spec.ts` also compares the initial, stale-after-prestige, and remounted states against pinned Remix at 1440x900 in both themes. The pinned `Themes/dark.css` selector `button:not(.chapter-control button)` gives non-chapter controls the `#636363` background even at rest; this source branch is included in those screenshot assertions.
| Captured Wisdom/Stars visual state, both themes at 1440×900 | pinned priority source screenshot pair | `tests/e2e/priority-visual.spec.ts` compares the selected screenshot pair; `tests/parity/visual-baselines.test.ts` checks its hashes |

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

| Pinned Remix function/path and branch                                                                                                                                                     | Source evidence                                                                                                                                                            | Beyond assertion                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.html`: selected mine-object name/level, resource header, and upgrade controls for Mining tab                                                                                       | fresh and captured Space/Wisdom/Galaxy phase saves                                                                                                                         | `tests/e2e/priority-visual.spec.ts` asserts object names/controls and compares source/Beyond screenshots at 1440×900 in both themes                                                                           |
| `Scripts/Components/mine-object.js`: damageable Mining canvas versus non-damageable Story preview; image-loading completion path                                                          | `formulaSemantics`, Story `nodamage` template, and Canvas render records                                                                                                   | `tests/e2e/remix-app.spec.ts` asserts active click, zero-damage state, and non-mining preview; `tests/e2e/mine-object-renderer.spec.ts` asserts pixel output                                                  |
| `Scripts/Define/functions.js#clickMineObject()` and `Scripts/mineobject.js#MineObject.damage(d)`: a non-lethal active hit subtracts HP without breaking the object or consuming break RNG | Pinned fresh Remix after one real Canvas click; Mud changes from 100 to 80 HP                                                                                              | `tests/e2e/priority-visual.spec.ts` checks source-captured HP and compares both theme screenshots at 1440×900; Linux retains the source-state assertion while its two screenshots await external capture      |
| `Scripts/main.js:update` and `drawStone`: frame-driven mining/render composition and Canvas compositing                                                                                   | `simulationFrameSemantics`, source RGBA goldens, and captured mine objects                                                                                                 | `tests/parity/mining-transitions.test.ts`, `tests/parity/story-runtime.test.ts`, and `tests/e2e/mine-object-renderer.spec.ts` compare frame transitions and pixels                                            |
| `functions.craftPick`: strict-damage replacement, equal-damage dud, and insufficient-Gem result in the Mining panel; unaffordable craft consumes no RNG                                   | `pickaxeCraftingSemantics.attempts` with source-captured sequences for `better-craft-replaces-and-saves`, `equal-damage-is-a-dud`, and `insufficient-gems-consumes-no-rng` | `tests/e2e/pickaxe-crafting-visual.spec.ts` asserts all three outcomes and exact full-screen pixels at 1440×900 in light and dark; both runtimes consume the captured draw count (zero for insufficient Gems) |
| `index.html`: `settings.showMinCraftDamage` condition renders the minimum-base-damage label in the craft button only when enabled                                                         | Fresh source save with live Settings toggle to true and false                                                                                                              | `tests/e2e/mining-preferences-visual.spec.ts` asserts source/Beyond label text and exact full Mining screen hashes for both preference states and themes                                                      |
| `index.html`: `settings.showMineObjLevel` conditional heading shows `#{{mineObjectLevel + 1}}` or is omitted in Mining                                                                    | Fresh source save with live Settings toggle to true and false                                                                                                              | `tests/e2e/mining-preferences-visual.spec.ts` asserts source/Beyond heading text and exact full Mining screen hashes in both preference states and themes                                                     |
| Full Mining screen with controlled Clay save and selected Gem craft cost 3 in light and dark at 1440×900                                                                                  | both `craft-mining-panel-{light,dark}-1440x900.json` sidecars pin source state, theme, browser, viewport, and screenshot hashes                                            | `tests/e2e/remix-app.spec.ts` compares both full screens at zero pixels on Windows and Linux                                                                                                                  |
| Selected primary Mining screen at 1366×768, 1920×1080, and 2560×1440                                                                                                                      | paired source screenshots for both themes and each viewport                                                                                                                | `tests/e2e/priority-visual.spec.ts` compares each selected viewport; `tests/parity/visual-baselines.test.ts` validates metadata and hashes                                                                    |

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
