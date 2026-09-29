# Project rules

- Mission: reproduce final Idle Mine: Remix player-visible behavior before proposing improvements. The governing phrase is **IDENTICAL FIRST. BETTER SECOND.**
- Remix at the pinned revision in `docs/knowledge/sources/reference-manifest.json` is canonical. Original Idle Mine is lineage only; `idle-mine-remux` is prior art only.
- Inspect canonical source/runtime and record evidence before inventing or changing behavior. Do not redesign, rebalance, simplify mechanics, or silently fix legacy quirks during parity. Default behavioral exceptions: none.
- `.research/` contains disposable, read-only canonical reference checkouts. Never edit them or copy code/assets into product directories without provenance review.
- Keep simulation code platform-independent. RNG, time, persistence, and platform capabilities cross explicit injected boundaries; game-domain code must not call `Math.random()`, `Date.now()`, browser storage, DOM, Canvas, or platform APIs directly.
- The random pickaxe crafting behavior and deterministic procedural object identity are compatibility-critical.
- Use the workflow `REFERENCE → EXTRACT BEHAVIOR → CREATE FIXTURE/TEST → IMPLEMENT → COMPARE → DOCUMENT → COMMIT`.
- Update canonical docs and `docs/knowledge/PARITY_MATRIX.md` when evidence, architecture, behavior, or parity status changes. A task that requires a material knowledge update is incomplete without it.
- Run relevant validation before claiming completion or committing. Use concise English Conventional Commit subjects only; no bodies by default, coauthor trailers, AI attribution, or force pushes.
- Do not implement gameplay until the reference/parity foundation is ready. Keep post-parity proposals in `docs/knowledge/POST_PARITY_BACKLOG.md`.

Start with `docs/knowledge/README.md`, `project-status.md`, and the applicable focused docs. Large work follows `PLANS.md`.
