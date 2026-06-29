# TR-6B Team Ratings Validation Report

**Generated:** 2026-06-17T13:40:16.325Z
**Persisted rows:** 66

## Summary

| Result | Count |
| --- | ---: |
| PASS | 11 |
| FAIL | 0 |
| SKIP | 0 |

## Board Index

| Board | Programs |
| --- | ---: |
| U13:BOYS | 8 |
| U16:BOYS | 16 |
| U19:BOYS | 38 |
| U19:GIRLS | 4 |

## Validation Checks

| ID | Status | Detail |
| --- | --- | --- |
| V-TR-21 | PASS | 0 duplicate (programId, ageGroup, gender) keys |
| V-TR-22 | PASS | Rank order stable on all boards (rating → games → program) |
| V-TR-23 | PASS | Board counts match persisted rows (66) |
| V-TR-24 | PASS | 0 deleted-program references |
| V-TR-25 | PASS | 0 orphan ratings (missing program FK target) |
| V-TR-26 | PASS | All rows use TEAM-EVIDENCE-v1-official-import |
| V-TR-27 | PASS | All rows use formula TPI-v1 |
| V-TR-28 | PASS | All rows use TEAM-POLICY-v1-launch |
| V-TR-29 | PASS | PlayerRating untouched baseline (938 rows) |
| V-TR-30 | PASS | Public /teams unchanged when TEAM_NATIONAL_RATINGS_ENABLED=false (flag-gated) |
| V-TR-30b | PASS | 0 duplicate program-name warnings on boards |

## Global Integrity

- Duplicate keys: 0
- Orphan ratings: 0
- Deleted-program refs: 0
- Evidence policy violations: 0

## Rollback

Admin preview is read-only. Remove `/admin/team-ratings` route to roll back TR-6B UI without data impact.
