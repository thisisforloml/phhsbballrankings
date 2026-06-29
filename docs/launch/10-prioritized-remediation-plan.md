# LC1 — Prioritized Remediation Plan

**Audit date:** 2026-06-28

## P0 — Deploy blockers (do first)

| # | Task | Owner | Effort | Files |
|---|------|-------|--------|-------|
| 1 | Fix production build typecheck | Eng | 1–4 hrs | `tsconfig.json` exclude `scripts/` OR fix `scripts/audit-ethan-kaw.ts` + peers |
| 2 | Configure production secrets | Ops | 15 min | Hosting env: `PORTAL_SESSION_SECRET`, `DATABASE_URL` |
| 3 | Verify `npm run build` on CI | Eng | 30 min | Pipeline config |

## P1 — Launch week (high value, low risk)

| # | Task | Effort | Files |
|---|------|--------|-------|
| 4 | Add `src/app/error.tsx` | 1 hr | New file |
| 5 | Add `src/app/not-found.tsx` | 1 hr | New file |
| 6 | Metadata for `/teams`, `/leagues` | 30 min | `teams/page.tsx`, `leagues/page.tsx` |
| 7 | Rankings loading fallback | 1 hr | `rankings/page.tsx` |
| 8 | Search fetch error UI | 1 hr | `SearchOverlay.tsx` |

## P2 — Post-soft-launch (2 weeks)

| # | Task | Effort |
|---|------|--------|
| 9 | `sitemap.ts` + `robots.ts` | 2 hrs |
| 10 | Initialize ESLint (`eslint-config-next`) | 1 hr |
| 11 | Add `typecheck` npm script | 15 min |
| 12 | `LeagueCard` → `Numeric` | 30 min |
| 13 | OG PNG in metadata | 30 min |

## P3 — Backlog

| # | Task | Effort |
|---|------|--------|
| 14 | Dynamic import `PlayerTrendsChart` | 2 hrs |
| 15 | `next/font` for Geist | 2 hrs |
| 16 | Rankings semantic table / ARIA grid | 8 hrs |
| 17 | Mobile nav focus trap | 2 hrs |
| 18 | Admin DS token alignment | Multi-day |

## Out of scope for LC1 remediation

- Rating formula changes
- Database migrations or data writes
- Player photo ingestion
- Admin workflow redesign

## Success criteria

- `npm run build` passes
- Public routes render with branded 404/500
- Production env validated on staging
- Smoke QA checklist in [09-launch-checklist.md](./09-launch-checklist.md) signed off
