# Phase 8 — Visual certification

Status: In progress.

## Outcome

Provide reviewable visual parity evidence for fixed viewport, theme, and state fixtures.

## Required viewports

1366×768, 1440×900, 1920×1080, and 2560×1440; light and dark themes.

## Current evidence

At 1440x900, tracked Windows source/implementation pairs match the pinned Remix in both themes for fresh Game Start Story, selected natural Story milestones through Chapter 6, all nine controlled all-unlocked Story pages, fresh Mining, fresh Settings, the controlled full craft panel in both themes at 1440x900, all three upgrade tabs, the Planet Coin gate at high-water 89/90, three phase-start Mining states, the controlled Powers boundary, and post-award Planet Coin/Wisdom balances. Four gate screenshots compare the hidden 89 and visible 90 states in both themes at zero pixels; their browser test also checks the tab boundary and dark-theme zero-damage label color. The four post-award screenshots replay source-shaped saves through a main-loop frame and real click, then match at zero pixels in both themes. Fifteen selected progression views reach first eligibility through Chapter 6; the Chapter 3-6 screens match at zero pixels in light theme on Windows. The Story suite has all 61 condition expressions with 177 boundary samples, notification/high-water transition cases, sampled objective outputs across mine levels and all notations, and all rendered chapter/template blocks. It compares selected screens and all 48 mine-object preview occurrences by RGBA hash. We will not capture every remaining milestone: these views share `StoryPanel` and the pinned template, and the source-backed state tests already cover their conditions, notification transitions, and objective text. Add another Story screenshot only for a distinct rendering branch or an identified integration gap. The natural source route and full checkpoint replay through Chapter 6 are complete, including its light 1440x900 screenshot. For Chapters 7 to 9, the three controlled phase-start saves at objects 124, 169, and 198 each have three paired fixed `(game-RNG seed, action-sequence seed)` runs (not a Cartesian product), with 10,000 randomized actions per pair and full simulation-state/RNG comparison after every action (nine traces, 90,000 checkpoints). These are controlled source saves, not natural paths. The visual corpus has 90 full-screen Windows captures plus one crop; 32 priority captures, each with a Linux pair, cover upgrade tabs, Powers, phase Mining states, and primary screens at the other viewports. This is selected state coverage, not whole-game certification.

The aggregate `reference:priority-visuals` source replay was rerun after the
Planet Coin gate addition and verifies every capture/state entry. It opens a
fresh browser context for the 89/90 captures so prior source-tab interactions
cannot affect their screenshots; manifest entries use a deterministic order.

The controlled Powers boundary has its tracked 1440x900 light/dark screenshot
pairs. Separately, `tests/e2e/powers-prestige-differential.spec.ts` captures the
complete initial, stale-after-prestige, and remounted screens from pinned Remix
and Beyond in both themes and compares the PNGs directly. This verifies the
legacy table refresh presentation for one controlled prestige input; later
Power balances and other prestige inputs remain open.

The shop catalog differential now visits all 22 Money, Gem, and Planet Coin
cards at level zero with abundant resources, compares their card presentation
and resting pixels plus every hovered detail panel at zero differing pixels,
and passes in both themes at 1440x900. Representative affordability states
remain separate, and this catalog state does not certify every balance, level,
cap, modifier/card combination, or full-screen state. The four affordability
and catalog E2Es pass together (4/4). Removing Beyond's forced `84vh` article
height restores the pinned source layout; the priority visual suite passes
36/36 afterward.

The Gem exact-price affordability state now also compares stabilized full
1440x900 viewport screenshots against the pinned source in light and dark. The
earlier two-pixel diagnostic did not reproduce in three paired captures per
theme; the source-paired E2E asserts the complete viewport hash and passed 2/2.
Other resource balances and shop screen states remain open.

The finite-cap boundary differential now covers all 15 capped Money, Gem, and
Planet Coin cards at `cap - 1`, `cap`, and `cap + 1`, in both themes at
1440x900. It compares source-captured level/effect/price text, affordability
classes/styles, and exact card plus tooltip pixels. The focused Playwright run
passed 2/2 in Chromium (3.8 minutes). This closes the finite-cap visual
boundary slice; non-cap levels, other balances, modifier-hint screenshot states,
and full-screen states remain open.

The source-paired shop action differential now enumerates all 22 cards under
single, Shift, and Control from level zero (66 actions), comparing the resulting
level, card/tooltip presentation, and visible resource balances with Remix. The
focused test passed 1/1 in Chromium (2.2 minutes). This action check closes the
modifier-to-card routing matrix for those starts; it does not cover other
starting levels or balances or certify full-screen visuals.

The affordability differential now also waits for Remix's selected theme CSS
and compares the computed hover background of each Money/Gem/PC tab after its
click. This exposed the dark cascade: Remix keeps the hovered tab at `#636363`
through its important generic button rule, despite a later `.upg-tabs` rule for
`#777777`. Beyond now matches `#636363`; both light/dark focused cases pass. This
closes the tab-hover interaction style only, not the remaining shop screen
states.

Beyond's core replays eight captured natural route segments from equivalent Remix route-start saves with the shared seed 7454 and recorded RNG offsets. It matches complete normalized state and RNG cursor at all 3,833,896 source checkpoints: 82,655 through first Chapter 5 eligibility, then 3,751,241 from the Chapter 5 endpoint through first Chapter 6 eligibility. These are route-segment comparisons, not fresh-game-to-chapter replays. Chapters 7-9 have three controlled phase-start saves captured through Remix; each save has three independent 10,000-action traces under fixed RNG/action-sequence seeds. Beyond compares all 90,000 checkpoints. These controlled starts do not claim natural progression to their save states.

The visual corpus has 91 Windows sidecars (90 full-screen captures plus one crop) and 83 Linux sidecars. The 22 Linux screenshots for the eleven selected Story views (light and dark) were captured in an external Ubuntu WSL session on 2026-10-01, and Linux E2E compares them at zero pixels. The 32 priority viewport/state captures gained Linux pairs on 2026-10-01. The controlled full craft-panel screenshots gained Linux pairs on 2026-10-03. The four post-award Planet Coin/Wisdom screenshots gained Linux pairs on 2026-10-04. The selected natural Chapter 3-6 light screenshots and four Planet Coin shop-gate screenshots are Windows-only (on Linux the pinned level-90 light gate renders in one of two one-pixel variants); Linux E2E keeps route state/DOM assertions, craft selector interaction checks, source-seeded drop checks, and the 89/90 gate assertions without those screenshots.

## Next work

- Complete: compare Money/Gem/Planet Coin upgrade tabs, Powers at its controlled unlock boundary, and Space/Wisdom/galaxy Mining states at 1440x900 in both themes against pinned Remix captures.
- Complete: compare the Planet Coin header/tab gate at source high-water 89/90 in light and dark; Linux retains semantic visibility assertions without pixel baselines.
- Complete: compare only primary Mining, Story, and Settings screens at 1366x768, 1920x1080, and 2560x1440 in both themes; do not expand every state to every viewport.
- Defer running-Tauri-WebView save/reload certification until native packaging. Keep its procedure documented, but do not make it a gate for this visual-certification phase.
- Completed in the Phase 1 follow-up: added selected procedural probes above ID 768 and verified four gameplay-generated route-end saves through Beyond import and v1 restore. This is not exhaustive generator or historical-save certification; see [the follow-up plan](phase-01-parity-depth-follow-up.md).
- Record every intentional visible difference in `docs/knowledge/BEHAVIORAL_EXCEPTIONS.md`; current default remains no exceptions.

## Validation

`pnpm reference:story-runtime`, `pnpm reference:mining-screen`, `pnpm reference:priority-visuals`, and `pnpm reference:priority-visuals:shop-gate` verify source captures. `pnpm exec playwright test tests/e2e/priority-visual.spec.ts` compares the Beyond browser route with these baselines at zero differing pixels on Windows and Linux for available pairs. `pnpm test:e2e` preserves interaction assertions when a platform pair is missing. `pnpm test:parity` checks tracked sidecar hashes and source state equality across available platform pairs. Baseline capture conditions are reproducible, screenshot diffs are reviewed, and every accepted difference has an entry in the behavioral exceptions log.
