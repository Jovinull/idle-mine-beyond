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

| Server              | Purpose                                               | Configuration and security                                                                                                                                                                      |
| ------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub MCP Server   | Repository/source archaeology, issues, PRs, Actions   | Official GitHub server; selected-only App installation grants repository writes for `Jovinull/idle-mine-beyond`. Key is stored outside the repository; public repositories may remain readable. |
| Playwright MCP      | Browser interaction, flows, screenshots               | Official Microsoft/Playwright project; isolated headless profile for the Codex server.                                                                                                          |
| Chrome DevTools MCP | DOM/CSS, console, network, and performance inspection | Official Google/Chrome project; isolated headless browser.                                                                                                                                      |

Codex CLI currently stores user-scoped server config in the user's Codex config (`~/.codex/config.toml`). This is intentional for local authentication and avoids committing machine paths or credentials. The project-local `.codex/config.toml` mechanism exists but requires project trust; it is not used for secrets. Repository Skills use `.agents/skills/` per current Codex documentation, rather than the older `.codex/skills/` path noted in the initial research.

At bootstrap, server registration and runtime capability must be reported separately. A listed server is not proof that authentication or browser launch succeeded.

## Documented setup commands

These three servers were added to the user-scoped Codex configuration with `idle-mine-` names so existing unrelated MCP entries are not overwritten. GitHub MCP v1.12.2 is the official Windows x64 release binary, checksum-verified against the project's release checksum file, installed under the user's Codex bin directory. Its argument list is:

```toml
args = ["stdio", "--toolsets=all", "--app-id", "<app-id>", "--app-installation-id", "<installation-id>", "--app-private-key-path", "<protected-user-path>"]
```

`codex mcp get idle-mine-github` confirms the live App authentication arguments in user-scoped configuration. Keep the machine-specific key path and all credentials out of this repository.

Browser server registration uses the current CLI and official package entry points:

```powershell
codex mcp add idle-mine-playwright -- npx --yes @playwright/mcp@0.0.83 --headless --isolated --browser=chrome
codex mcp add idle-mine-chrome-devtools -- npx --yes chrome-devtools-mcp@1.10.1 --headless --isolated --no-usage-statistics
codex mcp list
```

The GitHub App installation was verified as selected-only for `Jovinull/idle-mine-beyond`. Its repository permissions are write except Metadata and Codespaces metadata, which are read-only; the App declares no organization or account permissions. The MCP uses installation tokens and `--toolsets=all`; its private key stays under the user's protected Codex secrets directory and is not committed. This scopes write access to the selected repository; GitHub may still allow reading public repository data elsewhere. After changing global MCP configuration, restart Codex so the session reloads the tool list and credentials.

Git transport is configured separately for this checkout. Its local credential-helper list resets inherited helpers and invokes `.git/codex-auth/idle-mine-beyond-git-credential.cjs`, which accepts only the exact `https://github.com/Jovinull/idle-mine-beyond` path. It mints a short-lived installation token restricted to that repository and `contents:write`, `workflows:write`, and `metadata:read`; it does not use the broader `gh` login or persist the token. To let sandboxed Git processes read the helper, a local key copy sits beside it under `.git/codex-auth`; both files have user/SYSTEM-only ACLs and are outside Git's tracked history. The original key remains in the protected Codex secrets directory for MCP authentication.

Earlier bootstrap validation initialized Playwright MCP v0.0.83 with 25 tools and navigated to the canonical Remix deployment. Chrome DevTools MCP v1.10.1 initialized with 30 tools and navigated to the same deployment. Both use isolated headless Chrome; DevTools usage statistics are disabled. Codex sessions should be restarted after changing global MCP configuration so their available tool list refreshes.

Current session validation on 2026-09-29: GitHub MCP reads of the project and branch list and an Actions run query succeeded; repository metadata reports `push` and `admin` permission. Git transport uses the repo-local helper at `.git/codex-auth/idle-mine-beyond-git-credential.cjs`. `git fetch origin main` succeeded and `git -c credential.interactive=never push origin main` completed with `Everything up-to-date`; the fetched remote `main` matched local commit `8380f4d85affb66ec1e9f0eaa17bcf910151e19a`, so that invocation uploaded no new objects because the commits were already present. The earlier Schannel `SEC_E_NO_CREDENTIALS` error was not reproduced. GitHub Actions run [36613182372](https://github.com/Jovinull/idle-mine-beyond/actions/runs/36613182372) for the exact commit succeeded, including source verification and all 11 browser smoke tests. No credentials were printed or written to tracked files. Playwright and Chrome DevTools tools are listed; local Playwright CLI execution is available.

Official references: [Codex Skills](https://learn.chatgpt.com/docs/build-skills), [Codex configuration](https://learn.chatgpt.com/docs/config-file/config-reference), [GitHub MCP Server](https://github.com/github/github-mcp-server), [GitHub App authentication for local MCP](https://github.com/github/github-mcp-server/blob/v1.12.2/docs/github-app-auth.md), [Playwright MCP](https://playwright.dev/docs/getting-started-mcp), and [Chrome DevTools MCP](https://developer.chrome.com/docs/devtools/agents/get-started).

Current CI uses `pnpm/setup@v3`; its current setup action supersedes older examples using `pnpm/action-setup`. It pins pnpm 12.6.0 and installs a Node 24 runtime. See the [official action](https://github.com/pnpm/setup) for its current inputs.

## Planning

Use the root PLANS.md conventions for multi-step work and keep active plans in docs/plans. Plans contain observable outcomes, evidence, validation, and remaining work; do not invent source-derived implementation details in advance.

## Commits

Use English Conventional Commit subjects, subject-only by default. No co-author trailers or AI/tool attribution. Commit only a coherent validated unit and synchronize material documentation changes.

## Research

Use the [research workflow](research-workflow.md). The official Remix checkout is read-only. Do not let a Skill or MCP server silently update the reference or product files from upstream.
