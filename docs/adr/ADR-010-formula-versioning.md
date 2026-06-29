# ADR-010: Formula Versioning & Coexistence

**Status:** Accepted | **Workstreams:** WS-7, B3

## Decision

Formula versions coexist additively. Uniqueness: `@@unique([gameStatId, formulaVersionId])` and `@@unique([playerId, ageGroup, formulaVersionId])`. v1 evidence is never overwritten. At most one `FormulaVersion` is public at a time. `FormulaVersion.weights` frozen for ACTIVE/RETIRED versions.

## Invariants

INV-09, INV-10, INV-12
