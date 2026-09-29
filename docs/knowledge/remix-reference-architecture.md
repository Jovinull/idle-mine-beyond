# Remix reference implementation architecture

This document describes the pinned upstream implementation. It is distinct from Beyond's selected architecture in [architecture.md](architecture.md).

## Verified source structure

At commit `0e0f4bf5a9c66e5603cda2ce4bd54213023dae21`, Remix is a static HTML/CSS/JavaScript site. `index.html` contains Vue templates and loads Vue 2 from jsDelivr, `break_infinity.js`, AD Notations 1.6.0, and local notation/game scripts. There is no checked-in package/workspace manifest or automated test/build pipeline in this snapshot.

The page owns a large shared `game` object in Vue, while responsibilities are separated across classic scripts:

| Source                           | Responsibility observed in code                                                    |
| -------------------------------- | ---------------------------------------------------------------------------------- |
| `index.html`                     | Player-facing Vue templates and ordered script loading                             |
| `Scripts/Define/game.js`         | Initial game state, fixed content, upgrades, persisted-state shape                 |
| `Scripts/Define/functions.js`    | Player actions, game operations, save/import/export, offline rewards, story checks |
| `Scripts/Define/dictionary.js`   | Display and story text/content mapping                                             |
| `Scripts/pickaxe.js`             | Stochastic crafting calculations and generated names                               |
| `Scripts/mineobject.js`          | Mine object definitions and object behavior                                        |
| `Scripts/random.js`              | Seeded random helper used by deterministic generation paths                        |
| `Scripts/upgrade.js`             | Upgrade structures and calculation helpers                                         |
| `Scripts/main.js`                | Vue setup, notation registration, animation/update loop, canvas rendering          |
| `Scripts/Components/`            | Vue components for objects, upgrades, and powers                                   |
| `main.css`, `Themes/`, `Images/` | Presentation, themes, sprites, and UI assets                                       |

The mine renderer uses a 256×224 cache canvas and composites selected sprite-sheet layers. This describes the current source mechanism, not a requirement to reproduce the same internal rendering technique.

## Architectural implications for compatibility

- Read the actual global state and operation order from the pinned scripts; do not infer rules from filenames or UI labels alone.
- Preserve observable behavior while replacing the Vue/global-state implementation behind platform-independent interfaces.
- Preserve the old Decimal semantics with a compatibility facade and fixtures before choosing a different number library.
- The source directly calls `Math.random()`, `Date.now()`, browser storage, and browser rendering APIs. Beyond will inject RNG/time and put storage/rendering behind adapters.
- The random pickaxe path and seeded object-generation path are different and must not be conflated.
- CDN dependencies and the live deployment can change independently of this repository pin. Record runtime captures separately from source-derived facts.

## Scope and provenance

These findings come from the frozen clone in `.research/upstream/idle-mine-remix/`. See the [reference manifest](sources/reference-manifest.json) and [source register](sources/README.md). The clone remains untouched; no source or asset is copied into Beyond's product directories.
