# Core package rules

- Keep the game domain deterministic and platform-independent: state + input + delta + injected services → next state.
- Do not import Svelte, DOM/browser globals, Canvas, Tauri, localStorage, IndexedDB, filesystem, Steam, CrazyGames, or mobile platform APIs.
- Receive randomness and time through explicit abstractions. Never call `Math.random()` or `Date.now()` in game-domain code.
- Import game numbers through `src/decimal.ts`; do not couple simulation modules directly to a concrete numeric package.
- Preserve observable Remix quirks during parity; establish reference evidence and tests before implementation. Do not add gameplay as part of scaffolding.
