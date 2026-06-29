# Colors

## Application palette

Documented in `src/lib/design-system/tokens.ts`. Tailwind classes use the existing ramps:

| Token family | Tailwind prefix | Role |
| --- | --- | --- |
| Primary | `primary-*` | Navy structural color |
| Accent | `accent-*` / `hardwood-*` / `gold-*` | Orange emphasis |
| Neutral | `neutral-*` / `surface-*` / `ink-*` | Grays |
| Success | `success-*` / `win-*` | Positive state |
| Warning | `warning-*` | Caution |
| Danger | `danger-*` / `loss-*` | Error / loss |

Legacy aliases (`court`, `paper`, `line`, `navy`, `amber`) map into this palette — existing class names continue to work.

## Semantic tokens

Use in new code via Tailwind `semantic-*` or imports from `@/lib/design-system`:

| Semantic | Value | Usage |
| --- | --- | --- |
| `semantic-primary` | Primary-800 | Brand anchor |
| `semantic-secondary` | Neutral-600 | Secondary actions |
| `semantic-accent` | Accent-600 | Emphasis |
| `semantic-background` | Neutral-50 | Page background |
| `semantic-surface` | White | Cards, panels |
| `semantic-border` | Neutral-200 | Borders |
| `semantic-muted` | Neutral-100 | Subtle fills |
| `semantic-success` | Success-600 | Verified, win |
| `semantic-warning` | Warning-600 | Caution |
| `semantic-error` | Danger-600 | Errors |
| `semantic-info` | Primary-500 | Informational |
| `semantic-textPrimary` | Neutral-900 | Headings, body |
| `semantic-textSecondary` | Neutral-500 | Captions, meta |

## Brand peach (marketing only)

| Token | Hex | Usage |
| --- | --- | --- |
| `brand-peach` | `#F4A261` | Logo accents, marketing |
| `brand-peachLight` | `#FCE4D0` | Marketing backgrounds |
| `brand-peachDark` | `#C96B2E` | Marketing contrast |

## Migration guidance

- Prefer `semantic-*` and `primary-*` / `accent-*` / `neutral-*` in new components.
- Do not bulk-rename legacy `court-*` / `hardwood-*` classes in Phase 1.
- Never introduce peach as a UI chrome color.

## Accessibility

- Body text on white: `neutral-900` on `neutral-0` — passes WCAG AA.
- Accent orange on white: use `accent-700` or darker for small text.
- Focus ring: `accent-400` (see `globals.css` `:focus-visible`).
