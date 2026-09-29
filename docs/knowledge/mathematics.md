# Mathematical behavior

The formulas below are source observations from the pinned Remix revision. They are not a permission to implement an approximation: preserve the reference library, operation order, conversions, and rounding behavior, then compare exact outputs.

## Damage

In `Scripts/Define/functions.js`:

- Pickaxe damage is `power × quality` (`Scripts/pickaxe.js`).
- Active damage is `max(0, pickaxeDamage × (Active Power × Mining Power × Upgrade Damage Upgrade) − target.defense) + currentIdleDps × Planet Coin Active Power`.
- Idle damage is `max(0, pickaxeDamage × Idle Power × Mining Power × Increasing Damage Boost × Upgrade Damage Upgrade − target.defense)`.
- Idle DPS is current-object idle damage multiplied by Idle Speed.

Preserve the source's multiplication order. `getActiveDamage(obj)` uses `obj.def` for its direct hit but calls `getIdleDPS(obj)`, whose implementation ignores the argument and calculates from `game.currentMineObject`. This is verified in the controlled `currentObjectArgumentQuirk` fixture and reproduced by the core API. Upgrade-effect calculation remains separate from the rate functions: the tested API receives evaluated effects explicitly.

## Earnings

- Money per click returns zero when active damage is not positive. Otherwise it divides object value by `ceil(totalHp / activeDamage)`.
- Money per second returns zero when idle damage is not positive. Otherwise it computes `Decimal(1 / ceil(totalHp / idleDamage)) × idleSpeed × object.value`.
- Gems per second has no zero-damage guard. It computes `hits = ceil((totalHp / idleDamage).toNumber())`, `seconds = hits / idleSpeed`, then `1 / seconds × Gem Multiplication × Gem Chance × last-object multiplier`.
- Planet Coins per second returns zero when the current object has no Planet Coin drop. Otherwise it uses the same hits/time path as gems and multiplies by the object's drop amount and chance.

Remix uses JavaScript Number conversion in its hit-count and time calculations. Keep the conversion boundaries, `Math.ceil`, Decimal operation order, and the distinct MPS/GPS guards. Do not replace the rate equations with damage-per-second approximations.

## Implemented compatibility slice

`packages/core/src/mining-rates.ts` implements the captured damage and rate functions with all upgrade/power effects injected as values. The reference probe supplies four controlled configurations: initial Mud, a last-damageable object with a gem bonus, an upgraded Planet Coin object, and THE UNIVERSE with zero damage. Exact Decimal output is asserted in `tests/parity/mining-rates.test.ts`. A separate test preserves the explicit-target/current-object argument quirk. This does not implement upgrade effect progression, hit application, random rewards, object navigation, or the mining loop. Broader precision/threshold and reachable-save coverage remains open.

## Crafting math

See [pickaxe crafting](pickaxe-crafting.md) for the source operation order. Big-number division and implicit JavaScript conversions are compatibility-sensitive.

## Decimal compatibility

The pinned Remix requests `break_infinity.js` without a version in `index.html`. The frozen CDN response resolves to **2.2.0**; its exact URL and SHA-256 are recorded in [runtime dependencies](sources/runtime-dependencies.json). `packages/core/src/decimal.ts` is Beyond's only import boundary and currently re-exports that exact npm version. Do not replace it or normalize serialized values until a complete golden corpus establishes equivalence.

### Verified legacy behavior

The controlled [Decimal corpus](../../tests/fixtures/parity/remix-reference-corpus.json) covers construction, arithmetic, comparison, rounding, powers, logarithms, conversion, and JSON serialization. It records these compatibility-sensitive results:

- `JSON.stringify(decimal)` emits a JSON string containing `decimal.toString()`. Passing the parsed string back to `new Decimal(...)` round-trips the sampled values.
- Decimal values can retain magnitudes outside JavaScript Number range; `toNumber()` overflows or underflows independently of the Decimal value. For example, `1e10000` remains representable while conversion returns Infinity; `1e-325` converts to zero.
- `Decimal.MAX_VALUE` has exponent `9e15` and stringifies as `Infinity`; `Decimal.MIN_VALUE` has exponent `-9e15` and stringifies as `0`. These are extreme library sentinels, not ordinary progression values.
- `Decimal.round(-0.5)` returns zero while `toFixed(0)` on the same value returns `-1`. Do not substitute one rounding path for another.
- `0.pow(-1)` returns zero. NaN comparisons may throw, and some NaN arithmetic paths return zero. These probe cases are documented for exact reproduction if reachable; ordinary player reachability is unverified.
- A subtraction can hold a negative-zero mantissa while stringifying and serializing as `0`. Preserve the library's observable string save format.

### Project decision

Keep `break_infinity.js@2.2.0` behind the core facade for the initial parity implementation. Number notation and display formatting remain a separate presentation concern. Any future numeric-library replacement requires comparative golden tests for every operation the Remix uses, serialization, and all relevant edge behavior.

## Number formatting

### Verified wrapper behavior

`Scripts/Define/functions.js` defines three distinct player-facing paths, and `Scripts/main.js` registers 40 formatters at the pinned revision. The [notation boundary corpus](../../tests/fixtures/parity/remix-reference-corpus.json) records direct formatter results and wrapper results across small values, 1,000 and 1e12 boundaries, SI transitions, and Idle Mine suffix transitions.

- `formatNumber` defaults its limit to 1,000 and `below1000` precision to zero. Only Standard, Scientific, and Engineering use that limit. They call the formatter only when `n > limit`; otherwise values below 1,000 use locale grouping with `below1000` digits and values at or above 1,000 use grouping with zero digits. The exact limit therefore stays grouped.
- For other formatter names, `formatNumber` calls the selected formatter directly and does not use its `limit` argument. This is observable with Idle Mine Notation at 1e12.
- `formatThousands` defaults its limit to 1e12 and uses the selected formatter when `n >= limit`. Below that boundary it converts to JavaScript Number and calls `toLocaleString("en-us")` with fixed minimum and maximum digits. This conversion can overflow for large Decimal values.
- `formatPercent` multiplies by 100 before passing the value to `formatNumber`; the default precision is two digits.
- `Scripts/main.js` starts with six AD Notations formatters, adds nonduplicate AD Community Notations formatters, then appends Idle Mine Notation, SI Notation (Current), and SI Notation (2022). Preserve the registered display names and order.

### Verified custom notation boundaries

- Idle Mine Notation computes `order = max(0, floor((log10(value) - 1) / 9))`, selects one of 12 legacy suffixes, then falls back to Standard notation once the list is exhausted. Probes include every suffix transition from exponent 10 through 100.
- The current SI formatter uses long labels only while the exponent is below 27; SI Notation (2022) uses long labels while it is below 33 and includes Ronna and Quecca. The corpus checks their divergent output from exponent 27 onward and repeated short-label output at larger values.
- AD Community Notation's shared base has separate formatting paths below exponent -300, below exponent 3, and at or above `Decimal.MAX_VALUE`. Its exponent helper also branches at 1e5 and 1e9; captured samples straddle both limits.

All 40 direct formatter outputs were captured for 67 values with no probe exceptions. This is a useful golden matrix, not proof that every formatter's internal threshold or every possible value has been exhausted. Add source-specific boundaries before implementing a formatter whose current class logic remains uncertain.

### Implemented compatibility slice

`packages/formatting` implements all 40 registered formatter classes and reproduces their captured direct, exponent, and wrapper outputs in Chromium. The pinned package's community ESM export list omits `Haha Funny` and `Nice`, although the canonical Remix community UMD defines both. Beyond implements those classes from `Scripts/adcommunitynotations.js` and the three custom formatters from `Scripts/customnotations.js`. Node golden comparisons omit the single engine-sensitive `999.5` Idle Mine Notation sample; Playwright checks that exact output against the Chromium oracle. Formatter UI and visual parity remain incomplete.

The formatting package uses the MIT-licensed `@antimatter-dimensions/notations@1.6.0` dependency credited by Remix. Its ESM import is bridged to Beyond's `break_infinity.js@2.2.0` Decimal facade to match the canonical browser runtime; see [ADR 0008](decisions/0008-notation-compatibility.md). No upstream formatter source or assets have been copied into product code.

## Math evidence

Initial sources: `Scripts/Define/functions.js`, `Scripts/pickaxe.js`, `Scripts/upgrade.js`, `Scripts/Define/game.js`, `Scripts/random.js`, and `Scripts/utils.js`. The exact reference commit is in the manifest. Decimal, seeded RNG, procedural-object, and four controlled mining-rate scenarios are captured and tested. Wider object-ID, exact defense-boundary, full upgrade, crafting, and reachable-save coverage remains pending.

## Controlled initial-state baseline

The pinned runtime corpus captures a fresh, pre-animation Mud state with Money 0, Gems 5, Toy Pickaxe damage 20, Mud HP 100/value 2, active damage 20, idle damage/DPS 15, MPC 0.4, MPS `0.2857142857142857`, GPS `0.0028571428571428567`, and PCPS 0. It also captures four configured rate scenarios and the upgrade effects used in each. Every money, gem, Planet Coin, and Powers upgrade records level-0/current and next cost/effect outputs. The initial notation samples and expanded 40-formatter boundary matrix are recorded alongside Decimal edge arithmetic, rounding, and serialization probes. These remain partial corpora, not a full formula or all-value notation specification. See [the corpus](../../tests/fixtures/parity/remix-reference-corpus.json).
