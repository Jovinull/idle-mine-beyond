# Phase 7 — Desktop UI parity

Status: In progress. The web app now connects source-backed Mining, Story,
upgrades, Powers, and Settings interfaces to the simulation and browser
adapters. Desktop parity remains incomplete; selected screenshots and controls
do not certify unselected player states.

## Outcome

Reproduce the pinned Remix desktop layout, style, state, interaction, theme, and
mine-object rendering while keeping game rules in platform-independent
packages.

## Current evidence

- `apps/web/src/routes/+page.svelte` composes the game shell and routes live
  simulation state and input to Mining, Story, the upgrade shop, Powers, and
  Settings. The core remains behind the platform adapter.
- Story uses source-captured markup, objective predicates, styles, and image
  assets. Its browser coverage checks all 61 conditions, notification/high-water
  behavior, selected natural routes through Chapter 6, and all 48 preview
  occurrences. Nine all-unlocked chapter pages match at zero pixels in both
  themes at 1440x900.
- The mine Canvas renderer matches the 920 captured object outputs. Selected
  upgrade, Powers, Mining, Story, and Settings screens have 1440x900 evidence;
  primary screens also have selected comparisons at 1366x768, 1920x1080, and
  2560x1440.
- Current visual evidence and exact open states are tracked in [Phase 8](phase-08-visual-certification.md),
  the [parity matrix](../knowledge/PARITY_MATRIX.md), and
  [project status](../knowledge/project-status.md). The strict full-screen shop
  differential has intermittent pixel mismatches and remains open. Other
  application states and combinations of resource balance, progression,
  viewport, and theme are not exhaustively certified.
- Settings now has a source-paired full-screen test for changed notation,
  checked preferences, dark theme, manual save, and exported text at 1440x900.
  The dark Settings controls match Remix `#636363`; other Settings and recovery
  states remain open.

## Validation

Use `pnpm test:e2e` for the default browser suite and `pnpm test:e2e:slow` for
the source-paired long shop and cap differentials. Run `pnpm test:reference` to
verify pinned captures, Story, mine-object, and priority visual fixtures. For a
visual change, run its focused Playwright spec and preserve exact pixel checks;
do not regenerate source baselines without reviewed source/runtime evidence.
Update Phase 8, the applicable matrix rows, and project status when evidence or
parity status changes.
