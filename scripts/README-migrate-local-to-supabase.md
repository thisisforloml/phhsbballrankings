# Local → Supabase data migration

Production-quality **data-only** copy from your local PostgreSQL (source of truth) into Supabase.

## Safety guarantees

This tool **only inserts data**. It does **not**:

- run `prisma migrate` or `prisma db push`
- create, alter, or drop tables
- truncate or delete rows
- overwrite existing rows (`createMany({ skipDuplicates: true })`)

Prisma migrations must already be applied on **both** databases before running this script.

## Prerequisites

1. Local PostgreSQL running with production data
2. Supabase project with **all migrations already applied** (empty tables OK)
3. Network access to Supabase (use IPv4 pooler URLs if needed)

## Environment variables

Set in your shell or a local `.env` file (do **not** commit secrets):

```env
DATABASE_URL_LOCAL="postgresql://postgres:postgres@localhost:5432/ph_hoops_index?schema=public"

# Supabase session/direct pooler (migrations already applied)
DATABASE_URL_SUPABASE="postgresql://postgres.[ref]:[password]@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"
```

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL_LOCAL` | Source database |
| `DATABASE_URL_SUPABASE` | Destination database |

The script refuses to run if both URLs are identical.

## Commands

### 1. Dry run (recommended first)

Analyzes every table and reports how many rows would be inserted. **Never aborts** when the destination has fewer rows (empty Supabase is expected).

```powershell
npm run migrate:supabase:dry
```

Example output per table:

```
Users
Source: 2
Destination: 0
Will insert: 2
```

Ends with a summary: tables checked, total source rows, total destination rows, total rows to insert. Exit code **0**.

### 2. Live migration

```powershell
npm run migrate:supabase
```

### 3. Resume after interruption

Skips tables already recorded in the state file **when counts still match**.

```powershell
npm run migrate:supabase:resume
```

### Optional flags

```powershell
npx tsx scripts/migrate-local-to-supabase.ts --batch-size=250
npx tsx scripts/migrate-local-to-supabase.ts --dry-run --batch-size=500
```

## What it does

1. Connects two Prisma clients (`localDb`, `supabaseDb`) with separate URLs
2. Migrates tables in **FK-safe order** (parents before children)
3. Reads source rows in batches (default **500**) via cursor pagination
4. Inserts with `createMany({ skipDuplicates: true })` inside **one transaction per table**
5. Verifies `COUNT(*)` after each table — **stops on mismatch**
6. Syncs PostgreSQL sequences with `setval()` when serial columns exist (most tables use UUID PKs)
7. Writes resume state to `scripts/reports/migrate-local-to-supabase-state.json`

## Table order

Defined in `scripts/migrate-local-to-supabase/table-plan.ts` from `prisma/schema.prisma` foreign keys:

`User` → `Program` → `League` → … → `GameEditAudit`

## Progress output example

```
Migrating Players...
  216 rows
  inserted: 216 (skipDuplicates enabled)
  remaining tables: 14 | 1.2s | 180.0 rows/sec
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `DATABASE_URL_LOCAL is required` | Export env vars in the same shell session |
| FK violation on insert | Table order bug — report with table name |
| Count mismatch on dry run | Expected when Supabase is empty — dry run continues and reports `Will insert` |
| Count mismatch after live migration | Live run aborts — investigate FK errors or partial prior imports |

## Files

| File | Role |
|------|------|
| `scripts/migrate-local-to-supabase.ts` | CLI entrypoint |
| `scripts/migrate-local-to-supabase/table-plan.ts` | Ordered table list |
| `scripts/migrate-local-to-supabase/helpers.ts` | Clients, batching, verification, state |
| `scripts/reports/migrate-local-to-supabase-state.json` | Resume checkpoint (created at runtime) |

## After migration

1. Spot-check row counts in Supabase SQL editor
2. Set Vercel `DATABASE_URL` to Supabase pooler URL (port 6543, `pgbouncer=true`)
3. Smoke-test homepage, rankings, player profile, admin login
