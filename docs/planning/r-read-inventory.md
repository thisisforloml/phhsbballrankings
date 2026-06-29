# R-READ Read-Path Register (Final)

**Authority:** Phase 0 WP-0.3; Risk R-01; INV-01  
**Owner:** Engineering lead  
**Gate:** G6 C.4 (R-READ audit exit criterion)  
**Status:** Initial → Final at M0.4

---

## Finding #1 (Confirmed)

**Location:** `src/lib/rankings.ts`  
**Issue:** Hardcodes `formulaVersionNumber = 1`; `playerRating.findMany` without `formulaVersionId` filter.  
**Impact:** Safe today (single formula rows); **blocks ADR-010 coexistence** and violates R-READ intent.  
**Remediation gate:** G6  
**Risk ID:** R-01

---

## Read-Path Register

| Path | File / route | Data source | Formula filter? | Eligibility filter? | ADR / invariant | G6 R-READ | Classification |
|---|---|---|---|---|---|---|---|
| National boards | `src/lib/rankings.ts` → `getLatestNationalRankings`, `getLatestSnapshot` | Live `PlayerRating` + snapshot metadata | **No** — v1 for snapshot header only; live rows unfiltered | Downstream via `getPublicBoardRows` | INV-01, Finding #1 | **Gap** | Live |
| Board eligibility | `src/lib/public-board-ranks.ts` | In-memory rows | N/A | Boys ≥10, Girls ≥5; age bracket | ADR-002, INV-04 | N/A | Live (filter) |
| Rank display bands | `src/lib/public-rank-display.ts` | Rank number | N/A | N/A | — | N/A | Display |
| Public search | `src/lib/public-search.ts` | `getLatestNationalRankings` + `currentRatings[0]` | **No** on `currentRatings` | Via board rank lookup | INV-01 | **Gap** | Live |
| Homepage / site data | `src/lib/public-site-data.ts` | `getLatestNationalRankings`; direct snapshot query | Partial on snapshot | Via board helpers | INV-01, INV-02 | **Gap** on live | Mixed |
| Player profile | `src/lib/player-profile.ts` | `currentRatings`, GPS v1, snapshot rows for trend | GPS filtered; ratings unfiltered | `getCurrentPublicBoardRankForPlayer` | INV-01, INV-02 | **Gap** | Mixed |
| Players list / API | `src/lib/players.ts`, `src/app/api/rankings/route.ts` | `currentRatings[0]` | **No** | `leaderboardMinimumGamesForGender` | INV-04 risk | **Gap** | Live |
| Rankings pages | `src/app/rankings/page.tsx`, `[gender]/[age]/page.tsx` | `getLatestNationalRankings` | Inherited gap | Inherited | INV-01 | **Gap** | Live |
| Team standings | `src/lib/team-rankings.ts` | Game results / `TeamRating` | N/A | N/A | — | Out of scope | N/A |
| Admin dashboards | `src/app/admin/page.tsx` | Count queries | N/A | N/A | — | Inventory only | Admin |
| Submission audit | `src/lib/submission-audit.ts` | GPS, PlayerRating, snapshots | v1 on GPS/snapshot | N/A | — | Partial | Admin |

---

## Path Classification Matrix

| Classification | Paths | G6 action |
|---|---|---|
| **Live — must filter by public formulaVersionId** | rankings.ts, public-search, players.ts, rankings pages, profile currentRatings | R-READ hardening |
| **Historical — snapshot only** | player-profile trend, snapshot metadata reads | INV-02 verify |
| **Mixed** | public-site-data, player-profile | Split live vs historical filters |
| **Out of R-READ scope** | team-rankings, admin counts | Document only |

---

## Display Impact (G1-R05)

| Route | Verdict rollout impact | Owner |
|---|---|---|
| `/rankings`, `/rankings/[gender]/[age]` | Replace ad hoc filters with WS-1 verdict | Rankings architect |
| `/players/[slug]` | Public rank band from verdict | Rankings architect |
| Public search | Eligibility in results | Engineering lead |
| Homepage | Board highlights | Engineering lead |

---

## G6 R-READ Exit Criteria

- [ ] Every live path in register filters by active public `formulaVersionId`
- [ ] Regression: UAAP S88 public output byte-identical pre/post G6 while serving v1 only
- [ ] No path reads `currentRatings[0]` without version guard
- [ ] R-READ test plan executed per `test-strategy-outline.md`

---

## Expansion Log

| Date | Paths added | Reviewer |
|---|---|---|
| 2026-06-16 | Initial from Phase 0 §5.1 | Rankings architect |

---

*Final sign-off: Engineering lead at G6 close*
