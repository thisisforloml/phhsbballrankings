# Snapshot-First Rankings — Production Rollout

**Status:** Parity confirmed locally (2026-06-30). **Not enabled in production** until operator completes QA below.

## What changed (Phase 2)

| Area | Behavior |
|------|----------|
| Snapshot regeneration | `weekOf` stays at month start; **eligibility uses `evaluationDate = now`** so refreshed snapshots match the live public board mid-month |
| Snapshot read path | `buildLatestNationalRankingsFromSnapshots` hydrates `currentTeam` and `primaryCompetition` via the same gameStat batch helpers as the live path |
| Feature flag | `RANKINGS_READ_FROM_SNAPSHOTS=1` switches `getLatestNationalRankings()` to snapshot read with live fallback on incomplete snapshots |

## Parity gate (must pass before enable)

```bash
npx tsx --tsconfig tsconfig.scripts.json scripts/regenerate-national-ranking-snapshots.ts
npx tsx --tsconfig tsconfig.scripts.json scripts/verify-snapshot-rankings-parity.ts
```

Expected: `allPublicBoardsIdentical: true` across all six boards (U13/U16/U19 × Boys/Girls; empty girls boards are OK).

Latest local result: **PASS** — U19 Boys 239/239 including mid-month June 2009 eligibility (Restificar, Cabañero, Orca Jr., Macahipay).

## Production enable checklist

1. **Regenerate snapshots on production DB** (after deploying Phase 2 code):
   ```bash
   npx tsx --tsconfig tsconfig.scripts.json scripts/regenerate-national-ranking-snapshots.ts
   ```
2. **Run parity against production DB** (same machine/env as production `DATABASE_URL`):
   ```bash
   npx tsx --tsconfig tsconfig.scripts.json scripts/verify-snapshot-rankings-parity.ts
   ```
3. **Benchmark** (optional, confirms loader savings):
   ```bash
   npx tsx --tsconfig tsconfig.scripts.json scripts/benchmark-snapshot-rankings.ts
   ```
4. **Set env on Vercel** (staging first):
   ```
   RANKINGS_READ_FROM_SNAPSHOTS=1
   ```
5. **Manual QA** on `/rankings` for each age tab and gender filter — ranks, names, schools, competition lines match pre-flag behavior.
6. **Rollback:** unset `RANKINGS_READ_FROM_SNAPSHOTS` or set to `0`; live path resumes immediately (no schema migration required).

## Operational notes

- Re-run `regenerate-national-ranking-snapshots.ts` after rating recomputes, imports, or eligibility-affecting bio edits so snapshot rows stay aligned with live.
- `weekOf` remains the calendar month anchor for trend/history; only row membership eligibility uses “as of now” on refresh.
- Home page preview (`getHomeNationalRankings`) still uses the live path — only full `/rankings` uses `getLatestNationalRankings()`.

## Do not

- Enable `RANKINGS_READ_FROM_SNAPSHOTS=1` without a fresh regeneration + parity pass on the target database.
- Bulk-rewrite historical snapshot months (Snapshot Policy Rev 2).
