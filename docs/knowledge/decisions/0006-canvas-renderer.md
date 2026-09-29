# ADR 0006: Canvas 2D mine-object renderer

- Status: Accepted for compatibility implementation
- Date: 2026-09-28

## Decision

Use DOM/CSS for the interface and Canvas 2D for mine-object spritesheet compositing.

## Reason

The pinned Remix source already composes colored layers from a mask spritesheet using Canvas operations. Reproducing this path is a direct fit for the source behavior.

## Consequences

The renderer must match mask regions, palette order, compositing, sizing, and screenshot output. Do not generate unrelated substitute artwork during parity.
