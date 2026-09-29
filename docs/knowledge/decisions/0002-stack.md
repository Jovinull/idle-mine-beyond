# ADR 0002: Web and native stack

- Status: Accepted for bootstrap; review on major upgrades
- Date: 2026-09-28

## Decision

Use strict TypeScript, Svelte 5, SvelteKit 2, Vite, pnpm, static SPA output, Tauri 2, DOM/CSS, and Canvas 2D. Rust is limited to native integration. Use Vitest, fast-check, Playwright, Zod where useful, ESLint, Prettier, and svelte-check.

## Reason

This matches the target's web-oriented interface while separating simulation from platform integrations. The current Tauri guide supports SvelteKit static adapter and SPA mode. The current TypeScript 7 release is outside peer ranges for the selected SvelteKit/check packages, so TypeScript 6.0.3 is pinned.

## Consequences

Exact direct versions and lockfile are tracked. Recheck current official and package peer guidance before upgrades. PWA caching is deferred to its platform phase.
