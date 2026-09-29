# Research workflow

## Evidence order

Use the exact hierarchy in [project lineage](lineage.md). Source/runtime observations outrank community summaries. If claims conflict, preserve both accounts and record what remains uncertain.

## Claim classification

- **Verified legacy behavior** — tied to exact source file/commit or a repeatable runtime observation.
- **Project decision** — an intentional Beyond rule.
- **Hypothesis / uncertain** — waiting for a probe, source read, or corroborating evidence.
- **Known legacy defect** — evidence of a fault, with code-level and player-visible evidence distinguished.
- **Post-parity proposal** — backlog only, not implementation permission.

## Frozen local research

Run:

```sh
pnpm research:setup
pnpm research:check
```

The setup command creates missing checkouts at the commits in the manifest. It never fetches, resets, pulls, or edits an existing reference checkout. Existing commit, URL, dirtiness, or version mismatches are reported and require deliberate investigation. Research can be recreated because repository URLs, commit hashes, licenses, and roles are tracked.

The entire .research directory is disposable and git-ignored. Keep only project-authored fixtures, observations, and provenance in tracked documentation or tests. Never copy upstream code/assets into product directories casually.

## Reference probe record

Every probe should record:

- Question and source hierarchy level.
- Repository URL and pinned SHA, or live URL.
- Exact source path/function or browser steps.
- Input state/save and controlled clock/RNG when available.
- Output fields and serialization/precision.
- Date, browser/runtime, and viewport for visual/live results.
- Evidence class, confidence, and unresolved conflicts.

## Reference integrity

Never modify the canonical clone. For any required instrumentation, create a separate derived working copy, identify its base SHA, and keep the unmodified checkout available for comparison.

## Documentation

Put general mechanics in gameplay documents, source metadata in the manifest/register, unresolved details in the relevant document as hypotheses, and accepted deviations only in the exceptions log. Add focused fixture files rather than copying a whole upstream project.

## Source discovery finding

The bootstrap identified the two first-party VeproGames repositories in the manifest and the public Remix deployment. It did not identify a first-party Crovie source repository. This is a bounded search result, not proof that none exists.
