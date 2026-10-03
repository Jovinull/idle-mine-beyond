# Trace map — progression systems

## Wisdom and Powers

- **Remix source branches:** `game.js` unlocks the Powers table at
  `highestMineObjectLevel >= 170`; `Scripts/Components/powers-table.js:prestigePower`
  raises the next Power to `getPrestigeEffect(i)` only when it is lower, then
  resets the current Power using `powerResetKeep`; its template shows prestige
  when the current/next-Power visibility condition is met and disables it when
  the next Power already reaches the effect.
- **Covered:** `tests/parity/remix-powers.test.ts` maps captured power values,
  unlock and prestige cases; `tests/parity/endgame-phase-differentials.test.ts`
  compares Power state after every action from the Wisdom/stars and galaxy saves;
  `tests/e2e/priority-visual.spec.ts` compares the captured unlock-boundary UI.
- **Sampled (qualified):** the unbounded Power values are sampled, while every
  getPrestigeEffect index and the unlock/row-visibility/disabled boundaries
  have source assertions in remix-powers.test.ts; fixed-seed phase traces
  compare complete Power state and RNG after each action with no divergence.
  Additional screenshot states are tracked separately in the web visual map.

### Powers function and branch trace

| Pinned Remix function/path and branch                                                                                                                              | Source evidence                                                                          | Beyond assertion                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Scripts/Define/game.js:unlocked`: Powers locked below object level 170 and unlocked at/above it                                                                   | `powersTableSemantics.unlock` checks 169, 170, and 171                                   | `tests/parity/remix-powers.test.ts` checks the exact unlock predicate; `tests/e2e/remix-app.spec.ts` enters the live Powers panel at the captured boundary |
| `Scripts/Components/powers-table.js:getPrestigeEffect`: indices 0–2 use their source exponents; Wisdom index 3 uses its logarithmic target                         | `powersTableSemantics.scenarios` captures each index with controlled values              | `tests/parity/remix-powers.test.ts` compares all table-row effects against the pinned outputs                                                              |
| Powers template row visibility: current value reaches 1,000 OR next Power exceeds 1; final row has no next Power/control                                           | `fresh-power-table`, `button-shows-from-next-power-above-one`, and the captured row list | `tests/parity/remix-powers.test.ts` checks visible/hidden state and the no-next row; `tests/e2e/remix-app.spec.ts` asserts rendered prestige rows          |
| Powers template disabled path: visible prestige button is disabled when next Power is at least the effect                                                          | `button-is-disabled-when-next-power-meets-effect`                                        | `tests/parity/remix-powers.test.ts` checks `buttonDisabled`; `tests/e2e/remix-app.spec.ts` checks the controlled unlock-boundary UI                        |
| `Scripts/Components/powers-table.js:prestigePower`: each eligible index resets current Power using `powerResetKeep` and raises the next Power to the source effect | `powersTableSemantics.prestiges` captures indices 0–3 and retention level 4              | `tests/parity/remix-powers.test.ts` compares all five Power values after each prestige                                                                     |
| `prestigePower` no-op path: if next Power already meets the effect, preserve both current and next                                                                 | `already-met-next-power-is-unchanged`                                                    | `tests/parity/remix-powers.test.ts` compares the complete unchanged result                                                                                 |

The map covers the source branch conditions above. Other value combinations and
full-screen Power states are still sampled; no exhaustive value-space or visual
claim is made.

## Upgrade costs, caps, and effects

- **Remix source branches:** `Scripts/upgrade.js:Upgrade.buy` dispatches four
  resources, supports rounded and exact affordability, checks max level, runs
  `onBuy`, clamps a negative/NaN resource result to zero, updates the resource,
  and returns success/failure. `buyN` stops on failure or its alignment rule;
  `buy10`/`buy100` request rounded purchases. `getMaxLevel` accepts numeric or
  function caps. Price/effect displays branch at max level. `game.js` defines
  all 29 formulas/caps and the optional Blacksmith Expertise purchase hook.
- **Covered:** all 29 source price/effect definitions at captured levels,
  finite caps/softcaps, 14 purchase cases across resource families and buy
  modes, and nine cross-upgrade effect scenarios in
  `tests/parity/upgrades.test.ts`; display strings in
  `tests/parity/remix-upgrade-display.test.ts`; browser formula checks in
  `tests/e2e/foundation.spec.ts`. UI group routing and live resource dispatch
  are asserted for Money (`blacksmith`), Gems (`offlineGems`), Planet Coins
  (`activePower`), and Wisdom (`powerPowerActive`) in
  `tests/e2e/remix-app.spec.ts`.

### Upgrade function and branch trace

| Pinned Remix function/path and branch                                                                                                                                                    | Source evidence                                                                                                                               | Beyond assertion                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Scripts/upgrade.js:Upgrade.buy` resource selection and writeback for Money, Gem, Planet Coin, and Wisdom                                                                                | `purchaseSemantics` cases `buy-exact-affordability`, `buy-uses-gem-resource`, `buy-uses-planet-coin-resource`, and `buy-uses-wisdom-resource` | `tests/parity/upgrades.test.ts` compares complete result/resource snapshots; `tests/e2e/remix-app.spec.ts` exercises each live UI resource route and checks resulting level/balance |
| `Scripts/upgrade.js:Upgrade.buy` exact affordability: price `<=` balance succeeds; price `>` balance fails without changing level/resources                                              | `buy-exact-affordability`; `buy-below-exact-affordability`                                                                                    | `tests/parity/upgrades.test.ts` asserts both full transitions                                                                                                                       |
| `Scripts/upgrade.js:Upgrade.buy(round)` rounded affordability, rounded debit, and negative-result clamp                                                                                  | `rounded-buy-can-leave-negative-resource`                                                                                                     | `tests/parity/upgrades.test.ts` asserts result, level, and all resource snapshots                                                                                                   |
| `Scripts/upgrade.js:Upgrade.buy` success gate: below cap and affordable; affordability failure; max-level failure                                                                        | success, `buy-below-exact-affordability`, and `buy-is-blocked-at-cap`                                                                         | `tests/parity/upgrades.test.ts` asserts `operationResult`, purchase count, unchanged state, and resulting state                                                                     |
| `Scripts/upgrade.js:Upgrade.buy` invokes `onBuy` only on success                                                                                                                         | all successful and rejected purchase scenarios; pinned upgrade definitions do not override the default no-op hook                             | `tests/parity/upgrades.test.ts` asserts every transition result; no game upgrade config supplies a player-visible `onBuy` effect                                                    |
| `Scripts/upgrade.js:Upgrade.buyN` no-alignment loop, aligned stop, affordability stop, and cap stop                                                                                      | `buyN-without-alignment-stops-on-affordability`, `buyN-with-alignment-stops-at-next-multiple`, `buyN-stops-at-level-cap`                      | `tests/parity/upgrades.test.ts` asserts purchases, final levels, and resources                                                                                                      |
| `Scripts/upgrade.js:Upgrade.buy10`/`buy100` rounded aligned purchases from level zero and from a prior level                                                                             | four `buy10-*` and `buy100-*` fixture cases                                                                                                   | `tests/parity/upgrades.test.ts`; live Shift/Control behavior in `tests/e2e/remix-app.spec.ts`                                                                                       |
| `Scripts/upgrade.js:Upgrade.getMaxLevel` numeric caps; function-valued max-level path                                                                                                    | all 29 source definitions declare numeric or default `Infinity` caps; pinned definitions contain no function-valued cap                       | `tests/parity/upgrades.test.ts` compares all actual content caps; function-valued cap is unreachable from pinned game content and remains outside the content-compatibility claim   |
| `Scripts/upgrade.js:Upgrade.getPriceDisplay` below-cap price and at/above-cap `Max`                                                                                                      | captured `priceDisplay` values include ordinary levels, exact cap, and over-cap save levels                                                   | `tests/parity/remix-upgrade-display.test.ts` compares every source sample and the explicit at/above-cap states                                                                      |
| `Scripts/upgrade.js:Upgrade.getEffectDisplay` next-level arrow below cap versus current effect only at cap                                                                               | captured `effectDisplay` values include below-cap and cap states for finite upgrades                                                          | `tests/parity/remix-upgrade-display.test.ts` compares the source strings for all groups                                                                                             |
| `Scripts/upgrade.js:Upgrade.getLevelDisplay` finite-cap suffix versus uncapped level-only display                                                                                        | captured level labels cover finite and `Infinity` definitions                                                                                 | `tests/parity/remix-upgrade-display.test.ts` compares source labels across Money, Gem, Planet Coin, and Wisdom definitions                                                          |
| `Scripts/upgrade.js:GemUpgrade.getPriceDisplay`, `Scripts/upgrade.js:PCUpgrade.getPriceDisplay`, and `Scripts/upgrade.js:WisdomUpgrade.getPriceDisplay` resource suffix/prefix overrides | group display strings in each `upgradeSemantics.groups` section                                                                               | `tests/parity/remix-upgrade-display.test.ts` compares captured labels, including resource-specific suffixes                                                                         |
| `Scripts/Define/game.js` Blacksmith Expertise custom effect text: capped `+N` versus below-cap `+N → +(N+1)`                                                                             | `upgradeSemantics.groups.money.blacksmithBonus.samples[*].effectDisplay` at levels 9, 10, and 11                                              | `tests/parity/remix-upgrade-display.test.ts` checks ordinary, cap, and over-cap labels                                                                                              |
| `Scripts/Components/upgrade.js:canAfford` Money/Gem/Planet Coin routing; generic component's Wisdom/default false path                                                                   | purchase resource cases and source template routes; Wisdom upgrades use `upgrade-standalone`, not this component                              | `tests/e2e/remix-app.spec.ts` checks Money/Gem/Planet Coin balances and the separate Wisdom control; generic Wisdom fallback is unreachable for pinned shop definitions             |
| `Scripts/Components/upgrade.js:buyUpgrade` Control priority, Shift branch, and unmodified single-buy branch                                                                              | source purchase cases plus live modifier UI                                                                                                   | `tests/e2e/remix-app.spec.ts` asserts Control buys 100 before Shift, Shift buys 10, and no modifier buys 1                                                                          |
| `index.html` Planet Coin shop tab gate `highestMineObjectLevel >= 90`                                                                                                                    | pinned predicate at `index.html:62`; source-shaped legacy save inputs set to 89 and 90 to exercise either side                                | `tests/e2e/remix-app.spec.ts` asserts the tab is absent at 89 and visible at 90                                                                                                     |
| `Scripts/upgrade.js:numberStandard`, `thousandsStandard`, and `percentStandard`: exact-cap value versus below-cap current-to-next display                                                | `upgradeSemantics.groups[*][*].samples[*].effectDisplay` captures configured families and finite-cap outputs                                  | `tests/parity/remix-upgrade-display.test.ts` compares each captured current/cap output                                                                                              |
| `Scripts/Define/game.js:getEffectDisplay`: capped current value versus below-cap current-to-next value after the other Gem Waster effect                                                 | `upgradeSemantics.groups.money.gemWaster.samples[*].effectDisplay` captures the levels and resulting text                                     | `tests/parity/remix-upgrade-display.test.ts` compares the captured strings at ordinary and cap samples                                                                              |
| `Scripts/Define/game.js` per-upgrade price/effect/max-level formulas and cross-upgrade reads                                                                                             | 249 source samples, all 29 definitions, finite caps, and nine interaction states                                                              | `tests/parity/upgrades.test.ts` compares named formulas/effects/caps and interaction outputs                                                                                        |

- **Sampled (qualified):** formula/effect values are not captured for every
  non-negative level or cross-upgrade combination. Each pinned formula, finite
  cap/softcap, and reachable purchase branch has source-backed cases in the
  249-level and interaction fixtures; the fixed-seed phase differential also
  compares generated upgrade state and RNG after every action without
  divergence. The non-exhaustive levels alone do not block certification; the
  matrix row remains open for its other evidence layers.

## Pickaxe crafting RNG

- **Remix source branches:** `Pickaxe.craft` selects random versus average
  values, applies the per-Gem quality bonus and Blacksmith Expertise, then runs
  up to 15 quality draws, stopping on the first draw not below 0.5. `functions.craftPick`
  chooses one attempt or Shift bulk count, checks affordability per attempt,
  spends Gems before the result, replaces only on strictly greater damage,
  logs replacement before save, and reports dud/insufficient-Gem results.
- **Covered:** forced RNG sequences and exact draw counts, average/minimum modes,
  buy/replacement/dud/insufficient cases, bulk attempts, intermediate save
  snapshots, and browser interaction cases in
  `tests/parity/pickaxe-crafting.test.ts`,
  `tests/parity/simulation-action.test.ts`, and
  `tests/e2e/remix-app.spec.ts`; source records are in
  `pickaxeCraftingSemantics` and `pickaxeCraftingTransactions` in
  `remix-reference-corpus.json`. Long traces also exercise random crafts.

### Pickaxe craft function and branch trace

| Pinned Remix function/path and branch                                                                                                                                                                      | Source evidence                                                                                                                                                  | Beyond assertion                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Scripts/pickaxe.js:Pickaxe.craft`: average mode skips all randomness and returns the fixed `Average Result`                                                                                               | `pickaxeCraftingSemantics.deterministic.average`, with `randomCalls: 0`                                                                                          | `tests/parity/pickaxe-crafting.test.ts` compares the complete pickaxe snapshot and zero RNG consumption                                                              |
| `Pickaxe.craft`: random mode uses per-Gem quality RNG, optional Blacksmith Expertise bonus, Power/Quality draws, then a quality streak; `< 0.5` multiplies Quality and `>= 0.5` breaks                     | `baseline-object-name`, `expertise-bonus-and-quality-streak`                                                                                                     | `tests/parity/pickaxe-crafting.test.ts` asserts exact name/Power/Quality/Damage and consumed draw count                                                              |
| `Pickaxe.craft`: quality loop ends on first failed roll or at the 15-roll ceiling                                                                                                                          | `baseline-object-name`; `quality-roll-capped-at-fifteen`                                                                                                         | `tests/parity/pickaxe-crafting.test.ts` checks early stop and exactly 15 successful streak rolls plus draw order                                                     |
| `Pickaxe.generateName`: quality tier is clamped into the 14-name table; the TIMES prefix appears only when computed `times > 1`                                                                            | `baseline-object-name`, `generated-word-name`, and `quality-roll-capped-at-fifteen`                                                                              | `tests/parity/pickaxe-crafting.test.ts` compares exact generated names at forced random boundaries                                                                   |
| `Pickaxe.generateName`: strict name-type condition `< 0.3` selects word-name; otherwise choose a mine-object-derived name                                                                                  | `generated-word-name`, `baseline-object-name`, `post-universe-generated-object-name`                                                                             | `tests/parity/pickaxe-crafting.test.ts` checks both name branches, the equality boundary, and generated-object lookup                                                |
| `Pickaxe.generateName`: generated word chooses Pickaxe/Pick and a 4–7 character length; object-name branch clamps the candidate ID and chooses Pickaxe/Pick                                                | same controlled craft records with captured `randomValues` and object-catalog outputs                                                                            | `tests/parity/pickaxe-crafting.test.ts` compares exact names and draw counts; `mineObjectCatalog` supplies fixed names and the test generator handles procedural IDs |
| `Pickaxe.generateName`: bonus suffix only when bonus is positive                                                                                                                                           | `expertise-bonus-and-quality-streak` and zero-bonus craft fixtures                                                                                               | `tests/parity/pickaxe-crafting.test.ts` compares full generated name in both cases                                                                                   |
| `Pickaxe.getDamage`: Power × Quality                                                                                                                                                                       | every `pickaxeCraftingSemantics.crafts` and `attempts[*].result` snapshot                                                                                        | `tests/parity/pickaxe-crafting.test.ts` compares the exact Decimal damage field                                                                                      |
| `Scripts/Define/functions.js:craftPick`: Shift selects bulk-attempt count; each attempt checks Gem affordability; insufficient Gems logs without RNG; affordable attempts round/spend Gems before crafting | `insufficient-gems-consumes-no-rng`, `bulk-success-dud-then-insufficient`, `fractional-gem-balance-rounds-after-spend`, `selected-gem-level-controls-craft-cost` | `tests/parity/pickaxe-crafting.test.ts` compares RNG count, resulting Gems, log order, and save snapshots                                                            |
| `craftPick`: candidate damage strictly greater replaces and saves; equal/lower damage is a dud and does not save                                                                                           | `better-craft-replaces-and-saves`, `equal-damage-is-a-dud`                                                                                                       | `tests/parity/pickaxe-crafting.test.ts` compares equipped pickaxe, feedback, and save count                                                                          |
| `craftPick`: bulk loop continues after success and dud, stops at `times`, and saves each successful replacement using that intermediate pickaxe                                                            | `bulk-success-dud-then-insufficient`, `bulk-replacements-save-each-intermediate-state`                                                                           | `tests/parity/pickaxe-crafting.test.ts` compares ordered events, every saved snapshot, final state, and RNG consumption                                              |

- **Sampled (qualified):** source-forced cases cover the strict Expertise,
  quality-streak, name-type, cap, affordability, replacement, and bulk-stop
  boundaries. The two-state, three-seed corpus adds 512 crafts per seed, and the
  fixed-seed differential compares complete craft-related state and RNG after
  each action without divergence. Non-exhaustive random sequences and Decimal
  magnitudes alone do not block certification. Never replace stochastic
  crafting with deterministic gear tiers.

## Pickaxe naming and replacement

- **Remix source branches:** `Pickaxe.generateName` clamps the quality-name
  index; adds the `TIMES` suffix only above one; chooses generated-word versus
  mine-object-derived name at the strict 0.3 boundary; resolves generated IDs
  from fixed content or `generateMineObject`; independently chooses Pickaxe/Pick;
  appends bonus only when positive. `functions.craftPick` replaces only when
  candidate damage is strictly greater.
- **Covered:** 119 source-captured craft cases cover the lower limit, below/at/
  above every quality floor boundary, both random-offset transitions in every
  region, and the upper clamp. `tests/parity/pickaxe-crafting.test.ts` checks
  robust one-sided cases in Node; `tests/e2e/pickaxe-quality-boundaries.spec.ts`
  compares all exact source results in Chromium. Candidate name forms and
  seeded craft distributions, replacement/dud/bulk outcomes, and visible
  feedback are covered by the same parity test and
  `tests/e2e/remix-app.spec.ts`.

### Pickaxe naming/replacement function and branch trace

| Pinned Remix function/path and branch                                                                                                         | Source evidence                                                                                                                   | Beyond assertion                                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Scripts/pickaxe.js:Pickaxe.generateName`: quality tier floor and clamp to 0..13; `times > 1` suffix boundary                                 | `pickaxeQualityNameBoundaries` captures 119 crafts across quality and RNG-offset boundaries                                       | `tests/parity/pickaxe-crafting.test.ts` compares one-sided cases; `tests/e2e/pickaxe-quality-boundaries.spec.ts` compares all pinned outputs in Chromium                  |
| `generateName`: name-type roll `< 0.3` selects generated-word path; `>= 0.3` selects mine-object name path                                    | `generated-word-name`, `baseline-object-name`, and `post-universe-generated-object-name` forced RNG records                       | `tests/parity/pickaxe-crafting.test.ts` checks both branches, exact RNG consumption, generated words, object names, and post-universe generation                          |
| Object-name branch: clamp generated object ID at zero; use fixed `game.mineObjects[id]` when present and `generateMineObject(id)` when absent | forced name RNG and captured object outputs in `pickaxeCraftingSemantics`/`mineObjectCatalog`                                     | `tests/parity/pickaxe-crafting.test.ts` checks both fixed and procedural name sources; `tests/parity/mine-object-generation.test.ts` checks generator output              |
| `Scripts/Define/functions.js:craftPick`: replace current pickaxe only when crafted damage is strictly greater; equality/lower damage are duds | `better-craft-replaces-and-saves`, `equal-damage-is-a-dud`, and the captured equality case in `pickaxeCraftingSemantics.attempts` | `tests/parity/pickaxe-crafting.test.ts` asserts full pickaxe, Gem, log, and save results for greater-than and false branches (equality is the captured false-branch case) |
| `craftPick` successful replacement order: spend Gems, assign pickaxe, log success, then save; failed craft logs dud and does not save         | `pickaxeCraftingSemantics.attempts` event and intermediate-save snapshots                                                         | `tests/parity/pickaxe-crafting.test.ts` compares ordered effects and persisted intermediate states; `tests/e2e/remix-app.spec.ts` exercises live crafting feedback        |

- **Sampled (qualified):** generated names and quality magnitudes remain
  non-exhaustive, but every quality/RNG floor transition and clamp, the 0.3
  name-type boundary, fixed/procedural object lookup, suffix alternatives, and
  replacement boundary have source cases. Fixed-seed craft samples and the
  per-action source differential add generated inputs without divergence. At
  exact `1.4^5`, pinned Chromium reports `Epic` while Node's `Math.log` can
  round the ratio to 5 and report `Legendary`; the all-boundary Chromium test
  preserves the canonical browser result, and Node checks use values on both
  sides of each transition.

## Random distributions and RNG

- **Remix source branches:** `Scripts/random.js:Random` warms its seeded stream
  for ten draws; `next` updates generation and state; `nextInt` advances before
  modulo; `nextDouble` normalizes by `INT_MAX`. `Scripts/utils.js:choose` and
  `seededChoose` are separate helpers. The pinned source has one seeded
  `new Random(id)` consumer in `generateMineObject`; its direct
  `Math.random()` consumers are pickaxe generation/crafting, `Utils.choose`,
  `MineObject.damage` drops, and the stochastic Blacksmith Expertise effect.
- **Covered:** source-golden seeded streams, repeatability/range properties,
  sequence exhaustion, and pickaxe distribution summaries in
  `tests/parity/remix-random.test.ts` and
  `tests/parity/pickaxe-crafting.test.ts`; random drops and craft draw order in
  `tests/parity/mining-transitions.test.ts`. The action differential uses
  three paired game-RNG/action-sequence seed combinations for each of the three
  captured phase-start saves (nine traces; 90,000 complete state/RNG checkpoints).
- **Sampled (qualified):** empirical distributions are not exhaustive proofs
  of every probability. The map separately tests the source's strict draw
  thresholds and boundary values, the seeded corpus exercises reproducible
  outcomes, and the fixed-seed action differential matches complete state and
  RNG after every action. This residual distribution sample alone does not
  block certification. Seedless source behavior that reads Date.now() is
  separately mapped under time; do not conflate it with the seeded object RNG.

### RNG function and branch trace

| Pinned Remix function/path and branch                                                                                                                                                | Source evidence                                                                                                                                  | Beyond assertion                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Scripts/random.js:Random` constructor with explicit seed and ten warm-up draws                                                                                                      | `randomSemantics[*].seed/draws` records explicit negative, zero, positive, and large seeds                                                       | `tests/parity/remix-random.test.ts` compares the exact mixed draw stream                                                                                                                                          |
| `Random` constructor's `seed === undefined` fallback to `Date.now()`                                                                                                                 | pinned call-site search shows procedural generation always invokes `new Random(id)` with an explicit ID                                          | `tests/parity/mine-object-generation.test.ts` compares that content path; undefined-seed fallback is not reachable from pinned player-facing content                                                              |
| `Random.next`: sequence digit, state recurrence/modulo, generation advance, and sequence exhaustion into `NaN`                                                                       | `randomSemantics` plus `randomSequenceExhaustion`                                                                                                | `tests/parity/remix-random.test.ts` compares exact stream outputs and the 41st-draw exhaustion result                                                                                                             |
| `Random.nextInt`: default bound and explicit modulo bounds; `Random.nextDouble`: normalization by `INT_MAX`                                                                          | mixed `double`, `integer-default`, and bounded `integer` draw records in `randomSemantics[*].draws`                                              | `tests/parity/remix-random.test.ts` compares each draw; fast-check verifies repeatability and `[0,1)` doubles for explicit nonnegative seeds                                                                      |
| `Scripts/utils.js:choose`: random selection of Pickaxe/Pick alternatives; `seededChoose`: source-deterministic object-name selection                                                 | forced craft `randomValues`; pinned procedural corpus includes deterministic object-name outputs                                                 | `tests/parity/pickaxe-crafting.test.ts` compares both pickaxe suffixes; `tests/parity/mine-object-generation.test.ts` compares exact generated names                                                              |
| `Scripts/Define/game.js:upgrades.blacksmithBonus.effect`: always consume the chance draw; strict `< 0.25` and `level > 0` gate a second draw and floored bonus                       | `upgradeSemantics.stochasticEffects.blacksmithBonus` covers zero level, exact threshold, chance failure, second-draw low/high, and level-one dud | `tests/parity/upgrades.test.ts` compares exact effect and RNG draw count for every captured branch                                                                                                                |
| Complete pinned RNG consumer inventory: seeded `Random(id)` in object generation; direct `Math.random()` in `Pickaxe`, `Utils.choose`, `MineObject.damage`, and Blacksmith Expertise | pinned-source call-site search; `pickaxeCraftingSemantics`, `miningHitSemantics`, `randomSemantics`, and stochastic upgrade cases                | `tests/parity/mine-object-generation.test.ts`, `tests/parity/pickaxe-crafting.test.ts`, `tests/parity/mining-transitions.test.ts`, and `tests/parity/upgrades.test.ts` cover the distinct streams and their order |

## Story and notifications

- **Remix source branches:** `functions.storyUnlocked` evaluates each of the 61
  ordered conditions; `storyDisplayed` combines unlock and page equality;
  `getNextStoryText` skips unlocked entries and chooses string/function text;
  `getMaxStoryPage` scans backward and falls back to page 3; increase/decrease
  clamp navigation; `refreshStoryNotifications` advances the high-water index
  and increments notifications for each newly crossed condition;
  `changeTab` stores Story scroll, clears notifications when entering Story,
  restores scroll after 30 ms, and refreshes number selection after 50 ms.
  `payUSDebt` has unaffordable and joke/log branches.
- **Covered:** each condition boundary, dynamic/static next-objective text,
  notification/high-water cases, page clamps, tab delays/scroll, and debt
  outcomes in `tests/parity/story.test.ts`; ordered markup/template/runtime
  fixtures in `tests/parity/story-markup.test.ts`,
  `tests/parity/story-template.test.ts`, and
  `tests/parity/story-runtime.test.ts`; source-equal screenshots and app
  interactions in `tests/e2e/story.spec.ts`,
  `tests/e2e/story-panel.spec.ts`, and `tests/e2e/story-visual.spec.ts`.
- **Sampled (qualified):** the state/value combinations are not exhaustive,
  but all 61 source conditions have boundary assertions, dynamic objective
  outputs are compared across captured mine levels and all 40 notations, and the
  fixed-seed route/differential tests preserve progression state with no
  divergence. Screenshot coverage remains a separate web visual gap; this
  qualification does not claim pixel parity for every reachable Story state.

### Story function and branch trace

| Pinned Remix function/path and branch                                                                                                                                   | Source evidence                                                                                                                        | Beyond assertion                                                                                                                                                |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Scripts/Define/functions.js:storyUnlocked`: evaluate each ordered source condition as false/true at its captured boundary                                              | `storySemantics.conditionBoundaries` contains all 61 conditions and their boundary cases                                               | `tests/parity/story.test.ts` checks the source condition expression and both captured outcomes                                                                  |
| `storyDisplayed`: unlocked condition AND current page matches the milestone page                                                                                        | per-condition cases plus `notificationScenarios[*].visibleMilestonesByPage`                                                            | `tests/parity/story.test.ts` compares exact visible milestone keys per page                                                                                     |
| `getNextStoryText`: skip unlocked conditions; choose static string or dynamic function; return null when every condition is satisfied                                   | `notificationScenarios` includes first/static/dynamic objectives, unsatisfied gaps, and `all-current-milestone-requirements-satisfied` | `tests/parity/story.test.ts` compares next key and exact objective output for each scenario                                                                     |
| `getMaxStoryPage`: reverse-scan for the last unlocked chapter; default page 3 if no condition matches                                                                   | `notificationScenarios[*].maxPage` and `story.initial.maxPage`                                                                         | `tests/parity/story.test.ts` checks fresh, sparse, late, and all-requirements-satisfied states; fallback is unreachable while pinned `gameStart` stays unlocked |
| `increaseStoryPage`/`decreaseStoryPage`: clamp at maximum page and zero                                                                                                 | `notificationScenarios[*].pageNavigation`                                                                                              | `tests/parity/story.test.ts` compares both transitions for each scenario                                                                                        |
| `refreshStoryNotifications`: begin at `highestUnlocked + 1`; advance high-water and increment once per newly satisfied condition                                        | ordered `notificationScenarios` and `notificationSequence`                                                                             | `tests/parity/story.test.ts` compares full before/after state, including the saved-high-water/delayed-visibility quirk                                          |
| `changeTab`: save scroll when leaving Story; clear notifications and schedule scroll restoration at 30 ms when entering; refresh number selection at 50 ms for Settings | all four `storyTabSemantics.scenarios`                                                                                                 | `tests/parity/story.test.ts` compares state, ordered effects, delays, scroll, and selected formatter index                                                      |
| `payUSDebt`: below 22e12 alerts; at/above threshold shows the joke alert and logs an error without charging                                                             | `payUSDebtSemantics` below-threshold and affordable cases                                                                              | `tests/parity/story.test.ts` asserts events and unchanged Money; app interaction in `tests/e2e/story.spec.ts`                                                   |
| Story template: conditional blocks, chapter controls, duplicate milestone blocks, and dynamic objective escaping                                                        | pinned Story markup, ordered condition keys, and objective samples in `remix-story-markup.json`/`storySemantics`                       | `tests/parity/story-markup.test.ts`, `tests/parity/story-template.test.ts`, and `tests/parity/story-runtime.test.ts` compare source order and rendered output   |

## Natural progression route replay

- **Remix source branches:** the route operations map to `clickMineObject`,
  `update`, `Scripts/upgrade.js:Upgrade.buy`, `craftPick`, `setMineObjectLevel`, `saveGame`, and
  ordered Story notification refresh. Chapter 3–6 traces replay captured natural
  route segments; later chapters use controlled source saves, not claimed
  natural routes.
- **Covered:** eight natural route segments compare the complete normalized
  simulation state and RNG at 3,833,896 checkpoints through first Chapter 6
  eligibility. `endgame-phase-differentials.test.ts` replays each of the three
  captured Remix phase-start saves under three paired fixed RNG/action seeds,
  with 10,000 randomized actions per trace: nine traces and 90,000 full
  `RemixSimulationState` and RNG comparisons after every action.
  The natural route checkpoints are asserted in
  `tests/parity/story-natural-route-replay.test.ts`.
  Source action traces are pinned in nine Brotli JSONL fixtures and can be
  regenerated/verified with `pnpm reference:phase-differentials:capture` and
  `pnpm reference:phase-differentials`.
- **Scope:** these are finite integration traces, not a formula/RNG input-domain
  sample or a claim that every action sequence is enumerated. The three
  Chapters 7-9 source saves are intentionally controlled starts per the project
  decision, not fresh-game natural progression claims. Each save has three
  fixed paired RNG/action seeds and 10,000 randomized actions per pair; all five
  action kinds occur, and all 90,000 full state/RNG checkpoints match the
  pinned source. The map's branch tests establish individual transition
  coverage; these traces add multi-action composition evidence.

### Route and randomized differential function and branch trace

| Pinned Remix operation/branch                                                                                            | Source fixture                                                                                                                            | Beyond assertion                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Natural route click/break, reward RNG, selection, upgrade purchase, craft replacement/dud, save event, and Story refresh | eight source route segments through first Chapter 6 eligibility with seed 7454 and captured RNG cursors                                   | `tests/parity/story-natural-route-replay.test.ts` compares full normalized state and RNG at every route checkpoint (3,833,896 total)                                        |
| Each action kind in the replay state machine: click, idle frame, select object, purchase, craft                          | nine Brotli traces from three captured Chapter 7â€“9 phase-start saves, each with three paired game-RNG/action-sequence seed combinations | `tests/parity/endgame-phase-differentials.test.ts` requires every action kind per trace and compares all `RemixSimulationState` fields and RNG after each of 90,000 actions |
| Source differential determinism and fixture integrity                                                                    | pinned action sequences, phase-save hashes, and chained trace hashes in the `remix-phase-differentials` fixture                           | `tests/parity/endgame-phase-differentials.test.ts` checks the fixture metadata; `pnpm reference:phase-differentials` re-executes pinned Remix and verifies all nine traces  |
