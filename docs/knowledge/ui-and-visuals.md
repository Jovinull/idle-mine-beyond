# UI, themes, and interaction behavior

## Visual authority

The desktop Remix UI is the initial visual oracle. Before changing Beyond UI during parity, inspect the pinned index.html, main.css, theme CSS, assets, fonts, and live reference. Use actual screenshots and computed styles where useful. Never infer a redesign from the age of the original.

## Source-observed structure

The reference UI includes Money, Gems, conditional Planet Coins, object name and stats, pickaxe name/P/Q/damage, damage-per-click and per-second stats, money/gem/Planet Coin rates, upgrades, crafting, story, and settings. The CSS uses an 8vh / 84vh / 8vh page grid and a 45vw main split. These values are source observations, not a claim that all responsive states have been captured.

The default appearance is a light, sparse browser game. The source includes Work Sans and Montserrat font files and a separate dark theme. Preserve original spacing, color groupings, hierarchy, and native-feeling controls as they are verified.

## Interaction

The reference includes previous/next object navigation, active mining, upgrade purchases, crafting, tabs for story and settings, manual save/export/import, theme selection, number format selection, and Shift-modified bulk crafting. Index content also advertises modifier keys for bulk upgrades. Capture exact keyboard behavior and focus/disabled states from source and runtime before porting.

## Viewports and states

Future screenshot baselines should include 1366×768, 1440×900, 1920×1080, and 2560×1440, with light and dark themes. Cover initial state, gems, Planet Coin upgrades, Wisdom, story, settings, large values, long generated names, and disabled controls. Save fixtures or deterministic state injection should drive each capture.

## Mobile

No authoritative modern mobile Remix layout has been identified. During compatibility, preserve the same systems, content, state, UI hierarchy, and visual identity. A dedicated ergonomic mobile redesign is post-parity unless recorded as an accepted exception.

## Visual improvement ideas

Do not add generic dashboard patterns, glass effects, decorative gradients, oversized rounded cards, or unrelated visual language during parity. Accessibility improvements must be evaluated for whether they change observable interaction or layout and recorded accordingly.
