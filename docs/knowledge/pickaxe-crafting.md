# Pickaxe and crafting compatibility

## Non-negotiable rule

Remix crafting is stochastic and procedural. A pickaxe can be a dud. The current pickaxe is replaced only when a new pickaxe has strictly greater damage. Preserve the generated name, power, quality, damage, bonus, gem consumption, roll order, and dud feedback.

## Source-observed model

A pickaxe stores name, power, and quality. Damage is power × quality. Scripts/pickaxe.js computes a gem power multiplier equivalent to (gems − 1) / 5 + 1, then calculates power and quality using the money upgrades, gem input, and random rolls. Blacksmith Expertise adds 15% power per applied bonus point.

Quality receives repeated 1.15 multipliers on successive 50% rolls, stopping on the first failure or at the loop limit of 15. Names depend on quality tier, a random name form, and sometimes a nearby mine object. A name may include a bonus suffix.

**Verified RNG order:** each random craft evaluates the Blacksmith Expertise effect after the Gem quality-bonus roll and before the Power and base-Quality rolls. Its first `Math.random()` call occurs even at upgrade level zero. At a positive level, a value below `0.25` causes one additional draw to choose `floor(random * level)` bonus points. The quality streak then consumes one draw per successful multiplier and one final failing draw, unless all 15 rolls succeed. Preserve these calls, including calls whose level-zero result is always zero, because they shift every later name roll.

`Pickaxe.generateName()` reads `game.mineObjects[id]` directly. If that entry is missing, it calls `functions.generateMineObject(id)` rather than `functions.getMineObject(id)`. Therefore an exact special-mine anchor can be bypassed during pickaxe naming: the controlled `pickaxeCraftingSemantics` case selects ID 210, where the pickaxe name uses the generated `HD 4943-b` fallback even though the mine-object catalog's ID 210 is `Galaxy Supercluster`. Preserve this source-observed distinction.

The average and minimum-craft display paths use a separate deterministic average mode. Do not use that mode as the implementation for a real craft.

## Implemented compatibility slice

`packages/core/src/remix-pickaxe-crafting.ts` reproduces random candidate generation, minimum/average display calculations, and the source craft transaction. The fixtures control five candidate sequences covering the baseline object-name path, generated-word naming, Blacksmith Expertise bonus, a 15-roll quality streak, and the procedural fallback name at a special-anchor ID. Seven transaction cases cover strict replacement, equal-damage duds, insufficient Gems with no RNG use, Shift bulk crafting, save/log order, fractional Gem rounding, and Gem-cost selection from the active upgrade level. The pinned browser probe also captures the Gem Waster selector's visibility, costs, arrow images, disabled states, and click transitions at minimum, interior, and maximum levels. Tests compare exact state, feedback, draw counts, and every intermediate save snapshot. `performRemixSimulationAction()` composes these transitions into full core state using injected RNG and the pinned content catalog. The Mining Craft button now dispatches the random action, and the session resolves exact feedback with the active notation while preserving log/save order. Playwright checks replacement, persistence, source message ordering, an insufficient-Gem retry, and Gem Waster selector behavior. A captured Shift bulk case checks the x3 indicator, success/dud/insufficient order, 20 RNG draws, the first-replacement save snapshot, and reload of that saved one-Gem state. Session tests compare bulk intermediate writes and dud/insufficient feedback. The parity corpus now includes two source-controlled states, each sampled with three fixed seeds and 512 crafts per seed; tests compare draw-count and quality-streak histograms, name forms, and Power/Quality/Damage summaries against Remix, with 5-sigma plausibility bounds. Full crafting-panel visual comparison remains open.

The caller supplies the source upgrade context, RNG, and a name resolver that preserves the source's direct base-array lookup versus generated fallback. The core transition returns ordered events; `packages/formatting` renders the source success, dud, and insufficient-Gem messages. The web session interleaves those messages with each injected save effect; each successful replacement is persisted before its `Game Saved!` confirmation. The route inserts new log entries first and preserves Remix's six-entry window. Repeated-sample RNG distributions, Shift bulk UI coverage, and full visual comparison remain incomplete, so crafting parity is in progress.

## Craft flow

Scripts/Define/functions.js computes Gems used through Gem Waster, supports a bulk loop while Shift is held, subtracts and rounds Gems per attempt, and replaces the current tool only when new damage is strictly greater. Each successful replacement logs before saving; a dud emits a message containing the crafted P, Q, and damage values. A bulk craft saves at each successful replacement, so successive saves can contain different Gem balances and pickaxes; the pinned two-replacement case captures 3 Gems with `Bad Mud Pick`, then 0 Gems with `Sturdy Mud Pick`. Duds and unaffordable attempts do not save. The captured `fractional-gem-balance-rounds-after-spend` case shows that subtracting one Gem from 2.6 rounds the balance to 2, an observable legacy quirk to preserve.

## Gem Waster craft selector

**Verified legacy behavior:** `index.html` shows the two arrow buttons only when the Money Gem Waster level is above zero. The selected level starts at zero. The left button decrements it and is disabled exactly at zero; its image is present only above zero. The right button increments it and is disabled exactly when `usedGemsLevel === upgrades.gemWaster.level + gemUpgrades.gemWaster.level`; its image is present only below that sum. Preserve those equality checks and image conditions. The displayed Gem cost is `functions.getUsedGems()`, evaluated through the Money Gem Waster effect (`floor(3.3^usedGemsLevel)`) and formatted by `formatThousands`.

The pinned `pickaxeCraftingSemantics.craftControls` capture records no controls before buying Money Gem Waster, costs `1`, `3`, `10`, and `35` at levels 0 through 3 for Money level 1 plus Gem-upgrade level 2, both boundary button states, and the observed increase/decrease sequence. Beyond mirrors it with `getRemixCraftGemSelectionControls()` and the platform-independent `changeCraftGemLevel` action. Clicking a selector arrow has no immediate save effect; the normal source save timer serializes the game state later. Beyond keeps this selection in its versioned save and legacy export.

**Known legacy quirk:** `functions.getSaveString()` serializes `usedGemsLevel`, but `functions.loadGame()` does not assign that field from `loadObj`. Loading a legacy save into a fresh game therefore leaves the default selection at zero; loading into an existing game leaves its current selection unchanged. Beyond's legacy application must preserve this source behavior instead of restoring the serialized legacy field during import.

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
