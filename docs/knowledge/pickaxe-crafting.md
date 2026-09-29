# Pickaxe and crafting compatibility

## Non-negotiable rule

Remix crafting is stochastic and procedural. A pickaxe can be a dud. The current pickaxe is replaced only when a new pickaxe has strictly greater damage. Preserve the generated name, power, quality, damage, bonus, gem consumption, roll order, and dud feedback.

## Source-observed model

A pickaxe stores name, power, and quality. Damage is power × quality. Scripts/pickaxe.js computes a gem power multiplier equivalent to (gems − 1) / 5 + 1, then calculates power and quality using the money upgrades, gem input, and random rolls. Blacksmith Expertise adds 15% power per applied bonus point.

Quality receives repeated 1.15 multipliers on successive 50% rolls, stopping on the first failure or at the loop limit of 15. Names depend on quality tier, a random name form, and sometimes a nearby mine object. A name may include a bonus suffix.

`Pickaxe.generateName()` reads `game.mineObjects[id]` directly. If that entry is missing, it calls `functions.generateMineObject(id)` rather than `functions.getMineObject(id)`. Therefore an exact special-mine anchor can be bypassed during pickaxe naming: the controlled `pickaxeCraftingSemantics` case selects ID 210, where the pickaxe name uses the generated `HD 4943-b` fallback even though the mine-object catalog's ID 210 is `Galaxy Supercluster`. Preserve this source-observed distinction.

The average and minimum-craft display paths use a separate deterministic average mode. Do not use that mode as the implementation for a real craft.

## Implemented compatibility slice

`packages/core/src/remix-pickaxe-crafting.ts` reproduces random candidate generation, minimum/average display calculations, and the source craft transaction. The fixtures control five candidate sequences covering the baseline object-name path, generated-word naming, Blacksmith Expertise bonus, a 15-roll quality streak, and the procedural fallback name at a special-anchor ID. Transaction scenarios cover strict replacement, equal-damage duds, insufficient Gems with no RNG use, Shift bulk crafting, save/log order, and fractional Gem rounding. Tests compare exact state, feedback, and draw counts.

The caller supplies the source upgrade context, RNG, and a name resolver that preserves the source's direct base-array lookup versus generated fallback. The core transition returns ordered events; `packages/formatting` renders the source success, dud, and insufficient-Gem messages. Persistence remains an injected save effect for application wiring. Repeated-sample RNG distributions, full UI behavior, and E2E crafting coverage remain incomplete, so crafting parity is in progress.

## Craft flow

Scripts/Define/functions.js computes gems used through Gem Waster, supports a bulk loop while Shift is held, subtracts and rounds Gems per attempt, and replaces the current tool only when new damage is strictly greater. Each successful replacement logs before saving; a dud emits a message containing the crafted P, Q, and damage values. The captured `fractional-gem-balance-rounds-after-spend` case shows that subtracting one Gem from 2.6 rounds the balance to 2, an observable legacy quirk to preserve.

## RNG

The source calls Math.random directly in crafting and naming, and the normal object/drop logic also has random calls. The procedural generator has its own seeded Random implementation. Beyond will inject an explicit RNG service; reference random-call order is compatibility-critical.

## Tests required before implementation is considered complete

- Fixed state and controlled sequence of random values.
- Minimum, average, and sampled craft outputs.
- Quality roll stopping and 15-roll limit.
- Name branches and edge quality tiers.
- Expertise bonus and bulk craft behavior.
- Gem consumption, insufficient gems, dud feedback, and strict greater-than replacement.
- Distribution tests based on repeated reference samples, with tolerances justified by sample size.

## Prior art warning

Remux's generator sets quality to 1 and calculates power from input gems × 20 × one random value. That is not the Remix algorithm and must not be ported as the compatibility implementation.
