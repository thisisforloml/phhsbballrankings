# Design System Rollback — Baseline Summary

**Date:** 2026-06-28  
**Target:** Post–Peach Basket rebrand, pre–Design System Phase 1 / Geist Mono

## Preserved (intentional)

- Peach Basket branding (`BRAND_NAME`, metadata, copy)
- `src/lib/brand.ts` + PNG runtime paths (`/logos/*.png`)
- `PeachBasketLogo` (PNG default, optional `format="svg"`)
- `public/logos/`, `public/peach-basket/`, repo `logos/` masters
- `docs/branding/` brand kit documentation
- `AppChrome`, trust footer, Peach Basket navbar/login/register
- Peach Basket homepage hero copy + `BoardLeadersCarousel` + database modules
- `package.json` name `peach-basket`
- `tsconfig.json` scripts exclude (build hygiene only)

## Reverted

| Area | Action |
|------|--------|
| `tailwind.config.ts` | Restored pre-design-system palette (court/amber/hardwood/navy) |
| `src/styles/globals.css` | Restored legacy `@apply` utilities |
| Geist Mono | Removed from `layout.tsx` font link |
| `src/lib/design-system/` | Deleted |
| `src/components/design-system/` (`Numeric`) | Deleted |
| `src/lib/format/stats.ts` | Deleted |
| `src/components/icons/sports/` | Deleted |
| Launch hardening routes | Deleted `error.tsx`, `loading.tsx`, `not-found.tsx` |
| `src/lib/env.ts` | Deleted (`assertProductionEnv`) |
| Design-system migrations | Reverted `RatingBadge`, `StatCard`, tables, `LeaderboardPreview`, etc. from HEAD |
| Player profile overhaul UI | Restored HEAD player page (`PlayerProfileHeader` + sections) |
| Player compare | Removed (depended on deleted chart/Numeric stack) |
| Advanced analytics/charts | Removed `PlayerAnalytics`, `PlayerProfileCharts`, `charts/*` |

## Verification

| Command | Result |
|---------|--------|
| `npm run typecheck` | **PASS** |
| `npm run build` | **Blocked locally** — Prisma `EPERM` (stop `next dev` before build) |

## Manual QA checklist

- [ ] Stop dev server, run `npm run build`
- [ ] Homepage: navbar PNG logo, hero, board leader carousel, rankings preview, team/games modules
- [ ] No global “Loading Peach Basket…” screen on navigation
- [ ] Rankings + player profile render with `font-display` stats (not Geist Mono)
- [ ] Login/register/portal show stacked PNG logos
- [ ] Favicon loads `/logos/logo-icon.png`

## Follow-up (optional)

- Admin UI still contains some `primary-*` / `neutral-*` class names from partial Phase 2 — cosmetic only; tailwind no longer generates those tokens
- Re-introduce player compare or advanced analytics incrementally without design-system coupling
- `docs/branding/PHASE1_SUMMARY.md` describes the rolled-back system — treat as archival reference
