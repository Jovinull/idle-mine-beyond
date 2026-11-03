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
- Reserve `Gap` for an uncovered source path. If source branches are asserted
  but selected visual/state combinations remain unverified, label that as open
  evidence and keep the matrix row In progress; do not present an unbounded
  combination count as a missing code branch.
- **`Sampled` does not by itself block certification.** A non-exhaustive formula
  or RNG domain is **qualified** when source-backed tests cover its applicable
  boundaries: zero; supported domain limits; each piecewise-formula or
  generation-region transition; cap/sentinel values; and, for strict
  thresholds, the value below, at, and above the threshold. RNG branches also
  need tests on the relevant draw thresholds and outcomes. Qualification then
  requires a generated sample reproducible from a recorded fixed seed and a
  pinned differential with no divergence. Compare the full relevant output and
  RNG effects for pure functions/content generation, or the complete simulation
  state and RNG after every action for action differentials. Record the boundary
  assertions, seed, sample, and differential. Once these conditions pass, finite
  sample size is not a certification blocker and does not justify more probes:
  **for that sampled formula/RNG domain, a missing applicable boundary is the
  only coverage blocker**. A differential mismatch is a compatibility failure
  to fix, not a sample-size problem.
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

## Sampled-domain re-evaluation (2026-10-05)

A finite sample does not block a formula/RNG domain after its relevant source
boundaries, recorded fixed-seed sample, and pinned differential pass. This rule
qualifies only that sampled formula/RNG subdomain. Unmapped source paths and
separate state, platform, integration, UI, or visual evidence remain independent
gaps. A differential mismatch is a compatibility failure to fix, not a reason to
increase the sample.

**Reassessment outcome:** all 14 `Sampled (qualified)` entries in the three
maps that contain them have named source-boundary evidence, a recorded
fixed-seed sample, and a passing pinned differential. The fourth map,
web-presentation-and-scope, uses `Sampled` only for separate UI, input, and
platform state spaces; those are not formula/RNG samples and remain open where
the map says so. None of the 36 matrix areas is In progress solely because a
formula/RNG sample is finite. For each qualified formula/RNG domain, a missing
applicable source boundary is the only sampling-coverage blocker; a differential
mismatch is a compatibility failure. Separately mapped source branches and
required state, save, platform, integration, UI, or visual evidence can still
keep their matrix area In progress. Finite sample size alone changes no status
and does not justify further probes; certification still requires the complete
row review.

This re-evaluation was validated on 2026-10-04 with `pnpm test:parity` (35
files, 152 tests), `pnpm parity:traceability` (36 areas), `pnpm docs:check` (85
Markdown files), and Prettier. A subsequent full `pnpm test:e2e --workers=1`
run passed 149/150: the dark Planet Coin exact-price viewport had one differing
pixel at `(697, 152)` on the rounded card border, while card geometry and
computed styles matched the pinned page. A focused follow-up revised the capture
setup to seed each origin before first navigation and compare Remix/Beyond
sequentially on the same Page. It passed all six default focused cases,
including the exact-price viewport; the old one-pixel result did not reproduce.
The full `pnpm test:e2e --workers=1` suite then passed 150/150, including the
same screenshot cases. The comparison remains exact and unmasked.
No area remains In progress solely because its formula/RNG sample is finite;
other rows stay open for their separately recorded evidence gaps.

**Visual revalidation (2026-10-05):** a later repeated run reproduced an
intermittent one-pixel, one-channel mismatch at the dark Planet Coin exact-price
rounded card border, despite matching state, geometry, and computed styles. The
strict screenshot assertion remains open and the desktop UI row is not
certified. This is independent of the qualified formula/RNG sample review.

**Object drops certification re-evaluation (2026-10-05):** the 10 pinned hit scenarios cover non-breaking and breaking hits, drop absence, strict chance thresholds, the last-object Gem bonus, Planet Coin/Wisdom success and failure, resource maxima, and draw order; four additional frame/timer cases are also mapped. `mining-transitions.test.ts`, the fixed-seed full-state/RNG differential, the four live drop E2Es, and the Windows/Linux post-award screenshots pass. The null fallback in `getTotalWisdom()` is not player-reachable because both source callsites guard Wisdom-drop presence. Finite distribution sample size is qualified evidence under the rule above, not a remaining gap.

| Formula/RNG area reviewed                     | Re-evaluated evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Remaining matrix status reason                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Big-number math and serialization             | Source cases cover zero and signed zero; exponent-gap cutoff at 16/17/18; scalar multiplication limits at ±1e307; rounding and string cutoffs; and MAX/MIN sentinels. Sixteen operand pairs from recorded seed `487530534` match the pinned browser Decimal runtime, and JSON round-trip properties pass.                                                                                                                                                                                                                                                 | **Certified.** No remaining component-row gap.                                                                                                                                                                                                                                                                                                                                                                           |
| Random distributions and RNG                  | Every pinned seeded/direct RNG consumer and threshold/draw branch is mapped. Fixed seeds reproduce stream, craft, and drop outcomes; all 90,000 phase-differential checkpoints match full state/RNG.                                                                                                                                                                                                                                                                                                                                                      | **Certified.** No remaining row gap.                                                                                                                                                                                                                                                                                                                                                                                     |
| Upgrade prices/effects, caps, and resources   | Source boundaries cover zero, limits, caps/softcaps, piecewise transitions, purchase branches, and cross-upgrade effects. Fixed-seed differential traces compare complete state/RNG without divergence.                                                                                                                                                                                                                                                                                                                                                   | Formula/RNG samples qualify. Money, Gems, Planet Coins, and aggregate upgrade rows remain In progress for individually mapped interaction and visual evidence, not finite level/value counts.                                                                                                                                                                                                                            |
| Active/idle damage, resource rates, and drops | Source tests cover zero/reward, defense and hit-count limits, scan windows, chance thresholds, caps, and positive/zero outcomes; seeded source differentials match complete state/RNG.                                                                                                                                                                                                                                                                                                                                                                    | Formula/RNG samples qualify. Active/idle damage is Certified with real click and idle-frame E2E. Object drops and random outcomes is now Certified: source cases cover each reachable damage/drop/RNG branch, the fixed-seed differential reports no divergence, live drop clicks pass, and four Windows/Linux screenshot pairs match at zero pixels. Broader Mining screens and Canvas rendering remain separate areas. |
| Procedural mine objects                       | Region, anchor, modulo, color/drop, and scaling transitions have source cases. A recorded xorshift64* sample contributes 128 safe-integer IDs; all 920 captured records match the pinned browser oracle.                                                                                                                                                                                                                                                                                                                                                  | **Certified.** Source output covers all mapped branches; the browser loads all three generation regions and the first sparse high-ID probe through a Beyond save. Canvas output parity across all 920 captured records is Certified in Mine rendering.                                                                                                                                                                   |
| Powers, pickaxe crafting, and naming          | Powers compares all four `getPrestigeEffect` indices at zero and 999/1,000/1,001 around the floor transition, plus source-derived next-Power values below, equal to, and above the effect; the isolated current-Power row boundary at 999/1,000 with next Power fixed at 1, prestige limits, draw/stop/replacement/cost paths, all 13 quality transitions and random offsets, name boundaries, and clamps have source cases. Seeded examples and fixed-seed differentials match.                                                                          | Formula/RNG samples qualify. Wisdom and Powers remains In progress for later balances and visual states; crafting/naming remains In progress for its mapped interaction evidence.                                                                                                                                                                                                                                        |
| Story predicates                              | All 61 condition predicates have boundary assertions; objective outputs span captured mine levels and all 40 notations; fixed-seed route/state differentials match progression state/RNG.                                                                                                                                                                                                                                                                                                                                                                 | Predicate samples qualify. The Story row remains In progress for selected route, application-state, and visual evidence.                                                                                                                                                                                                                                                                                                 |
| Offline progression formulas                  | Source cases cover the strict 300-second threshold, just-over-threshold reward, default/upgraded caps, overflow, disabled/negative/zero-rate paths, and ordered effects. Sixteen xorshift32-seeded elapsed values (`0x4f46464c`) compare complete load results against pinned Remix with no divergence.                                                                                                                                                                                                                                                   | Elapsed-time formula sampling qualifies; one controlled Chromium freeze/resume interval is differentially covered. Actual OS background scheduling/throttling remains separate evidence; native background behavior is outside web-v1.                                                                                                                                                                                   |
| Number formatting and notations               | The 359-value corpus retains its recorded fixed-seed sample. Source boundaries cover all 16 ALL dispatch slots, all Shi/Greek/Flags/Elemental tables, Japanese/Omega/Tritetrated/Precise Prime branches, and the full Imperial 17-unit table, 50 unit-search sides, MAX_VOLUME/reduction thresholds, small-unit cutoffs, and near/remainder decomposition. The Settings E2E compares visible `$1e100` output for 38 deterministic notations; a dynamic pinned Remix/Beyond browser differential compares ALL/Zalgo currency and Gems text plus RNG draws. | **Certified.** Source branches, boundary tests, qualified fixed-seed sampling, and visible UI/RNG differentials all pass.                                                                                                                                                                                                                                                                                                |

**Formula/RNG rule re-review (2026-10-05):** I rechecked each qualified
formula/RNG sample against its mapped source boundaries, recorded seed, and
pinned differential. The finite samples qualify; no matrix area is In progress
only because a sample is finite. Big-number math, number formatting, procedural
mine objects, object drops, active/idle damage, and random distributions/RNG are
Certified. Money/Gem/Planet Coin and aggregate upgrade areas, Wisdom/Powers,
pickaxe crafting/naming, Story, and offline progression remain In progress for
their separately mapped purchase/action, state, UI/visual, or real OS-background
evidence—not for finite formula/RNG sample counts. Other sampled
domains such as arbitrary save inputs, storage/environment failures, and
unselected UI states remain independent coverage questions and are not waived
by this rule. No status change or additional random probing is justified by
sample size alone.

This re-review was validated on 2026-10-05 with `pnpm.cmd test:parity` (35
files, 154 tests), `pnpm.cmd parity:traceability` (36 matrix areas),
`pnpm.cmd docs:check` (85 Markdown files and source manifests), and Prettier on
this README.

The review certifies Active and idle damage after its mapped browser action/timer
integration tests pass, and Procedural mine objects after its source-derived
browser integration cases pass across all three generator regions. Planet Coin
and Wisdom drop awards pass source-seeded real-click browser tests, and their
four post-award resource screenshots match the pinned source at zero pixels in
both themes at 1440x900 on Windows and Linux. Object drops and random outcomes is
now Certified; its finite RNG sample is qualified and no mapped branch remains
uncovered. The two new partial-Mud Mining screenshots are Windows-only pending
external Linux capture; Linux keeps the captured 80 HP assertion. Broader
full-screen UI evidence is tracked in the Desktop UI area. Other aggregate rows
remain In progress wherever their maps retain a `Gap` or a required evidence
layer is open. No additional random probes are requested for a qualified
formula/RNG domain.

**Focused reassessment (2026-10-05):** 14 entries are marked
`Sampled (qualified)`: seven in simulation/content, six in progression, and one
in persistence/time. I checked each against every applicable zero and domain
limit, strict-threshold below/equal/above case, piecewise or generation-region
transition, cap/sentinel, and RNG draw-branch boundary, then checked its
recorded fixed-seed sample and no-divergence pinned differential. All 14 meet
the criterion. The outcomes by map are:

| Map entries re-evaluated                                                                                                                                         | Result under the sampling rule                                                                                                                    | Matrix disposition after review                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Procedural mine objects; Object drops and random outcomes; Mine rendering and compositing; Active and idle damage                                                | Applicable generation, damage, drop, rendering-path, threshold, and cap boundaries are covered; fixed-seed source comparisons pass.               | Procedural objects, drops, rendering, and active/idle damage are Certified.                                                            |
| Money and money upgrades; Gems and gem upgrades; Planet Coins and upgrades                                                                                       | Applicable zero, formula/region, affordability, chance/rate, and cap boundaries are covered; fixed-seed phase differentials match full state/RNG. | In Progress only for separately mapped purchase, interaction, and visual evidence; not for finite formula samples.                     |
| Wisdom and Powers; Upgrade costs, caps, and effects; Pickaxe crafting RNG; Pickaxe naming and replacement; Random distributions and RNG; Story and notifications | Applicable zero, strict comparison, level/cap, RNG draw, and predicate boundaries are covered; fixed-seed source differentials pass.              | Random distributions/RNG is Certified. The other five remain In Progress for separately mapped interaction, state, or visual evidence. |
| Offline progression and time                                                                                                                                     | Threshold, zero/negative rate, cap, and ordered-effect boundaries are covered; sixteen fixed-seed elapsed values match full pinned load results.  | In Progress for real browser/OS background scheduling evidence, not elapsed-time sample size.                                          |

The re-evaluation does not claim the non-formula state spaces in the web map
are qualified by this rule. Story/UI combinations, arbitrary save shapes,
browser storage failures, keyboard environments, and platform behavior keep
their own evidence requirements. No formula/RNG area remains open solely
because its sample is finite, and no sample expansion is warranted.

Validation after this re-evaluation (2026-10-05): `pnpm.cmd test:parity`
passed 35 files and 158 tests, including the pinned state/RNG differentials;
`pnpm.cmd parity:traceability` verified 36 matrix areas; `pnpm.cmd docs:check`
checked 85 Markdown files and source manifests; Prettier and `git diff --check`
passed.

### Domains that remain sampled for separate evidence reasons

Raw `Sampled` entries still describe non-formula domains: the complete app-state
space and action trajectories beyond the captured traces; arbitrary save bytes,
Unicode and historical save shapes; browser persistence failures and OS clock
suspension beyond the controlled Chromium case; physical keyboard/IME variants;
and unselected theme/viewport/UI states. Their named state, platform,
integration, or full-screen visual evidence remains open in the corresponding
map. The pinned object Canvas corpus is no
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

## Sampled-domain recheck (2026-11-03)

Reaffirmed the qualification rule while reviewing all 14 `Sampled (qualified)`
entries across the three trace maps that contain them. For a formula or random
draw, finite sample size does not block certification once source-backed tests
cover zero, supported limits, every piecewise or generation-region transition,
caps/sentinels, and both sides plus equality for strict thresholds; RNG tests
also cover the relevant draw thresholds and outcomes. The domain must then have
a reproducible fixed-seed sample and a passing pinned differential. For that
sampled subdomain, a missing applicable boundary is the only coverage blocker;
a differential mismatch is a compatibility defect to fix. Do not expand a
passing sample merely to increase its size.

The review found twelve qualified formula/RNG domains (procedural generation,
drops, damage, resource and upgrade formulas, Powers, crafting, naming,
distributions, and offline elapsed time), plus the qualified Story-predicate
domain. Their mapped boundaries, fixed-seed fixtures, and pinned differentials
pass. Mine rendering is the fourteenth qualified sample, tracked separately:
its evidence is the 920-record per-object pixel differential and the 48 Story
preview baselines, not a claim that rendering is a formula/RNG domain. No
matrix area is In Progress solely because one of these samples is finite.

The matrix statuses therefore remain unchanged in this review. Money/Gem/Planet
Coin and aggregate upgrade areas remain open for their separately mapped
purchase, interaction, and visual evidence; Wisdom/Powers, crafting/naming, and
Story remain open for their other state, interaction, and visual evidence;
offline progression remains open for real browser/OS background scheduling.
Save-shape, storage, keyboard, unselected UI, and platform samples are separate
evidence domains and are not qualified by this formula/RNG rule. No additional
random probes are warranted for the reviewed domains.

Validation on 2026-11-03: `pnpm test:parity` passed 35 files and 158 tests;
`pnpm test:reference` passed pinned corpus, Story, phase-differential, Canvas,
Mining, and priority-visual checks; `pnpm parity:traceability` verified 36
matrix areas; `pnpm docs:check` checked 85 Markdown files and source manifests;
Prettier and `git diff --check` passed.
