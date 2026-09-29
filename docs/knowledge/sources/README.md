# Source register

The machine-readable source freeze lives in [reference-manifest.json](reference-manifest.json). Runtime CDN dependencies observed while loading the pinned page are captured separately in [runtime-dependencies.json](runtime-dependencies.json). Reconstruct and verify both the exact source repositories and dependency snapshots with `pnpm research:setup` / `pnpm research:check`.

The full MIT notice found in the Remix repository is preserved at [licenses/idle-mine-remix-MIT.txt](licenses/idle-mine-remix-MIT.txt) because compatibility fixtures now contain normalized data extracted from its implementation.

## Frozen repositories

| Source           | URL                                                                         | Role             | Branch / commit                                 | License detected                   | Inspected  |
| ---------------- | --------------------------------------------------------------------------- | ---------------- | ----------------------------------------------- | ---------------------------------- | ---------- |
| Idle Mine: Remix | [veprogames/idle-mine-remix](https://github.com/veprogames/idle-mine-remix) | Canonical target | main / 0e0f4bf5a9c66e5603cda2ce4bd54213023dae21 | MIT, Copyright (c) 2023 veprogames | 2026-09-28 |
| idle-mine-remux  | [veprogames/idle-mine-remux](https://github.com/veprogames/idle-mine-remux) | Prior art only   | main / 79630238696b2e2b10d6706e17f3e6ca2cf20f0e | MIT, Copyright (c) 2023 veprogames | 2026-09-28 |

GitHub metadata and repository pages report Remix archived on 2026-02-09 and Remux archived on 2025-02-09. The local checkout is not a writable development fork. See the [research workflow](../research-workflow.md).

## Directly relevant resources

- The [Remix playable site](https://veprogames.github.io/idle-mine-remix/) is the runtime/visual reference. A live deployment is not frozen by a source commit; runtime probes must record date, browser, viewport, and state.
- The [Remix developer page](https://veprogames.github.io/games/idle-mine-remix/) links the GitHub Pages, CrazyGames, and Kongregate deployments and describes the game's feature scope.
- The [original Idle Mine Kongregate page](https://www.kongregate.com/games/crovie/idle-mine) and [original-game wiki](https://idle-mine.fandom.com/wiki/Idle_Mine_Wiki) provide lineage context only. No first-party original-game source repository or license was established in bootstrap research.
- The [Remix wiki](https://idle-mine-remix.fandom.com/wiki/Home) is secondary evidence only.

## Current tooling references

These are setup guidance, not product behavior specifications:

- [OpenAI Codex Skills](https://learn.chatgpt.com/docs/build-skills)
- [OpenAI Codex configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference)
- [Official GitHub MCP Server](https://github.com/github/github-mcp-server)
- [Official Microsoft Playwright MCP repository](https://github.com/microsoft/playwright-mcp)
- [Playwright MCP](https://playwright.dev/docs/getting-started-mcp)
- [Chrome DevTools for agents](https://developer.chrome.com/docs/devtools/agents/get-started)
- [SvelteKit and Tauri](https://tauri.app/start/frontend/sveltekit/)
- [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)
- [Node.js release policy](https://nodejs.org/en/about/previous-releases)
- [pnpm installation](https://pnpm.io/installation/)
