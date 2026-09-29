# Phase 6 — Saves and offline behavior

Status: Planned after Phase 1. Current-save decoding, field application, pure offline-load orchestration, and the strict Beyond v1 JSON schema/round-trip are established prerequisites. Legacy-to-v1 conversion, future schema migrations, storage, and recovery remain future work.

## Outcome

Import legacy Remix saves into a versioned Beyond format, preserve recovery options, and reproduce offline behavior behind injected time.

## Entry evidence

Legacy fields, encodings, defaults, missing fields, and offline caps are partially fixture-backed. Beyond's v1 state envelope round-trips every current application field and validates persisted Decimal strings.

## Validation

Legacy conversion, schema round-trip, future migrations, malformed/corrupt inputs, storage recovery, clock boundaries, and reference output comparisons.
