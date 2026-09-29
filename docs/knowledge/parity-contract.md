# Compatibility contract

## Contract

Before parity-v1, all intended player-visible behavior matches the pinned Remix target as closely as technically possible. This covers simulation results, progression, content, randomness, timing, saves, offline results, number formatting, story, controls, layout, themes, colors, and feedback.

Internal code may be modernized when the change does not alter observable behavior. No agent may silently fix, smooth, rebalance, rename, reorganize, or simplify legacy behavior.

## Research-to-change workflow

**REFERENCE → EXTRACT BEHAVIOR → CREATE FIXTURE / TEST → IMPLEMENT → COMPARE → DOCUMENT → COMMIT**

For a behavior not yet understood:

1. Identify the exact source revision and relevant file or live state.
2. Capture a minimal input, output, and evidence trail.
3. Label the claim with an evidence class and record uncertainty.
4. Add a fixture or test before porting the behavior when practical.
5. Compare Beyond output with the reference.
6. Update the specification, parity matrix, and project status if needed.

## Defaults

- No behavioral exceptions are currently approved.
- A strange result is not evidence that the result is wrong.
- Original Idle Mine history cannot override Remix.
- Remux cannot define Remix behavior.
- Player-facing language should retain original names, jokes, and oddities where source behavior confirms them.
- A redesigned mobile layout is post-parity. Initial mobile work preserves systems, content, state hierarchy, and identity.

## Certification

Do not call parity complete because code exists or a screen looks similar. Every applicable matrix row must have evidence, fixtures, automated checks, and UI/visual verification. The intended completion marker is a reviewed parity-v1 tag after the full matrix is certified.
