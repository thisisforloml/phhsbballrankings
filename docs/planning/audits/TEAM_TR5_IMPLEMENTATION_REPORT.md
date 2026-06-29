# TR-5 ProgramTeamRating Implementation Report

**Status:** Implemented (backend persistence only)  
**Date:** 2026-06-17  
**Scope:** TR-5 per [TEAM_TR4_PERSISTENCE_DESIGN.md](./TEAM_TR4_PERSISTENCE_DESIGN.md)

---

## Summary

TR-5 adds live national team rating persistence without public exposure:

| Deliverable | Location |
|---|---|
| Prisma models | `prisma/schema.prisma` — `TeamFormulaVersion`, `ProgramTeamRating` |
| Migration + seed | `prisma/migrations/20260617140000_add_program_team_rating/` |
| TPI-v1 engine | `src/lib/team-ratings/team-tpi-v1.ts` |
| Evidence filter | `src/lib/team-ratings/team-evidence-filter.ts` |
| Compute + upsert | `src/lib/team-ratings/compute-program-team-ratings.ts` |
| CLI compute | `scripts/compute-program-team-ratings.ts` |
| Validation | `scripts/validate-program-team-ratings-tr5.ts` |

**Not in scope (unchanged):** public UI, `/teams`, snapshots, `TeamRankingSnapshot`, `TEAM_NATIONAL_RATINGS_ENABLED` (remains `false`), `team_ratings` writes.

---

## Seed Notes

`TeamFormulaVersion` seeds **one** row:

| slug | versionNumber | evidence in parameters |
|---|---:|---|
| `TPI-v1` | 1 | `evidencePolicyVersion: TEAM-EVIDENCE-v1-official-import` |

`TEAM-EVIDENCE-v1-official-import` is an **evidence policy slug** (not a formula version). It is enforced in `team-evidence-filter.ts` and stamped on each `ProgramTeamRating.evidencePolicyVersion` row at compute time.

---

## Evidence Policy

`TEAM-EVIDENCE-v1-official-import`:

- `verificationStatus IN (SUBMITTED, VERIFIED)`
- `submissionType = STAFF_MANUAL_ENTRY`
- Active game, season, league, teams, and programs only (`deletedAt IS NULL`)

---

## Compute Workflow

`computeProgramTeamRatings()`:

1. Load `TeamFormulaVersion` slug `TPI-v1`
2. Load eligible games via evidence filter
3. Group by `(ageGroup, gender)` board
4. Dedupe by `gameNumber` within each board
5. Run 2-pass TPI-v1 with shrinkage `k=6`
6. Upsert `ProgramTeamRating` on `(programId, ageGroup, gender)`
7. Delete stale rows not in current compute scope
8. Delete rows whose program is soft-deleted

Fixed evaluation date for parity with TR-3 pilot: `2026-06-17T12:00:00.000Z`.

---

## Validation Matrix (TR-5)

| ID | Check | TR-5 status |
|---|---|---|
| V-TR-11 | Player `/rankings` unchanged | Run validation script |
| V-TR-12 | `tsc --noEmit` | Run validation script |
| V-TR-13 | Snapshot row count | **SKIP** (TR-7) |
| V-TR-14 | Snapshot header provenance | **SKIP** (TR-7) |
| V-TR-15 | Snapshot immutability | **SKIP** (TR-7) |
| V-TR-16 | Unique `(programId, ageGroup, gender)` | Run validation script |
| V-TR-17 | Recompute idempotency ±0.01 | Run validation script |
| V-TR-18 | PYBC U16 Boys = 37 deduped games | Run validation script |
| V-TR-19 | No `team_ratings` writes | Run validation script |
| V-TR-20 | No rows for deleted programs | Run validation script |

Report: `scripts/reports/tr5-validation-latest.json`

**Latest run (2026-06-17):** 8 PASS, 0 FAIL, 3 SKIP

| Board | Games | Programs |
|---|---:|---:|
| U16:Boys | 97 | 16 |
| U19:Boys | 257 | 38 |
| U13:Boys | 37 | 8 |
| U19:Girls | 14 | 4 |

**Persisted rows:** 66 `ProgramTeamRating` records

---

## Rollback Notes

### Safe rollback (no data loss elsewhere)

1. **Stop compute jobs** — do not run `scripts/compute-program-team-ratings.ts`.
2. **Clear persisted rows** (optional, reversible recompute):

```sql
DELETE FROM program_team_ratings;
```

3. **Revert migration** (destructive to team rating tables only):

```sql
DROP TABLE IF EXISTS program_team_ratings;
DROP TABLE IF EXISTS team_formula_versions;
```

Then remove migration folder `20260617140000_add_program_team_rating` and revert `schema.prisma` changes; run `npx prisma generate`.

### Partial rollback

- Keep tables but disable compute: no public UI reads `ProgramTeamRating` while `TEAM_NATIONAL_RATINGS_ENABLED=false`.
- Player ratings, games, and `team_ratings` are unaffected.

### Re-apply after rollback

```bash
npx prisma migrate deploy
npx tsx scripts/compute-program-team-ratings.ts
npx tsx scripts/validate-program-team-ratings-tr5.ts
```

---

## Manual QA Checklist

- [ ] `npx prisma migrate deploy` succeeds
- [ ] `npx prisma generate` succeeds
- [ ] `npx tsx scripts/compute-program-team-ratings.ts` completes
- [ ] `npx tsx scripts/validate-program-team-ratings-tr5.ts` — all non-skipped checks PASS
- [ ] `/rankings` player boards unchanged
- [ ] `/teams` still uses legacy standings (no national board)
- [ ] `SELECT COUNT(*) FROM team_ratings` unchanged after compute
