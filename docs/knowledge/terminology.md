# Terminology

| Term                 | Meaning in this project                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Idle Mine            | Crovie’s original Flash game; historical lineage only. The dossier dates it to 2013, but bootstrap did not independently verify that year. |
| Remix                | Idle Mine: Remix, the canonical behavioral compatibility target.                                                                           |
| Remux                | idle-mine-remux, an archived partial rewrite and prior art only.                                                                           |
| Beyond               | This repository and, after parity-v1, any explicitly approved post-parity additions.                                                       |
| Mine object          | A breakable object in the Remix mine; source code and UI sometimes call it a mineral or ore even for non-mineral objects.                  |
| Pickaxe              | A procedurally crafted tool with name, power, quality, and damage derived from power × quality.                                            |
| Dud                  | A crafted pickaxe that does not exceed the current pickaxe damage and therefore does not replace it.                                       |
| Fixed object         | An object explicitly defined in Remix content.                                                                                             |
| Special object       | A fixed object anchored at an explicit object index among generated regions.                                                               |
| Procedural object    | An object generated from an index and the relevant preceding fixed anchor.                                                                 |
| Power                | A late-game Wisdom system value; distinguish it from pickaxe power and damage.                                                             |
| Planet Coin / PC     | A later-game currency and upgrade family. Use “Planet Coins” in player-facing text when matching source UI.                                |
| Golden fixture       | A versioned input/output sample extracted from the canonical reference for comparison.                                                     |
| Oracle / probe       | A repeatable way to query the unmodified Remix implementation for an output.                                                               |
| Behavioral exception | An intentional player-visible deviation documented and accepted under the exceptions policy.                                               |
| parity-v1            | Proposed tag for the completed, tested compatibility baseline. It does not exist yet.                                                      |
| Evidence class       | One of verified legacy behavior, project decision, hypothesis/uncertain, known legacy defect, or post-parity proposal.                     |

## Naming rule

Use the spelling and capitalization shown by the pinned Remix source or UI for content. Keep internal names separate from presentation labels when required for compatibility.
