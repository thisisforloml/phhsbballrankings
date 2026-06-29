# Archived UAAP Season 88 GameStat Import Scripts

## DEPRECATED — DO NOT RUN IN PRODUCTION

These scripts are preserved for historical reference only. They must not be used to load or modify production data.

## Purpose

One-time command-line loaders that imported `GameStat` rows from UAAP Season 88 HS batch JSON into the database. They assumed `Game`, `Team`, and `Player` records already existed.

| Script | Role |
| --- | --- |
| `import-game-stats-from-batches.ts` | Full UAAP S88 HS Boys (6 batches) + Girls (2 batches) GameStat load |
| `import-uaap-s88-hs-boys-phase4-game-stats.ts` | Early phased load for the first 10 HS Boys games |

## Historical usage

- Used during initial UAAP Season 88 dataset bootstrap (games/players imported via sibling scripts in `scripts/`).
- `import-game-stats-from-batches.ts` processed eight JSON files under `scripts/data/uaap-s88-hs-boys-batch-*.json` and `scripts/data/uaap-s88-hs-girls-batch-*.json`.
- `import-uaap-s88-hs-boys-phase4-game-stats.ts` was a superseded intermediate step; its source file (`scripts/data/uaap-s88-hs-boys-10-games.json`) is no longer in the repo.
- That load is complete. Active public UAAP Season 88 evidence lives in the database and is validated via `src/lib/validated-uaap-data.ts`.

## Replacement path (supported ingestion)

Use **official submission import** for all new game-stat evidence:

| Layer | Path |
| --- | --- |
| Admin workflow | Admin → Submissions → review → preflight → publish/import |
| Import implementation | `src/lib/submission-official-import.ts` |
| Preflight | `src/lib/submission-import-preflight.ts` |

Supported upload formats: spreadsheet (CSV/XLSX) and structured submission payloads parsed into the same import pipeline.

## Why archived

1. **GameStat immutability bypass** — both scripts upsert on `(gameId, playerId)` match and overwrite all box-score fields via `gameStat.update`. Re-running them can silently rewrite historical evidence.
2. **No PlayerAlias resolution** — players are matched by exact `displayName` + gender only. They do not use `src/lib/player-import-identity.ts` or the `PlayerAlias` table.
3. **No immutability guards** — they do not use `src/lib/game-stat-import-integrity.ts` (create / skip / block).
4. **Operational obsolescence** — UAAP S88 bootstrap is complete; ongoing ingestion is submission-driven.
5. **Phase-4 script broken** — hardcoded season UUID and missing data file; superseded by the batch script.

## Source data location

Batch JSON remains at `scripts/data/uaap-s88-hs-boys-batch-*.json` and `scripts/data/uaap-s88-hs-girls-batch-*.json` for validation and diagnostics. Only the import **scripts** were archived.

## Related legacy scripts (still active in `scripts/`)

These were part of the same bootstrap era but are out of scope for this archive move:

- `scripts/import-games-from-batches.ts`
- `scripts/import-players-from-batches.ts`

They share the same PlayerAlias and immutability gaps. Prefer official submission import for any new data.
