# Phase 8 — Visual certification

Status: In progress.

## Outcome

Provide reviewable visual parity evidence for fixed viewport, theme, and state fixtures.

## Required viewports

1366×768, 1440×900, 1920×1080, and 2560×1440; light and dark themes.

## Current evidence

At 1440x900, tracked Windows source/implementation pairs match the pinned Remix in both themes for fresh Game Start Story, selected natural Story milestones through Chapter 6, all nine controlled all-unlocked Story pages, fresh Mining, fresh Settings, all three upgrade tabs, three phase-start Mining states, and the controlled Powers boundary. Fifteen selected progression views reach first eligibility through Chapter 6; the Chapter 3-6 screens match at zero pixels in light theme on Windows. The Story suite has all 61 condition expressions with 177 boundary samples, notification/high-water transition cases, sampled objective outputs across mine levels and all notations, and all rendered chapter/template blocks. It compares selected screens and all 48 mine-object preview occurrences by RGBA hash. We will not capture every remaining milestone: these views share `StoryPanel` and the pinned template, and the source-backed state tests already cover their conditions, notification transitions, and objective text. Add another Story screenshot only for a distinct rendering branch or an identified integration gap. The natural source route and full checkpoint replay through Chapter 6 are complete, including its light 1440x900 screenshot. For Chapters 7 to 9, controlled phase-start saves now cover Space/object 124, Wisdom/stars/object 169, and galaxies/object 198 with 3,000 randomized actions and full-state/RNG comparison per save. These do not claim natural paths. The visual corpus has 80 full-screen Windows captures plus one crop; 32 newly selected captures, each with a Linux pair, cover upgrade tabs, Powers, phase Mining states, and primary screens at the other viewports. This is selected state coverage, not whole-game certification.

Beyond's core replays eight captured natural route segments from equivalent Remix route-start saves with the shared seed 7454 and recorded RNG offsets. It matches complete normalized state and RNG cursor at all 3,833,896 source checkpoints: 82,655 through first Chapter 5 eligibility, then 3,751,241 from the Chapter 5 endpoint through first Chapter 6 eligibility. These are route-segment certifications, not fresh-game-to-chapter replays. Chapters 7-9 now have three controlled phase-start saves captured through Remix, each with 3,000 fixed-seed randomized actions and full-state/RNG checkpoints; Beyond matches all 9,000 checkpoints. These controlled starts do not claim natural progression to their save states.

The visual corpus has 81 Windows sidecars (80 full-screen captures plus one crop) and 77 Linux sidecars. The 22 Linux screenshots for the eleven selected Story views (light and dark) were captured in an external Ubuntu WSL session on 2026-10-01, and Linux E2E compares them at zero pixels. The 32 priority viewport/state captures gained Linux pairs on 2026-10-01. Only the selected natural Chapter 3-6 light screenshots are Windows-only; Linux E2E keeps their state/DOM assertions.

## Next work

- Complete: compare Money/Gem/Planet Coin upgrade tabs, Powers at its controlled unlock boundary, and Space/Wisdom/galaxy Mining states at 1440x900 in both themes against pinned Remix captures.
- Complete: compare only primary Mining, Story, and Settings screens at 1366x768, 1920x1080, and 2560x1440 in both themes; do not expand every state to every viewport.
- Defer running-Tauri-WebView save/reload certification until native packaging. Keep its procedure documented, but do not make it a gate for this visual-certification phase.
- Completed in the Phase 1 follow-up: added selected procedural probes above ID 768 and verified four gameplay-generated route-end saves through Beyond import and v1 restore. This is not exhaustive generator or historical-save certification; see [the follow-up plan](phase-01-parity-depth-follow-up.md).
- Record every intentional visible difference in `docs/knowledge/BEHAVIORAL_EXCEPTIONS.md`; current default remains no exceptions.

## Validation

`pnpm reference:story-runtime`, `pnpm reference:mining-screen`, and `pnpm reference:priority-visuals` verify source captures. `pnpm exec playwright test tests/e2e/priority-visual.spec.ts` compares the Beyond browser route with these baselines at zero differing pixels on Windows and Linux. `pnpm test:e2e` preserves interaction assertions when a platform pair is missing. `pnpm test:parity` checks tracked sidecar hashes and source state equality across available platform pairs. Baseline capture conditions are reproducible, screenshot diffs are reviewed, and every accepted difference has an entry in the behavioral exceptions log.
