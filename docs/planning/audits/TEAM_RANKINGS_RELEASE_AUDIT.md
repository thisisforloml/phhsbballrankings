# Team Rankings Release Audit

**Audit type:** Read-only, end-to-end release gate  
**Date:** 2026-06-17  
**Scope:** TR-0 through TR-7 (ProgramTeamRating, national `/teams`, snapshots, admin preview, TPI-v1, evidence policy)  
**Authority:** Post TR-6B / TR-6C / TR-7 implementation review

---

## Executive Summary

| Dimension | Verdict |
|---|---|
| **Persistence & data integrity** | **PASS** — 66 `ProgramTeamRating` rows; 0 duplicate keys; 0 deleted-program refs; idempotent recompute proven (TR-5) |
| **Admin preview (TR-6B)** | **PASS** — validation engine 11/11; board metadata complete |
| **Public national cutover (TR-6C)** | **CONDITIONAL** — code complete, flag-gated; UI rank display gap; staging QA incomplete |
| **Team snapshots (TR-7)** | **NOT PROVEN** — schema + builder exist; 0 snapshots; 7/10 runtime checks skipped |
| **Feature-flag safety** | **PASS** — defaults `false`; rollback paths documented |
| **Player ranking isolation** | **PASS** — no writes to `PlayerRating` / `RankingSnapshot` from team paths |
| **Architecture** | **PASS** — parallel tables; `TeamRating` untouched; `TeamFormulaVersion` supports TPI-v2 |

### Release Recommendation: **B — Ready with minor follow-ups**

The codebase is **safe to deploy to production with all team feature flags off** (`TEAM_NATIONAL_RATINGS_ENABLED=false`, `TEAM_SNAPSHOT_PUBLISH_ENABLED=false`). Public behavior remains competition standings only.

**Do not enable public national rankings or snapshot publish** until the blockers in §8 are remediated and staging QA is signed off.

---

## 1. Data Integrity

### 1.1 ProgramTeamRating counts (live)

Source: `scripts/reports/team-ratings-validation.json` (2026-06-17T12:42:42Z)

| Board | Persisted rows | Public-eligible | Below threshold |
|---|---:|---:|---:|
| U13 Boys | 8 | 8 | 0 |
| U16 Boys | 16 | 16 | 0 |
| U19 Boys | 38 | 30 | 8 |
| U19 Girls | 4 | 2 | 2 |
| **Total** | **66** | **56** | **10** |

All rows share single batch `computedAt`: `2026-06-17T12:22:09.140Z`.

### 1.2 Integrity checks

| Check | Result | Evidence |
|---|---|---|
| Duplicate `(programId, ageGroup, gender)` | **0** | V-TR-21, V-TR-16 |
| Deleted-program references | **0** | V-TR-24, V-TR-20 |
| Orphan ratings (missing program) | **0** | V-TR-25 |
| Evidence policy homogeneity | **100%** `TEAM-EVIDENCE-v1-official-import` | V-TR-26 |
| Formula homogeneity | **100%** `TPI-v1` | V-TR-27 |
| Threshold policy homogeneity | **100%** `TEAM-POLICY-v1-launch` | V-TR-28 |
| Duplicate program names per board | **0** | V-TR-30b |
| Recompute idempotency (±0.01) | **PASS** | V-TR-17 (TR-5) |
| `team_ratings` contamination | **0 rows** | V-TR-19 |

### 1.3 Identity assumptions (TR-0 / TR-1)

- TR-3 pilot flagged UAAP same-program duplicate **teams** as identity blockers; TR-1 cleanup allowed UAAP into national compute (U16 Boys board grew from 8 PYBC-only programs to 16 with UAAP).
- Current validation shows **0 duplicate program-name collisions** on any board — TR-1 appears sufficient for persisted national keys.
- **Residual risk (LOW):** Gender is inferred from league/team name strings in TPI load path (`inferTeamStandingsGender`). Mis-inference could assign games to wrong gender board; no automated cross-check exists.

### 1.4 Evidence policy implementation

Implemented filter (`team-evidence-filter.ts`):

- `STAFF_MANUAL_ENTRY`
- `verificationStatus ∈ { SUBMITTED, VERIFIED }`
- Active game / team / program

**Gap vs TR-3.5 written policy (LOW):** Policy doc also references originating `Submission.status = IMPORTED`. Implementation does **not** join to `Submission` — all 405 active games are `STAFF_MANUAL_ENTRY` + `SUBMITTED`, so practical impact today is nil.

---

## 2. Public Ranking Integrity

### 2.1 Sort contract (canonical)

Implemented consistently in:

- `get-admin-program-team-rating-board.ts`
- `get-national-team-rankings.ts`
- `build-team-snapshot-board-rows.ts`

```
ORDER BY rating DESC, verifiedGameCount DESC, program.fullName ASC
rank = ordinal index + 1 (not dense_rank)
```

V-TR-22 confirms stable ordering on all four persisted boards.

### 2.2 National vs admin board scope

| Surface | Row filter |
|---|---|
| Admin `/admin/team-ratings` | All persisted rows per board |
| Public national (flag on) | `publicBoardEligible = true` only |
| Snapshots (TR-7) | Same as public national (Rev 2) |

**Consistency:** Public national board is a **subset** of admin board — by design. U19 Boys shows 30 public programs vs 38 total; U19 Girls shows 2 vs 4.

### 2.3 Public UI rank display (TR-6C)

**Finding (MEDIUM):** `TeamsClient.tsx` assigns `visibleRank` from precomputed `row.rank` even after client-side search filter or column re-sort. Filtered or re-sorted views can show non-contiguous ranks (e.g. #1, #5, #8) or ranks that do not match visible sort order.

**Remediation:** Re-assign `visibleRank = index + 1` after filter/sort in national view, or display stored rank only when sort key is `rank` and no search active.

### 2.4 Board coverage gaps (product, not data corruption)

Persisted boards exist only for:

- U13 Boys, U16 Boys, U19 Boys, U19 Girls

**No rows** for U13 Girls, U16 Girls, or any Girls board except U19. Public `/teams` offers Girls + all age groups — national mode will show **empty state** for most Girls boards. Competition mode still has data where games exist.

---

## 3. Snapshot Integrity

### 3.1 Runtime state

| Metric | Value |
|---|---:|
| `TeamRankingSnapshot` rows | **0** |
| `TeamRankingSnapshotRow` rows | **0** |
| Player `RankingSnapshot` rows | 5 (unchanged) |

Source: `scripts/reports/tr7-team-snapshot-validation-latest.json`

### 3.2 Builder parity (static review)

`buildTeamSnapshotBoardRows()`:

- Reads live `ProgramTeamRating` for board + policy tuple
- Filters `publicBoardEligible`
- Same sort contract as public national board
- Freezes `programName`, counts, rating, rank
- Computes `movement` vs prior `PUBLISHED` snapshot

**Design alignment:** Matches TR-4 Rev 2 spec.

### 3.3 Publish path (static review)

`generate-team-ranking-snapshots.ts`:

| Behavior | Assessment |
|---|---|
| Gated on `TEAM_SNAPSHOT_PUBLISH_ENABLED` | **PASS** — no writes when false |
| Skips if month already `PUBLISHED` | **PASS** — forward-only for published months |
| DRAFT rewrite via delete rows + recreate | **ACCEPTABLE** — DRAFT only |
| `--publish` supersedes prior `PUBLISHED` same board | **PASS** — Rev 2 lifecycle |
| Hard DB immutability on `PUBLISHED` rows | **MISSING** — application-layer only |

### 3.4 Snapshot validation matrix

| ID | Status | Notes |
|---|---|---|
| V-TR-31 | SKIP | No snapshots |
| V-TR-32 | SKIP | No snapshots |
| V-TR-33 | SKIP | No snapshots |
| V-TR-34 | SKIP | No snapshots |
| V-TR-35 | SKIP | No snapshots |
| V-TR-36 | SKIP | No snapshots |
| V-TR-37 | SKIP | No snapshots |
| V-TR-38 | PASS | DRAFT enum in schema |
| V-TR-39 | PASS | Player snapshots unchanged |
| V-TR-40 | PASS | Status guards in script |

**Conclusion:** TR-7 is **architecturally ready** but **operationally unproven**. Require at least one staging dry-run (`DRAFT`) + publish cycle before enabling `TEAM_SNAPSHOT_PUBLISH_ENABLED` in production.

---

## 4. Feature Flag Safety

| Flag | Default | Wired | Rollback |
|---|---|---|---|
| `TEAM_NATIONAL_RATINGS_ENABLED` | `false` | `teams/page.tsx` | Set `false` → competition-only `/teams` |
| `TEAM_SNAPSHOT_PUBLISH_ENABLED` | `false` | `generate-team-ranking-snapshots.ts` | Set `false` → no snapshot writes |
| `TEAM_TPI_RECOMPUTE_ENABLED` | `false` | **Not wired** to `compute-program-team-ratings.ts` | N/A — script can still write if invoked manually |

**Finding (LOW):** `TEAM_TPI_RECOMPUTE_ENABLED` is defined but not enforced on the compute CLI — ops could accidentally recompute without flag. Recommend gating before automated cron.

**Flag-off deploy:** Safe. No public national data loaded; no snapshot writes.

---

## 5. UI Integrity

### 5.1 Admin preview (`/admin/team-ratings`)

| Feature | Status |
|---|---|
| Rank, program, rating, games, opponents, formula, policy, computedAt | Implemented |
| Age / gender filters with URL params | Implemented |
| Validation panel (size, high/low, missing programs) | Implemented |
| Duplicate program-name warnings | Implemented |
| `requireAdminUser()` gate | Implemented |

**Ops risk (MEDIUM):** Dev server may cache stale Prisma client after migration — admin page can render blank until `npx prisma generate` + server restart. Not a production runtime bug if deploy pipeline regenerates client.

### 5.2 Public `/teams` (flag off — current production behavior)

| Feature | Status |
|---|---|
| Competition standings | Unchanged from pre-TR-6C |
| National toggle | Hidden when flag off |
| Empty states | Present |

### 5.3 Public `/teams` (flag on — staging required)

| Feature | Status |
|---|---|
| National / Competition toggle | Implemented |
| National table (TPI, games, opponents) | Implemented |
| Default view = National | Implemented |
| Rank display after filter/sort | **See §2.3 — follow-up** |
| Girls U13/U16 empty boards | Expected empty state; needs copy/UX review |

---

## 6. Architecture Review

### 6.1 Coupling to player rankings

| Concern | Status |
|---|---|
| Writes to `PlayerRating` | **None** |
| Writes to `RankingSnapshot` | **None** |
| Shared formula tables | **None** — `TeamFormulaVersion` ≠ `FormulaVersion` |
| Shared snapshot tables | **None** — parallel `TeamRankingSnapshot*` |
| `/rankings` code paths | **Untouched** |

### 6.2 TeamRating contamination

Season-scoped `team_ratings` table: **0 rows written** during team rollout (V-TR-19). National store is `ProgramTeamRating` only.

### 6.3 TPI-v2 upgrade path

| Mechanism | Ready |
|---|---|
| `TeamFormulaVersion.parameters` JSON | Yes |
| `ProgramTeamRating.teamFormulaVersionId` lineage | Yes |
| Policy version strings on rows + snapshot headers | Yes |
| Separate evidence filter module | Yes |

Forward migration: seed `TPI-v2` row, update compute to target new slug, recompute — no schema change required.

### 6.4 TPI-v1 implementation

- Engine: `team-tpi-v1.ts` (2-pass SOS, k=6, half-life 180d)
- Persistence: `compute-program-team-ratings.ts`
- Evidence: `team-evidence-filter.ts`
- Locked constants in `constants.ts` + seeded `TeamFormulaVersion`

TR-5 validation: PYBC U16 Boys 37 deduped games parity (V-TR-18).

---

## 7. Validation Summary (machine reports)

| Report | PASS | FAIL | SKIP |
|---|---:|---:|---:|
| TR-5 (`tr5-validation-latest.json`) | 8 | 0 | 3 |
| TR-6B (`team-ratings-validation.json`) | 11 | 0 | 0 |
| TR-6A (`tr6a-validation-latest.json`) | 10 | 0 | 0 |
| TR-7 (`tr7-team-snapshot-validation-latest.json`) | 3 | 0 | 7 |

---

## 8. Blockers & Follow-ups

### Required before `TEAM_NATIONAL_RATINGS_ENABLED=true`

| # | Severity | Blocker | Remediation |
|---|:---:|---|---|
| B1 | **MEDIUM** | National UI `visibleRank` does not renumber after search filter or column sort | Re-rank after filter/sort in `TeamsClient` national branch, or document that rank column is canonical only |
| B2 | **MEDIUM** | No completed staging QA with flag on (dual-mode toggle, all age/gender combos, mobile) | Execute manual QA checklist in `TEAM_UNIFIED_ROLLOUT_REPORT.md` §Manual QA |
| B3 | **LOW** | Sparse Girls boards (only U19 Girls; 2 public-eligible) | Product sign-off on empty states + credibility messaging before marketing national board |

### Required before `TEAM_SNAPSHOT_PUBLISH_ENABLED=true`

| # | Severity | Blocker | Remediation |
|---|:---:|---|---|
| B4 | **HIGH** | Zero team snapshots ever generated — parity/immutability unproven at runtime | Staging: `TEAM_SNAPSHOT_PUBLISH_ENABLED=true npx tsx scripts/generate-team-ranking-snapshots.ts` (DRAFT), validate V-TR-31–37, then trial `--publish` |
| B5 | **MEDIUM** | `PUBLISHED` snapshot immutability is convention-only (script skips; no DB trigger) | Document ops policy; optional DB trigger or revoke UPDATE on published rows |

### Recommended ops hardening (non-blocking for flag-off deploy)

| # | Severity | Item | Remediation |
|---|:---:|---|---|
| B6 | **LOW** | `TEAM_TPI_RECOMPUTE_ENABLED` not enforced on compute script | Gate `compute-program-team-ratings.ts` on flag |
| B7 | **LOW** | Evidence filter omits `Submission.IMPORTED` join per TR-3.5 full spec | Add join or document intentional simplification |
| B8 | **LOW** | Gender inference heuristic | Add league-level gender field or audit pass |

---

## 9. Rollback Confirmation

| Scenario | Safe? | Action |
|---|---|---|
| Deploy code, flags off | **Yes** | No user-visible change |
| Disable national after beta | **Yes** | `TEAM_NATIONAL_RATINGS_ENABLED=false` |
| Disable snapshots | **Yes** | `TEAM_SNAPSHOT_PUBLISH_ENABLED=false` |
| Remove admin preview | **Yes** | Delete route + nav only |
| Drop team tables | **Destructive** | See `TEAM_TR5_IMPLEMENTATION_REPORT.md` |

Player rankings and player snapshots: **not affected** by any team rollback path above.

---

## 10. Release Decision Matrix

| Launch target | Decision |
|---|---|
| **Deploy application code (flags off)** | **GO** |
| **Enable admin preview only** | **GO** (after Prisma client refresh on deploy) |
| **Enable public national rankings** | **HOLD** — resolve B1–B3 |
| **Enable team snapshot publish** | **HOLD** — resolve B4–B5 |

---

## 11. Files Inspected (read-only)

- `prisma/schema.prisma` — `ProgramTeamRating`, `TeamFormulaVersion`, `TeamRankingSnapshot*`
- `src/lib/team-ratings/*` — compute, evidence, national read, snapshot builder, validation, flags
- `src/app/admin/team-ratings/*` — admin preview
- `src/app/teams/*` — dual-mode public UI
- `scripts/generate-team-ranking-snapshots.ts`
- `scripts/reports/team-ratings-validation.json`
- `scripts/reports/tr5-validation-latest.json`
- `scripts/reports/tr7-team-snapshot-validation-latest.json`
- `docs/planning/audits/TEAM_TR4_PERSISTENCE_DESIGN.md`
- `docs/planning/audits/TEAM_TR35_COMPETITION_VERIFICATION_POLICY.md`
- `docs/planning/audits/TEAM_UNIFIED_ROLLOUT_REPORT.md`

**No code changes, migrations, or writes were performed during this audit.**

---

*Audit complete. Recommendation: **B — Ready with minor follow-ups**.*
