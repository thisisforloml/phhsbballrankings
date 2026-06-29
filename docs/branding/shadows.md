# Shadows & Elevation

## Token scale

| Token | Tailwind | Usage |
| --- | --- | --- |
| Small | `shadow-ds-sm` | Subtle hover, inline chips |
| Medium | `shadow-ds-md` / `shadow-card` | Cards, panels |
| Large | `shadow-ds-lg` / `shadow-raised` | Modals, hero cards |
| Overlay | `shadow-ds-overlay` | Dropdowns, dialogs |

Legacy aliases `shadow-card`, `shadow-panel`, `shadow-raised` remain valid.

## Component mapping

| Component | Shadow |
| --- | --- |
| Cards / modules | `shadow-card` |
| Profile cards (hover) | `shadow-panel` |
| Leader cards / elevated hero | `shadow-raised` |
| Buttons | None (border-based) |
| Dropdowns | `shadow-ds-overlay` (new code) |

## Rules

- One elevation level per surface — avoid stacking multiple shadows.
- No hard offset “comic” shadows.
- Dark surfaces (`primary-900`) typically use border (`border-white/10`) instead of shadow.
