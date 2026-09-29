# Phase 1 — Deterministic core

Status: In progress. Decimal compatibility, source-backed transition slices, fresh simulation-state initialization, composed click/frame/upgrade-purchase/crafting/offline-load actions, current-save→offline-load orchestration, the Beyond v1 schema, legacy migration, and a backup-aware browser storage adapter are implemented. Live offline rates and captured import effect order are checked against pinned loads; app/native integration remains open.

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

`createInitialRemixSimulationState()` maps the source-observed fresh simulation defaults onto an injected, pinned object catalog. Vitest compares its resources, upgrades, Powers, pickaxe, progress, timers, and Story status with the oracle and checks that independent initial states do not share mutable data. `performRemixSimulationAction()` composes active clicks and idle frames with mining, save effects, and Story notification refresh; all four families of single/bulk upgrade purchases; stochastic pickaxe crafting with injected RNG, source-selected Gem cost, and per-replacement save snapshots; and offline-load rewards with injected clock/catalog/formatter, lazy live MPS/GPS/PCPS derivation, and upgrade-derived caps/multipliers. `loadRemixLegacySaveIntoState()` adds the current wrapped-save decoder and field mapper before the same offline action, reusing the eager `lastActive` fallback read so the captured four-read reward path remains exact. Beyond v1 round-trips all mutable application state, and `importRemixLegacySaveToBeyond()` dispatches captured theme/offline effects before writing the migrated snapshot. The web adapter backs up prior state, rejects unknown newer versions, and only returns the captured save confirmation after successful storage. Three frame cases, 14 purchase cases, seven crafting cases, ten offline branch cases, nine composed mining-formula cases, the complete save/offline capture, schema and recovery cases, and captured migration effect ordering protect these slices.

## Remaining work

Add cross-system fixtures for more representative legacy saves and malformed application boundaries. Then wire persistence into ordinary simulation save effects, build the native storage adapter, add import/export and recovery UI, and define migrations when an earlier Beyond schema exists. Preserve each `Game Saved!` message after its corresponding successful write. Story state, settings, messages, and user-facing dispatch still need full application wiring.

## Validation

Strict type checks, unit and property tests, deterministic repeatability checks, and exact golden comparisons. Update the parity matrix and status.
