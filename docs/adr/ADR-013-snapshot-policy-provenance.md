# ADR-013: Snapshot Policy Provenance

**Status:** Accepted | **Workstreams:** H1, WS-2, WS-3

## Decision

Every `RankingSnapshot` freezes `formulaVersionId` and `policyVersionId`. Each `RankingSnapshotRow` freezes minimum WS-1 verdict provenance: `snapshotEligible`, `provisionalReason`, `competitionTrustLevel`, `evaluatedBoard`, `gamesQualified`. Requirement is prospective; existing snapshots are not retro-edited.

## Invariants

INV-14, INV-15
