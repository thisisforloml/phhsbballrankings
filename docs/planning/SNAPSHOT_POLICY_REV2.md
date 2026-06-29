# Snapshot Policy Rev 2

**Status:** Implemented  
**Effective:** 2026-06-17  
**Supersedes:** Rev 1 interim split (`snapshotEligible: false` for PENDING)

## A. Policy specification

### Live boards

| Population | Visible | Badge |
|------------|---------|-------|
| VERIFIED | Yes | None |
| PENDING | Yes | Age Unverified |

### Snapshots

Snapshots mirror **what users would have seen on the public board** at `weekOf` (evaluation date).

**Visibility contract:**

```ts
isSnapshotBoardVisible(verdict) === verdict.publicRankAllowed === true
```

Do **not** use `snapshotEligible` as the snapshot publish gate (field may mirror visibility for WS-1 payload completeness).

### Row provenance

Every **new** `RankingSnapshotRow` stores:

| Field | Values |
|-------|--------|
| `ageVerificationStatus` | `VERIFIED` \| `PENDING` |

Legacy rows may have `null` (pre-Rev-2 era).

### Historical integrity

**Existing snapshots are never rewritten.**

- G3 `--execute` is disabled
- No bulk regeneration of historical `RankingSnapshotRow` data
- Rationale: snapshots record what users saw at publish time; retroactive correction would falsify history

Forward publishes only (import monthly generation, `generate-ranking-snapshots-v1*`).

## B. Snapshot path inventory

| Path | Role | Contract |
|------|------|----------|
| `src/lib/snapshot-board-rows.ts` | **Canonical builder** | `buildSnapshotBoardRows` |
| `src/lib/submission-post-import-processing.ts` → `generateImportedSubmissionMonthlyRankings` | Admin post-import | Uses canonical builder |
| `scripts/generate-ranking-snapshots-v1.ts` | U19 manual publish | Uses canonical builder |
| `scripts/generate-ranking-snapshots-v1-u16.ts` | U16 manual publish | Uses canonical builder |
| `scripts/g3-ranking-snapshot-regeneration.ts` | Preview / audit only | Uses builder for preview; **execute disabled** |
| `scripts/regenerate-affected-ranking-snapshots-after-player-merge.ts` | Merge repair (destructive) | **Not updated** — requires explicit approval per run |

Admin entry points: `src/app/admin/submissions/actions.ts` calls `generateImportedSubmissionMonthlyRankings`.

## C. Schema

`RankingSnapshotRow.ageVerificationStatus` — nullable `TEXT`, populated on forward publishes.

Migration: `20260617130000_add_ranking_snapshot_row_age_verification_status`

## D. Future snapshot behavior matrix

| Player state at `weekOf` | Live board | Future snapshot row |
|--------------------------|------------|---------------------|
| VERIFIED + RANKED | Visible | Included, `VERIFIED` |
| PENDING (P12, not expired) | Visible + badge | Included, `PENDING` |
| PENDING expired | Hidden | Excluded |
| PROVISIONAL (P7) | Hidden | Excluded |
| HIDDEN / FORMER / P11 / P13 | Hidden | Excluded |

## E. Divergence prevention

All forward publish paths must call `buildSnapshotBoardRows` from `src/lib/snapshot-board-rows.ts`. No path may filter on `snapshotEligible` alone or use ad-hoc class-year-only filters.

## F. Historical snapshots

**Will not be rewritten.** Existing 5 snapshots / 720 rows remain as published. G3 regeneration recommendation is **cancelled**.

## Manual QA

- [ ] Run migration for `ageVerificationStatus`
- [ ] Forward publish (dry-run import monthly) includes PENDING + VERIFIED counts
- [ ] `npx tsx scripts/g3-ranking-snapshot-regeneration.ts --execute` fails with Rev 2 message
- [ ] Player profile trend exposes `ageVerificationStatus` when present on rows
- [ ] Live board row counts match snapshot row counts for new monthly publish
