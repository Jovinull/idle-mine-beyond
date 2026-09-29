# ADR 0004: Frozen research references

- Status: Accepted
- Date: 2026-09-28

## Decision

Keep the canonical Remix and Remux repositories in ignored .research/upstream checkouts, pinned by tracked manifest SHAs. Treat both clones as read-only, with Remux further restricted to prior art.

## Reason

The main repository should retain traceable source identity without storing upstream code/assets in its own history. A disposable local workspace can be recreated from the manifest and script.

## Consequences

Setup may clone a missing repository at its pinned SHA. Existing checkouts are checked, never fetched/reset/modified automatically. Product changes require separate provenance records.
