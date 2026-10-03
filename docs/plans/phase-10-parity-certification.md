# Phase 10 — Parity certification

Status: Gate defined; first-pass source-to-test inventories cover all 36 matrix areas. Random distributions and RNG is Certified under the qualified-sample rule. The release and all player-facing parity areas remain uncertified.

## Outcome

Certify the complete applicable web compatibility matrix and create the reviewed
`parity-v1` tag. Native packaging, native storage, and a running Tauri WebView are
explicitly outside this web tag.

## Required gates

- Every web-v1 matrix area has a source-to-test map that lists each relevant
  pinned Remix function and branch, the source fixture and assertion covering
  it, or a named open gap. There are no open branch gaps at certification.
- Every in-scope branch is covered by a source-backed assertion. Do not certify
  from code presence, argument, a sample alone, or a visually similar state.
  A non-exhaustive formula/RNG domain is acceptable when all relevant source
  boundaries, an additional fixed-seed sample, and a no-divergence full-state/
  RNG differential pass. A missing boundary remains a gap; qualified sampling
  does not conceal an uncovered control-flow branch.
- Required unit/property, differential/golden, web E2E, and visual evidence for
  each applicable matrix row passes. All intentional visible differences have
  approved entries in `docs/knowledge/BEHAVIORAL_EXCEPTIONS.md`; the default is
  still no exceptions.
- Run and record the documented web validation suite against the frozen Remix
  commit. Confirm pinned source checkouts and fixture hashes before tagging.
- Update `PARITY_MATRIX.md`, source-to-test traceability, and `project-status.md`
  together. Have the parity-v1 scope reviewed before creating the tag.

## Explicit exclusions

- Matrix rows `Native save adapter` and `Native packaging and platforms` are
  **Out of web-v1 scope**. Their foundation tests are not native parity evidence.
- Tauri WebView save/reload, native persistence, and native platform packaging
  remain for the separate native milestone.
- No Beyond-only gameplay feature or post-parity proposal is included in this
  tag.
