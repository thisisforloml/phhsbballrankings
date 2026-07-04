# Disabled migrations

Migrations in this folder are **not applied** by `prisma migrate deploy`.

## `20260703190000_competition_management`

Competition Management schema (league metadata, season flags, divisions, import records).

Disabled for the current production release so the app builds and runs against the pre-feature database.

To re-enable: move the folder back under `prisma/migrations/`, apply it, restore schema models, and restore code from `src/_disabled/competition-management/`.
