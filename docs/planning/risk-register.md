# Risk Register — Rankings Engine (Living Document)

**Authority:** `docs/RANKINGS_ENGINE_PHASE0_PLAN.md` §6  
**Maintainer:** Rankings architect  
**Review cadence:** Bi-weekly until G6; monthly thereafter  
**Last reviewed:** _______________

---

## Owner Acknowledgment

| Role | Name | Date | Signature / approval ID |
|---|---|---|---|
| Rankings architect (register integrity) | | | |
| Engineering lead (technical risks) | | | |
| Data integrity lead (merge/identity risks) | | | |
| Product owner (product/cutover risks) | | | |

---

## Risk Ownership Matrix (R-01 – R-18)

| ID | Risk summary | Severity | Owner role | Mitigation owner | Review cadence | Gate linkage |
|---|---|---|---|---|---|---|
| **R-01** | Live reads without formula filter cause duplicate-rating display after G6 | **High** | Engineering lead | Engineering lead | Weekly until G6 close; then per release | G6 |
| **R-02** | `GamePerformanceScore.gameStatId @unique` blocks v2 shadow coexistence | **High** | Engineering lead | Engineering lead | Bi-weekly until G6 | G6, G7 |
| **R-03** | `PlayerRating` lacks `formulaVersionId` — v2 write overwrites v1 | **Critical** | Engineering lead | Engineering lead + Rankings architect | Weekly until G6 close | G6, G4 |
| **R-04** | Eligibility threshold logic duplicated (INV-04 violation) | **Medium** | Rankings architect | Rankings architect | Weekly until G1 close | G1 |
| **R-05** | G4 executed before G6 — non-replayable universe recompute | **Critical** | Rankings architect | Engineering lead + Product owner | At G4 planning gate | G4, G6 |
| **R-06** | Merge during accumulation corrupts lineage | **High** | Data integrity lead | Data integrity lead | Per merge group (G3) | G3, G4 |
| **R-07** | Snapshot publish during open G3-R rollback window | **High** | Data integrity lead | Rankings architect | Per merge group | G3-R |
| **R-08** | Historical snapshots retro-edited on policy change | **High** | Rankings architect | Engineering lead | At G2/G6 design review | G2, G6 |
| **R-09** | Dual dataset counts (181 vs 611) cause wrong backfill scope | **Medium** | Data integrity lead | Project maintainer | Before G6 approval | G6 |
| **R-10** | `weekly-ratings.ts` v2 upsert conflicts with formula registry | **Medium** | Engineering lead | Engineering lead | At G6 planning | G6 |
| **R-11** | G7 tier multipliers or shrinkage activated prematurely | **High** | Product owner | Rankings architect | At G7 and G7-M gates | G7, G7-M |
| **R-12** | Carryover satisfies eligibility threshold (INV-07) | **Medium** | Rankings architect | Rankings architect | At G5 dry-run | G5 |
| **R-13** | League weight double-applied at accumulation (INV-08) | **Medium** | Rankings architect | Rankings architect | At G4-P and G7 validation | G4, G7 |
| **R-14** | Slug redirect missing post-merge (INV-16) | **Medium** | Data integrity lead | Data integrity lead | Per merge tier | G3 |
| **R-15** | Missing `policyVersionId` on snapshots breaks audit replay | **High** | Engineering lead | Rankings architect | At G6 schema review | G6 |
| **R-16** | Formula v2 preview mistaken for production-ready | **Medium** | Product owner | Project maintainer | Quarterly | G7 |
| **R-17** | June rollover run before G5 enablement | **Medium** | Rankings architect | Product owner | Annually (May/June) | G5 |
| **R-18** | Invariant registry unsigned — governance drift from informal decisions | **Low** | Rankings architect | Project maintainer | At G0 close; quarterly | G0 |

---

## Mitigation Detail by Risk

### R-01 — R-READ gap (Finding #1)

| Field | Detail |
|---|---|
| **Description** | `rankings.ts` loads `playerRating` without `formulaVersionId` filter; safe with single formula today, breaks ADR-010 coexistence |
| **Mitigation** | Complete `r-read-inventory.md`; R-READ audit as G6 exit criterion (baseline C.4) |
| **Evidence** | Read-path register; post-G6 regression suite |
| **Residual risk** | Low after G6 if audit complete |

### R-03 — PlayerRating versioning

| Field | Detail |
|---|---|
| **Description** | Current `@@unique([playerId, ageGroup])` allows v2 to overwrite v1 |
| **Mitigation** | P-G6 default path: schema + backfill before any v2 write or G4 persist |
| **Evidence** | `g6-schema-delta.md`; backfill count verification |
| **Escalation** | P-W1 waiver only with Product owner + Engineering lead signed acknowledgment |

### R-05 — G6 before G4

| Field | Detail |
|---|---|
| **Description** | Universe recompute without versioned storage is non-replayable |
| **Mitigation** | ADR-015 locked; gate dependency enforced in `gate-ownership-matrix.md` |
| **Evidence** | G4 approval requires G6 exit or P-W1 waiver record |

### R-06 — Merge before accumulation

| Field | Detail |
|---|---|
| **Description** | Merges mid-accumulation corrupt lifetime lineage |
| **Mitigation** | All 12 approved merge groups complete G3 before G4; WS-4 before WS-5 |
| **Evidence** | Per-group merge audit; no open G3-R windows at G4 entry |

### R-11 — Premature G7 activation profile

| Field | Detail |
|---|---|
| **Description** | Tier multipliers or shrinkage active at G7 cutover |
| **Mitigation** | ADR-011 neutral profile checklist at G7; G7-M separate approval for policy bump |
| **Evidence** | Weight audit before `isPublic=true` on v2 |

### R-18 — Unsigned invariants

| Field | Detail |
|---|---|
| **Description** | Informal chat decisions override locked baseline |
| **Mitigation** | G0 doc validation + `invariant-ownership-matrix.md` sign-off |
| **Evidence** | `g0-signoff.md` D-05 confirmed |

---

## Severity × Review Priority

| Priority | Risk IDs | Standing review |
|---|---|---|
| **P0 — Critical** | R-03, R-05 | Engineering lead + Rankings architect at every gate boundary |
| **P1 — High** | R-01, R-02, R-06, R-07, R-08, R-11, R-15 | Bi-weekly working review |
| **P2 — Medium** | R-04, R-09, R-10, R-12, R-13, R-14, R-16, R-17 | Gate-triggered review |
| **P3 — Low** | R-18 | Close at G0; quarterly spot-check |

---

## Risk Status Log

| Date | Reviewer | Risks updated | Notes |
|---|---|---|---|
| 2026-06-16 | Rankings architect | R-01–R-18 | Initial register with owners assigned (G0 package) |
| | | | |

---

*Living document — update at each gate boundary and bi-weekly until G6*
