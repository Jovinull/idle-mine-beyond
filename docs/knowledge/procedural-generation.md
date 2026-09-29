# Procedural objects and mine rendering

## Object generation

**Verified legacy behavior (source):** Remix has explicit objects and indexed special objects, then uses region-specific formulas to generate later objects. The generator chooses its preceding anchor, derives scaling from the object index and distance from the anchor, and computes names, skin IDs, colors, HP, defense, value, and drop data. The post-Universe region uses a Random instance seeded from the requested ID for its name and drop decisions.

The design target is deterministic lookup: the same object ID under the same frozen content and code revision produces the same observable object. This must become a golden/property-tested contract; do not claim it is already validated across the full index space.

Special anchor positions, region boundaries, names, colors, skins, values, and drops are all compatibility-critical. Preserve the original JavaScript and Decimal operation order during extraction.

## Rendering

The reference loads Images/stone_new.png as a layered spritesheet. Scripts/main.js draws a 256 × 224 mask region per layer, colors it, and composites using Canvas operations including multiply, destination-in, and source-over. Mine objects select a skin and color list rather than owning a unique sprite each.

**Project decision:** use Canvas 2D for mine-object rendering, with DOM/CSS for the rest of the UI, unless measured compatibility evidence requires another approach.

## Oracle probes

Reference questions should accept explicit IDs and return a structured record containing at least: ID, name, HP, defense, value, skin, colors, drops, and source revision. Probe fixed boundaries and representative generated indices, including immediately before and after each anchor and at large IDs.

Do not edit the upstream reference to add a probe. Use a separate derived copy or external browser instrumentation if the original page cannot be queried safely.
