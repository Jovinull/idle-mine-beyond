# Project status

Last updated: 2026-09-29

## Phase

**Phase 0 — Foundation / Reference Archaeology.** No game simulation, progression, crafting, story, or final UI has been implemented.

## Compatibility target

Idle Mine: Remix, repository default branch main, commit **0e0f4bf5a9c66e5603cda2ce4bd54213023dae21**. Remux is pinned separately as prior art only. See the [source manifest](sources/reference-manifest.json).

## Complete in bootstrap

- Assimilated the initial research into this knowledge base and created a section-by-section trace.
- Cloned the two first-party repositories into ignored .research/upstream and recorded exact pins and license notices.
- Established the evidence hierarchy, parity contract, exception policy, parity matrix, architecture boundary, roadmap, and post-parity backlog.
- Created the pnpm workspace, SvelteKit static SPA shell, Tauri 2 shell, strict TypeScript checks, lint/format tooling, and CI without gameplay.
- Added unit/parity Vitest smoke tests, a Playwright browser smoke test, and a local Remix oracle browser workflow.
- Added six project-local Skills, registered the three requested MCP servers, and verified their protocol initialization; Playwright and Chrome DevTools navigated to the public Remix deployment.
- Research checkouts match the recorded SHAs and are clean; the reference setup/check script is reproducible.
- Windows Rust/Tauri `cargo check` and native build were validated; the Windows icon is an unbranded transparent scaffold placeholder.

## Not complete

- No full behavior extraction, golden fixtures, implemented game systems, gameplay UI, save importer, PWA, or parity certification.
- No accepted behavioral exceptions.
- No Android/iOS SDK or mobile build setup.
- Upstream game code/assets have not been ported into product code.

## Tooling status

- Node.js 24.21.0 and pnpm 12.6.0 are pinned. The Node archive was installed user-locally after the system MSI installer failed; `.node-version` and CI use 24.21.0.
- `pnpm check` passes formatting, lint, strict TypeScript and Svelte checks, unit/parity smoke tests, and the static web build.
- `pnpm test:e2e` passes against the local shell using installed Google Chrome because Playwright's browser download timed out. CI installs the pinned Playwright Chromium browser.
- `pnpm research:check`, `pnpm docs:check`, and `pnpm skills:check` pass. Pinned source checkouts are clean and ignored by Git.
- On this Windows host, `pnpm native:check` and `pnpm native:build` pass. The build emits an unbranded transparent placeholder icon and is not a release package.
- GitHub MCP's read-only server initializes and exposes its tools, but explicit least-privilege GitHub OAuth consent is still required before a GitHub API read can be exercised. Android SDK/JDK setup and macOS/Xcode are platform prerequisites for future mobile builds.

## Next phase

Continue Phase 0 source archaeology: extract a small, deterministic probe corpus for initial state, fixed mine objects, damage/earnings, upgrade effects, and save shapes. Add fixtures before any game-domain implementation. Then begin the deterministic core only when its inputs and semantics are recorded.
