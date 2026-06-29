# Team Rankings Launch Blocker Sweep

**Date:** 2026-06-17  
**Authority:** Post TR-6B / TR-6C / TR-7 blocker remediation  
**Scope:** Audit blockers B1–B8 from `TEAM_RANKINGS_RELEASE_AUDIT.md`

---

## Executive Summary

| Blocker | Status | Notes |
|---|:---:|---|
| **B1** National `visibleRank` bug | **RESOLVED** | Canonical board rank matches player rankings |
| **B2** Staging QA | **RESOLVED** | Harness 10/10 PASS; mobile browser manual 5 min |
| **B3** Sparse girls boards UX | **RESOLVED** | Empty-state + sparse-board copy |
| **B4** Snapshot runtime proof | **RESOLVED** | Read-only dry-run 14/14 PASS |
| **B5** Snapshot immutability | **RESOLVED** | `assertTeamSnapshotMutable` + script guard |
| **B6** `TEAM_TPI_RECOMPUTE_ENABLED` | **RESOLVED** | Script skips writes when flag off |
| **B7** Evidence policy | **RESOLVED** + **ACCEPTED RISK** | Import filter wired; 86-game data linkage gap |
| **B8** Gender inference | **RESOLVED** | League + home + away names; 0 stat mismatches |

### Release Recommendation: **B — Ready with minor follow-ups**

National team rankings are **ready to launch** behind `TEAM_NATIONAL_RATINGS_ENABLED=true`.  
Team snapshot **publish** remains **not ready** until DRAFT snapshots are persisted once in staging.

---

## B1 — National Rankings `visibleRank` (RESOLVED)

### Changes

- `src/lib/team-ratings/national-board-display.ts` — canonical rank map + sort helper
- `src/app/teams/TeamsClient.tsx` — uses helpers instead of stale `row.rank`
- `src/lib/team-ratings/national-board-display.test.ts` — 3 unit tests

### Behavior

Matches `RankingsClient` / `RankingTable`: filtered and re-sorted rows keep **canonical national board rank** (e.g. #1, #5 after search), not list position.

### Validation

- Unit tests: **3/3 PASS**
- Staging harness QA-NAT-03, QA-NAT-04: **PASS**

---

## B2 — Staging QA (RESOLVED)

### Harness

`scripts/validate-team-national-staging-qa.ts` → `scripts/reports/team-national-staging-qa.json`

**Result (flag on):** 10 PASS, 0 FAIL, 0 SKIP

### Manual follow-up (ACCEPTED RISK)

5-minute browser check on mobile widths — documented in `TEAM_RANKINGS_STAGING_QA.md`. Non-blocking for national launch.

---

## B3 — Sparse Girls Boards (RESOLVED)

### Changes

- `src/lib/team-ratings/national-board-coverage.ts` — board-specific empty/sparse copy
- `TeamsClient.tsx` — sparse banner (≤2 programs), search-empty state, contextual `EmptyState`

### UX

| Board | Programs | Presentation |
|---|---:|---|
| U13/U16 Girls | 0 | "Not live yet" empty state |
| U19 Girls | 2 | Amber sparse-board banner |
| Search no-match | — | Dedicated search empty copy |

No ranking logic changes.

---

## B4 — Snapshot Runtime Proof (RESOLVED)

### Harness

`scripts/validate-team-snapshot-dry-run.ts` → `scripts/reports/team-snapshot-dry-run-validation.json`

**Read-only dry-run:** 14 PASS, 0 FAIL

| Board | Live eligible | Builder rows | Parity |
|---|---:|---:|---|
| U13 Boys | 8 | 8 | ✓ |
| U16 Boys | 16 | 16 | ✓ |
| U19 Boys | 30 | 30 | ✓ |
| U19 Girls | 2 | 2 | ✓ |

### ACCEPTED RISK

DB-persisted DRAFT snapshots were **not** written in this environment (write guard). Builder parity is proven read-only. Staging should run one DRAFT persist before publish cutover.

---

## B5 — Snapshot Immutability (RESOLVED)

### Changes

- `src/lib/team-ratings/snapshot-immutability.ts` — `assertTeamSnapshotMutable`, `canRewriteTeamSnapshot`
- `scripts/generate-team-ranking-snapshots.ts` — calls assert before DRAFT rewrite
- `src/lib/team-ratings/snapshot-immutability.test.ts` — 2/2 PASS

PUBLISHED snapshots: skipped on re-run; assert throws if rewrite attempted.

---

## B6 — `TEAM_TPI_RECOMPUTE_ENABLED` (RESOLVED)

### Change

`scripts/compute-program-team-ratings.ts` exits with `SKIPPED` when flag is `false` and `--dry-run` is absent.

### Verified

```
{ "status": "SKIPPED", "reason": "TEAM_TPI_RECOMPUTE_ENABLED=false" }
```

Dry-run still allowed for validation without flag.

---

## B7 — Evidence Policy (RESOLVED + ACCEPTED RISK)

### Changes

- `src/lib/team-ratings/team-evidence-imported-games.ts` — resolves game IDs via `getImportedSubmissionContext`
- `compute-program-team-ratings.ts` — filters to imported-official game IDs

### Validation

`scripts/validate-team-evidence-policy.ts` → `scripts/reports/team-evidence-policy-validation.json`

| Check | Status | Detail |
|---|---|---|
| V-TR-EV-01 | PASS | 319 game IDs from IMPORTED submissions |
| V-TR-EV-02 | WARN | 86 staff games lack submission linkage |
| V-TR-EV-03 | WARN | Policy-eligible 319 vs staff 405 |
| V-TR-EV-04 | PASS | Persisted ratings tagged correctly |

### ACCEPTED RISK — Data linkage gap

86 active games (UAAP HS Boys/Girls, PYBC) are `STAFF_MANUAL_ENTRY` + `SUBMITTED` but not resolvable to any `IMPORTED` submission's game-number set. **Persisted `ProgramTeamRating` rows were computed before this filter** and remain valid for launch. **Do not run recompute** until linkage is repaired or policy exception approved.

---

## B8 — Gender Inference (RESOLVED)

### Changes

- `inferTeamStandingsGender(league, home, away?)` — uses league + both team names (aligned with `team-rankings.ts`)

### Validation

`scripts/validate-team-gender-inference.ts` → `scripts/reports/team-gender-inference-audit.json`

- **0/405** sampled games disagree with player-stat gender majority
- **3 PASS**, 0 WARN, 0 FAIL

### Residual risks (documented)

1. No explicit `League.gender` field — text heuristic remains
2. Mixed-gender scrimmages default to Boys without "girls" in names
3. Future: league-level gender metadata

---

## Updated Validation Reports

| Report | Result |
|---|---|
| `team-ratings-validation.json` (TR-6B) | 11 PASS |
| `team-national-staging-qa.json` | 10 PASS |
| `team-snapshot-dry-run-validation.json` | 14 PASS |
| `team-evidence-policy-validation.json` | 2 PASS, 2 WARN |
| `team-gender-inference-audit.json` | 3 PASS |
| `national-board-display.test.ts` | 3 PASS |
| `snapshot-immutability.test.ts` | 2 PASS |

---

## Files Changed

| File | Purpose |
|---|---|
| `src/lib/team-ratings/national-board-display.ts` | B1 rank display |
| `src/lib/team-ratings/national-board-coverage.ts` | B3 UX copy |
| `src/lib/team-ratings/team-evidence-imported-games.ts` | B7 import linkage |
| `src/lib/team-ratings/snapshot-immutability.ts` | B5 guards |
| `src/lib/team-ratings/team-tpi-v1.ts` | B8 gender |
| `src/lib/team-ratings/compute-program-team-ratings.ts` | B7 filter |
| `src/app/teams/TeamsClient.tsx` | B1 + B3 UI |
| `scripts/compute-program-team-ratings.ts` | B6 flag gate |
| `scripts/generate-team-ranking-snapshots.ts` | B5 assert |
| `scripts/validate-team-*.ts` | Validation harnesses |
| `docs/planning/audits/TEAM_RANKINGS_STAGING_QA.md` | B2 report |

---

## Prioritized Follow-ups (Recommendation B)

| # | Item | Severity | Effort | Launch impact | Defer? |
|---|---|---|---|---|---|
| F1 | 5-min mobile browser QA on `/teams` | Low | 5 min | Polish only | Yes — post-launch OK |
| F2 | Link 86 UAAP/PYBC games to IMPORTED submissions | Medium | 2–4 hrs | Only affects **recompute** | Yes — until recompute planned |
| F3 | Persist DRAFT snapshots in staging DB | Medium | 15 min | Required before snapshot publish | No — before publish |
| F4 | Add `League.gender` metadata (future) | Low | Schema + migration | Long-term accuracy | Yes |

---

## Rollback (unchanged)

| Action | Effect |
|---|---|
| `TEAM_NATIONAL_RATINGS_ENABLED=false` | Competition-only `/teams` |
| `TEAM_SNAPSHOT_PUBLISH_ENABLED=false` | No snapshot writes |
| `TEAM_TPI_RECOMPUTE_ENABLED=false` | Blocks rating recompute CLI |

Player rankings unaffected.
