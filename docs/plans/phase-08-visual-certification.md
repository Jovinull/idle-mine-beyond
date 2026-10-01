# Phase 8 — Visual certification

Status: In progress.

## Outcome

Provide reviewable visual parity evidence for fixed viewport, theme, and state fixtures.

## Required viewports

1366×768, 1440×900, 1920×1080, and 2560×1440; light and dark themes.

## Current evidence

At 1440x900, tracked Windows source/implementation pairs match the pinned Remix in both themes for fresh Game Start Story, first-Mud, first-Paper, first-Blacksmith, first-Clay, first-Stone, 10,000-Money, natural millionaire initial and scrolled views, controlled Spooky Bone progress, the natural millionaire-to-Spooky-Bone state, all nine controlled all-unlocked Story pages, fresh Mining, and fresh Settings. The Story suite has eleven selected progression views, all 61 condition expressions with 177 boundary samples, notification/high-water transition cases, sampled objective outputs across mine levels and all notations, and all rendered chapter/template blocks. It compares each selected screen at zero pixels and all 48 mine-object preview occurrences by RGBA hash. We will not capture every remaining milestone: these views share `StoryPanel` and the pinned template, and the source-backed state tests already cover their conditions, notification transitions, and objective text. Add another Story screenshot only for a distinct rendering branch or an identified integration gap. The currently captured natural source routes reach Chapters 1 and 2; the next Story captures will follow natural play to the first eligible state for each missing Chapter 3 through 9, compare the complete state, and capture one 1440x900 light-theme screenshot per chapter. These 44 full-screen Windows captures plus one craft-selector crop are selected state coverage, not whole-game certification.

The visual corpus has 45 Windows sidecars and 23 Linux captures. The 22 Linux screenshots for the eleven selected Story views (light and dark) remain missing; this Windows session cannot start WSL (`Wsl/Service/E_ACCESSDENIED`), and those captures will be produced externally. Do not retry WSL here. E2E keeps Linux state/DOM assertions enabled while skipping only the platform-specific screenshot comparison.

## Next work

- Continue each natural Story route from the same source-defined RNG seed and equivalent starting save in both Remix and Beyond; compare complete state snapshots at meaningful intermediate checkpoints through the first eligible state for Chapters 3-9, then record one 1440x900 light-theme screenshot per chapter. Do not count a route complete when Beyond only imports its final Remix save, and do not add one screenshot per remaining milestone.
- Capture the 22 Linux Story screenshots (eleven selected views in light and dark) in an external Linux session; this Windows session must not retry blocked WSL.
- After the chapter checkpoints, expand visual comparison to the upgrades shop, Powers, and additional Mining states at 1440x900, then cover 1366x768, 1920x1080, and 2560x1440 for key states.
- Record every intentional visible difference in `docs/knowledge/BEHAVIORAL_EXCEPTIONS.md`; current default remains no exceptions.

## Validation

`pnpm reference:story-runtime` and `pnpm reference:mining-screen` verify source captures. `pnpm test:e2e` compares the Beyond browser route against available Windows or Linux source screenshots and preserves interaction assertions when a platform pair is missing. `pnpm test:parity` checks tracked sidecar hashes and source state equality across available platform pairs. Baseline capture conditions are reproducible, screenshot diffs are reviewed, and every accepted difference has an entry in the behavioral exceptions log.
