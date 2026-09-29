# IP and asset provenance

## Current evidence

The pinned Remix and Remux repositories each contain an MIT license with the notice “Copyright (c) 2023 veprogames.” The Remix HTML describes the game as inspired by Idle Mine by Crovie and credits Crovie for the game concept. It also credits AD Notations for number formats.

This establishes the license notice present in those repositories; it does not establish rights that an upstream author may not have held. Do not make legal conclusions from repository metadata alone.

The original Idle Mine source/license was not identified during bootstrap. The attribution history of the old Android port is uncertain. No upstream source code or artwork is copied into Beyond's product directories.

## Reference material in tests

The initial parity corpus contains normalized runtime outputs for mine objects and default formulas, extracted from the pinned Remix implementation at `0e0f4bf5a9c66e5603cda2ce4bd54213023dae21`. It is derived data, not copied JavaScript or artwork. The fixture identifies the source paths and copyright/license notice; the corresponding full upstream notice is preserved in [idle-mine-remix-MIT.txt](sources/licenses/idle-mine-remix-MIT.txt). The publisher's ability to license any inherited original-game material remains unverified.

The runtime CDN JavaScript response snapshots live only in ignored `.research/`; the tracked manifest records their versions, hashes, and npm license metadata. The snapshots themselves are not bundled assets. `@antimatter-dimensions/notations@1.6.0` is now an explicit product dependency; its upstream MIT license is included in the installed package, and no upstream source or assets were copied into product directories. The short display wrappers were independently implemented from Remix's `Scripts/Define/functions.js` and are golden-tested against the extracted outputs.

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

## Recorded implementation provenance

| Item                                 | Origin                                                                                                                                                                         | Relationship                                                                                         | License/permission                                                                                   | Notice / destination                                                                                |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| AD notation classes                  | `@antimatter-dimensions/notations@1.6.0`, https://github.com/antimatter-dimensions/notations                                                                                   | Unmodified pinned npm dependency, used through its ESM entry                                         | MIT, verified in npm metadata and package archive                                                    | License remains in installed dependency; product use is isolated in `packages/formatting`           |
| Number wrapper behavior              | Remix `Scripts/Define/functions.js` at `0e0f4bf5a9c66e5603cda2ce4bd54213023dae21`                                                                                              | Independently implemented; exact outputs compared to reference fixtures                              | Derived from the MIT-licensed Remix repository; inherited-material rights caveat above still applies | `packages/formatting/src/index.ts`; no source file copied                                           |
| Haha Funny and Nice notation classes | Remix `Scripts/adcommunitynotations.js` at `0e0f4bf5a9c66e5603cda2ce4bd54213023dae21`                                                                                          | Independently implemented because AD Notations 1.6.0 omits both ESM exports; outputs golden-tested   | Derived from the MIT-licensed Remix repository; inherited-material rights caveat above still applies | `packages/formatting/src/haha-funny-notation.ts` and `nice-notation.ts`; upstream source not copied |
| Idle Mine and SI notation classes    | Remix `Scripts/customnotations.js` at `0e0f4bf5a9c66e5603cda2ce4bd54213023dae21`                                                                                               | Independently implemented from the three source classes; full captured browser corpus compared       | Derived from the MIT-licensed Remix repository; inherited-material rights caveat above still applies | `packages/formatting/src/remix-custom-notations.ts`; upstream source not copied                     |
| Mine object catalog                  | Remix game/function/dictionary/main scripts at `0e0f4bf5a9c66e5603cda2ce4bd54213023dae21`                                                                                      | 72 base records, 78 anchors, skin counts, and 498 words extracted from controlled runtime capture    | Derived data from the MIT-licensed Remix repository; inherited-material rights caveat applies        | `packages/content/src/remix-mine-content.json`; source SHA/files/notice embedded                    |
| Mining damage and rate formulas      | Remix `Scripts/Define/functions.js`, `Scripts/Define/game.js`, `Scripts/upgrade.js`, `Scripts/pickaxe.js`, and `Scripts/main.js` at `0e0f4bf5a9c66e5603cda2ce4bd54213023dae21` | Independently implemented against four controlled runtime configurations and a target-argument probe | Derived from the MIT-licensed Remix repository; inherited-material rights caveat above still applies | `packages/core/src/mining-rates.ts`; source code not copied                                         |

## Mine object catalog

`packages/content/src/remix-mine-content.json` is derived from the pinned Remix runtime capture: 72 base object definitions, 78 special anchors, `SKIN_LAYER_AMOUNTS`, and the 498-word `DICTIONARY_ENGLISH` table. Its embedded source metadata records commit `0e0f4bf5a9c66e5603cda2ce4bd54213023dae21`, source files, and the upstream MIT notice. `pnpm content:sync` reconstructs the tracked data file from the oracle fixture. This is a deliberate content port for compatibility; no upstream game code or artwork was copied.

## Mining formula implementation

`packages/core/src/mining-rates.ts` independently expresses the pinned active/idle damage and resource-rate equations. The input multiplier values come from controlled browser capture; no Remix source function was copied. The four input/output cases and current-object argument probe are stored in `formulaSemantics` in the reference corpus.
