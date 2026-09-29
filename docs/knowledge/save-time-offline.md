# Saves, time, and offline progression

## Legacy save behavior observed in source

Scripts/Define/functions.js stores the save under localStorage key IdleMine. It serializes the game object as JSON, applies encodeURIComponent and escape, then Base64-encodes it. Import reverses Base64, decodeURIComponent, and unescape before JSON parsing. Base64 is encoding, not encryption.

The saved state includes resources, progress indices, upgrades, power values, pickaxe state, settings, story state, and lastActive. Exact field coverage, old-save variations, defaults, and error behavior still require fixture extraction.

The hard-reset implementation calls localStorage.clear(), which clears all origin storage rather than only this game's key. This is source-observed; its impact depends on the hosting origin.

## Offline progression observed in source

On load, the source compares Date.now() with lastActive. Offline rewards require more than 300 seconds. The default cap is six hours, extended by the Offline Time upgrade. Money uses a 0.5 multiplier. Gems and Planet Coins have their own upgrade factors and floor behavior. The implementation logs a return message, updates resource totals, and saves after applying offline rewards.

The exact formulas and edge cases must be extracted into golden fixtures, including clock reversal, cap boundaries, upgrade effects, zero damage, malformed timestamps, and whether a manually imported save follows the same path.

## Main simulation time

Scripts/main.js uses Date.now() deltas inside requestAnimationFrame and resets the automatic mining timer after one hit. Rendering cadence therefore affects the number of automatic hits under long frames. Separate simulation and rendering clocks in Beyond, but do not change reference outcomes during parity without an approved exception.

## Beyond architecture decision

- Save schema is versioned and validated, with migrations, integrity checks, backups, safe recovery, import/export, and a legacy Remix importer.
- Browser and native storage are adapters; the core never imports localStorage, IndexedDB, filesystem, or Tauri APIs.
- Clock/time is injected. No direct Date.now() in simulation code.
- Legacy RNG is injected. No casual Math.random() in game-domain code.
- New persistence must not silently replace legacy data before a successful import.

This bootstrap creates no save implementation or claim of legacy import compatibility.
