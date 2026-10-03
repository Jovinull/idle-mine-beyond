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
  `tests/e2e/remix-app.spec.ts`. The pinned `keyboardInputSemantics` fixture
  and arrow-key E2E compare right/left movement, repeats, both bounds, a focused
  text field, selection names, default prevention, and key release. The
  modifier E2E compares the source-observed held state across window blur and
  its removal on keyup, as well as Shift/Control purchase precedence.
- **Sampled:** physical keyboard layout/IME and browser-generated key-event variants
  are not captured. Manual save/edit/reset combinations remain partial.

### Settings/input function and branch trace

| Pinned Remix function/path and branch                                                                                                                                                                                                       | Source evidence                                                                                            | Beyond assertion                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `Scripts/main.js:onkeydown`: insert a key only if absent; ArrowRight, ArrowLeft, and an unbound key; prevent default only for either arrow                                                                                                  | `keyboardInputSemantics.scenarios` includes single/repeated arrows, bounds, focused input, and unbound `a` | `tests/e2e/remix-app.spec.ts` replays all scenarios and asserts default prevention and resulting object    |
| `Scripts/Define/functions.js:setMineObjectLevel`: accept levels from 0 through high-water; ignore levels below 0 or above high-water                                                                                                        | `keyboardInputSemantics.scenarios` includes both bounds                                                    | `tests/e2e/remix-app.spec.ts` compares displayed level and object name after each event                    |
| `Scripts/main.js:onkeyup`: remove the released key; source has no blur handler to clear it early                                                                                                                                            | `keyboardInputSemantics.modifierLifecycle` records Shift after keydown, blur, and keyup                    | `tests/e2e/remix-app.spec.ts` compares modifier UI before/after blur and after keyup                       |
| `Scripts/Define/functions.js:changeTab`: save scroll when leaving Story; clear notifications and schedule 30 ms restoration when entering Story; refresh number selection when entering Settings (50 ms)                                    | `storyTabSemantics` captures source tab transitions and timed effects                                      | `tests/parity/story.test.ts` and `tests/e2e/story.spec.ts` assert state/effects and live navigation        |
| `Scripts/Define/functions.js:exportGame`, `Scripts/Define/functions.js:getSaveString`, and `Scripts/Define/functions.js:saveGame`: serialize the current source game into the Settings field; save path updates time, localStorage, and log | `saveApplicationSemantics` and `saveExportSemantics` pin source output                                     | `tests/e2e/save-codec.spec.ts` and `tests/e2e/remix-app.spec.ts` compare import/export and persisted state |

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

| Pinned Remix function/path and branch                                                                | Source evidence                                                                    | Beyond assertion                                                                                                                                                           |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Scripts/Define/functions.js:setTheme`: assign selected theme and replace `css_theme` stylesheet URL | captured light/dark setting states and source stylesheet references                | `tests/e2e/remix-app.spec.ts` loads/switches both theme states and checks persisted theme; `tests/e2e/priority-visual.spec.ts` compares source light/dark screenshot pairs |
| `loadGame` theme field: absent value defaults to `light`; present `dark` loads dark CSS              | missing-settings default and dark-save cases in `saveSemantics`                    | `tests/parity/legacy-save-application.test.ts` asserts fallback/effect; `tests/e2e/remix-app.spec.ts` asserts the applied theme after load                                 |
| `Themes/light.css` base palette versus `Themes/dark.css` overrides                                   | source screenshot pairs and computed-style reference metadata for selected screens | `tests/e2e/priority-visual.spec.ts` compares each selected screen/theme at zero allowed pixels; `tests/parity/visual-baselines.test.ts` validates source image hashes      |

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
- **Sampled:** only the captured Space phase-start shop state has full-screen pairs;
  not every upgrade card’s interaction/modifier path has a live source-to-Beyond
  assertion.

### Upgrade-shop visual function and branch trace

| Pinned Remix function/path and branch                                                                                                | Source evidence                                                      | Beyond assertion                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Scripts/Components/upgrade.js`: render all Money, Gem, and Planet Coin cards in the selected group                                  | pinned group card counts, formula labels, and source screen captures | `tests/e2e/priority-visual.spec.ts` asserts counts and compares source/Beyond 1440×900 screenshots in both themes                                         |
| Card branches: ordinary/capped label, affordable/unaffordable, enabled/disabled, selected/highlighted                                | `upgradeSemantics` display/purchase cases and source captures        | `tests/parity/remix-upgrade-display.test.ts`, `tests/parity/upgrades.test.ts`, and `tests/e2e/remix-app.spec.ts` assert values and live purchase outcomes |
| Modifier branch priority: Control buys 100, else Shift buys 10, else single buy; selected Gem craft modifier is covered in craft map | pinned `buyUpgrade` source and browser modifier cases                | `tests/e2e/remix-app.spec.ts` asserts all three purchase modes and control precedence                                                                     |

## Visual slice: Powers

- **Remix source branches:** `game.powers.unlocked()` and
  `Components/powers-table.js` row visibility, prestige visibility/disable,
  and reset behavior.
- **Covered:** captured unlock-boundary UI and source/implementation light/dark
  screenshot pairs at 1440×900 in `tests/e2e/priority-visual.spec.ts`;
  formula/prestige state assertions in `tests/parity/remix-powers.test.ts`.
- **Sampled:** later Power balances, every prestige row, and every selected theme/
  viewport state have no screenshot pair.

### Powers visual function and branch trace

| Pinned Remix function/path and branch                                                                                                 | Source evidence                                                     | Beyond assertion                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `game.powers.unlocked()`: locked below high-water 170; visible at and above 170                                                       | captured 169/170/171 saves and source screenshot state              | `tests/parity/remix-powers.test.ts` asserts the strict gate; `tests/e2e/remix-app.spec.ts` asserts the tab/panel boundary                           |
| `Scripts/Components/powers-table.js`: row visibility, current/next-Power labels, prestige control enabled/disabled, and reset outcome | all source rows and named prestige states in `powersTableSemantics` | `tests/parity/remix-powers.test.ts` compares row outputs and resulting values; `tests/e2e/remix-app.spec.ts` verifies the rendered table and action |
| Captured Wisdom/Stars visual state, both themes at 1440×900                                                                           | pinned priority source screenshot pair                              | `tests/e2e/priority-visual.spec.ts` compares the selected screenshot pair; `tests/parity/visual-baselines.test.ts` checks its hashes                |

## Visual slice: Mining

- **Remix source branches:** `index.html` selected object/resources/upgrade
  controls; `Components/mine-object.js` animation; `main.js:update` and
  `drawStone` frame/render paths.
- **Covered:** fresh Mining plus controlled objects 124, 169, and 198 at
  1440×900 in both themes; selected primary-screen pairs at
  1366×768, 1920×1080, and 2560×1440. See
  `tests/e2e/priority-visual.spec.ts` and
  `tests/parity/visual-baselines.test.ts`.
- **Sampled:** those are selected states; other progression/resource/render states
  at 1440×900 and other screens at alternate resolutions remain open.

### Mining visual function and branch trace

| Pinned Remix function/path and branch                                                                                            | Source evidence                                                                                                                 | Beyond assertion                                                                                                                                                   |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `index.html`: selected mine-object name/level, resource header, and upgrade controls for Mining tab                              | fresh and captured Space/Wisdom/Galaxy phase saves                                                                              | `tests/e2e/priority-visual.spec.ts` asserts object names/controls and compares source/Beyond screenshots at 1440×900 in both themes                                |
| `Scripts/Components/mine-object.js`: damageable Mining canvas versus non-damageable Story preview; image-loading completion path | `formulaSemantics`, Story `nodamage` template, and Canvas render records                                                        | `tests/e2e/remix-app.spec.ts` asserts active click, zero-damage state, and non-mining preview; `tests/e2e/mine-object-renderer.spec.ts` asserts pixel output       |
| `Scripts/main.js:update` and `drawStone`: frame-driven mining/render composition and Canvas compositing                          | `simulationFrameSemantics`, source RGBA goldens, and captured mine objects                                                      | `tests/parity/mining-transitions.test.ts`, `tests/parity/story-runtime.test.ts`, and `tests/e2e/mine-object-renderer.spec.ts` compare frame transitions and pixels |
| Full Mining screen with controlled Clay save and selected Gem craft cost 3 in light and dark at 1440×900                         | both `craft-mining-panel-{light,dark}-1440x900.json` sidecars pin source state, theme, browser, viewport, and screenshot hashes | `tests/e2e/remix-app.spec.ts` compares both full screens at zero pixels on Windows and Linux                                                                       |
| Selected primary Mining screen at 1366×768, 1920×1080, and 2560×1440                                                             | paired source screenshots for both themes and each viewport                                                                     | `tests/e2e/priority-visual.spec.ts` compares each selected viewport; `tests/parity/visual-baselines.test.ts` validates metadata and hashes                         |

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
