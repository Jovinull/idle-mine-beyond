# Source-to-test traceability

This is the audit map for every row in [the parity matrix](../PARITY_MATRIX.md).
The source column names functions and meaningful control-flow branches in the
pinned Remix commit. Each branch points to its Beyond test and source fixture.
The map records uncovered paths as gaps; it is not a certification claim.
Every area has a `function and branch trace` table. `pnpm parity:traceability`
checks that each matrix row has such an inventory, each path row has a branch,
evidence, and assertion cell, and each covered row links to an existing parity,
unit, E2E, or package-local test. A row marked `Gap` explicitly records that no
assertion covers that path yet; `Out of web-v1 scope` records an intentional
exclusion. Mapped Remix paths must resolve in the pinned checkout. This
structural check does not decide whether the human-authored assertion actually
proves the described behavior; reviewers must inspect the fixture and assertion
before changing status.

## Audit rules

- The source is `.research/upstream/idle-mine-remix/` at commit
  `0e0f4bf5a9c66e5603cda2ce4bd54213023dae21`, verified by `pnpm research:check`.
- A branch is **covered** only when a test asserts the source-observed result for
  that branch. Running code or reaching a screenshot is not sufficient by itself.
- A **gap** is a relevant source path without a source-based assertion. The gap
  stays open until a focused fixture/test exercises it.
- **`Sampled` does not by itself block certification.** A non-exhaustive formula
  or RNG input domain is **qualified** when tests cover every relevant source
  boundary (as applicable: zero, lower/upper limits, both sides of strict
  thresholds, piecewise or generation-region transitions, caps/sentinels, and
  RNG draw/branch thresholds), an additional generated sample has a recorded
  fixed seed, and the pinned differential shows no divergence. Compare the full
  relevant output and RNG effects for pure functions/content generation, or the
  complete simulation state and RNG after every action for action differentials.
  Record the boundary assertions, seed/sample, and differential. Once those
  conditions pass, a finite sample is not a certification blocker: **only a
  missing relevant source boundary blocks coverage of that sampled domain**.
  A differential mismatch is a compatibility failure to fix, not a sample-size
  problem; do not expand an already adequate sample just because it is finite.
- Random testing cannot replace a missing source boundary. Screenshot/state
  combinations, save shapes, browser-storage failure modes, and platform
  behavior do not qualify under the formula/RNG rule; document those separately
  and keep their unresolved paths open.
- Project-only schemas and adapters have no Remix function to map; their own
  branch tests are mapped and their compatibility scope is stated explicitly.
- Native packaging and native storage are excluded from the web `parity-v1`
  gate. Their foundation tests do not imply native parity.
- A matrix area can be proposed as **Certified** only when every relevant branch
  below is covered, all evidence layers required by the matrix pass, and the
  review has no unresolved gap. `Sampled (qualified)` is acceptable evidence
  for an unbounded formula/RNG input domain. Once its fixed-seed sample and
  differential pass, only a missing relevant boundary blocks that sampled
  domain; separate uncovered source paths and non-formula state/platform,
  integration, or visual gaps still block their own evidence layers. The
  traceability checker rejects unqualified map entries on Certified rows but
  does not decide the human evidence review.

## Sampled-domain re-evaluation (2026-10-04)

A finite sample does not block a formula/RNG domain after its relevant source
boundaries, recorded fixed-seed sample, and pinned differential pass. This rule
qualifies only that sampled formula/RNG subdomain. Unmapped source paths and
separate state, platform, integration, UI, or visual evidence remain independent
gaps. A differential mismatch is a compatibility failure to fix, not a reason to
increase the sample.

**Reassessment outcome:** every `Sampled (qualified)` formula/RNG entry across
the four trace maps has named source-boundary evidence, a recorded fixed-seed
sample, and a passing pinned differential. None of the 36 matrix areas is In
progress solely because its random sample is finite. For a sampled formula/RNG
domain, only a missing relevant source boundary is a coverage blocker; a
differential mismatch is a compatibility failure. Separately mapped source
branches and required state, save, platform, integration, UI, or visual evidence
can still keep their matrix area In progress. Finite sample size alone changes
no status, and does not justify further probes; certification still requires
the complete row review.

This re-evaluation was validated on 2026-10-04 with `pnpm test:parity` (35
files, 152 tests), `pnpm test:e2e` (149/149), `pnpm parity:traceability` (36
areas), `pnpm docs:check` (85 Markdown files), and Prettier. No area remains In
progress solely because its formula/RNG sample is finite; rows stay open only
for their separately recorded evidence gaps.

| Formula/RNG area reviewed                     | Re-evaluated evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Remaining matrix status reason                                                                                                                                                                                                                         |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Big-number math and serialization             | Source cases cover zero and signed zero; exponent-gap cutoff at 16/17/18; scalar multiplication limits at ±1e307; rounding and string cutoffs; and MAX/MIN sentinels. Sixteen operand pairs from recorded seed `487530534` match the pinned browser Decimal runtime, and JSON round-trip properties pass.                                                                                                                                                                                                                                                 | **Certified.** No remaining component-row gap.                                                                                                                                                                                                         |
| Random distributions and RNG                  | Every pinned seeded/direct RNG consumer and threshold/draw branch is mapped. Fixed seeds reproduce stream, craft, and drop outcomes; all 90,000 phase-differential checkpoints match full state/RNG.                                                                                                                                                                                                                                                                                                                                                      | **Certified.** No remaining row gap.                                                                                                                                                                                                                   |
| Upgrade prices/effects, caps, and resources   | Source boundaries cover zero, limits, caps/softcaps, piecewise transitions, purchase branches, and cross-upgrade effects. Fixed-seed differential traces compare complete state/RNG without divergence.                                                                                                                                                                                                                                                                                                                                                   | Formula/RNG samples qualify. Money, Gems, Planet Coins, and aggregate upgrade rows remain In progress for individually mapped interaction and visual evidence, not finite level/value counts.                                                          |
| Active/idle damage, resource rates, and drops | Source tests cover zero/reward, defense and hit-count limits, scan windows, chance thresholds, caps, and positive/zero outcomes; seeded source differentials match complete state/RNG.                                                                                                                                                                                                                                                                                                                                                                    | Formula/RNG samples qualify. Active/idle damage is Certified with real click and idle-frame E2E; live Planet Coin/Wisdom drop integration now passes. Drop-state pixel baselines and broader mine rendering remain open in their maps.                 |
| Procedural mine objects                       | Region, anchor, modulo, color/drop, and scaling transitions have source cases. A recorded xorshift64* sample contributes 128 safe-integer IDs; all 920 captured records match the pinned browser oracle.                                                                                                                                                                                                                                                                                                                                                  | **Certified.** Source output covers all mapped branches; the browser loads all three generation regions and the first sparse high-ID probe through a Beyond save. Canvas output parity across all 920 captured records is Certified in Mine rendering. |
| Powers, pickaxe crafting, and naming          | Source cases cover prestige/visibility limits, draw/stop/replacement/cost paths, all 13 quality transitions and random offsets, name boundaries, and clamps. Seeded examples and fixed-seed differentials match.                                                                                                                                                                                                                                                                                                                                          | Formula/RNG samples qualify. Broader rows remain In progress for separately listed Powers/crafting UI and visual evidence.                                                                                                                             |
| Story predicates                              | All 61 condition predicates have boundary assertions; objective outputs span captured mine levels and all 40 notations; fixed-seed route/state differentials match progression state/RNG.                                                                                                                                                                                                                                                                                                                                                                 | Predicate samples qualify. The Story row remains In progress for selected route, application-state, and visual evidence.                                                                                                                               |
| Offline progression formulas                  | Source cases cover the strict 300-second threshold, just-over-threshold reward, default/upgraded caps, overflow, disabled/negative/zero-rate paths, and ordered effects. Sixteen xorshift32-seeded elapsed values (`0x4f46464c`) compare complete load results against pinned Remix with no divergence.                                                                                                                                                                                                                                                   | Elapsed-time formula sampling qualifies; browser suspension/clock discontinuity remains separate environment evidence. Native background behavior is outside web-v1.                                                                                   |
| Number formatting and notations               | The 359-value corpus retains its recorded fixed-seed sample. Source boundaries cover all 16 ALL dispatch slots, all Shi/Greek/Flags/Elemental tables, Japanese/Omega/Tritetrated/Precise Prime branches, and the full Imperial 17-unit table, 50 unit-search sides, MAX_VOLUME/reduction thresholds, small-unit cutoffs, and near/remainder decomposition. The Settings E2E compares visible `$1e100` output for 38 deterministic notations; a dynamic pinned Remix/Beyond browser differential compares ALL/Zalgo currency and Gems text plus RNG draws. | **Certified.** Source branches, boundary tests, qualified fixed-seed sampling, and visible UI/RNG differentials all pass.                                                                                                                              |

The review certifies Active and idle damage after its mapped browser action/timer
integration tests pass, and Procedural mine objects after its source-derived
browser integration cases pass across all three generator regions. Planet Coin
and Wisdom drop awards pass source-seeded real-click browser tests, and their
four post-award resource screenshots match the pinned source at zero pixels in
both themes at 1440x900 on Windows. That row remains In progress because these
new screenshots have no Linux pixel pairs and additional full-screen UI evidence
is tracked separately. Other aggregate rows remain In progress wherever their
maps retain a `Gap` or a required evidence layer is open. No additional random
probes are requested for a qualified formula/RNG domain.

### Domains that remain sampled for separate evidence reasons

Raw `Sampled` entries still describe non-formula domains: the complete app-state
space and action trajectories beyond the captured traces; arbitrary save bytes,
Unicode and historical save shapes; browser persistence failures and clock
suspension; physical keyboard/IME variants; and unselected theme/viewport/UI
states. Their named state, platform, integration, or full-screen visual evidence
remains open in the corresponding map. The pinned object Canvas corpus is no
longer a gap: all 920 captured records have live source/Beyond pixel comparisons
in the Mine rendering row. The formula/RNG rule neither certifies nor waives the
remaining domains, and random formula probes cannot close them.

The 119 pickaxe quality-boundary cases exposed a runtime-specific edge: at exact
`1.4^5`, pinned Chromium produces `Epic`, while Node `Math.log` can round the
ratio to 5 and produce `Legendary`. `tests/e2e/pickaxe-quality-boundaries.spec.ts`
compares exact cases in Chromium; the Node unit test checks both sides of each
boundary. Preserve the browser result as the web oracle.

Chapters 7–9 use differential coverage of selected long action sequences: three
pinned phase-start saves, three paired fixed seeds per save, 10,000 actions per
trace, and full state/RNG equality after every action. This does not claim fresh-
game natural routes for those chapters.

## Area maps

| Matrix areas                                                                                                          | Trace map                                                   |
| --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Big-number math, initialization, simulation actions, formatting, mine objects, drops, rendering, damage and resources | [Simulation and content](simulation-and-content.md)         |
| Upgrades, Powers, pickaxe crafting, names, RNG, Story and progression replay                                          | [Progression systems](progression-systems.md)               |
| Remix save codec/import/export, Beyond saves, storage, and offline progression                                        | [Persistence and time](persistence-and-time.md)             |
| Settings, input, themes, web UI, visual slices, native scope                                                          | [Web presentation and scope](web-presentation-and-scope.md) |

## Coverage vocabulary

Use exactly these states in new map entries:

- **Covered** — a named source-backed fixture and assertion exercise this branch.
- **Gap** — the branch is relevant but no mapped assertion covers it yet.
- **Sampled (qualified)** — the domain is non-exhaustive, but source boundaries,
  a fixed-seed generated sample, and no-divergence differential meet the rule
  above. This is not a gap by itself.
- **Sampled** — a non-formula state/platform/rendering domain is intentionally
  non-exhaustive; name the separate evidence still open. For a formula/RNG
  domain, use this label while qualification evidence is incomplete and name
  what is missing. Once relevant boundaries, a fixed-seed sample, and the
  pinned differential pass, use `Sampled (qualified)`; its finite sample size
  is not a blocker.
- **Out of web-v1 scope** — intentionally excluded from the web parity gate.

When the map changes, update the matching matrix row and project status. Do not
change `In progress` to `Certified` while any linked item says Gap, a relevant
formula/RNG boundary is missing, a differential fails, or an unresolved
non-formula state/platform/integration/visual domain remains.
