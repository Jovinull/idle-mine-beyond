# ADR 0010: Native save storage boundary

Date: 2026-09-30

## Status

Accepted

## Context

The shared persistence coordinator already owns Beyond v1 validation, backup ordering, recovery, and save confirmation. Native packaging needs durable storage without moving filesystem behavior into the game core or the persistence package. The desktop app has one Tauri WebView and two Beyond save slots; the legacy Remix key remains in WebView localStorage for import.

## Decision

- Implement the `RemixBeyondSaveStorageAdapter` in the web/platform layer, with native I/O exposed through three Tauri commands: read one slot, write one slot, and clear Beyond slots.
- Resolve storage under Tauri's `app_data_dir()` and map only `primary` and `backup` to fixed filenames. Never accept a frontend path.
- Execute file operations through Tauri's blocking task pool from asynchronous commands.
- Use Tauri's documented `withGlobalTauri` `window.__TAURI__.core.invoke` API with a narrow TypeScript interface. The command bridge is not imported into core or persistence.
- Hard Reset removes only primary, backup, and their temporary write files from native app data, then clears WebView origin localStorage to preserve the captured Remix reset behavior.

## Consequences

- Browser and native hosts share validation, backup, migration, and confirmation behavior.
- Beyond native files are platform-specific storage; the legacy Remix `IdleMine` slot remains in WebView localStorage until a successful migration is saved natively.
- Native Rust filesystem and TypeScript bridge tests are present. Runtime save/reload through a packaged or dev Tauri WebView remains to be verified.
- Direct Beyond v1 and recovery-bundle imports use the shared coordinator, so they write through the native adapter after the user selects the file and acknowledges the recovery export.

## Evidence

- Official [Tauri configuration](https://v2.tauri.app/reference/config/) documents `app.withGlobalTauri`.
- Official [Tauri core API reference](https://tauri.app/reference/javascript/api/namespacecore/) documents `window.__TAURI__.core.invoke` when `withGlobalTauri` is enabled.
- Tauri 2.12.0 [`PathResolver::app_data_dir`](https://docs.rs/tauri/latest/tauri/path/struct.PathResolver.html) provides the app-scoped data directory.
- Tauri [`async_runtime::spawn_blocking`](https://docs.rs/tauri/latest/tauri/async_runtime/fn.spawn_blocking.html) runs filesystem calls off the async executor.
