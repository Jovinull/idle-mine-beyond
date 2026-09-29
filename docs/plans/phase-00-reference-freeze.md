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

## Remaining work

- Expand notation probes to every compatibility threshold and formatter edge.
- Extract full boundary matrices for damage/earnings, upgrades, crafting RNG, saves, offline behavior, and representative story/settings states.
- Complete the asset/font provenance audit and extract save examples with no unsupported copying.

## Validation

Research setup/check passes, source trees are clean at pinned commits, runtime notes identify state and viewport, and each extracted rule links to a fixture or source path.
