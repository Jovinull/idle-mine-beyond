# Mathematical behavior

The formulas below are source observations from the pinned Remix revision. They are not a permission to implement an approximation: preserve the reference library, operation order, conversions, and rounding behavior, then compare exact outputs.

## Damage

In Scripts/Define/functions.js:

- Pickaxe damage is power × quality.
- Active damage is the maximum of zero and pickaxe damage multiplied by Active Power, Mining Power, and the applicable Wisdom upgrade effects, minus object defense; then an Idle DPS fraction from the Planet Coin Active Power upgrade is added.
- Idle damage is the maximum of zero and pickaxe damage multiplied by Idle Power, Mining Power, and Wisdom damage effects, minus object defense.
- Idle DPS is idle damage × Idle Speed.

The specific upgrade effects are nested and must be followed in source order. Test at zero damage, exact defense boundaries, and large Decimal magnitudes.

## Earnings

- Hits to break for money-per-click use the ceiling of total HP divided by active damage. Money per click is object value divided by that hit count.
- Money per second uses the ceiling of total HP divided by idle damage, then object value × idle speed ÷ hits.
- Gem and Planet Coin rates use time-to-break, drop chance, and their applicable multipliers. Their source code has distinct guards and conversion paths; extract and test them individually.

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

Remix delegates many formats to AD Notations and community notation code, adds custom notations, and treats Standard, Scientific, and Engineering formats specially below configured limits. Exact behavior depends on the selected formatter and thresholds. Number formatting is player-visible and part of parity.

## Math evidence

Initial sources: `Scripts/Define/functions.js`, `Scripts/pickaxe.js`, `Scripts/upgrade.js`, `Scripts/Define/game.js`, and `Scripts/Define/functions.js` procedural generation. The exact reference commit is in the manifest. Decimal fixtures are extracted; damage, earnings, crafting, and procedural formula boundary matrices remain pending.

## Controlled initial-state baseline

The pinned runtime corpus captures a fresh, pre-animation Mud state with Money 0, Gems 5, Toy Pickaxe damage 20, Mud HP 100/value 2, active damage 20, idle damage/DPS 15, MPC 0.4, MPS `0.2857142857142857`, GPS `0.0028571428571428567`, and PCPS 0. Every money, gem, Planet Coin, and Powers upgrade records level-0/current and next cost/effect outputs; notation outputs cover the source's registered formatters at 0, 999, 1,000, 1e6, 1e12, and 1e100. The Decimal section adds edge arithmetic, rounding, and serialization probes. These remain a partial corpus, not a full formula or notation specification. See [the corpus](../../tests/fixtures/parity/remix-reference-corpus.json).
