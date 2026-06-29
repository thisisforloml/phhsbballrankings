# LC1 — Technical Debt

**Audit date:** 2026-06-28

## Critical

| ID | Description | Impact | Action | Effort |
|----|-------------|--------|--------|--------|
| C1 | `npm run build` fails — `scripts/` included in `tsconfig.json` typecheck | **Cannot deploy via standard CI** | Exclude `scripts` from Next typecheck or fix script TS errors | 1–4 hrs |
| C2 | `PORTAL_SESSION_SECRET` required in production (`portal-auth.ts`) | Portal/admin auth throws without env | Set in hosting provider before deploy | 15 min |

## High

| ID | Description | Impact | Action | Effort |
|----|-------------|--------|--------|--------|
| H1 | No `error.tsx` at any route | Unhandled errors → generic Next crash UI | Add `src/app/error.tsx` + optional segment errors | 2 hrs |
| H2 | No `not-found.tsx` | `notFound()` returns bare Next 404 | Add branded `src/app/not-found.tsx` | 1 hr |
| H3 | No `sitemap.ts` / `robots.ts` | Poor SEO discoverability | Add Next.js metadata routes | 2 hrs |
| H4 | Missing metadata on `/teams`, `/leagues` | Weak SERP for list pages | Add `export const metadata` | 30 min |
| H5 | Rankings `Suspense fallback={null}` | Blank flash on load | Replace with skeleton or spinner | 1 hr |
| H6 | Search API failure shows empty results silently | Users think no matches | Show error state in `SearchOverlay` | 1 hr |

## Medium

| ID | Description | Impact | Action | Effort |
|----|-------------|--------|--------|--------|
| M1 | ESLint not configured — `npm run lint` prompts interactively | No automated style/a11y lint in CI | Add `.eslintrc` + `eslint-config-next` | 1 hr |
| M2 | No `npm run typecheck` script | Developers must remember `tsc` | Add script; document scripts exclusion | 15 min |
| M3 | Rankings/game tables are div grids | Screen reader column context missing | Semantic table or ARIA grid | 4–8 hrs |
| M4 | 0% player `photoUrl` coverage | Generic initials avatars | Content ops, not code | Ongoing |
| M5 | `LeagueCard` / chart legacy typography | Minor visual inconsistency | Migrate to `Numeric` | 1 hr |
| M6 | Formula v2 / carryover not implemented | Product roadmap item | Document only — not launch blocker | N/A |

## Low

| ID | Description | Impact | Action | Effort |
|----|-------------|--------|--------|--------|
| L1 | Mobile drawer no focus trap | Keyboard users can tab behind overlay | Add focus trap library or manual | 2 hrs |
| L2 | Geist fonts from Google CDN | External dependency, minor CLS | `next/font` migration | 2 hrs |
| L3 | `PlayerTrendsChart` not dynamically imported | Larger player profile bundle | `dynamic()` on Analytics tab | 2 hrs |
| L4 | OG images use SVG URL | Some crawlers want PNG | Point metadata to PNG fallback | 30 min |
| L5 | Pre-existing script TS drift | Blocks build only if scripts in scope | Fix or exclude | Variable |
