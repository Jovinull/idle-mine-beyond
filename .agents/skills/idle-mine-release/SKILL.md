---
name: idle-mine-release
description: Prepare future validated web and native release candidates after parity gates, preserving provenance and platform checks.
---

# Release preparation (future workflow)

This Skill defines a later workflow; it does not authorize publishing or claim release readiness.

1. Read `docs/knowledge/project-status.md`, `roadmap.md`, `ip-provenance.md`, `testing-and-parity.md`, and active release plans.
2. Confirm the parity milestone and approved behavioral exceptions. Check the matrix for the target platforms and retain reproducible evidence.
3. Validate clean install, lockfiles, lint, type checks, unit/property/parity tests, E2E/visual checks, web build, and available native builds.
4. Review asset/code notices, dependency licenses, save migration/recovery, platform privacy, signing material handling, and version metadata.
5. Prepare release notes and artifacts without publishing. Publishing requires a separate explicit request.
6. Record unresolved platform setup and approval gates in project status.
