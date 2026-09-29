# Codex workflow and tooling

## Project instructions

The root [AGENTS.md](../../AGENTS.md) is a concise persistent contract. Nested instructions define local constraints for core, web, native, and knowledge documents. Point to a relevant document when needed; do not require every task to load the entire knowledge base.

## Project-local Skills

Current official Codex documentation discovers repository Skills under .agents/skills. The bootstrap research mentioned .codex/skills, but the current documented repository path is .agents/skills, so this project uses that location. Skills are focused workflows and refer back to canonical knowledge documents:

- idle-mine-parity — reference, fixture, implementation, comparison, and status update.
- idle-mine-reference-probe — query the canonical implementation without modifying it.
- idle-mine-visual-qa — compare controlled reference and Beyond screenshots and computed styles.
- idle-mine-save-compat — inspect, import, migrate, round-trip, and recover legacy saves.
- idle-mine-research — add sourced, classified, reproducible knowledge.
- idle-mine-release — lightweight, future release validation; publishing is outside bootstrap.

Descriptions should be short, scoped, and non-overlapping. Skills should not replicate this knowledge base.

## MCP set

The intended minimum set is:

| Server              | Purpose                                               | Configuration and security                                                                                                                    |
| ------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub MCP Server   | Repository/source archaeology, issues, PRs, Actions   | Official GitHub server; read-only tool filter and minimal read toolsets. OAuth consent may be required. No token is stored in the repository. |
| Playwright MCP      | Browser interaction, flows, screenshots               | Official Microsoft/Playwright project; isolated headless profile for the Codex server.                                                        |
| Chrome DevTools MCP | DOM/CSS, console, network, and performance inspection | Official Google/Chrome project; isolated headless browser.                                                                                    |

Codex CLI currently stores user-scoped server config in the user's Codex config (`~/.codex/config.toml`). This is intentional for local authentication and avoids committing machine paths or credentials. The project-local `.codex/config.toml` mechanism exists but requires project trust; it is not used for secrets. Repository Skills use `.agents/skills/` per current Codex documentation, rather than the older `.codex/skills/` path noted in the initial research.

At bootstrap, server registration and runtime capability must be reported separately. A listed server is not proof that authentication or browser launch succeeded.

## Documented setup commands

These three servers were added to the user-scoped Codex configuration with `idle-mine-` names so existing unrelated MCP entries are not overwritten. GitHub MCP v1.12.2 is the official Windows x64 release binary, checksum-verified against the project's release checksum file, installed under the user's Codex bin directory. Its argument list is:

```toml
args = ["stdio", "--toolsets=repos,issues,pull_requests,actions", "--read-only", "--oauth-scopes=public_repo,read:user"]
```

`codex mcp get idle-mine-github` confirms the configured arguments. On this Windows Codex CLI version, adding comma-list flags through the CLI normalized commas to spaces, so the persisted `args` entry was corrected and inspected directly. Keep each comma-list as one argument.

Browser server registration uses the current CLI and official package entry points:

```powershell
codex mcp add idle-mine-playwright -- npx --yes @playwright/mcp@0.0.83 --headless --isolated --browser=chrome
codex mcp add idle-mine-chrome-devtools -- npx --yes chrome-devtools-mcp@1.10.1 --headless --isolated --no-usage-statistics
codex mcp list
```

The GitHub server initializes and exposes 25 read-only tools. Its local stdio OAuth starts a browser authorization on first GitHub read; that step is pending. The requested grant is limited to `public_repo` and `read:user`. `--read-only` filters writes, and the explicit toolsets keep the surface small. Do not pass the existing broad-scope `gh` credential to this server.

Playwright MCP v0.0.83 initialized with 25 tools and navigated to the canonical Remix deployment. Chrome DevTools MCP v1.10.1 initialized with 30 tools and navigated to the same deployment. Both use isolated headless Chrome; DevTools usage statistics are disabled. Codex sessions should be restarted after changing global MCP configuration so their available tool list refreshes.

Official references: [Codex Skills](https://learn.chatgpt.com/docs/build-skills), [Codex configuration](https://learn.chatgpt.com/docs/config-file/config-reference), [GitHub MCP Server](https://github.com/github/github-mcp-server), [GitHub local stdio OAuth](https://github.com/github/github-mcp-server/blob/main/docs/oauth-login.md), [Playwright MCP](https://playwright.dev/docs/getting-started-mcp), and [Chrome DevTools MCP](https://developer.chrome.com/docs/devtools/agents/get-started).

Current CI uses `pnpm/setup@v3`; its current setup action supersedes older examples using `pnpm/action-setup`. It pins pnpm 12.6.0 and installs a Node 24 runtime. See the [official action](https://github.com/pnpm/setup) for its current inputs.

## Planning

Use the root PLANS.md conventions for multi-step work and keep active plans in docs/plans. Plans contain observable outcomes, evidence, validation, and remaining work; do not invent source-derived implementation details in advance.

## Commits

Use English Conventional Commit subjects, subject-only by default. No co-author trailers or AI/tool attribution. Commit only a coherent validated unit and synchronize material documentation changes.

## Research

Use the [research workflow](research-workflow.md). The official Remix checkout is read-only. Do not let a Skill or MCP server silently update the reference or product files from upstream.
