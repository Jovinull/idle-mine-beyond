# Phase 4 — Resources and upgrades

Status: In progress — all 29 price/effect/cap formulas and generic purchases are implemented and compared; the injected-state mining action boundary composes damage, auto/save timers, reward, and power-growth behavior across ten hit and four frame cases. Story conditions, notification transitions, page visibility, and navigation clamps are extracted and tested; persistence/story adapters, narrative rendering, broader drop coverage, and progression remain open.

## Outcome

Reproduce Money, Gems, Planet Coins, Wisdom, Powers, damage, rates, upgrade costs/effects/caps, and their interactions.

## Current verified slice

The core implements all 29 upgrade prices, effects, and caps, including the injected-RNG Blacksmith Expertise effect. Vitest compares 249 level samples and the captured interaction/RNG scenarios; Chromium compares them exactly. Nine controlled mining scenarios compare factor/rate outputs. `executeRemixUpgradePurchase` applies pure single and bulk transitions; Vitest compares all 14 captured source cases covering affordability, resource selection, rounding, caps, and `buyN`/`buy10`/`buy100` boundaries. `performRemixMiningAction` composes factors, active/idle hit timing, save threshold/reset, damage, break payout, resource rewards, RNG order, story-refresh event order, and Power of Mining growth; ten hit and four frame cases compare it with captured source behavior. `remix-story.ts` matches the extracted 61 story conditions, page visibility, and high-water notification behavior in Vitest and Chromium. Persistence effects, narrative/UI integration, broader drops, and progression remain open. See [upgrade formulas and purchases](../knowledge/upgrades.md), [mathematics](../knowledge/mathematics.md), [story](../knowledge/story.md), and the [parity matrix](../knowledge/PARITY_MATRIX.md).

## Entry evidence

Every formula and operation order is sourced; fixtures cover resource and upgrade boundaries.

## Validation

Exact unit and golden outputs for representative and edge states; all corresponding matrix rows are updated.
