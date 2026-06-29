# Icons

## Lucide React (general UI)

Continue using [Lucide](https://lucide.dev/) for standard interface icons:

- Navigation: `Menu`, `Search`, `X`, `User`
- Status: `CheckCircle2`, `Lock`, `Star`
- Actions: `ExternalLink`, `Upload`, `Eye`

```tsx
import { Search } from "lucide-react";
```

Do **not** replace Lucide with custom icons for general UI.

## Sports Icons (basketball-specific)

`src/components/icons/sports/index.tsx`

| Icon | Export | Use case |
| --- | --- | --- |
| Basketball | `Basketball` | Scoring, ball possession |
| Basketball court | `BasketballCourt` | Venue, competition |
| Jersey | `Jersey` | Roster, lineup |
| Whistle | `Whistle` | Officials, fouls |
| Shot clock | `ShotClock` | Pace, tempo |
| Coach clipboard | `CoachClipboard` | Coaching, scouting |
| Championship trophy | `ChampionshipTrophy` | Best game, awards |
| MVP badge | `MvpBadge` | Player honors |
| Scouting | `Scouting` | Scouting reports |
| Stat row icons | `StatSportsIcon` | Production tab stat labels |
| Strength badges | `StrengthBadgeIcon` | Intelligence strip |

### Usage

```tsx
import { Basketball, StatSportsIcon } from "@/components/icons/sports";

<StatSportsIcon label="PPG" className="h-5 w-5 text-accent-600" />
```

## Style rules

- 20×20 viewBox
- `stroke="currentColor"` for line icons
- `text-accent-600` or `text-neutral-400` for stat contexts
- Icons are **not** placed inside filled boxes unless the design spec requires it
- `aria-hidden="true"` on decorative icons

## Adding new sports icons

1. Add component to `src/components/icons/sports/index.tsx`
2. Match existing stroke width (1.5) and viewBox
3. Export from the same file
4. Document in this file
