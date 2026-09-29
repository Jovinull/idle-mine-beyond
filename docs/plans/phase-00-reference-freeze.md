# Phase 0 — Reference freeze and archaeology

Status: In progress

## Outcome

Create a reproducible, read-only reference baseline and enough source/runtime fixtures to support deterministic implementation.

## Complete

- Pinned official Remix and prior-art Remux commits in the source manifest.
- Created ignored checkout workspace and setup/check workflow.
- Inspected major Remix structures and documented initial mechanics and risks.
- Established research classification, source hierarchy, and probe format.
- Verified the public deployment in browser tooling and created a deterministic local oracle probe using the pinned checkout and hash-verified runtime dependencies.
- Captured initial state, object IDs 0–214, high-ID probes, base rates/upgrades, notation samples, and a Decimal arithmetic/rounding/serialization corpus.
- Added the `break_infinity.js@2.2.0` core boundary and golden/property checks against the Decimal corpus.
- Implemented all 40 registered formatter classes, the three display wrappers, and exponent behavior. Chromium compares every captured output in the complete formatter corpus; Node tests cover stable outputs and leave one engine-sensitive rounding value to the browser check.
- Implemented the explicit-seed `RemixRandom` boundary with source-captured mixed-draw and sequence-exhaustion fixtures plus repeatability properties.
- Captured source content and implemented fixed/special lookup plus all three procedural mine-object branches. Chromium matches all 224 captured object outputs; Node tests cover stable outputs and mask two engine-sensitive `Math.sin` chance values.
- Captured four controlled damage/earnings scenarios and implemented injected-factor rate calculations. Golden tests cover damage, Money/Gem/Planet Coin rates, the last-damageable gem bonus, zero damage, and the current-object argument quirk.

## Remaining work

- Expand procedural object probes beyond the current captured IDs and verify more large/special boundaries.
- Expand damage/earnings probes across exact defense boundaries and Number-conversion edges; extract upgrade effect/purchase rules before connecting rates to the deterministic mining state.
- Extract full boundary matrices for upgrades/resources, random drops, crafting RNG, saves, offline behavior, and representative story/settings states.
- Complete the asset/font provenance audit and extract save examples with no unsupported copying.

## Validation

Research setup/check passes, source trees are clean at pinned commits, runtime notes identify state and viewport, and each extracted rule links to a fixture or source path.
