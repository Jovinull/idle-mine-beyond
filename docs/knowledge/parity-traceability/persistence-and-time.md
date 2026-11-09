# Trace map — persistence and time

## Save encoding and save shape

- **Remix source branches:** `functions.getSaveString` serializes the complete
  `game` object, URI/UTF-8 encodes it, applies the legacy escaping layer, and
  base64 encodes the result. `functions.loadGame(saveString, decode, nooffline)`
  has null-input, encoded/raw-input, decode-catch, JSON-parse, and application
  branches. Its decode catch alerts and continues into parsing.
- **Covered:** source codec round trips and malformed Base64/URI/JSON cases in
  `tests/parity/save-codec.test.ts` and `tests/e2e/save-codec.spec.ts`; separate cross-browser tests compare valid codec outputs in Chromium, Firefox, and WebKit. Complete
  state shape and captured vectors in `tests/parity/legacy-save-export.test.ts`
  and `tests/fixtures/parity/remix-reference-corpus.json`. The Settings import
  E2E checks all eleven source-captured malformed/error cases against the exact
  Chromium alert and parse messages and verifies failed imports do not write.
  `tests/e2e/save-codec.spec.ts` also differentially checks generated
  percent-encoded byte sequences against Chromium's native decoder
  pipeline used by the pinned source.
- **Cross-browser malformed-import evidence (2026-11-08):**
  `tests/e2e/save-import-error-browser-compat.spec.ts` submits the ten captured
  Base64/URI/JSON codec failures through the live Settings import in Firefox
  and WebKit, captures the pinned `app.loadGame()` exception in the same engine,
  and compares visible alerts and parse errors while checking that storage is
  unchanged. The web adapter injects native `window.atob` into the otherwise
  pure codec to preserve each engine's native `InvalidCharacterError` text.
  The same test compares all twenty captured field-application TypeErrors in
  Firefox and WebKit against `app.loadGame()` running in the same engine, and
  checks that failed imports do not write storage. Its web-session error
  formatter preserves pinned `loadObj` expression identifiers changed by
  minification and recreates the browser-native assignment/`Object.keys` error
  form for branches whose Beyond implementation uses different source
  expressions. Chromium separately checks all twenty cases after a reload per
  case.
- **Boundary evidence (2026-10-04):** six canonical captures call the pinned
  live `functions.getSaveString()` and then `functions.loadGame()` using the
  full source-shaped fresh save. They cover the legacy `escape` safe set and
  encoded punctuation, the UTF-8 two-, three-, and four-byte lower/upper
  boundaries, JSON-escaped lone surrogates, and JSON control escapes. Eleven
  additional controlled inputs pass a single-URI-encoded wrapper (not emitted
  by `getSaveString()`) through the real source `loadGame()` decoder to exercise
  native `unescape()` branches: `%u0041` becomes `A`, `%U0041` remains literal,
  uppercase hex is accepted, `%AB` becomes U+00AB, and malformed `%u00G1`
  remains literal. Incomplete `%`, `%A`, and `%u003` tokens remain literal; `%ABF` decodes only `%AB`, `%u0041B` decodes only `%u0041`, and adjacent `%uD83D%uDE00` tokens produce the corresponding UTF-16 surrogate pair. All seventeen cases pin encoded/decoded hashes and UTF-16 code
  units; the controlled wrapper is an import-path probe, not a canonical export
  format. Synthetic codec vectors cover all three Base64 output padding
  classes. The UTF-8 byte-to-code-unit corruption on canonical import is
  observed legacy behavior and must be preserved.
- **Additional external-byte evidence (2026-11-08):** 65,795 controlled
  wrappers cover every one-byte and ordered two-byte sequence across the full
  byte range, plus three additional three-byte prefixes. Their encoded input is
  compared with the source's
  `atob` → `decodeURIComponent` → `unescape` → JSON parse expression in
  Chromium; Beyond matches status, decoded JSON where decoding succeeds, and
  exact decode/parse errors. These are manually constructed import probes, not
  canonical exports. Longer byte strings and historical save shapes remain
  open.
- **Additional three-byte UTF-8 boundary evidence (2026-11-08):**
  `tests/e2e/save-codec.spec.ts` wraps six valid scalar boundaries and three
  overlong/surrogate sequences in JSON string quotes, compares the complete
  Remix decoder result with Beyond in live Chromium, and asserts successful
  versus invalid-encoding classifications (9/9).
- **Open input domain:** external byte strings longer than these selected
  boundaries are not exhaustively enumerated. This is not a formula/RNG sample
  claim. Do not infer historical save-schema support from the current
  serializer.

### Save codec function and branch trace

| Pinned Remix function/path and branch                                                                                                                                           | Source evidence                                                                                                                                                                                                   | Beyond assertion                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Scripts/Define/functions.js:getSaveString`: JSON stringify → URI encode → legacy `escape` → Base64 encode, including Unicode round-trip                                        | `codecVectors` covers all Base64 output padding classes; six canonical `codecBoundaryVectors` call live `getSaveString`/`loadGame`, and eleven controlled vectors exercise native `unescape()` through `loadGame` | `tests/parity/save-codec.test.ts` compares source hashes and UTF-16 boundary results for both wrappers; `tests/e2e/save-codec.spec.ts` compares exact Chromium decoder behavior; `tests/e2e/save-codec-browser-compat.spec.ts` compares valid outputs in Chromium, Firefox, and WebKit                                                                                                                                 |
| `loadGame(saveString, decode, nooffline)`: explicit string versus localStorage default; absent save skips application; `decode` omitted/true decodes and false accepts raw JSON | `saveSemantics.codecVectors`, `saveApplicationSemantics`, and browser storage cases                                                                                                                               | `tests/parity/save-codec.test.ts` exercises encoding/decoding; `tests/parity/legacy-save-application.test.ts` and `tests/e2e/remix-app.spec.ts` compare direct/imported and stored startup paths                                                                                                                                                                                                                       |
| `loadGame` decode catch and subsequent JSON parse: Base64/URI decode error alerts, malformed JSON throws, valid JSON applies                                                    | `saveSemantics.loadErrors` records exact Chromium decode-error name/message, alert text, parse-error name/message, and partial application failure                                                                | `tests/parity/save-codec.test.ts`, `tests/e2e/save-codec.spec.ts`, `tests/e2e/save-import-error.spec.ts`, and `tests/e2e/save-import-error-browser-compat.spec.ts` compare native browser decoder messages, Settings alerts, parse errors, and no-write behavior in Chromium, Firefox, and WebKit; all twenty field-application TypeErrors match in Firefox and WebKit, and all failed imports leave storage unchanged |

The above are the codec and input-selection branches in the pinned source.
Other arbitrary byte strings remain an input-domain gap, not an unlisted branch.

## Legacy save import and recovery

- **Remix source branches:** `functions.loadGame` conditionally applies
  `settings`, each of four upgrade groups, Power values/upgrades, pickaxe, and
  resource/progress fields in source order. Defaults are field-specific:
  settings, Story, and raw progress fields use `loadVal`; resource and pickaxe
  Decimal expressions construct `Decimal` before `loadVal`, so missing values
  become Decimal zero in the pinned runtime instead of reaching the nominal
  alternate argument. An absent Money-upgrade, Powers, or pickaxe group retains
  live values, while absent Gem and Planet Coin upgrade groups reset levels;
  an absent Powers-upgrade group resets levels only when the Powers group is
  present. Malformed values can throw after earlier assignments. The loader
  reconstructs the selected mine object, handles offline elapsed time only when
  `offlineSec > 300 && !nooffline`, and updates `lastActive`. `hardReset`
  repeats its confirmation up to three times.
- **Covered:** full current save, absent/empty groups, twenty source-ordered
  partial-application failures and exact errors in
  `tests/parity/legacy-save-application.test.ts`; the fixed-value derivative of
  one public community save shape compares full source export/re-export hashes
  in `tests/parity/legacy-save-historical-shape.test.ts`; exact source-captured decode,
  alert, and parse messages plus no-write Settings behavior in
  `tests/e2e/save-import-error.spec.ts`; that Chromium suite also submits all
  twenty captured field-application failures, compares each visible error, and
  verifies every localStorage slot is unchanged before and after reload;
  `tests/e2e/save-import-error-browser-compat.spec.ts` additionally source-pairs
  the post-failure Settings export bytes for all twenty partial-application
  errors in Chromium, Firefox, and WebKit, without writing the partial state;
  decode failure and `nooffline` behavior
  in `tests/parity/legacy-save-offline-application.test.ts`;
  recovery file/slot branches in
  `tests/parity/remix-beyond-recovery-file.test.ts`, session coverage in
  `tests/parity/remix-web-game-session.test.ts`, and recovery flows in
  `tests/e2e/remix-app.spec.ts`. The separate `hardReset` three-iteration
  confirmation loop has each cancellation index, full confirmation, state and
  storage outcomes in `tests/parity/remix-hard-reset.test.ts`. The source-paired
  E2E compares all three cancellation positions, prompts, Settings state, and
  storage with pinned Remix in Chromium, Firefox, and WebKit. The fully
  confirmed path also compares the three prompts, cleared origin storage, and
  complete Settings export bytes/objects across all three browsers in
  `tests/e2e/remix-app.spec.ts`; the cross-browser gates are
  `test:e2e:hard-reset:browsers` and
  `test:e2e:hard-reset-confirmed:browsers`.
  A valid JSON save with the first index past Remix's formatter list is also
  source-paired in `tests/e2e/legacy-save-invalid-formatter.spec.ts`.
- **Sampled:** one community-shared export with an older-looking field shape
  now loads through the pinned final Remix loader and has a matching Beyond
  source-shaped export differential. The durable test uses a fixed-value,
  minimized derivative rather than retaining the player's save. Other
  historical formats and malformed inputs outside the named twenty
  field-application failures and out-of-range formatter-index case remain
  unverified data domains, not uncovered branches in the mapped loader path.

### Legacy loader function and branch trace

| Pinned Remix function/path and branch                                                                                                                                                                                                                                                                                                              | Source evidence                                                                                                                                                                                                | Beyond assertion                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Scripts/Define/functions.js:loadGame` raw-field `loadVal`: undefined settings/Story/progress fields use their source alternatives; resource and pickaxe Decimal arguments are constructed first, so omitted values become Decimal zero; current object is reconstructed from selected object level                                                | Complete application, `missingOptionalGroups`, and `emptyPresentGroups`; the minimal `{"story":{}}` input loads seven zero resource values, while a present empty pickaxe resets name/power/quality to Toy/0/0 | `tests/parity/legacy-save-application.test.ts` compares all resource defaults, raw-field fallbacks, the empty pickaxe result, theme effect, and current object; `tests/e2e/legacy-save-optional-groups.spec.ts` imports both captures through Settings in seeded live sessions and compares complete source/Beyond exports             |
| `loadGame`: absent `story` container dereferences `story.page` after resources and selected mine object have already been applied; this differs from a present `story: null` container                                                                                                                                                             | `missing-story-after-resources` records exact TypeError and source partial state                                                                                                                               | `tests/parity/legacy-save-application.test.ts` compares the exact error and partial resources, mine object, Story sentinels, settings, upgrades, Powers, and pickaxe; `tests/e2e/save-import-error-browser-compat.spec.ts` compares the visible error with pinned Remix in Firefox and WebKit                                          |
| Loader settings group absent versus present; number formatter, theme, and boolean settings use field-level fallbacks in source order                                                                                                                                                                                                               | missing/present settings and partial-field cases in `saveSemantics`                                                                                                                                            | `tests/parity/legacy-save-application.test.ts` compares settings/effects; `tests/e2e/remix-app.spec.ts` verifies rendered theme and controls                                                                                                                                                                                           |
| `Scripts/Define/functions.js:loadGame` assigns `game.numberFormatters[numberFormatterIndex]` without range validation; the first out-of-range index leaves the formatter undefined and numeric rendering throws `TypeError`                                                                                                                        | Full save with index equal to the captured formatter count; pinned runtime reports the exact `.name` error                                                                                                     | `tests/e2e/legacy-save-invalid-formatter.spec.ts` imports the same save in Remix and Beyond and compares the render failure                                                                                                                                                                                                            |
| Money upgrade group absent retains live levels; present entries assign `.level`; absent Gem/PC groups reset levels; present empty Gem/PC groups preserve them; absent Powers group retains values/upgrades, while missing `powers.upgrades` inside a present group resets Wisdom upgrades; values after five known indices extend the source array | `missingOptionalGroups`, `emptyPresentGroups`, complete application, and `unknown-power-upgrade-key-after-extra-values` after seven ordered values                                                             | `tests/parity/legacy-save-application.test.ts` asserts each group case, all 20 ordered partial-application snapshots, and both extra Power values; `tests/e2e/legacy-save-optional-groups.spec.ts` compares live UI imports against Remix for both absent and present-empty group states                                               |
| Pickaxe group absent retains live tool; present group defaults a missing name through `loadVal`, while `pow` and `quality` are constructed as Decimal first and become zero when missing                                                                                                                                                           | `missingOptionalGroups` and `emptyPresentGroups`                                                                                                                                                               | `tests/parity/legacy-save-application.test.ts` compares the retained tool and present-empty Toy/0/0 result                                                                                                                                                                                                                             |
| `loadGame` selected-object reconstruction, then source-order mutation before later malformed fields throw                                                                                                                                                                                                                                          | `fieldApplicationErrors` records each failure point, effects, and partial result                                                                                                                               | `tests/parity/legacy-save-application.test.ts` asserts exact error and partial state/effects for all 20 cases; `tests/e2e/save-import-error.spec.ts` asserts all 20 Chromium messages and no-write behavior; `tests/e2e/save-import-error-browser-compat.spec.ts` compares all 20 messages and no-write behavior in Firefox and WebKit |
| `hardReset`: each of three confirmation calls can cancel; only three confirmations clear storage, reload initial game with offline disabled, clear message log, and reset used Gems                                                                                                                                                                | `hardResetSemantics.cancelled` for all three positions and confirmed before/after state                                                                                                                        | `tests/parity/remix-hard-reset.test.ts` compares each cancellation and confirmed result; `tests/e2e/remix-app.spec.ts` verifies the browser confirmation flow                                                                                                                                                                          |

**Per-loop unknown-key branches:** `loadGame()` assigns each incoming upgrade
entry through one of four distinct target maps: `game.upgrades[k].level`,
`game.gemUpgrades[k].level`, `game.planetCoinUpgrades[k].level`, and
`game.powers.upgrades[k].level`. The corpus cases
`unknown-upgrade-key`, `unknown-gem-upgrade-key`,
`unknown-planet-coin-upgrade-key`, and
`unknown-power-upgrade-key-after-extra-values` capture these separate failure
points, including the valid earlier group or Power mutations. That Power case
also captures the source array extending beyond its five named values before
the unknown-upgrade error. The pinned TypeError and complete partial state,
including both extra values, are asserted in
`tests/parity/legacy-save-application.test.ts` and
`tests/parity/save-format.test.ts`.

The reference probe fixes `initialGame.lastActive` to its injected clock while
capturing reset semantics so the confirmed reset result is reproducible across
capture dates.

The Google Drive community candidate listed in
[`save-time-offline.md`](../save-time-offline.md) was retrieved and loaded by
the pinned final Remix implementation. Its source-read fields produced an
exact Beyond export match in a one-off local differential; the checked-in
synthetic derivative hash-checks that minimized field shape against the pinned
output. This does not establish which deployed version produced the save or
general historical-schema support. The Pastebin candidate remains unavailable.
Other historical shapes and arbitrary malformed input remain separate data
domains; all mapped loader, formatter-index boundary, and reset control-flow
paths have source-backed assertions.

## Save export and round-trip

- **Remix source branches:** `getSaveString` and `saveGame` use the source
  encoder and update `lastActive`; craft replacement may save after logging;
  `loadGame` does not apply the serialized primary tab, upgrade group, or
  message log. A current runtime keeps its live settings, while a fresh runtime
  starts from the game defaults.
- **Covered:** exact encoded strings and all legacy export fields from fresh,
  controlled, and four gameplay-generated Chapter 3–6 saves in
  `tests/parity/legacy-save-export.test.ts` and
  `tests/parity/long-running-save-roundtrip.test.ts`; Beyond v1 reload and
  session selections are asserted there; craft log/save order in
  `tests/parity/pickaxe-crafting.test.ts` and `tests/e2e/remix-app.spec.ts`;
  `tests/e2e/pickaxe-crafting-visual.spec.ts` also compares complete live
  Settings export bytes and decoded objects after the same successful craft in
  pinned Remix and Beyond.
  `tests/e2e/upgrade-persistence-window.spec.ts` confirms a successful upgrade
  purchase changes the live state without writing either save slot, and a
  reload before periodic autosave restores the prior level in pinned Remix and
  Beyond. `tests/e2e/upgrade-tab-state-differential.spec.ts` confirms that the
  live group survives leaving and returning to Mining, is included by export,
  and is not restored into a fresh runtime from the serialized field.
  `tests/e2e/legacy-save-optional-groups.spec.ts` also imports the captured
  varied-settings/all-upgrades save into pinned Remix and Beyond, then compares
  their complete exported objects and encoded bytes. This state includes
  distinct resources, all 29 upgrade levels, five Power values, Story fields,
  theme, notation, and both display preferences. The same browser differential
  also covers the absent-optional-groups and present-empty-groups saves in
  Firefox and WebKit via `test:e2e:legacy-import:browsers`.
  `tests/e2e/save-export-purchase-differential.spec.ts` also makes the captured
  Money, Gem, Planet Coin, and Wisdom upgrades in both live apps, plus Shift
  buy10 and Control buy100 Money purchases, plus Shift buy10 Gem and Planet
  Coin Gem Multiplication purchases, then compares each full Settings export
  object and encoded bytes.
  `tests/e2e/save-export-browser-compat.spec.ts` repeats the live Settings
  import/export differential in Firefox and WebKit against the same pinned
  source capture and compares the complete encoded bytes and decoded object.
  `tests/e2e/save-export-mining-drop-differential.spec.ts` breaks the pinned
  object 90 in both apps with the captured RNG sequence, then compares the
  complete Settings export after the Planet Coin drop in light and dark in
  Chromium, Firefox, and WebKit.
- **Sampled:** the route-end set is four saves, and the additional all-group
  state is one controlled fixture, not every valid Remix runtime state.
  Valid codec outputs match pinned Remix in Chromium, Firefox, and WebKit for five codec vectors, seventeen UTF-8/escape boundaries, and five Base64 variants. The varied all-group live export matches in all three browsers; four resource-family purchases and four captured bulk-purchase exports (Money buy10/buy100 plus Gem and Planet Coin buy10) match in Chromium, Firefox, and WebKit. Other levels, alignments, and runtime exports remain unverified.

### Export/persist function and branch trace

| Pinned Remix function/path and branch                                                                                                                                      | Source evidence                                                                                                                                                                                          | Beyond assertion                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Scripts/Define/functions.js:saveGame`: set `lastActive` from current clock, write encoded save under `IdleMine`, then append save log                                     | `saveExportSemantics` and captured save application event order                                                                                                                                          | `tests/parity/legacy-save-export.test.ts` compares exact full save object/bytes; `tests/e2e/remix-app.spec.ts` checks the persisted browser save and UI action                                                                                                                                                                                                                                                                 |
| `exportGame`: populate Settings export field without changing the serialized save fields                                                                                   | `saveExportSemantics`, `varied-settings-and-all-upgrades`, `powersTableSemantics.prestiges`, four resource-family purchase cases, four bulk purchase cases, and `planet-coin-drop-roll-follows-gem-roll` | `tests/parity/legacy-save-export.test.ts` compares exported fields and bytes; `tests/e2e/legacy-save-optional-groups.spec.ts` compares the complete multi-group Chromium export; `tests/e2e/save-export-browser-compat.spec.ts` compares the complete Firefox and WebKit exports; purchase, post-mining-drop, and all four live Prestige exports compare exact encoded bytes and decoded objects with pinned Remix in Chromium |
| `loadGame` leaves live tab/group selection untouched; a fresh runtime uses default `upgradeTab: money` even if an exported save contains `gems`/`planetcoins`              | pinned loader omits `upgradeTab`; `game.js` initializes it to `money`                                                                                                                                    | `tests/e2e/upgrade-tab-state-differential.spec.ts` checks panel remount, exported group, and fresh-page reset against Remix                                                                                                                                                                                                                                                                                                    |
| Loading an exported save restores persisted fields but not transient selected tab or message log                                                                           | source export/load round-trip records and generated route saves                                                                                                                                          | `tests/parity/legacy-save-export.test.ts` compares round-trip projection and transient-state exclusions                                                                                                                                                                                                                                                                                                                        |
| Craft replacement invokes source save after the success log; dud/insufficient attempts do not persist                                                                      | `pickaxeCraftingTransactions` event order and per-save snapshots                                                                                                                                         | `tests/parity/pickaxe-crafting.test.ts` compares events and intermediate persisted state; `tests/e2e/remix-app.spec.ts` checks live Beyond persistence; `tests/e2e/pickaxe-crafting-visual.spec.ts` compares the successful source/Beyond craft's complete live Settings export bytes and decoded object                                                                                                                       |
| `Upgrade.buy` mutates the live balance/level without immediate `saveGame`; `Scripts/main.js:update` saves once and resets the timer only when accumulated `saveTimer > 60` | Pinned `Upgrade.buy` has no save call; `update` uses the strict greater-than-60 branch and calls `saveGame` before resetting the timer                                                                   | `tests/e2e/upgrade-persistence-window.spec.ts` compares pre-threshold reload loss and a 60,001 ms live-frame autosave against pinned Remix; the positive branch checks the complete legacy export bytes and saved Blacksmith level/balance in both apps                                                                                                                                                                        |

The source save/export branches above are covered. A live Planet Coin drop
export extends runtime evidence to one post-mining state in Chromium, Firefox,
and WebKit in both themes. Arbitrary valid runtime states and other post-mining
states remain outside the finite fixture domain.

**Nonzero aligned-purchase exports (2026-11-08):**
`tests/e2e/save-export-purchase-differential.spec.ts` also imports the pinned
`buy10-aligns-current-level` and `buy100-aligns-current-level` saves, performs
the exact-price Money purchases from levels 9 and 99, and compares complete
decoded Settings exports and encoded bytes against live Remix in Chromium,
Firefox, and WebKit. These extend the existing zero-level purchase exports to
two captured nonzero alignments; other runtime purchase states remain open.

### Current-object serialization branch trace

The pinned MineObject constructor assigns cfg as supplied and defaults
drops to an empty object when no drop configuration exists. getSaveString
applies JSON.stringify(game): undefined cfg is omitted, object 90 (Tiny
Asteroid) retains a numeric Planet Coin amount, and generated post-Universe
drop amounts use the Decimal JSON representation.

| Pinned Remix source path and observable branch                                                                                                                                                                                     | Source fixture                                                                          | Beyond assertion                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Scripts/mineobject.js:MineObject.constructor` with absent/present `cfg`; `Scripts/Define/game.js` object 90 numeric drop; `Scripts/Define/functions.js:getMineObject` generated Decimal drops; `getSaveString` JSON serialization | `saveExportSemantics.fresh`, `fixed-planet-coin-drop-90`, and generated object variants | `tests/parity/legacy-save-export.test.ts` compares complete current-object fields and full-save hashes; it explicitly asserts object 90 amount remains numeric `1` |

### Extended Power-value round-trip branch

The pinned `loadGame()` iterates through the entire saved
`powers.data.values` array. Indices beyond the five named Powers extend the
live source array. A later load with fewer values overwrites only its present
prefix; the source array keeps its trailing entries. Beyond preserves those
entries as `powerValueExtras` and appends them after the five named values
during legacy export. `saveSemantics.powerValueReloadSemantics` records a
seven-value load followed by a five-value load in the same runtime.

| Pinned Remix source path and branch                                                                                                               | Source fixture                                                                                     | Beyond assertion                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Scripts/Define/functions.js:loadGame` iterates to the input values length and assigns indices 5+; `getSaveString()` preserves the extended array | `saveExportSemantics.extra-power-values` captures seven values, including extra values `8` and `9` | `tests/parity/legacy-save-export.test.ts` imports and re-exports all seven values, checks both extra values and the complete save hash; `tests/parity/legacy-save-application.test.ts` also checks extended values before a later source error |

### Sequential Power-value reload branch

| Pinned Remix source path and branch                                                                                                 | Source fixture                                                                                                                                        | Beyond assertion                                                                                                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Scripts/Define/functions.js:loadGame` writes each incoming Power index but does not truncate values left by a previous longer save | `saveSemantics.powerValueReloadSemantics` captures a seven-value save followed by a five-value save in one runtime and records values after each load | `tests/parity/legacy-save-application.test.ts` applies both saves to the same Beyond state, compares the full named-plus-extra Power vector after each step, and confirms the first state remains unchanged |

## Beyond versioned save schema

- **Remix source:** none. This is Beyond-owned serialization and migration code,
  not legacy behavior.
- **Covered branches:** `parseRemixBeyondSave` validates version, schema, extra
  fields at every object level, every serialized node's required shape, Decimal
  values, nonnegative safe-integer mine levels with current level not exceeding
  high-water, number formatter indices in the pinned range `0..39`, and
  immutable repeated restores. The test also covers absent/present version
  fields and absent/present `lastActiveMs`, plus encoder rejection of
  non-finite numeric state and invalid level/formatter values; assertions are in
  `tests/parity/beyond-save.test.ts`.
- **Current v1 scope:** older Beyond versions do not exist yet, and no v2
  migration is claimed. A present unsupported version is rejected explicitly;
  migration behavior belongs to a future schema-version decision.

### Beyond schema function and branch trace

| Beyond function/path and branch                                                                                                                                           | Fixture/evidence                                                                                                  | Assertion                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `createRemixBeyondSave` and `restoreRemixBeyondSave`: preserve the timestamp when present and omit it when absent                                                         | Complete-state and fresh-state round trips in `tests/parity/beyond-save.test.ts`                                  | `tests/parity/beyond-save.test.ts` compares all fields and verifies the omitted timestamp remains undefined                   |
| `RemixBeyondSaveV1Schema.simulation`: selected and high-water mine IDs are nonnegative safe integers, and current level cannot exceed high-water                          | Zero/current-safe and `Number.MAX_SAFE_INTEGER` high-water; negative, fractional, unsafe, and inconsistent values | `tests/parity/beyond-save.test.ts` checks valid round trips, typed rejection, exact object restoration, and encoder rejection |
| `parseRemixBeyondSave`: valid current schema parses and restores every field, Decimal snapshot, and derived current object                                                | Complete v1 round-trip state in `tests/parity/beyond-save.test.ts`                                                | `tests/parity/beyond-save.test.ts` compares every serialized/restored field and derived current object                        |
| Parse failure: malformed JSON, missing/unsupported version, invalid values at every JSON node, and unknown keys at every strict object level                              | Systematically mutated complete v1 save in the same test                                                          | `tests/parity/beyond-save.test.ts` asserts each typed rejection; no partial state is returned                                 |
| `RemixBeyondSaveV1Schema.settings.numberFormatterIndex` accepts only integer indices `0..39`, matching the pinned 40-entry formatter list; encoder refuses invalid values | Complete-state round trip at index 39; rejects -1, 39.5, and 40 and a non-finite timer                            | `tests/parity/beyond-save.test.ts` checks the valid upper boundary, decode issue path, and encoder rejection                  |
| Repeated restore from one parsed save returns independent mutable state                                                                                                   | Immutable repeated-restores case                                                                                  | `tests/parity/beyond-save.test.ts` mutates one restore and checks the other and parsed source remain unchanged                |

Future migration branches do not exist yet and remain outside current v1 schema
coverage; the current version-rejection branch is covered.

## Beyond save storage and recovery

- **Remix source:** browser storage is accessed by Remix `saveGame` and load
  paths; Beyond adds a separate adapter/coordinator.
- **Covered branches:** primary/backup selection, invalid-primary recovery,
  backup replacement, scoped reset, recovery-file parsing, acknowledgement
  before import, surfaced write failures from both browser save slots, and
  surfaced primary/backup read failures are mapped to
  `tests/parity/remix-beyond-save-storage.test.ts`,
  `tests/parity/remix-beyond-recovery-file.test.ts`, session tests, and the
  Settings/recovery E2E cases. The browser write-failure test injects a
  `QuotaExceededError` through Chromium's `Storage.prototype.setItem` for the
  primary and backup keys; it verifies error UI, unchanged primary data, no save
  confirmation, and a successful retry. The read-failure test injects a
  `SecurityError` through `Storage.prototype.getItem` for each Beyond save key;
  initialization enters recovery without falling back to the legacy key or
  writing, and recovery export surfaces its own read error without mutation.
- A separate Chromium E2E fills origin storage until the browser itself throws
  `QuotaExceededError`, then exercises manual Save and asserts the actual
  exception reaches the UI with no confirmation or newly created save slots.
- The selected recovery-bundle UI E2E runs in Chromium, Firefox, and WebKit. It
  checks acknowledgement gating, valid-backup selection after invalid primary,
  persisted Beyond v1 state, and retention of the legacy key; Firefox and WebKit
  run through `test:e2e:recovery-file:browsers`.
- **Environment coverage still sampled:** the real quota E2E now establishes
  the localStorage exhaustion and backup-retention paths in Chromium, Firefox,
  and WebKit. This does not establish quota policy across every browser profile
  or origin configuration.
  The source-paired stale-tab tests below compare a fresh write, stale overwrite,
  fresh write again, then stale-tab actions/writes within and across resource
  families. Other cross-tab action/write interleavings, profile-specific quota policies, and process
  termination remain adapter-environment risks, not fully covered Remix
  compatibility facts.

### Beyond web storage/recovery function and branch trace

| Beyond function/path and branch                                                                                                                                                               | Fixture/evidence                                                                                                                                                                                                              | Assertion                                                                                                                                                                                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Save coordinator writes previous valid primary to backup before primary; confirms only after the primary succeeds; backup or primary write failure preserves safe prior data                  | primary/backup snapshots and injected storage failures                                                                                                                                                                        | `tests/parity/remix-beyond-save-storage.test.ts` asserts write order, failure result, retained slots, and absence of confirmation                                                                                                                                                                                |
| Browser `Storage.setItem` throws while writing backup or primary; failure is surfaced without a success log, prior primary remains intact, and a later retry writes both slots                | Firefox/WebKit adapter injection throws `QuotaExceededError` at each save key; Chromium retains the same focused cases                                                                                                        | `tests/e2e/browser-storage-failure.spec.ts` checks both failure points, attempted write order, prior-slot preservation, Settings alert, Mining confirmation log, and retry result in Chromium, Firefox, and WebKit                                                                                               |
| Browser origin reaches its actual localStorage quota during manual save; native `QuotaExceededError` is surfaced without success confirmation or a new save slot                              | Chromium, Firefox, and WebKit tests fill origin keys to each browser's native quota before invoking Save                                                                                                                      | `tests/e2e/browser-storage-real-quota.spec.ts` asserts the native quota error, primary write attempt, unchanged key count, absent primary/backup, and no `Game Saved!` log in all three engines                                                                                                                  |
| Browser `Storage.getItem` throws on primary or backup; startup enters recovery, does not fall back to the legacy slot or write, and recovery export reports its read failure without mutation | Firefox/WebKit adapter injection throws `SecurityError` at each Beyond read key; Chromium retains the same focused cases                                                                                                      | `tests/e2e/browser-storage-read-failure.spec.ts` checks both startup branches, complete slot preservation, exact read/write traces, recovery UI, and export error in Chromium, Firefox, and WebKit                                                                                                               |
| Load chooses valid primary, offers valid backup recovery for damaged primary, distinguishes empty/invalid slots, and protects unsupported future versions                                     | primary, backup, empty, invalid, and future-version cases                                                                                                                                                                     | `tests/parity/remix-beyond-save-storage.test.ts` asserts selected source and no unintended writes                                                                                                                                                                                                                |
| Recovery file accepts direct save or bundle primary; uses backup only when primary is invalid; rejects malformed/legacy-only bundles and future primary                                       | captured recovery-file cases                                                                                                                                                                                                  | `tests/parity/remix-beyond-recovery-file.test.ts` compares each decode/result branch and protected storage                                                                                                                                                                                                       |
| Import requires acknowledgement, preserves source save on rejection/write failure, and applies legacy offline effects before persistence when applicable                                      | legacy-import, rejection, write-failure, and offline recovery fixtures                                                                                                                                                        | `tests/parity/remix-beyond-recovery-file.test.ts` and `tests/parity/remix-beyond-save-storage.test.ts` assert state, effects, and storage order; `tests/e2e/remix-app.spec.ts` covers Settings recovery UI                                                                                                       |
| Browser adapter stores Beyond primary/backup in separate keys and exports each slot without mutation                                                                                          | key separation and slot export cases                                                                                                                                                                                          | `tests/parity/remix-beyond-save-storage.test.ts` compares exact keys and all returned slots                                                                                                                                                                                                                      |
| Same-origin tabs explicitly save snapshots in different orders; each write replaces the shared value without merging or reconciling the other tab                                             | Four pinned/implementation tabs load one controlled seed; the updated tab saves Blacksmith 1, the stale peer saves level 0, the updated tab saves 1 again, then the stale peer buys Active Power and saves its local snapshot | `tests/e2e/save-cross-tab-overwrite.spec.ts` compares Remix legacy output with Beyond v1 state in Chromium, Firefox, and WebKit after all four writes: Blacksmith 1, 0, 1, then 0; the final stale snapshot also has Active Power 1 and Money 0; the updated tab still displays Blacksmith 1                     |
| Stale same-upgrade and cross-resource actions save whole snapshots without merging newer resource families                                                                                    | Captured level-zero save; exact-price `buy-uses-gem-resource` fixture; two same-origin tabs per implementation; both Blacksmith/Money then Offline Gems/Gems and the reverse purchase/save order                              | `tests/e2e/save-cross-tab-overwrite.spec.ts` compares both live Remix and Beyond after same-upgrade stale writes and both cross-resource orders in Chromium, Firefox, and WebKit; asserts final resource/upgrade state, the stale tab's displayed state, and Beyond backup equals the immediately prior snapshot |
| A stale tab's periodic frame overwrites a newer same-origin save with its local whole-game snapshot after the strict autosave threshold                                                       | Pinned `Scripts/main.js:update` advances stale `timer.save` past 60 seconds and calls `functions.saveGame()`; two same-origin tabs begin from one captured save, then only the stale tab advances 60,001 ms                   | `tests/e2e/save-cross-tab-overwrite.spec.ts` compares Remix and Beyond in Chromium, Firefox, and WebKit: stale level-zero / 1,000 Money replaces the newer Blacksmith 1 / 970 Money snapshot; the stale tab's Beyond backup retains the newer snapshot and each tab keeps its own displayed level                |

The selected recovery-bundle E2E also covers the `Import requires acknowledgement` branch above in Chromium, Firefox, and WebKit: before acknowledgement the import button is disabled; afterward, an invalid primary selects the valid backup, which is persisted as Beyond v1 while the legacy key remains unchanged.

Other cross-tab action/write interleavings, profile-specific quota policies,
and process termination remain open environment domains; the multi-engine
quota cases do not characterize every profile or origin configuration.

**Cross-tab E2E validation (2026-11-07):**
`pnpm.cmd exec playwright test tests/e2e/save-cross-tab-overwrite.spec.ts
--workers=1 --retries=0` passed 1/1. Two same-origin pages per implementation
load one controlled save. The updated tab saves Blacksmith 1, the stale tab
overwrites it with level 0, then the updated tab writes level 1 again. Finally,
the stale tab buys Active Power from its old state and saves, leaving
Blacksmith 0 / Active Power 1 / Money 0. Remix legacy fields and Beyond v1 state
match after all four writes; the updated tab still displays Blacksmith 1. Beyond
keeps the imported `IdleMine` legacy key unchanged. After each stale, fresh, and
stale-action overwrite, the E2E also decodes the backup and asserts its observed
resource/upgrade projection equals the primary snapshot that existed
immediately before that write. This checks browser backup retention across the
three explicit stale-tab sequences; the four-write Active Power case and
cross-resource case both pass Firefox and WebKit. Other action/write
interleavings and browser storage races remain open.

**Cross-resource stale-tab interleaving (2026-11-08):** the same E2E suite uses
the captured exact-price `buy-uses-gem-resource` case to seed 4,444 Gems and
unlock the Gems shop. An updated tab buys Blacksmith with Money and saves; a
stale tab buys Offline Gems with Gems and saves its old whole-game snapshot.
Pinned Remix and Beyond both end at Money 1,000 / Gems 0 / Blacksmith 0 / Offline
Gems 1, and the Beyond backup equals the pre-overwrite snapshot containing
Blacksmith 1. The updated primary tab still displays its local Blacksmith 1.
All three focused cross-tab cases passed in Chromium; other cross-tab
interleavings remain open. The cross-resource case also passed alone in
Firefox and WebKit; `pnpm test:e2e:cross-tab:browsers` keeps this exact
source/Beyond comparison in the Firefox/WebKit CI gate. The four-write Active
Power case now also passes in both browsers with a 180-second test deadline;
the CI command runs it and both cross-resource orders in Firefox and WebKit.

**Reverse cross-resource stale-tab interleaving (2026-11-08):** the updated tab
buys Offline Gems with exactly 4,444 Gems and saves first; the stale tab then
buys Blacksmith with 1,000 Money and saves its whole snapshot. Remix and Beyond
finish at Money 970 / Gems 4,444 / Blacksmith 1 / Offline Gems 0. The Beyond
backup equals the preceding snapshot with Offline Gems 1, and the updated tab
continues to display its local Offline Gems 1. The focused source-paired test
passed in Chromium, Firefox, and WebKit; the cross-browser save gate includes
both resource orders. Other action/write interleavings remain open.

**Same-upgrade stale-tab interleaving (2026-11-08):** the same test file now
loads two tabs from the captured level-zero save, buys Blacksmith once in each
local game, then saves the updated tab followed by the stale tab. Both tabs
show level 1 / 970 Money after their purchase, while both source Remix and
Beyond retain only level 1 / 970 Money after the second write rather than
merging to level 2 / 940 Money. The Beyond backup decodes to the first write.
The focused Chromium case passed 1/1. Other stale-action and concurrent
storage interleavings remain open.

**Periodic stale-tab autosave interleaving (2026-11-08):** after the fresh tab
saves Blacksmith 1 / 970 Money, the stale tab crosses the strict autosave
threshold with a 60,001 ms frame and overwrites that shared snapshot with
Blacksmith 0 / 1,000 Money. Remix and Beyond match; the Beyond backup retains
the newer snapshot, and both tabs continue displaying their local state. The
focused case passed in Chromium, Firefox, and WebKit and is included in
`pnpm test:e2e:cross-tab:browsers`. Other same-origin actions and write orders
remain open.

**Browser E2E validation (2026-10-05):**
`pnpm.cmd exec playwright test tests/e2e/browser-storage-failure.spec.ts
tests/e2e/browser-storage-read-failure.spec.ts --project=chromium --workers=1
--retries=0` passed 4/4 in Chromium. The same four cases pass in Firefox and
WebKit (4/4 per engine), including unchanged slots, read/write order, recovery
UI, retry, and export error. These injected-error checks do not characterize
native browser quota behavior.

**Actual Chromium quota E2E (2026-11-07):**
`tests/e2e/browser-storage-real-quota.spec.ts` fills the origin's localStorage
until the browser throws its native `QuotaExceededError`, then invokes manual
Save. The focused Chromium test passed 1/1 and verified the real exception,
visible failure result, unchanged key count, absent primary/backup slots, and
no `Game Saved!` log. The same two cases pass in Firefox and WebKit (2/2 per
engine), covering each engine's native quota exception and backup-retention
path in addition to Chromium. Profile-specific quota policies and process
termination remain open.

**Real backup-retention quota follow-up (2026-11-07):** the same E2E now first
writes a valid primary, fills the remaining origin quota, and exercises the
native `QuotaExceededError` on `writeBackup(previous)`. It verifies the primary
is byte-identical after failure, backup remains absent, the key count does not
change, the Settings alert is shown, and no second confirmation log is added.
The complete focused Chromium file passes 2/2. The assertion maps the real
browser failure to the coordinator's existing backup-write failure branch; it
does not expand coverage to other browser quota policies.

## Native save adapter

- **Remix source:** no native storage adapter exists in Remix; its observable
  legacy contract is the serialized save string.
- **Covered foundation:** TypeScript command mapping in
  `tests/unit/remix-tauri-save-storage.test.ts`; Rust slot allowlist/read/write/
  reset tests in the native package.
- **Scope:** **Out of web-v1 scope.** Running WebView save/reload and native
  storage are deferred until native packaging. These unit tests do not certify
  a running Tauri WebView.

### Native adapter function and branch trace

| Beyond function/path and branch                                                                                    | Fixture/evidence                                       | Assertion                                                                                               |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Native slot adapter maps allowed save commands, rejects unsupported slots, and preserves read/write/reset behavior | Rust adapter and TypeScript command-mapping unit cases | `tests/unit/remix-tauri-save-storage.test.ts` and native package unit tests cover the adapter boundary  |
| Running Tauri WebView persistence/reload and native filesystem lifecycle                                           | No web-source equivalent; deferred platform evidence   | **Out of web-v1 scope.** No web parity claim is made; validate only in the later native packaging phase |

## Offline progression and time

- **Remix source branches:** `loadGame` computes `(Date.now() - lastActive)/1000`,
  applies offline behavior only for strict `offlineSec > 300` unless disabled,
  computes Money/Gem/PC rewards from live rates and caps, applies resources only
  for positive reward branches, emits ordered logs/saves, and sets `lastActive`
  to current time. Idle `main.js:update` adds the frame delta, performs at most
  one hit when timer is strictly greater than the interval, resets timer to 0,
  and saves when its timer is strictly greater than 60.
- **Covered:** exact threshold, cap/upgrade variants, reward presence/absence,
  source clock reads and event order in `tests/parity/offline-progression.test.ts`
  and `legacy-save-offline-application.test.ts`; update timing and save order in
  `tests/parity/mining-transitions.test.ts`; browser reload cases in
  `tests/e2e/offline-progression.spec.ts`. The new phase differential covers
  ten thousand randomized actions per fixed seed, including clocked idle frames
  and save timestamps.
- **Covered boundaries:** captured source cases exercise the strict 300-second
  threshold, just-over-threshold reward, default/upgraded caps and cap overflow,
  disabled and negative elapsed time, zero-rate rewards, and source clock/effect
  ordering.
- **Pinned browser evidence (2026-10-04):**
  `tests/e2e/offline-progression.spec.ts` cold-starts the pinned Remix and Beyond
  apps in Chromium from the same encoded legacy saves. Frozen-clock cases compare
  visible return-message text/color and complete legacy exports for a restore
  beyond the upgraded seven-hour cap and a 60-second backward wall-clock jump.
  The source save selects formatter index 3 (`Letters` in the pinned formatter
  registry), and the differential compares its formatted message and full save.
  The cap-state `.messagelog` crop matches exactly at 1440×900 in both themes.
  A separate startup case advances the controlled wall clock between the
  source-observed fallback, elapsed-time, `lastActive`, and save reads (301,
  302, and 303 seconds after the saved timestamp). It checks the mapped read
  prefixes, clamps later framework reads, and compares message order and full
  legacy exports. All three cold-start E2E cases match the pinned source. A
  fourth E2E freezes both pinned Remix and Beyond with Chromium's
  `Page.setWebLifecycleState`, advances the injected wall clock by 120 seconds,
  and resumes both pages. It asserts exactly one resumed auto-pickaxe hit, both
  timer resets, save confirmation and log order, the saved `lastActive`, and
  complete exported legacy equality; it passes 1/1. This exercises the live
  `saveTimer > 60` path after a long frame as well as the one-hit-per-frame rule.
  The selected four-scenario cold-start and separate advancing-startup-clock
  tests also run in Firefox and WebKit; these runs compare message text/color,
  clock-read prefixes, and complete decoded saved state, while the exact
  message-pixel assertion remains Chromium-only. The controlled clock case
  compares the source's persisted legacy snapshot with the complete
  legacy-shaped Beyond state restored from its primary; this case does not
  assert raw encoded-string equality. The captured level-90
  Asteroid fixture's Money output differs by one final decimal digit in WebKit,
  but source and Beyond exports match byte-for-byte there; this engine-specific
  captured-value distinction does not count as a Beyond/source divergence.
- **Sampled (qualified):** sixteen elapsed values generated with xorshift32 seed
  `0x4f46464c` cover the open interval from the reward threshold through values
  above the seven-hour upgraded cap. The pinned `loadGame()` fixture records
  each complete result; `tests/parity/offline-progression.test.ts` compares
  resources, maxima, timestamp, clock reads, messages, and writes with no
  divergence. The elapsed-time magnitude domain is non-exhaustive but is not a
  certification blocker under the [trace-map rule](README.md).
- **Open environment domain:** the controlled Chromium freeze/resume case
  covers one 120-second interval and its next main-loop frame. Actual OS
  background scheduling/throttling and lifecycle behavior across environments
  remain open; native background/suspend behavior is outside web-v1
  certification.

**Playwright visibility limitation (2026-11-03):**
`pnpm.cmd probe:browser-visibility` runs headless; the two pages have different
CDP window IDs. `node scripts/probe-browser-visibility.mjs --headed` puts both
pages in one window, but `bringToFront()` still leaves both `visible` and
focused on this Windows host with Chromium 153.0.8010.12. The additional
`node scripts/probe-browser-visibility.mjs --headed --minimize-window` mode
confirmed CDP's window state was `minimized` for 12 seconds, while the page
remained `visible` and focused, emitted no visibility-change event, and kept
running its 100 ms interval and animation frame callback. One run recorded 103
interval samples and 563 animation frames during minimization; callback gaps
reached 888.5 ms and 853 ms, respectively. This does not establish hidden-tab
behavior or production OS throttling. The existing CDP freeze/resume test covers
only `frozen`/`active` states
([current protocol](https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-setWebLifecycleState)).
Use a browser session that reports `document.visibilityState === "hidden"` and
measure its scheduling before closing this open web-v1 evidence domain.

**Headless target follow-up (2026-11-04):** Chromium 153.0.8010.12 was tested
with a same-context `window.open()` popup and a CDP `Target.createTarget`
created with `background: true`. Both produced separate CDP window IDs; the
pages remained `visible` and focused. This confirms that the current headless
launch path still cannot exercise a hidden tab; it does not add lifecycle
parity evidence.

**Selected-tab MCP probe (2026-11-07):** using the project Chrome DevTools MCP,
I instrumented page 1, opened page 3 as the selected foreground page, waited
three seconds, and queried page 1 by ID without selecting or activating it.
Page 1 still reported `visibilityState === "visible"`, `hidden === false`, and
`hasFocus() === true`; it recorded no `visibilitychange` event, 33 interval
ticks, and 203 animation frames. This is another automation-target result, not
evidence for an ordinary browser hidden tab or OS throttling. The current
official [Page protocol](https://chromedevtools.github.io/devtools-protocol/tot/Page/)
documents `Page.setWebLifecycleState`, while the [Emulation protocol](https://chromedevtools.github.io/devtools-protocol/tot/Emulation/)
does not document a command to set the document visibility state. Do not
override the page's JS visibility properties and count that as lifecycle
evidence. A real `visibilityState === "hidden"` observation remains required
to close this web-v1 environment domain.

**Playwright backgrounding follow-up (2026-11-07):** inspecting the project-
installed Playwright 1.63.0 launch bundle showed its default Chromium arguments
include `--disable-background-timer-throttling`,
`--disable-backgrounding-occluded-windows`, and
`--disable-renderer-backgrounding`. Earlier timer/animation measurements made
with those defaults do not establish ordinary browser scheduling. The probe
now accepts `--headed --normal-backgrounding`, which filters those three
Playwright defaults using the documented [`ignoreDefaultArgs` launch option](https://playwright.dev/docs/api/class-browsertype#browser-type-launch).
With that mode, switching to a second page in the same headed window still
left both pages `visible`: the background page reported `hasFocus() === false`
and the foreground page reported `hasFocus() === true`. Minimizing the headed
window for 12 seconds reported CDP state `minimized`; the page remained visible
but unfocused, with no visibility event. Its 100 ms interval recorded 121 ticks
and its animation-frame loop recorded 722 frames during that interval. The
probe also disables `Emulation.setFocusEmulationEnabled` so `hasFocus()` is not
forced by automation. The host/browser session still does not produce
`visibilityState === "hidden"`; it cannot close the real browser/OS
background-scheduling gap.

### Offline/time function and branch trace

| Pinned Remix function/path and branch                                                                                                                                                           | Source evidence                                                                           | Beyond assertion                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Scripts/Define/functions.js:loadGame`: `offlineSec <= 300` or `nooffline` skips reward/rate computation; `offlineSec > 300` enters the offline path                                            | exact threshold, disabled flag, and clock-read cases in offline/save application fixtures | `tests/parity/offline-progression.test.ts` and `tests/parity/legacy-save-offline-application.test.ts` assert strict boundary, no-rate-resolution branch, and disabled branch                                                                                                                                                                                                                                                                                                                                                               |
| Offline duration cap uses default six hours or `offlineTime` upgrade; Money is half-rate while Gems/PC use their respective upgraded rates and floor                                            | cap, upgrade, and source live-state cases in `offlineProgressionSemantics`                | `tests/parity/offline-progression.test.ts` compares each resource reward; `tests/e2e/offline-progression.spec.ts` source-pairs cold-start restore above the upgraded cap                                                                                                                                                                                                                                                                                                                                                                   |
| Positive Gem/PC rewards conditionally extend the welcome-back message; rewards update balances/high-water, log, timestamp, and save in source order                                             | zero/positive reward combinations and captured load event/clock sequence                  | `tests/parity/offline-progression.test.ts`, `tests/parity/legacy-save-offline-application.test.ts`, and `tests/e2e/offline-progression.spec.ts` compare the captured three-resource return message plus complete pinned Remix/Beyond exports for a controlled level-90 Asteroid cold start; the E2E also source-pairs a 3,601-second legacy save manually imported through Settings, comparing the welcome-back message, persisted resource snapshot, save/message order, and byte-identical full exports in Chromium, Firefox, and WebKit |
| `Scripts/main.js:update`: idle timer equal/under threshold does not hit; over threshold performs one hit then zeroes timer; save timer is strict `> 60`, one save per frame, then Story refresh | named `simulationFrameSemantics` threshold, long-delta, and event-order cases             | `tests/parity/mining-transitions.test.ts` and `tests/parity/simulation-action.test.ts` compare timer state, hit count, save count, and effect order; `tests/e2e/offline-progression.spec.ts` compares the source and Beyond after a controlled 120-second freeze/resume, including one hit, both timer resets, save confirmation, timestamp, and full exports                                                                                                                                                                              |
| Offline load updates `lastActive` only in applied-reward branch; absent `lastActive` uses source clock default; error/nooffline paths preserve source clock-read order                          | `dateNowReads`, fallback, and decode-error records                                        | `tests/parity/legacy-save-offline-application.test.ts` and `tests/parity/remix-web-game-session.test.ts` assert exact clock reads and persisted timestamp                                                                                                                                                                                                                                                                                                                                                                                  |

Elapsed magnitudes outside the sampled values remain non-exhaustive, qualified
formula coverage. The browser differentials cover capped positive elapsed time,
a negative elapsed boundary, an advancing inter-read startup clock, and a
controlled level-90 Asteroid save with simultaneous positive Money, Gem, and
Planet Coin rates.
Actual OS/browser background lifecycle remains a separate environment gap;
native background lifecycle is out of web-v1 scope.

### Historical-shaped save UI integration (2026-11-07)

tests/e2e/legacy-save-historical-shape.spec.ts imports the checked-in synthetic community shape through the live Settings text field. It asserts persisted Money, Gems, progress, and pickaxe data, plus zero defaults for absent Planet Coin/Wisdom resources. This supplements the pinned complete-output hash differential in tests/parity/legacy-save-historical-shape.test.ts. The single specimen does not establish support for other historical formats.

**Source-paired export differential (2026-11-07):** the same E2E routes the synthetic shape through the Settings import in pinned Remix and Beyond, then exports from both Settings panels and asserts exact encoded-string equality. This exercises the live legacy import-to-export path for the one specimen.
