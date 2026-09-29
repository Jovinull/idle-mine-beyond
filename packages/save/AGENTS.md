# Save package rules

- Save parsing, validation, migrations, and serialization belong behind a platform-independent boundary.
- Storage engines and filesystem/browser APIs are adapters, not dependencies of save-domain logic.
- Preserve legacy Remix import behavior only from source-backed fixtures. Validate versions, retain recoverable backups, and document migration decisions.
- Do not implement the legacy format from guesses; research and fixture first.
