# Trace map — simulation and content

This document maps the pinned Remix simulation/content branches to the current
Beyond fixtures and assertions. Evidence names refer to
`tests/fixtures/parity/remix-reference-corpus.json` unless otherwise stated.
The maps identify branch-level coverage and keep independent UI, integration,
and rendering gaps visible. A `Sampled (qualified)` formula/RNG domain is not a
blocker once its relevant boundaries, fixed-seed sample, and pinned differential
pass under the rule in the [trace-map index](README.md).

## Big-number math and serialization

- **Remix source branches:** the pinned `breakinfinity.js` Decimal operations
  used by Remix; the audited paths include signed/zero arithmetic, exponent-gap
  cutoffs, scalar limits, rounding, string conversion, and JSON round-trips.
- **Covered:** source-output boundary cases, Decimal branch sentinels, JSON
  round-trip properties, and 16 generated operand pairs from fixed seed
  `487530534` match the pinned browser runtime.

### Decimal function and branch trace

| Pinned Remix function/path and branch                                                                                                         | Source evidence                                                                        | Beyond assertion                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `Scripts/breakinfinity.js:Decimal` zero, signed-zero, finite arithmetic, exponent-gap cutoff at 16/17/18, and scalar multiplication at ±1e307 | `decimalSemantics` and `decimalBranchSemantics` boundary inputs and outputs            | `tests/parity/decimal-compatibility.test.ts` compares exact Decimal snapshots and errors with the pinned outputs |
| `Scripts/breakinfinity.js:toString` rounding, exponent/string thresholds, and extreme MAX/MIN sentinels                                       | `decimalBranchSemantics` string and rounding cases                                     | `tests/parity/decimal-compatibility.test.ts` asserts source strings and arithmetic results                       |
| Decimal JSON encode/decode and normalized serialization                                                                                       | Captured JSON round-trip examples and 16 operand pairs generated with seed `487530534` | `tests/parity/decimal-compatibility.test.ts` checks round trips and deterministic operand results                |

## Fresh simulation-state initialization

- **Remix source branches:** `Scripts/Define/game.js` defines initial resources,
  the initial Mud object, pickaxe, upgrade groups, Powers, timers, Story state,
  and settings. Fresh creation must allocate independent mutable state.
- **Covered:** the pinned fresh-runtime snapshot and full fixed-object catalog
  define the tested defaults; separate instances are checked for independence.
- **Covered integration:** Remix has no separate new-game creation screen:
  `main.js:onCreate` selects the first object, calls `functions.loadGame()`,
  and starts the frame loop. With no stored save, its preconstructed defaults
  remain active. Beyond's clean browser launch follows the fresh session path;
  E2E checks initial resources, object, pickaxe, settings, first click, and
  Story navigation. The fresh Mining screen also matches Remix in both themes.
- **Status:** all initialization branches and evidence required by this row are
  covered; this row is Certified. Save-present, malformed-save, and broader
  application integration paths remain in their own matrix areas.

### Initialization function and branch trace

| Pinned Remix function/path and branch                                                                                                       | Source evidence                                                     | Beyond assertion                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Scripts/Define/game.js` default resources, selected object/high-water, initial pickaxe, all four upgrade groups, Powers, Story, and timers | `initialState` and `mineObjectCatalog`                              | `tests/parity/simulation-state.test.ts` compares each source-observed initial field and independent state instances                                                                                                                                                                       |
| `Scripts/Define/game.js` fresh object arrays and special-object registry                                                                    | `mineObjectCatalog` includes the captured fixed and special entries | `tests/parity/reference-corpus.test.ts` checks the pinned catalog metadata and entries                                                                                                                                                                                                    |
| `Scripts/main.js:onCreate` first-object construction, `functions.loadGame()` with no stored save, and first scheduled update                | `initialState`, `storySemantics`, and fresh Mining source captures  | `tests/parity/remix-web-game-session.test.ts` checks the fresh session; `tests/e2e/remix-app.spec.ts` launches with cleared storage and asserts source-derived UI values, click damage, and Story navigation; `tests/e2e/mining-visual.spec.ts` compares both fresh themes at zero pixels |

## Simulation action composition

- **Remix source branches:** `main.js:update` orders idle tick, periodic save,
  Story notification refresh, and scheduled update; active clicks flow through
  `clickMineObject` and `MineObject.damage`; purchases and crafting preserve
  their source event, resource, save, and RNG order.
- **Covered:** frame cases, purchase cases, craft cases, event ordering, RNG
  calls, and intermediate save snapshots are compared against captured runtime
  results. Long differential traces compare complete simulation state and RNG
  after every action. Browser E2E also wires Mining clicks, animation frames,
  upgrades, and stochastic crafting through the web session. A source-captured
  full-health Mud break now checks the saved snapshot before Story notification
  refresh in the running browser.
- **Status:** every mapped composed-action path has source-backed core and web
  integration assertions; this row is Certified. Broader screen states and
  unrelated save/recovery paths remain in their own matrix areas.

### Simulation action function and branch trace

| Pinned Remix function/path and branch                                                                                                                          | Source evidence                                                                    | Beyond assertion                                                                                                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Scripts/main.js:update` idle timer threshold, timer reset, save timer threshold, one-save-per-frame behavior, notification refresh, and next-frame scheduling | `simulationFrameSemantics` frame cases                                             | `tests/parity/simulation-action.test.ts` compares frame events, timers, complete state, and save snapshots; `tests/e2e/remix-app.spec.ts` compares the actual browser frame's full-health break/save/Story order     |
| `Scripts/Define/functions.js:clickMineObject` active-hit path followed by Mining Power gain                                                                    | `simulationFrameSemantics` active-click cases and captured action results          | `tests/parity/simulation-action.test.ts` compares damage, resources, Power, and RNG consumption; `tests/e2e/remix-app.spec.ts` dispatches a real Mining canvas click                                                 |
| `Scripts/mineobject.js:damage` break/no-break and ordered resource/drop effects                                                                                | `miningHitSemantics` and frame/purchase/craft snapshots                            | `tests/parity/mining-transitions.test.ts` and `tests/parity/simulation-action.test.ts` compare complete transitions; browser E2E checks visible break rewards and the persisted frame snapshot                       |
| `Scripts/upgrade.js:Upgrade.buy` purchase acceptance/rejection and `Scripts/Define/functions.js:craftPick` craft/result/save ordering                          | `purchaseSemantics`, `pickaxeCraftingSemantics`, and `pickaxeCraftingTransactions` | `tests/parity/simulation-action.test.ts` compares ordered events and every captured save snapshot; `tests/e2e/remix-app.spec.ts` exercises resource-specific purchases, modifier buys, and seeded single/bulk crafts |

The browser assertions above exercise the Beyond route's canvas, RAF, purchase,
and craft event wiring through `+page.svelte` and the session adapter. They are
integration evidence for the pinned source paths in the table, not additional
Remix source functions.

## Number formatting and notations

- **Remix source branches:** the formatting entry points, custom notation
  implementations, and community notation implementations in the pinned
  `customnotations.js` and `adcommunitynotations.js` sources. The corpus has 40
  registered formatter outputs, 359 direct/boundary values, and a 32-value
  generated sample with seed `0x494d4231`.
- **Covered branches:** shared `formatExponent` thresholds; ALL dispatch slots;
  Shi table characters; Chinese exponent bands; Zalgo fixed-seed draw behavior;
  Haha Funny zero/reciprocal/loop paths; Evil strict-distance and even/odd
  power paths; Nice sign/log/sentinel paths; Coronavirus modulo replacements;
  all 49 Greek symbols and base-49 transitions; the Japanese suffix table,
  residual suffix, and exponent-72 branches; Omega and Omega Short amount/order
  transitions and safe-integer fallback; Tritetrated inverse-tetration search
  bounds/comparison and convergence; Flags' complete ordered emoji table,
  nonpositive/first/last direct lookup, zero-remainder decrement, base and
  multi-digit carry transitions; Elemental's complete 118-symbol table, part
  assembly cases, zero/under-1000/formatDecimal paths, and four-part cap; AD
  Imperial's complete volume table, unit search transitions, small-unit and
  near-volume cutoffs, remainder decomposition, and adjective scaling; plus the
  mapped standard, scientific/engineering, mixed-log, Infinity, Dots, Brackets,
  Hex, Clock, Prime, Roman, Letters, Cancer, and custom-base boundaries.
- **Evidence gap:** notation class-specific source branches are mapped and
  source-tested. Formatter UI/visual evidence remains open; it is independent
  from the qualified formula/output sample and is the remaining notation-row
  gate.

### Formatter function and branch trace

| Pinned Remix function/path and branch                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Source evidence                                                                                                                                                                                                                                                                     | Beyond assertion                                                                                                                                                                                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Scripts/Define/functions.js:formatNumber` Standard/Scientific/Engineering whitelist, limit comparison, and under-1000 formatting                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `notationOutputs` plus direct boundary inputs                                                                                                                                                                                                                                       | `packages/formatting/src/index.test.ts` compares pinned outputs and both sides of the limit; `tests/e2e/foundation.spec.ts` checks browser formatting                                                                                                                                                          |
| `Scripts/adcommunitynotations.js:formatExponent` shared 99,999/100,000/100,001 and 999,999,999/1,000,000,000/1,000,000,001 thresholds; exponent and prefix transitions                                                                                                                                                                                                                                                                                                                                                                                                                                      | `notationSemantics` captured shared thresholds                                                                                                                                                                                                                                      | `packages/formatting/src/index.test.ts` checks each threshold for all registered formatters                                                                                                                                                                                                                    |
| `Scripts/customnotations.js` Standard abbreviation, SI groups, padding, prefix tables, and suffix fallback                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Corpus boundaries at group changes and terminal suffixes                                                                                                                                                                                                                            | `packages/formatting/src/index.test.ts` checks prefix replacements, padding, and fallback boundaries                                                                                                                                                                                                           |
| `Scripts/customnotations.js` Scientific/Engineering mantissa rollover and Mixed Log cutoffs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Rollover values 9.995/999.995 at precision 2; Mixed Log values at 1e5/1e9                                                                                                                                                                                                           | `packages/formatting/src/index.test.ts` asserts rounding and both sides of each cutoff                                                                                                                                                                                                                         |
| `Scripts/customnotations.js` Hex signed 32-bit conversion, finite early stop, and terminal tie rounding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Signed values and `32769.75524902344 -> FBA13A26`                                                                                                                                                                                                                                   | `packages/formatting/src/index.test.ts` compares pinned Hex output and stopping/carry branches                                                                                                                                                                                                                 |
| `Scripts/customnotations.js` Infinity threshold, Dots recursion/cutoff, and Brackets repeated-power loop                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Inputs around `1e308254/1e308255`, Dots cutoff `16,387,063.9980315`, and `6^6`/`6^36`                                                                                                                                                                                               | `packages/formatting/src/index.test.ts` checks source outputs at the thresholds and loop transitions                                                                                                                                                                                                           |
| `Scripts/customnotations.js` Binary/Hex custom-base sub-1000 path, exponent routing, padding, and carry                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Values around 1920 and 4095.5 plus under-1000 cases                                                                                                                                                                                                                                 | `packages/formatting/src/index.test.ts` compares custom-base branch outputs and rounding                                                                                                                                                                                                                       |
| `Scripts/customnotations.js` Clock base-12 digit/loop branches and Prime sieve/integer/log/factor branches                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Clock exponents 13/157/301/2029/22765; Prime 9973, 10006, nested `10006^10006`, and factors 8192/8193                                                                                                                                                                               | `packages/formatting/src/index.test.ts` compares every named transition and boundary                                                                                                                                                                                                                           |
| `Scripts/customnotations.js` Roman symbol/tenth/large-number recursion and Letters/Cancer base-26 carry transitions                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Roman symbol boundaries through 25 symbols and 4e6; letter values 25/26/27, 51/52/53, 702/703/704, 1377/1378/1379                                                                                                                                                                   | `packages/formatting/src/index.test.ts` checks each table and carry boundary                                                                                                                                                                                                                                   |
| `Scripts/customnotations.js` IdleMine suffix table/fallback and formatter entry dispatch                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Nine suffix transitions and fallback 108/109/110; all 16 `ALL` slots                                                                                                                                                                                                                | `packages/formatting/src/index.test.ts` checks source outputs and dispatch selection                                                                                                                                                                                                                           |
| `Scripts/adcommunitynotations.js:formatDecimal` Shi lookup table, Chinese exponent regions, Zalgo random transforms, Haha Funny loop, Evil strict/even/odd branches, and Nice sign/log/sentinel handling                                                                                                                                                                                                                                                                                                                                                                                                    | 33 Shi characters; Chinese 4/52 and region `floor(exp/48)=6`; seeded Zalgo draws; named Haha/Evil/Nice boundaries                                                                                                                                                                   | `packages/formatting/src/index.test.ts` compares captured outputs and exact RNG consumption; browser corpus comparison runs in `tests/e2e/foundation.spec.ts`                                                                                                                                                  |
| `Scripts/adcommunitynotations.js` Greek base-49 alphabet and Coronavirus modulo-5 replacement/infection helper                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | All 49 Greek symbols and base-49 transitions; ten captured Coronavirus helper inputs covering each emoji index                                                                                                                                                                      | `packages/formatting/src/index.test.ts` asserts symbol table, region transitions, modulo classes, preserved punctuation, and pinned helper results                                                                                                                                                             |
| `JapaneseNotation.formatDecimal`, `jpnNotation`, and `getSuffix` from `@antimatter-dimensions/notations@1.6.0`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `communityMethodOutputs.japaneseFormatter` captures 1000 and all 17 nonempty suffix indices, residual suffix absent/present, and exponents 71/72/73                                                                                                                                 | `packages/formatting/src/index.test.ts` asserts suffix-table entries and `<72`/`>=72`; `tests/e2e/foundation.spec.ts` compares all captured outputs in Chromium                                                                                                                                                |
| `OmegaNotation.formatDecimal` and `OmegaShortNotation.formatDecimal` from `@antimatter-dimensions/notations@1.6.0`: omega amounts 0/1/2/3/4/9/10, Omega order transitions at 3 and 6, and the step `Number.MAX_SAFE_INTEGER` fallback                                                                                                                                                                                                                                                                                                                                                                       | `communityMethodOutputs.omegaNotations` captures each threshold, both sides of orders 3/6, and safe-integer threshold inputs                                                                                                                                                        | `packages/formatting/src/index.test.ts` compares both formatters for every named input; `tests/e2e/foundation.spec.ts` compares the pinned outputs in Chromium                                                                                                                                                 |
| `TritetratedNotation.formatUnder1000`, `formatDecimal`, and `tritetrated`: binary search on `[0, 16]`, strict `Decimal.pow(mid, mid^mid) < value`, `1e-7` convergence, and four-decimal output                                                                                                                                                                                                                                                                                                                                                                                                              | `communityMethodOutputs.tritetratedNotation` captures zero, values around 1 and the input-16 root, and large inputs; the 359 direct formatter corpus adds its 32-value fixed-seed sample                                                                                            | `packages/formatting/src/index.test.ts` compares direct method outputs and the general formatter corpus; `tests/e2e/foundation.spec.ts` compares both captures in Chromium                                                                                                                                     |
| `FlagsNotation`, `CustomNotation.transcribe`, and `CustomNotation.formatDecimal`: ordered flag table, exponent normalization, direct lookup for `<= base`, repeated remainder loop for `> base`, zero-remainder decrement, and carry across multiple flag positions                                                                                                                                                                                                                                                                                                                                         | `communityMethodOutputs.flagsNotation` captures the complete ordered 258-entry table, 11 engineering-exponent boundaries, and 267 formatted values; JSON `null` preserves undefined array slots for nonpositive normalized exponents                                                | `packages/formatting/src/index.test.ts` compares the table, every named transcribe boundary, and formatting outputs; `tests/e2e/foundation.spec.ts` compares all captured values in Chromium                                                                                                                   |
| `ElementalNotation` from `@antimatter-dimensions/notations@1.6.0`: `infinite`, `formatUnder1000`, `formatDecimal`, `getAbbreviationAndValue`, `formatElementalPart`, and `elemental`; all eight ELEMENT_LISTS regions `[1, 8, 8, 18, 18, 32, 32, 1]`, one-versus-many part text, zero/one/multiple-part assembly, and four-part cap                                                                                                                                                                                                                                                                         | `communityMethodOutputs.elementalNotation` captures all 118 table entries at region midpoints, zero/under-1000 and region-boundary formatting inputs, one/two part text, one through four assembled parts, and Infinity                                                             | `packages/formatting/src/index.test.ts` compares all table lookups and outputs and asserts 118 distinct symbols; `tests/e2e/foundation.spec.ts` compares the full fixture in Chromium                                                                                                                          |
| `PrecisePrimeNotation` from `@antimatter-dimensions/notations@1.6.0`: `primify`, `primesFromInt`, `formatFromList`, `formatPowerTower`, `maybeParenthesize`, `formatUnder1000`, `formatDecimal`, and `infinite`; MAX_SAFE_INTEGER and exponent-tower transitions, trial-factor cap, residual factors, superscript/parenthesis rules                                                                                                                                                                                                                                                                         | `communityMethodOutputs.precisePrimeNotation` captures 18 factor inputs including 10000? and 10007?10009, factor-list/tower branches, MAX_SAFE_INTEGER ?1 and squared/cubed transitions, max finite Decimal, under-1000, and Infinity outputs                                       | `packages/formatting/src/index.test.ts` compares every captured source method/result, asserts the 10007?10009 composite remains residual under the 10000 trial cap, and verifies the third tower tier is beyond the finite Decimal limit; `tests/e2e/foundation.spec.ts` compares the full fixture in Chromium |
| `ImperialNotation` from canonical Remix dependency `@antimatter-dimensions/notations@1.6.0/dist/ad-notations.umd.js` (the pinned package jsDelivr entry); Beyond compares the corresponding ESM build. All 17 volume units and 19 adjectives; `formatUnder1000`, strict `MAX_VOLUME` and reduction-ratio loop, `convertToVolume`, three `formatMetric` regions, `checkSmallUnits` thresholds, `findVolumeUnit`, `checkAlmost`, remainder/third-unit selection and cap, plural/article helpers; the loop exception for third-unit index 1 is unreachable because its strict lower bound is always at least 1 | `adMethodOutputs.imperialNotation` captures the 17-unit source table, 50 binary-search transition cases, strict 9.5-minim / 50.5-minim boundaries, `MAX_VOLUME` and `REDUCE_RATIO` sides, each helper branch, and high-unit remainder inputs that exercise the `numThird > 9` break | `packages/formatting/src/index.test.ts` compares every method result, asserts the 11-candidate break and proves index 1 is unreachable from the loop lower bound; `tests/e2e/foundation.spec.ts` compares the complete capture in Chromium                                                                     |

## Fixed mine objects

- **Remix source branches:** `game.js` supplies the fixed mine-object catalog;
  `MineObject.create` materializes saved definitions and applies empty/single/
  multiple color fallback behavior.
- **Covered:** all fixed definitions in the pinned catalog are compared as
  source records; the bounded corpus is not a claim about procedural IDs.
- **Scope:** current app rendering and interactions for every fixed object are
  separate visual/integration evidence.

### Fixed-object function and branch trace

| Pinned Remix function/path and branch                                                                          | Source evidence                                                                              | Beyond assertion                                                                                        |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `Scripts/Define/game.js` fixed `mineObjects` definitions, including named content and base progression records | `mineObjectCatalog.fixed` source capture                                                     | `tests/parity/reference-corpus.test.ts` compares fixed catalog records against the pinned corpus        |
| `Scripts/mineobject.js:MineObject.create` reconstruction from saved fields                                     | Captured object snapshots preserve name, HP, defense, value, colors, skin, config, and drops | `tests/parity/mine-object-generation.test.ts` checks reconstructed fixed object outputs                 |
| `Scripts/mineobject.js:MineObject` empty-color, one-color, and multi-color normalization                       | Source constructors expose each color-count branch                                           | `tests/parity/mine-object-generation.test.ts` compares the normalized colors in source-captured records |

## Special mine objects

- **Remix source branches:** `game.js` registers named/special objects;
  `getMineObject` selects an exact special ID before fixed-array or generated
  lookup. Special anchors also affect the next procedural object's predecessor.
- **Covered:** each special record in the pinned catalog is retained and
  compared; exact-ID precedence and adjacent procedural lookups are tested.
- **Scope:** complete rendered coverage of special skins/states remains in the
  visual map.

### Special-object function and branch trace

| Pinned Remix function/path and branch                                                                  | Source evidence                                    | Beyond assertion                                                                                      |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `Scripts/Define/game.js` special-object registry and special IDs                                       | `mineObjectCatalog.special` source capture         | `tests/parity/reference-corpus.test.ts` compares registry ordering and exact definitions              |
| `Scripts/Define/functions.js:getMineObject` exact special-ID match before the fixed/generated fallback | Catalog cases at special IDs and neighboring IDs   | `tests/parity/mine-object-generation.test.ts` asserts exact special selection and neighboring results |
| `Scripts/Define/functions.js:generateMineObject` most recent special anchor used as predecessor        | Captured objects immediately after special anchors | `tests/parity/mine-object-generation.test.ts` compares generated fields after anchor changes          |

## Procedural mine objects

- **Remix source branches:** `generateMineObject` selects the previous special
  anchor; computes `d`/`d2`; chooses the `<115`, `<214`, or late-universe
  generation region; then generates names, drops, colors, and scaled HP/defense/
  value.
- **Sampled (qualified):** the region boundaries, special-anchor transitions,
  modulo drop branches, color/name generation paths, and scaling cutoffs have
  source cases. A recorded xorshift64* sample covers 128 safe-integer IDs; all
  920 captured object records match the pinned browser oracle. No further random
  probing is requested for this identity domain.
- **Covered integration:** `tests/e2e/procedural-mine-objects.spec.ts` restores
  source-backed objects at IDs 80, 150, 600, and 769 in the actual Beyond app.
  The cases cover all three generation regions and the first sparse ID above
  the dense corpus; they compare displayed ID/name, drop visibility/type, and
  successful nonempty Canvas rendering. They reuse existing pinned object
  captures and add no random samples.
- **Status:** the full source-output corpus, boundaries, seeded identity sample,
  pinned differential, and all three app integration branches pass. This row is
  Certified. Pixel-level skin/color combinations are tracked in Mine rendering.

### Procedural-object function and branch trace

| Pinned Remix function/path and branch                                                                                                                                              | Source evidence                                                              | Beyond assertion                                                                                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Scripts/Define/functions.js:generateMineObject` previous fixed/special anchor selection and `d`/`d2` piecewise growth                                                             | `mineObjectCatalog` boundary and anchor records                              | `tests/parity/mine-object-generation.test.ts` compares generated fields at anchor boundaries                                                                                               |
| `generateMineObject` early region `lastId < 115`: sinusoidal skin, generated name, suffix table, layer count                                                                       | Captures around the 114/115 boundary and skin/suffix outcomes                | `tests/parity/mine-object-generation.test.ts` checks the transition and complete object snapshots                                                                                          |
| `generateMineObject` middle region `lastId < 214`: inherited Planet Coin expected-drop scaling, skin 20–24, HD/HR and suffix choices                                               | Captures around 139/140 and 213/214 with/without inherited Planet Coin drops | `tests/parity/mine-object-generation.test.ts` checks drop presence/scaling, skin, name, and object values                                                                                  |
| `generateMineObject` late region: seeded name branch at 0.3, dictionary/name branch, drop chance, Wisdom at `id % 5 === 0`, otherwise Planet Coins with doubling at `id % 4 === 0` | Exact boundary IDs and source-captured generated fields; 128 fixed-seed IDs  | `tests/parity/mine-object-generation.test.ts` compares names, drops, and all Decimal fields; `tests/parity/reference-corpus.test.ts` checks all 920 captured records                       |
| `generateMineObject` color count, first-color threshold, generated color loop, defense divisor, worth growth, `d^1.15`, and sinusoidal multiplier                                  | Captures at each source cutoff and deterministic color/scale records         | `tests/parity/mine-object-generation.test.ts` compares full colors, skin, HP, defense, value, and drop fields                                                                              |
| `Scripts/Define/functions.js:getMineObject` fixed/special/generated dispatch                                                                                                       | Fixed, special, and generated ID fixtures                                    | `tests/parity/mine-object-generation.test.ts` asserts dispatch results; `tests/e2e/procedural-mine-objects.spec.ts` verifies generated IDs through save restore and the live Mining Canvas |

## Object drops and random outcomes

- **Remix source branches:** `MineObject.damage` breaks only at HP `<= 0`, pays
  money/high-water, advances the selected object, then rolls gem, Planet Coin,
  and Wisdom drops in source order using strict `<` comparisons. Last-damageable
  gem bonus and resource maxima are observable outcomes.
- **Sampled (qualified):** zero/break boundaries, chance threshold sides,
  drop-presence cases, last-object bonus, and fixed-seed drop outcomes are
  tested. Pinned differential routes compare complete state and RNG after each
  action without divergence.
- **Scope:** arbitrary runtime/host RNG distributions beyond the source-seeded
  contract are not a web parity claim.

### Drop function and branch trace

| Pinned Remix function/path and branch                                                                     | Source evidence                                                           | Beyond assertion                                                                                                                                              |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Scripts/mineobject.js:damage` subtract damage and return while HP remains positive; break at HP `<= 0`   | `miningHitSemantics` includes non-breaking and breaking inputs            | `tests/parity/mining-transitions.test.ts` compares full state and verifies no reward before break                                                             |
| `damage` money reward, highest-money update, high-water advancement, and current-object replacement order | Source-captured mining hit transitions                                    | `tests/parity/mining-transitions.test.ts` and `tests/parity/simulation-action.test.ts` compare each resulting field                                           |
| `damage` gem roll strict `< chance`, zero/positive chance and last-damageable-object multiplier           | Gem threshold cases and last-object formula scenarios                     | `tests/parity/mining-transitions.test.ts` asserts RNG calls, gem amount, and high-water; `tests/parity/mining-rates.test.ts` checks rates                     |
| `damage` optional Planet Coin and Wisdom drop presence, strict `< chance`, amount update, and maxima      | Captured objects with absent/present drops and deterministic chance cases | `tests/parity/mining-transitions.test.ts` checks each resource and RNG draw; `tests/parity/endgame-phase-differentials.test.ts` compares state/RNG per action |

## Mine rendering and compositing

- **Remix source branches:** `main.js:drawStone` composites the base sprite,
  transparent mask, multiply-color layer, destination-in silhouette mask, and
  source-over result. Skin, layer, and color combinations determine source
  assets and crop bounds.
- **Sampled:** Canvas output is non-exhaustive across all skin/color/asset
  combinations; fixed visual states and renderer fixtures remain the relevant
  evidence. Formula/RNG sampling qualification does not certify this domain.
- **Gap:** selected mine rendering comparisons and the full ID/skin/color visual
  matrix remain open.

### Rendering function and branch trace

| Pinned Remix function/path and branch                                       | Source evidence                                              | Beyond assertion                                                                                                                                              |
| --------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Scripts/main.js:drawStone` canvas compositing operations and sprite crop   | Pinned `drawStone` implementation and controlled mine states | `tests/e2e/mine-object-renderer.spec.ts` compares renderer output and compositing behavior                                                                    |
| `drawStone` multiply fill, destination-in mask, and source-over restoration | Source operations exercised with controlled colors/layers    | `tests/e2e/mine-object-renderer.spec.ts` checks layer and color rendering; `tests/parity/visual-baselines.test.ts` tracks captured visual baselines           |
| Skin/color/layer combinations outside selected captures                     | Not all catalog combinations have screenshot fixtures        | **Gap:** visual states remain in `tests/e2e/mining-visual.spec.ts` and `tests/parity/visual-baselines.test.ts`; no exhaustive visual certification is claimed |

## Active and idle damage

- **Remix source branches:** `getActiveDamage` and `getIdleDamage` use a default
  current object when no argument is supplied; compose pickaxe, upgrades,
  Mining Power, Wisdom effects, and defense; active damage also adds the idle
  DPS Planet Coin effect. Rates branch on zero damage, ceil hits-to-break,
  last-object gem bonus, and optional Planet Coin drops. Highest-damageable
  scanning checks a bounded window and returns `MAX_SAFE_INTEGER` if no failure
  occurs.
- **Sampled (qualified):** zero/positive damage, defense cutoffs, hit-count
  rounding, scan bounds, last-object behavior, and rate boundaries are covered;
  generated formula scenarios plus fixed-seed full-state/RNG differentials pass.
- **Covered integration:** `tests/e2e/remix-app.spec.ts` verifies a fresh Mining
  click in `connects the persistent game session to mining and the Story tab`
  (Mud HP 100 to 80) and a pinned 61,000 ms idle frame in
  `matches the pinned idle-break save and Story order in the browser frame` that breaks controlled
  full-health Mud. It compares visible HP, Money, Gems, Story notification, the
  pre-refresh persisted snapshot, and RNG draw count with the pinned capture.
- **Status:** source formula boundaries and seeded full-state/RNG differentials
  pass, and active-click/due-idle browser integration is covered. This row is
  Certified. Mine rendering and broader screen-state evidence remain in their
  separate matrix areas.

### Damage function and branch trace

| Pinned Remix function/path and branch                                                                                                                      | Source evidence                                                     | Beyond assertion                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `Scripts/Define/functions.js:getActiveDamage` default/explicit target, stacked active effects, defense subtraction clamp, and added idle DPS effect        | Formula scenarios include zero, positive, defense, and target cases | `tests/parity/mining-rates.test.ts` compares full rates and `tests/parity/mining-transitions.test.ts` checks hit outcomes       |
| `Scripts/Define/functions.js:getIdleDamage` default/explicit target, idle effects, and defense clamp                                                       | Captured factor and damage scenarios                                | `tests/parity/mining-rates.test.ts` checks source formulas; `tests/parity/mining-transitions.test.ts` checks damage application |
| `getIdleDPS`, `getMPC`, and `getMPS` zero-damage and ceil-hit calculations                                                                                 | Zero and positive rate cases, including fractional hits-to-break    | `tests/parity/mining-rates.test.ts` compares all displayed rate outputs                                                         |
| `getGPS` last-object multiplier; `getPCPS` absent/present Planet Coin drop path                                                                            | Last-object and optional-drop formula scenarios                     | `tests/parity/mining-rates.test.ts` compares gem/Planet Coin rates at relevant boundaries                                       |
| `getHighestDamageableMineObjectLevel` scan start/window, first failing defense, and `MAX_SAFE_INTEGER` fallback; `adjustHighestMineObject` clamp predicate | `miningHitSemantics` and formula scenarios at scan/cap transitions  | `tests/parity/mining-rates.test.ts` and `tests/parity/mining-transitions.test.ts` assert boundary levels and state updates      |

## Money and money upgrades

- **Remix source branches:** Money upgrade definitions in `game.js`; purchase
  resource dispatch, affordability, cap, rounding, effects, and display in
  `upgrade.js` and `Components/upgrade.js`; object break pays object value and
  updates highest money.
- **Sampled (qualified):** zero, price/effect boundaries, finite caps and
  softcaps, piecewise formula changes, rounded/exact affordability, and
  cross-upgrade scenarios are covered; fixed-seed phase differentials match
  complete state/RNG.
- **Gap:** complete in-game shop visual states remain tracked separately; the
  qualification does not waive those UI requirements.

### Money function and branch trace

| Pinned Remix function/path and branch                                                                                      | Source evidence                                                                                             | Beyond assertion                                                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `Scripts/Define/game.js` Money upgrade price/effect/cap definitions and cross-upgrade reads                                | `upgradeSemantics` contains all 29 definitions, 249 captured level samples, caps, and interaction scenarios | `tests/parity/upgrades.test.ts` compares formulas, caps, and cross-upgrade effects                                                        |
| `Scripts/upgrade.js:Upgrade.buy` Money resource path, affordability, rounded debit, cap, success/failure, and level update | `purchaseSemantics` Money cases                                                                             | `tests/parity/upgrades.test.ts` compares complete purchase results and `tests/parity/simulation-action.test.ts` checks action composition |
| `Scripts/upgrade.js:Upgrade.getPriceDisplay` and `getEffectDisplay` below-cap versus capped display                        | Source strings at ordinary, cap, and over-cap levels                                                        | `tests/parity/remix-upgrade-display.test.ts` compares exact Money display strings                                                         |
| `Scripts/Components/upgrade.js:buyUpgrade` single, Shift, and Control operation selection                                  | Captured modifier behavior and live shop actions                                                            | `tests/e2e/remix-app.spec.ts` checks one/ten/one-hundred purchase routing                                                                 |

## Gems and gem upgrades

- **Remix source branches:** Gem upgrade definitions and effects; Gem purchase
  dispatch and display overrides; gem chance/multiply impacts in mining and
  offline rates; successful gem drops update the resource.
- **Sampled (qualified):** zero, source formula transitions/caps, affordability,
  and chance/rate boundaries have source cases; the phase differential matches
  complete state/RNG.
- **Gap:** selected Gem shop visual states are not a full UI-state certification.

### Gem function and branch trace

| Pinned Remix function/path and branch                                                                     | Source evidence                                                       | Beyond assertion                                                                                                              |
| --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `Scripts/Define/game.js` Gem upgrade price/effect/cap definitions and Gem Waster interaction              | `upgradeSemantics` source samples and cross-upgrade cases             | `tests/parity/upgrades.test.ts` asserts all configured Gem formulas and interactions                                          |
| `Scripts/upgrade.js:Upgrade.buy` Gem resource selection, debit, affordability, cap, and success/failure   | `purchaseSemantics` Gem purchase cases                                | `tests/parity/upgrades.test.ts` compares resource/level snapshots; `tests/e2e/remix-app.spec.ts` exercises the Gem shop route |
| `Scripts/upgrade.js:GemUpgrade.getPriceDisplay` resource suffix and `getEffectDisplay` cap path           | Captured Gem group price/effect strings at ordinary and capped levels | `tests/parity/remix-upgrade-display.test.ts` compares exact Gem labels                                                        |
| `Scripts/mineobject.js:damage` gem-chance roll and `Scripts/Define/functions.js:getGPS` drop-rate effects | Drop thresholds and gem-rate scenarios                                | `tests/parity/mining-transitions.test.ts` checks realized drops; `tests/parity/mining-rates.test.ts` checks rates             |

## Planet Coins and upgrades

- **Remix source branches:** Planet Coin upgrade definitions/effects and resource
  purchase/display paths; procedural object drop generation; mine break rolls;
  Planet Coin rate and active-damage effects. The shop tab has its own high-water
  visibility gate.
- **Sampled (qualified):** zero, formula region/cap and purchase boundaries,
  drop-presence/chance, and fixed-seed phase differential cases pass. More
  random value probes are not required for these sampled domains.
- **Gap:** shop visibility/render combinations beyond the selected controlled
  visual states remain open in the web map.

### Planet Coin function and branch trace

| Pinned Remix function/path and branch                                                                                                                              | Source evidence                                                    | Beyond assertion                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Scripts/Define/game.js` Planet Coin price/effect/cap definitions and cross-upgrade reads                                                                          | `upgradeSemantics` source samples, caps, and interaction scenarios | `tests/parity/upgrades.test.ts` compares formulas and resource interactions                                                                                |
| `Scripts/upgrade.js:Upgrade.buy` Planet Coin resource selection, exact/rounded affordability, cap, debit, and result                                               | `purchaseSemantics` Planet Coin cases                              | `tests/parity/upgrades.test.ts` compares state; `tests/e2e/remix-app.spec.ts` checks live shop routing                                                     |
| `Scripts/upgrade.js:PCUpgrade.getPriceDisplay` and effect/level display overrides                                                                                  | Captured Planet Coin display strings across cap states             | `tests/parity/remix-upgrade-display.test.ts` compares exact labels                                                                                         |
| `Scripts/Define/functions.js:generateMineObject` Planet Coin inheritance/scaling and late-region drop selection; `Scripts/mineobject.js:damage` optional drop roll | Region and chance-boundary object fixtures                         | `tests/parity/mine-object-generation.test.ts` checks generated drop definitions and `tests/parity/mining-transitions.test.ts` checks realized balances/RNG |
| `Scripts/Define/functions.js:getPCPS` absent-drop zero path and present-drop rate path                                                                             | Captured rate cases with and without Planet Coin drops             | `tests/parity/mining-rates.test.ts` compares both outputs                                                                                                  |
| `index.html` Planet Coin tab high-water gate at object level 90                                                                                                    | Source predicate and save states at 89/90                          | `tests/e2e/remix-app.spec.ts` asserts hidden/visible tab boundary                                                                                          |
