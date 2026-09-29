# Phase 1 — Deterministic core

Status: Decimal compatibility boundary implemented; deterministic state transitions remain not started pending their behavior fixtures.

## Outcome

Implement a pure TypeScript state transition and compatibility math facade whose outputs match extracted reference fixtures.

## Work boundaries

No UI or platform implementation in the core. Inject RNG, clock/time, and required services. Do not implement unresearched mechanics.

## Entry evidence

- Documented state fields and initialization.
- Golden fixtures for the first implemented rules.
- Verified Decimal operation and serialization expectations.
- A version-pinned Decimal facade and its first golden/property checks exist. This does not satisfy the remaining system formula and state-transition evidence.

## Validation

Strict type checks, unit and property tests, deterministic repeatability checks, and exact golden comparisons. Update the parity matrix and status.
