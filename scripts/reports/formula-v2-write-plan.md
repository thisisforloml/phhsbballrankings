# Formula v2 Write/Recompute Plan

Generated: 2026-05-31T09:01:08.615Z

## Result

- Execute requested: no.
- Execute ready: no.
- No database writes were performed.
- No ranking snapshots were generated.

## Preview Baseline

```json
{
  "path": "D:\\Peach Basket\\scripts\\reports\\formula-v2-preview.json",
  "generatedAt": "2026-05-31T08:54:26.552Z",
  "inputs": {
    "totalOfficialActiveGames": 253,
    "totalOfficialActiveGameStats": 6340,
    "totalPlayersWithStats": 601,
    "leagueSeasonPools": 5
  },
  "warnings": []
}
```

## Current Counts

```json
{
  "officialActiveGamesWithStats": 253,
  "officialActiveGameStats": 6340,
  "totalGamePerformanceScores": 6340,
  "formulaV1GamePerformanceScores": 6340,
  "formulaV2TaggedGamePerformanceScores": 0,
  "totalPlayerRatings": 611,
  "totalRankingSnapshots": 3,
  "totalRankingSnapshotRows": 511,
  "formulaVersionV1Exists": 1,
  "formulaVersionV1IsPublic": 0,
  "formulaVersionV2Exists": 1,
  "formulaVersionV2IsPublic": 0
}
```

## Storage Assessment

| table | desired | currentConstraint | safeSideBySide | implication |
| --- | --- | --- | --- | --- |
| GamePerformanceScore | Store v2 rows beside v1 rows with formulaVersionTag = 2. | gameStatId @unique | false | A v2 insert for an already-scored GameStat would collide with the existing v1 row. |
| PlayerRating | Store v2 ratings beside v1 ratings. | @@unique([playerId, ageGroup]) and no formulaVersionId/formulaVersionTag. | false | A v2 upsert would overwrite the live production rating path. |
| RankingSnapshot | Do not generate snapshots in this step. | Versioned by formulaVersionId. | true | Snapshots can be versioned later, but should wait until score/rating storage is safe. |

## Blockers

- `GamePerformanceScore.gameStatId` is globally unique, so v2 rows cannot be inserted alongside v1 rows for the same GameStat without replacing/updating existing rows.
- `PlayerRating` is globally unique on `[playerId, ageGroup]` and has no formula version field, so v2 PlayerRatings cannot coexist with production v1 PlayerRatings.
- Public ranking snapshots currently point to one FormulaVersion, but the live PlayerRating table is not versioned; switching public output requires a separate approved cutover plan.
- A side-by-side v2 write requires an approved storage change, such as versioned GamePerformanceScore uniqueness and versioned PlayerRating storage, or dedicated shadow/preview tables.

## Guarded Write Strategy

- Keep `npm.cmd run ratings:v2:preview` as the current read-only comparison path.
- Use `npm.cmd run ratings:v2:dry-run` to re-check write readiness and current table constraints before any implementation attempt.
- Do not add or run `ratings:v2:execute` under the current schema because side-by-side v2 storage is not safe.
- Before execution, approve a storage design: either version `GamePerformanceScore` uniqueness by `[gameStatId, formulaVersionId]` and add versioned PlayerRating storage, or create dedicated Formula v2 shadow tables.
- After storage is version-safe, implement a new execute script that validates preview counts, writes only v2 records, leaves formulaVersionTag = 1 rows untouched, and still does not generate snapshots.
- Only after v2 score/rating validation should a separate approved step generate v2 RankingSnapshots and switch public leaderboard output.

## Package Scripts

```json
{
  "ratings:v2:preview": "tsx scripts/preview-formula-v2.ts",
  "ratings:v2:dry-run": "tsx scripts/plan-formula-v2-write.ts",
  "ratings:v2:execute": null
}
```
