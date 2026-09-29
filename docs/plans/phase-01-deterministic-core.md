# Phase 1 — Deterministic core

Status: In progress. Decimal compatibility, source-backed transition slices, fresh simulation-state initialization, composed click/frame/upgrade-purchase/crafting/offline-load actions, a pure current-save→offline-load orchestration service, and a strict Beyond v1 save schema/round-trip are implemented. Live offline rates are checked against pinned loads; legacy-to-v1 conversion and platform persistence integration remain open.

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

`createInitialRemixSimulationState()` maps the source-observed fresh simulation defaults onto an injected, pinned object catalog. Vitest compares its resources, upgrades, Powers, pickaxe, progress, timers, and Story status with the oracle and checks that independent initial states do not share mutable data. `performRemixSimulationAction()` composes active clicks and idle frames with mining, save effects, and Story notification refresh; all four families of single/bulk upgrade purchases; stochastic pickaxe crafting with injected RNG, source-selected Gem cost, and per-replacement save snapshots; and offline-load rewards with injected clock/catalog/formatter, lazy live MPS/GPS/PCPS derivation, and upgrade-derived caps/multipliers. `loadRemixLegacySaveIntoState()` adds the current wrapped-save decoder and field mapper before the same offline action, reusing the eager `lastActive` fallback read so the captured four-read reward path remains exact. The Beyond v1 schema round-trips all mutable application state using JSON-safe Decimal strings and derives the current object from its saved ID. A captured complete-save/offline-reward state also round-trips through this v1 schema. Three frame cases, 14 purchase cases, seven crafting cases, ten offline branch cases, nine composed mining-formula cases, the complete save/offline capture, and v1 round-trip/error cases protect these slices, including event order and save snapshots.

## Remaining work

Add cross-system fixtures for more representative legacy saves and malformed application boundaries. Then connect successful legacy loads to versioned v1 snapshots, define migrations when an earlier Beyond schema exists, and implement import/export plus browser/native persistence adapters; the adapter must perform writes before dispatching Remix's post-write `Game Saved!` message. Story state, settings, messages, and user-facing dispatch still need full application wiring.

## Validation

Strict type checks, unit and property tests, deterministic repeatability checks, and exact golden comparisons. Update the parity matrix and status.
