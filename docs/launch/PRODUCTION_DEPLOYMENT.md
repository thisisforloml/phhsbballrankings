# Production Deployment Notes

**Last updated:** 2026-06-28 (P0 launch hardening)

## Pre-deploy commands

Run on a clean machine or CI before deploying:

```bash
npm ci
npm run typecheck
npm run build
```

Optional — typecheck developer scripts separately (does not block deployment):

```bash
npm run typecheck:scripts
```

## Required environment variables

| Variable | Required in production | Purpose |
|----------|----------------------|---------|
| `DATABASE_URL` | **Yes** | PostgreSQL connection for Prisma |
| `PORTAL_SESSION_SECRET` | **Yes** | HMAC secret for admin/organizer portal session cookies |
| `CRON_SECRET` | **Yes** | Bearer token for `/api/cron/update-ratings` (see `vercel.json`) |

See `.env.example` for optional feature flags and local defaults.

## Startup validation

Production **runtime** validates required variables in `src/lib/env.ts`, called from the root layout via `assertProductionEnv()`.

Validation is **skipped during `next build`** (`NEXT_PHASE=phase-production-build`) so CI and local builds pass without production secrets. Secrets must still be set on the hosting provider before traffic is served.

If any required variable is missing or empty at runtime:

- The server throws a clear error naming the missing keys.
- The message points to this document.
- No stack traces are shown to end users on public routes (handled by `error.tsx`).

Development (`NODE_ENV !== "production"`) skips validation so local work can proceed with `.env` partial setup.

## TypeScript configuration

| File | Scope |
|------|--------|
| `tsconfig.json` | Production app — `src/**` only; `scripts/` excluded |
| `tsconfig.scripts.json` | Developer CLI scripts under `scripts/` |

**Why:** `scripts/` contains one-off audits and maintenance tools with looser typing. They must not fail `npm run build` or `npm run typecheck`.

## Route handling (production UX)

| File | Behavior |
|------|----------|
| `src/app/error.tsx` | Client error boundary — generic message, Try again / Go home; logs to console only |
| `src/app/loading.tsx` | Branded loading spinner during route transitions |
| `src/app/not-found.tsx` | Branded 404 for missing pages and `notFound()` from loaders |

Stack traces and `error.message` are **not** exposed to users in production.

## Hosting notes (Vercel)

1. Set `DATABASE_URL`, `PORTAL_SESSION_SECRET`, and `CRON_SECRET` in project Environment Variables (Production).
2. `vercel.json` schedules weekly cron to `/api/cron/update-ratings` — `CRON_SECRET` must match what Vercel sends as `Authorization: Bearer …`.
3. Stop local `next dev` before running `npm run build` locally if Prisma reports `EPERM` on the query engine DLL.

## Post-deploy smoke test

- [ ] Home, rankings, player profile, game, team, league load without error
- [ ] Invalid URL shows branded 404 (not a blank page)
- [ ] Portal login works with session cookie
- [ ] Cron endpoint returns 401 without secret, 200 with valid bearer (staging only)
