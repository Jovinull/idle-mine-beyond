# Roadmap

The roadmap is ordered around evidence first and implementation second. Phase completion requires documentation and parity-matrix updates. Full gameplay and UI phases remain ahead; source-backed standalone slices do not mean a phase is complete.

| Phase                                   | Outcome                                                                                    | Gate                                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| 0. Foundation and reference archaeology | Freeze source, document behavior, create probe/fixture workflow, audit provenance          | Bootstrap foundation is present; systematic extraction remains open |
| 1. Deterministic core                   | Platform-independent state transition, clock/RNG interfaces, big-number facade, core tests | Reference fixtures cover each implemented rule                      |
| 2. Content extraction                   | Fixed/special mine objects, upgrades, powers, story, notations as versioned data           | Source tables and fixture comparisons pass                          |
| 3. Crafting compatibility               | Random pickaxe generation, names, replacement, bulk craft, drops                           | Controlled-RNG golden and distribution tests pass                   |
| 4. Progression and resources            | Money, Gems, Planet Coins, Wisdom, Powers, upgrade effects                                 | Formula and state-transition fixtures pass                          |
| 5. Procedural generation                | Same object identity and outputs at stable IDs                                             | Anchor and large-ID reference probes pass                           |
| 6. Saves and offline behavior           | Legacy import, migrations, backup/recovery, offline semantics                              | Save fixtures and controlled-clock parity pass                      |
| 7. Desktop UI parity                    | Source-faithful DOM/CSS, Canvas rendering, interactions                                    | E2E and representative state behavior pass                          |
| 8. Visual certification                 | Fixed viewport/theme/state screenshot comparisons                                          | Visual review passes; exceptions documented                         |
| 9. Native packaging                     | Tauri adapters and platform packaging                                                      | Supported platform builds and storage behaviors pass                |
| 10. Parity certification                | All applicable matrix rows complete with evidence                                          | Reviewed parity-v1 tag                                              |
| Beyond era                              | Approved post-parity proposals and new content                                             | Starts only after parity-v1                                         |

## Current recommended action

Phase 0 established the pinned reference and parity harness; Phase 1 is now active. Tested slices cover mine objects, notations, upgrades, mining transitions, Story state, standalone Story rendering, pickaxe craft transactions, fresh state, versioned storage, legacy migration, v1 offline reload, and a serialized browser session coordinator for startup/actions/save effects. The Svelte route now connects the session to Mining, Story, upgrade-shop, and crafting controls. Next finish Settings/Powers and save management, add source-backed controlled states and viewport fixtures, and implement the native persistence adapter.

## Platform targets

Long-term targets include static browser/PWA distribution, Tauri desktop on Windows/macOS/Linux, and Tauri mobile on Android/iOS. Platform-specific distribution adapters for Steam, CrazyGames, Kongregate, itch.io, Galaxy, Newgrounds, and stores are later release work. Their current availability and rules must be researched when a release is planned.

Prestige is not assumed. The Remix developer's historical design discussion and current source behavior must be inspected before any such proposal.
