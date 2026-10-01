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

Phase 1 remains active. First finish the natural Remix route to first Chapter 6 eligibility, replay the entire recorded route in Beyond from the Chapter 5 route start with the same seed, compare complete state and RNG at every checkpoint, and capture one light 1440x900 screen. For Chapters 7 to 9, use pinned Remix saves at the start of Space, Wisdom/stars, and galaxies; replay a few thousand actions from each save in Beyond and compare complete normalized state and RNG after each action. Add differential tests for representative captured states and reproducible randomized action sequences with fixed seeds; do not replay those phases from a new game. Next, compare the upgrades shop, Powers, and representative Mining states at 1440x900, then compare only primary screens (Mining, Story, and Settings) at 1366x768, 1920x1080, and 2560x1440. After those prioritized visuals, continue procedural probes above object ID 768 and capture gameplay-derived long-running saves. Defer the running Tauri WebView save/reload validation until native packaging.

## Platform targets

Long-term targets include static browser/PWA distribution, Tauri desktop on Windows/macOS/Linux, and Tauri mobile on Android/iOS. Platform-specific distribution adapters for Steam, CrazyGames, Kongregate, itch.io, Galaxy, Newgrounds, and stores are later release work. Their current availability and rules must be researched when a release is planned.

Prestige is not assumed. The Remix developer's historical design discussion and current source behavior must be inspected before any such proposal.
