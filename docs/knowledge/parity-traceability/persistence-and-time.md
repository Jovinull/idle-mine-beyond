# Trace map — persistence and time

## Save encoding and save shape

- **Remix source branches:** `functions.getSaveString` serializes the complete
  `game` object, URI/UTF-8 encodes it, applies the legacy escaping layer, and
  base64 encodes the result. `functions.loadGame(saveString, decode, nooffline)`
  has null-input, encoded/raw-input, decode-catch, JSON-parse, and application
  branches. Its decode catch alerts and continues into parsing.
- **Covered:** source codec round trips and malformed base64/URI/JSON cases in
  `tests/parity/save-codec.test.ts` and `tests/e2e/save-codec.spec.ts`; complete
  state shape and captured vectors in `tests/parity/legacy-save-export.test.ts`
  and `tests/fixtures/parity/remix-reference-corpus.json`.
- **Sampled:** inputs beyond the captured malformed encodings and the exact native
  browser `escape`/Unicode behavior domain remain open. Do not infer historical
  schema support from the current serializer.

### Save codec function and branch trace

| Pinned Remix function/path and branch                                                                                                                                           | Source evidence                                                                                                      | Beyond assertion                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Scripts/Define/functions.js:getSaveString`: JSON stringify → URI encode → legacy `escape` → Base64 encode, including Unicode round-trip                                        | `saveSemantics.codecVectors` ASCII and Unicode inputs                                                                | `tests/parity/save-codec.test.ts` compares exact encoded bytes and decoded JSON; `tests/e2e/save-codec.spec.ts` verifies the vectors in Chromium                                                 |
| `loadGame(saveString, decode, nooffline)`: explicit string versus localStorage default; absent save skips application; `decode` omitted/true decodes and false accepts raw JSON | `saveSemantics.codecVectors`, `saveApplicationSemantics`, and browser storage cases                                  | `tests/parity/save-codec.test.ts` exercises encoding/decoding; `tests/parity/legacy-save-application.test.ts` and `tests/e2e/remix-app.spec.ts` compare direct/imported and stored startup paths |
| `loadGame` decode catch and subsequent JSON parse: Base64/URI decode error alerts, malformed JSON throws, valid JSON applies                                                    | `saveSemantics.loadErrors` includes empty/invalid Base64, invalid URI, invalid JSON, and partial application failure | `tests/parity/save-codec.test.ts` and `tests/parity/legacy-save-application.test.ts` assert alert/error and partial effects                                                                      |

The above are the codec and input-selection branches in the pinned source.
Other arbitrary byte strings remain an input-domain gap, not an unlisted branch.

## Legacy save import and recovery

- **Remix source branches:** `functions.loadGame` conditionally applies
  `settings`, each of four upgrade groups, Power values/upgrades, pickaxe, and
  resource/progress fields in source order; absent groups preserve defaults,
  present partial groups use per-field fallback, and malformed values can throw
  after earlier assignments. It reconstructs the selected mine object, handles
  offline elapsed time only when `offlineSec > 300 && !nooffline`, and updates
  `lastActive`. `hardReset` repeats its confirmation up to three times.
- **Covered:** full current save, absent/empty groups, sixteen source-ordered
  partial-application failures and exact errors in
  `tests/parity/legacy-save-application.test.ts`; decode failure and
  `nooffline` behavior in `tests/parity/legacy-save-offline-application.test.ts`;
  recovery file/slot branches in
  `tests/parity/remix-beyond-recovery-file.test.ts`, session coverage in
  `tests/parity/remix-web-game-session.test.ts`, and recovery flows in
  `tests/e2e/remix-app.spec.ts`. The separate `hardReset` three-iteration
  confirmation loop has each cancellation index, full confirmation, state and
  storage outcomes in `tests/parity/remix-hard-reset.test.ts` and a browser
  assertion in `tests/e2e/remix-app.spec.ts`.
- **Sampled:** historical-format fixtures and malformed shapes outside the named
  sixteen cases are not covered.

### Legacy loader function and branch trace

| Pinned Remix function/path and branch                                                                                                                                                    | Source evidence                                                                                         | Beyond assertion                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Scripts/Define/functions.js:loadGame` scalar `loadVal`: absent field falls back to source default; present value is applied; current object is reconstructed from selected object level | complete current save plus `missingOptionalGroups` and `emptyPresentGroups`                             | `tests/parity/legacy-save-application.test.ts` compares full loaded state, fallback values, theme effect, and current object                                  |
| Loader settings group absent versus present; number formatter, theme, and boolean settings use field-level fallbacks in source order                                                     | missing/present settings and partial-field cases in `saveSemantics`                                     | `tests/parity/legacy-save-application.test.ts` compares settings/effects; `tests/e2e/remix-app.spec.ts` verifies rendered theme and controls                  |
| Money upgrade group present entries; Gem/PC/Powers-upgrade absent groups reset their levels; present empty groups preserve levels; Powers values and upgrades are independently optional | `missingOptionalGroups`, `emptyPresentGroups`, complete application, and named field-application errors | `tests/parity/legacy-save-application.test.ts` asserts each group case and all 16 ordered partial-application failure snapshots                               |
| Pickaxe group absent versus present, with per-field fallback for name, power, and quality                                                                                                | missing/present group records and partial-field save cases                                              | `tests/parity/legacy-save-application.test.ts` compares the resulting full pickaxe for defaults and captured values                                           |
| `loadGame` selected-object reconstruction, then source-order mutation before later malformed fields throw                                                                                | `fieldApplicationErrors` records each failure point, effects, and partial result                        | `tests/parity/legacy-save-application.test.ts` asserts exact error and the already-applied state/effects for all 16 failure cases                             |
| `hardReset`: each of three confirmation calls can cancel; only three confirmations clear storage, reload initial game with offline disabled, clear message log, and reset used Gems      | `hardResetSemantics.cancelled` for all three positions and confirmed before/after state                 | `tests/parity/remix-hard-reset.test.ts` compares each cancellation and confirmed result; `tests/e2e/remix-app.spec.ts` verifies the browser confirmation flow |

Historical save shapes beyond captured format cases remain a data-domain gap;
all mapped loader and reset control-flow paths have source-backed assertions.

## Save export and round-trip

- **Remix source branches:** `getSaveString` and `saveGame` use the source
  encoder and update `lastActive`; craft replacement may save after logging;
  `loadGame` does not restore transient tab selections or the message log.
- **Covered:** exact encoded strings and all legacy export fields from fresh,
  controlled, and four gameplay-generated Chapter 3–6 saves in
  `tests/parity/legacy-save-export.test.ts` and
  `tests/parity/long-running-save-roundtrip.test.ts`; Beyond v1 reload and
  session selections are asserted there; craft log/save order in
  `tests/parity/pickaxe-crafting.test.ts` and `tests/e2e/remix-app.spec.ts`.
- **Sampled:** the checked route endpoint set is four saves, not every valid Remix
  runtime state. Cross-browser save-byte behavior outside pinned Chromium is
  unverified.

### Export/persist function and branch trace

| Pinned Remix function/path and branch                                                                                                  | Source evidence                                                  | Beyond assertion                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Scripts/Define/functions.js:saveGame`: set `lastActive` from current clock, write encoded save under `IdleMine`, then append save log | `saveExportSemantics` and captured save application event order  | `tests/parity/legacy-save-export.test.ts` compares exact full save object/bytes; `tests/e2e/remix-app.spec.ts` checks the persisted browser save and UI action |
| `exportGame`: populate Settings export field without changing the serialized save fields                                               | `saveExportSemantics` fresh/controlled snapshots                 | `tests/parity/legacy-save-export.test.ts` compares exported fields and bytes; `tests/e2e/save-codec.spec.ts` exercises browser export/import controls          |
| Loading an exported save restores persisted fields but not transient selected tab or message log                                       | source export/load round-trip records and generated route saves  | `tests/parity/legacy-save-export.test.ts` compares round-trip projection and transient-state exclusions                                                        |
| Craft replacement invokes source save after the success log; dud/insufficient attempts do not persist                                  | `pickaxeCraftingTransactions` event order and per-save snapshots | `tests/parity/pickaxe-crafting.test.ts` compares events and intermediate persisted state; `tests/e2e/remix-app.spec.ts` checks the live craft path             |

The source save/export branches above are covered. Arbitrary valid runtime
states and non-Chromium browser byte behavior remain outside the finite fixture
domain.

## Beyond versioned save schema

- **Remix source:** none. This is Beyond-owned serialization and migration code,
  not legacy behavior.
- **Covered branches:** `parseRemixBeyondSave` validates version, schema, extra
  fields, Decimal values, and immutable repeated restores; tests are in
  `tests/parity/beyond-save.test.ts`.
- **Sampled:** future schema versions/migrations are not implemented and must not be
  claimed as covered by current v1 round trips.

### Beyond schema function and branch trace

| Beyond function/path and branch                                                                                                    | Fixture/evidence                                                   | Assertion                                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `parseRemixBeyondSave`: valid current schema parses and restores the whole state, including Decimal snapshots                      | complete v1 round-trip state in `tests/parity/beyond-save.test.ts` | `tests/parity/beyond-save.test.ts` compares every serialized/restored field and derived current object         |
| Parse failure: malformed JSON, unsupported version, unexpected schema fields, and invalid Decimal are rejected with a typed status | invalid-input cases in the same test                               | `tests/parity/beyond-save.test.ts` asserts rejection category and no partial restored state                    |
| Repeated restore from one parsed save returns independent mutable state                                                            | immutable repeated-restores case                                   | `tests/parity/beyond-save.test.ts` mutates one restore and checks the other and parsed source remain unchanged |

Future migration branches do not exist yet and remain outside current v1 schema
coverage.

## Beyond save storage and recovery

- **Remix source:** browser storage is accessed by Remix `saveGame` and load
  paths; Beyond adds a separate adapter/coordinator.
- **Covered branches:** primary/backup selection, invalid-primary recovery,
  backup replacement, scoped reset, recovery-file parsing, and acknowledgement
  before import are mapped to
  `tests/parity/remix-beyond-save-storage.test.ts`,
  `tests/parity/remix-beyond-recovery-file.test.ts`, session tests, and the
  Settings/recovery E2E cases.
- **Sampled:** browser-specific quota, tab-race, and process-termination behavior
  do not have source-backed assertions. Keep those as Beyond adapter risks, not
  Remix compatibility facts.

### Beyond web storage/recovery function and branch trace

| Beyond function/path and branch                                                                                                                                              | Fixture/evidence                                                       | Assertion                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Save coordinator writes previous valid primary to backup before primary; confirms only after the primary succeeds; backup or primary write failure preserves safe prior data | primary/backup snapshots and injected storage failures                 | `tests/parity/remix-beyond-save-storage.test.ts` asserts write order, failure result, retained slots, and absence of confirmation                                                                          |
| Load chooses valid primary, offers valid backup recovery for damaged primary, distinguishes empty/invalid slots, and protects unsupported future versions                    | primary, backup, empty, invalid, and future-version cases              | `tests/parity/remix-beyond-save-storage.test.ts` asserts selected source and no unintended writes                                                                                                          |
| Recovery file accepts direct save or bundle primary; uses backup only when primary is invalid; rejects malformed/legacy-only bundles and future primary                      | captured recovery-file cases                                           | `tests/parity/remix-beyond-recovery-file.test.ts` compares each decode/result branch and protected storage                                                                                                 |
| Import requires acknowledgement, preserves source save on rejection/write failure, and applies legacy offline effects before persistence when applicable                     | legacy-import, rejection, write-failure, and offline recovery fixtures | `tests/parity/remix-beyond-recovery-file.test.ts` and `tests/parity/remix-beyond-save-storage.test.ts` assert state, effects, and storage order; `tests/e2e/remix-app.spec.ts` covers Settings recovery UI |
| Browser adapter stores Beyond primary/backup in separate keys and exports each slot without mutation                                                                         | key separation and slot export cases                                   | `tests/parity/remix-beyond-save-storage.test.ts` compares exact keys and all returned slots                                                                                                                |

Browser quota exhaustion, cross-tab races, and process termination are
adapter-environment risks without deterministic source branches; they remain
explicitly open rather than inferred from the unit adapter.

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
- **Sampled (qualified):** sixteen elapsed values generated with xorshift32 seed
  `0x4f46464c` cover the open interval from the reward threshold through values
  above the seven-hour upgraded cap. The pinned `loadGame()` fixture records
  each complete result; `tests/parity/offline-progression.test.ts` compares
  resources, maxima, timestamp, clock reads, messages, and writes with no
  divergence. The elapsed-time magnitude domain is non-exhaustive but is not a
  certification blocker under the [trace-map rule](README.md).
- **Sampled:** browser suspension patterns and clock discontinuities are not
  exhaustively exercised. Native background/suspend behavior is outside
  web-v1 certification.

### Offline/time function and branch trace

| Pinned Remix function/path and branch                                                                                                                                                           | Source evidence                                                                           | Beyond assertion                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Scripts/Define/functions.js:loadGame`: `offlineSec <= 300` or `nooffline` skips reward/rate computation; `offlineSec > 300` enters the offline path                                            | exact threshold, disabled flag, and clock-read cases in offline/save application fixtures | `tests/parity/offline-progression.test.ts` and `tests/parity/legacy-save-offline-application.test.ts` assert strict boundary, no-rate-resolution branch, and disabled branch |
| Offline duration cap uses default six hours or `offlineTime` upgrade; Money is half-rate while Gems/PC use their respective upgraded rates and floor                                            | cap, upgrade, and source live-state cases in `offlineProgressionSemantics`                | `tests/parity/offline-progression.test.ts` compares each resource reward and `tests/e2e/offline-progression.spec.ts` checks reload behavior in Chromium                      |
| Positive Gem/PC rewards conditionally extend the welcome-back message; rewards update balances/high-water, log, timestamp, and save in source order                                             | zero/positive reward combinations and captured load event/clock sequence                  | `tests/parity/offline-progression.test.ts` and `tests/parity/legacy-save-offline-application.test.ts` compare messages, full effects, time reads, and persistence            |
| `Scripts/main.js:update`: idle timer equal/under threshold does not hit; over threshold performs one hit then zeroes timer; save timer is strict `> 60`, one save per frame, then Story refresh | named `simulationFrameSemantics` threshold, long-delta, and event-order cases             | `tests/parity/mining-transitions.test.ts` and `tests/parity/simulation-action.test.ts` compare timer state, hit count, save count, and effect order                          |
| Offline load updates `lastActive` only in applied-reward branch; absent `lastActive` uses source clock default; error/nooffline paths preserve source clock-read order                          | `dateNowReads`, fallback, and decode-error records                                        | `tests/parity/legacy-save-offline-application.test.ts` and `tests/parity/remix-web-game-session.test.ts` assert exact clock reads and persisted timestamp                    |

Elapsed magnitudes outside the sampled values remain non-exhaustive, qualified
formula coverage. Real browser suspension or clock discontinuities remain
time-domain/environment gaps. Native background lifecycle is out of web-v1
scope.
