# Gameplay systems inventory

This is a system map, not a complete extracted game specification. Items described below as source-observed are initial findings from the frozen Remix code. Exact content tables and edge cases still need systematic extraction and fixtures.

## Progression and mine objects

**Verified legacy behavior (source):** the reference defines fixed mine objects and special indexed anchors, followed by procedural ranges. The static list begins with Mud, Paper, Salt, Clay, Rock, Coal, Bone, Lead, Iron, and Copper. Special objects continue through THE UNIVERSE at index 214 in the pinned source. Source: Scripts/Define/game.js and Scripts/Define/functions.js.

**Runtime corpus:** the controlled Chromium oracle capture records 72 base objects and 78 special anchors, with a normalized result for every ID from 0 through 214 plus nine post-Universe probes. Beyond materializes and generates these records in the platform-independent core; Playwright compares all 224 results against the oracle. The Svelte route now wires active mining, idle frames, object navigation, object Canvas rendering, and rewards through the simulation session. Reward-distribution coverage and full-screen visual certification remain open. See [the oracle corpus](../../tests/fixtures/parity/remix-reference-corpus.json) and [its probe](../../scripts/reference-probe.mjs).

`createInitialRemixSimulationState()` seeds the fresh core subset using object ID 0 and captured Remix defaults, including five Gems, the Toy Pickaxe, level-zero upgrades, unit Powers, zero timers, and initial Story progress. It does not create settings, UI formatters, the message buffer, or a persisted save payload.

Objects carry name, HP, defense, value, colors, skin, and optional drops. Previous/next navigation is bounded by the highest unlocked index. Verify exact navigation and damageability rules at runtime before implementation.

## Resources

- **Money** is earned when the current object breaks.
- **Gems** are chance-based drops used in pickaxe crafting and gem upgrades.
- **Planet Coins** are later object drops and upgrade currency.
- **Wisdom** is a later resource associated with Wisdom-bearing objects.
- **Powers** are late-game progression values and upgrades. Their complete effects and reset behavior remain to be extracted.

The source displays resources, stats, object information, upgrades, crafting, story, and settings. Do not collapse currencies or reorder their unlocks.

## Upgrade families

The source defines 8 Money, 7 Gem, 7 Planet Coin, and 7 Wisdom upgrades. The [upgrade reference](upgrades.md) records all 29 source keys, names, prices, effects, caps, dependencies, and generic purchase rules. `upgradeSemantics` in the oracle corpus captures 249 controlled level samples, nine cross-upgrade effect outputs, and five Blacksmith Expertise RNG cases. The random effect is excluded only from the level-only samples.

The core implements all 29 upgrade prices, effects, and caps through `calculateRemixUpgradePrice`, `calculateRemixUpgradeEffect`, and `getRemixUpgradeMaxLevel`. `executeRemixUpgradePurchase` applies the source-backed pure transition for single and bulk purchases. `performRemixSimulationAction` maps that result into the full simulation state for all four resource families; the source purchase path requests no immediate save or Story refresh. The 14 captured purchase cases are compared through both the low-level transition and composed state boundary. The same boundary now composes stochastic pickaxe crafting from injected RNG and the source-selected Gem cost, returning a core-state save snapshot for every successful replacement in a bulk action. Mining damage/rate factors delegate to the same effect definitions. Exact formulas, purchase rules, and tests are in [mathematics](mathematics.md), [upgrade reference](upgrades.md), and `upgradeSemantics` in the reference corpus. Gameplay UI/input integration remains open. The complete Wisdom level map matters because Upgrade Damage Upgrade counts every purchased Wisdom level.

## Active and idle play

The reference has active clicks and an automatic mining loop. The current browser animation loop is tied to requestAnimationFrame. Its update advances at most one automatic hit when the interval threshold is crossed, then resets its timer; see [legacy quirks](legacy-quirks.md). Do not replace this with catch-up simulation during parity without evidence and an accepted exception.

`packages/core/src/mining-rates.ts` reproduces pickaxe damage, active/idle damage, Idle DPS, Money per Click, and Money/Gem/Planet Coin rates from injected upgrade effects. Nine controlled browser-oracle scenarios and the explicit-target/current-object quirk are covered. `remix-mining-transitions.ts` exposes `performRemixMiningAction`, which composes injected state, action, delta, catalog, and RNG into an immutable active-click or idle-update result. It derives factors and damageability, applies source-order reward rolls and same-index object refresh, advances the strict auto-pickaxe and save timers, and returns ordered save/story-refresh events. Ten hit cases plus four update-frame cases compare the core operation in Vitest and Chromium. `remix-simulation-action.ts` composes clicks and idle frames over the fresh simulation state, turns a due source save event into an injected effect, then refreshes Story notifications. Three captured `simulationFrameSemantics` cases compare the combined behavior, including a break-and-save frame whose save snapshot retains the pre-refresh Story counters. `remix-story.ts` evaluates all 61 captured milestone conditions, source-ordered high-water notifications, direct-condition page visibility, maximum page, and navigation clamps. `remix-story-tabs.ts` models notification clearing, scroll capture/restore, and delayed UI effects across four controlled tab cases. Six notification states plus every condition boundary compare in Vitest and Chromium. A standalone Story renderer compares its narrative to captured browser fixtures, but frame events, Story state, tabs, persistence, and the renderer are not wired into the playable game UI. See [story](story.md) and [mathematics](mathematics.md).

## Offline progression

During `loadGame()`, elapsed time must be strictly greater than 300 seconds, and the explicit `nooffline` argument must be false. The default cap is six hours plus the Offline Time effect. Money uses a 0.5 rate multiplier; offline Gem and Planet Coin rates use their upgrade effects and are floored. Remix still logs and saves when the calculated rates are zero, and it updates resource maxima even without a positive reward. `packages/core/src/remix-offline-progression.ts` models the resource transition, formatter-driven return message, and ordered log/save effects using an injected clock and rates. `performRemixSimulationAction()` now maps this transition into full simulation state, deriving the cap and offline multipliers from saved upgrade levels and returning a save effect with the source timestamp. Its rate inputs remain injected; deriving `getMPS()`, `getGPS()`, and `getPCPS()` from reachable game state, complete save loading, and persistence remain open. Ten source cases compare the low-level and composed transitions. See [save and offline behavior](save-time-offline.md).

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
