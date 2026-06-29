# TR-3.5 Competition Verification Policy Review

**Status:** Planning specification (pre-TR-4 gate)  
**Version:** 1.0  
**Effective:** 2026-06-17  
**Authority:** Rankings architect; subordinate to [TEAM_TPI_SPEC.md](./TEAM_TPI_SPEC.md), [TEAM_TPI_TR3_PILOT_REPORT.md](./audits/TEAM_TPI_TR3_PILOT_REPORT.md), [RANKINGS_ENGINE_BASELINE.md](../RANKINGS_ENGINE_BASELINE.md)  
**Scope:** Policy design only — **no implementation, schema, migrations, or recomputes**

**Machine inventory:** [scripts/reports/game-verification-inventory-latest.json](../../scripts/reports/game-verification-inventory-latest.json)

---

## Executive Summary

Peach Basket today has **405 active games, all `SUBMITTED`, zero `VERIFIED`**. Official staff import creates games as `SUBMITTED` and never promotes them. Player ratings already accumulate from **all** `GamePerformanceScore` rows regardless of `Game.verificationStatus` — the live player board is **de facto** using imported competition evidence.

TPI-v1 spec says **`VERIFIED` only** — strict mode yields **0 games** and blocks TR-4.

### Recommendation: **B — Adopt VERIFIED + approved official imports**

Define team (and align player) evidence as:

```
Game.verificationStatus ∈ { VERIFIED, SUBMITTED }
AND Game.submissionType = STAFF_MANUAL_ENTRY
AND originating Submission.status = IMPORTED
```

Short name: **`TEAM-EVIDENCE-v1-official-import`**

**Operational shortcut (approved data batch):** one-time promotion `SUBMITTED → VERIFIED` for all games tied to `IMPORTED` submissions — equivalent trust, cleaner semantics for external docs.

**Not recommended:** A (VERIFIED-only without promotion) — zero eligible games today.

---

## 1. Inventory — Game Verification States

### 1.1 `Game.verificationStatus` enum

| Status | Meaning (schema) | Active game rows | Source | Trust level | Player rating today | Team TPI today (spec) | Team standings today |
|---|---|---:|---|---|---|---|---|
| **DRAFT** | Unpublished / in progress | 0 | — | None | Excluded (no GPS path) | Excluded | Excluded |
| **SUBMITTED** | Imported, staff-entered, not promoted | **405** | `STAFF_MANUAL_ENTRY` (100%) | **Operational trust** — all via approved import workflow | **Included** (via GPS, no status filter) | Excluded (spec) / **Included** (TR-3 pilot) | **Included** (no status filter) |
| **VERIFIED** | Admin-verified competition result | **0** | — | Highest (intended production) | Would include | Would include | Would include |
| **REJECTED** | Invalid / disqualified | 0 | — | None | Excluded | Excluded | Excluded |
| **DISPUTED** | Under challenge | 0 | — | Hold | Excluded | Excluded | Excluded |

*Inventory date: 2026-06-17. Runner: `scripts/game-verification-inventory.ts`.*

### 1.2 `Game.submissionType` (active games)

| Type | Count | Notes |
|---|---:|---|
| `STAFF_MANUAL_ENTRY` | 405 | Official spreadsheet/JSON import path (`submission-official-import.ts`) |
| `ORGANIZER_PORTAL` | 0 | — |
| `POST_GAME_PORTAL` | 0 | — |

### 1.3 `Submission.status` (workflow)

| Status | Count | Role |
|---|---:|---|
| `IMPORTED` | **46** | All active submissions completed official import |
| `DRAFT` / `SUBMITTED` / `UNDER_REVIEW` / `APPROVED` / `REJECTED` | 0 (active) | — |

**Workflow gap:** Import sets `Game.verificationStatus = SUBMITTED` ([`submission-official-import.ts` L425](../../src/lib/submission-official-import.ts)). **No automated or documented step promotes games to `VERIFIED`.** Post-import processing (`submission-post-import-processing.ts`) requires `Submission.status = IMPORTED` but does not touch game verification.

### 1.4 `League.verificationStatus` (competition trust — separate enum)

| League bucket | Leagues | League status | Active game rows |
|---|---|---|---|
| **UAAP** | HS Boys, HS Girls | **VERIFIED** (2) | 136 |
| **UAAP** | 16U Boys | PROVISIONAL | (included in 136) |
| **NCAA** | Season 101 Junior's | PROVISIONAL | 81 |
| **PYBC** | 4 league name variants | PROVISIONAL | 74 |
| **Stallion** | 4 cup editions | PROVISIONAL | 114 |

League trust and game trust are **decoupled** today: UAAP leagues are `VERIFIED` at league level while every game row remains `SUBMITTED`.

### 1.5 `GamePerformanceScore` linkage

| Game status | GPS rows |
|---|---:|
| SUBMITTED | **9,391** |
| VERIFIED | 0 |

Player `PlayerRating.verifiedGameCount` is derived from GPS count via `loadCumulativeFormulaV1Gps` — **no `Game.verificationStatus` filter** ([`player-rating-cumulative.ts` L51–86](../../src/lib/player-rating-cumulative.ts)).

---

## 2. Consistency Review

### 2.1 Player vs team evidence matrix

| Surface | Filter today | Effective evidence |
|---|---|---|
| **PlayerRating persist** (`loadCumulativeFormulaV1Gps`) | DeletedAt null, GPS exists | **All imported games (SUBMITTED)** |
| **Player admin summaries** (`players.ts`) | `game.verificationStatus = VERIFIED` for stat display | **Stricter than rating persist** |
| **Weekly ratings job** (`weekly-ratings.ts`) | `VERIFIED` only | **Would process 0 games** |
| **Public site games** (`public-site-data.ts`) | `SUBMITTED` + `VERIFIED` | Matches imports |
| **Team standings** (`team-rankings.ts`) | None (active games only) | **All SUBMITTED** |
| **TPI-v1 spec** | `VERIFIED` only | **0 games** |
| **Licensed API** | `VERIFIED` only | **0 games** |

### 2.2 Semantic mismatches

| ID | Mismatch | Severity |
|---|---|---|
| **M-01** | Field `PlayerRating.verifiedGameCount` counts GPS on **SUBMITTED** games, not `VERIFIED` | **High** — naming vs behavior |
| **M-02** | TPI spec `VERIFIED`-only vs TR-3 pilot `SUBMITTED` | **High** — blocks TR-4 |
| **M-03** | `team-rankings.ts` includes all games; TPI would exclude all under strict spec | **Medium** — public inconsistency |
| **M-04** | UAAP `League.verificationStatus = VERIFIED` but games `SUBMITTED` | **Medium** — dual trust model undocumented |
| **M-05** | `weekly-ratings.ts` VERIFIED-only vs production player board from GPS | **Medium** — job unused or broken path |
| **M-06** | No `Game.submissionId` FK — submission approval link is indirect (season + import batch) | **Low** — policy must use proxy rules |

### 2.3 ADR alignment

| ADR | Text | Peach Basket reality |
|---|---|---|
| ADR-002 | "verified games" for eligibility thresholds | Means **stats-backed games**, not `VerificationStatus.VERIFIED` |
| ADR-003 | Competition trust for unknown DOB | Imports treated as trusted evidence |
| TEAM_TPI_SPEC §3.1 | `VERIFIED` only | **Ahead of operational workflow** |

**Conclusion:** Player rankings are operational on **import-approved evidence**. Team TPI must not be stricter than the evidence that already feeds `PlayerRating` without an explicit product decision to drop SUBMITTED games from both systems.

---

## 3. Policy Options

### Option A — VERIFIED only

```
Eligible ⟺ Game.verificationStatus = VERIFIED
```

| Pros | Cons |
|---|---|
| Clean public language | **0 eligible games today** |
| Matches current TPI spec text | Requires mass promotion before any TR-4 work |
| Strongest trust bar | **Contradicts live PlayerRating evidence pool** |

### Option B — VERIFIED + approved official imports (recommended)

```
Eligible ⟺
  Game.verificationStatus ∈ { VERIFIED, SUBMITTED }
  AND Game.submissionType = STAFF_MANUAL_ENTRY
  AND game traceable to Submission.status = IMPORTED
  AND Game.deletedAt IS NULL
```

| Pros | Cons |
|---|---|
| Matches TR-3 pilot and player GPS reality | "SUBMITTED" is weak label externally |
| No schema change required (filter policy) | Needs submission↔game trace rule (season/import audit) |
| All 46 imported competitions eligible | Must document in TEAM-POLICY + How We Rank |

**Variant B′:** Run one-time approved batch: set `VERIFIED` on all IMPORTED-submission games → satisfies Option A going forward.

### Option C — Trust-level model

| Tier | Rule | Games eligible (today) |
|---|---|---:|
| **T1** | `Game.VERIFIED` | 0 |
| **T2** | `Game.SUBMITTED` + `League.verificationStatus = VERIFIED` | **136** (UAAP only) |
| **T3** | `Game.SUBMITTED` + `STAFF_MANUAL_ENTRY` + `IMPORTED` submission | **405** |
| **T4** | `DRAFT` / `REJECTED` / `DISPUTED` | 0 |

TPI launch proposal: **count T2 + T3** (equivalent to Option B for current dataset since T3 ⊃ T2).

| Pros | Cons |
|---|---|
| Future-proof for organizer portal | More complex policy registry |
| UAAP league trust explicit | PYBC stays tier-3 until league promoted |
| Supports weighted trust in TPI-v2 | Requires `policyVersionId` per tier |

### Option D — Alternative: GPS-backed eligibility

```
Eligible ⟺ ∃ non-deleted GamePerformanceScore for Game
```

| Pros | Cons |
|---|---|
| Perfect alignment with PlayerRating | Team forfeit games with 0 stats excluded (PYBC G-2025-025) |
| Single evidence definition | Couples team rating to player stat pipeline |

**Not recommended** for TPI-v1 — team results should count without player box scores per PYBC precedent.

---

## 4. Historical Impact — Competition Eligibility

### 4.1 By policy scenario (active games, 2026-06-17)

| Competition | Game rows | Unique `gameNumber` | Option A (VERIFIED) | Option B (SUBMITTED+import) | Option C (T2+T3) |
|---|---:|---:|---:|---:|---:|
| **PYBC** | 74 | 74* | 0 | **74** | **74** |
| **UAAP** | 136 | 136 | 0 | **136** | **136** |
| **NCAA** | 81 | 81 | 0 | **81** | **81** |
| **Stallion** | 114 | 114 | 0 | **114** | **114** |
| **Other** | 0 | 0 | 0 | 0 | 0 |
| **Total** | **405** | **405** | **0** | **405** | **405** |

\*TR-3 U16 Boys board used **37 deduped games** after collapsing cross-league `gameNumber` collisions between PYBC U13/U16 partitions — TPI compute must use **board-scoped dedupe** regardless of policy.

### 4.2 TPI board impact (from TR-3)

| Board | Option A | Option B |
|---|---|---|
| PYBC U16 Boys (8 programs) | Empty | **8 programs ranked** (validated) |
| PYBC U13 Boys | Empty | 8 programs |
| UAAP U19 | Empty | Blocked until TR-1 identity merge; then ~136 games |
| NCAA U19 | Empty | Eligible post policy |
| Stallion U19 | Empty | Eligible post policy |

### 4.3 Player rating impact

| Policy | Player board change |
|---|---|
| A (VERIFIED only, no promotion) | **Would zero out GPS pool** if enforced on cumulative query — **do not adopt without coordinated player engine change** |
| B | **No change** — aligns spec with current behavior |
| B′ (promote to VERIFIED) | **No rating math change** — semantic cleanup only |

---

## 5. Recommendation

### Decision: **B — Adopt VERIFIED + approved official imports**

| Rationale | Detail |
|---|---|
| TR-3 validated | SUBMITTED_PILOT produced credible PYBC U16 ordering |
| Operational truth | 405/405 games are import-approved `SUBMITTED` |
| Player parity | GPS already counts these games as "verified" for thresholds |
| Zero-game risk | Option A blocks all national team rankings |
| Workflow fit | 46/46 submissions `IMPORTED` — approval gate exists |

### Policy text for `TEAM-POLICY-v1-official-import`

1. **Eligible game:** `verificationStatus ∈ { VERIFIED, SUBMITTED }`, `submissionType = STAFF_MANUAL_ENTRY`, not deleted.
2. **Import approval proxy:** game belongs to a season created/updated by an `IMPORTED` submission (audit via submission import logs / season linkage).
3. **Excluded:** `DRAFT`, `REJECTED`, `DISPUTED`; organizer portal games until workflow approved.
4. **League tier** still from `League.tier` (separate from game verification).
5. **Update TEAM_TPI_SPEC §3.1** to reference policy id, not raw `VERIFIED` enum alone.

### Strongly recommended companion action (not schema)

**Approved one-time batch:** Promote all 405 `SUBMITTED` games from `IMPORTED` submissions to `VERIFIED`. After promotion, Option A and B coincide; external docs stay simple.

---

## 6. Migration Impact

| Area | Schema change? | Recompute? | Snapshot impact | Rollback |
|---|---|---|---|---|
| **Policy B (filter only)** | **No** | TPI compute includes 405 games vs 0 | No team snapshots exist (TR-7) | Revert `policyVersionId` to strict VERIFIED — board empties |
| **Batch VERIFIED promotion** | **No** | Same TPI math; eligibility set unchanged | Player snapshots **unchanged** (GPS already counted) | **Cannot auto-un-promote** without audit log — treat as forward correction |
| **TEAM_TPI_SPEC amend** | No | Re-run TR-3 read-only | None | Doc revert |
| **`ProgramTeamRating` TR-4** | Yes (separate gate) | Initial backfill | N/A until TR-7 | Feature flag off |
| **Player engine** | No if Option B | Only if adding verification filter to GPS query — **not recommended** | None | — |

### Rollback strategy

| Trigger | Action |
|---|---|
| Bad import batch discovered | Set affected games to `REJECTED`; recompute TPI; policy-version bump |
| Policy too permissive | Tighten to Option C (UAAP-only) via new `policyVersionId` |
| Full revert to strict VERIFIED | Board empty until promotion workflow fixed |

### TR-4 gate checklist (add)

- [ ] `TEAM-EVIDENCE-v1-official-import` product sign-off
- [ ] TEAM_TPI_SPEC §3.1 amended to policy reference
- [ ] Decision on batch `SUBMITTED → VERIFIED` promotion (recommended)
- [ ] PYBC `League.tier` set to 2 (separate TR-3 finding)

---

## 7. Cross-References

| Artifact | Update needed |
|---|---|
| [TEAM_TPI_SPEC.md](./TEAM_TPI_SPEC.md) | §3.1 evidence filter → policy id |
| [TEAM_TPI_TR3_PILOT_REPORT.md](./audits/TEAM_TPI_TR3_PILOT_REPORT.md) | Reference this policy |
| [TEAM_RANKINGS_ARCHITECTURE_REVIEW.md](./TEAM_RANKINGS_ARCHITECTURE_REVIEW.md) | TR-3.5 gate before TR-4 |
| [DATA_REMEDIATION_STRATEGY.md](./DATA_REMEDIATION_STRATEGY.md) | Clarify "verified games" vs enum |

---

## Approval

| Role | TR-3.5 sign-off |
|---|---|
| Product owner | [ ] |
| Rankings architect | [x] Spec authored 2026-06-17 |
| Data integrity lead | [ ] |
| Engineering lead | [ ] |

---

*End of TR-3.5 Competition Verification Policy Review*
