# Project Status and Guardrails

Last updated: 2026-05-18

## Stable Database Counts

Latest stable post-cleanup counts:

| Table | Count |
| --- | ---: |
| Player | 216 |
| Active Game | 76 |
| Active GameStat | 1885 |
| GamePerformanceScore | 1885 |
| PlayerRating | 181 |
| RankingSnapshot | 2 |
| RankingSnapshotRow | 138 |
| League | 2 |
| Season | 2 |

Non-validated old/test games were soft-deleted. The active public dataset now matches the 76 validated UAAP Season 88 games. Do not restore or count non-validated games unless explicitly reviewing archived/test data.

Latest player bio coverage counts:

| Field | Count |
| --- | ---: |
| playersWithNonNullPosition | 95 |
| playersWithNonNullHeightCm | 102 |
| playersWithNonNullBirthDate | 85 |
| playersWithNonNullPhotoUrl | 0 |

## Official Age Groups

Current official age groups:

- U13
- U16
- U19

High school datasets with unknown birth year default to U19 until player bio data is completed and recalculation rules are approved.

## Class Year Planning

Current planned class-year rule:

- January-May birth month: classYear = birthYear + 19.
- June-December birth month: classYear = birthYear + 20.
- Born June 2006 = Class of 2026.
- Born March 2006 = Class of 2025.
- Born December 2005 = Class of 2025.

Ranking eligibility planning:

- Athletes remain ranking-eligible through May 31 of their class year.
- Starting June 1 of their class year, they should be removed from active rankings.
- Unknown birthDate remains eligible for now but should be flagged as missing age/class data.
- This has not been implemented as an exclusion rule yet.

## Formula v1 Star Bands

Formula v1 uses fixed star bands based on adjustedRating:

| Rating | Star Rating |
| --- | ---: |
| < 60 | 1 star |
| 60-69 | 2 stars |
| 70-79 | 3 stars |
| 80-89 | 4 stars |
| 90-100 | 5 stars |

## Public Eligibility

Current launch-stage public ranking eligibility:

- U19 Boys: 10+ verified games
- U19 Girls: 5+ verified games

PlayerRating can exist below public eligibility. RankingSnapshot rows should include only public-eligible players.

## Completed Features

- UAAP Season 88 HS Boys and Girls batch JSON validation.
- Database import for games, players, and game stats.
- Formula v1 methodology document.
- Formula v1 GamePerformanceScore computation for validated imported rows only.
- Formula v1 PlayerRating computation using U19 age group.
- Formula v1 U19 national RankingSnapshot generation for Boys and Girls.
- Duplicate player diagnostic, approved merge plan, merge execution, source JSON canonicalization, and cleanup audit.
- Real database-backed `/rankings` page.
- Real database-backed `/players/[slug]` profile pages.
- Admin player bio editor.
- Server-side signed-cookie portal authentication.
- Admin Portal and Organizer Portal route separation.
- Player bio editor safety audit script.

## Current Routes

Public routes:

- `/rankings`
- `/players/[slug]`

Admin routes:

- `/admin`
- `/admin/players`

Organizer routes:

- `/organizer`
- `/organizer/live-stats`

Portal auth routes:

- `/portal/login`
- `/portal/logout`

Legacy `/portal` routes should redirect to the appropriate Admin or Organizer destination based on authenticated role.

## Guardrails

- Never run migrations without explicit approval.
- Never change the rating formula without explicit approval.
- Never merge, hard-delete, or soft-delete players without explicit approval.
- Never recompute ratings or snapshots unless explicitly requested.
- Never run imports unless explicitly requested.
- Never modify schema unless explicitly requested.
- Treat PlayerRating as the current/latest rating record.
- Treat RankingSnapshot and RankingSnapshotRow as historical public ranking outputs.
- Keep organizer-facing tools limited to data submission workflows.
- Keep admin-only tools limited to internal OnCourt team workflows.

## Standard Validation Commands

Run these only when appropriate and explicitly requested for the task:

```powershell
npx.cmd tsc --noEmit
npx.cmd tsx scripts/validate-ratings-v1.ts
npx.cmd tsx scripts/validate-ranking-snapshots-v1.ts
npx.cmd tsx scripts/audit-player-bio-editor-safety.ts
```
