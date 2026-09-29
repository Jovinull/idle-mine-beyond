# Saves, time, and offline progression

## Legacy save behavior observed in source

Scripts/Define/functions.js stores the save under localStorage key IdleMine. It serializes the game object as JSON, applies encodeURIComponent and escape, then Base64-encodes it. Import reverses Base64, decodeURIComponent, and unescape before JSON parsing. Base64 is encoding, not encryption.

The pinned current save shape and a deliberately minimal partial-save load are captured in `saveSemantics` in the reference corpus. The current serialized object has 27 top-level fields and no version field; nested settings, story, upgrade groups, Powers, and pickaxe keys are recorded in the fixture. Seven Decimal resource values serialize as strings, and JSON omits upgrade `getPrice`/`getEffect` functions. This describes the captured current runtime, not every historical save.

The probe confirms the source's exact encode/decode order and a Unicode corruption on round-trip. See the dedicated legacy quirk entry; preserve the observed behavior while parity is the goal. `loadGame()` performs field-by-field assignment rather than schema validation or a versioned migration. In the synthetic `{ "story": {} }` case, missing resource values become Decimal zero, Story fields take their defaults, absent Gem and Planet Coin upgrade groups reset their levels to zero, and absent settings, Money upgrades, Powers, and pickaxe leave seeded runtime values in place. This single controlled case is evidence for those branches, not a complete catalog of old-save variants or corrupt-input behavior.

`packages/persistence/src/remix-save-codec.ts` now reproduces the isolated Remix JSON/Base64 codec with no storage or browser dependency. Two pinned codec vectors cover ASCII and Unicode JSON; decoding preserves the legacy UTF-8-byte corruption. The decoder reports a decode-alert effect before the later JSON parse failure when Base64/URI decoding fails, matching `loadGame()`'s catch-then-parse order. It does not yet validate or apply the parsed save fields.

Additional controlled source cases distinguish an absent group from a present-but-empty group and capture the failure order for empty Base64, invalid Base64, invalid percent escapes, Base64 containing invalid JSON, and a parsed save without `story`. Separate source cases confirm that `atob` accepts ASCII whitespace and omitted Base64 padding. See `saveSemantics.emptyPresentGroups`, `saveSemantics.base64Variants`, and `saveSemantics.loadErrors`; these are representative branches, not a complete historical-save or recovery catalog.

The hard-reset implementation calls localStorage.clear(), which clears all origin storage rather than only this game's key. This is source-observed; its impact depends on the hosting origin.

## Offline progression observed in source

**Verified legacy behavior (pinned source and controlled runtime):** `functions.loadGame()` evaluates its `Date.now()` fallback while reading `lastActive`, then reads the clock again for elapsed time even when the save already has a timestamp. Rewards apply only when elapsed time is strictly greater than 300 seconds and `nooffline` is false. The offline duration is `Math.min(3600 * (6 + Offline Time effect), elapsedSeconds)`. Money is `MPS × (0.5 × duration)`; Gems and Planet Coins are `floor(rate × upgrade effect × duration)`, with their respective offline-upgrade effects. On apply, Remix logs a return message, updates resources and their maxima, reads `Date.now()` for `lastActive`, then `saveGame()` reads it again before storing the save. A controlled advancing-clock case captures these separate reads.

Ten cases in `offlineProgressionSemantics` cover missing timestamps, the exact and just-over 300-second boundary, exact/over default cap, an upgraded cap, the explicit `nooffline` flag, negative elapsed time, zero rates, and clock movement between reward calculation and save. They capture log and save ordering, resources, maxima, stored state, and formatter output. The probe stubs MPS/GPS/PCPS to isolate the offline-load branch; it does not validate every live state that generates those rates. Manual import in `index.html` calls `loadGame(saveString)` without a `nooffline` argument, so it follows the same offline check; hard reset explicitly passes `true`.

`packages/core/src/remix-offline-progression.ts` reproduces the pure resource/timer transition with an injected clock, rates, upgrade effects, and number formatter. It emits a log effect followed by a save effect. This is not a complete save importer or persistence adapter. Most legacy field defaults and variants, recoverable corrupt inputs, offline rate integration across reachable states, alternate notation output, and the visual return message remain open.

## Main simulation time and autosave timer

**Verified source and controlled frame behavior:** `Scripts/main.js` reads `Date.now()` to compute a delta at the start of each `requestAnimationFrame` update, then reads it again to set the next baseline. It increments the auto-pickaxe and save timers by the same delta. The auto timer performs at most one hit and resets to zero when strictly over its interval. The save timer saves once and resets to zero only when strictly over 60 seconds; exact equality does not save, and long-frame excess is discarded. Every update requests story-notification refresh after the save check. The ten hit plus four frame cases in `miningHitSemantics` cover these timer boundaries and event order.

Beyond's `advanceRemixSaveTimer` reproduces the strict threshold/reset, and `performRemixMiningAction` returns ordered frame events for save and story refresh. A browser/native adapter must still execute those events against persistence and the story transition. The current captures supply elapsed delta directly; behavior of the two separate `Date.now()` reads under a changing system clock remains source-observed but unprobed. Rendering cadence affects automatic hit counts under long frames. Keep the clock injected and do not change outcomes during parity without an accepted exception.

## Beyond architecture decision

- Save schema is versioned and validated, with migrations, integrity checks, backups, safe recovery, import/export, and a legacy Remix importer.
- Browser and native storage are adapters; the core never imports localStorage, IndexedDB, filesystem, or Tauri APIs.
- Clock/time is injected. No direct Date.now() in simulation code.
- Legacy RNG is injected. No casual Math.random() in game-domain code.
- New persistence must not silently replace legacy data before a successful import.

This bootstrap creates no save implementation or claim of legacy import compatibility.

`tests/parity/save-format.test.ts` checks the extracted source shape, encoding order, Unicode round-trip result, and the minimal missing-groups case. It tests the oracle fixture only; Beyond still has no save importer, exporter, or persistence adapter.
