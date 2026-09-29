# Phase 4 — Resources and upgrades

Status: In progress — mining-related upgrade effect subset only.

## Outcome

Reproduce Money, Gems, Planet Coins, Wisdom, Powers, damage, rates, upgrade costs/effects/caps, and their interactions.

## Current verified slice

The core evaluates the upgrade factors used by the current mining damage/rate equations. Nine pinned-runtime scenarios compare factor and rate snapshots in Vitest and Chromium. This is not complete resource or upgrade behavior: costs, caps, purchase/bulk-buy rules, unlocks, payouts, random reward application, other Wisdom/Power effects, and progression remain open. See [mathematics](../knowledge/mathematics.md), the [parity matrix](../knowledge/PARITY_MATRIX.md), and `formulaSemantics` in the oracle corpus.

## Entry evidence

Every formula and operation order is sourced; fixtures cover resource and upgrade boundaries.

## Validation

Exact unit and golden outputs for representative and edge states; all corresponding matrix rows are updated.
