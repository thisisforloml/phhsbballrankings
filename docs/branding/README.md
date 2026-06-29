# Peach Basket Brand Kit

Design system documentation for Peach Basket — Phase 1 foundation.

## Contents

| Document | Description |
| --- | --- |
| [Brand Guidelines](./brand-guidelines.md) | Overview and principles |
| [Colors](./colors.md) | Palette and semantic tokens |
| [Typography](./typography.md) | Geist + Geist Mono usage |
| [Logo Usage](./logo-usage.md) | SVG assets, clear space, sizes |
| [Icons](./icons.md) | Lucide + Sports Icons library |
| [Spacing](./spacing.md) | Standard spacing scale |
| [Border Radius](./border-radius.md) | Corner radius scale |
| [Shadows](./shadows.md) | Elevation system |
| [Components](./components.md) | UI component standards |
| [Voice & Tone](./voice-and-tone.md) | Communication style |
| [Asset Organization](./asset-organization.md) | File locations |
| [Accessibility](./accessibility.md) | Focus, contrast, ARIA |
| [Component Audit](./component-audit.md) | Consistency review |
| [Phase 1 Summary](./PHASE1_SUMMARY.md) | Deliverables and changes |
| [Phase 2 Migration Report](./PHASE2_MIGRATION_REPORT.md) | Adoption audit and remaining legacy |

## Code entry points

```
src/lib/design-system/tokens.ts   — design tokens (source of truth)
src/lib/format/stats.ts           — statistics formatting utilities
src/components/design-system/     — Numeric typography component
src/components/icons/sports/    — basketball-specific icons
src/lib/brand.ts                — brand name and asset paths
```

## Principles

1. **Preserve visual identity** — navy + hardwood orange UI; peach is brand/marketing only.
2. **Semantic tokens over hardcoded values** — prefer `semantic-*` and `ds-*` classes in new code.
3. **Geist Mono for numbers only** — ratings, stats, rankings, measurements.
4. **Lucide for general UI** — Sports Icons for basketball-specific interfaces.
5. **No page redesigns in Phase 1** — foundation and consistency only.
