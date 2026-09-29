# ADR 0007: Preserve the Remix Decimal implementation

Date: 2026-09-29

Status: Accepted for the pre-parity implementation

## Context

Remix loads `break_infinity.js` from an unversioned CDN alias and uses its Decimal values throughout state, formulas, and saves. The controlled reference browser resolved that alias to version 2.2.0. The exact response URL, SHA-256, npm integrity, and MIT license are recorded in [the runtime dependency manifest](../sources/runtime-dependencies.json). The initial Decimal fixture shows observable rounding, conversion, edge arithmetic, and JSON behavior.

## Decision

Use `break_infinity.js@2.2.0` directly behind `packages/core/src/decimal.ts`. Keep arithmetic and JSON behavior compatible with the pinned Remix library. Do not replace the implementation until comparative golden tests cover every operation and serialized state relevant to parity.

## Consequences

- Domain code imports Decimal through the core facade, leaving one boundary for future compatibility work.
- Legacy results such as negative-half rounding differences, non-finite sentinels, and string-based JSON saves remain visible to tests.
- Number notation and UI formatting stay separate from the game-number representation.
- The dependency remains under its upstream MIT license; no third-party library code was copied into tracked product source.
