# Phase 1 — Parity-depth follow-up

Status: Completed on 2026-10-01. The sampled high-ID generator outputs and four gameplay-generated route-end save imports pass their focused comparisons. The limits below remain open.

## Outcome

Extend procedural object evidence beyond the dense corpus and validate that long gameplay-generated Remix saves can be imported, represented as Beyond v1, and restored without losing modeled state.

## Work completed

- Added 23 source probes across immediate post-dense, 1k/10k/2^20, signed and unsigned 32-bit, and safe-integer precision boundaries. The corpus now has 792 object outputs: 769 dense IDs plus 23 high probes.
- Added a parity test for the existing source `getSaveString()` captures at the natural Chapter 3, 4, 5, and 6 route endpoints. Each full legacy save is decoded with the pinned wrapper, loaded through the compatibility path, checked against captured progression state, re-exported with exact full-object and encoded-string matches, then serialized and restored as Beyond v1. The test carries the source session's current tab, craft selector, and message log because Remix `loadGame()` does not restore all those selections from saved fields.
- Updated the procedural/save knowledge, parity matrix, phase plans, project status, and testing guidance with what this evidence establishes and what remains unverified.
- Preserved the merged Linux Story baselines without editing `tests/e2e/story-visual.spec.ts` or `tests/parity/visual-baselines.test.ts`. In `docs/knowledge/testing-and-parity.md`, updated stale prose to match those existing Linux captures and appended the save-test scope without changing screenshot metadata.

## Validation

- `pnpm.cmd research:check`
- `node scripts/reference-probe.mjs verify`
- `pnpm.cmd exec vitest run --project parity tests/parity/mine-object-generation.test.ts`
- `pnpm.cmd exec playwright test tests/e2e/foundation.spec.ts --grep "generates the captured mine objects" --workers=1 --reporter=line`
- `pnpm.cmd exec vitest run --project parity tests/parity/long-running-save-roundtrip.test.ts`

## Remaining limits

The 23 high-ID outputs are selected probes, not exhaustive safe-integer coverage. Natural Chapter 3–6 endpoint saves now match the full source JSON and exact encoded string under the captured session selections, then pass Beyond-v1 round-trip checks; historical save formats and all long-run resource/timer combinations remain open. Chapters 7–9 remain controlled phase-start action segments rather than natural progression claims. Tauri WebView save/reload stays deferred until native packaging.
