# Phase 4 — Resources and upgrades

Status: In progress — all 29 price/effect/cap formulas implemented and compared; purchase behavior remains open.

## Outcome

Reproduce Money, Gems, Planet Coins, Wisdom, Powers, damage, rates, upgrade costs/effects/caps, and their interactions.

## Current verified slice

The core implements all 29 upgrade prices, effects, and caps, including the injected-RNG Blacksmith Expertise effect. Vitest compares 249 level samples and the captured interaction/RNG scenarios; Chromium compares them exactly. Nine controlled mining scenarios continue to compare factor/rate outputs. Source `buy`, cap enforcement, affordability, rounded purchases, and bulk-buy transitions still need their own controlled fixtures and implementation. Unlocks, payouts, reward application, and progression remain open. See [upgrade formulas and purchases](../knowledge/upgrades.md), [mathematics](../knowledge/mathematics.md), and the [parity matrix](../knowledge/PARITY_MATRIX.md).

## Entry evidence

Every formula and operation order is sourced; fixtures cover resource and upgrade boundaries.

## Validation

Exact unit and golden outputs for representative and edge states; all corresponding matrix rows are updated.
