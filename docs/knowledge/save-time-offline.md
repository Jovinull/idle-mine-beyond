# Saves, time, and offline progression

## Legacy save behavior observed in source

Scripts/Define/functions.js stores the save under localStorage key IdleMine. It serializes the game object as JSON, applies encodeURIComponent and escape, then Base64-encodes it. Import reverses Base64, decodeURIComponent, and unescape before JSON parsing. Base64 is encoding, not encryption.

The selected upgrade group is a session setting with a legacy persistence quirk: clicking a group updates live `settings.upgradeTab`, panel navigation retains it, and export includes it; the pinned `loadGame()` does not apply that field on cold start, which returns to the `game.js` default `money`. The source-paired E2E `tests/e2e/upgrade-tab-state-differential.spec.ts` verifies panel retention, exported values, and the cold-load reset. Preserve this asymmetry.

**Wisdom level-100 save/reload (2026-11-09):** the pinned source-paired
purchase case uses Control to buy Power Power (Active) 100 times from level 0,
then explicitly saves from Settings and reloads both applications. The
post-reload Settings exports are byte-identical; both retain level 100 and the
source Decimal Wisdom value. Chromium, Firefox, and WebKit pass. Other dynamic
save states remain open.

**Same-origin tab overwrite behavior (2026-11-08):** each Remix tab buys
Blacksmith from its own level-zero snapshot, reaching level 1 with 970 Money.
When both tabs save in sequence, `functions.saveGame()` serializes the local
`game` object and overwrites the shared `IdleMine` slot; it does not merge the
two purchases into level 2 / 940 Money. The new source-paired case in
`tests/e2e/save-cross-tab-overwrite.spec.ts` confirms the same last-writer
result and backup snapshot in Beyond. A second source-paired interleaving starts
with exact affordability for the level-zero Offline Gems purchase: one tab
saves Blacksmith level 1 first, then the stale tab buys Offline Gems and saves
its entire snapshot. The final save retains Money 1000, Gems 0, Blacksmith 0,
and Offline Gems 1, overwriting the newer Money purchase; Beyond's backup
retains that newer snapshot. This exact interleaving passes in Chromium,
Firefox, and WebKit. CI runs the Firefox/WebKit comparisons with
`pnpm test:e2e:cross-tab:browsers`; the four-write Active Power stale-save
sequence also passes in Firefox and WebKit with a 180-second test deadline,
after traces showed its UI actions completed just beyond the prior 90-second
limit. The reverse cross-resource order also passes in Chromium, Firefox, and
WebKit: the updated tab buys Offline Gems with 4,444 Gems and saves, then the
stale tab buys Blacksmith with 1,000 Money and overwrites that save. Final Remix
and Beyond state is Money 970 / Gems 4,444 / Blacksmith 1 / Offline Gems 0;
Beyond's backup retains the preceding Offline Gems snapshot, while the updated
tab still displays Offline Gems 1. Both cross-resource orders are included in
`pnpm test:e2e:cross-tab:browsers`. A third source-paired interleaving saves a
new Blacksmith purchase from one tab, then advances a stale tab's controlled
clock by 60,001 ms so its periodic frame overwrites the shared save with its
level-zero snapshot. Remix and Beyond end at Money 1,000 / Blacksmith 0; the
Beyond backup retains the newer Money 970 / Blacksmith 1 snapshot, and both
tabs retain their own displayed levels. The case passes in Chromium, Firefox,
and WebKit and is included in the cross-browser gate. Other cross-tab
action/write interleavings remain open.

**Stale Hard Reset clears a newer save (2026-11-09):** after one tab saves
Blacksmith 1 / 970 Money, a stale peer confirms Hard Reset three times. Pinned
Remix clears shared localStorage while the fresh tab keeps its in-memory
purchase. The fresh tab can explicitly Save again to restore that state; its
complete Settings export matches Beyond byte-for-byte. This source-paired case
passes in Chromium, Firefox, and WebKit and is included in
`pnpm test:e2e:cross-tab:browsers`. Other storage-clear interleavings remain
open.

**Fresh-tab periodic save after stale Hard Reset (2026-11-10):** after the
stale tab clears origin storage, the fresh tab retains its in-memory Blacksmith
1 / 970 Money purchase. Advancing only the fresh tab's controlled loop clock
by 60,001 ms lets `Scripts/main.js:update` pass its strict save threshold and
`functions.saveGame()` repopulate the shared storage from that retained state.
The source-paired E2E compares the resulting complete Settings exports. This
extends the explicit-Save recovery case and passes in Chromium, Firefox, and
WebKit. The fresh tab is brought to the foreground before its controlled frame
in WebKit so its animation loop processes the clock advance.

**Stale Shift Wisdom purchase interleaving (2026-11-09):** after a fresh tab
saves Blacksmith 1 / 970 Money, the stale tab holds Shift and buys Simple Gem
Boost from the captured 1e20 Wisdom balance. Pinned Remix `buyN(10, true)` buys
one level for 1e10 Wisdom and stops before aligned level 10; the remaining
Wisdom is 99999999990000000000. The stale tab's manual save overwrites the
newer Money purchase in both Remix and Beyond, and Beyond's backup retains the
fresh snapshot. Chromium, Firefox, and WebKit pass; this case is included in
`pnpm test:e2e:cross-tab:browsers`.

The same `buyN(10, true)` path is also captured for Power Power (Active): with
1,001 Wisdom, it buys two successive levels for 1 and 1,000, reaches level 2,
and stops before the next 1,000,000-Wisdom level. After the fresh Money save,
the stale manual save overwrites shared storage with level 2 / zero Wisdom;
Beyond keeps the newer purchase in backup. Complete exports match in
Chromium, Firefox, and WebKit in the same cross-browser gate.

**Stale craft no-save interleavings (2026-11-09):** after a fresh tab saves
Blacksmith 1 / 970 Money, the stale tab performs either the captured
equal-damage dud or the insufficient-Gem craft. Remix spends one Gem and
consumes ten random draws on the dud; the insufficient-Gem branch consumes
neither Gems nor RNG. Neither branch calls `saveGame()`. In both cases, the
shared legacy save and Beyond primary/backup stay byte-identical to the fresh
purchase, while live messages, Gem balances and pickaxe remain source-matched.
Both source-paired E2Es pass in Chromium, Firefox, and WebKit and are included
in the cross-tab browser gate. Other action/write interleavings remain open.

**Stale Shift bulk-craft interleaving (2026-11-09):** after fresh tabs save
Blacksmith 1 / 970 Money, the stale tab performs the captured two-replacement
Shift craft. Remix consumes six Gems and 20 random draws, saving after each
replacement. The shared legacy slot ends at Sturdy Mud Pick / 0 Gems. Beyond
matches that primary and retains the first Bad Mud Pick / 3 Gems replacement
in backup; the fresh tab keeps its local purchase. Chromium, Firefox, and
WebKit pass. Other bulk sequences and cross-tab orders remain open.

**Stale Settings-save interleaving (2026-11-09):** after a fresh tab saves
Blacksmith 1 / 970 Money, its stale peer selects Number Format index 3. That
selection updates the tab's local settings but leaves the shared save unchanged.
The stale tab's manual Save then replaces the whole shared snapshot with
Blacksmith 0 / 1,000 Money / formatter 3. Pinned Remix and Beyond agree, and
Beyond's backup keeps the newer purchase snapshot. The focused test passed in
Chromium; Firefox and WebKit are in `pnpm test:e2e:cross-tab-settings:browsers`.
Other cross-tab action/write interleavings remain open.

**Stale theme auto-save interleaving (2026-11-09):** pinned Remix's Light/Dark
buttons call `setTheme()` and immediately `saveGame()`. Beyond's theme handler
also saves its complete live state. After a fresh tab saves Blacksmith 1 / 970
Money, selecting Dark in the stale tab overwrites shared storage with its own
Blacksmith 0 / 1,000 Money state and dark theme. Remix and Beyond agree, and
Beyond's backup keeps the newer purchase snapshot. Chromium, Firefox, and
WebKit pass this source-paired case. Other action/write interleavings remain
open.

**Stale offline Settings import (2026-11-09):** after a fresh tab saves
Blacksmith 1 / 970 Money, its stale peer imports the pinned 3,601-second
offline save through Settings. Remix's `loadGame()` applies the saved fields,
offline rewards, welcome-back message, and `saveGame()` in source order; that
imported Blacksmith 0 snapshot replaces the newer purchase. Beyond produces
the same live messages and complete exported bytes, and its backup retains the
fresh Blacksmith purchase. The four-tab source-paired test passes in
Chromium, Firefox, and WebKit and is in `pnpm test:e2e:cross-tab:browsers`.
Other stale import shapes and cross-tab action/write interleavings remain
open.

**Stale Settings import at the offline threshold (2026-11-09):** when the
imported save's `lastActive` is exactly 300 seconds old, the pinned
`loadGame()` applies its fields but skips offline rewards and does not call
`saveGame()`. A stale same-origin tab therefore leaves the newer shared save
untouched; after reload, both it and the fresh tab show the newer Blacksmith
purchase. The source-paired four-tab E2E verifies live exports, primary and
backup storage, and the reload in Chromium, Firefox, and WebKit. Beyond's live
Settings importer now also leaves the stored primary and backup untouched when
the source load emits no save effect. Startup legacy migration and explicit
recovery continue to persist by default.

**Live Settings import just above the offline threshold (2026-11-09):** a
source-paired import with `lastActive` 300,001 ms before the controlled clock
enters Remix's strict `offlineSec > 300` branch. The source emits the
welcome-back and save messages, advances `lastActive`, and writes the imported
save; Beyond matches its full exported object and persisted resource state.
Chromium, Firefox, and WebKit pass. This covers the immediate millisecond
above the boundary; the source-captured 300.001-second formula case continues
to document the numeric transition.

**Live purchase export differential (2026-11-08):** the pinned purchase corpus now includes Shift `buy10` from level 0 to 10 for Gem and Planet Coin Gem Multiplication. `tests/e2e/save-export-purchase-differential.spec.ts` makes each purchase in both Remix and Beyond, then compares the complete exported object and encoded bytes. Both cases pass in Chromium, Firefox, and WebKit. The captured remaining balances are 33422.1074644512 Gems and 18152641816.016598 Planet Coins.

The pinned current save shape and a deliberately minimal partial-save load are captured in `saveSemantics` in the reference corpus. The current serialized object has 27 top-level fields and no version field; `serializableShape` recursively records JSON types, ordered object fields, array lengths, and distinct array-element shapes throughout that runtime object. Seven Decimal resource values serialize as strings, and JSON omits upgrade `getPrice`/`getEffect` functions. This describes the captured current runtime, not every historical save or every dynamic field value.

**Verified sequential-load quirk:** `loadGame()` assigns each saved Power value by index and does not truncate the live array. Loading seven values and then a five-value save in the same runtime updates the first five entries but preserves the two trailing values. `saveSemantics.powerValueReloadSemantics` captures both inputs and the complete values after each load; `tests/parity/legacy-save-application.test.ts` checks the Beyond state transition. Preserve this behavior during legacy imports.

The 2026-10-04 codec boundary capture exercises six canonical full-save `functions.getSaveString()`/`loadGame()` round trips. It covers the ASCII `escape` safe set and encoded punctuation, UTF-8 byte-length transitions at U+0080/U+07FF, U+0800/U+FFFF, and U+10000/U+10FFFF, JSON-escaped lone surrogates, and JSON control escapes. Eleven additional controlled, single-URI-encoded inputs pass through the real `loadGame()` import path to isolate native `unescape()` behavior: lowercase `%uXXXX` decodes, uppercase `%UXXXX` stays literal, uppercase hex digits work, `%XX` decodes, incomplete and malformed tokens stay literal, token widths consume exactly four or two hex digits, and adjacent `%u` surrogate tokens preserve their UTF-16 pair. Those wrappers are decoder probes, not formats produced by the canonical exporter. A further Chromium differential in `tests/e2e/save-codec.spec.ts` compares 65,795 manually wrapped byte cases�including every one-byte and ordered two-byte sequence across the full byte range, plus three longer prefixes�against Remix's `atob()` ? `decodeURIComponent()` ? `unescape()` ? JSON parse sequence. This broadens malformed external-input evidence; it does not establish historical schema support or exhaust arbitrary byte strings. The corpus hashes encoded input and decoded JSON, compares source/imported UTF-16 code units, and covers all three Base64 output-padding cases. Remix intentionally exposes UTF-8 bytes as separate code units on canonical import; preserve this corruption during compatibility work.

**External four-byte UTF-8 imports (2026-11-08):** eight quoted byte sequences now compare the pinned decoder expression in the browser with the Beyond codec in Chromium, Firefox, and WebKit. Three valid boundaries assert exact UTF-16 code units, including the minimum and maximum four-byte scalar; five malformed sequences assert engine-local error results. All 24 cases passed. This adds selected external-import boundaries and does not establish arbitrary byte-string or historical-schema support.

**Live canonical Unicode-name import (2026-11-09):** pinned Remix creates a canonical current save after its pickaxe name is set to `Pickaxe 🚀`; Remix and Beyond then import the same string through their live Settings forms. In all three browsers, both retain UTF-16 code units corresponding to the source's four UTF-8 bytes after import, and their next complete decoded Settings export and encoded bytes match exactly. The selected import demonstrates the two successive canonical codec passes; it does not establish general historical-save support.

The controlled clock equals `lastActive`, so Remix emits no offline-save effect
and neither app writes storage during this import. The E2E reads Beyond's live
pickaxe name from Mining before comparing the complete Settings exports.

The captured offline-import save is also imported after removing only its
`lastActive` property. With startup and import clocks fixed to the same value,
the pinned loader uses its eagerly evaluated clock fallback, computes zero
elapsed time, emits no welcome-back or save message, and leaves both apps'
storage snapshots unchanged. Chromium, Firefox, and WebKit compare the complete
Settings exports; both contain the fallback timestamp. This verifies the
captured omitted-timestamp branch only, not the prevalence or validity of any
historical save format.

`saveExportSemantics` records complete serialized objects for a clean fresh game and a controlled distinct loaded game, including source JSON and Base64-wrapper lengths and hashes. It also records compact full-save hashes and changing fields for procedural object IDs 72 (first generated after the base catalog, no drops), 125 (first generated after the Portal anchor, Planet Coin drop), 215 (Wisdom drop), 216 (Planet Coin drop), and 244 (later Universe scaling). Together these exercise all three generation branches and both post-Universe drop types. Additional captures cover a seven-message logging scenario that retains the source's newest six entries, a Settings/notational variant, one isolated variant for each of the four upgrade families, and a combined state with distinct resources, Story fields, dark theme, formatter index 39, toggles, all 29 upgrade levels, and five Power values. The source loader leaves selected tabs active, so the fixtures preserve `settings.tab` and `settings.upgradeTab` even when the imported save requests other tabs. `packages/content/src/remix-legacy-save-template.json` is generated from the pinned fresh-game object; the state-backed exporter overlays mutable fields while retaining the source template's static data and property order. Parity tests compare rebuilt full objects and encoded hashes with two complete source objects and all fifteen source variants, and the Settings E2E compares the fresh live export with source-compatible serialization. The pinned-Remix/Beyond E2E also imports the combined all-upgrade variant and compares every exported field and the exact encoded bytes. Separate natural Chapter 3–6 route captures now provide four full gameplay-generated Remix saves. A focused parity test imports each through the legacy loader, matches every rebuilt legacy-save field and the exact encoded source string, then verifies Beyond v1 encode/decode/restore. To recreate the same source session, the test carries forward the captured active tab/upgrade tab/export text and `usedGemsLevel`, plus the captured message log; Remix's loader does not restore those session selections itself. Additional historical-save variants and other procedural IDs still need evidence. Captures use the pinned browser runtime, fixed clock, pinned CDN snapshots, the Chromium version in corpus metadata, and `functions.getSaveString()`.

The thirteenth compact source variant is a **synthetic high-magnitude Decimal save**, not a claim that the corresponding state was reached by long-running play. It loads exponent-string values across all seven resources, five Powers, and pickaxe power/quality while the current object is at ID 244, then records normalized Decimal fields and full JSON/Base64 hashes. For example, Remix loads `maxPlanetCoins` input `9.999999999999999e+50000` through `new Decimal(...)` and later serializes `9.999999999999998e+50000`. The test compares Beyond with that source-produced normalized value and full-save hash; raw Decimal input strings are not assumed to round-trip verbatim. This covers selected high exponents only. Natural Chapter 3–6 route-end saves separately evidence gameplay accumulation through 443,818,759 active clicks at the Chapter 6 endpoint and now match the complete legacy object and encoded string when the matching source session selections/message log are supplied. They do not cover the synthetic exponent range or historical-save variants.

The probe confirms the source's exact encode/decode order and a Unicode corruption on round-trip. See the dedicated legacy quirk entry; preserve the observed behavior while parity is the goal. `loadGame()` performs field-by-field assignment rather than schema validation or a versioned migration. Its defaults are not uniform: raw settings, Story, and progress values use `loadVal`, but resource and pickaxe Decimal expressions call `new Decimal(value)` before `loadVal`; in the pinned runtime omitted resource fields therefore load as Decimal zero (including Gems despite the nominal alternate of 5). A missing pickaxe group retains the current pickaxe, while a present empty group loads name `Toy Pickaxe` and Decimal-zero power/quality. The synthetic `{ "story": {} }` case also shows absent Gem and Planet Coin upgrade groups resetting to zero while absent settings, Money upgrades, Powers, and pickaxe leave seeded runtime values in place. If the Powers group is present but its upgrades are absent, Wisdom upgrade levels reset to zero. These controlled captures prove those specific branches, not a complete catalog of old-save variants or corrupt-input behavior. The source-paired `tests/e2e/legacy-save-optional-groups.spec.ts` imports the absent-group and present-empty-group captures into populated live sessions through Settings; both complete legacy exports match pinned Remix, including retained/reset upgrade levels, Power values, pickaxe, and Settings state.

## Multiple browser tabs

**Verified source behavior (2026-11-07):** Remix `saveGame()` serializes the
entire current `game` value and writes it directly to `localStorage` key
`IdleMine`; the pinned scripts do not install a `storage` event listener or
merge another tab's save. In the source-paired
`tests/e2e/save-cross-tab-overwrite.spec.ts`, both tabs load the same state.
The updated tab buys Blacksmith and saves, the still-stale second tab overwrites
it, then the updated tab saves again. Remix and Beyond match the level-one,
level-zero, and level-one snapshots in order; Beyond uses its versioned
`IdleMineBeyond` primary save and leaves the imported `IdleMine` legacy key
untouched. Other action/write interleavings, profile-specific quota policies,
and process termination remain open. Injected read/write failures and native
quota errors pass in Firefox and WebKit in addition to Chromium; this does not
characterize every browser profile's quota policy.

### Historical save evidence

**Verified research finding (2026-09-30):** the canonical repository has five commits and no Git tags or releases. GitHub file history shows `Scripts/Define/functions.js` and `Scripts/Define/game.js` only in the initial source commit [`719cf126`](https://github.com/veprogames/idle-mine-remix/commit/719cf126678a56c53c0ad8e68cebd059b3101201); the later commits update README links and the license. The [functions.js history](https://github.com/veprogames/idle-mine-remix/commits/main/Scripts/Define/functions.js), [game.js history](https://github.com/veprogames/idle-mine-remix/commits/main/Scripts/Define/game.js), [tags](https://github.com/veprogames/idle-mine-remix/tags), and [releases](https://github.com/veprogames/idle-mine-remix/releases) were checked. Existing absent/empty-group captures are synthetic inputs to the final pinned loader; they are not payloads captured from older releases. No first-party historical save schema has been verified. **Project decision:** do not invent migrations for unsupported historical formats. Keep broad historical compatibility open; the single community specimen recheck below proves only that the pinned final loader and Beyond accept that one input.

**Community leads, not verified specimens (2026-10-04):** a [public Reddit thread about the Remix launch](https://www.reddit.com/r/incremental_games/comments/g48nt2/kongregate_idle_mine_remix/) links a [user-described ~2,600-level run on Pastebin](https://pastebin.com/7kyskYkU). Another commenter in that thread says export/import failed for their Kongregate save and links a [Google Drive export](https://drive.google.com/file/d/1e4ZgKJKxXj4maW-4sGJRJ_pEuQXgxmvJ/view?usp=sharing). These are community-hosted candidates, not first-party evidence. On 2026-10-04 the research browser could read the Reddit discussion but could not retrieve either artifact (cache miss/inaccessible URL), so no bytes, save version, or player-visible load outcome were verified. Neither candidate is copied into fixtures or treated as a specification. If an artifact becomes accessible, preserve its URL, provenance, retrieval date, and hash, then test it against the pinned loader before drawing conclusions.

**Community specimen recheck (2026-11-03):** direct retrieval of the Pastebin raw URL returned HTTP 404. The linked Drive artifact was accessible as 49,460 bytes with SHA-256 `c20f939b47d63bd60cfd9f9aba17444c5bf1a2c4f50b977a6a452f99a4c2131e`. The Reddit comment links it as an exported string for an import bug and distinguishes it from the author's unshared localStorage save. It is community evidence, not a first-party specification. Its decoded shape has 20 top-level fields, 26 saved number-formatters, and 72 saved mine objects; it omits Planet Coin/Wisdom resource fields and the Planet Coin upgrade and Powers groups found in the pinned runtime. Pinned `functions.loadGame(saveString, undefined, true)` loaded it in Chromium 153.0.8010.12 with no dialog or page error. The complete loaded-game JSON hash was `524f9d44ad4f915f18e05806626077fce2da133e7005dc396a31eefa5bfb68aa`; the pinned re-export hash was `5f91eff45326837a81283235a4c9a42fe17898b9c6ea9a86cccb07355541755d`. A disposable Beyond differential using only the source-read fields matched the complete source export and re-export. The original player save remains only in ignored `.research/`; it is not checked in. The durable [historical-shape fixture](../../tests/fixtures/parity/remix-historical-save-shape.json) replaces player values with synthetic values, records the original hash/provenance, and compares the complete pinned source export hashes in `tests/parity/legacy-save-historical-shape.test.ts`. This verifies one specimen and a minimized source-read shape; it does not prove support for every old save or an older deployed loader.

The canonical checkout was independently rechecked on 2026-10-04: its complete local Git history has five commits; the loader and game definitions still occur only in `719cf126678a56c53c0ad8e68cebd059b3101201`. This confirms the repository-history search but does not rule out older deployed builds or identify which build produced the community specimen tested below.
The separate `saveApplicationSemantics` capture loads a complete distinct save with offline processing disabled. It verifies all seven resource fields, progress and regenerated current object, Story fields and scroll position, `lastActive`, number formatter, theme/toggles, all four upgrade families, five named Powers values, and pickaxe fields. `settings.tab` is serialized but not read by `loadGame()`; the existing tab remains active. The load reads the clock for the `lastActive` fallback even when the save supplies that timestamp. `timer`, `usedGemsLevel`, and other serialized runtime/presentation fields are not assigned by this loader. A three-browser live Settings import now supplies large conflicting `timer.autoPickaxe` and `timer.save` values and verifies that source and Beyond exports retain their pre-import live timer values and remain byte-identical. Although `getSaveString()` serializes the whole game object and therefore includes `usedGemsLevel`, `Scripts/Define/game.js` initializes it to zero and the manual `loadGame()` field list omits it; the Craft selector in `index.html` changes it directly. Reloading a save therefore resets the selected Gem craft cost. The Chapter 5 route trace records the value carried across its same-session Chapter 4/5 boundary.

`saveOfflineApplicationSemantics` captures one controlled wrapped save loaded through the pinned `loadGame()` with offline processing enabled. The save selects a generated object, pickaxe, Powers, upgrade levels, notation, and 3,601 seconds away; the probe records live Money/Gem/Planet Coin rates, final resources and maxima, Story/settings/pickaxe state, clock values, and the post-reward storage snapshot. The exact event order is theme application → offline reward message → storage write → `Game Saved!`. Four clock reads are observed: eager `lastActive` fallback, elapsed-time calculation, updated `lastActive`, and `saveGame()` timestamp.

**Live cold-start threshold differential (2026-11-09):** the source-paired
`tests/e2e/offline-progression.spec.ts` loads the same captured positive-rate
state with `lastActive` set to exactly 300 seconds or 301 seconds before the
fixed current time. At 300 seconds, Remix and Beyond show no welcome-back
message and preserve Money, Gems, and Planet Coins. At 301 seconds, both show
the offline reward and change Money and Gems. In Chromium, Firefox, and WebKit,
the two apps' complete decoded saves and encoded exports match for both cases.
This verifies the live strict-threshold branch for this controlled state; OS
background scheduling remains open.

**Live zero-rate cold start (2026-11-09):** a separate source-paired E2E
loads the captured Universe object 214 state after 3,601 seconds with Money,
Gem, and Planet Coin rates all zero. Remix and Beyond still display the
`earned you 0 $.` offline message and `Game Saved!`, leave all five resource
balances and high-water fields unchanged, update `lastActive`, and produce
identical full decoded saves and encoded exports in Chromium, Firefox, and
WebKit. This covers the live `offlineSec > 300` path when every reward is zero;
actual background scheduling remains open.

**Settings text-field offline-import differential (2026-11-08):** a source-paired E2E imports this captured 3,601-second save through the live Settings button in both Remix and Beyond in Chromium, Firefox, and WebKit. It compares the exact welcome-back message, restored Money/Gem/Planet Coin resources, and final exported legacy bytes after returning to Mining. The source localStorage snapshot contains the offline reward message but not the later `Game Saved!` message: `saveGame()` serializes and writes before appending that confirmation. Beyond’s versioned primary contains the same persisted resource state, and both live exports match in each engine. Chromium matches the captured Money value; in WebKit the pinned source and Beyond both produce a value one final decimal digit lower than the Chromium capture, so WebKit compares against its live source. This proves the manual-import integration for this capture; it does not close other offline durations or real background scheduling.

Absent and empty groups have distinct source behavior. Missing `upgrades` preserves existing Money upgrade levels; missing `gemUpgrades` and `planetCoinUpgrades` reset their families to zero; missing `powers` preserves power values and Wisdom upgrades. A present `powers` group with no `upgrades` resets Wisdom upgrade levels, while an empty `powers.data.values` leaves existing values unchanged. A missing `pickaxe` preserves it, while `{}` sets its name to `Toy Pickaxe` and its Decimal power and quality to zero because `new Decimal(undefined)` runs before the apparent fallback. A present empty `settings` group defaults the formatter index to zero, theme to light, and both toggles to false. These behaviors are captured in `saveSemantics.missingOptionalGroups`, `saveSemantics.emptyPresentGroups`, and `saveApplicationSemantics`.

The pinned loader assigns game.numberFormatters[numberFormatterIndex] without range validation. An index equal to the captured formatter count leaves the selected formatter undefined; the next numeric render throws a native TypeError. ests/e2e/legacy-save-invalid-formatter.spec.ts now imports the same encoded save in Remix and Beyond and compares that engine''s exact render error in Chromium, Firefox, and WebKit. Beyond''s separate versioned v1 schema still rejects formatter indices outside its documented range.

The pinned loader's malformed field-application behavior is captured in twenty `saveSemantics.fieldApplicationErrors` cases. They cover a JSON `null` root; an absent or null Story container; null Settings; null Money, Gem, and Planet Coin upgrade groups or entries; unknown keys in each of the four upgrade groups; null Powers groups, data, values, or upgrades; null Power-upgrade entries; and a null pickaxe. Each `TypeError` occurs at a different point in the field-by-field loader and may leave earlier resources, progress, Story, theme, upgrades, the selected mine object, or Power values applied. Fixtures preserve the exact input, error name/message, and resulting sentinel state. The source loader has no transaction rollback or schema validation. This is a representative sample, not an exhaustive malformed-save catalog or a Beyond recovery policy.

**Verified compatibility behavior:** `applyRemixLegacySaveFields()` now commits immutable field snapshots in the same order and wraps a thrown field error with the partial application state and effects already reached. `loadRemixLegacySaveIntoState()` returns `applicationFailed` without running offline progression. The Settings text-field import adopts that partial state and dispatches an earlier theme change, then displays the error; it does not write the malformed save to Beyond storage. Vitest compares all twenty captured partial states, including absent/null Story containers and unknown-key failures in each upgrade group with preceding source mutations preserved. The Settings Playwright flow verifies both the malformed-group and absent-Story visible errors, preserved partial mine object, and no-write boundary. Startup and recovery-file flows retain their Beyond-specific recovery handling and never persist a failed import.

`packages/persistence` decodes the Remix wrapper and `applyRemixLegacySaveFields()` applies captured current-save fields to immutable core state. `loadRemixLegacySaveIntoState()` then composes offline rewards and returns ordered theme/log/save effects. It passes the eager timestamp fallback read into the core offline action, preserving the four-clock-call combined path without duplicating a read, and resolves the loaded number formatter only when a reward message is produced. Its save effect contains the full application state at the source save point.

The package also defines a strict, versioned Beyond v1 JSON envelope. It stores every mutable field in `RemixLegacySaveApplicationState` as JSON-safe data, validates every field and strict-object boundary with Zod, rejects malformed/missing/unsupported versions, and reconstructs the current mine object from its persisted object ID and the pinned catalog. Persisted current/high-water mine IDs must be nonnegative safe integers with the current ID no higher than the high-water mark, so restore cannot attempt to materialize a fractional or unsafe ID. `lastActiveMs` is omitted when unset and preserved when present. Tests exercise complete and fresh-state round trips, every serialized node's required shape, unknown keys at every object level, the mine-ID and formatter-index boundaries, and encoder rejection of non-finite values. These are Beyond v1 integrity decisions, not claims about Remix's versionless loader behavior; older Beyond versions do not exist yet, and a future v2 migration is not claimed by v1 certification.

`importRemixLegacySaveToBeyond()` applies the source-compatible loader, dispatches theme/offline effects in order, and writes the resulting v1 state under the separate Beyond key. It leaves `IdleMine` untouched. If the legacy load has a source save effect, `Game Saved!` is dispatched only after the primary write succeeds. A successful import without offline rewards is persisted silently because Remix produced no save effect. The browser adapter stores the previous valid primary as one backup generation, preserves a valid backup when the current primary is corrupt, and reports backup recovery without silently rewriting either value. It refuses to load a backup over or overwrite an unsupported future version. The Settings route exposes text-field import, template-backed full-object legacy export, and source-compatible Hard Reset. The full-object exporter is verified against two pinned complete game snapshots plus the exercised route state; it is not yet certified across the full dynamic save state space.

**Beyond recovery workflow (project decision, not Remix behavior):** when startup cannot safely load either Beyond slot, the recovery screen can download and display a read-only bundle containing the primary, backup, and legacy `IdleMine` values. In the browser, the Beyond values come from localStorage. In Tauri, they come from the two native app-data files; the legacy value still comes from WebView localStorage. The user must acknowledge saving that bundle before either recovery import becomes available. Recovery accepts a standalone Beyond v1 envelope or this bundle format. For bundles it selects a valid primary first, then a valid backup if the primary is absent or invalid; a future-version primary blocks fallback to prevent downgrade. The bundled legacy `IdleMine` slot is never treated as a Beyond save and remains available through the separate legacy import. A validated save runs the normal injected-clock offline transition and is written through the backup-aware coordinator. Invalid files and future-version files do not write; storage incompatibility leaves the recovery screen open. Effects are released only after persistence succeeds. Exporting the recovery bundle alone never changes a slot. Historical save migration, export-shape parity, and native WebView runtime certification remain open.

**Recovery-bundle browser differential (2026-11-08):** the live `remix-app.spec.ts` flow now runs in Chromium, Firefox, and WebKit. It loads the captured valid backup from a selected bundle, confirms the import stays disabled until acknowledgement, and checks the restored Beyond v1 save plus unchanged legacy key. Firefox and WebKit use `test:e2e:recovery-file:browsers`.

**Stored-backup startup restore (2026-11-09):** a browser E2E seeds a damaged
Beyond primary, a valid Beyond backup derived from a captured legacy save, and
a conflicting legacy key. Startup loads the backup rather than entering
recovery or migrating the legacy value. With its timestamp equal to the fixed
clock, there is no offline save effect, so all three storage slots remain
unchanged. It then manually saves the recovered state: the primary becomes a
valid restored save, the existing valid backup remains byte-identical, and the
legacy key remains unchanged. The case is included in the Firefox/WebKit
recovery-file gate. Backup corruption and offline-write branches remain covered
separately.

`loadRemixBeyondSaveIntoState()` restores a v1 save, runs the same source-backed offline action with an injected clock and selected formatter, and dispatches the theme before offline effects. If rewards are applied, it writes the full post-reward state before dispatching `Game Saved!`. Its controlled load reuses `saveOfflineApplicationSemantics` and matches the captured resources, message, four clock reads, storage order, and timestamp. `createRemixWebGameSession()` invokes this loader at startup and routes simulation save effects through the browser adapter. Its action queue preserves transition/write/effect order and supports explicit legacy-save recovery after startup enters recovery. Standalone Beyond recovery files use the same offline transition and persistence coordinator, and only transition the session to ready after a successful write. The coordinator powers route startup, mining frames, Story state, upgrade purchases, crafting, Settings, Powers, and recovery; native WebView runtime certification remains open.

Additional controlled source cases distinguish an absent group from a present-but-empty group and capture the failure order for empty Base64, invalid Base64, invalid percent escapes, Base64 containing invalid JSON, and a parsed save without `story`. Separate source cases confirm that `atob` accepts ASCII whitespace and omitted Base64 padding. See `saveSemantics.emptyPresentGroups`, `saveSemantics.base64Variants`, and `saveSemantics.loadErrors`; these are representative branches, not a complete historical-save or recovery catalog. The Settings import E2E compares the pinned Chromium decode-error names/messages, alert strings, subsequent parse errors, and no-write result for all eleven captured load-error cases.

The hard-reset implementation calls localStorage.clear(), which clears all origin storage rather than only this game's key. This is source-observed; its impact depends on the hosting origin.

**High-magnitude Decimal import/export (2026-11-09):** the captured `high-magnitude-decimal-fields` state includes extreme Money, Gems, Planet Coins, Wisdom, all five Powers values, and pickaxe power/quality. `tests/e2e/legacy-save-optional-groups.spec.ts` now imports it through Settings in pinned Remix and Beyond, then compares complete decoded exports and encoded bytes. Chromium passed the focused case; Firefox and WebKit passed the six-test `test:e2e:legacy-import:browsers` gate. This verifies one controlled high-magnitude save combination, not every Decimal magnitude or gameplay state.

## Offline progression observed in source

**Verified legacy behavior (pinned source and controlled runtime):** `functions.loadGame()` evaluates its `Date.now()` fallback while reading `lastActive`, then reads the clock again for elapsed time even when the save already has a timestamp. Rewards apply only when elapsed time is strictly greater than 300 seconds and `nooffline` is false. In that branch it obtains Money, Gem, and Planet Coin rates from `getMPS()`, `getGPS()`, and `getPCPS()` using the loaded current object, pickaxe, Powers, upgrades, and highest-damageable scan. The offline duration is `Math.min(3600 * (6 + Offline Time effect), elapsedSeconds)`. Money is `MPS × (0.5 × duration)`; Gems and Planet Coins are `floor(rate × upgrade effect × duration)`, with their respective offline-upgrade effects. On apply, Remix logs a return message, updates resources and their maxima, reads `Date.now()` for `lastActive`, then `saveGame()` reads it again before storing the save. A controlled advancing-clock case captures these separate reads.

Twelve named boundary cases plus sixteen elapsed-time samples generated with xorshift32 seed `0x4f46464c` live in `offlineProgressionSemantics`. The cases include the exact 48-hour maximum cap at Offline Time level 42 and one second beyond it, alongside missing timestamps, the strict 300-second threshold, exact/over default cap, an upgraded cap, `nooffline`, negative elapsed time, zero rates, and clock movement between reward calculation and save. Every generated input and complete source result is captured; `tests/parity/offline-progression.test.ts` compares resources, maxima, messages, clock reads, timestamps, and writes. The probe stubs MPS/GPS/PCPS to isolate the offline-load branch; it does not validate every live state that generates those rates. Manual import in `index.html` calls `loadGame(saveString)` without a `nooffline` argument, so it follows the same offline check; hard reset explicitly passes `true`.

`packages/core/src/remix-offline-progression.ts` reproduces the pure resource/timer transition with an injected clock, offline rates, upgrade effects, and number formatter. Its rate source can be resolved lazily after the threshold check, preserving the legacy ordering. `performRemixSimulationAction()` supplies a lazy rate resolver that uses the loaded state and catalog, shares the mining action's factor/highest-damageable calculation, and then calls the same source-backed MPS/GPS/PCPS formulas. Nine captured formula states are exercised through this full action, including low-damage boundaries, a last-damageable-object Gem bonus, an extreme object ID, and zero-damage cases. Four additional browser captures call real `loadGame()` with controlled saves and real rate functions; Vitest compares rates, rewards, saved resources, clock reads, log text, and stored snapshots. The source emits `Game Saved!` after a successful storage write. The web persistence service emits this confirmation after its versioned primary write, and the legacy-import coordinator preserves theme → offline message → write → confirmation order. `createRemixWebGameSession()` also routes ordered save effects from regular core actions through the browser adapter; session and route tests cover those writes and failure ordering. This is selected application coverage, not exhaustive save integration. Twelve isolated offline branch fixtures cover timing, default/upgraded/maximum caps, multipliers, and save order with controlled rates. Remaining offline gaps include broader live-rate state coverage and actual OS/browser background scheduling. The cold-start differential uses the non-default Letters formatter at index 3; other formatter/state combinations are not exhaustively enumerated. The return-message crop is covered in the pinned browser differential below.

**Pinned browser cold-start differential (2026-10-04):**
`tests/e2e/offline-progression.spec.ts` opens the pinned Remix and Beyond apps
in Chromium from the same source-encoded legacy saves. The Chromium run compares
an upgraded seven-hour capped restore, the 60-second backward wall-clock jump,
and a controlled advancing startup clock; complete exports match, and the
positive capped state has exact `.messagelog` pixels at 1440x900 in both themes.
The selected four-scenario cold-start test and the separate advancing-startup-
clock test now also run in Firefox and WebKit. Those engines compare visible
message text/color, clock-read prefixes, and complete decoded Remix/Beyond save
state. The controlled clock case compares the source's persisted legacy
snapshot with the complete legacy-shaped Beyond state restored from its
primary as decoded objects. The cap-state pixel assertion remains
Chromium-only.
The additional level-90 Asteroid live-rate case has a captured Chromium output;
WebKit source and Beyond both produce Money one final decimal digit lower than
that capture, while their complete exports match each other byte-for-byte. The
controlled advancing-clock case checks corresponding clock-read prefixes and
full exports, then holds later runtime reads at the final timestamp. The
cold-start tests still do not simulate the actual OS background scheduler; the
controlled Chromium freeze/resume differential is described below, and native
WebView behavior remains outside web-v1.

**Captured multi-resource live-rate cold start (2026-11-08):**
`tests/e2e/offline-progression.spec.ts` also builds a controlled full legacy
save from the captured `upgraded-asteroid-live-planet-coin-rate` inputs in
`offlineLoadRateCompositionSemantics`. The pinned Remix and Beyond both load
the level-90 Asteroid state with nonzero Money, Gem, and Planet Coin rates,
apply the 3,601-second elapsed interval, emit the captured three-resource
return message, and export identical complete legacy save bytes and decoded
objects. The source rate-composition capture supplies the controlled state;
the live `loadGame()` execution supplies the differential oracle. This is not a
naturally accumulated long-play save. Broader save-state combinations and real
OS/browser background scheduling remain open.

**Maximum Offline Time cap (2026-11-09):** the pinned `offlineTime` definition
has maximum level 42, making the source cap `3600 * (6 + 42) = 172800`
seconds. `offlineProgressionSemantics` now captures exactly 48 hours and one
second beyond the cap; both process 172800 seconds and produce identical
resource, message, timestamp, and storage effects. A live level-90 Asteroid
cold start sets Offline Time 42 plus the captured Gem/Planet Coin offline
upgrades, waits 172801 seconds, and source-pairs all three nonzero resource
rates, the return message, and complete save exports in Chromium, Firefox, and
WebKit. This verifies the maximum cap with one controlled live state, not all
rate-producing save states.

**Cross-browser long-frame differential (2026-11-09):**
`tests/e2e/offline-progression.spec.ts` advances each live Remix/Beyond test
clock by exactly 120 seconds while the animation loop remains active. The next
`requestAnimationFrame` update performs one auto-pickaxe hit despite the long
delta, resets the auto timer, passes the strict 60-second save threshold once,
resets the save timer, updates `lastActive`, and emits the save confirmation in
both apps. Power Power (Idle) level 1 raises Power of Mining from 1 to 1.00002
after the hit; the full exported legacy save contains that post-hit value. Full
exports and visible log order match in Chromium, Firefox, and WebKit (3/3); the
dedicated Firefox/WebKit case runs in CI. This is a controlled long-frame
integration check. Actual OS/browser background scheduling and throttling
remain open, and native WebView lifecycle is outside web-v1.

The existing Chromium CDP `Page.setWebLifecycleState` freeze/resume case
remains a separate check and continues to verify one resumed frame. The
cross-browser frame-gap case above does not establish actual OS/browser
background scheduling or throttling; native WebView lifecycle remains outside
web-v1.

**Live purchase export differential (2026-11-08):**
`tests/e2e/save-export-purchase-differential.spec.ts` starts pinned Remix and
Beyond from the captured `buy-exact-affordability`, `buy-uses-gem-resource`,
`buy-uses-planet-coin-resource`, and `buy-uses-wisdom-resource` saves, opens the
corresponding upgrades view, makes the successful purchase, and exports through
Settings. The complete decoded legacy objects and encoded bytes match for Money
Active Power at 1000 Money, Gem Offline Gems at 4444 Gems, Planet Coin Active
Power at 100 Planet Coins, and Wisdom Simple Gem Boost at 10 billion Wisdom.
Two captured bulk saves also match after live Shift buy10 and Control buy100
Money Active Power actions, from level 0 through levels 10 and 100. Other
purchase levels/actions and wider runtime states remain open.

## Main simulation time and autosave timer

**Verified source and controlled frame behavior:** `Scripts/main.js` reads `Date.now()` to compute a delta at the start of each `requestAnimationFrame` update, then reads it again to set the next baseline. It increments the auto-pickaxe and save timers by the same delta. The auto timer performs at most one hit and resets to zero when strictly over its interval. The save timer saves once and resets to zero only when strictly over 60 seconds; exact equality does not save, and long-frame excess is discarded. Every update requests story-notification refresh after the save check. The ten hit plus four frame cases in `miningHitSemantics` cover these timer boundaries and event order.

**Verified source behavior:** `Scripts/upgrade.js` `Upgrade.buy()` updates the selected currency and upgrade level without calling `saveGame()`. The canonical upgrade definitions in `Scripts/Define/game.js` provide no custom `onBuy` hooks. `tests/e2e/upgrade-persistence-window.spec.ts` source-pairs a Blacksmith purchase in Chromium, Firefox, and WebKit: reloading before autosave restores level 0; the live animation-frame update does not save at exactly 60,000 ms, then saves at 60,001 ms. After that frame, the complete exported legacy bytes match and contain Blacksmith level 1 with 970 Money. A second live case purchases source-captured exact-price upgrades with Money, Gems, Planet Coins, and Wisdom in one session. Each purchase leaves both storage snapshots unchanged; there is still no save at 60,000 ms, while the 60,001 ms frame persists all four levels and balances together. Complete exports match across the three engines before reload; after reload, decoded state in both apps retains all four level-one upgrades and zero balances. Other starting states and runtime intervals remain open.

**Verified legacy behavior (pinned source and controlled runtime):** `index.html` passes `functions.getUsedGems()` into `functions.craftPick()`. Crafting saves immediately after each strictly stronger pickaxe replacement, after the replacement log event. A Shift bulk action can therefore emit multiple saves containing distinct intermediate Gem balances and equipped pickaxes. Duds and attempts without enough Gems do not save. `pickaxeCraftingSemantics` captures a two-replacement case with successive snapshots at 3 Gems / `Bad Mud Pick` and 0 Gems / `Sturdy Mud Pick`; the composed core action preserves each snapshot as an ordered save effect. This is a core-state snapshot, not a complete legacy save serialization or persistence adapter.

Beyond's `advanceRemixSaveTimer` reproduces the strict threshold/reset, and `performRemixMiningAction` returns ordered frame events for save and story refresh. A browser/native adapter must still execute those events against persistence and the story transition. The startup/load clock reads are now source-paired under a controlled advancing clock; real browser/OS suspension and resumed-frame cadence remain environment evidence. Rendering cadence affects automatic hit counts under long frames. Keep the clock injected and do not change outcomes during parity without an accepted exception.

## Hard Reset timestamp and save behavior

The pinned `hardReset()` asks for confirmation three times. After three acceptances it calls `localStorage.clear()` for every origin key, passes the startup `initialGame` JSON to `loadGame(..., false, true)`, then clears the message log and used-Gem level. It does not call `saveGame()`. The loader resets `lastActive` to the timestamp already stored in `initialGame` at application startup and does not touch `game.timer.autoPickaxe` or `game.timer.save`. Therefore the reset state remains unsaved until a later autosave, and the retained timer can make that save occur sooner; after a reload, the old startup timestamp can also contribute to offline elapsed time. `hardResetSemantics` captures these results. Beyond clears origin storage only after all confirmations, uses an injected startup timestamp, preserves both loop timers, and performs no write during reset.

The source capture also advances `Date.now()` by 301 seconds after the startup timestamp and confirms Hard Reset. This verifies the `nooffline` argument suppresses offline rewards at a time when an ordinary load would pass the strict 300-second threshold. `tests/e2e/remix-app.spec.ts` applies the same clock advance to pinned Remix and Beyond, then compares the full exported legacy save and verifies origin storage remains empty. This reset edge is covered in Chromium, Firefox, and WebKit; other elapsed intervals and later reload behavior remain open.

`tests/e2e/hard-reset-autosave-timer.spec.ts` also advances both runtimes' loop clock to 59.999 seconds without saving, confirms Hard Reset preserves that timer, checks that equality at 60 seconds still does not save, then advances to 60.001 seconds and compares the complete exported saves after the automatic write. The source timer is asserted before and after reset and at both threshold points. Chromium, Firefox, and WebKit cover this integration; other retained timer values remain open.

## Beyond architecture decision

- Save schema is versioned and validated; migrations, integrity checks beyond strict schema/Decimal validation, backups, safe recovery, import/export, and a legacy Remix importer remain required.
- Browser and native storage are adapters; the core never imports localStorage, IndexedDB, filesystem, or Tauri APIs.
- Clock/time is injected. No direct Date.now() in simulation code.
- Legacy RNG is injected. No casual Math.random() in game-domain code.
- New persistence must not silently replace legacy data before a successful import.

The current persistence package implements the legacy codec, current-save field application, pure offline-load orchestration, the Beyond v1 schema, backup-aware storage coordination, legacy migration, v1-load/offline coordination, and validated Beyond v1 recovery-file import. Browser storage and the web session coordinator are implemented and tested, including startup selection, ordinary simulation save effects, read-only recovery export, and acknowledged legacy/Beyond recovery. The Tauri adapter restricts native commands to the primary and backup slots under `app_data_dir`; Rust filesystem tests and TypeScript bridge tests cover slot mapping, replacement, and clearing. Actual save/reload execution inside the native WebView still needs an end-to-end smoke check. Complete export-shape parity and historical legacy-save compatibility remain open.

`tests/parity/save-format.test.ts` checks source shape, encoding order, Unicode round-trip result, the minimal missing-groups case, and exact JSON/encoded hashes for full fresh and controlled source save objects. `tests/parity/legacy-save-application.test.ts` compares captured field application and absent/empty group behavior; `tests/parity/legacy-save-offline-application.test.ts` compares the wrapped save, live-rate offline rewards, no-offline branch, exact clock count, effect order, and save snapshot, then round-trips the captured post-reward state through Beyond v1. `tests/parity/beyond-save.test.ts` round-trips all v1 state fields, extreme Decimal values, and a derived object ID, and rejects malformed JSON, unsupported versions, invalid Decimal strings, and extra fields. `tests/parity/remix-beyond-save-storage.test.ts` covers write order, backup retention, malformed recovery, newer-version protection, browser key separation, read-only recovery export, and captured legacy-import effect order; `tests/parity/remix-beyond-save-load.test.ts` checks v1 load/offline effects, the source clock sequence, save snapshot, and strict 300-second threshold. `tests/parity/remix-beyond-recovery-file.test.ts` covers direct v1 and recovery bundles, primary/backup selection, ignored legacy slots, malformed/empty data, future-version no-write protection, and a captured offline-reward import including the four clock reads and effect order. Session tests cover explicit legacy and Beyond file recovery into damaged storage; Playwright checks recovery-bundle download, acknowledgement gating, backup selection from a supplied file, persisted recovery, and legacy-key retention. The native adapter has Vitest command-mapping coverage and Rust filesystem tests; a Tauri WebView save/reload smoke test and full Beyond state-to-object export parity remain open.

### Historical-shaped save UI integration (2026-11-07)

The synthetic community-derived fixture now also passes through the live Settings text import in tests/e2e/legacy-save-historical-shape.spec.ts. Its timestamp is 60 seconds before the controlled clock, so the source-paired E2E verifies that neither Remix nor Beyond writes storage, then compares their complete live Settings exports and zero defaults for omitted Planet Coin/Wisdom resources. This is one integration case; historical save migration and general format support remain open.

The historical-shape Settings E2E also performs a live pinned-Remix comparison: both runtimes import the same synthetic save through the text field and their subsequent Settings exports match exactly. Its 60-second offline interval follows the strict no-save branch. This covers one specimen through import and export; it does not establish other historical formats.

### Live mining-drop export differential (2026-11-08)

`tests/e2e/save-export-mining-drop-differential.spec.ts` starts from the pinned `planet-coin-drop-roll-follows-gem-roll` case at object 90 and runs two source-paired random sequences in Remix and Beyond: the captured Gem miss followed by a Planet Coin award, and a successful Gem roll followed by a failed Planet Coin roll. It also breaks object 169 with Power of Wisdom 3, comparing the resulting Wisdom 5 and max Wisdom 5 after the base drop of 1 is scaled by that Power. A fourth state sets Power Power (Active) to level 1; after the same active click, Power of Mining rises from 2 to 2.0001 and that value is present in the full export. All four complete Settings export objects and exact encoded bytes match in light and dark Chromium, Firefox, and WebKit (24/24 pairs). The source UI advances to `#91` after object 90, while its serialized `mineObjectLevel` remains 90 and `highestMineObjectLevel` becomes 91; retain this observed distinction. Other arbitrary runtime exports and mining states remain open.

### Malformed save-import browser compatibility (2026-11-08)

The web route injects native `window.atob` into legacy save loading so malformed
Base64 failures preserve each browser engine's exception name and message. The
source-paired `tests/e2e/save-import-error-browser-compat.spec.ts` checks ten
Base64/URI/JSON failure inputs through live Settings imports in Firefox and
WebKit, including visible error text and unchanged storage. The default codec
remains deterministic for non-browser callers. The same cross-browser test
compares all twenty captured field-application TypeErrors in Firefox and
WebKit, with storage unchanged after every failure. A web-session error
formatter restores the pinned `loadObj` identifier when production
minification changes expression text and recreates native assignment and
`Object.keys` errors for branches where the Beyond implementation uses a
different expression.

The 2026-11-08 external-byte differential compares nine quote-wrapped three-byte UTF-8 sequences with the pinned Remix decoder in Chromium: six scalar boundaries from U+0800 through U+FFFF and three overlong/surrogate invalid sequences. On 2026-11-09, the four-byte boundary case expanded to twelve inputs by adding two valid multi-scalar strings and two malformed longer sequences with a valid prefix. The expected UTF-16 units, status, and exact browser-local errors match the pinned decoder in Chromium, Firefox, and WebKit (36 comparisons). Arbitrary longer byte inputs remain open.
**Cross-resource stale purchase interleavings (2026-11-09):** after a fresh
same-origin tab saves Blacksmith 1 / 970 Money, a stale tab buys either Simple
Gem Boost for exactly 10 billion Wisdom or Planet Coin Active Power for 100
Planet Coins, then manually saves. Pinned Remix and Beyond replace the shared
slot with the stale Blacksmith 0 / 1,000 Money snapshot, matching upgrade at
level 1, and zero of the purchased resource; Beyond's backup retains the fresh
purchase. The complete Settings exports are byte-identical in Chromium,
Firefox, and WebKit. Both cases are in the Firefox/WebKit stale-save gate.
