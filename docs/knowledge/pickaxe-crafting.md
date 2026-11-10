# Pickaxe and crafting compatibility

## Non-negotiable rule

Remix crafting is stochastic and procedural. A pickaxe can be a dud. The current pickaxe is replaced only when a new pickaxe has strictly greater damage. Preserve the generated name, power, quality, damage, bonus, gem consumption, roll order, and dud feedback.

## Source-observed model

A pickaxe stores name, power, and quality. Damage is power × quality. Scripts/pickaxe.js computes a gem power multiplier equivalent to (gems − 1) / 5 + 1, then calculates power and quality using the money upgrades, gem input, and random rolls. Blacksmith Expertise adds 15% power per applied bonus point.

Quality receives repeated 1.15 multipliers on successive 50% rolls, stopping on the first failure or at the loop limit of 15. Names depend on quality tier, a random name form, and sometimes a nearby mine object. A name may include a bonus suffix.

**Verified RNG order:** each random craft evaluates the Blacksmith Expertise effect after the Gem quality-bonus roll and before the Power and base-Quality rolls. Its first `Math.random()` call occurs even at upgrade level zero. At a positive level, a value below `0.25` causes one additional draw to choose `floor(random * level)` bonus points. The quality streak then consumes one draw per successful multiplier and one final failing draw, unless all 15 rolls succeed. Preserve these calls, including calls whose level-zero result is always zero, because they shift every later name roll.

`Pickaxe.generateName()` reads `game.mineObjects[id]` directly. If that entry is missing, it calls `functions.generateMineObject(id)` rather than `functions.getMineObject(id)`. Therefore an exact special-mine anchor can be bypassed during pickaxe naming: the controlled `pickaxeCraftingSemantics` case selects ID 210, where the pickaxe name uses the generated `HD 4943-b` fallback even though the mine-object catalog's ID 210 is `Galaxy Supercluster`. Preserve this source-observed distinction. A live one-Gem craft at high-water level 215 captures the player-reachable version: the source-generated name is `Sturdy HD 4943-b Pick`, uses ten fixed RNG draws, and replaces the Toy Pickaxe; the special-object catalog still names ID 210 `Galaxy Supercluster`.

The average and minimum-craft display paths use a separate deterministic average mode. Do not use that mode as the implementation for a real craft.

## Implemented compatibility slice

`packages/core/src/remix-pickaxe-crafting.ts` reproduces random candidate generation, minimum/average display calculations, and the source craft transaction. The fixtures control five candidate sequences covering the baseline object-name path, generated-word naming, Blacksmith Expertise bonus, a 15-roll quality streak, and the procedural fallback name at a special-anchor ID. A separate source capture adds 119 craft cases at the lower quality limit, below/at/above all 13 quality transitions, both random-offset transitions in every region, and the upper clamp. Vitest compares robust one-sided boundaries; Playwright compares every exact capture in Chromium. At exact `1.4^5`, pinned Chromium reports Epic while Node's `Math.log` may round to the next tier; preserve the browser result as canonical and keep the host-runtime distinction documented. Ten transaction cases cover strict stronger/equal/weaker damage outcomes, insufficient Gems with no RNG use, Shift bulk crafting, save/log order, fractional Gem rounding, and selected Gem costs. The pinned browser probe also captures the Gem Waster selector's visibility, costs, arrow images, disabled states, and click transitions at minimum, interior, and maximum levels. Tests compare exact state, feedback, draw counts, and every intermediate save snapshot. `performRemixSimulationAction()` composes these transitions into full core state using injected RNG and the pinned content catalog. The Mining Craft button now dispatches the random action, and the session resolves exact feedback with the active notation while preserving log/save order. Playwright checks replacement, persistence, source message ordering, an insufficient-Gem retry, and Gem Waster selector behavior. Source-paired persisted craft exports now exercise selected costs of 3, 10, and 35 Gems. A captured Shift bulk case checks the x3 indicator, success/dud/insufficient order, 20 RNG draws, the first-replacement save snapshot, and reload of that saved one-Gem state. Session tests compare bulk intermediate writes and dud/insufficient feedback. The parity corpus includes two source-controlled states, each sampled with three fixed seeds and 512 crafts per seed; tests compare draw-count and quality-streak histograms, name forms, and Power/Quality/Damage summaries against Remix, with five-sigma plausibility bounds. The controlled full Mining craft panel matches source pixels at 1440x900 in light and dark on Windows and Linux; other viewport and panel states remain open.

The caller supplies the source upgrade context, RNG, and a name resolver that preserves the source's direct base-array lookup versus generated fallback. The core transition returns ordered events; `packages/formatting` renders the source success, dud, and insufficient-Gem messages. The web session interleaves those messages with each injected save effect; each successful replacement is persisted before its `Game Saved!` confirmation. The route inserts new log entries first and preserves Remix's six-entry window. Seeded outcome distributions and required source boundaries are covered, but additional craft UI states and viewports remain open, so the broader crafting area is still in progress.

The source-paired generated-name cases exercise the real Craft button for IDs 105 (pre-Portal), 175 (post-Portal/pre-Universe), and 210 (post-Universe fallback). For each case, `tests/e2e/pickaxe-special-anchor-export.spec.ts` compares the exact captured name, success feedback, ten RNG draws, and complete encoded/decoded Settings export against pinned Remix in Chromium, Firefox, and WebKit, preserving the generated pickaxe name in persisted state. The separate special-anchor screen test still covers the ID 210 Mining panel in both themes at 1440x900. The three source-paired replacement craft outcomes also have exact full-screen Chromium
comparisons at 1366x768 in light and dark, alongside the existing 1440x900
comparisons. These selected viewport cases do not cover all Mining panel states
or resolutions.

The save integration also covers a successful craft in a stale same-origin tab:
after another tab saves Blacksmith 1, the craft spends one Gem, replaces the
pickaxe, and writes its full stale snapshot, restoring Blacksmith 0 in shared
storage. The live Remix and Beyond exports match on resources, upgrade level,
and pickaxe; Beyond's backup retains the newer purchase. This selected
cross-tab write order is covered by `tests/e2e/save-cross-tab-overwrite.spec.ts`;
the selected Firefox/WebKit cross-tab gate passed 10/10 cases, including this
craft. Other action/write interleavings remain part of the broader save-storage
evidence gap.

The same cross-tab E2E now covers both no-save source branches after a fresh
Blacksmith purchase: an equal-damage dud spends one Gem and consumes ten draws,
while an insufficient-Gem attempt consumes neither. Both leave the shared
source save and Beyond primary/backup byte-identical to the newer purchase;
Chromium, Firefox, and WebKit compare messages, live balances, and pickaxe
state. These selected no-save interleavings do not close other craft or
save-order combinations.

A second stale-tab case runs the captured two-replacement Shift craft after a
fresh Blacksmith purchase. Remix saves after each replacement; Beyond's final
primary matches the Sturdy Mud Pick / zero-Gem result and its backup contains
the first Bad Mud Pick / three-Gem snapshot. Both tabs' live screens and RNG
counts match in Chromium, Firefox, and WebKit. Other bulk/save interleavings
remain open.

The Gem Waster selector at its lower-interior cost 3, interior cost 10, and
maximum cost 35 now matches the full source screen in both themes at 1440x900,
1366x768, and 1920x1080. Cost 3 and cost 10 both show enabled arrows and their
images; cost 35 disables the increase control and omits its image. The six
lower-interior cost-3 captures matched in both themes across the three
viewports. Other selector states and resolutions remain open.

## Craft flow

Scripts/Define/functions.js computes Gems used through Gem Waster, supports a bulk loop while Shift is held, subtracts and rounds Gems per attempt, and replaces the current tool only when new damage is strictly greater. Each successful replacement logs before saving; a dud emits a message containing the crafted P, Q, and damage values. A bulk craft saves at each successful replacement, so successive saves can contain different Gem balances and pickaxes; the pinned two-replacement case captures 3 Gems with `Bad Mud Pick`, then 0 Gems with `Sturdy Mud Pick`. Duds and unaffordable attempts do not save. The captured `fractional-gem-balance-rounds-after-spend` case shows that subtracting one Gem from 2.6 rounds the balance to 2, an observable legacy quirk to preserve.

## Gem Waster craft selector

**Verified legacy behavior:** `index.html` shows the two arrow buttons only when the Money Gem Waster level is above zero. The selected level starts at zero. The left button decrements it and is disabled exactly at zero; its image is present only above zero. The right button increments it and is disabled exactly when `usedGemsLevel === upgrades.gemWaster.level + gemUpgrades.gemWaster.level`; its image is present only below that sum. Preserve those equality checks and image conditions. The displayed Gem cost is `functions.getUsedGems()`, evaluated through the Money Gem Waster effect (`floor(3.3^usedGemsLevel)`) and formatted by `formatThousands`.

The pinned `pickaxeCraftingSemantics.craftControls` capture records no controls before buying Money Gem Waster, costs `1`, `3`, `10`, and `35` at levels 0 through 3 for Money level 1 plus Gem-upgrade level 2, both boundary button states, and the observed increase/decrease sequence. Beyond mirrors it with `getRemixCraftGemSelectionControls()` and the platform-independent `changeCraftGemLevel` action. Clicking a selector arrow has no immediate save effect; the normal source save timer serializes the game state later. Beyond keeps this selection in its versioned save and legacy export.

The source-paired `better-craft-replaces-and-saves` browser case continues from the matched replacement screen into Settings and compares the complete source and Beyond legacy export bytes and decoded objects. A second source-paired live case runs `bulk-success-dud-then-insufficient` under Shift in Chromium, Firefox, and WebKit: both apps consume the same 20 RNG values, show the captured success/save/dud/insufficient message order, persist the captured one-Gem replacement snapshot, and export byte-identical final live state after the remaining attempts. This adds browser integration evidence to the captured bulk intermediate writes; other bulk sequences and viewports remain open.

The successful single-craft path has a functional, non-raster differential in Chromium, Firefox, and WebKit. The baseline case compares the visible success feedback and equipped pickaxe, consumes the captured RNG count, then compares the complete Settings export bytes and decoded save against pinned Remix and the captured replacement snapshot. A second case starts with Money Gem Waster level 1, confirms the loaded legacy selection resets to 0, raises it to 1 through both UIs, checks the captured cost of 3 Gems, and compares the successful craft, RNG count, and complete Settings exports against the `selected-gem-level-controls-craft-cost` capture. The dedicated browser command covers both cases. The separate strict screenshot test remains Chromium-only; its WebKit run stopped at a full-screen pixel hash mismatch before reaching the export assertions, so no cross-engine visual parity is claimed here.

The maximum selector state now has a separate functional source differential. The pinned capture combines Money Gem Waster level 1 with the Gem-upgrade Gem Waster level 2, selects level 3, spends 35 Gems, and replaces the Toy Pickaxe with the recorded Normal Mud Pick after ten RNG draws. The live test advances both imported sessions from the default selection to level 3, checks the cost and disabled increase arrow, then compares feedback and full Settings export bytes/objects in Chromium, Firefox, and WebKit. Other maximum-level craft inputs remain open.

The interior level-two selection now has a separate persisted-craft differential. The pinned `interior-selected-gem-level-controls-craft-cost` capture combines Money/Gem Gem Waster levels 1/2, spends 10 Gems, and replaces the Toy Pickaxe with `Sturdy Mud Pick` after ten RNG draws. The live test advances both apps to level 2, checks the captured cost and still-enabled increase control, then compares success feedback, equipped pickaxe, draw count, and complete Settings export bytes/objects. The case passes in Chromium, Firefox, and WebKit; other selector-level craft inputs remain open.

The source-paired visual cases also snapshot persistence immediately before and after each attempt. In all three viewports and both themes, equal- and lower-damage duds leave Remix's `IdleMine` string and Beyond's primary and backup strings unchanged; the insufficient-Gem branch also leaves all three unchanged. The focused Chromium comparison passed 18/18. The dud branches still spend Gems in live state, as covered by the transition assertions; this check specifically verifies that the source's no-save behavior is preserved.

**Known legacy quirk:** `functions.getSaveString()` serializes `usedGemsLevel`, but `functions.loadGame()` does not assign that field from `loadObj`. Loading a legacy save into a fresh game therefore leaves the default selection at zero; loading into an existing game leaves its current selection unchanged. `tests/e2e/legacy-save-optional-groups.spec.ts` now imports a save with a conflicting serialized value and compares the live selector, displayed cost, and complete export against Remix in Chromium, Firefox, and WebKit. Beyond's legacy application must preserve this source behavior instead of restoring the serialized legacy field during import.

## RNG

The source calls Math.random directly in crafting and naming, and the normal object/drop logic also has random calls. The procedural generator has its own seeded Random implementation. Beyond injects an explicit RNG service; reference random-call order is compatibility-critical. The repeated-sample fixture and matching test cover a baseline one-Gem state and an upgraded 25-Gem/Expertise state, across three fixed 32-bit LCG seeds each.

## Tests required before implementation is considered complete

- Fixed state and controlled sequence of random values.
- Minimum, average, and sampled craft outputs.
- Quality roll stopping and 15-roll limit.
- Name branches and edge quality tiers.
- Expertise bonus and bulk craft behavior.
- Gem consumption, insufficient gems, dud feedback, and strict greater-than replacement.
- Repeated reference samples for baseline and upgraded states, including RNG histograms and sample-size-based frequency bounds; broader progression states remain future coverage.

## Prior art warning

Remux's generator sets quality to 1 and calculates power from input gems × 20 × one random value. That is not the Remix algorithm and must not be ported as the compatibility implementation.

## Strict craft replacement boundary

The pinned functions.craftPick() result now has a source-captured lower-than-equipped case as well as the equal-damage dud and stronger replacement. With the same ten recorded random draws, the crafted Bad Mud Pick deals 31.185000000000002: it replaces Toy Pickaxe damage 20, is a dud at equal damage, and is a dud against Higher Damage Pickaxe damage 31.5. tests/parity/pickaxe-crafting.test.ts asserts the above/equal/below relation and save/pickaxe outcomes; tests/e2e/pickaxe-crafting-visual.spec.ts compares the four craft outcome Mining screens with pinned Remix in both themes at 1440x900 and 1366x768, and all four outcomes also match at 1920x1080.

**Unowned selector branch (2026-11-08):** When the Money Gem Waster is unowned (level 0), the pinned source hides both selector arrows even if the Gem-upgrade Gem Waster is level 2. The captured displayed cost is 1. ests/e2e/pickaxe-crafting-visual.spec.ts compares this state against Remix at 1366x768, 1440x900, and 1920x1080 in both themes; all six full-screen pairs passed. Other selector states and resolutions remain open.

**Mixed-outcome stale bulk craft (2026-11-09):** a captured Shift sequence
succeeds once, then produces a dud and an insufficient-Gem result. Only the
successful replacement saves, leaving Bad Mud Pick / 1 Gem persisted while
the live state ends at 0 Gems. The source-paired cross-tab test checks that
Beyond's primary preserves this intermediate save, its backup retains the
newer purchase, and both match Remix in Chromium, Firefox, and WebKit.
