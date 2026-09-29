---
name: idle-mine-parity
description: Research, implement, compare, and document one source-backed Idle Mine Remix behavior while preserving compatibility.
---

# Idle Mine parity workflow

1. Read `docs/knowledge/parity-contract.md`, `testing-and-parity.md`, the relevant system document, and the current matrix row.
2. Inspect the pinned Remix checkout named in the source manifest. Record exact source paths and runtime observations; do not infer behavior from Remux.
3. Create or update a minimized fixture and failing compatibility test before implementation.
4. Implement only the evidenced behavior behind the platform-independent boundary.
5. Run focused and project checks, compare expected outputs, and report any unresolved uncertainty.
6. Update canonical docs, the parity matrix, and project status when their state changes.
7. Commit a coherent validated unit with a subject-only Conventional Commit.

Behavioral exceptions require `docs/knowledge/BEHAVIORAL_EXCEPTIONS.md`; default is none.
