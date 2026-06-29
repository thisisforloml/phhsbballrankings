# TR-6B / TR-6C / TR-7 Unified Team Rankings Rollout

**Status:** Implemented  
**Date:** 2026-06-17

---

## Phase A — TR-6B Admin Validation

| Deliverable | Location |
|---|---|
| Admin preview | `/admin/team-ratings` |
| Validation engine | `src/lib/team-ratings/validate-team-ratings-board.ts` |
| Export script | `scripts/validate-team-ratings-tr6b.ts` |
| JSON report | `scripts/reports/team-ratings-validation.json` |
| Markdown report | `docs/planning/audits/TEAM_TR6B_VALIDATION_REPORT.md` |

**Checks:** V-TR-21 through V-TR-30 (+ duplicate program-name warning)

---

## Phase B — TR-6C Public Cutover

| Deliverable | Location |
|---|---|
| National read path | `src/lib/team-ratings/get-national-team-rankings.ts` |
| Public table | `src/components/public/NationalTeamRankingTable.tsx` |
| Dual-mode `/teams` | `src/app/teams/page.tsx`, `TeamsClient.tsx` |
| Feature flag | `TEAM_NATIONAL_RATINGS_ENABLED` (default **false**) |

When flag **off**: `/teams` behaves exactly as before (competition standings only).

When flag **on**: National Team Rankings (default) + Competition Standings toggle.

---

## Phase C — TR-7 Team Snapshots

| Deliverable | Location |
|---|---|
| Schema | `TeamRankingSnapshot`, `TeamRankingSnapshotRow`, `TeamRankingSnapshotStatus` |
| Migration | `prisma/migrations/20260617180000_add_team_ranking_snapshots/` |
| Builder | `src/lib/team-ratings/build-team-snapshot-board-rows.ts` |
| Publish script | `scripts/generate-team-ranking-snapshots.ts` |
| Validation | `scripts/validate-team-ranking-snapshots-tr7.ts` |
| Feature flag | `TEAM_SNAPSHOT_PUBLISH_ENABLED` (default **false**) |

Snapshot rows mirror **public-eligible** live `ProgramTeamRating` rows (Rev 2).

---

## Feature Flags

| Flag | Default | Effect |
|---|---|---|
| `TEAM_NATIONAL_RATINGS_ENABLED` | `false` | Public national `/teams` board |
| `TEAM_SNAPSHOT_PUBLISH_ENABLED` | `false` | Snapshot generate/publish writes |
| `TEAM_TPI_RECOMPUTE_ENABLED` | `false` | (TR-5) compute job gate |

---

## Rollback

### TR-6B (admin UI)
Delete `src/app/admin/team-ratings/` + nav entries. No data impact.

### TR-6C (public cutover)
Set `TEAM_NATIONAL_RATINGS_ENABLED=false`. Competition standings remain.

### TR-7 (snapshots)
1. Set `TEAM_SNAPSHOT_PUBLISH_ENABLED=false`
2. Delete DRAFT snapshots: `DELETE FROM team_ranking_snapshot_rows WHERE "snapshotId" IN (SELECT id FROM team_ranking_snapshots WHERE status='DRAFT'); DELETE FROM team_ranking_snapshots WHERE status='DRAFT';`
3. Schema rollback: drop `team_ranking_snapshot_rows`, `team_ranking_snapshots`, enum `TeamRankingSnapshotStatus`

### Full persistence rollback (TR-5+)
See `TEAM_TR5_IMPLEMENTATION_REPORT.md` — drop `program_team_ratings` + `team_formula_versions`.

---

## Manual QA

- [x] `npx prisma migrate deploy` — `20260617180000_add_team_ranking_snapshots` applied
- [x] `npx tsx scripts/validate-team-ratings-tr6b.ts` — **11 PASS, 0 FAIL**
- [x] `npx tsx scripts/validate-team-ranking-snapshots-tr7.ts` — **3 PASS, 7 SKIP** (no snapshots until publish flag + script run)
- [ ] Restart dev server after `npx prisma generate` if admin page blank
- [ ] `/admin/team-ratings` — validation panel + duplicate warnings
- [ ] `/teams` with flag off — competition board unchanged
- [ ] `/teams` with `TEAM_NATIONAL_RATINGS_ENABLED=true` — national default + competition toggle
- [ ] `TEAM_SNAPSHOT_PUBLISH_ENABLED=true` + `npx tsx scripts/generate-team-ranking-snapshots.ts`
- [ ] `npx tsx scripts/validate-team-ranking-snapshots-tr7.ts`
- [ ] `/rankings` unchanged
