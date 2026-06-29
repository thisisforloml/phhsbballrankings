# Spacing

Standard spacing tokens in `src/lib/design-system/tokens.ts`.

| Token | Value | Tailwind class | Typical use |
| --- | --- | --- | --- |
| `xs` | 4px | `ds-xs`, `p-ds-xs` | Tight icon gaps |
| `sm` | 8px | `ds-sm` | Inline clusters, chip padding |
| `md` | 16px | `ds-md` | Card padding, form gaps |
| `lg` | 24px | `ds-lg` | Section internal spacing |
| `xl` | 32px | `ds-xl` | Between major blocks |
| `2xl` | 48px | `ds-2xl` | Section separation |

## Existing layout utilities

These remain in use and align with the scale:

| Class | Effect |
| --- | --- |
| `container-px` | Responsive horizontal page padding |
| `section-y` | Vertical section rhythm |
| `p-4`, `p-5`, `gap-4` | Tailwind defaults (16–20px) — acceptable |

## Guidelines

- Use `gap-ds-md` / `p-ds-lg` in **new** components.
- Do not refactor all existing `p-4` usage in Phase 1.
- Stat rows: prefer `gap-2` (8px) between label and value.
- Card padding: `p-4 md:p-5` or `px-5 py-4 md:px-6`.
