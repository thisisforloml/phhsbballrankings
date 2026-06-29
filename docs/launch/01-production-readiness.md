# LC1 — Production Readiness (Visual)

**Audit date:** 2026-06-28

## Public pages reviewed

| Route | Status | Notes |
|-------|--------|-------|
| `/` | ✅ | Hero, leader card, top-10 board, team preview, games — consistent `container-px`, `hero-brand` |
| `/rankings` | ✅ | Filters, class tabs, `RankingTable` with `Numeric` ratings |
| `/rankings/[gender]/[age]` | ✅ | `generateMetadata` present |
| `/players/[slug]` | ✅ | Profile header, tabs, analytics/production migrated |
| `/players/compare` | ✅ | `Suspense` with text fallback |
| `/players/search` | ✅ | Metadata present |
| `/teams` | ⚠️ | No page-level metadata; standings tables consistent |
| `/teams/[id]` | ✅ | Hero + metrics; partial Numeric adoption on W/L |
| `/leagues` | ⚠️ | No page metadata; `LeagueCard` metrics still `font-display` |
| `/leagues/[id]` | ✅ | KPI metrics use `Numeric` |
| `/games` | ✅ | `EmptyState` for no results |
| `/games/[id]` | ✅ | Hero scores use `Numeric`; box score migrated |
| `/about`, `/how-we-rank`, `/faqs` | ✅ | Marketing pages use unified palette |
| `/claim` | ⚠️ | Client page, no metadata; search + Numeric ratings |
| `/login`, `/register` | ✅ | Stacked SVG logo via `PeachBasketLogo` |

## Strengths

- **Typography:** Geist sans + Geist Mono via `Numeric` on rankings, profiles, box scores, hero stats, search, claim flow.
- **Logos:** `PeachBasketLogo` defaults to SVG (`/peach-basket/*.svg`); PNG fallbacks in `brand.ts`.
- **Icons:** Lucide for UI; `src/components/icons/sports` for basketball-specific (`PlayerAnalytics`, `EmptyState` players icon).
- **Tables:** Rankings, team standings, roster, box score share `sports-table-head` styling and right-aligned numerics.
- **Badges:** `RatingBadge`, `WinLossPill`, age-group pills consistent.
- **Empty states:** `EmptyState` on home rankings, teams preview, games, competition history, player game log; `AdminEmptyState` in admin lists.

## Inconsistencies found

| Area | Location | Issue |
|------|----------|-------|
| Numeric typography | `LeagueCard.tsx` | Team/game counts use `font-display` not `Numeric` |
| Numeric typography | `ProfileCharts.tsx` | Radar point values use `font-display` |
| Numeric typography | `teams/[id]/page.tsx` | W/L counts wrapped in `font-display` parent |
| Prose headings | `PlayerAnalytics.tsx` | Opponent names in best-game card use `font-display` (acceptable for titles) |
| Loading UX | `rankings/page.tsx` | `Suspense fallback={null}` — blank flash while client hydrates |
| Loading UX | Admin layouts | Multiple `Suspense fallback={null}` |
| Player photos | Platform-wide | 0% `photoUrl` coverage per PROJECT_STATUS — avatars are initials placeholders |

## Loading states

- **No** `loading.tsx` anywhere in `src/app/`.
- Client pages rely on inline text (`PlayerCompareClient`) or null Suspense fallbacks.

## Responsive spacing

- `container-px`, `section-y`, and design-system spacing tokens used on public shells.
- Wide stat tables (game log, box score) use intentional horizontal scroll — by design, not a layout bug.

## Manual QA recommended

- [ ] Home leader card at 375px and 1024px
- [ ] Rankings filters + class tabs on mobile
- [ ] Player profile all six tabs
- [ ] Game detail box score horizontal scroll
- [ ] Claim profile search flow

---

## Error state audit

| Mechanism | Present? | Notes |
|-----------|----------|-------|
| `loading.tsx` | ❌ None | No route-level loading UI |
| `error.tsx` | ❌ None | Unhandled errors use default Next boundary |
| `not-found.tsx` | ❌ None | `notFound()` works server-side but unbranded |
| Missing player | ✅ | `players/[slug]/page.tsx` → `notFound()` |
| Missing team | ✅ | `team-profile.ts` → `notFound()` |
| Missing game/league | ✅ | `official-games.ts` loaders |
| Failed search fetch | ⚠️ | `SearchOverlay` → empty results, no error message |
| Broken player images | ✅ | `PlayerAvatar` falls back to initials |
| API portal session fail | ✅ | Navbar catches → `authenticated: false` |

---

## Data consistency audit

| Format | Central helper | Remaining legacy |
|--------|----------------|------------------|
| Ratings | `formatRating` | `player-profile.ts` intelligence row |
| Percentages | `formatPercentage` | Chart data prep in `players/[slug]/page.tsx` |
| Dates | `formatStatDate` | Game list migrated; some ISO slices in home recent games |
| Win/Loss | `formatWinLossRecord` | Scouting prose uses hyphen in `scouting-report.ts` |
| Heights | `formatHeightCm` | Rankings display uses profile strings from server |
| Made/attempt | `formatMadeAttempt` | Fully on box score + game log |
| Per-game averages | `formatDecimal` | Server `lib/` aggregation still uses `.toFixed()` internally |

**Assessment:** Public display layers are largely consolidated. Server-side `lib/` rounding is intentional and does not cause UI inconsistency.
