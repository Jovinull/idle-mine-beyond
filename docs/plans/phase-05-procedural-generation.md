# Phase 5 — Procedural generation

Status: Partial compatibility slice implemented; high-index differential sampling expanded on 2026-10-02. Full phase certification remains open.

## Outcome

Return reference-matching mine objects for fixed anchors, procedural boundaries, and large IDs.

## Entry evidence

Anchor tables, region transitions, seeded generator, color/name logic, and drop formulas are documented.

## Validation

Golden comparisons around every region boundary and fixed anchor, plus deterministic property tests for sampled large IDs.

## Current verified slice

The pinned corpus has exact object outputs for every ID from 0 through 768, 23 explicit boundary probes, and 128 reproducible xorshift64* samples distributed across the safe-integer range (seed `0x494d4220261002`). The corpus contains 920 objects total. The source probe verifies the exact pinned corpus, Chromium compares every object, the core corpus test compares Beyond's generated outputs, and the Node repeatability property passes. This sample does not certify every safe integer, and Phase 5 remains open until every required anchor/boundary and gameplay integration are reviewed.
