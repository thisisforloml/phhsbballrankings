# Component Consistency Audit

Read-only audit — Phase 1. No redesigns performed.

## Buttons ✓ Mostly consistent

- Public site: `.button.primary` / `.secondary`
- Admin: mixed inline styles — **legacy debt**
- Recommendation: migrate admin actions to `Button` component over time

## Cards ✓ Consistent on public site

- `ProfileModule`, `.sports-module`, leader cards share border + radius
- Admin uses `border-surface-200` aliases (same neutral ramp)

## Forms ✓ Consistent on auth flows

- Login/register use `.login-panel` input styles
- Admin forms vary — acceptable for Phase 1

## Stat cards — improving

| Area | Status |
| --- | --- |
| `RatingBadge` | ✓ Geist Mono + `formatRating` |
| `Stat` (ui) | ✓ Geist Mono via `Numeric` |
| `PlayerAnalytics` production cells | ✓ Geist Mono via `Numeric` |
| `StatCard` (legacy) | Still `font-display` — migrate when touched |
| Rankings table | Mixed — Phase 2 |

## Icons ✓ Structured

- Lucide: general UI
- Sports Icons: production tab + future basketball UI
- Removed 150+ lines of duplicate inline SVG from `PlayerAnalytics`

## Formatting — foundation laid

- New code: `@/lib/format/stats.ts`
- Existing: `format.ts`, inline `toFixed` in data layers — migrate incrementally

## Shadows ✓ Documented

- `shadow-card`, `shadow-raised`, `shadow-panel` in active use
- `shadow-ds-*` available for new code

## Border radius ✓ Consistent

- Buttons/inputs: `rounded-md`
- Cards: `rounded-lg`
- Pills: `rounded-full`

## Loading / empty / error ✓

- `EmptyState`, `Skeleton` used on public pages
- Admin has inline empty messages — acceptable

## Priority follow-ups (not Phase 1)

1. Migrate rankings table numbers to `Numeric` + format helpers
2. Admin table header typography (mono → sans for labels)
3. Replace remaining inline SVG outside sports library
4. Open Graph image: consider dedicated SVG or PNG export at 1200×630
