# Upgrade formulas and purchase behavior

This is the current source-backed inventory for the pinned Remix upgrades. It records source behavior and formulas; it does not certify Beyond implementation parity. The exact revision is in the [reference manifest](sources/reference-manifest.json).

## Upgrade inventory

Remix defines 29 upgrades across four resource families. A missing explicit cap means `Infinity` through the base `Upgrade` constructor. The full captured names, resource IDs, caps, and sampled prices/effects are in [`upgradeSemantics`](../../tests/fixtures/parity/remix-reference-corpus.json).

`L` is the requested level. Products, powers, rounding and `Decimal` construction follow the source expression order. Cross-family dependencies are listed after the tables.

### Money upgrades

| Key               | Player-facing name   |        Cap | Price                               | Effect                                                       |
| ----------------- | -------------------- | ---------: | ----------------------------------- | ------------------------------------------------------------ |
| `blacksmith`      | Blacksmith           | `Infinity` | `30 × 1.2^L + 75L`                  | `(20 × 1.09^L + 10L) × Blacksmith+ × Power of Craftsmenship` |
| `blacksmithSkill` | Blacksmith Skill     | `Infinity` | `80,000 × 3^L`                      | `(0.9 + 0.05L) × Blacksmith Skill II × Power of Expertise`   |
| `blacksmithBonus` | Blacksmith Expertise |         10 | `1,000,000 × 5^L`                   | `floor(random < 0.25 && L > 0 ? random × L : 0)`             |
| `gemChance`       | Gem Chance           |         20 | `200 × 2.5^L`                       | `0.02 + 0.004L + Gem Chance II + Gem Chance III`             |
| `activePower`     | Active Power         | `Infinity` | `1,000 × 2^L`                       | `(1 + 0.15L) × 1.03^L`                                       |
| `idlePower`       | Idle Power           | `Infinity` | `200 × 2^L`                         | `(0.75 + 0.25L) × 1.03^L × Idle Power II`                    |
| `idleSpeed`       | Idle Speed           |         60 | `50 × 2.2^(L + 3 × max(0, L - 50))` | `1.05^L`                                                     |
| `gemWaster`       | Gem Waster           |         10 | `90,000,000 × 2000^(L²)`            | `floor(3.3^L)`                                               |

### Gem upgrades

| Key               | Player-facing name  |        Cap | Price                                                                                                                                               | Effect                                                              |
| ----------------- | ------------------- | ---------: | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `blacksmith`      | Blacksmith+         | `Infinity` | `(100 + 7L) × 1.025^max(0, L - 25)`                                                                                                                 | `1.08^L`                                                            |
| `blacksmithSkill` | Blacksmith Skill II |         50 | `Utils.roundBase(250 × (280/250)^L, 1)`                                                                                                             | `(1 + 0.1L)^1.1131`                                                 |
| `idlePower`       | Idle Power II       |        100 | `(100 + 10L) × 1.01^max(0, L - 50)`                                                                                                                 | `(1 + 0.15L)^1.2518`                                                |
| `gemWaster`       | Gem Waster+         |          5 | `10,000 × 45^L`                                                                                                                                     | `L`                                                                 |
| `gemChance`       | Gem Chance II       |         80 | `(50 + 30L)^1.3354 × 1.125^max(L - 30, 0)`                                                                                                          | `0.005L`                                                            |
| `gemMultiply`     | Gem Multiplication  | `Infinity` | `((1000 × 1.05^L × (1 + 0.02 × max(L - 250, 0)) + 1200L) × (1 + 0.01 × max(L - 1000, 0)) × (1 + 0.02 × max(L - 2500, 0)) × 1.002^max(L - 10000, 0)` | See [mining factors](mathematics.md#mining-related-upgrade-factors) |
| `offlineGems`     | Offline Gems        |         15 | `4444 × 4^L`                                                                                                                                        | `0.05L`                                                             |

### Planet Coin upgrades

| Key           | Player-facing name                |        Cap | Price               | Effect         |
| ------------- | --------------------------------- | ---------: | ------------------- | -------------- |
| `activePower` | Active Power                      |         10 | `100 × 10^L`        | `0.01L`        |
| `gemMultiply` | Gem Multiplication Multiplication | `Infinity` | `100 × 7.77^L`      | `1 + 0.1L`     |
| `lastObjGems` | Gem Bonus                         |         19 | `1,000,000 × 100^L` | `1 + L`        |
| `gemChance`   | Gem Chance III                    |         50 | `1000 × 1.4^L`      | `0.01L`        |
| `offlinePC`   | Offline Planet Coins              |         10 | `10,000 × 10^L`     | `0.05L`        |
| `offlineTime` | Offline Time                      |         42 | `10,000 × 4^L`      | `L` hours      |
| `bulkCraft`   | Bulk Crafting                     |         99 | `10^12 × 10^L`      | `1 + L` crafts |

### Wisdom upgrades

| Key                   | Player-facing name        |        Cap | Price                                    | Effect                                                              |
| --------------------- | ------------------------- | ---------: | ---------------------------------------- | ------------------------------------------------------------------- |
| `powerPowerActive`    | Power Power (Active)      | `Infinity` | `(1000^L)^(1.05^max(0, L - 50))`         | `1 + 0.00005 × cbrt(L) × Power Power Power`                         |
| `powerPowerIdle`      | Power Power (Idle)        | `Infinity` | `(1000^L × 1000)^(1.05^max(0, L - 50))`  | `1 + 0.00002 × cbrt(L) × Power Power Power`                         |
| `damageBoost`         | Increasing Damage Boost   |         20 | `(512^(L + 2))^(1 + L/2)`                | See [mining factors](mathematics.md#mining-related-upgrade-factors) |
| `gemBoostSimple`      | Simple Gem Boost          |         10 | `(10^10)^(L^1.2) × 10^10`                | `1 + 0.5L`                                                          |
| `damageBoostUpgrades` | Upgrade Damage Upgrade    |         10 | `(10^25)^L × 10^50`                      | See [mining factors](mathematics.md#mining-related-upgrade-factors) |
| `powerPowerPower`     | Power Power Power!        | `Infinity` | `((10^10)^(L²) × 10^100)^max(1, L - 10)` | `1 + 0.03L`                                                         |
| `powerResetKeep`      | Power Prestige Retainment |         10 | `(10^25)^(L²) × 10^25`                   | `0.5 + 0.5 × (1 - 0.9^L)`                                           |

### Cross-upgrade dependencies

**Verified legacy behavior (source):**

- Money Blacksmith multiplies by Gem Blacksmith and Power of Craftsmenship (the game's displayed spelling). Money Blacksmith Skill multiplies by Gem Blacksmith Skill and Power of Expertise.
- Money Gem Chance adds the effects of Gem Chance II and Planet Coin Gem Chance III. Money Idle Power multiplies by Gem Idle Power II.
- Gem Multiplication uses Planet Coin Gem Multiplication, Wisdom Simple Gem Boost, and the current Power of Exquisity value before `Decimal.round`.
- Wisdom Power Power (Active/Idle) uses the current Power Power Power effect. Wisdom Upgrade Damage Upgrade uses the sum of all purchased Wisdom upgrade levels, including unrelated Wisdom upgrades.
- Wisdom Increasing Damage Boost reads `game.highestMineObjectLevel`, not the current object's ID.
- Price and effect functions can be called beyond a cap; purchase logic enforces the cap. Do not mistake a probe at `cap + 1` for a reachable purchase.

**Project implementation status:** `packages/core/src/remix-upgrades.ts` evaluates all 29 pinned price/effect definitions and caps. Its 249 level snapshots, nine cross-upgrade effect outputs, and five controlled Blacksmith Expertise outcomes are covered in Vitest and the Chromium parity harness. The mining-factor calculator delegates to this evaluator. `packages/core/src/remix-upgrade-purchases.ts` applies immutable single and bulk purchase transitions for all four resource families, and `performRemixSimulationAction()` composes them into the full state. Vitest compares all 14 captured source cases at both the transition and composition boundaries; game UI integration and browser interaction tests remain open.

## Purchase behavior

`Scripts/upgrade.js` defines the shared purchase rules; `Scripts/Components/upgrade.js` maps player input to them.

The source resource IDs recorded in the fixture are `0` Money, `1` Gems, `2` Planet Coins, and `3` Wisdom.

- `maxLevel` defaults to `Infinity`; `getMaxLevel()` evaluates a function-valued cap if supplied. All 29 caps in the pinned `game.js` are static numbers or the default `Infinity`.
- `currentPrice()` calls `getPrice(this.level)`. A purchase requires `level < getMaxLevel()` and sufficient currency.
- A normal buy compares exact current price with the selected resource. A rounded buy compares `currentPrice().round()` with `resource.round()` and subtracts the rounded price.
- On success, `onBuy()` runs before resource subtraction and before the level increments. The base hook is empty, and no upgrade definition in the pinned `game.js` supplies a custom `onBuy` hook. After subtraction, global `isNaN(resource)` resets the resource to Decimal zero; the upstream comment says “negative,” but the condition checks NaN.
- `buyN(n, false, round)` buys up to exactly `n` levels, stopping on unaffordability or the cap. `buyN(n, true, round)` stops when the resulting level is divisible by `n`, with at most `n` successful purchases. Thus `buy10` and `buy100` align to the next multiple, rather than always buying exactly that count.
- `buy10(round)` and `buy100(round)` pass the optional rounding choice through to `buy`. The upgrade component calls them without an argument, so its Shift/Control shortcuts use exact prices. Control takes precedence over Shift; an ordinary click buys one level.
- Base display behavior says `Max` when the level is no longer below the cap and shows a finite `level/cap`; family display templates may format current and next effects differently.

`buy()` selects Money, Gems, Planet Coins, or Wisdom from the `resource` field and returns whether a level was purchased. Keep UI affordance code separate: the generic upgrade component's `canAfford()` checks Money, Gems, and Planet Coins, while Wisdom presentation follows a separate component path.

The Blacksmith Expertise effect consumes one `Math.random()` value for its chance comparison on every effect call, including level zero. It consumes a second value only when the first is below 0.25 and the level is positive. Preserve that draw count/order behind the injected RNG boundary; a level and seed alone do not define a static effect snapshot.

## Reference capture and open work

`upgradeSemantics` in the oracle fixture records 29 upgrades and 249 price/effect level samples. Finite caps include `cap - 1`, `cap`, and `cap + 1`; additional samples straddle the source softcaps at Money Idle Speed 50, Gem Blacksmith 25, Gem Chance II 30, Gem Multiplication 250/1000/2500/10000, Wisdom Power Power 50, and Wisdom Power Power Power 10. Other levels use controlled state with all unrelated upgrade levels zero, all five Power values at 1, and highest mine-object level 171. Five interaction scenarios add nine effect outputs for cross-family upgrades and Power dependencies, total Wisdom levels, and highest mine-object level. `blacksmithBonus` prices and cap are recorded, while its `stochasticEffect: true` marks the absent level-only result; five separate controlled RNG cases record effect values and exact draw counts.

Vitest compares the 249 prices/effects and interaction/RNG outputs. Chromium compares those outputs exactly against the pinned runtime. Node's `Math.pow` differs from Chromium by one ULP for `gems.idlePower` at level 99; the Node check uses a narrow tolerance only for that sample, while the browser check remains exact. Do not add rounding to the game formula to hide the runtime difference.

`purchaseSemantics` contains 14 controlled Remix outcomes: exact and insufficient affordability; Money, Gems, Planet Coins, and Wisdom resource selection; rounded affordability that leaves a negative balance; cap blocking; `buyN` affordability, alignment, and cap stopping; and `buy10`/`buy100` from zero and near an alignment boundary. Beyond's pure core operation returns the resulting levels/resources, successful-purchase count, and the source return value (`buy` returns a boolean; bulk methods return no value, normalized to `null`). Captured transitions compare exactly in Vitest. **Project API guard:** Beyond throws `RangeError` for a non-finite bulk count to prevent unbounded iteration; the canonical upgrade UI only requests fixed counts of 10 or 100, so this guard does not change a player-facing Remix operation. The upgrade UI, modifier-key input, affordability styling, and browser interaction remain unimplemented.

The fixture source paths are `Scripts/Define/game.js`, `Scripts/upgrade.js`, `Scripts/utils.js`, and `Scripts/main.js` at the pinned Remix commit. `main.js` assigns the Power indices used by the controlled dependency captures. Recreate/verify it with `pnpm reference:preview`, `pnpm reference:extend` when a new top-level field is added, and `pnpm test:reference`. Do not edit the canonical checkout.
