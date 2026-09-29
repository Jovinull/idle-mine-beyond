# Phase 1 — Deterministic core

Status: In progress. Decimal compatibility, source-backed transition slices, fresh simulation-state initialization, and the first composed click/frame action boundary are implemented; broader action dispatch remains open.

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

`createInitialRemixSimulationState()` maps the source-observed fresh simulation defaults onto an injected, pinned object catalog. Vitest compares its resources, upgrades, Powers, pickaxe, progress, timers, and Story status with the oracle and checks that independent initial states do not share mutable data. `performRemixSimulationAction()` composes active clicks and idle frames with mining, save effects, and Story notification refresh; three pinned-runtime cases protect event order and the state captured by a save before notification refresh.

## Remaining work

Extend the action boundary to source-backed upgrade purchases, pickaxe crafting, and offline-load effects, extracting cross-system fixtures before each integration. Add the actual persistence adapter only after its snapshot timing and legacy save behavior are covered. Story state, settings, messages, and user-facing dispatch still need full application wiring.

## Validation

Strict type checks, unit and property tests, deterministic repeatability checks, and exact golden comparisons. Update the parity matrix and status.
