# Idle Mine Beyond knowledge base

This directory is the canonical durable project memory. Keep research, decisions, open questions, and parity status here so work does not depend on chat history.

## Start here

| Need                                               | Canonical document                                                                                                                                                            |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mission, project phase, and boundaries             | [Project charter](charter.md), [Project status](project-status.md)                                                                                                            |
| Names, mechanics, and project terminology          | [Terminology](terminology.md), [Project lineage](lineage.md)                                                                                                                  |
| Which evidence wins and how deviations are handled | [Parity contract](parity-contract.md), [Behavioral exceptions](BEHAVIORAL_EXCEPTIONS.md)                                                                                      |
| Current source revisions and provenance            | [Reference manifest](sources/reference-manifest.json), [Source register](sources/README.md)                                                                                   |
| Gameplay behavior and systems                      | [Game systems](game-systems.md), [Mathematics](mathematics.md), [Pickaxe crafting](pickaxe-crafting.md), [Procedural generation](procedural-generation.md), [Story](story.md) |
| UI, saves, time, and platform boundaries           | [UI and visuals](ui-and-visuals.md), [Save and offline behavior](save-time-offline.md), [Architecture](architecture.md)                                                       |
| Reference source architecture                      | [Remix reference architecture](remix-reference-architecture.md)                                                                                                               |
| Validation and compatibility status                | [Testing and parity](testing-and-parity.md), [Parity matrix](PARITY_MATRIX.md), [Legacy quirks](legacy-quirks.md)                                                             |
| Community critiques and future work                | [Criticisms and reports](criticisms-and-reports.md), [Post-parity backlog](POST_PARITY_BACKLOG.md), [Roadmap](roadmap.md)                                                     |
| Research and Codex workflows                       | [Research workflow](research-workflow.md), [Codex workflow](codex-workflow.md), [IP provenance](ip-provenance.md)                                                             |
| Major decisions and bootstrap input trace          | [Decision log](decisions/README.md), [Bootstrap assimilation](bootstrap-assimilation.md)                                                                                      |

## Evidence labels

- **Verified legacy behavior** means the pinned Remix source or runtime has been inspected. Cite the exact source or observation. A source-level observation does not automatically prove how it behaves in every browser.
- **Project decision** means a rule intentionally established for Idle Mine Beyond.
- **Hypothesis / uncertain** means verification is still required. Do not implement it as fact.
- **Known legacy defect** means a defect is reported or evidenced in the original. Separate observed code from player-visible runtime impact.
- **Post-parity proposal** means an idea is held for after the compatibility milestone.

The current parity target is the frozen Remix repository revision in the manifest. Its local clone belongs under the ignored .research workspace. No upstream material is copied into product directories by bootstrap.

## Update rule

When work changes behavior understanding, architecture, parity status, source research, project status, or a major decision, update the relevant document in the same unit of work. Update the parity matrix only when evidence and validation support the status change.
