# Competition Management (disabled for release)

This folder holds Competition Management and Import Center code that is **not active** in the current production release.

## Why disabled

Production ships without the `20260703190000_competition_management` Prisma migration. The live schema must not require:

- `League.shortName` and related league metadata columns
- `Season.seasonNumber` / `Season.isCurrent`
- `Game.divisionId`
- `season_divisions` / `import_records` tables
- Competition / import enums

## Contents

| Path | Original location |
|------|-------------------|
| `app/admin/competitions/` | `src/app/admin/competitions/` |
| `app/admin/imports/` | `src/app/admin/imports/` |
| `lib/admin/competition-management/` | `src/lib/admin/competition-management/` |
| `lib/admin/load-competition-list.ts` | `src/lib/admin/load-competition-list.ts` |
| `lib/admin/load-competition-detail.ts` | `src/lib/admin/load-competition-detail.ts` |
| `lib/admin/load-import-center.ts` | `src/lib/admin/load-import-center.ts` |

Migration SQL lives at `prisma/_disabled_migrations/20260703190000_competition_management/`.

## Re-enable checklist

1. Move migration back under `prisma/migrations/` and apply it to the target database.
2. Restore competition fields/models in `prisma/schema.prisma` (see `prisma/_disabled_migrations/PRE_COMPETITION_SCHEMA_SNIPPET.txt` for the pre-feature baseline; re-apply the migration SQL for the full feature set).
3. Move files from this folder back to their original `src/` paths.
4. Restore admin nav entries for Competitions and Import Center.
5. Re-wire dashboard / data-health links and loaders that were simplified for this release.
6. Run `npx prisma generate`, `npx tsc --noEmit`, and smoke-test `/admin/competitions` and `/admin/imports`.
