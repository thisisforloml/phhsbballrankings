# LC1 — Performance Audit

**Audit date:** 2026-06-28

## Bundle / architecture

| Metric | Finding |
|--------|---------|
| `"use client"` components | ~90+ files — expected for interactive public UI |
| `next/dynamic` | **Not used** — no route-level code splitting beyond Next defaults |
| `next/image` | **Single usage** — `PlayerAvatar.tsx` only; logos use `<img>` SVG |
| Framer Motion | Used in `Navbar`, `SearchOverlay` — moderate bundle cost |
| Largest client islands | `PlayerAnalytics.tsx`, `PlayerTrendsChart.tsx`, `RankingsClient.tsx` |

## Observations

### Meaningful optimization opportunities

1. **`PlayerTrendsChart.tsx`** (~980 lines, client-only) — candidate for `dynamic(() => import(...), { ssr: false })` on Analytics tab only. **Effort:** Medium. **Impact:** Reduces initial player profile JS.
2. **`RankingsClient.tsx`** — heavy filter state; already server-prefetches rankings data. Consider virtualizing list if board grows past 500 visible rows. **Effort:** Medium. **Impact:** Low today (pagination exists).
3. **Geist fonts** — loaded via Google Fonts CDN in `layout.tsx` `<head>`. Consider `next/font` self-hosting to reduce layout shift and external dependency. **Effort:** Low. **Impact:** Medium for LCP.

### Not recommended now

- Splitting `PlayerAnalytics` further — high risk, marginal gain.
- Memoizing every stat cell — premature.

## Images & SVG

- Brand SVGs are small static assets in `/public/peach-basket/`.
- No player photos in DB — avatar placeholders avoid image payload.
- `PeachBasketLogo` uses native `<img>` without explicit `width`/`height` — minor CLS risk on navbar.

## Suspense

| Location | Fallback | Assessment |
|----------|----------|------------|
| `/rankings` | `null` | Poor UX; no performance benefit |
| `/players/compare` | Text message | Good |
| Admin pages | `null` | Acceptable internal |

## Server data

- Home, rankings, profiles fetch on server — good for TTFB.
- `teams/page.tsx` uses `force-dynamic` — correct for live standings, prevents static cache.

## Build output

- CSS compiles successfully after Tailwind token merge fix.
- No bundle analyzer run in this audit — recommend `@next/bundle-analyzer` before marketing launch.
