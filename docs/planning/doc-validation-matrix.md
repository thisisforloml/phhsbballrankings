# Documentation Validation Matrix

**Authority:** Phase 0 WP-0.1  
**Owner:** Rankings architect  
**Gate:** G0-03, G0-04, G0-05  
**Status:** Draft — complete at M0.2

---

## P0 Amendment A-1 ↔ ADR-011 (G0-03)

| P0 element | Baseline reference | ADR-011 alignment | Status |
|---|---|---|---|
| G7 cutover uses neutral profile | Baseline §3 G7 profile fork | `shrinkageK=0`, factors `1.00`, tier multipliers inactive | [ ] Verified |
| G7-M activates tier/shrinkage separately | Baseline §3 G7-M | Policy bump via `policyVersionId`, not formula bump | [ ] Verified |
| Public pointer flip at G7 only | Gate registry G7 | `isPublic=true` on v2 after G4 | [ ] Verified |
| v1 lineage preserved | ADR-010 | v1 → RETIRED, not deleted | [ ] Verified |

**Traceability verdict:** [ ] Pass [ ] Gap logged: _______________

---

## P1 Amendment A-2 ↔ ADR-015 (G0-04)

| P1 element | Baseline reference | ADR-015 alignment | Status |
|---|---|---|---|
| G6 before G4 universe | Gate dependency graph §2.3 | G6 → G4 edge mandatory | [ ] Verified |
| G4-P read-only pilot allowed after G3 | Baseline §6 Phase C/D | Parallel G6 prep permitted | [ ] Verified |
| P-W1 waiver path documented | Baseline §3 P-W1 fork | v1-only G4 with signed acknowledgment | [ ] Verified |
| G4-P non-persisting | Gate G4-P exit criterion | Read-only validation only | [ ] Verified |

**Traceability verdict:** [ ] Pass [ ] Gap logged: _______________

---

## WS-1 Rev 2 Field Coverage (ADR-002–004, ADR-013)

| WS-1 payload field | ADR | Snapshot row freeze (ADR-013) | Status |
|---|---|---|---|
| `verdict` | ADR-002–004 | Minimum subset | [ ] |
| `provisionalReason` / `exclusionReason` | ADR-004 | Minimum subset | [ ] |
| `ratingAgeGroup`, `evaluatedBoard`, `evaluationDate` | WS-1 | Minimum subset | [ ] |
| `snapshotEligible` | WS-2 | Minimum subset | [ ] |
| `formulaVersionId`, `policyVersionId` | ADR-013 | Header + row | [ ] |
| `competitionAgeGroup` | ADR-004 | Minimum subset | [ ] |
| `competitionTrustLevel` | ADR-003 | Minimum subset | [ ] |
| `classYearStatus` | ADR-002 | Minimum subset | [ ] |
| `gamesQualified`, `verifiedGameCount` | ADR-002, ADR-008 | Minimum subset | [ ] |
| Verdict hierarchy P1–P15 | WS-1 Rev 2 | N/A (G1 implement) | [ ] Not implemented |

---

## WS-4 Rev 2 Compliance (R2-a – R2-e)

| Amendment | Requirement | ADR / gate | Status |
|---|---|---|---|
| R2-a | Slug-alias redirect for soft-deleted sources | ADR-014, INV-16 | [ ] |
| R2-b | Forward-correction taxonomy (Split, Re-canonicalize) | G3-F | [ ] |
| R2-c | Snapshot publish locked during G3-R | G3-R ops block | [ ] |
| R2-d | Risk-tiered pilot Tier 1 → 2 → 3 | G3-P | [ ] |
| R2-e | Canonical precedence order documented | WS-4, merge plans | [ ] |

**Reviewer:** Data integrity lead — Date: _______________

---

## Blocker Resolution Sign-Off (B1, B2, B3, H1)

| Blocker | Resolution summary | ADR | Incorporated in baseline | Status |
|---|---|---|---|---|
| **B1** | Carryover as discounted prior; G7 neutral profile | ADR-009, ADR-011 | §1, §3, §4 INV-07/13 | [ ] |
| **B2** | Merge slug aliasing | ADR-014 | §1, §4 INV-16 | [ ] |
| **B3** | Formula versioning coexistence; G6 before G4 | ADR-010, ADR-015 | §1, §3, §4 INV-09 | [ ] |
| **H1** | Snapshot policy + row provenance | ADR-013 | §1, §4 INV-14/15 | [ ] |

---

## Spec Index Cross-Check (G0-05)

| Document | Version | Baseline §5 status | Path confirmed | Status |
|---|---|---|---|---|
| P0 Governance Memo (+ A-1) | Approved | Locked | _______________ | [ ] |
| P1 Implementation Plan (+ A-2) | Approved | Locked | _______________ | [ ] |
| WS-1 Eligibility | Rev 2 | Locked | _______________ | [ ] |
| WS-2 Snapshot Lifecycle | Rev 1 | Locked | _______________ | [ ] |
| WS-3 Policy Versioning | Rev 1 | Locked | _______________ | [ ] |
| WS-4 Merge Framework | Rev 2 | Locked | _______________ | [ ] |
| WS-5 Lifetime Accumulation | Rev 2 | Locked | _______________ | [ ] |
| WS-6 Carryover | Rev 2 | Locked | _______________ | [ ] |
| WS-7 Formula Versioning | Rev 1 | Locked | _______________ | [ ] |
| Blocker Resolution Package | 1.0 | Locked | _______________ | [ ] |

---

## Validation Summary

| Section | Pass | Gaps |
|---|---|---|
| P0 A-1 | [ ] | |
| P1 A-2 | [ ] | |
| WS-1 fields | [ ] | |
| WS-4 R2-a–e | [ ] | |
| Blockers B1/B2/B3/H1 | [ ] | |
| Spec index | [ ] | |

**Signed:** Rankings architect — Date: _______________

---

*WP-0.1 deliverable — expand paths during M0.2*
