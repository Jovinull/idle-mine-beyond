# Phase 3 — Crafting compatibility

Status: In progress.

## Outcome

Reproduce Remix gem consumption, random rolls, names, expertise bonuses, bulk craft, dud messages, and strict replacement behavior.

## Entry evidence

The complete source path and RNG call order are recorded; controlled random sequences and reference samples are available.

## Completed slice

The independent candidate generator and pure craft transaction now match controlled source snapshots for RNG ordering, minimum/average previews, Gem subtraction/rounding, Shift bulk count, strict damage replacement, dud outcomes, feedback order, and save effects. See [pickaxe-crafting.md](../knowledge/pickaxe-crafting.md), `pickaxeCraftingSemantics`, and the pickaxe rows in the parity matrix.

## Remaining work

Capture and justify repeated-sample distribution comparisons, inspect additional upgrade/name boundaries, wire events to the future application/persistence adapters, and add player-facing crafting interaction/E2E coverage. Do not call this phase complete until its parity-matrix evidence is satisfied.

## Validation

Exact deterministic fixtures, boundary cases, and justified statistical distribution checks. Do not use Remux output as expected data.
