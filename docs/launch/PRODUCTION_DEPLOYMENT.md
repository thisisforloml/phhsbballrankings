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
2. **Node.js version:** set **22.x** in Vercel → Project Settings → Build and Deployment → Node.js Version. This must match `package.json` `engines.node` (`22.x`) and `.nvmrc` (`22`). Use major-only pins (`22.x`), not an exact patch (e.g. `22.14.0`).
3. `vercel.json` schedules weekly cron to `/api/cron/update-ratings` — `CRON_SECRET` must match what Vercel sends as `Authorization: Bearer …`.
4. Portal login uses the `argon2` native module. `next.config.mjs` includes the Linux glibc prebuild via `outputFileTracingIncludes` so Vercel serverless bundles ship the `.node` binary. Do not remove that config without an equivalent fix.
5. Stop local `next dev` before running `npm run build` locally if Prisma reports `EPERM` on the query engine DLL.

## Post-deploy smoke test

- [ ] Home, rankings, player profile, game, team, league load without error
- [ ] Invalid URL shows branded 404 (not a blank page)
- [ ] Portal login works with session cookie
- [ ] Cron endpoint returns 401 without secret, 200 with valid bearer (staging only)

## Private Soft-Launch Configuration (July 20, 2026)

The controlled LinkedIn preview uses https://peachbasket.vercel.app and remains unindexed.

### Vercel variables

Set these server-only values:

- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- SUPABASE_PLAYER_PHOTOS_BUCKET=player-photos
- SUPABASE_SUBMISSIONS_BUCKET=submission-files
- FILE_STORAGE_BACKEND=supabase

Set these public/reversible launch values:

- NEXT_PUBLIC_SITE_URL=https://peachbasket.vercel.app
- SITE_INDEXING_ENABLED=false
- NEXT_PUBLIC_POSTHOG_KEY=(EU project key)
- NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com

Keep DATABASE_URL, DIRECT_URL, PORTAL_SESSION_SECRET, and CRON_SECRET configured.

### Supabase buckets

1. Create public bucket player-photos.
2. Create private bucket submission-files.
3. A 5 MB object limit is sufficient.
4. Writes use the server-only service role. Never expose the service role key to the browser.

New player photos are converted to WEBP, bounded to 1600 x 1600, and use immutable UUID paths with a one-year browser cache. New submission files are stored privately and recorded as supabase://submission-files/(object-key).

The 10 tracked public player photos remain in the repository. The 11 existing files under storage/submissions are a separate backup/migration concern and are not migrated by this batch.

### Analytics privacy

PostHog EU is the only analytics provider. Autocapture, replay, identification, surveys, and feature flags are disabled. Events must not include names, search terms, contact data, internal IDs, or form contents. Analytics does not initialize when Do Not Track is enabled or when configuration is absent.

### Rollback

- Analytics: remove the two NEXT_PUBLIC_POSTHOG variables.
- Storage: production must remain on Supabase; local fallback is development-only.
- Indexing: keep SITE_INDEXING_ENABLED=false for the private preview. Set it to true only after public-launch and legal approval.
- Member access: /login and /register intentionally redirect to /coming-soon; Admin and Organizer Portal authentication are separate and remain active.
