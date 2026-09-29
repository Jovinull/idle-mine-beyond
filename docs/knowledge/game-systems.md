# Gameplay systems inventory

This is a system map, not a complete extracted game specification. Items described below as source-observed are initial findings from the frozen Remix code. Exact content tables and edge cases still need systematic extraction and fixtures.

## Progression and mine objects

**Verified legacy behavior (source):** the reference defines fixed mine objects and special indexed anchors, followed by procedural ranges. The static list begins with Mud, Paper, Salt, Clay, Rock, Coal, Bone, Lead, Iron, and Copper. Special objects continue through THE UNIVERSE at index 214 in the pinned source. Source: Scripts/Define/game.js and Scripts/Define/functions.js.

**Runtime corpus:** the controlled Chromium oracle capture records 72 base objects and 78 special anchors, with a normalized result for every ID from 0 through 214 plus nine post-Universe probes. Beyond materializes and generates these records in the platform-independent core; Playwright compares all 224 results against the oracle. The mining loop, damage application, and object UI remain unimplemented. See [the oracle corpus](../../tests/fixtures/parity/remix-reference-corpus.json) and [its probe](../../scripts/reference-probe.mjs).

Objects carry name, HP, defense, value, colors, skin, and optional drops. Previous/next navigation is bounded by the highest unlocked index. Verify exact navigation and damageability rules at runtime before implementation.

## Resources

- **Money** is earned when the current object breaks.
- **Gems** are chance-based drops used in pickaxe crafting and gem upgrades.
- **Planet Coins** are later object drops and upgrade currency.
- **Wisdom** is a later resource associated with Wisdom-bearing objects.
- **Powers** are late-game progression values and upgrades. Their complete effects and reset behavior remain to be extracted.

The source displays resources, stats, object information, upgrades, crafting, story, and settings. Do not collapse currencies or reorder their unlocks.

## Upgrade families

The source defines 8 Money, 7 Gem, 7 Planet Coin, and 7 Wisdom upgrades. The [upgrade reference](upgrades.md) records all 29 source keys, names, prices, effects, caps, dependencies, and generic purchase rules. `upgradeSemantics` in the oracle corpus captures 249 controlled level samples; the random Blacksmith Expertise effect is explicitly excluded from those static samples.

The core evaluates only the subset of effects that feed mining damage and rate equations: Money Active/Idle Power, Idle Speed and Gem Chance; Gem Idle Power II, Gem Chance II and Gem Multiplication; Planet Coin Active Power, Gem Chance III, Gem Multiplication and last-object Gem Bonus; Wisdom Increasing Damage Boost, Upgrade Damage Upgrade and Simple Gem Boost. Exact formulas and tests are in [mathematics](mathematics.md) and `formulaSemantics` in the reference corpus. Beyond has no general upgrade price evaluator, cap/purchase mutation, or complete effect evaluator yet. Its Wisdom input must include every purchased Wisdom level because one formula counts them all.

## Active and idle play

The reference has active clicks and an automatic mining loop. The current browser animation loop is tied to requestAnimationFrame. Its update advances at most one automatic hit when the interval threshold is crossed, then resets its timer; see [legacy quirks](legacy-quirks.md). Do not replace this with catch-up simulation during parity without evidence and an accepted exception.

`packages/core/src/mining-rates.ts` reproduces pickaxe damage, active/idle damage, Idle DPS, Money per Click, and Money/Gem/Planet Coin rates from injected upgrade effects. Nine controlled browser-oracle scenarios and the explicit-target/current-object quirk are covered. The functions do not apply damage, roll rewards, update timers/resources, or implement the mining loop; see [mathematics](mathematics.md).

## Crafting

Pickaxe crafting is stochastic and may return a dud. Its complete source-derived rules are in [pickaxe crafting](pickaxe-crafting.md). Never convert it into deterministic gear tiers.

## Notations

The game combines built-in and additional community notation implementations, filters some entries, and adds `Idle Mine Notation`, `SI Notation (Current)`, and `SI Notation (2022)`. Preserve the selected name, formatting edge cases, and threshold behavior. Record exact outputs as fixtures; do not substitute a generic formatter. The three custom implementations come from pinned `Scripts/customnotations.js`. The complete captured formatter/wrapper corpus passes in Chromium. Node and Chromium differ at the `999.5` Idle Mine Notation rounding boundary; see [testing and parity](testing-and-parity.md). Keep the source operation order and verify target browser behavior instead of introducing a guessed correction.

## Open extraction work

- Full fixed and special object tables and unlock order.
- All upgrade formulas, caps, costs, and purchase semantics.
- Drop rules and the exact relationship between active/idle damage and expected drops.
- Wisdom/Powers value updates, upgrades, retention, and reset behavior.
- Notifications, achievements or sound if discovered, and all controls.
- Unlock conditions and every displayed stat across representative saves.
