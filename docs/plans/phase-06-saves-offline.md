# Phase 6 — Saves and offline behavior

Status: Planned after Phase 1. Current-save decoding, field application, legacy migration, Beyond v1 storage/recovery, and v1 offline-load coordination are implemented prerequisites. Native storage, app startup/action wiring, UI, and future schema migrations remain future work.

## Outcome

Import legacy Remix saves into a versioned Beyond format, preserve recovery options, and reproduce offline behavior behind injected time.

## Entry evidence

Legacy fields, encodings, defaults, missing fields, and offline caps are partially fixture-backed. Captured legacy import and Beyond v1 reload use the pinned offline outcome/effect-order fixture; schema validation, backup retention, invalid-primary recovery, and unknown-version refusal are tested.

## Validation

Full legacy compatibility, schema round-trip, future migrations, malformed/corrupt inputs, native storage recovery, UI import/export, clock boundaries, and reference output comparisons.
