# Component Standards

Phase 1 audits existing components — no visual redesign.

## Buttons

Class: `.button` + `.primary` | `.secondary` | `.accent` | `.ghost` | `.destructive`

- Min height: 40px (`min-h-10`)
- Radius: `rounded-md` (8px)
- Focus: `ring-2 ring-accent-400`

React: `@/components/ui/Button`

## Cards

- Border: `border-neutral-200`
- Radius: `rounded-lg`
- Shadow: `shadow-card`
- Shell classes: `.sports-module`, `.profile-card`, `.login-panel`

## Stat display

| Component | Location | Numeric font |
| --- | --- | --- |
| `Stat` | `@/components/ui/Stat` | Geist Mono ✓ |
| `StatCard` | `@/components/ui/StatCard` | Legacy — migrate gradually |
| `RatingBadge` | `@/components/ui/RatingBadge` | Geist Mono ✓ |
| `Numeric` | `@/components/design-system/Numeric` | Geist Mono ✓ |

## Forms

- Inputs: `min-h-11`, `rounded-md`, `border-neutral-300`
- Focus: `border-accent-500`, `ring-accent-400/40`
- Labels: `text-sm font-medium text-neutral-700`

## Tables

- Head: `.sports-table-head` or `bg-neutral-50` + uppercase labels
- Numeric columns: `font-mono tabular-nums text-right`

## Badges

- `Badge` component + domain badges (`TierBadge`, `VerifiedBadge`, `WinLossPill`)
- Uppercase labels at `text-label` scale

## Empty / loading / error

- `EmptyState` — icon + title + optional action
- `Skeleton` / `LeaderboardSkeleton` — shimmer via `.skeleton`

## Player / team cards

- Homepage leader card: 3-column grid, `PlayerMetaPair`
- Profile header: shared layout with `PLAYER_PROFILE_MAX_WIDTH`

## Consistency gaps (Phase 2 candidates)

- Admin tables still use `font-mono` for labels (should be sans) — low priority
- Mixed `court-*` / `neutral-*` in older admin pages
- Inline `toFixed()` in data layers — migrate to `format/stats.ts`
