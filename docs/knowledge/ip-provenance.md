# IP and asset provenance

## Current evidence

The pinned Remix and Remux repositories each contain an MIT license with the notice “Copyright (c) 2023 veprogames.” The Remix HTML describes the game as inspired by Idle Mine by Crovie and credits Crovie for the game concept. It also credits AD Notations for number formats.

This establishes the license notice present in those repositories; it does not establish rights that an upstream author may not have held. Do not make legal conclusions from repository metadata alone.

The original Idle Mine source/license was not identified during bootstrap. The attribution history of the old Android port is uncertain. No upstream source or artwork is copied into tracked product directories during bootstrap.

## Provenance ledger for future derived work

| Field               | Required information                                                |
| ------------------- | ------------------------------------------------------------------- |
| Item                | Source file, asset, font, text, audio, code, name, or brand         |
| Origin              | Canonical source URL, repository, revision, or creator              |
| Relationship        | Copied, adapted, independently reimplemented, or merely referenced  |
| License/permission  | Exact detected license or written permission; unresolved if unknown |
| Notice              | Required copyright and license notices                              |
| Product destination | Tracked path and distribution surfaces                              |
| Decision            | Reviewer, date, and rationale                                       |

## Specific watch items

- Remix code and assets inherit the repository's MIT notice only to the extent its publisher had rights to license them.
- The original Idle Mine relationship and any original-derived art/text require separate provenance review.
- Fonts and third-party notation libraries should be audited individually before redistribution.
- Names, logos, screenshots, and store branding are not automatically cleared by the source-code license.

## Distribution gate

Before public or commercial release, review the provenance ledger and license obligations with the appropriate rights holder or qualified counsel. Keep this as an evidence workflow, not an assertion that publication is legally cleared.
