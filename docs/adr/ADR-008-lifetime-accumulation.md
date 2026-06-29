# ADR-008: Lifetime Accumulation

**Status:** Accepted | **Workstreams:** WS-5

## Decision

Ratings accumulate across leagues, seasons, and competitions **within an age group**. `verifiedGameCount` and `gamesQualified` are career-scoped for the target bracket. Recompute produces `RatingLineageRecord` with `accumulationScopeVersion` for audit.

## Invariants

INV-08
