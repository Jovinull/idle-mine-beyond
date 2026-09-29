# ADR 0008: Number-notation compatibility boundary

Date: 2026-09-29

## Status

Accepted

## Context

Remix initializes Standard, Scientific, Engineering, Letters, Logarithm, and Cancer notation, then adds the other formatter classes. It loads AD Notations 1.6.0 from a browser UMD bundle and supplies the global `break_infinity.js@2.2.0` Decimal constructor. The npm ESM entry imports the older `break_infinity.js/break_infinity` subpath and the package declares a `^1.0.9` dependency, which does not match the canonical runtime.

## Decision

Keep display formatting in `packages/formatting`, outside the simulation core. Depend on the MIT-licensed `@antimatter-dimensions/notations@1.6.0` package for notation classes, pin its transitive Decimal dependency to 2.2.0, and alias its legacy ESM import to a bridge that re-exports the core Decimal facade. Reimplement the three small Remix display wrappers at this boundary and compare their outputs to the pinned corpus. Add further notation classes only after source-specific behavior is understood.

## Consequences

- The simulation core stays independent of formatting and presentation choices.
- Tests and the web build use the same Decimal implementation as the reference runtime.
- The formatter package is pinned and its initial six classes and wrappers are golden-tested; all other notation classes remain incomplete.
- Vite aliases in the test and web configurations are compatibility-critical and must be kept synchronized.
- The npm package license remains in the dependency; no upstream source or artwork is copied into product code.

## Evidence

- Remix sources: `Scripts/Define/game.js`, `Scripts/Define/functions.js`, and `index.html` at `0e0f4bf5a9c66e5603cda2ce4bd54213023dae21`.
- CDN dependency version and SHA-256: `sources/runtime-dependencies.json`.
- Golden outputs: `tests/fixtures/parity/remix-reference-corpus.json` and `packages/formatting/src/index.test.ts`.
