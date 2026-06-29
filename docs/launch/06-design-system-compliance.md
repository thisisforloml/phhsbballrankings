# LC1 — Design System Compliance

**Audit date:** 2026-06-28  
**Baseline:** Design System Phases 1–2, `tailwind.config.ts` token merge fix, `Numeric`, `src/lib/format/stats.ts`, sports icons, SVG logos.

## Compliant (public surfaces)

| Primitive | Adoption |
|-----------|----------|
| `Numeric` | 24 component/page files — rankings, profiles, box scores, hero, search, claim, charts (partial) |
| `format/stats.ts` | Rankings, standings, roster, recent games, claim, admin team ratings, portal profile |
| `PeachBasketLogo` SVG | Navbar, admin top bar, auth pages |
| Sports icons | `PlayerAnalytics`, `EmptyState` (players) |
| Tailwind `accent`/`primary`/`neutral` | Restored after token merge; `globals.css` `@apply text-accent-600` compiles |
| `ds-*` spacing shadows | Available via `designSystemTheme`; partial admin adoption |

## Remaining legacy (safe to defer)

### Numeric typography not yet migrated

| File | Pattern |
|------|---------|
| `LeagueCard.tsx` | `font-display text-stat-sm` for counts |
| `ProfileCharts.tsx` | Radar `point.value` with `font-display` |
| `teams/[id]/page.tsx` | `font-display` wrapper on W/L (Numeric inside) |
| `admin/ops/page.tsx` | KPI values `font-display` |
| `admin/programs/ProgramListClient.tsx` | Count columns `font-display` |

### Formatting outside `format/stats.ts`

| Layer | Files | Notes |
|-------|-------|-------|
| Data computation | `public-site-data.ts`, `players.ts`, `team-profile.ts`, `team-rankings.ts` | Server-side rounding — acceptable |
| Prose generation | `scouting-report.ts` | Narrative strings with `.toFixed()` |
| Chart prep | `players/[slug]/page.tsx` | `performanceScore.toFixed(1)` for chart input |
| Admin utility | `organizer/submissions/page.tsx` | File size KB/MB display |
| Profile builder | `player-profile.ts` L230 | `values.rating.toFixed(1)` for intelligence display |

### Hardcoded colors

- Chart SVGs (`PlayerTrendsChart`, `ProfileCharts`, `PerformanceTrajectoryChart`) use hex literals aligned to brand palette — acceptable for canvas/SVG; could map to `palette.accent[600]` later.
- `globals.css` base styles use hex for body background — matches `neutral.50`.

### Duplicate icons

- `EmptyState`: leagues/scores/teams still inline SVG; only `players` migrated to `Basketball` sports icon.
- No duplicate basketball SVGs found in public stat rows (Phase 2 cleaned `PlayerAnalytics`).

### Admin portal

- Uses legacy `navy-*`, `surface-*`, `ink-*` tokens (intentional admin shell).
- Incremental `Numeric` on team ratings preview only.

## Safe migrations recommended (post-LC1)

1. `LeagueCard` → `Numeric` for team/game counts (5-line change).
2. `teams/page.tsx` + `leagues/page.tsx` → add metadata (not DS, but launch hygiene).
3. Admin KPI cards → `Numeric` when touching those files anyway.

## Do not migrate pre-launch

- Rewriting chart color constants.
- Bulk admin token rename (`navy` → `primary`).
- Data-layer `.toFixed()` in `lib/` aggregations.
