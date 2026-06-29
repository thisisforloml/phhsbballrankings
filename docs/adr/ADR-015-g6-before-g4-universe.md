# ADR-015: G6 Before G4 Universe

**Status:** Accepted  
**Date:** 2026-06-16  
**Workstreams:** B3, P1 Amendment A-2, WS-5, WS-7

## Context

P1 originally sequenced WS-5 (G4) before WS-7 (G6). Current schema has `GamePerformanceScore.gameStatId @unique` and `PlayerRating @@unique([playerId, ageGroup])` without formula version — v2 writes would overwrite v1; universe recompute is non-replayable.

## Decision

1. **G4-P pilot** may run after G3 as **read-only, v1-only, non-persisting**.
2. **G4 universe recompute** requires **P-G6** (G6 schema landed) **or P-W1** (v1-scoped + signed waiver).
3. Corrected order: `G3 → G6 → G4 → G7`.

## Consequences

- Versioned storage must exist before persisting lifetime ratings at scale.
- R-READ hardening is a G6 exit criterion.
- P-W1 carries residual replay risk; requires signed acknowledgment.

## Invariants

INV-09, INV-05
