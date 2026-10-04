# Phase 1 — Source-to-test branch audit

Status: First-pass function/branch inventory complete across all 36 matrix areas (2026-10-02); Phase 1 remains in progress. Eleven matrix rows are Certified: Big-number math and serialization, Random distributions and RNG, Fresh simulation-state initialization, Simulation action composition, Active and idle damage, Fixed mine objects, Special mine objects, Procedural mine objects, Mine rendering and compositing, Number formatting and notations, and Progression route and phase replay. Formula/RNG samples qualify only after the boundary, fixed-seed, and differential criteria in the trace-map README pass. Other save/state/visual gaps remain open.

## Outcome

Audit every web parity-matrix area against the pinned Remix implementation.
Record each relevant source function and control-flow branch with its source
fixture and Beyond assertion. Any reachable untested path is a gap and must get
a focused source-based test before the area can advance. Do not infer
certification from broad randomized traces, code presence, or visual similarity.

The web `parity-v1` tag excludes native packaging, native storage, and running
Tauri WebView behavior. Preserve the complete source and Beyond state/RNG
differential comparisons already captured from three phase-start saves and
three paired `(game-RNG seed, action-sequence seed)` combinations per save
(not a Cartesian product), with 10,000 actions per pair. Do not add arbitrary
probes. Add focused source captures only when they close a named missing
boundary or branch, as with the 119 pickaxe quality-name boundary crafts.

## Evidence and rules

- Canonical Remix: commit `0e0f4bf5a9c66e5603cda2ce4bd54213023dae21` in the
  ignored `.research/upstream/idle-mine-remix` checkout.
- For each area, map the source method and its relevant condition/branch to a
  named source capture or fixture and the exact Beyond parity/unit/E2E test.
- A function path without an assertion is a gap. Record it, add a focused test
  from source evidence, run the relevant suite, and update the map and matrix.
- Label sampled value domains separately from branch coverage. Qualified
  formula/RNG samples are acceptable without exhaustive values when every
  relevant boundary is tested, a fixed-seed sample is recorded, and the
  differential has no divergence. Sampling alone never substitutes for a
  missing boundary or other required evidence.
- Exclude only paths unreachable from pinned player-facing game content or
  native-only behavior; document the source/configuration evidence and scope.
- Never alter the pinned Remix checkout. Keep any boundary capture read-only
  and tied to a named source expression.
- Keep an area In progress while its map retains a `Gap`, an unqualified
  formula/RNG `Sampled`, or an unresolved non-formula state/platform domain.

## Work order

1. Upgrade/resource purchase and display branches. **Done:** existing source
   purchase cases now have live Money, Gem, Planet Coin, and Wisdom UI dispatch
   assertions; the Planet Coin shop 89/90 visibility predicate has a focused
   Chromium test. Existing formula/display sample limits remain explicit.
2. Progression and randomness: Powers, crafting, naming, seeded RNG, Story, and
   route replay. **First-pass inventory complete:** every area has a branch
   table linked to its source fixture and assertion test.
3. Simulation/content: initialization, actions, formatting, mine-object
   generation/rendering, drops, damage, and resources. **First-pass inventory
   complete.**
4. Persistence/time: codec/import/recovery/export/schema/storage/offline paths.
   **First-pass inventory complete.**
5. Web presentation: Settings/input/theme, screen interactions, and visual
   slices. **First-pass inventory complete.** Native rows remain explicitly
   outside web-v1.
6. Review every matrix/map pair, rerun the full documented web validation
   suite, and update project status. **First pass complete:** all 36 areas have
   tables, each mapped path has a source/evidence/assertion row and names an
   existing test (or an explicit web-v1 exclusion), and the pinned checkouts
   and fixtures validate. Random distributions and RNG is the first Certified
   area. Formula/RNG domains marked `Sampled (qualified)` no longer block on
   exhaustive input enumeration; keep other areas open for their specifically
   named state, platform, visual, or integration evidence. Add probes only to
   close a missing relevant boundary or source branch.

## Validation

For each edited area, run its focused parity/unit/E2E tests, `pnpm
parity:traceability`, `pnpm docs:check`, and `pnpm format:check`. At the end, run
`pnpm research:check`, `pnpm skills:check`, `pnpm check`,
`pnpm test:reference`, `pnpm test:e2e`, and `pnpm test:site` (using the
documented host/WSL workflow where available). Verify the full differential
fixture hashes and complete per-action state/RNG comparisons.

## Current completed slice

- Upgrade formulas, caps, transactions, display text, and purchase-mode source
  captures are mapped to unit fixtures.
- Browser tests exercise live purchase routing for Money, Gems, Planet Coins,
  and Wisdom. The Planet Coin shop is absent at mine high-water 89 and visible
  at 90. Focused unit and Chromium tests pass.
- The pinned `index.html` Planet Coin header/tab gate now has four additional
  1440x900 source/Beyond screenshots at high-water 89/90 in light and dark.
  The priority E2E checks the absent/present tab and exact screenshots. This
  closes the selected gate-screen visual branch; other shop states remain open.
- Drop outcomes have live source-seeded Mining clicks for the pinned Planet Coin
  object (ID 90) and Wisdom object (ID 169), with exact balances, unchanged Gem
  balance, high-water/selection behavior, and RNG draw counts compared to the
  source cases. Four full-screen post-award source/Beyond screenshots for those
  objects in both themes match at zero pixels on Windows. The pinned source
  capture waits one main-loop frame after loading so Story notification state
  matches the Beyond visible initialized state. Linux retains semantic coverage
  but has no pixel pairs for these four screens; the drop row remains In progress.
- Trace tables now cover all 36 parity-matrix entries. The checker requires an
  inventory and an existing test link per mapped path, recognizes multiple
  headed tables within one area, resolves pinned source files/functions, and
  blocks Certified status while a map records `Gap` or an
  unqualified `Sampled` item. It permits `Sampled (qualified)` formula/RNG
  domains under the evidence rule in the trace-map README. It validates map
  structure, not the semantic strength of assertions; source and test review
  remain required.
- Full validation on 2026-10-02 passed: `pnpm check` (15 unit and 150 parity tests),
  `pnpm test:reference` (Story runtime, nine phase traces, 47 Canvas goldens,
  and 32 priority visual states), `pnpm test:e2e` (108/108),
  `pnpm test:site` (14/14), docs, Skills, research, and formatting checks.
- Latest sampled-domain re-evaluation checks passed `pnpm parity:traceability`
  (36 areas), `pnpm docs:check` (85 Markdown files), `pnpm format:check`,
  `pnpm research:check`, `pnpm skills:check`, and 11 focused parity files (49
  tests). The first-Mud timeout was diagnosed: suppressing the game's animation
  frame loop also delayed applying the dynamically loaded theme stylesheet.
  The probe now waits for stylesheet load and advances one preserved native
  frame without restarting the loop. Both `pnpm reference:story-first-mud` and
  the full `pnpm reference:story-runtime` pass against the pinned fixture.
- The aggregate `pnpm test:reference` was rerun after the fix and passed the
  pinned corpus, Story markup/runtime, all nine 10,000-action phase traces, 47
  Canvas goldens, Mining/craft captures, and all tracked priority visual hashes.
- Sampled formula/RNG domains remain open only for named missing boundaries or
  observed divergence, not non-exhaustive value counts. Decimal arithmetic
  boundaries are now captured and tested. The notation corpus has 359 direct inputs across 40 formatters, including its fixed-seed sample, MAX_VALUE
  sentinels, and source cases for Zalgo, Haha Funny, Evil, Nice, Coronavirus replacement paths, and all Greek Letters table/base-49 loop paths, Scientific/Engineering mantissa carry,
  Mixed Logarithm, Standard, Infinity, Brackets, Dots, Clock, Hex sign/finite dispatch and terminal tie-rounding, Prime factorization/logarithmic boundaries, Custom Base, Roman, Letters/Cancer, shared AD dispatch,
  and Remix's Idle Mine/SI formatters. At this earlier checkpoint, some
  class-specific AD/community branches still needed source cases; those later
  boundary captures are summarized in the current simulation/content trace map.
  Save, visual, browser-time, and platform state domains remain separate
  evidence work.
- The re-evaluation marks Big-number math and serialization Certified after its
  mapped Decimal operations, source boundaries, 16-pair fixed-seed differential,
  and JSON round-trip property passed review; the non-exhaustive numeric domain
  was not a blocker. Random distributions and RNG is also Certified after manual
  source/test review confirmed every consumer path, draw threshold, seeded
  sample, and the 90,000-checkpoint differential. Qualified formula/RNG samples
  do not certify the other rows: their open items are state, platform, visual,
  and integration evidence, not a demand for exhaustive numeric values. No
  uncovered mapped branch is represented as covered by argument alone.
- Japanese notation's AD Notations 1.6.0 branches now have a source fixture for
  all 18 suffix indices, residual-group omission/append, and the exponent-72
  transition. The direct 359-value notation corpus and 32 fixed-seed values did
  not grow. Unit and Chromium assertions pass. At this intermediate checkpoint,
  the follow-on fixture covered Omega/Omega Short amount, order, and
  safe-integer boundaries while Elemental, Flags, Precise Prime, and AD Imperial
  still needed mapped cases; their later coverage is in the current trace map.
- Tritetrated now has ten source-captured `tritetrated()` outputs covering zero,
  the input-1 and input-16 roots, convergence, and large values. The existing
  32-value notation seed remains its non-exhaustive sample; no probes were added
  to that sample. Oracle verification, the focused unit test (1/1), Chromium
  foundation E2E (5/5), typecheck, lint, targeted formatting, docs, and
  traceability checks pass.
- Offline progression also meets the sampled formula rule: ten source-captured
  branch boundaries plus sixteen xorshift32 elapsed values (`0x4f46464c`) are
  compared against complete pinned `loadGame()` results. Keep browser suspension
  and clock discontinuity as separate environment evidence; do not expand any
  already-qualified formula/RNG sample without a missing boundary or mismatch.
- Offline closeout validation on 2026-10-03 passed `reference:update` and oracle
  verification (26 captured cases), the focused unit test (5/5), Chromium E2E
  (1/1), `parity:traceability` (36 areas), `docs:check` (85 files), global
  `format:check`, TypeScript/Svelte checks, lint, and `git diff --check`. The
  full aggregate `pnpm check` was not rerun; these checks cover the changed
  probe, fixture, test, and documentation.
- Git metadata is read-only in this environment; validated work cannot be
  committed or pushed here. Do not bypass the repository boundary.
- Simulation action composition now has a fourth source-captured frame case:
  full-health Mud is broken by one idle frame, the autosave captures the
  pre-Story state, and Story refresh then advances to the first-Mud milestone.
  `simulation-action.test.ts` compares complete state/RNG and save output; the
  Chromium web E2E drives the real RAF path, checks the same visible result and
  persisted pre-refresh state, and asserts the seeded draw count. The broader
  focused suites and project checks are recorded in `project-status.md`.
- Upgrade card/detail visuals compare all 22 Money, Gem, and Planet Coin cards
  at levels 0 and 1 in both themes at 1440x900. The same source-paired test now
  compares the complete viewport for each shop group, level, and theme (12
  states), plus zero-resource, Money below-price, and exact-price boundaries
  for all three groups in both themes (14 states). This exposed a dark Money
  level-1 mismatch: Remix leaves the Gem
  Waster craft-cost button transparent at rest, while Beyond inherited the
  generic dark button background. The source `main.css` default and dark-theme
  hover override are now reproduced in the Svelte page. All four focused full-
  screen scenarios passed after the fix. Other resource balances, modifier
  hints, and broader application states remain open; finite formula samples do
  not block their certification.
