# Phase 6 — Saves and offline behavior

Status: Planned after Phase 1. Current-save decoding, field application, pure offline-load orchestration, the strict Beyond v1 schema, legacy migration, and a backup-aware browser storage adapter are established prerequisites. Native storage, app wiring, UI, and future schema migrations remain future work.

## Outcome

Import legacy Remix saves into a versioned Beyond format, preserve recovery options, and reproduce offline behavior behind injected time.

## Entry evidence

Legacy fields, encodings, defaults, missing fields, and offline caps are partially fixture-backed. A captured offline load migrates into Beyond v1 with the source effect order; schema validation, backup retention, invalid-primary recovery, and unknown-version refusal are tested.

## Validation

Full legacy compatibility, schema round-trip, future migrations, malformed/corrupt inputs, native storage recovery, UI import/export, clock boundaries, and reference output comparisons.
