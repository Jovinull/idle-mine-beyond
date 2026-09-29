---
name: idle-mine-visual-qa
description: Compare a controlled Idle Mine Remix screen with Beyond using fixed state, viewport, browser, screenshots, and rendered styles.
---

# Visual parity workflow

1. Read `docs/knowledge/ui-and-visuals.md`, `testing-and-parity.md`, and `PARITY_MATRIX.md`.
2. Inspect reference HTML, CSS, assets, and the actual runtime before changing presentation.
3. Record the reference URL/commit, save or state, theme, browser, viewport, and interaction sequence. Use the standard desktop viewports and themes documented in the visual test guide.
4. Capture reference and Beyond screenshots with Playwright; inspect DOM, computed styles, and console/runtime behavior with Chrome DevTools when it clarifies a difference.
5. Compare layout, pixels, typography, assets, and input feedback. Fix only source-backed discrepancies; do not redesign during parity.
6. Store approved baselines with provenance, update the matrix, and document exceptions before intentional deviations.

See `docs/knowledge/BEHAVIORAL_EXCEPTIONS.md`; mobile UX redesign is post-parity unless approved there.
