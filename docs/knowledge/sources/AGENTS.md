# Reference metadata rules

- Keep repository URLs, default branches, exact commit SHAs, inspection dates, archive status, licenses, notices, and reference roles in the manifest.
- Remix is canonical; Remux is prior art only. Never update the reference pin implicitly.
- `.research/` must be reconstructible from the tracked manifest and setup script, and must remain Git-ignored.
- Do not put credentials, local absolute paths, or claims of permission beyond the detected license in tracked metadata.
