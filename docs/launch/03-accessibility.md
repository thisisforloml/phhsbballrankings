# LC1 — Accessibility Audit

**Audit date:** 2026-06-28  
**Method:** Code review (no automated axe run in this pass).

## Strengths

- **Focus visible:** Global `:focus-visible` outline in `globals.css` (accent orange, 2px).
- **Landmarks:** `aria-label="Main navigation"` on navbar; footer nav labeled.
- **Search:** `aria-label="Open search"` on search button; overlay input labeled.
- **Rating:** `aria-label` on hero rating cards (`PlayerProfileHeader`, `HeroSection`).
- **Charts:** SVG `role="img"` + `aria-label` on trend charts.
- **Sort controls:** Box score sort buttons are native `<button>` elements.
- **Language:** `<html lang="en">` in root layout.

## Gaps

| Severity | Issue | Location |
|----------|-------|----------|
| High | Rankings table is a **div grid**, not `<table>` — screen readers lack column headers | `RankingTable.tsx` |
| High | Game log is scrollable div grid without `role="table"` / column headers for stat columns | `PlayerAnalytics.tsx` |
| Medium | Mobile nav drawer: no `aria-modal`, no focus trap, no `aria-expanded` on menu button | `Navbar.tsx` |
| Medium | Rankings class tabs use `role="tab"` but pairing with `tabpanel` not verified on all breakpoints | `RankingsClient.tsx` |
| Medium | Search overlay: no `aria-live` region for loading / zero results | `SearchOverlay.tsx` |
| Low | `EmptyState` basketball SVG inherits color; `players` icon lacks explicit `aria-hidden` on sports component (parent decorative div) | `EmptyState.tsx` |
| Low | Chart tooltips are mouse-only (`pointer-events-none`) — no keyboard access to datapoint details | Chart components |

## Contrast

- Primary text on `neutral-50` background meets readable contrast.
- Hero white text on `primary-900` gradient — adequate for marketing hero.
- `text-court-500` meta text — verify on `paper-500` in manual pass (likely AA for small text).

## Forms

- Claim page: native inputs without always-visible `<label>` associations (placeholder-only risk).
- Admin forms: generally labeled with visible text.

## Recommendations (safe, post-launch acceptable)

1. Add `aria-live="polite"` to search results container.
2. Add `aria-expanded` + `aria-controls` to mobile menu button.
3. Long-term: semantic `<table>` for rankings or `role="grid"` with proper headers.

## Regression risk

Design System Phase 2 `Numeric` uses `font-mono` — improves stat readability; no accessibility regression observed.
