# Mathematical behavior

The formulas below are source observations from the pinned Remix revision. They are not a permission to implement an approximation: preserve the reference library, operation order, conversions, and rounding behavior, then compare exact outputs.

## Damage

In `Scripts/Define/functions.js`:

- Pickaxe damage is `power × quality` (`Scripts/pickaxe.js`).
- Active damage is `max(0, pickaxeDamage × (Active Power × Mining Power × Upgrade Damage Upgrade) − target.defense) + currentIdleDps × Planet Coin Active Power`.
- Idle damage is `max(0, pickaxeDamage × Idle Power × Mining Power × Increasing Damage Boost × Upgrade Damage Upgrade − target.defense)`.
- Idle DPS is current-object idle damage multiplied by Idle Speed.

Preserve the source's multiplication order. `getActiveDamage(obj)` uses `obj.def` for its direct hit but calls `getIdleDPS(obj)`, whose implementation ignores the argument and calculates from `game.currentMineObject`. This is verified in the controlled `currentObjectArgumentQuirk` fixture and reproduced by the core API. `calculateRemixMiningRates` receives effect values; `calculateRemixMiningFactors` separately evaluates the captured mining-related upgrade effects from levels and injected Power values.

## Mining-related upgrade factors

**Verified legacy behavior (pinned source and controlled Chromium capture):** `Scripts/Define/game.js` defines the upgrade effects and `Scripts/Define/functions.js` composes them into damage/rate formulas. Let `L` be the corresponding upgrade level:

- Active Power: `(1 + 0.15L) × 1.03^L`.
- Idle Power: `(0.75 + 0.25L) × 1.03^L × Idle Power II`.
- Idle Power II: `(1 + 0.15L) ^ 1.2518`.
- Idle Speed: `1.05^L`.
- Gem Chance: `0.02 + 0.004 × Money Gem Chance level + 0.005 × Gem Chance II level + 0.01 × Gem Chance III level`.
- Gem Multiplication: `round((1.05^L + L) × (1 + 0.1 × Planet Coin Gem Multiplication level) × (1 + 0.5 × Simple Gem Boost level) × Power of Exquisity)`.
- Planet Coin Active Power: `0.01L`.
- Increasing Damage Boost: `1` at level zero; otherwise `(1.05 + 0.03L) ^ max(0, highestMineObjectLevel - 170) × L`.
- Upgrade Damage Upgrade: `(1 + 0.05L) ^ totalBoughtWisdomUpgradeLevels`. Remix's `getBoughtUpgrades` counts all purchased Wisdom upgrade levels, including upgrades unrelated to mining; callers must provide the complete Wisdom-level map.
- The last-object Gem multiplier is `1 + Planet Coin Gem Bonus level` only when the current object ID equals `getHighestDamageableMineObjectLevel()`; otherwise it is `1`.
- Power of Mining is passed in as the current state value. Power of Exquisity is separately injected into Gem Multiplication.

The exact Decimal construction, `pow`, multiplication, addition, and rounding order follows the source expressions. The [upgrade reference](upgrades.md) documents all 29 cost/effect formulas, caps, dependencies, and generic purchase source behavior. Core evaluates all 29 prices, effects, and caps and implements pure single/bulk purchase transitions compared against 14 captured Remix cases. UI and full simulation integration remain open.

The captured multi-upgrade scenario covers Money levels 3/4/5/6, Gem levels 2/3/4, Planet Coin levels 2/1/2/3, all seven Wisdom upgrades at levels 1/2/3/2/2/3/4, Power of Mining 2.5, and Power of Exquisity 2.5. The 17 total Wisdom levels exercise the source's all-upgrades exponent, producing an Upgrade Damage Upgrade factor of `5.054470284992945`; the gem factors include both Planet Coin Gem Multiplication and Simple Gem Boost. The fixture records every resulting factor and rate. Other controlled scenarios exercise defaults, the last-object condition, and the Number overflow case. Finite cap and softcap boundaries for the full 29-upgrade catalog are captured separately in the upgrade fixtures and linked from the parity trace map. The unit parity suite and Chromium harness evaluate factors from captured levels and compare their exact Decimal snapshots.

## Earnings

- Money per click returns zero when active damage is not positive. Otherwise it divides object value by `ceil(totalHp / activeDamage)`.
- Money per second returns zero when idle damage is not positive. Otherwise it computes `Decimal(1 / ceil(totalHp / idleDamage)) × idleSpeed × object.value`.
- Gems per second has no zero-damage guard. It computes `hits = ceil((totalHp / idleDamage).toNumber())`, `seconds = hits / idleSpeed`, then `1 / seconds × Gem Multiplication × Gem Chance × last-object multiplier`.
- Planet Coins per second returns zero when the current object has no Planet Coin drop. Otherwise it uses the same hits/time path as gems and multiplies by the object's drop amount and chance.

Remix uses JavaScript Number conversion in its hit-count and time calculations. Keep the conversion boundaries, `Math.ceil`, Decimal operation order, and the distinct MPS/GPS guards. Do not replace the rate equations with damage-per-second approximations.

## Implemented compatibility slice

`packages/core/src/mining-rates.ts` implements the captured damage and rate functions with upgrade/power effects supplied as values. `packages/core/src/remix-mining-upgrades.ts` evaluates the mining-related factor subset listed above. Nine controlled configurations cover initial Mud, the last-damageable Gem bonus, an upgraded Planet Coin object, zero damage, exact/below/above defense boundaries, and Number hit-count overflow. Exact Decimal output and factor snapshots are asserted in Vitest and Chromium; a separate test preserves the explicit-target/current-object argument quirk. `packages/core/src/remix-mining-transitions.ts` also provides `performRemixMiningAction`, a platform-independent active-click/idle-update boundary that derives mining factors and the highest-damageable scan, advances injected auto-pickaxe and save timers, applies at most one hit, handles object-break payouts and captured reward rolls, and grows Power of Mining. It returns ordered `save` and `refreshStoryNotifications` frame events; the higher-level simulation action applies Story notification refresh in the captured order, and the web session persists save snapshots before confirmation; route actions now update the full application state. Ten hit cases and four frame cases compare the composed operation and lower-level transitions in Vitest and Chromium. Navigation and broader reachable-state coverage remain open.

### Verified hit and timer behavior

At the pinned `Scripts/main.js` update path, idle time accumulates and triggers one hit only when `timer > 1 / idleSpeed`; equality does not trigger. A hit resets the timer to zero and discards elapsed excess rather than catching up. Active clicks bypass that timer. Both paths apply one hit and then multiply Power of Mining by the source-derived gain factor.

`MineObject.damage()` subtracts damage from the selected object's HP. When HP reaches or passes zero, Remix awards that object's Money value, updates the highest unlocked object index, and replaces the current object at the same index with a fresh full-HP object. Excess damage is discarded and there is no automatic navigation. A break attempts the Gem roll first, including objects without other drops; Planet Coin and Wisdom rolls follow only when the object defines those drops. Successful Gem rewards round the resulting total Gem balance. Wisdom rewards multiply the drop amount by Power of Wisdom. Planet Coin and Wisdom maxima update on successful drops. The random calls and their order are part of compatibility behavior.

The ten hit snapshots cover active nonbreaking and breaking hits, idle equality and over-threshold timing, strict Gem chance equality, last-damageable Gem rounding, successful and failed Planet Coin/Wisdom rolls, and Power of Wisdom scaling. Four additional update-frame snapshots cover exactly 60 seconds, just over 60 seconds, a long frame that requests only one save, and a backwards clock delta. They compare save timer values and the source event order: save (when due), then story notification refresh on every update frame. Active clicks emit neither frame event. This is focused evidence, not an exhaustive reward distribution, story condition, or integrated-loop specification. Sources: `Scripts/main.js`, `Scripts/Define/functions.js`, and `Scripts/mineobject.js` at the manifest pin; fixtures and controls are in the [reference corpus](../../tests/fixtures/parity/remix-reference-corpus.json) and [probe](../../scripts/reference-probe.mjs).

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

The branch-boundary corpus also exercises the pinned runtime's zero-left,
zero-right, and both-zero `add`/`sub` identities, plus its `add`/`sub`
exponent gaps at 16, 17, and 18 (the source returns the larger operand only
when the gap is strictly greater than 17), the strict numeric-multiplier limit
at ±1e307, rounding paths at Decimal exponents -2/-1 and 16/17, and string
representation changes around exponents -7 and 21. It captures MAX/MIN
sentinel string and `toFixed(0)` results. Sixteen additional operand pairs are
regenerated from LCG32 seed `487530534`; the parity test compares add, subtract,
multiply, divide, and compare outputs exactly with the source fixture. This
qualifies the sampled Decimal domain without claiming exhaustive values.

### Project decision

Keep `break_infinity.js@2.2.0` behind the core facade for the initial parity implementation. Number notation and display formatting remain a separate presentation concern. Any future numeric-library replacement requires comparative golden tests for every operation the Remix uses, serialization, and all relevant edge behavior.

## Number formatting

### Verified wrapper behavior

`Scripts/Define/functions.js` defines three distinct player-facing paths, and `Scripts/main.js` registers 40 formatters at the pinned revision. The [notation boundary corpus](../../tests/fixtures/parity/remix-reference-corpus.json) records direct formatter results and wrapper results across small values, 1,000 and 1e12 boundaries, Scientific/Engineering mantissa carries, SI transitions, and Idle Mine suffix transitions.

- `formatNumber` defaults its limit to 1,000 and `below1000` precision to zero. Only Standard, Scientific, and Engineering use that limit. They call the formatter only when `n > limit`; otherwise values below 1,000 use locale grouping with `below1000` digits and values at or above 1,000 use grouping with zero digits. The exact limit therefore stays grouped.
- For other formatter names, `formatNumber` calls the selected formatter directly and does not use its `limit` argument. This is observable with Idle Mine Notation at 1e12.
- `formatThousands` defaults its limit to 1e12 and uses the selected formatter when `n >= limit`. Below that boundary it converts to JavaScript Number and calls `toLocaleString("en-us")` with fixed minimum and maximum digits. This conversion can overflow for large Decimal values.
- `formatPercent` multiplies by 100 before passing the value to `formatNumber`; the default precision is two digits.
- The inherited AD `Notation.formatExponent` returns raw text below exponent `1e5`, groups exponents from `1e5` up to (but not including) `1e9`, and delegates to the selected formatter at three places from `1e9` onward. Exact source outputs at 99999/100000/100001 and 999999999/1000000000/1000000001 are compared for all registered formatters.
- `Scripts/main.js` starts with six AD Notations formatters, adds nonduplicate AD Community Notations formatters, then appends Idle Mine Notation, SI Notation (Current), and SI Notation (2022). Preserve the registered display names and order.

### Verified notation branch boundaries

- Idle Mine Notation computes `order = max(0, floor((log10(value) - 1) / 9))`, selects one of 12 legacy suffixes, then falls back to Standard notation once the list is exhausted. Probes include every suffix transition from exponent 10 through 100.
- The 2026-10-02 branch-boundary capture adds the Idle Mine suffix fallback at decimal exponent 109 (with exponents 108/109/110), the SI long/short transitions at exponents 27 and 33, and each custom SI formatter's repeated-label/superscript crossover (Current: 147; 2022: 183). The cutoff inputs have captured values on both sides and at the transition.
- The shared AD Notations base paths at Decimal exponents -300 and 3 are compared with negative and positive values immediately around those cutoffs. The `>= Decimal.MAX_VALUE` infinite dispatch is exercised below, at, and above exponent `9000000000000000`, for both signs. Standard's exponent-303 table/abbreviation cutoff and Mixed Scientific/Engineering's exponent-33 cutoff now have direct source cases.
- AD `AllNotation.formatDecimal` selects one of 16 internal formatters using `floor(log2(log2(abs(value) + 2))) % 16`. Sixteen source-derived inputs exercise every dispatch index, including the internal Bar formatter; all exact results are compared with the pinned `ALL` outputs in the 359-input corpus.
- AD Community Chinese notation switches at Decimal exponents 4 and 52, then at `floor(exponent / 48) = 6`; the 359-input corpus checks 9999/10000, 1e51/1e52, and 1e287/1e288/1e289. It also checks zero/nonzero lower-group output and nonzero fractional digits in the `formatAbove1e48` path.
- AD Shi maps each of three loop positions through `floor(value) % 33`. Across its 359 pinned direct outputs, every character in the 33-entry source table appears; the unit test compares these outputs and confirms the optional negative sign leaves a three-character body.
- AD Community Haha Funny returns 42069 at zero, reverses its recursively formatted reciprocal below one, and otherwise computes r = floor(log_69(t) × 69²). Its loop runs while r > 0 or fewer than three digit tokens have been emitted. The pinned values 69^68.999 and 69^69 give r = 328504 (three iterations) and r = 328509 = 69³ (four iterations); the focused unit test compares exact source outputs.
- AD Community Coronavirus routes both under-1000 and Decimal values through Scientific formatting, then scans the produced text. The first digit in each modulo-5 class is retained; repeats select an emoji by the first matching class and the combination of exact-digit novelty with character-index parity. Ten source-captured inputs preserve a period and hit all ten emoji indices.
- AD Community Greek Letters uses a 49-symbol alphabet and emits the base-49 digits of `floor(value.exponent / 3)` through its `while (place >= 1)` loop. Captures cover symbol indices missed by the seeded sample, the one-to-two symbol transition at 49, and the two-to-three transition at 49 squared; the unit test compares the full direct corpus and confirms every source character appears.
- AD Community Evil computes `n = Math.log(value.log(2)) / Math.log(2)` and rounds it to `o`. It preserves the original value when `o < 6` or the distance from `o` exceeds 0.25; within the inclusive quarter-step interval it squares for even `o` and takes the square root for odd `o`, then formats with Standard. Inputs around the `o = 6` and `o = 7` interval edges, exact thresholds, and integer centers compare each branch with the pinned fixture. AD Community Nice delegates below-1000 values to the same log-base-69 formatter; negative logarithm text changes its minus sign to a caret, and the method enforces at least two decimal places. The captured 0.5/1/1000 and signed MAX sentinels cover negative/zero/positive logs, the direct formatter path, and the constant infinite label plus inherited negative prefix.
- Standard notation's `abbreviate` maps exponent groups through three ten-entry tables, loops over remaining groups while `t >= 10`, pads to groups of three, appends one of five large-group prefixes, strips a trailing hyphen, then applies the source replacements `UM`→`M`, `UNA`→`NA`, `UPC`→`PC`, and `UFM`→`FM`. Captured exponents exercise the table cutoff, each padding length, and all four replacement strings while retaining lower-group suffixes.
- Infinity notation scales `value.log10()` by `log10(Number.MAX_VALUE)`, uses at least four decimal places below a normalized result of 1000 and three at/above it, then appends `∞`. The pinned `exponentCommas.show` default is true, so values on the upper side also exercise grouped thousands. Inputs `1e308254` and `1e308255` land on the two sides of the threshold. The Remix source has no writer for this library setting; its API-only false branch is not reachable through the player-facing game.
- Brackets notation computes a base-six logarithm, emits integer digits by repeatedly dividing the remaining exponent by six while it is at least six, then maps the fractional part to two symbols using `floor(36 * fraction)`. Values below/at/above 6^6 and three representable Decimal inputs bracketing the 6^36 threshold exercise the first and repeated loop transitions.
- AD Community Custom Base implements Binary and Hexadecimal with bases 2 and 16. `formatUnder1000` rounds a base-scaled number, emits digits while the integer remains positive, returns an empty string for zero, and pads fractional places when requested. `formatDecimal` normalizes by the base logarithm and carries at `base - base^-places / 2`; source outputs cover the binary carry at 1920 and the pinned Hexadecimal rounding nuance where 4095.5 stays below the carry but the captured just-above value carries. `packages/formatting/src/index.test.ts` checks the exact outputs; exponent-boundary and `formatPercent` wrapper fixtures cover its overridden exponent and fractional-place paths.
- AD Notations Hex uses `rawValue(value, 32)` to encode signs into eight uppercase hexadecimal digits. Positive and negative very-small, under-1000, Decimal, near-MAX, and infinity inputs compare the signed 32-step source results; zero yields `80000000`, while positive/negative infinite sentinels are `FFFFFFFF`/`00000000`. The source-derived input `32769.75524902344` reaches the terminal tie branch with an odd accumulator and zero remainder; Remix outputs `FBA13A26`, and the test verifies the round-up. The all-ones carry-suppression guard is unreachable through the public 32-bit formatter given the pinned Decimal exponent bound and source dispatch; see the [trace map](parity-traceability/simulation-and-content.md). Other class-specific notation branches remain open.
- AD Prime factors integers through `Y = 10006` using a sieve ending at prime `9973`; larger values use a base-10006 logarithmic representation. Inputs 10005.999/10006/10006.001 straddle the integer-versus-log branch; three values around `10006^10006` straddle the `r <= Y` nested-notation branch. Values 8192 and 8193 cover a thirteenth repeated factor and a mixed factor list, while 9972/9973/9974 straddle the greatest-prime upper bound and binary-search path. `packages/formatting/src/index.test.ts` compares all twelve outputs with the pinned fixture; the source map records each method/branch.
- AD Clock maps values below 12 to one clamped hour. Its `e < 301` branch splits at `r < 13`, then uses the `r >= 144` prefix path; larger exponents repeatedly reduce `r` while `r >= 1728`, and each `hour` floors/clamps to 0 through 11. Source cases around 12, base-12 exponents 13/157/301/2029/22765, and the near-MAX sentinel cover the direct path, every threshold, zero/one/repeated loop iterations, and the upper clamp. `packages/formatting/src/index.test.ts` checks exact pinned outputs and transitions; the Chromium corpus E2E compares all 359 inputs.
- Mixed Logarithm (Sci) delegates to Scientific below Decimal exponent 33; at and above it, it prefixes `formatLog(log10(value))`. The `formatLog` branches return fixed text below 1e5, comma-grouped text while the pinned setting accepts values below 1e9, then Scientific output at three places. Captures at decimal exponents 32/33/34, 99999/100000/100001, and 999999999/1000000000/1000000001 cover all branches.
- Logarithm notation's `formatDecimal` checks Decimal exponent `< 1e5`, then the inherited `showCommas` cutoff `< 1e9`. Inputs with exponents 99999/100000/100001 and 999999999/1000000000/1000000001 exercise all three source paths. The shared `formatExponent` thresholds are mapped independently above.
- Roman notation uses `t < 4e6` for direct Romanization and the logarithmic recursive `mantissa↑exponent` form at and above that value. Its 25 ordered symbol thresholds are captured below, at, and above each table value. Fractional Romanization floors tenths, rounds `1.2 * tenths`, returns `nulla` for zero, and prefixes the extra-symbol form when the rounded value exceeds five; each tenth transition has adjacent source cases.
- AD Custom `transcribe` is shared by Letters (`a`–`z`) and Cancer (26 source-ordered emoji symbols). It maps normalized exponent/3 directly through 26 symbols, then iterates in base 26; it adjusts an exact zero remainder before the next loop and reverses the collected symbols at the end. Cases 25/26/27 cover the single-to-multiple-symbol transition; 51/52/53, 702/703/704, and 1377/1378/1379 cover zero remainders and repeated loop transitions at increasing depths for both instances.

All 40 direct formatter outputs are now captured for 359 values, including 32 generated inputs from `xorshift32` seed `0x494d4231`; the corpus also covers Standard's abbreviation suffix/padding paths, Scientific/Engineering mantissa carry transitions, Infinity's precision transition, Prime's 10006 factorization and logarithmic transitions, Dots' rounded 254/64,516 encoding transitions, recursive remainder path, and `16,387,063.9980315` format cutoff. Brackets has source cases around its 6^6 and 6^36 base-six loop transitions. Roman's 25 ordered symbol thresholds, fractional tenth transitions, and recursive `4e6` boundary now have named source cases. Letters and Cancer's shared base-26 transcriber has named direct/multiple-symbol, exact zero-remainder, and repeated-loop cases. Blind's six value-formatting overrides and two infinity getters all return the captured single-space result through the shared base dispatch. The pinned Chromium capture records two `RangeError: Invalid string length` results for negative values one exponent below Decimal.MAX_VALUE in the two SI formatters. The formatting package compares the outputs and stringified errors against the fixture with the source LCG initialized at the recorded offset. Zalgo's infinite label consumes eight random draws per formatting call; four signed sentinel calls account for the 32-call delta recorded in `probeRuntime`. The focused Zalgo source test compares pinned outputs for zero, the -300 exponent route, the 999.999/1000 transition, large finite inputs, and signed values around Decimal.MAX_VALUE; with LCG32 seed 7454 it asserts all 32 sentinel draws. This fixed-seed sample qualifies only the named, source-boundary-covered paths. All external AD/AD Community method boundaries are mapped and source-tested in the [trace map](parity-traceability/simulation-and-content.md); the number-formatting behavior row is Certified after exact browser UI differentials for all 40 registered choices. Overall screen appearance remains separate.

### Implemented compatibility slice

`packages/formatting` implements all 40 registered formatter classes and reproduces their captured direct, exponent, and wrapper outputs in Chromium. The pinned package's community ESM export list omits `Haha Funny` and `Nice`, although the canonical Remix community UMD defines both. Beyond implements those classes from `Scripts/adcommunitynotations.js` and the three custom formatters from `Scripts/customnotations.js`. Node golden comparisons omit the single engine-sensitive `999.5` Idle Mine Notation sample; Playwright checks that exact output against the Chromium oracle. Formatter behavior is Certified, including visible UI output; overall screen visual parity remains tracked separately.

The formatting package uses the MIT-licensed `@antimatter-dimensions/notations@1.6.0` dependency credited by Remix. Its ESM import is bridged to Beyond's `break_infinity.js@2.2.0` Decimal facade to match the canonical browser runtime; see [ADR 0008](decisions/0008-notation-compatibility.md). No upstream formatter source or assets have been copied into product code.

## Math evidence

Initial sources: `Scripts/Define/functions.js`, `Scripts/pickaxe.js`, `Scripts/upgrade.js`, `Scripts/Define/game.js`, `Scripts/random.js`, and `Scripts/utils.js`. The exact reference commit is in the manifest. Decimal, seeded RNG, procedural-object outputs for IDs 0–768 and five high-ID probes, nine controlled mining-rate/factor scenarios, 249 upgrade price/effect samples, and 14 purchase/bulk-buy transitions are captured and tested. Coverage of the full safe-integer object-ID space, crafting, integrated progression, and reachable-save coverage remains pending.

## Controlled initial-state baseline

The pinned runtime corpus captures a fresh, pre-animation Mud state with Money 0, Gems 5, Toy Pickaxe damage 20, Mud HP 100/value 2, active damage 20, idle damage/DPS 15, MPC 0.4, MPS `0.2857142857142857`, GPS `0.0028571428571428567`, and PCPS 0. It also captures four configured rate scenarios and the upgrade effects used in each. Every money, gem, Planet Coin, and Powers upgrade records level-0/current and next cost/effect outputs. The initial notation samples and expanded 40-formatter boundary matrix are recorded alongside Decimal edge arithmetic, rounding, and serialization probes. These remain partial corpora, not a full formula or all-value notation specification. See [the corpus](../../tests/fixtures/parity/remix-reference-corpus.json).
