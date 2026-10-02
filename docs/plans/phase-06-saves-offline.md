# Phase 6 — Saves and offline behavior

Status: Planned after Phase 1. Current-save decoding, field application, legacy migration, Beyond v1 storage/recovery, and v1 offline-load coordination are implemented prerequisites. On 2026-10-01, four genuine natural Chapter 3–6 route-end saves and all sixteen captured malformed field-application outcomes were added to the compatibility test surface. On 2026-10-02, exact source error names/messages, partial state/effects, and the Settings no-write import behavior passed the integrated validation suite. Native WebView runtime validation and future schema migrations remain future work.

## Outcome

Import legacy Remix saves into a versioned Beyond format, preserve recovery options, and reproduce offline behavior behind injected time.

## Entry evidence

Legacy fields, encodings, defaults, missing fields, offline caps, and sixteen partial malformed-load states are fixture-backed. Captured legacy import and Beyond v1 reload use the pinned offline outcome/effect-order fixture; schema validation, backup retention, invalid-primary recovery, unknown-version refusal, and the manual-import no-write boundary after field failure are tested.

## Validation

Full legacy compatibility, schema round-trip, future migrations, broader malformed codec/recovery cases, native storage recovery, UI import/export, clock boundaries, and reference output comparisons. The Chapter 3–6 route-end cases compare the full source JSON and exact legacy encoded string after import, then exercise Beyond v1 serialization/restore under the captured session selections. Historical save formats and other long-run state combinations remain open; only add historical migrations when attributable source/save evidence exists.
