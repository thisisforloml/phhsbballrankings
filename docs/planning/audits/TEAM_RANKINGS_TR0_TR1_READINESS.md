# Team Rankings TR-0 / TR-1 Readiness Assessment

**Status:** Read-only planning deliverable  
**Date:** 2026-06-17  
**Authority:** Rankings architect (TR-0/TR-1 gate review)  
**Scope:** National Program-based team rankings readiness — **no implementation, schema, or migrations**

---

## Executive Recommendation

**Choose B — Additional cleanup required before pilot.**

TR-0 (fragmentation audit exit) is **not complete**. TR-1 (identity canonicalization) is **blocked** on eight high-impact UAAP same-program duplicate Team pairs (~2,900+ combined GameStats). A read-only TPI pilot (TR-3) on the full dataset would produce **misleading previews** until TD-01 violations under shared `programId` are resolved and TF-E01–E07 are signed off.

---

## 1. Current-State Assessment

### 1.1 What still uses competition-scoped standings

| Surface | Code path | Bucket / key | Semantics |
|---|---|---|---|
| **`/teams` (public)** | `getDynamicTeamStandings()` in `src/lib/team-rankings.ts` | `leagueId:seasonId:gender:identityKey` | W/L standings per competition scope |
| **Homepage team preview** | `getHomeData()` → `getDynamicTeamStandings()` in `src/lib/public-site-data.ts` | Same as above | Top 5 by games played / W-L within competition rows |
| **Non-PYBC identity** | `team-rankings.ts` L141–143 | `identityKey = teamId` | No cross-competition program rollup |
| **PYBC only** | `team-rankings.ts` L141–142 | `identityKey = programId ?? teamId` | Program-level consolidation within synthetic PYBC scope |
| **Legacy helper (unused on homepage)** | `getPublicTeamRankings()` in `public-site-data.ts` | `gender:displayName` | UAAP-validated games only; win% aggregation — **not wired to `/teams`** |
| **`TeamRating` table** | `prisma/schema.prisma` `TeamRating` | `teamId + seasonId` | Exists; **zero public consumption** today |

**Competition-scoped behavior is intentional** for the current `/teams` page when League = **All**: one row per `(league, season, team[, program for PYBC])`, so repeated display names across leagues are expected (TF class **A**).

### 1.2 What already uses Program identity

| Area | Program usage | Notes |
|---|---|---|
| **PYBC team standings** | `programId` as `identityKey` | Post-repair: 8 programs, 37 games, 8 public rows (PROJECT_STATUS) |
| **Import pipeline** | `submission-official-import.ts` + `team-import-matching.ts` | Resolves/creates Program; links Team when `programId` null |
| **PYBC backfill/repair** | Executed 2026-06 | Incorrect `PYBC 15U` program links fixed; duplicate suffix teams merged |
| **Admin Program Management** | Program as school/club anchor | Team-to-Program assignment available |
| **Team profile metadata** | `team-profile.ts` | `resolveProgramIdentity` fallback when `program` relation missing |
| **Player domain** | `Player.currentProgramId` | Profile metadata only — not roster truth |
| **National team ratings** | — | **`ProgramTeamRating` does not exist**; no national program board |

### 1.3 Dataset snapshot (post safe identity cleanup, 2026-06-17)

| Entity | Approx. count | Source |
|---|---:|---|
| Programs (active) | 52 | Safe identity cleanup session |
| Teams (active) | 64 | Safe identity cleanup session |
| Players (active) | 928 | Safe identity cleanup session |
| PYBC programs / games | 8 / 37 | PROJECT_STATUS stable checkpoint |
| UAAP S88 validated games | 76 | PROJECT_STATUS |

*Live DB recount at audit time was attempted; use admin counts to confirm if drift since cleanup.*

---

## 2. National Team Ranking Readiness

### 2.1 Program identity completeness

| Check | Status | Detail |
|---|---|---|
| PYBC one Program per participant | **Pass** | 8 canonical programs; grouping verified |
| All active Teams linked to Program | **Partial** | Shell/orphan cleanup done; **null `programId` count not re-verified post-cleanup** — TI-03 excludes unlinked teams from national board |
| No duplicate Programs per club brand | **Partial** | Safe cleanup retired shells; **fuzzy club duplicates (BBC, Charm, etc.) not classified** (TF-2 pending) |
| One canonical Team per Program per competition scope | **Fail (UAAP)** | **8 UAAP schools** with two active Teams sharing same `programId` and substantial GameStats each ([IDENTITY_INTEGRITY_SWEEP.md](./IDENTITY_INTEGRITY_SWEEP.md)) |
| Import guardrails for future fragmentation | **Partial** | PYBC matcher improved; club alias enforcement (ADR import path) **not yet mandatory** |

### 2.2 Remaining fragmentation risks

| Risk | Severity | Evidence |
|---|---|---|
| **TD-01** same-program duplicate Teams in same scope | **High** | 8 UAAP merge queue items; ~317–493 GameStats per pair |
| **TD-02** same display name, same scope, different `programId` | **Unknown** | TF-2 not run for BBC 17u, Charm, Gold Cross, Chatime, Torch 17u, Amsteel |
| **TD-04** Teams with `programId IS NULL` in active competitions | **Medium** | Not re-queried post-cleanup |
| **PD-01** duplicate Program `fullName` | **Unknown** | Not re-queried post-cleanup |
| **TF-R06** new imports recreate duplicates | **High** | T1 alias enforcement not in production path |
| **Competition vs national UI confusion** | **Medium** | `/teams` still single competition-standings view; `visibleRank` is view-local |

### 2.3 Remaining cleanup requirements (TR-1)

| Priority | Action | Gate |
|---|---|---|
| P0 | Execute **TF-0 through TF-3** per [TEAM_FRAGMENTATION_AUDIT_PLAN.md](../TEAM_FRAGMENTATION_AUDIT_PLAN.md) | TR-0 exit |
| P0 | Approve and execute **UAAP same-program Team merges** (8 schools) | TR-1 |
| P1 | Classify club circuit names (BBC, Charm, etc.) — merge vs expected multi-competition | TR-1 |
| P1 | Re-audit `programId IS NULL` active Teams with games | TR-1 |
| P2 | Mandatory `TeamExternalAlias` on club imports | TR-1 / import hardening |
| P2 | Player `currentProgramId` mismatch (UE vs Letran, 1 player) | Orthogonal to team ratings; low |

---

## 3. ProgramTeamRating Design Validation

### 3.1 Schema requirements (planning — confirmed adequate)

Proposed live store (ADR-T01/T02), **parallel to `PlayerRating`**:

| Field | Type / constraint | Validation |
|---|---|---|
| `programId` | FK → `Program` | Required; TI-03 excludes null |
| `ageGroup` | `U13 \| U16 \| U19` | From game league context per contribution |
| `gender` | `Boys \| Girls` | Inferred from league/team naming (same as standings) |
| `rating` | Decimal TPI | Not win%; normalized with shrinkage |
| `verifiedGameCount` | Int | `Game.verificationStatus = VERIFIED` only |
| `verifiedCompetitionCount` | Int | Distinct league/season scopes |
| `formulaVersionId` | FK | Required for audit trail |
| `policyVersionId` | FK | Min-games threshold versioning |
| `computedAt` | DateTime | Standard |
| **Uniqueness** | `@@unique([programId, ageGroup, gender])` | Matches one national row per board |

**Team snapshots:** separate `TeamRankingSnapshot` + `TeamRankingSnapshotRow` (Option A in architecture review). Do **not** extend player `RankingSnapshot` rows.

**Do not overload `TeamRating`:** season-scoped `teamId + seasonId` is semantically wrong for cross-competition national rating.

### 3.2 Rating methodology assumptions (TR-2 — not yet signed off)

| Assumption | Status | Notes |
|---|---|---|
| TPI independent of `PlayerRating` | Proposed | Team strength ≠ average player rating |
| Inputs from verified `Game` rows only | Proposed | Aligns with player evidence rules |
| Opponent strength via opponent `programId` | Proposed | Requires clean program graph (TR-1) |
| `League.tier` weight once per game | Proposed | Mirror ADR-012 “weight once” principle |
| Exponential recency decay (180-day half-life) | Proposed | Competition standings unchanged |
| Launch thresholds: 8 games / 3 opponents | Proposed | Policy-versioned |
| Bayesian shrinkage for low sample | Proposed | Analogous to player shrinkage |

**Open product questions for TR-2:**

- Programs appearing in multiple age-group leagues in one season — board assignment follows **league.ageGroup** per game (no cross-age pooling).
- June age-group rollover — team boards should follow **same controlled June 1 policy** as player boards (not yet specified in team doc).
- Default/forfeit games (PYBC G-2025-025 precedent) — include in team game count; confirm TPI win/loss points.

### 3.3 Age-group handling

| Rule | Proposal |
|---|---|
| Board separation | One `ProgramTeamRating` row per `(programId, ageGroup, gender)` |
| Game attribution | `Game.season.league.ageGroup` determines which board receives contribution |
| Cross-board same program | Expected — e.g. club with U16 and U19 entries has two national rows |
| Public filters | `/teams` national view filters by age/gender; does not mix boards |
| Recruiting/class-year | **N/A** for teams (player AG-4 pattern does not apply) |

---

## 4. Migration Plan TR-0 through TR-7

### 4.1 Gate status and updated estimates

| Gate | Name | Status (2026-06-17) | Est. remaining | Owner |
|---|---|---|---:|---|
| **TR-0** | Fragmentation audit exit (TF-E01–E07) | **Not started** (partial identity sweep only) | **4–5 d** | Data integrity + product |
| **TR-1** | Identity canonicalization | **Blocked** (8 UAAP TD-01 pairs) | **3–5 d** execution + approval | Data integrity |
| **TR-2** | TPI methodology sign-off | **Spec complete** — [TEAM_TPI_SPEC.md](../TEAM_TPI_SPEC.md); product sign-off pending | **1 d** review | Product + rankings architect |
| **TR-3** | TPI pilot (read-only, bounded) | **Complete** — [TEAM_TPI_TR3_PILOT_REPORT.md](./TEAM_TPI_TR3_PILOT_REPORT.md); **Go: B** | — | Rankings architect |
| **TR-4** | Schema (`ProgramTeamRating` + team snapshots) | Not started | **2–3 d** | Engineering |
| **TR-5** | Live rating persist | Not started | **2–3 d** + validation | Engineering |
| **TR-6** | Public UI cutover (`TEAM_NATIONAL_RATINGS_ENABLED`) | Not started | **3–5 d** | Engineering + public UI |
| **TR-7** | Team snapshot publish | Not started | **1–2 d** + **30 d** stability | Engineering |

**Total critical path (from today):** ~18–26 working days after TR-0/TR-1 unblock, plus 30-day soak before TR-7.

### 4.2 Blockers

| ID | Blocker | Blocks |
|---|---|---|
| **B-1** | TF-E01–E07 incomplete | TR-0, all downstream |
| **B-2** | 8 UAAP same-program duplicate Teams (TD-01) | TR-1, credible TR-3+ |
| **B-3** | Club name fragmentation unclassified (TF-2) | TR-1 sign-off |
| **B-4** | TPI methodology unsigned | TR-3 persist, TR-5 |
| **B-5** | Team policy versioning stub (min games) | TR-4/TR-5 |
| **B-6** | UI wireframes: national vs competition view mode | TR-6 |

### 4.3 Dependencies

| Dependency | Relationship |
|---|---|
| [TEAM_FRAGMENTATION_AUDIT_PLAN.md](../TEAM_FRAGMENTATION_AUDIT_PLAN.md) | TR-0 prerequisite |
| [IDENTITY_INTEGRITY_SWEEP.md](./IDENTITY_INTEGRITY_SWEEP.md) | Input to TR-1 merge queue — **not** a substitute for TF-E01–E07 |
| Player engine G1–G7 | **Orthogonal** — no blocker |
| [SNAPSHOT_POLICY_REV2.md](../SNAPSHOT_POLICY_REV2.md) | Pattern reference for team snapshot governance (TR-7) |
| PYBC repair checkpoints | Regression baseline TF-E04 |
| `docs/RANKINGS_ENGINE_BASELINE.md` | ADR-001 governance mirror |

### 4.4 Suggested immediate next steps (read-only unless approved)

1. **TF-0:** Export `/teams` reproduction matrix for six suspect club names + UAAP League=All screenshot.
2. **TF-2:** Read-only SQL inventory per §2.6 of fragmentation plan.
3. **TR-1 prep:** Dry-run merge impact for 8 UAAP pairs (game counts per Team — already in sweep).
4. **TR-2 kickoff:** Separate `TEAM_TPI_SPEC.md` draft for product review.

---

## 5. Product Recommendation

### Decision: **B — Additional cleanup required before pilot**

| Option | Rationale |
|---|---|
| **A. Proceed directly to ProgramTeamRating pilot** | **Not recommended.** Identity graph has known TD-01 violations at national key (`programId`). Pilot rankings would conflate split Team evidence and cannot pass V-TR-01/V-TR-02 validation. |
| **B. Additional cleanup before pilot** | **Recommended.** Complete TR-0 audit (5 days), execute approved TR-1 UAAP merges, classify club names, then run **bounded read-only TR-3** on PYBC-only + post-merge UAAP subset before TR-4 schema work. |

### Pilot scope after cleanup (suggested TR-3)

1. **Cohort A:** 8 PYBC programs (regression — must match 37 games pooled).
2. **Cohort B:** 8 UAAP schools post-merge (single Team per program per scope).
3. **Exclude** unclassified club names until TF-3 verdict.

### What can proceed in parallel (no schema)

- TR-2 methodology doc and How We Rank copy.
- UI wireframes for national vs competition toggle.
- Read-only TPI prototype script **off production tables** using approved cohort IDs only — still **after** TR-1 for UAAP.

---

## Cross-References Updated

- [TEAM_RANKINGS_ARCHITECTURE_REVIEW.md](../TEAM_RANKINGS_ARCHITECTURE_REVIEW.md) — v1.1 TR-0/TR-1 status
- [TEAM_FRAGMENTATION_AUDIT_PLAN.md](../TEAM_FRAGMENTATION_AUDIT_PLAN.md) — v1.1 audit progress

---

*End of TR-0/TR-1 Readiness Assessment*
