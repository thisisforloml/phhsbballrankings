# Peach Basket — Monitoring

Lightweight production monitoring is built into the application. Logs use **pino** (JSON in production, pretty in development).

## What is captured

| Signal | Mechanism | Event name |
|--------|-----------|------------|
| Request / correlation IDs | `src/middleware.ts` on all matched routes | `x-request-id`, `x-correlation-id` headers |
| Global server errors | `src/instrumentation.ts` unhandled hooks | `global_error` |
| React root errors | `src/app/global-error.tsx` → `POST /api/monitoring/client-error` | `global_error` (`source: client_global_error`) |
### Prisma slow queries

`instrumentPrismaClient()` in `src/lib/monitoring/prisma-instrumentation.ts` is available for **server-only** entry points. It is not wired into the shared `prisma` singleton because admin client components share import graphs with server planners — enable via a dedicated server-only client when refactoring import boundaries.

Until then, use **Vercel log drains** + Postgres `pg_stat_statements` or Axiom query on `slow_query` events from manually wrapped loaders.

| Prisma query errors | Prisma extension + `logPrismaError` | `prisma_query_error` |
| Auth failures | `logAuthFailure` on portal/API login | `auth_failure` |
| Server action failures | `traceServerAction()` helper | `server_action_failure` |
| Upload failures | `logUploadFailure` on player photo store | `upload_failure` |

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `LOG_LEVEL` | `info` (prod) / `debug` (dev) | pino log level |
| `SLOW_QUERY_THRESHOLD_MS` | `500` | Prisma slow-query threshold |

## Recommended production stack

Keep the in-app layer thin; ship logs to a hosted aggregator:

1. **Vercel Log Drains** → **Axiom** or **Datadog** (structured JSON, request correlation, alerts on `slow_query` / `auth_failure` rate)
2. **Sentry** (optional) for `global_error` and `server_action_failure` grouping — wire via log drain or direct SDK later
3. **Uptime** — Vercel monitoring or Better Stack ping on `/` and `/rankings`

### Why this stack

- **pino + log drain**: zero extra runtime deps, works on serverless, preserves `requestId` / `adminActionId`
- **Axiom**: fast search on Vercel, good for slow-query dashboards without running Postgres `pg_stat_statements` in app code
- **Sentry**: only if you need stack traces and release tracking; not required for MVP

## Server Actions

Wrap high-risk actions with:

```typescript
import { traceServerAction } from "@/lib/monitoring/trace-server-action";

export async function myAction(formData: FormData) {
  return traceServerAction("myAction", async () => {
    // existing logic
  });
}
```

## Vercel notes

- Middleware runs on the Edge runtime; request IDs are generated at the edge and forwarded to Node Server Actions via headers.
- Prisma instrumentation runs only in the Node.js runtime (Server Components, Server Actions, route handlers).
- Client error POST is best-effort; do not rely on it for security auditing.
