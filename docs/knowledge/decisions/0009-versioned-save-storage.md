# ADR 0009: Versioned save storage and recovery boundary

Date: 2026-09-29

## Status

Accepted

## Context

The pinned Remix `saveGame()` sets `lastActive` from `Date.now()`, writes the versionless payload to localStorage key `IdleMine`, and only then logs `Game Saved!` in `#00a5ff`. Beyond has a strict versioned JSON schema, and persistence must support browser and native adapters without coupling game state to platform APIs. A failed replacement must leave a recoverable prior value, and an older app must not silently overwrite a save from a newer schema version.

## Decision

- Keep the platform-neutral storage port and save orchestration in `packages/persistence`; platform implementations live under their app boundary.
- Store Beyond data under `IdleMineBeyond` and a one-generation backup under `IdleMineBeyondBackup`. Keep the legacy `IdleMine` key untouched during import.
- Require the caller to pass the timestamp captured at the source save call. Persistence code does not read wall-clock time.
- Before replacing a valid current primary, copy it to the backup. If the primary is corrupt, preserve an already valid backup. If the primary or backup has an unsupported future version, refuse to overwrite it.
- Load a valid primary first, then fall back to a valid backup only when the primary is missing or invalid. Report backup recovery without rewriting either key.
- Return Remix's `Game Saved!` effect only after the primary write succeeds. A legacy import with no source save effect is migrated silently; the original legacy key remains.

## Consequences

- The core remains independent of localStorage and native storage APIs.
- The browser adapter, Tauri file adapter, Settings import/export, and a recovery route with read-only slot export plus acknowledged legacy and Beyond v1 file imports are implemented. Native WebView save/reload certification remains open. The native implementation is recorded separately in [ADR 0010](0010-native-save-storage.md).
- A single backup protects against an interrupted or malformed current save but does not provide a multi-generation history.

## Evidence

- Pinned Remix `Scripts/Define/functions.js` at `0e0f4bf5a9c66e5603cda2ce4bd54213023dae21`, especially `saveGame()` and `loadGame()`.
- `saveOfflineApplicationSemantics` in `tests/fixtures/parity/remix-reference-corpus.json` captures theme → offline message → storage write → `Game Saved!`, its color, and the saved state.
- Beyond implementation and tests: `packages/persistence/src/remix-beyond-save-storage.ts`, `packages/persistence/src/remix-legacy-save-import.ts`, and `tests/parity/remix-beyond-save-storage.test.ts`.
