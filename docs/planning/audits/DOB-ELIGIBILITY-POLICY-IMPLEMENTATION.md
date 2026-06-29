# DOB Eligibility Policy — Implementation Report

**Policy:** Modified option (PENDING public path + 365-day expiration)  
**Effective date:** 2026-06-17  
**Status:** Implemented

## Summary

Introduced `AgeVerificationStatus` (`VERIFIED` | `PENDING`) and `Player.firstRankingEligibilityAt` to allow no-DOB players at launch threshold on the live public board while excluding them from snapshots until DOB is verified.

## Files Changed

| Area | Files |
| --- | --- |
| Schema / migration | `prisma/schema.prisma`, `prisma/migrations/20260617120000_add_player_first_ranking_eligibility_at/migration.sql` |
| Eligibility core | `src/lib/eligibility/types.ts`, `evaluate-eligibility.ts`, `pending-public-policy.ts`, `index.ts` |
| Tests | `evaluate-eligibility.test.ts`, `pending-public-policy.test.ts`, `recruiting-class-filter.test.ts` |
| Public board | `src/lib/public-board-ranks.ts`, `src/lib/rankings.ts`, `src/lib/players.ts`, `src/lib/player-profile.ts` |
| UI | `src/components/public/AgeUnverifiedBadge.tsx`, `RankingTable.tsx`, `PlayerProfileHeader.tsx` |
| Scripts | `scripts/backfill-player-first-ranking-eligibility-at.ts`, `scripts/project-pending-dob-board-impact.ts` |
| Snapshot path (future runs) | `scripts/g3-ranking-snapshot-regeneration.ts` |

## Test Summary

```
30 tests passed (0 failed)
- evaluate-eligibility.test.ts: 20 tests (P7, P9, P10, P11-P14, visibility helpers)
- pending-public-policy.test.ts: 2 tests (expiration fallback, pending path)
- recruiting-class-filter.test.ts: 8 tests (AG-4 compatibility incl. V-AG4-10 pending + unknown class)
```

## Projected Board Impact (live DB, post-backfill)

| Board | Pool | VERIFIED (ranked) | +PENDING | Total public | Snapshot-eligible |
| --- | ---: | ---: | ---: | ---: | ---: |
| U19 Boys | 493 | 59 | 175 | **234** | 59 |
| U19 Girls | 56 | 0 | 45 | **45** | 0 |
| U16 Boys | 253 | 7 | 108 | **115** | 7 |
| U13 Boys | 136 | 0 | 21 | **21** | 0 |

Backfill executed: **344** players assigned `firstRankingEligibilityAt` (170 U19 Boys, 45 U19 Girls, 108 U16 Boys, 21 U13 Boys board-qualified rows; deduped per player).

## Migration Summary

- Migration `20260617120000_add_player_first_ranking_eligibility_at` applied successfully.
- Backfill report: `scripts/reports/first-ranking-eligibility-at-backfill.json`

## Behavior

| Status | birthDate | Live board | Snapshots | Badge |
| --- | --- | --- | --- | --- |
| VERIFIED | present | unchanged | unchanged | none |
| PENDING | missing | visible when P12 path passes | included when `publicRankAllowed` (Rev 2) | Age Unverified |

**Expiration:** `today > (firstRankingEligibilityAt ?? policy effective date) + 365 days` → `publicRankAllowed: false`. Player returns automatically when DOB is supplied.

**Unchanged protections:** P11 UNTRUSTED, P13 escalated DOB, P2/P3/P7/P14, FORMER/HIDDEN precedence.

## Manual QA Checklist

- [ ] Run migration and backfill (`--execute`) in target environment
- [ ] U19 Boys board shows additional PENDING rows with **Age Unverified** badge
- [ ] VERIFIED players unchanged (no badge, same rank ordering among verified)
- [ ] Player profile shows badge for PENDING public players
- [ ] Recruiting view (U19) includes PENDING players; class-year filter + “include unknown” retains null class-year PENDING rows
- [ ] RankingSnapshot rows unchanged (no rewrite); future G3 regen excludes PENDING via `snapshotEligible`
- [ ] UNTRUSTED / escalated DOB players still hidden
- [ ] Supplying DOB on a PENDING player removes badge and enables snapshot eligibility
- [ ] Player with `firstRankingEligibilityAt` older than 365 days drops from public board until DOB added

## Constraints Honored

- No formula, threshold, rating recompute, snapshot rewrite, or DOB fabrication in this change set.
