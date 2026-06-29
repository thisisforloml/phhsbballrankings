# LC1 — Mobile Audit

**Audit date:** 2026-06-28  
**Method:** Code review of responsive classes + live dev-server check at `localhost:3004` (mobile nav visible on rankings).

## Viewport summary

| Width | Navigation | Rankings | Player profile | Teams | Notes |
|-------|------------|----------|----------------|-------|-------|
| 320–414px | ✅ Hamburger + drawer | ⚠️ Dense rows | ⚠️ Tab scroll | ⚠️ Table scroll | Expected horizontal scroll on wide tables |
| 768px | ✅ Partial desktop nav | ✅ Usable | ✅ | ✅ | Filter row wraps cleanly |
| 1024px+ | ✅ Full nav | ✅ | ✅ | ✅ | Leader card 3-column layout |

## By surface

### Navigation (`Navbar.tsx`)
- Desktop nav hidden below `lg`; mobile drawer with `AnimatePresence` + slide-in.
- Search opens full overlay; Escape closes.
- **Issue:** Mobile drawer has no focus trap; background scroll not locked (usability, not breakage).

### Rankings (`RankingsClient.tsx`, `RankingTable.tsx`)
- Filter controls stack on narrow viewports.
- Ranking rows are link cards — readable at 320px in browser snapshot.
- Class-year tabs scroll horizontally when needed.

### Player profile
- `PlayerProfileSectionNav` — horizontal tab strip.
- Game log: `min-w-[72rem]` with horizontal scroll — correct pattern.
- Production tab: responsive grid for stat cells.

### Team profile (`teams/[id]/page.tsx`)
- Hero stacks: logo column → identity → record sidebar on `lg+`.
- Roster table follows same scroll pattern as rankings.

### Leagues (`LeaguesClient.tsx`, `LeagueCard.tsx`)
- Card grid collapses to stacked rows on mobile.
- Metric columns center on `md+`.

### Games (`GamesClient.tsx`, `GameList.tsx`)
- Game cards stack; scores use `Numeric` right-aligned.

### Search (`SearchOverlay.tsx`)
- Full-screen overlay; results list scrolls.
- API failure → empty results (no error message) — see error audit.

### Claim profile (`claim/page.tsx`)
- Two-column layout stacks on small screens.
- Form usable at 375px.

### Admin portal
- Separate `AdminLayoutClient`; not optimized for 320px (acceptable for internal users).
- Data tables require horizontal scroll — expected.

## Issues documented

| Severity | Issue | Pages |
|----------|-------|-------|
| Medium | Rankings `Suspense fallback={null}` — blank content flash on slow networks | `/rankings` |
| Low | No focus trap in mobile nav drawer | Global |
| Low | Game log / box score require horizontal scroll | Player, game detail |
| Low | Dense ranking row text on 320px — long school names truncate via card layout | `/rankings` |

## No critical mobile blockers found

Layouts do not clip primary CTAs or navigation at tested breakpoints.
