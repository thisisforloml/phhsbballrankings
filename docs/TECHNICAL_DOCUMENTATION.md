# Peach Basket — Technical Documentation

Last updated: 2026-06-28

Production-quality reference for architecture, data flow, deployment, and operations. For guardrails and stable counts, see [PROJECT_STATUS.md](./PROJECT_STATUS.md).

---

## 1. System overview

Peach Basket (OnCourt Rankings PH) is a **Next.js 14 App Router** application backed by **PostgreSQL** via **Prisma**. It serves:

| Surface | Audience | Path prefix |
|---------|----------|-------------|
| Public site | Fans, recruits, media | `(site)` route group — `/`, `/rankings`, `/players`, etc. |
| Admin portal | Platform operators | `/admin/*` |
| Organizer portal | League operators | `/organizer/*` |
| Portal auth | Shared login | `/portal/login` |
| APIs | Cron, legacy integrations, monitoring | `/api/*` |

**Core domain:** verified game stats → Formula v1 performance scores → player ratings → national ranking boards and player profiles.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser / Client                         │
└────────────────────────────┬────────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
   Server Components    Client Components    Route Handlers
   (RSC, loaders)       (filters, charts)    (/api/*)
         │                   │                   │
         └───────────────────┼───────────────────┘
                             ▼
              ┌──────────────────────────────┐
              │  Next.js middleware (Edge)    │
              │  - Request/correlation IDs    │
              │  - /admin session gate        │
              └──────────────┬───────────────┘
                             ▼
              ┌──────────────────────────────┐
              │  Node.js runtime              │
              │  - Prisma (instrumented)      │
              │  - Server Actions             │
              │  - pino logging               │
              └──────────────┬───────────────┘
                             ▼
              ┌──────────────────────────────┐
              │  PostgreSQL (Supabase pooler) │
              └──────────────────────────────┘
```

### Runtime split

| Layer | Runtime | Notes |
|-------|---------|-------|
| `src/middleware.ts` | **Edge** | HMAC session verify via Web Crypto; no Prisma |
| Server Components, Server Actions, most API routes | **Node.js** | Prisma, Argon2id, filesystem uploads |
| Client components | Browser | URL state, tables, charts |

### Key directories

| Path | Role |
|------|------|
| `src/app/(site)/` | Public marketing + rankings + profiles |
| `src/app/admin/` | Admin CRUD, submissions, imports |
| `src/app/api/` | REST endpoints, cron, monitoring |
| `src/lib/ratings/` | Formula v1, GPS, rating resolution |
| `src/lib/rankings.ts` | National board assembly |
| `src/lib/player-profile.ts` | Profile loader |
| `src/lib/admin/` | Admin loaders + cache invalidation |
| `prisma/schema.prisma` | Database schema |

---

## 3. Data flow

### 3.1 Game evidence → ratings

```
Submission (JSON) → Admin import → Game + GameStat rows
                                        │
                                        ▼
                              GamePerformanceScore (Formula v1)
                                        │
                                        ▼
                              PlayerRating (per age group / policy)
                                        │
                    ┌───────────────────┴───────────────────┐
                    ▼                                       ▼
         Live board rebuild (`getLatestNationalRankings`)   RankingSnapshot (published)
                    │                                       │
                    └──────────────► /rankings, /players ◄──┘
```

### 3.2 Public rankings read path

1. `getLatestNationalRankings()` loads boards for U13/U16/U19 × Boys/Girls (concurrency-limited).
2. Each board queries `PlayerRating` with active policy filter (`getActivePolicyVersionId()`).
3. Eligibility (`evaluateEligibility`) filters snapshot-eligible players.
4. Affiliation context resolves school/team display from `PlayerTeamSeason` + recent `GameStat`.
5. Full payload serialized to `RankingsClient` (client-side filter/sort/paginate).

**Flag:** `RANKINGS_READ_FROM_SNAPSHOTS=1` switches to precomputed `RankingSnapshot` rows (requires parity verification).

### 3.3 Player profile read path

1. `getPlayerProfileBySlug(slug)` — React `cache()` per request.
2. Joins player bio, ratings, game log, competition participation, intelligence badges.
3. `selectPublicPlayerRating()` picks home-board vs competition-board rating when DOB known.
4. `PlayerProfilePageClient` renders tabbed sections (recent form, analytics, scouting, etc.).

### 3.4 Admin write path

1. Server Actions in `src/app/admin/**/actions.ts` call `requireAdminUser()`.
2. Mutations update Prisma models.
3. `invalidateAdmin*Caches()` clears in-process admin loader caches.
4. `revalidatePublicRankingSurfaces()` busts Next.js cache for `/`, `/rankings`, `/teams`, `/search`, `/games`, `/leagues`.

---

## 4. Database schema

PostgreSQL via Prisma. Primary models (see `prisma/schema.prisma`):

### Identity

| Model | Purpose |
|-------|---------|
| `User` | Portal accounts (ADMIN, ORGANIZER, …) |
| `Program` | School/club identity |
| `Team` | Competition team; `programId` links to Program |
| `League` | Competition context (not a Program) |
| `Season` | League season instance |

### Players & roster

| Model | Purpose |
|-------|---------|
| `Player` | Canonical player identity + bio |
| `PlayerAlias` / `PlayerExternalAlias` | Merge + import matching |
| `PlayerTeamSeason` | **Roster history** (who played where/when) |
| `PlayerProgramHistory` | Program affiliation timeline |

### Games & stats

| Model | Purpose |
|-------|---------|
| `Game` | Historical game evidence |
| `GameStat` | Per-player box score line |
| `GamePerformanceScore` | Formula v1 computed score per stat line |
| `GameEditAudit` | Admin edit trail |

### Rankings

| Model | Purpose |
|-------|---------|
| `FormulaVersion` | Formula version registry |
| `PlayerRating` | **Live** public ratings |
| `RankingSnapshot` + `RankingSnapshotRow` | Published historical boards |
| `TeamRating` / `ProgramTeamRating` | Team strength indices |
| `TeamRankingSnapshot` | Team board snapshots |

### Operations

| Model | Purpose |
|-------|---------|
| `Submission` | Organizer JSON submissions |
| `AuditLog` | Admin actions |
| `ProfileClaim` / `PlayerClaimProfile` | Player claim workflow |
| `OrganizerApplication` | Partner applications |

**Soft deletes:** `Game.deletedAt`, `GameStat.deletedAt` preserve historical integrity.

---

## 5. Cache architecture

### 5.1 Next.js route cache

| Route | Strategy |
|-------|----------|
| `/` | `revalidate = 300` (ISR, 5 min) |
| `/rankings` | `force-dynamic` (always fresh) |
| `/teams` | `force-dynamic` + `revalidate = 0` |
| Player profiles | Dynamic per slug (default) |

On-demand revalidation: `revalidatePublicRankingSurfaces()` after admin publish/import.

### 5.2 React `cache()` (request dedup)

- `getPlayerProfileBySlug`
- `getHomeData`, `getPublicTrustMeta`

### 5.3 Admin in-process TTL caches

Admin list loaders (`load-managed-player-list`, `load-program-list`, etc.) use **module-level Maps** with ~5-minute TTL. Cleared via `src/lib/admin/invalidate-admin-caches.ts`.

**Vercel caveat:** caches are **per serverless instance**, not shared across regions/instances.

### 5.4 CI / build caches

GitHub Actions caches `node_modules` and `.next/cache` (see `.github/workflows/ci.yml`).

---

## 6. Authentication flow

### 6.1 Portal session

| Item | Value |
|------|-------|
| Cookie | `oncourt_portal_session` |
| Format | `base64url(payload).hmac-sha256-signature` |
| Secret | `PORTAL_SESSION_SECRET` (required in production) |
| Max age | 12 hours |
| Roles | `ADMIN`, `ORGANIZER` |

**Login paths:**

- `/portal/login` — server action form
- `/api/organizer/login` — API login (rate limited)
- `/api/licensed/access` — licensed organizer access

**Password storage:** Argon2id (new); legacy SHA-256 auto-upgraded on successful login.

### 6.2 Authorization layers

| Surface | Gate |
|---------|------|
| `/admin/*` | Middleware (Edge HMAC verify) + `requireAdminUser()` in pages/actions |
| `/organizer/*` | `requireOrganizerUser()` in pages |
| `/portal/my-profile` | `requirePortalUser()` |

### 6.3 Middleware (`src/middleware.ts`)

- All matched routes receive `x-request-id` and `x-correlation-id`.
- `/admin` routes redirect to `/portal/login` if session missing/invalid/non-admin.
- Matcher excludes static assets and `uploads/`.

---

## 7. Ranking engine

### 7.1 Formula v1 (production)

- **GPS:** per-game performance score from box stats vs league context.
- **Player rating:** cumulative average of GPS in age group.
- **Star bands:** &lt;60→1★, 60–69→2★, 70–79→3★, 80–89→4★, 90–100→5★.
- **Policy ID:** `formula-v1-tier-normalized-soft-v1` (production reads via `getActivePolicyVersionId()`).

### 7.2 Age groups

| Group | Ages |
|-------|------|
| U13 | ≤13 |
| U16 | 14–16 |
| U19 | 17–19 |

Calendar age as of evaluation date. Class-year graduation removes U19 eligibility June 1 of class year.

### 7.3 Public eligibility (launch)

- U19 Boys: ≥10 verified games
- U19 Girls: ≥5 verified games

`PlayerRating` may exist below threshold; public boards filter via eligibility.

### 7.4 Home board vs competition board

When DOB is known, `selectPublicPlayerRating()` prefers the player's **calendar home bracket** rating over highest competition bracket (e.g., playing up in U19 league while calendar U16).

### 7.5 Cron

`vercel.json` schedules `GET /api/cron/update-ratings` weekly (Mondays 04:00 UTC) with `Authorization: Bearer $CRON_SECRET`.

### 7.6 Experimental (not production)

- Formula v2 / vNext — preview only
- `PLAYER_RATING_FORMULA_MODE=shadow-vnext` — do not enable without approval

---

## 8. Admin portal

**Base path:** `/admin`

| Area | Capabilities |
|------|--------------|
| Programs | School/club CRUD, roster view |
| Players | Bio editor, photo upload, transfers |
| Teams | Team management |
| Leagues | League/season/game management |
| Submissions | Review, import official JSON |
| Claims | Profile claim review |
| Data health | Duplicate detection |
| Ops | Audit log, signals |
| Tools | URL import |

**Patterns:**

- Server Actions with `requireAdminUser()`
- Rate limits on destructive/import operations
- `invalidateAdmin*Caches()` + `revalidatePublicRankingSurfaces()` after writes

---

## 9. Organizer portal

**Base path:** `/organizer`

| Area | Capabilities |
|------|--------------|
| Dashboard | Submission stats |
| Submissions | Upload JSON, track status |
| Live stats | In-game stat entry |

Organizers authenticate via same portal cookie with `ORGANIZER` role. Middleware does **not** gate `/organizer` — pages call `requireOrganizerUser()` server-side.

---

## 10. Public site

### 10.1 Primary routes

| Route | Description |
|-------|-------------|
| `/` | Homepage boards preview (ISR 300s) |
| `/rankings` | National rankings with filters |
| `/players/[slug]` | Player profile |
| `/players/search` | Player search |
| `/players/compare` | Side-by-side comparison |
| `/teams`, `/teams/[id]` | Team listings and detail |
| `/games`, `/games/[id]` | Game schedule and box scores |
| `/leagues`, `/leagues/[id]` | League standings |
| `/programs/[id]` | Program overview |
| `/how-we-rank`, `/about`, `/faqs` | Trust content |

### 10.2 UI architecture

- **Server shell + client interactivity** for rankings, teams, games, home.
- **PublicPageShell** — consistent layout variants (`paper`, `scout`).
- **FilterToolbar / PaginationToolbar** — URL-driven state on rankings.

---

## 11. Deployment

### 11.1 Target platform

**Vercel** (recommended) with **Supabase PostgreSQL**.

### 11.2 Required environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | Pooled connection (port 6543, `pgbouncer=true`) |
| `DIRECT_URL` | Yes (Supabase) | Migrations / direct session |
| `PORTAL_SESSION_SECRET` | Yes | Session HMAC |
| `CRON_SECRET` | Yes (if cron enabled) | Cron auth |

See `.env.example` for feature flags and optional tuning.

### 11.3 Build & CI

```bash
npm ci
npm run typecheck   # tsc --noEmit
npm run lint
npm run test
npm run build
```

GitHub Actions workflow: `.github/workflows/ci.yml` — runs on push/PR to `main`/`master`. **Does not deploy.**

### 11.4 Database migrations

```bash
npx prisma migrate deploy   # production
npx prisma generate         # post-install / CI
```

### 11.5 Monitoring

See [MONITORING.md](./MONITORING.md) for in-app signals and recommended log drain stack.

---

## 12. Security notes

| Control | Status |
|---------|--------|
| Argon2id passwords | Implemented |
| Admin middleware | `/admin` protected |
| Rate limiting | Login + submission actions (in-process) |
| Structured logging | pino + request IDs |
| Legacy APIs | Removed — migrated to `/admin/intake` with portal session auth |

### Uploads

Player photos write to `public/uploads/player-photos/` on local disk. **Not durable on Vercel serverless** — use object storage (S3, Supabase Storage, Vercel Blob) for production.

---

## 13. Testing

- Runner: Node.js built-in `node:test`
- Command: `npm run test`
- Coverage focus: password hash, session tokens, access rules, submission lifecycle, cache invalidation, rate limits

---

## 14. Related documents

| Document | Topic |
|----------|-------|
| [PROJECT_STATUS.md](./PROJECT_STATUS.md) | Guardrails, counts, feature status |
| [MONITORING.md](./MONITORING.md) | Observability |
| `docs/launch/` | Snapshot rollout, launch checklists |
| `.cursor/rules/data-safety.mdc` | Mutation approval policy |
| `.cursor/rules/domain-architecture.mdc` | Identity model |
