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

The Remix loads break_infinity.js from a CDN and stores Decimal values in game state. Beyond uses a compatibility facade and initially targets equivalent break_infinity semantics. Do not replace the arithmetic library or normalize serialized values until golden tests establish equivalence.

## Number formatting

Remix delegates many formats to AD Notations and community notation code, adds custom notations, and treats Standard, Scientific, and Engineering formats specially below configured limits. Exact behavior depends on the selected formatter and thresholds. Number formatting is player-visible and part of parity.

## Math evidence

Initial sources: Scripts/Define/functions.js, Scripts/pickaxe.js, Scripts/upgrade.js, Scripts/Define/game.js, and Scripts/Define/functions.js procedural generation. The exact reference commit is in the manifest. Formula fixtures have not yet been extracted; the parity matrix remains pending.

## Controlled initial-state baseline

The pinned runtime corpus captures a fresh, pre-animation Mud state with Money 0, Gems 5, Toy Pickaxe damage 20, Mud HP 100/value 2, active damage 20, idle damage/DPS 15, MPC 0.4, MPS `0.2857142857142857`, GPS `0.0028571428571428567`, and PCPS 0. Every money, gem, Planet Coin, and Powers upgrade records level-0/current and next cost/effect outputs; notation outputs cover the source's registered formatters at 0, 999, 1,000, 1e6, 1e12, and 1e100. These are golden reference samples, not an extracted full formula specification. See [the corpus](../../tests/fixtures/parity/remix-reference-corpus.json).
