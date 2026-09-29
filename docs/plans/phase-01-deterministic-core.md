# Phase 1 — Deterministic core

Status: In progress. Decimal compatibility, source-backed transition slices, fresh simulation-state initialization, and composed click/frame/upgrade-purchase/crafting actions are implemented; offline-load dispatch remains open.

## Outcome

Implement a pure TypeScript state transition and compatibility math facade whose outputs match extracted reference fixtures.

## Work boundaries

No UI or platform implementation in the core. Inject RNG, clock/time, and required services. Do not implement unresearched mechanics.

## Entry evidence

- Documented state fields and initialization.
- Golden fixtures for the first implemented rules.
- Verified Decimal operation and serialization expectations.
- A version-pinned Decimal facade and its first golden/property checks exist. Controlled fixtures now also cover mining hits/frames, purchases, offline processing, crafting, Story state, and fresh-game defaults; these slices do not replace the unified simulation transition or full system evidence.

## Completed slice

`createInitialRemixSimulationState()` maps the source-observed fresh simulation defaults onto an injected, pinned object catalog. Vitest compares its resources, upgrades, Powers, pickaxe, progress, timers, and Story status with the oracle and checks that independent initial states do not share mutable data. `performRemixSimulationAction()` composes active clicks and idle frames with mining, save effects, and Story notification refresh; all four families of single/bulk upgrade purchases; and stochastic pickaxe crafting with injected RNG, source-selected Gem cost, and per-replacement save snapshots. Three frame cases, 14 purchase cases, and seven crafting cases protect the source behavior, including event order and intermediate save state.

## Remaining work

Extend the action boundary to source-backed offline-load effects, extracting cross-system fixtures before integration. Add the actual persistence adapter only after its snapshot timing and legacy save behavior are covered. Story state, settings, messages, and user-facing dispatch still need full application wiring.

## Validation

Strict type checks, unit and property tests, deterministic repeatability checks, and exact golden comparisons. Update the parity matrix and status.
