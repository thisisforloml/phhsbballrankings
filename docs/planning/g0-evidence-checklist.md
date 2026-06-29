# G0 Exit Evidence Checklist

**Authority:** `docs/RANKINGS_ENGINE_BASELINE.md` Appendix B; `docs/RANKINGS_ENGINE_PHASE0_PLAN.md` §7.1  
**Gate:** G0 exit  
**Reviewers:** Product owner + Engineering lead  
**Date completed:** _______________

---

## Instructions

- Mark each criterion **Met**, **Waived** (with waiver ID in `g0-signoff.md`), or **Open** (with owner and target date).
- G0-14 requires all criteria **Met** or **Waived** unless decision is **Hold**.
- Evidence paths must be concrete file paths or signed records.

---

## Checklist (G0-01 – G0-14)

| ID | Criterion | Evidence required | Status | Evidence path / notes | Owner |
|---|---|---|---|---|---|
| **G0-01** | `docs/RANKINGS_ENGINE_BASELINE.md` v1.0 ratified and version recorded | Baseline committed; v1.0 header confirmed | [ ] Met [ ] Waived [ ] Open | `docs/RANKINGS_ENGINE_BASELINE.md` | Rankings architect |
| **G0-02** | ADR index (ADR-001 – ADR-015) published and cross-linked | All ADRs Accepted in index | [ ] Met [ ] Waived [ ] Open | `docs/adr/INDEX.md` | Rankings architect |
| **G0-03** | P0 Amendment A-1 (G7/G7-M split) recorded and traced to ADR-011 | Traceability row in doc validation matrix | [ ] Met [ ] Waived [ ] Open | `docs/planning/doc-validation-matrix.md` §P0-A1 | Rankings architect |
| **G0-04** | P1 Amendment A-2 (G6-before-G4) recorded and traced to ADR-015 | Traceability row in doc validation matrix | [ ] Met [ ] Waived [ ] Open | `docs/planning/doc-validation-matrix.md` §P1-A2 | Rankings architect |
| **G0-05** | WS-1 Rev 2 through WS-7 + Blocker Resolution Package referenced by version in spec index | Spec index matches baseline §5 | [ ] Met [ ] Waived [ ] Open | Baseline §5 + doc validation matrix | Rankings architect |
| **G0-06** | Invariant Registry (INV-01 – INV-17) signed with verification owners | Signed invariant ownership matrix | [ ] Met [ ] Waived [ ] Open | `docs/planning/invariant-ownership-matrix.md` | Rankings architect |
| **G0-07** | Gate approvers identified per baseline §7 | Named approvers in gate matrix | [ ] Met [ ] Waived [ ] Open | `docs/planning/gate-ownership-matrix.md` §Approver Roster | Product owner |
| **G0-08** | `PROJECT_STATUS.md` cross-linked; dual count context documented | Rankings Engine Governance section present | [ ] Met [ ] Waived [ ] Open | `docs/PROJECT_STATUS.md` | Project maintainer |
| **G0-09** | Phase 0 inventories complete (§5.1 – §5.4 expanded to final registers) | Final read, compute, snapshot, eligibility registers | [ ] Met [ ] Waived [ ] Open | See inventory evidence table below | Engineering lead |
| **G0-10** | Risk register reviewed (§6) with owners assigned | Signed risk register | [ ] Met [ ] Waived [ ] Open | `docs/planning/risk-register.md` | Rankings architect |
| **G0-11** | Test strategy outline approved (§3.8) | Engineering lead approval on test strategy | [ ] Met [ ] Waived [ ] Open | `docs/planning/test-strategy-outline.md` | Engineering lead |
| **G0-12** | Rollback playbooks outlined (§3.9) | Data integrity + engineering acknowledgment | [ ] Met [ ] Waived [ ] Open | `docs/planning/rollback-playbooks-outline.md` | Data integrity lead |
| **G0-13** | No gate skipped or combined without explicit waiver record | Gate waiver process doc; empty waiver log or documented waivers | [ ] Met [ ] Waived [ ] Open | `docs/planning/gate-waiver-process.md` | Engineering lead |
| **G0-14** | Product owner + engineering lead G0 sign-off obtained | Completed g0-signoff.md | [ ] Met [ ] Waived [ ] Open | `docs/planning/g0-signoff.md` | Product owner |

---

## G0-09 Inventory Evidence Table

| Register | Initial source (Phase 0 §5) | Final artifact | Status |
|---|---|---|---|
| Read-path (R-READ) | §5.1 | `docs/planning/r-read-inventory.md` | [ ] Final |
| Compute / write-path | §5.2 | `docs/planning/compute-path-register.md` | [ ] Final |
| Snapshot service | §5.3 | `docs/planning/snapshot-service-register.md` | [ ] Final |
| Eligibility service | §5.4 | `docs/planning/eligibility-service-register.md` | [ ] Final |
| Schema delta | §8.1 | `docs/planning/g6-schema-delta.md` | [ ] Final |
| Eligibility duplication map | §5.4 INV-04 | `docs/planning/eligibility-duplication-map.md` | [ ] Final |

**Finding #1 confirmed:** `src/lib/rankings.ts` — live `playerRating.findMany` without `formulaVersionId` filter. Documented in R-READ register; remediation scoped to G6.

---

## Summary

| Status | Count |
|---|---:|
| Met | |
| Waived | |
| Open | |

**Recommendation for G0 sign-off:** [ ] Approve [ ] Conditional [ ] Hold

---

## Reviewer Sign-Off

| Role | Name | Date | Signature / approval ID |
|---|---|---|---|
| Product owner | | | |
| Engineering lead | | | |

---

*Maps to baseline Appendix B and Phase 0 §7.1 — v1.0*
