# Project charter

## Mission

Idle Mine Beyond begins as a modern, platform-independent reimplementation of the final available Idle Mine: Remix behavior. During the compatibility phase, preserve what players can observe: mechanics, content, formulas, progression, randomness, names, saves, story, presentation, and interactions.

> **IDENTICAL FIRST. BETTER SECOND.**

Internal architecture may change substantially. Player-visible behavior may change only through a documented behavioral exception approved for the project. The Beyond era starts after a tested, tagged compatibility baseline, planned as parity-v1.

## Project phase

Current phase: **Phase 0 — Foundation / Reference Archaeology**.

This bootstrap establishes repository structure, frozen research inputs, documentation, tooling, and test harnesses. It does not implement gameplay or claim parity.

## Three projects

- **Idle Mine** is Crovie’s original Flash game and historical lineage. It helps explain inherited mechanics; it does not define the target when Remix differs.
- **Idle Mine: Remix** is the canonical compatibility target. The exact source snapshot is pinned in the reference manifest.
- **idle-mine-remux** is an incomplete later rewrite and prior art only. Its simplifications never override Remix evidence.

## Non-goals before parity-v1

No redesign, rebalance, progression replacement, mechanic simplification, invented content, deterministic gear tiers, prestige convention, generic dashboard styling, or silent legacy “fixes.” Improvements belong in the post-parity backlog unless a behavioral exception is explicitly accepted.

## Principles

1. Inspect and cite the reference before implementing uncertain behavior.
2. Preserve observable quirks when evidence shows that they are part of current behavior.
3. Improve invisible implementation concerns—modularity, typing, validation, testability—without changing player-visible behavior.
4. Treat documentation and parity evidence as part of the deliverable.
5. Do not describe the game as implemented. The product currently contains only foundation scaffolding.
