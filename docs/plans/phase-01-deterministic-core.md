# Phase 1 — Deterministic core

Status: In progress. Decimal compatibility, source-backed transition slices, and fresh simulation-state initialization are implemented; the unified state/action/effect loop remains open.

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

`createInitialRemixSimulationState()` maps the source-observed fresh simulation defaults onto an injected, pinned object catalog. Vitest compares its resources, upgrades, Powers, pickaxe, progress, timers, and Story status with the oracle and checks that independent initial states do not share mutable data.

## Remaining work

Compose the tested operations behind one immutable simulation input/state/effect boundary. Extract fixtures for action ordering and cross-system interactions before integrating mining, purchases, crafting, Story notifications, time, and persistence.

## Validation

Strict type checks, unit and property tests, deterministic repeatability checks, and exact golden comparisons. Update the parity matrix and status.
