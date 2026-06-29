# Design System Phase 2 — Migration Report

**Date:** 2026-06-26  
**Scope:** Platform-wide adoption of `Numeric`, `src/lib/format/stats.ts`, sports icons, and ranking-table consistency. No layout, flow, or hierarchy changes.

## Summary

Phase 2 replaces ad-hoc numeric rendering (`font-display`, `toFixed()`, manual `%` / `cm` / `kg`) with the shared design system primitives established in Phase 1. Public rankings, player profiles, team pages, game box scores, and selected admin/portal surfaces now share one formatting and typography source of truth.

---

## Components updated

| Component | Changes |
| --- | --- |
| `src/components/design-system/Numeric.tsx` | (Phase 1) — used across Phase 2 surfaces |
| `src/components/ui/RatingBadge.tsx` | `formatRating` + `Numeric` |
| `src/components/ui/Stat.tsx` / `StatCard.tsx` | `Numeric` for values |
| `src/components/ui/EmptyState.tsx` | `players` icon → shared `Basketball` sports icon |
| `src/components/player-card.tsx` | `Numeric` + `formatRating` |
| `src/components/layout/SearchOverlay.tsx` | Removed duplicate `formatRating`; `Numeric` |
| `src/components/sections/HeroSection.tsx` | Leader card rating/stats |
| `src/components/sections/LeaderboardPreview.tsx` | Rank column `Numeric` |
| `src/components/sections/RecentGames.tsx` | `formatDecimal`, `formatWinLossRecord`, `formatPlusMinus`, `Numeric` |
| `src/components/public/RankingTable.tsx` | Rank/rating `Numeric` + `formatRating` |
| `src/components/public/NationalTeamRankingTable.tsx` | Full table numeric alignment |
| `src/components/public/TeamStandingTable.tsx` | Win %, +/-, rank helpers |
| `src/components/public/TeamRosterTable.tsx` | GP / per-game averages |
| `src/components/public/PlayerProfileHeader.tsx` | Hero rating and rank rows |
| `src/components/public/PlayerAnalytics.tsx` | StatCard, game log, shooting %, advanced metrics, competition table, best game / game highs |
| `src/components/public/PlayerProfileCharts.tsx` | League split chart detail strings |
| `src/components/public/BoxScoreTable.tsx` | `formatMinutes`, `formatMadeAttempt`, `StatCell` + `Numeric` |
| `src/components/public/GameList.tsx` | Scores + `formatStatDate` |
| `src/components/public/charts/PlayerTrendsChart.tsx` | Axis/tooltip `formatDecimal` / `formatPercentage` |
| `src/components/public/charts/PerformanceTrajectoryChart.tsx` | Tooltip performance score + rolling avg |
| `src/components/public/charts/ProfileCharts.tsx` | Percentile bar values + `formatPercentile` |

### Format helpers extended (Phase 2)

| Helper | Purpose |
| --- | --- |
| `formatDecimal` | Generic one-decimal display |
| `formatWinPercentageDecimal` | 0–1 win % (e.g. `0.750`) |
| `formatRankNumber` | `#12` rank prefix |
| `formatScore` | Restored game score display |

---

## Pages / clients updated

| Surface | File(s) |
| --- | --- |
| Rankings / home | `HeroSection`, `LeaderboardPreview`, `RankingTable` |
| Player profile | `PlayerAnalytics`, `PlayerProfileHeader`, `PlayerProfileCharts`, charts |
| Player compare | `src/app/players/compare/PlayerCompareClient.tsx` |
| Team profile | `src/app/teams/[id]/page.tsx`, `TeamRosterTable`, `GameList` |
| Game detail | `src/app/games/[id]/page.tsx`, `BoxScoreTable` |
| League detail | `src/app/leagues/[id]/page.tsx` |
| Claim flow | `src/app/claim/page.tsx` |
| Admin team ratings | `src/app/admin/team-ratings/TeamRatingsPreviewClient.tsx` |
| Admin players | `src/app/admin/players/PlayerManagementClient.tsx` |
| Portal profile | `src/app/portal/my-profile/ClaimantProfileClient.tsx` |
| Portal players | `src/app/portal/players/PlayerManagementClient.tsx` |

### Global CSS

| File | Change |
| --- | --- |
| `src/styles/globals.css` | `.rating-badge` uses `font-mono` |

---

## Remaining legacy (intentional deferral)

These areas still use local formatting or `font-display` for numerics. They are **out of scope** for this pass to avoid data-layer churn and non-stat UI risk.

### Data / computation layer (not display components)

| Location | Reason deferred |
| --- | --- |
| `src/lib/public-site-data.ts` | Server-side aggregation rounding |
| `src/lib/players.ts` | API average computation |
| `src/lib/player-profile.ts` | Profile builder rounding |
| `src/lib/team-profile.ts` | Team stat aggregation |
| `src/lib/team-rankings.ts` | Standings computation |
| `src/lib/scouting-report.ts` | Prose generation strings |
| `src/lib/ratings/**` | Formula internals |
| `src/app/api/licensed/access/route.ts` | API response shaping |
| `src/app/players/[slug]/page.tsx` | Chart data prep (`performanceScore` rounding) |

### UI — low-traffic or non-stat formatting

| Location | Follow-up |
| --- | --- |
| `src/app/organizer/submissions/page.tsx` | File-size `KB`/`MB` helper — not basketball stats |
| `src/app/how-we-rank/**` | Marketing copy; audit if numeric examples added |
| `src/app/licensed/**` | Licensed export views |
| Admin pages (general) | Incremental `ds-*` token adoption; no workflow redesign |
| `EmptyState` | `leagues`, `scores`, `teams` icons still inline SVG (non-basketball) |

### Icons

| Status | Notes |
| --- | --- |
| Done | `PlayerAnalytics` stat rows, strength badges, production tab |
| Done | `EmptyState` players → `Basketball` |
| Remaining | No other duplicate basketball SVGs found in public UI |

### Design tokens

| Status | Notes |
| --- | --- |
| Partial | Public stat surfaces use `Numeric` sizes (`text-stat-*`) |
| Remaining | Admin shell still uses legacy `surface-*`, `ink-*`, `navy-*` spacing — migrate incrementally |

---

## Manual follow-up items

1. **Visual QA** — Spot-check rankings tables for column alignment and decimal precision consistency across U13/U16/U19 boards.
2. **Player profile tabs** — Overview / Production / Game log on mobile (horizontal scroll + `Numeric` readability).
3. **Team profile** — Win/Loss hero strip and metric grid on narrow viewports.
4. **Game detail** — Hero scores (large `Numeric`) and box score minutes formatting (`formatMinutes` now shows one decimal).
5. **Admin team ratings** — Preview table rating column vs. validation stat cards.
6. **Chart tooltips** — Player trends and performance trajectory on touch/hover devices.
7. **Accessibility** — Tab through ranking tables and game log sort headers; confirm focus rings unchanged.
8. **Typecheck** — Run `npx tsc --noEmit`; pre-existing errors in `scripts/` are unrelated to this migration.

---

## Risk notes

- **No data mutations** — display-only changes.
- **Em dash vs hyphen** — some legacy game-log cells still use `-` for missing stats; format helpers use `—`. Harmonize in a future pass if desired.
- **Win-loss record** — `formatWinLossRecord` uses en-dash (`18–2`) vs. legacy hyphen (`18-2`) in Recent Form summary.
- **Date format** — `GameList` and game meta now use `formatStatDate` (`Mar 11, 2026`) instead of ISO `YYYY-MM-DD`.

---

## Files changed (Phase 2 total)

```
src/lib/format/stats.ts
src/styles/globals.css
src/components/player-card.tsx
src/components/ui/EmptyState.tsx
src/components/ui/StatCard.tsx
src/components/layout/SearchOverlay.tsx
src/components/sections/HeroSection.tsx
src/components/sections/LeaderboardPreview.tsx
src/components/sections/RecentGames.tsx
src/components/public/RankingTable.tsx
src/components/public/NationalTeamRankingTable.tsx
src/components/public/TeamStandingTable.tsx
src/components/public/TeamRosterTable.tsx
src/components/public/PlayerProfileHeader.tsx
src/components/public/PlayerAnalytics.tsx
src/components/public/PlayerProfileCharts.tsx
src/components/public/BoxScoreTable.tsx
src/components/public/GameList.tsx
src/components/public/charts/PlayerTrendsChart.tsx
src/components/public/charts/PerformanceTrajectoryChart.tsx
src/components/public/charts/ProfileCharts.tsx
src/app/players/compare/PlayerCompareClient.tsx
src/app/teams/[id]/page.tsx
src/app/games/[id]/page.tsx
src/app/leagues/[id]/page.tsx
src/app/claim/page.tsx
src/app/admin/team-ratings/TeamRatingsPreviewClient.tsx
src/app/admin/players/PlayerManagementClient.tsx
src/app/portal/my-profile/ClaimantProfileClient.tsx
src/app/portal/players/PlayerManagementClient.tsx
docs/branding/PHASE2_MIGRATION_REPORT.md
```
