# Peach Basket Design Strategy

Last updated: 2026-06-28

## Brand

Peach Basket is the public face of OnCourt Rankings PH — a verified youth basketball rankings platform for the Philippines. The visual system uses court navy (`court-900`), paper backgrounds (`paper-500`), hardwood accents, and gold highlights.

## Audiences

| Audience | Primary needs |
| --- | --- |
| **Players** | National rank, rating, verified game history, profile credibility |
| **Parents** | Eligibility clarity, class year, trustworthy verified stats |
| **Coaches** | Roster context, team standings, competition participation |
| **Scouts / Recruiters** | U19 recruiting view by graduation class, national board rank preserved |
| **Teams** | Standings, profiles, league participation |
| **Organizers** | Portal access, submissions, league operations |

## Design principles

1. **Verified first** — rankings and stats come from official games only.
2. **One public shell** — `PublicPageShell`, `PageBand`, `FilterToolbar`, shared tokens on every surface.
3. **National board integrity** — filters narrow the view; rank numbers stay tied to the full board.
4. **Mobile-first** — readable tables, touch-friendly controls, primary nav on all breakpoints.

## Roadmap summary

### Phase 0 — Foundation (current)

- Games in primary navigation
- Live global search wired to `/api/search`
- Auth pages aligned to court/paper tokens
- U19 recruiting class filter on rankings
- Player search page aligned to public shell

### Phase 1 — Core surfaces

- Rankings, player profiles, teams, games, leagues on shared primitives
- Consistent empty/loading states and coverage notices
- Mobile table and filter polish

### Phase 2 — Recruiting depth

- Class-year filters, shareable URLs, scout-oriented copy
- Player comparison and trend views on new primitives
- Enhanced search result metadata (rank, competition context)

### Phase 3 — Trust and transparency

- How We Rank, eligibility, and formula transparency pages unified
- Snapshot freshness and policy provenance in UI
- Accessibility and performance pass on public routes

### Phase 4 — Growth surfaces

- Organizer and premium member flows restyled
- Program/team identity consolidation in public views
- Launch checklist completion and production hardening

## Out of scope for this document

Rankings engine governance (Formula v1/v2, snapshots, eligibility policy) is documented in `docs/RANKINGS_ENGINE_BASELINE.md` and ADRs. This strategy covers public product design and UX only.
