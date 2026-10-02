# Procedural objects and mine rendering

## Object generation

**Verified legacy behavior (source):** Remix has explicit objects and indexed special objects, then uses region-specific formulas to generate later objects. The generator chooses its preceding anchor, derives scaling from the object index and distance from the anchor, and computes names, skin IDs, colors, HP, defense, value, and drop data. The post-Universe region uses a Random instance seeded from the requested ID for its name and drop decisions.

The exact generator is `functions.generateMineObject(id)` in `Scripts/Define/functions.js`. It selects the last special object with `entry.index < id`, or defaults to the last fixed object at `game.mineObjects.length - 1`. It sets `d = id - lastId + 1` and `d2 = max(id - lastId - 30, 0)`. Branches are selected by the anchor's successor index: `<115`, `<214`, and otherwise. The last branch seeds `new Random(id)` and consumes four draws: name-family choice, name index, numeric name suffix, and drop chance. Word selection reads the pinned `DICTIONARY_ENGLISH` table. Skin layers come from `SKIN_LAYER_AMOUNTS` in `Scripts/main.js`.

`Random` lives in `Scripts/random.js`. A seeded instance performs ten warm-up calls, then each call uses the next character of a 50-digit sequence in its arithmetic recurrence. After the 40 available post-warm-up sequence characters, the next draw becomes `NaN` because the sequence is not wrapped. This is captured separately in the reference corpus. Current procedural generation consumes four draws, so one object generation does not reach that boundary.

**Project decision:** `RemixRandom` requires an explicit seed and does not reproduce the source's seedless `Date.now()` constructor path. All simulation callers must supply a seed through their deterministic input or injected RNG service.

## Implemented compatibility slice

`packages/content/src/remix-mine-content.json` contains the source-derived 72 base definitions, 78 special anchors, 25 skin-layer counts, and 498-word dictionary. `pnpm content:sync` deterministically derives it from the pinned oracle catalog and checks the source SHA and table shape. Its upstream notice and file provenance are embedded and tracked in [IP provenance](ip-provenance.md).

`packages/core/src/mine-objects.ts` implements fixed/special lookup and the three source generation branches. Chromium compares every captured output for IDs 0 through 768 and 23 selected high-ID probes against the pinned oracle. A repeatability property samples nonnegative safe-integer IDs. Node differs by a few floating-point ulps in the `Math.sin` drop chances at IDs 118 and 132; Node tests exclude only those two chance fields, while Playwright asserts the complete object records, including those chances, in Chromium. This evidence does not cover every possible numeric ID or gameplay interactions.

The design target is deterministic lookup: the same object ID under the same frozen content and code revision produces the same observable object. This must become a golden/property-tested contract; do not claim it is already validated across the full index space.

Special anchor positions, region boundaries, names, colors, skins, values, and drops are all compatibility-critical. Preserve the original JavaScript and Decimal operation order during extraction.

The controlled oracle corpus now contains results for every ID from 0 through 768 (including generated entries between anchors), followed by 23 probes: 769; 999–1,001; 1,023–1,025; 9,999–10,001; 1,000,000; 1,048,575–1,048,577; 2,147,483,646–2,147,483,648; 4,294,967,295–4,294,967,297; and `Number.MAX_SAFE_INTEGER - 2` through `Number.MAX_SAFE_INTEGER`. This yields 792 exact object records in total. IDs 513 through 768 extend dense coverage within the pinned post-Universe generation branch. `node scripts/reference-probe.mjs update objects` changed only this reviewed corpus field; the Vitest corpus test asserts exact normalized outputs and continuous coverage, while Playwright compares every captured object directly against Chromium. The high-ID probes include JavaScript signed/unsigned 32-bit and safe-integer precision boundaries. This verifies the probed IDs only; it does not prove parity for every safe integer or gameplay interactions.

The save-export oracle additionally captures current objects at IDs 72, 125, 215, 216, and 244 inside complete serialized saves. This spans the pre-Portal, post-Portal, and post-Universe generator branches, no-drop and drop configs, both post-Universe drop resources, and later Universe scaling. Beyond reconstructs each current object from the frozen catalog and matches the complete encoded-save hash. These five saves validate representative paths, not every ID or every dynamic game state.

## Rendering

The reference loads Images/stone_new.png as a layered spritesheet. Scripts/main.js draws a 256 × 224 mask region per layer, colors it, and composites using Canvas operations including multiply, destination-in, and source-over. Mine objects select a skin and color list rather than owning a unique sprite each.

**Project decision:** use Canvas 2D for mine-object rendering, with DOM/CSS for the rest of the UI, unless measured compatibility evidence requires another approach.

## Oracle probes

Reference questions should accept explicit IDs and return a structured record containing at least: ID, name, HP, defense, value, skin, colors, drops, and source revision. Probe fixed boundaries and representative generated indices, including immediately before and after each anchor and at large IDs.

Do not edit the upstream reference to add a probe. Use a separate derived copy or external browser instrumentation if the original page cannot be queried safely.
