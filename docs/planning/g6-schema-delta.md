# G6 Schema Delta Specification (Planning)

**Authority:** Phase 0 WP-0.2; ADR-010, ADR-013; Risk R-02, R-03, R-15  
**Owner:** Engineering lead  
**Gate:** G6 planning (not execution)  
**Status:** Planning only — no migrations authorized

---

## Schema Delta Summary

| Model | Current constraint | Target (ADR-010 / ADR-013) | Risk | Mitigation plan |
|---|---|---|---|---|
| `GamePerformanceScore` | `gameStatId @unique` | `@@unique([gameStatId, formulaVersionId])` | Migration must not drop v1 scores | Add column/index; backfill v1; drop old unique in controlled migration |
| `PlayerRating` | `@@unique([playerId, ageGroup])` | Add `formulaVersionId`; `@@unique([playerId, ageGroup, formulaVersionId])` | v2 overwrites v1 if unaddressed | R-READ before v2 insert; P-G6 before G4 |
| `RankingSnapshot` | No `policyVersionId`, no status | Add per ADR-013, WS-2 lifecycle | Existing snapshots lack new fields | Prospective-only; nullable → required on new publishes |
| `RankingSnapshotRow` | 5 core fields | Add WS-1 verdict provenance subset | Row width increase | Publish-time population only |
| `LeagueSeasonAverage` | `seasonId @unique` | Optional formula versioning | v2 PPP collision | Defer to G6 optional C.5 |
| `FormulaVersion` | `isPublic`, `weights` Json | Registry with frozen ACTIVE/RETIRED weights | In-place edits violate INV-12 | New version or policy bump |

---

## Backfill Sizing Table

| Table | UAAP S88 stable | Broader dataset | G6 scope decision |
|---|---:|---:|---|
| GamePerformanceScore | 1,885 | 6,340 | Confirm before G6 approval (R-09) |
| PlayerRating | 181 | 611 | Confirm before G6 approval (R-09) |
| RankingSnapshot | 2 | 3 | Existing rows: nullable new fields |
| RankingSnapshotRow | 138 | 511 | New publishes populate provenance |

**Default recommendation:** Plan backfill for agreed production scope; document dual context in PROJECT_STATUS.

---

## Snapshot Header Delta (ADR-006, ADR-013)

| Field | Current | Target | Phase |
|---|---|---|---|
| `formulaVersionId` | Present | Retain | G6 |
| `policyVersionId` | Missing | Required on new publishes | G6 |
| `status` | Missing | DRAFT → PUBLISHED → SUPERSEDED | G2 design; G6 implement |
| `weekOf` | Present (monthly) | Retain per WS-2 | G2 |

---

## Snapshot Row Provenance Gap (WS-1 / ADR-013)

Minimum subset to add at publish (maps to WS-1 payload):

- `verdict`, `provisionalReason`, `exclusionReason`
- `gamesQualified`, `verifiedGameCount`
- `competitionAgeGroup`, `classYearStatus`
- `policyVersionId` (row-level or inherited from header — design at G2/G6)

---

## Formula Registry Inventory

| Concern | Current state | G6 target |
|---|---|---|
| Public formula count | Single v1 effectively public | Registry enforces INV-10 at G7 |
| `weekly-ratings.ts` anomaly | Upserts `FormulaVersion` v2 | Align or deprecate (R-10) |
| v1 backfill | N/A column | All existing rows → v1 `formulaVersionId` |
| Weight mutability | Json field editable | INV-12 enforcement in admin/write paths |

---

## Merge Alias Readiness (ADR-014)

| Concern | Inventory action | Gate |
|---|---|---|
| `PlayerAlias` table | Document current rows and slug resolution path | G3 prep |
| Slug redirect | Verify resolution consults alias map | G3-P |
| See also | `docs/planning/merge-alias-inventory.md` (to expand) | G3 |

---

## v1 Backfill Verification Plan (G6 exit)

1. Count GPS rows without `formulaVersionId = v1` → expect **0** post-backfill.
2. Count `PlayerRating` rows → match agreed scope (181 S88 or broader).
3. Public board output **byte-identical** pre/post G6 while serving v1 only.
4. v1 GPS count unchanged after v2 shadow begins (INV-09).

---

## P-G6 vs P-W1

| Path | When | Residual risk |
|---|---|---|
| **P-G6** (default) | Schema before G4 | Lowest; enables v2 shadow |
| **P-W1** (waiver) | Emergency v1-only G4 | v2 blocked longer |

See `docs/planning/p-g6-vs-p-w1-brief.md` for decision brief.

---

**Planning sign-off:** Engineering lead — Date: _______________  
**Architecture review:** Rankings architect — Date: _______________

---

*No migrations authorized by this document — G6 approval required*
