# Phase 8 — Visual certification

Status: In progress.

## Outcome

Provide reviewable visual parity evidence for fixed viewport, theme, and state fixtures.

## Required viewports

1366×768, 1440×900, 1920×1080, and 2560×1440; light and dark themes.

## Current evidence

At 1440x900, tracked Windows source/implementation pairs match the pinned Remix in both themes for fresh Game Start Story, first-Mud, first-Paper, first-Blacksmith, first-Clay, first-Stone, 10,000-Money, natural millionaire initial and scrolled views, controlled Spooky Bone progress, the natural millionaire-to-Spooky-Bone state, all nine controlled all-unlocked Story pages, fresh Mining, and fresh Settings. Fourteen selected progression views reach first eligibility through Chapter 5; the Chapter 3, Chapter 4, and Chapter 5 screens match at zero pixels in light theme on Windows. The Story suite has all 61 condition expressions with 177 boundary samples, notification/high-water transition cases, sampled objective outputs across mine levels and all notations, and all rendered chapter/template blocks. It compares selected screens and all 48 mine-object preview occurrences by RGBA hash. We will not capture every remaining milestone: these views share `StoryPanel` and the pinned template, and the source-backed state tests already cover their conditions, notification transitions, and objective text. Add another Story screenshot only for a distinct rendering branch or an identified integration gap. The natural source route and full checkpoint replay through Chapter 5 are complete. Finish the natural Chapter 6 route and capture one light 1440x900 screenshot. For Chapters 7 to 9, use pinned Remix saves at the start of Space, Wisdom/stars, and galaxies; replay a few thousand actions from each save in Beyond and compare complete state plus RNG after each action. Add differential tests over representative captured states and deterministic randomized action sequences with fixed seeds instead of replaying those phases from a new game. The visual corpus has 47 full-screen Windows captures plus one craft-selector crop; this is selected state coverage, not whole-game certification.

Beyond's core now replays six captured natural route segments from equivalent Remix route-start saves with the shared seed 7454 and recorded RNG offsets. It matches complete normalized state and RNG cursor at all 2,339 source checkpoints: 127 through first Stone, 32 through 10,000 Money, 208 through millionaire, 71 through Spooky Bone, 212 through first Chapter 3 eligibility, and 1,689 from first Chapter 3 eligibility to first Chapter 4 eligibility. These are route-segment certifications, not fresh-game-to-chapter replays. The Chapter 6 natural source route and complete Beyond replay are in progress. Chapters 7 to 9 will use representative phase-start saves and differential action segments as specified below.

The visual corpus has 48 Windows sidecars (47 full-screen captures plus one crop) and 23 Linux captures. The three new natural Chapter 3-5 light screenshots are Windows-only. The 22 Linux screenshots for the eleven selected Story views (light and dark) remain missing; this Windows session cannot start WSL (`Wsl/Service/E_ACCESSDENIED`), and those captures will be produced externally. Do not retry WSL here. E2E keeps Linux state/DOM assertions enabled while skipping only the platform-specific screenshot comparison.

## Next work

- Finish the natural Remix route to first Chapter 6 eligibility, replay it in Beyond from the Chapter 5 route start with the same seed, and compare complete state plus RNG at every recorded intermediate checkpoint. Capture one 1440x900 light-theme screen for Chapter 6.
- For Chapters 7 to 9, capture and pin Remix saves at the start of Space, Wisdom/stars, and galaxies. For each phase, replay a few thousand source-equivalent actions from its starting save and compare complete normalized state and RNG after each action. Add differential tests over representative captured states and reproducible randomized action sequences with fixed seeds. Do not create fresh-game routes to those chapters.
- After those source-backed segments, compare the upgrades shop, Powers, and representative Mining states at 1440x900. Then compare only primary screens (Mining, Story, and Settings) at 1366x768, 1920x1080, and 2560x1440; do not expand every state to every viewport.
- Keep the 22 Linux Story screenshots as external work; do not retry WSL in this Windows session.
- Defer running-Tauri-WebView save/reload certification until native packaging. Keep its procedure documented, but do not make it a gate for this visual-certification phase.
- After these prioritized visual comparisons, continue procedural-object probes above ID 768 and capture gameplay-derived long-running saves.
- Record every intentional visible difference in `docs/knowledge/BEHAVIORAL_EXCEPTIONS.md`; current default remains no exceptions.

## Validation

`pnpm reference:story-runtime` and `pnpm reference:mining-screen` verify source captures. `pnpm test:e2e` compares the Beyond browser route against available Windows or Linux source screenshots and preserves interaction assertions when a platform pair is missing. `pnpm test:parity` checks tracked sidecar hashes and source state equality across available platform pairs. Baseline capture conditions are reproducible, screenshot diffs are reviewed, and every accepted difference has an entry in the behavioral exceptions log.
