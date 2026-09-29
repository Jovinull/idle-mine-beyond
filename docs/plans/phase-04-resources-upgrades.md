# Phase 4 — Resources and upgrades

Status: In progress — source capture complete; Beyond mining-factor subset only.

## Outcome

Reproduce Money, Gems, Planet Coins, Wisdom, Powers, damage, rates, upgrade costs/effects/caps, and their interactions.

## Current verified slice

The core evaluates the upgrade factors used by the current mining damage/rate equations. Nine pinned-runtime scenarios compare factor and rate snapshots in Vitest and Chromium. The pinned source inventory covers all 29 upgrade definitions with 249 price/effect samples; see [upgrade formulas and purchases](../knowledge/upgrades.md) and `upgradeSemantics` in the oracle corpus. Beyond has no general price/effect evaluator or purchase mutation. Stochastic Blacksmith Expertise behavior, unlocks, payouts, reward application, other Wisdom/Power effects, and progression remain open. See [mathematics](../knowledge/mathematics.md) and the [parity matrix](../knowledge/PARITY_MATRIX.md).

## Entry evidence

Every formula and operation order is sourced; fixtures cover resource and upgrade boundaries.

## Validation

Exact unit and golden outputs for representative and edge states; all corresponding matrix rows are updated.
