# Phase 0 / G0 Artifact Registry

**Authority:** `docs/RANKINGS_ENGINE_PHASE0_PLAN.md` §12  
**Maintainer:** Project maintainer  
**Gate dependency:** G0 exit requires all **Required** and **Complete** artifacts; **To Create** items must reach **Complete** before G0-14 sign-off

---

## Status Legend

| Status | Meaning |
|---|---|
| **Required** | Must exist for G0; path defined |
| **To Create** | Planned in Phase 0 WBS; not yet final |
| **Complete** | Content finalized and reviewed |
| **Living** | Exists; updated at gate boundaries |

---

## Core Governance Artifacts

| Artifact | Path | Owner | Status | Gate dependency |
|---|---|---|---|---|
| Rankings Engine Baseline Package v1.0 | `docs/RANKINGS_ENGINE_BASELINE.md` | Rankings architect | Complete | G0 |
| Phase 0 Implementation Plan v1.0 | `docs/RANKINGS_ENGINE_PHASE0_PLAN.md` | Rankings architect | Complete | G0 |
| ADR Index (ADR-001 – ADR-015) | `docs/adr/INDEX.md` | Rankings architect | Complete | G0 |
| G0 Closure Package | `docs/planning/G0_CLOSURE_PACKAGE.md` | Rankings architect | Complete | G0 |
| G0 sign-off record | `docs/planning/g0-signoff.md` | Product owner | To Create (signatures pending) | G0 exit |
| Invariant ownership matrix | `docs/planning/invariant-ownership-matrix.md` | Rankings architect | Complete (sign-off pending) | G0-06 |
| Risk register (living) | `docs/planning/risk-register.md` | Rankings architect | Complete (acknowledgment pending) | G0-10 |
| Gate ownership matrix | `docs/planning/gate-ownership-matrix.md` | Rankings architect | Complete | G0-07 |
| G0 evidence checklist | `docs/planning/g0-evidence-checklist.md` | Product owner | Complete | G0-14 |
| G1 entry checklist | `docs/planning/g1-entry-checklist.md` | Rankings architect | Complete | G1 entry |

---

## Phase 0 WBS Deliverables

| Artifact | Path | Owner | Status | Gate dependency | WBS ref |
|---|---|---|---|---|---|
| Doc validation matrix | `docs/planning/doc-validation-matrix.md` | Rankings architect | To Create | G0-03, G0-04, G0-05 | WP-0.1 |
| P0 ↔ ADR traceability | Included in doc validation matrix | Rankings architect | To Create | G0-03 | 0.1.1 |
| P1 ↔ ADR traceability | Included in doc validation matrix | Rankings architect | To Create | G0-04 | 0.1.2 |
| WS-1 field coverage matrix | Included in doc validation matrix | Rankings architect | To Create | G1 prep | 0.1.3 |
| WS-4 compliance checklist | Included in doc validation matrix | Data integrity lead | To Create | G3 prep | 0.1.4 |
| Blocker resolution sign-off sheet | Included in doc validation matrix | Rankings architect | To Create | G0-05 | 0.1.5 |
| G6 schema delta spec | `docs/planning/g6-schema-delta.md` | Engineering lead | To Create | G6 planning | WP-0.2 |
| Snapshot header delta (planning) | Included in g6-schema-delta | Engineering lead | To Create | G6 | 0.2.3 |
| Row provenance field gap list | Included in g6-schema-delta | Rankings architect | To Create | G6 | 0.2.4 |
| Formula registry inventory | Included in g6-schema-delta | Engineering lead | To Create | G6 | 0.2.6 |
| Merge alias inventory | `docs/planning/merge-alias-inventory.md` | Data integrity lead | To Create | G3 prep | 0.2.7 |
| Backfill sizing table | Included in g6-schema-delta | Engineering lead | To Create | G6 | 0.2.8 |
| R-READ read-path register (final) | `docs/planning/r-read-inventory.md` | Engineering lead | To Create | G6 C.4 | WP-0.3 |
| R-READ gap report (Finding #1) | Included in r-read-inventory | Rankings architect | To Create | G6 | 0.3.2 |
| Route-to-service map | Included in r-read-inventory | Engineering lead | To Create | G6 | 0.3.4 |
| Path classification matrix | Included in r-read-inventory | Rankings architect | To Create | G6 | 0.3.6 |
| Compute-path register | `docs/planning/compute-path-register.md` | Engineering lead | To Create | G4-P, G4 | WP-0.4 |
| v2 preview path register | Included in compute-path register | Rankings architect | To Create | G7 prep | 0.4.3 |
| Legacy weekly-ratings risk note | Included in compute-path register | Engineering lead | To Create | G6 | 0.4.4 |
| Snapshot write-path register | `docs/planning/snapshot-service-register.md` | Engineering lead | To Create | G2, G3-R | WP-0.5 |
| Lifecycle gap analysis | Included in snapshot register | Rankings architect | To Create | G2 | 0.5.2 |
| Publish lock integration points | Included in snapshot register | Data integrity lead | To Create | G3-R | 0.5.3 |
| Eligibility function register | `docs/planning/eligibility-service-register.md` | Rankings architect | To Create | G1 | WP-0.6 |
| Eligibility duplication map | `docs/planning/eligibility-duplication-map.md` | Rankings architect | To Create | G1-R01 | 0.6.2, 0.6.3 |
| DOB gap assessment | Included in eligibility register | Rankings architect | To Create | G1 | 0.6.5 |
| G1 readiness brief | `docs/planning/g1-readiness-brief.md` | Rankings architect | To Create | G1 entry | 0.6.6 |
| Migration risk doc | Included in g6-schema-delta + risk register | Engineering lead | To Create | G6, G4 | WP-0.7 |
| P-G6 vs P-W1 decision brief | `docs/planning/p-g6-vs-p-w1-brief.md` | Rankings architect | To Create | G4, G6 | 0.7.3 |
| Test strategy outline | `docs/planning/test-strategy-outline.md` | Engineering lead | To Create | G0-11 | WP-0.8 |
| G1 test matrix skeleton | Included in test strategy | Rankings architect | To Create | G1-R03 | 0.8.4 |
| Rollback playbooks outline | `docs/planning/rollback-playbooks-outline.md` | Data integrity lead | To Create | G0-12 | WP-0.9 |
| G7 rollback decision tree | Included in rollback playbooks | Product owner | To Create | G7 | 0.9.2 |
| Stable count verification checklist | Included in rollback playbooks | Project maintainer | To Create | All gates | 0.9.5 |
| Gate waiver process note | `docs/planning/gate-waiver-process.md` | Engineering lead | To Create | G0-13 | 0.10.3 |

---

## Authoritative Source Documents (external to planning/)

| Document | Path | Status | Gate |
|---|---|---|---|
| P0 Ranking Governance Decision Memo (+ A-1) | `docs/` (locked spec) | Required — confirm path at validation | G0 |
| P1 Implementation Planning Specification (+ A-2) | `docs/` (locked spec) | Required — confirm path at validation | G0 |
| WS-1 Eligibility Module Rev 2 | `docs/` (locked spec) | Required | G0, G1 |
| WS-2 Snapshot Lifecycle Rev 1 | `docs/` (locked spec) | Required | G0, G2 |
| WS-3 Policy Versioning Rev 1 | `docs/` (locked spec) | Required | G0, G2 |
| WS-4 Duplicate Player Merge Framework Rev 2 | `docs/` (locked spec) | Required | G0, G3 |
| WS-5 Lifetime Rating Accumulation Rev 2 | `docs/` (locked spec) | Required | G0, G4 |
| WS-6 Carryover Rating Rev 2 | `docs/` (locked spec) | Required | G0, G5 |
| WS-7 Formula Versioning Rev 1 | `docs/` (locked spec) | Required | G0, G6, G7 |
| Blocker Resolution Package (B1, B2, B3, H1) | `docs/` (locked spec) | Required | G0 |
| PROJECT_STATUS cross-link | `docs/PROJECT_STATUS.md` | To Create (section) | G0-08 |

---

## G0 Exit Minimum Artifact Set

All items below must be **Complete** (or **Living** with initial review done) before G0-14:

1. `G0_CLOSURE_PACKAGE.md`
2. `g0-signoff.md` (filled except final signatures until sign-off meeting)
3. `invariant-ownership-matrix.md` (signed)
4. `risk-register.md` (owners acknowledged)
5. `gate-ownership-matrix.md` (approver names filled)
6. `g0-evidence-checklist.md` (all G0-01–G0-14 verified)
7. `doc-validation-matrix.md`
8. `r-read-inventory.md` (final register)
9. `g6-schema-delta.md`
10. `eligibility-duplication-map.md`
11. `test-strategy-outline.md`
12. `rollback-playbooks-outline.md`
13. PROJECT_STATUS Rankings Engine Governance section

---

## Change Log

| Date | Change | By |
|---|---|---|
| 2026-06-16 | Initial registry published with G0 closure package | Rankings architect |

---

*Maintained by Project maintainer — update status at each Phase 0 milestone*
