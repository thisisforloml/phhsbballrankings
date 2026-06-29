# Typography

## Fonts

| Font | Role | Loaded in |
| --- | --- | --- |
| **Geist** | Headings, body, nav, buttons, forms, labels | `src/app/layout.tsx` |
| **Geist Mono** | Numbers only | `src/app/layout.tsx` |

```html
family=Geist:wght@100..900&family=Geist+Mono:wght@100..900
```

## Type scale (Tailwind)

| Token | Size | Usage |
| --- | --- | --- |
| `text-display` | 3.25rem | Hero headlines |
| `text-title` | 2rem | Page titles |
| `text-heading` | 1.25rem | Section headings |
| `text-label` | 0.7rem | Eyebrows, kickers |
| `text-stat-xl` … `text-stat-sm` | 4.5rem → 1.5rem | Large numeric displays |

## Numeric typography

Use **Geist Mono** for:

- Ratings, rankings, percentiles
- Statistics (PPG, RPG, APG, etc.)
- Heights, weights, jersey numbers
- Shooting percentages, plus/minus
- Game IDs, scores, dates in tables

### Components

```tsx
import { Numeric } from "@/components/design-system/Numeric";

<Numeric size="lg">91.4</Numeric>
```

### Utility classes

```html
<span class="font-numeric">23.4</span>
<span class="numeric-md">63.8%</span>
```

### Do not use Geist Mono for

- Player names, school names, league names
- Button labels, navigation, paragraphs
- Error messages or marketing copy

## Statistics formatting

Centralized in `src/lib/format/stats.ts`:

```tsx
import { formatRating, formatPercentage, formatMinutesPerGame } from "@/lib/format/stats";

formatRating(91.42);        // "91.4"
formatPercentage(63.84);      // "63.8%"
formatMinutesPerGame(31.2);   // "31.2 MPG"
```

Do not duplicate `toFixed()` logic in components — use these helpers.
