# Procedural objects and mine rendering

## Object generation

**Verified legacy behavior (source):** Remix has explicit objects and indexed special objects, then uses region-specific formulas to generate later objects. The generator chooses its preceding anchor, derives scaling from the object index and distance from the anchor, and computes names, skin IDs, colors, HP, defense, value, and drop data. The post-Universe region uses a Random instance seeded from the requested ID for its name and drop decisions.

The design target is deterministic lookup: the same object ID under the same frozen content and code revision produces the same observable object. This must become a golden/property-tested contract; do not claim it is already validated across the full index space.

Special anchor positions, region boundaries, names, colors, skins, values, and drops are all compatibility-critical. Preserve the original JavaScript and Decimal operation order during extraction.

The first controlled oracle capture contains results for every ID from 0 through 214 (including generated entries between anchors), followed by probes at 215, 216, 217, 244, 1,000, 10,000, 1,000,000, 2,147,483,647, and `Number.MAX_SAFE_INTEGER`. The highest probe yields `Infinity` for HP, defense, and value after the reference Decimal's exponent exceeds its representable range. This is a verified extreme-input result, not evidence that such progression is ordinarily reachable. `pnpm test:reference` regenerates the output in a fresh browser context and compares it to the fixture.

## Rendering

The reference loads Images/stone_new.png as a layered spritesheet. Scripts/main.js draws a 256 × 224 mask region per layer, colors it, and composites using Canvas operations including multiply, destination-in, and source-over. Mine objects select a skin and color list rather than owning a unique sprite each.

**Project decision:** use Canvas 2D for mine-object rendering, with DOM/CSS for the rest of the UI, unless measured compatibility evidence requires another approach.

## Oracle probes

Reference questions should accept explicit IDs and return a structured record containing at least: ID, name, HP, defense, value, skin, colors, drops, and source revision. Probe fixed boundaries and representative generated indices, including immediately before and after each anchor and at large IDs.

Do not edit the upstream reference to add a probe. Use a separate derived copy or external browser instrumentation if the original page cannot be queried safely.
