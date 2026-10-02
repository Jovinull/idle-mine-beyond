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

Phase 1 remains active. The natural Chapter 5-to-Chapter 6 Remix route is captured, replayed in Beyond against 3,751,241 complete state/RNG checkpoints, and visually matched at zero pixels in light 1440x900 on Windows. Chapters 7-9 use controlled Remix phase-start saves (Space/Hyperplanets, Wisdom/stars, and the first galaxy objective) with 3,000 reproducible source actions each; Beyond matches full state and RNG at all 9,000 checkpoints. These are phase-start differential tests, not fresh-game routes or natural-path certifications. The upgrade shop, Powers, and three representative Mining states now match at 1440x900 in both themes; primary Mining, Story, and Settings screens match in both themes at 1366x768, 1920x1080, and 2560x1440. The 2026-10-01 Phase 1 follow-up added 23 selected object probes above ID 768 and tests four natural Chapter 3–6 route-end saves through legacy import, byte-exact legacy re-export, and Beyond v1 restore with captured session selections. Next broaden malformed/recovery/historical save evidence and sampled object differential coverage; procedural coverage remains explicitly sampled. Defer running Tauri WebView save/reload validation until native packaging.

## Platform targets

Long-term targets include static browser/PWA distribution, Tauri desktop on Windows/macOS/Linux, and Tauri mobile on Android/iOS. Platform-specific distribution adapters for Steam, CrazyGames, Kongregate, itch.io, Galaxy, Newgrounds, and stores are later release work. Their current availability and rules must be researched when a release is planned.

Prestige is not assumed. The Remix developer's historical design discussion and current source behavior must be inspected before any such proposal.
