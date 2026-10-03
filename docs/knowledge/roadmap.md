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
| 10. Web parity certification            | Every applicable web matrix path has source-backed coverage and review                     | Reviewed `parity-v1` tag; native rows explicitly excluded           |
| 9. Native packaging (post-v1)           | Tauri adapters and platform packaging                                                      | Separate supported-platform builds and storage validation           |
| Beyond era                              | Approved post-parity proposals and new content                                             | Starts only after parity-v1                                         |

## Current recommended action

Phase 1 remains active. All 36 parity-matrix areas have function/branch inventories linked to pinned Remix fixtures and assertions. The source-to-test checker permits non-exhaustive formula/RNG domains after their relevant boundaries, fixed-seed samples, and no-divergence full-state/RNG differential pass; it does not treat qualified sampling as a certification blocker. Random distributions and RNG is the first Certified matrix area. Procedural mine objects are Certified: existing source captures and region boundaries are qualified, and four browser cases cover the three generation regions plus ID 769 through Beyond save restore and Canvas rendering. The separate Mine rendering row remains In progress for pixel-level skin/color parity. One uncovered path was closed with 119 focused pickaxe quality-name boundary crafts; exact equality outcomes are compared in Chromium because Math.log differs at a threshold between pinned Chromium and Node. Keep avoiding arbitrary probes; add source cases only for a named uncovered path or boundary. Eight captured natural route segments through Chapter 6 compare 3,833,896 complete simulation-state/RNG checkpoints. Each controlled Chapter 7-9 phase save has three paired game-RNG/action-sequence seeds, with 10,000 actions per pair; nine traces compare state/RNG after each of 90,000 actions. These are controlled segments, not natural progression claims. Existing selected shop/Powers/Mining and viewport screenshot comparisons remain documented in Phase 8. parity-v1 targets the web build only; native packaging, native storage, and WebView validation are separate post-v1 work. Historical save migration and untested visual/save state domains remain evidence-gated.

## Platform targets

Long-term targets include static browser/PWA distribution, Tauri desktop on Windows/macOS/Linux, and Tauri mobile on Android/iOS. Platform-specific distribution adapters for Steam, CrazyGames, Kongregate, itch.io, Galaxy, Newgrounds, and stores are later release work. Their current availability and rules must be researched when a release is planned.

Prestige is not assumed. The Remix developer's historical design discussion and current source behavior must be inspected before any such proposal.
