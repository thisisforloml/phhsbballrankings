# Test Strategy Outline (Planning)

**Authority:** Phase 0 WP-0.8; Phase 0 §9  
**Owner:** Engineering lead  
**Gate:** G0-11 (outline approval); per-gate execution at G1–G7-M  
**Status:** Outline only — no automated test implementation in Phase 0

---

## Test Layers by Gate

| Gate | Test focus | Harness / method | Owner |
|---|---|---|---|
| G1 | WS-1 verdict determinism; P1–P15 precedence | Unit matrix; fixture players | Rankings architect |
| G2 | Policy version resolution; prospective-only | Registry resolution tests | Rankings architect |
| G3 | Merge reassignment; slug alias; rollback | Merge pilot scripts + audit JSON | Data integrity lead |
| G6 | R-READ; backfill counts; public output parity | `validate-ratings-v1*.ts`, `validate-ranking-snapshots-v1*.ts`, browser QA | Engineering lead |
| G4-P | Accumulation math read-only | Bounded universe pilot report | Rankings architect |
| G4 | Lifetime accumulation; lineage records | Count verification vs PROJECT_STATUS | Rankings architect |
| G5 | Carryover prior; threshold exclusion (INV-07) | June rollover dry-run | Rankings architect |
| G7 | Neutral profile weights; v1 preservation | `compare-player-rating-formulas.ts`, `preview-formula-v2.ts` | Rankings architect |
| G7-M | Policy bump rank movement | Policy version A/B comparison | Product owner |

---

## G1 Test Matrix Skeleton (G1-R03)

| Band | Cases | Expected verdict |
|---|---|---|
| P1–P5 | Class year past June 1 of class year | FORMER or HIDDEN |
| P6–P8 | Below gender threshold | PROVISIONAL or HIDDEN |
| P9–P10 | At/above threshold | RANKED (if other rules pass) |
| P11–P13 | Unknown DOB, varying trust | Per ADR-003 |
| P14–P15 | ageGroupOverride cross-bracket | PROVISIONAL per ADR-004 |

**Fixtures:** Minimum 1 player per case; expand during G1 implementation.

---

## R-READ Regression Suite (G6)

| Check | Pre-G6 | Post-G6 |
|---|---|---|
| Public `/rankings` order | Baseline capture | Must match v1-only |
| Player profile trend | Snapshot rows only | Unchanged source |
| No duplicate ratings in UI | N/A today | Required after v2 shadow |
| `currentRatings[0]` usage | Document all sites | Eliminate or guard |

---

## Regression Anchors (UAAP S88 Stable)

| Metric | Value |
|---|---:|
| Active games | 76 |
| GamePerformanceScore | 1,885 |
| PlayerRating | 181 |
| U19 snapshot rows | 138 |

**Checks:**
- Public `/rankings` renders without console errors
- Player profile trend reads snapshot rows only (INV-02)
- Boys ≥10 / Girls ≥5 filtering unchanged until policy version bump

---

## Script ↔ Test Mapping

| Script | Gate | Purpose |
|---|---|---|
| `validate-ratings-v1*.ts` | G6, G4 | Rating count/shape verification |
| `validate-ranking-snapshots-v1*.ts` | G6, G2 | Snapshot integrity |
| `compare-player-rating-formulas.ts` | G7 | v1 vs v2 comparison |
| `preview-formula-v2.ts` | G7 prep | Read-only v2 shadow |
| `diagnose-ranking-snapshots-v1.ts` | G6 | Gap analysis |

---

## Non-Goals (Phase 0)

- No automated test implementation
- No CI pipeline changes
- No test database mutations

---

## Approval

| Role | Outline approved | Date |
|---|---|---|
| Engineering lead | [ ] | |
| Rankings architect | [ ] | |

---

*G0-11 deliverable — v1.0*
