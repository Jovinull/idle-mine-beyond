---
name: idle-mine-reference-probe
description: Query the pinned Idle Mine Remix implementation for exact formulas, objects, saves, crafting, or upgrade outcomes without changing the oracle.
---

# Reference probe workflow

1. Read `docs/knowledge/sources/README.md`, `research-workflow.md`, `legacy-quirks.md`, and the relevant focused system document.
2. Verify `.research/upstream/idle-mine-remix` matches the manifest pin with `pnpm research:check`.
3. Trace the question to source and, where useful, exercise a clean runtime state using browser tools. Record input, RNG/clock conditions, browser, viewport, and observed output.
4. Keep the canonical checkout untouched. Place temporary probes under ignored `.research/experiments/`; use a derived copy only when source instrumentation is necessary.
5. Save durable answers as labeled, source-linked docs or fixtures under `tests/fixtures/parity/`. Mark unknown details as hypotheses.

The final Remix source/runtime outranks wiki reports and all Remux behavior. See `docs/knowledge/parity-contract.md`.
