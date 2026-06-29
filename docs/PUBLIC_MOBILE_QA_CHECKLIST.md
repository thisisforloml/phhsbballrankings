# Public Mobile QA Checklist

Run on phone width (~390px) and tablet (~768px).

## Routes

- [ ] `/` — hero first fold, board leader carousel, stats strip, no horizontal overflow
- [ ] `/rankings` — filters usable, table scrolls, rank bands readable (`#101-150`)
- [ ] `/teams` — filters, W-L display, long team names wrap
- [ ] `/players/[slug]` — hero name wraps, photo panel, analytics modules stack
- [ ] `/games/[id]` — scoreboard compact, box score scroll with sticky player column

## Player profile specifics

- [ ] Compare CTA visible and links to compare flow
- [ ] Performance trend chart tooltips on tap
- [ ] Game log horizontal scroll; date column sticky on mobile
- [ ] Scouting report readable without clipping
- [ ] Missing metadata hidden (no noisy placeholders)

## Discoverability

- [ ] Search opens and returns players/teams/leagues
- [ ] Team profile reachable from team standings row
- [ ] Empty filter states show guidance on rankings/teams

## Performance

- [ ] Rankings thumbnails load or show initials fallback
- [ ] No layout shift on hero photo load
- [ ] Charts render without jank on scroll
