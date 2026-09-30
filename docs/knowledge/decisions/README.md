# Architecture decision records

Use an ADR for a durable choice likely to be revisited. Keep records short and append a new decision when a choice changes; do not rewrite history silently.

| ADR                                          | Decision                                                                          |
| -------------------------------------------- | --------------------------------------------------------------------------------- |
| [0001](0001-canonical-target.md)             | Final Idle Mine: Remix is the compatibility target                                |
| [0002](0002-stack.md)                        | TypeScript, SvelteKit, pnpm, and Tauri stack                                      |
| [0003](0003-platform-independent-core.md)    | Pure simulation boundary with injected services                                   |
| [0004](0004-frozen-references.md)            | Read-only, commit-pinned .research references                                     |
| [0005](0005-parity-before-improvements.md)   | Compatibility before Beyond changes                                               |
| [0006](0006-canvas-renderer.md)              | DOM/CSS UI and Canvas 2D mine-object renderer                                     |
| [0007](0007-break-infinity-compatibility.md) | Pin Remix's Decimal library behind a core boundary                                |
| [0008](0008-notation-compatibility.md)       | Keep number-formatting compatibility separate and use Remix's notation dependency |
| [0009](0009-versioned-save-storage.md)       | Keep versioned persistence behind adapters with backup recovery                   |
| [0010](0010-native-save-storage.md)          | Store native Beyond save slots under Tauri app data with a narrow command bridge  |
