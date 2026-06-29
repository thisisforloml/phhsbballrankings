# Border Radius

Standard values in `src/lib/design-system/tokens.ts` and `tailwind.config.ts`.

| Token | Value | Tailwind | Usage |
| --- | --- | --- | --- |
| Small | 6px | `rounded-sm` | Badges, small chips |
| Medium | 8px | `rounded-md` | Buttons, inputs (default) |
| Large | 12px | `rounded-lg` | Cards, panels, modules |
| XL | 16px | `rounded-xl` | Large cards, leader cards |
| Full | pill | `rounded-full` | Avatars, pills, VS badge |

## Component mapping

| Component | Radius |
| --- | --- |
| Buttons | `rounded-md` |
| Inputs / selects | `rounded-md` |
| Cards / ProfileModule | `rounded-lg` |
| Leader carousel card | `rounded-xl` |
| Badges / pills | `rounded-full` or `rounded-md` |
| Dialogs | `rounded-lg` |
| Dropdowns | `rounded-md` |
| Tables | Square cells; container `rounded-lg` |
| Player avatar | `rounded-full` |

## Rules

- Do not mix `rounded-sm` and `rounded-lg` on nested components without intent.
- Stat mini-cards inside production tab: `rounded` (8px default) or `rounded-lg` for outer shells only.
