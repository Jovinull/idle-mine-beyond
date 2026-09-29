# Native host rules

- Tauri owns host integration only; simulation and compatibility logic stay platform-independent.
- Expose native functionality to domain code only through narrow injected adapters.
- During parity, use the same web presentation and behavior as the canonical compatibility target. Do not add native-only gameplay or UX changes.
- Keep signing credentials and local platform SDK paths out of the repository.
