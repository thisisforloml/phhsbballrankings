# Accessibility

Phase 1 preserves and documents existing accessibility patterns.

## Focus states

Global `:focus-visible` in `globals.css`:

```css
outline: 2px solid #d97706; /* accent-600 */
outline-offset: 2px;
```

Buttons use `focus-visible:ring-2 focus-visible:ring-accent-400`.

## Color contrast

| Pairing | Status |
| --- | --- |
| `neutral-900` on white | AA ✓ |
| `neutral-500` on white | AA for body meta |
| White on `primary-800` | AA ✓ |
| `accent-600` large text on white | AA ✓ |
| `accent-600` small text on white | Use `accent-700` for captions |

## Keyboard navigation

- Navbar account menu: button + dropdown links
- Game log table: sortable headers are `<button>`
- Modals/overlays: ensure focus trap (audit per feature)

## ARIA

- Decorative icons: `aria-hidden="true"`
- Rating displays: `aria-label` with value and stars
- Form labels: associated via `<label htmlFor>` or `sr-only`
- Empty states: meaningful titles, not icon-only

## Typography

- Do not use font size below `0.6rem` for essential content.
- Numeric data: `tabular-nums` for alignment in tables.

## Phase 1 improvements

- Documented focus and contrast standards
- `Numeric` component supports semantic HTML (`as` prop)
- Sports icons include `aria-hidden` by default

## Recommended Phase 2 audits

- Full keyboard pass on admin submission review
- Screen reader test on rankings table sort
- Chart color-blind verification for analytics tabs
