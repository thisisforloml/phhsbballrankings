# G0 Sign-Off Record — Governance Freeze

**Gate:** G0 · Governance freeze  
**Baseline:** `docs/RANKINGS_ENGINE_BASELINE.md` v1.0  
**Phase plan:** `docs/RANKINGS_ENGINE_PHASE0_PLAN.md` v1.0  
**Closure package:** `docs/planning/G0_CLOSURE_PACKAGE.md`  
**Effective date:** _______________

---

## Decision

Select **one**:

- [ ] **Approve** — G0 exit criteria met (or conditionally met per scope below). Phase A (G1) planning authorized.
- [ ] **Conditional** — G0 closed with documented open items. G1 planning authorized only within stated scope.
- [ ] **Hold** — G0 not closed. G1 not authorized. Blockers listed below.

---

## Approver Information

| Field | Product owner | Engineering lead |
|---|---|---|
| **Name** | | |
| **Title / role** | Product owner | Engineering lead |
| **Date** | | |
| **Signature / approval ID** | | |

### Supporting acknowledgments (required before Approve)

| Role | Name | Date | Signature / approval ID |
|---|---|---|---|
| Rankings architect | | | |
| Data integrity lead | | | |
| Project maintainer | | | |

---

## Artifacts Reviewed

Confirm review of each artifact at sign-off:

| # | Artifact | Path | Reviewed |
|---|---|---|---|
| 1 | Rankings Engine Baseline Package v1.0 | `docs/RANKINGS_ENGINE_BASELINE.md` | [ ] |
| 2 | Phase 0 Implementation Plan v1.0 | `docs/RANKINGS_ENGINE_PHASE0_PLAN.md` | [ ] |
| 3 | ADR Index (ADR-001 – ADR-015) | `docs/adr/INDEX.md` | [ ] |
| 4 | G0 Closure Package | `docs/planning/G0_CLOSURE_PACKAGE.md` | [ ] |
| 5 | Invariant ownership matrix | `docs/planning/invariant-ownership-matrix.md` | [ ] |
| 6 | Risk register with owners | `docs/planning/risk-register.md` | [ ] |
| 7 | Gate ownership matrix | `docs/planning/gate-ownership-matrix.md` | [ ] |
| 8 | Artifact registry | `docs/planning/artifact-registry.md` | [ ] |
| 9 | G0 evidence checklist | `docs/planning/g0-evidence-checklist.md` | [ ] |
| 10 | G1 entry checklist | `docs/planning/g1-entry-checklist.md` | [ ] |
| 11 | Doc validation matrix | `docs/planning/doc-validation-matrix.md` | [ ] |
| 12 | R-READ read-path register (final) | `docs/planning/r-read-inventory.md` | [ ] |
| 13 | G6 schema delta spec | `docs/planning/g6-schema-delta.md` | [ ] |
| 14 | Test strategy outline | `docs/planning/test-strategy-outline.md` | [ ] |
| 15 | Rollback playbooks outline | `docs/planning/rollback-playbooks-outline.md` | [ ] |
| 16 | PROJECT_STATUS cross-link | `docs/PROJECT_STATUS.md` §Rankings Engine Governance | [ ] |

---

## Ratified Decisions (confirm at sign-off)

| ID | Decision | Source | Confirmed |
|---|---|---|---|
| D-01 | P0 Amendment A-1: G7/G7-M split (neutral profile at G7) | P0, ADR-011 | [ ] |
| D-02 | P1 Amendment A-2: G6 before G4 universe recompute | P1, ADR-015 | [ ] |
| D-03 | WS-4 Rev 2 merge framework (R2-a through R2-e) | WS-4, baseline §5 | [ ] |
| D-04 | Blocker resolutions B1, B2, B3, H1 incorporated | Blocker Package | [ ] |
| D-05 | Invariant Registry INV-01 – INV-17 acknowledged | baseline §4 | [ ] |
| D-06 | Gate sequence G0 → G1 → G2 → G3 → G6 → G4 → G7 → G7-M | baseline §3, ADR-015 | [ ] |
| D-07 | Dual count context: S88 stable vs broader write-plan dataset | Phase 0 §Document Control | [ ] |

---

## G0 Evidence Summary

Reference: [`g0-evidence-checklist.md`](g0-evidence-checklist.md)

| Criterion | ID | Status at sign-off |
|---|---|---|
| Baseline v1.0 ratified | G0-01 | [ ] Met / [ ] Waived / [ ] Open |
| ADR index published | G0-02 | [ ] Met / [ ] Waived / [ ] Open |
| P0 A-1 recorded | G0-03 | [ ] Met / [ ] Waived / [ ] Open |
| P1 A-2 recorded | G0-04 | [ ] Met / [ ] Waived / [ ] Open |
| WS-1–WS-7 + blockers indexed | G0-05 | [ ] Met / [ ] Waived / [ ] Open |
| Invariants signed with owners | G0-06 | [ ] Met / [ ] Waived / [ ] Open |
| Gate approvers identified | G0-07 | [ ] Met / [ ] Waived / [ ] Open |
| PROJECT_STATUS cross-linked | G0-08 | [ ] Met / [ ] Waived / [ ] Open |
| Inventories final | G0-09 | [ ] Met / [ ] Waived / [ ] Open |
| Risk register with owners | G0-10 | [ ] Met / [ ] Waived / [ ] Open |
| Test strategy approved | G0-11 | [ ] Met / [ ] Waived / [ ] Open |
| Rollback playbooks approved | G0-12 | [ ] Met / [ ] Waived / [ ] Open |
| No gate skip without waiver | G0-13 | [ ] Met / [ ] Waived / [ ] Open |
| G0 sign-off obtained | G0-14 | [ ] Met |

**Open items count:** _____  
**Waivers count:** _____

---

## Conditional Approval Scope (if applicable)

| Open item ID | Description | Owner | Target date | G1 impact |
|---|---|---|---|---|
| | | | | |
| | | | | |

**Authorized G1 scope under conditional approval:**

> _Describe what G1 work is authorized despite open items (e.g., verdict payload design only; no display path changes)._

---

## Hold Blockers (if applicable)

| Blocker ID | Description | Owner | Resolution path |
|---|---|---|---|
| | | | |
| | | | |

---

## Waivers Issued (if any)

| Waiver ID | Gate / invariant | Justification | Approver | Date |
|---|---|---|---|---|
| | | | | |

---

## Post-Sign-Off Actions

| Action | Owner | Due |
|---|---|---|
| Update gate status in PROJECT_STATUS cross-link section | Project maintainer | Within 1 business day |
| Archive signed PDF or approval record reference | Product owner | Within 1 business day |
| Kick off G1 planning per G1 entry checklist | Rankings architect | Upon Approve |
| Schedule first risk register review (High/Critical) | Rankings architect | Within 2 weeks |

---

## Signature Block

**Product owner certification:**

I certify that the Rankings Engine governance baseline (G0) has been reviewed per the evidence checklist. My decision is marked above.

Name: ___________________________  
Date: ___________________________  
Signature / approval ID: ___________________________

**Engineering lead certification:**

I certify that Phase 0 inventories, migration risk assessment, and implementability of the invariant registry have been reviewed. My decision is marked above.

Name: ___________________________  
Date: ___________________________  
Signature / approval ID: ___________________________

---

*Template v1.0 — complete at M0.8 (Phase 0 Week 4, Day 5)*
