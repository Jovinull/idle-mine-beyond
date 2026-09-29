# Testing and parity method

## Workflow

Every behavior implementation follows:

**REFERENCE → EXTRACT BEHAVIOR → CREATE FIXTURE/TEST → IMPLEMENT → COMPARE → DOCUMENT → COMMIT**

“Looks plausible” is not parity evidence.

## Test layers

- **Unit tests:** exact formulas and edge cases inside platform-independent packages.
- **Property tests:** invariants and deterministic generated objects under fast-check or equivalent.
- **Compatibility tests:** Beyond output compared with versioned output extracted from the frozen Remix source/runtime.
- **E2E tests:** real browser interactions through Playwright.
- **Visual regression:** screenshot comparisons at fixed viewports, themes, and state fixtures.
- **Native checks:** Tauri shell/config and platform builds when the required SDK/toolchain is available.

## Harness folders

| Folder         | Purpose                                                      |
| -------------- | ------------------------------------------------------------ |
| tests/unit     | Unit and property coverage                                   |
| tests/parity   | Reference behavior fixtures and comparison tests             |
| tests/fixtures | Inputs, outputs, imported save samples, deterministic states |
| tests/e2e      | Browser smoke and user-flow checks                           |
| tests/visual   | Screenshot baselines and diffs                               |

Do not commit copied upstream game assets or saves as fixtures without provenance review. Prefer minimal synthetic state and scalar outputs.

## Golden fixture envelope

Each fixture should identify the source repository and commit, source file or probe method, capture date, normalized input, output, precision/serialization rules, and any uncertainty. Fixture updates require explaining why the reference output changed; never regenerate expected values merely to make a failure pass.

## Visual targets

Use 1366×768, 1440×900, 1920×1080, and 2560×1440. Capture light and dark themes and states such as initial, gems unlocked, Planet Coins, Wisdom, story, settings, huge numbers, long generated names, and disabled controls.

## Current smoke harness

Bootstrap tests prove the Vitest runner, a metadata-only parity fixture check, and a Playwright browser launch against the empty phase-status shell. They do not test game behavior or claim gameplay parity.

`pnpm test:reference` is a separate read-only browser probe. It loads the pinned Remix checkout, substitutes the SHA-verified CDN response snapshots recorded in `sources/runtime-dependencies.json`, fixes the clock and RNG, suppresses the animation loop, and compares the result with the checked-in oracle corpus. It does not execute Beyond behavior and is not parity certification.

## Completion rule

Code presence is not completion. Update the [parity matrix](PARITY_MATRIX.md) only when source understanding, fixture coverage, automated tests, UI/E2E, and visual evidence meet the row's criteria.
