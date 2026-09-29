# Phase 7 — Desktop UI parity

Status: Story reference capture, source-template narrative renderer, and mine-object Canvas renderer are implemented as isolated browser-tested slices; the app-level UI is not started.

## Outcome

Reproduce the Remix desktop layout, style, states, interaction, and mine-object rendering using the completed simulation.

## Entry evidence

An initial Story source capture exists for a fresh save and all nine unlocked chapter pages at 1440×900, including computed styles; exploratory screenshots for chapters 1 and 9 are ignored under `.research/outputs/story-runtime/`. This is a starting slice only. Required states, themes, viewports, and Beyond comparisons remain open before desktop parity can be certified.

The standalone Story panel is compared with captured chapter headings and block order for a fresh state and all nine fully unlocked pages. Its source images/fonts and Story CSS subset are provenance-recorded. This establishes a renderer slice, not a full game layout, live state/tab/persistence integration, or visual certification.

## Validation

Playwright E2E flows, DOM/accessibility checks, theme coverage, and screenshot comparison. UI code must not own game rules.
