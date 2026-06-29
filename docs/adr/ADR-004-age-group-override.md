# ADR-004: ageGroupOverride Semantics

**Status:** Accepted | **Workstreams:** P0, WS-1

## Decision

`ageGroupOverride` is **eligibility-affecting**, not rating-affecting. A player with rating basis in a different age group without carryover receives `PROVISIONAL` with `publicRankAllowed = false` on the target board.

## Invariants

INV-04, INV-07
