---
name: idle-mine-save-compat
description: Extract, validate, import, migrate, round-trip, and recover legacy Idle Mine Remix saves using evidence-backed fixtures.
---

# Legacy save compatibility workflow

1. Read `docs/knowledge/save-time-offline.md`, `architecture.md`, `testing-and-parity.md`, and the save-related matrix rows.
2. Trace the pinned Remix encode/decode, storage keys, reset path, timestamps, and load/error behavior before defining a Beyond schema.
3. Create provenance-recorded minimized fixtures for valid, boundary, malformed, and recoverable inputs. Avoid committing personal or upstream player saves without provenance review.
4. Implement parsing, validation, migration, and serialization without coupling the domain package to browser or filesystem storage.
5. Test import, deterministic round-trip, migration, integrity failure, backup/recovery, and offline-time semantics against the reference.
6. Update save documentation and parity rows only when tests and evidence support the claim.
