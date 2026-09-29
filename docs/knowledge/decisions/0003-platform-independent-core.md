# ADR 0003: Platform-independent simulation core

- Status: Accepted
- Date: 2026-09-28

## Decision

Game rules belong in a pure TypeScript core. Time, RNG, persistence, and platform services are injected. Simulation outputs must be deterministic for a given state, input, delta, and service sequence.

## Reason

One simulation must support deterministic parity tests and web/native adapters without Svelte or platform APIs leaking into behavior.

## Consequences

No DOM, Svelte, Canvas, Tauri, browser globals, storage, or platform SDK imports in packages/core. No direct Math.random() or Date.now() in game-domain code.
