# LC1 — Launch Checklist

**Audit date:** 2026-06-28  
**P0 hardening:** 2026-06-28  
**Build verified:** 2026-06-28 — `npm run typecheck` exit 0, `npm run build` exit 0 (63 routes)

## Completed

- [x] Brand SVG assets in `/public/peach-basket/`
- [x] Design tokens in `tailwind.config.ts` + `src/lib/design-system/tokens.ts` (merge fix applied)
- [x] `globals.css` compiles with `accent-*` utilities
- [x] `Numeric` + `format/stats.ts` on core public surfaces (rankings, profiles, games, teams, search, claim)
- [x] Sports icons library; `PlayerAnalytics` migrated
- [x] Root metadata (OG, Twitter, favicon, `metadataBase`)
- [x] Entity `generateMetadata` for player, team, game, league, rankings board
- [x] `notFound()` in data loaders for missing entities
- [x] `EmptyState` on primary list experiences
- [x] `src/` TypeScript clean
- [x] Dev server serves public pages without runtime errors
- [x] `.env.example` documents `PORTAL_SESSION_SECRET`, `DATABASE_URL`, `CRON_SECRET`
- [x] **`npm run typecheck`** — app-only (`scripts/` excluded from root tsconfig)
- [x] **`npm run build`** — production build passes (scripts excluded; env assert skips build phase)
- [x] **`src/app/error.tsx`** — production error boundary (no stack traces)
- [x] **`src/app/loading.tsx`** — route loading state
- [x] **`src/app/not-found.tsx`** — branded 404
- [x] **Production env validation** — `assertProductionEnv()` in root layout (runtime only; skipped during `next build`)
- [x] **`docs/launch/PRODUCTION_DEPLOYMENT.md`** — deployment notes

## Remaining — before production deploy

- [ ] Set production env: `DATABASE_URL`, `PORTAL_SESSION_SECRET`, `CRON_SECRET` (hosting provider)
- [x] `npm run build` green locally (2026-06-28 — typecheck + build verified)
- [ ] `npm run build` green on clean CI machine
- [ ] Post-deploy smoke test (see `PRODUCTION_DEPLOYMENT.md`)

## Remaining — before marketing / SEO launch

- [ ] Add metadata to `/teams` and `/leagues`
- [ ] Replace rankings `Suspense fallback={null}` with visible loading state
- [ ] Search overlay error state for failed API
- [ ] `sitemap.ts`
- [ ] `robots.ts`
- [ ] JSON-LD structured data (optional)
- [ ] ESLint + CI lint step
- [ ] OG PNG fallback in metadata
- [ ] Bundle analysis on player profile route

## Can wait until after launch

- [ ] `LeagueCard` Numeric migration
- [ ] Admin portal design token unification
- [ ] Mobile drawer focus trap
- [ ] `next/font` self-hosting
- [ ] Dynamic import for `PlayerTrendsChart`
- [ ] Semantic HTML tables for rankings
- [ ] Player photo coverage (content)
- [ ] Formula v2 / age carryover (product roadmap)

## Manual QA before deploy

- [ ] `npm run typecheck` and `npm run build` green on clean machine
- [ ] Smoke test: home → rankings → player → game → team → league
- [ ] Portal login + admin login
- [ ] Claim profile search
- [ ] Mobile check at 375px on rankings + player profile
- [ ] Trigger 404 on invalid slug — branded `not-found.tsx` appears
