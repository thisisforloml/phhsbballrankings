# G0 Closure Package — Peach Basket

**Status:** Approval-ready governance package  
**Version:** 1.0  
**Effective:** 2026-06-16  
**Gate target:** G0 exit → G1 entry authorization  
**Scope:** Planning and governance only — no code, migrations, recomputes, merges, or production writes

---

## Document Control

| Field | Value |
|---|---|
| **Authority** | Subordinate to `docs/RANKINGS_ENGINE_BASELINE.md` v1.0 |
| **Phase plan** | `docs/RANKINGS_ENGINE_PHASE0_PLAN.md` v1.0 |
| **Operational guardrails** | `docs/PROJECT_STATUS.md` (stable counts; write prohibitions) |
| **ADR index** | `docs/adr/INDEX.md` (ADR-001 – ADR-015, Accepted) |
| **Approvers (G0)** | Product owner + Engineering lead |
| **Package maintainer** | Rankings architect |

### Purpose

This package closes the G0 sign-off audit blockers identified in Phase 0 readiness review:

| Blocker | Resolution artifact |
|---|---|
| Missing G0 sign-off record | [`g0-signoff.md`](g0-signoff.md) |
| Invariant registry not signed (INV-01–INV-17) | [`invariant-ownership-matrix.md`](invariant-ownership-matrix.md) |
| Phase 0 required artifacts missing in `docs/planning/` | [`artifact-registry.md`](artifact-registry.md) |
| Inventories initial not final | [`r-read-inventory.md`](r-read-inventory.md), [`g6-schema-delta.md`](g6-schema-delta.md), Phase 0 §5 registers |
| Risk register lacks assigned owners (R-01–R-18) | [`risk-register.md`](risk-register.md) |
| G1 readiness checklist incomplete | [`g1-entry-checklist.md`](g1-entry-checklist.md) |
| PROJECT_STATUS cross-link not recorded | §Cross-link record below + G0-08 in [`g0-evidence-checklist.md`](g0-evidence-checklist.md) |

---

## Approval-Ready Governance Package Summary

### What G0 ratifies

G0 is the **governance freeze** gate. It locks the architecture baseline, ADR index, workstream specifications (WS-1 Rev 2 through WS-7), blocker resolutions (B1, B2, B3, H1), and invariant ledger before any Phase A (G1+) implementation planning proceeds.

**G0 authorizes:** Documentation lock, inventory completion, risk ownership, gate approver roster, and G1 planning kickoff.

**G0 does not authorize:** Schema migrations, rating recomputes, player merges, snapshot publish, Formula v2 writes, or any production data mutation.

### Locked decisions (pre-ratified in baseline)

| Decision | Source | ADR / amendment |
|---|---|---|
| Live boards read live `PlayerRating`; history reads snapshots | P0 | ADR-001 |
| Launch thresholds: Boys 10 / Girls 5 verified games | P0 | ADR-002 |
| Unknown DOB = verification gap with temporary eligibility | P0 | ADR-003 |
| `ageGroupOverride` is eligibility-affecting, not rating-affecting | P0 | ADR-004 |
| One athlete = one canonical profile; merges reassignment-only | P0, WS-4 Rev 2 | ADR-005, ADR-014 |
| Snapshot lifecycle: DRAFT → PUBLISHED → SUPERSEDED | WS-2 | ADR-006 |
| Policy changes prospective-only | WS-3 | ADR-007 |
| Lifetime accumulation within age group | WS-5 | ADR-008 |
| Carryover = discounted prior; never satisfies threshold alone | WS-6, B1 | ADR-009 |
| Formula versions coexist additively; v1 never overwritten | WS-7, B3 | ADR-010 |
| G7 neutral profile; G7-M for tier/shrinkage activation | P0 A-1, B1 | ADR-011 |
| League weight applied once at score compute | WS-7 | ADR-012 |
| Snapshots freeze `formulaVersionId` + `policyVersionId` + row provenance | H1, WS-2 | ADR-013 |
| Soft-deleted slugs redirect to canonical player | WS-4 R2-a | ADR-014 |
| G6 schema before G4 universe recompute | P1 A-2 | ADR-015 |

### Gate sequence (post-G0)

```
G0 → G1 → G2 → G3-P → G3-R → G3-F → G6 → G4 → G7 → G7-M
         (G4-P may parallel G6 prep after G3)
         (G5 feeds G4; first June rollover after G5)
```

### Stable count context (dual citation)

| Table | UAAP S88 stable (`PROJECT_STATUS`) | Broader dataset (Formula v2 write-plan) |
|---|---:|---:|
| GamePerformanceScore | 1,885 | 6,340 |
| PlayerRating | 181 | 611 |
| RankingSnapshot | 2 | 3 |
| RankingSnapshotRow | 138 | 511 |

Operational guardrails and public QA anchors use **UAAP S88 stable counts**. G6 backfill scope and Formula v2 write-plan sizing reference the **broader dataset** explicitly before G6 approval.

---

## Ownership Assignments Framework

Five governance roles govern the Rankings Engine. Named individuals are recorded at sign-off; until then, role titles apply.

| Role | Primary accountability | Key artifacts owned |
|---|---|---|
| **Product owner** | Product governance, public cutover (G7/G7-M), policy approval | P0, G0/G7/G7-M sign-off, G7 rollback decision tree |
| **Engineering lead** | Implementation sequencing, schema (G6), R-READ hardening, test harness | P1 co-approval, G6 sign-off, read/compute inventories, migration risk |
| **Rankings architect** | Eligibility, accumulation, carryover, formula versioning, snapshots | WS-1–WS-7 specs, baseline package, invariant verification design, G4-P validation |
| **Data integrity lead** | Duplicate identity, merges (G3), audit/replay, lineage | WS-4, merge inventories, G3-P/R/F approvals, slug alias audit |
| **Project maintainer** | Operational guardrails, count verification, artifact index | `PROJECT_STATUS.md`, dual-count reconciliation, post-rollback count checks |

### RACI summary by domain

| Domain | Responsible | Accountable | Consulted | Informed |
|---|---|---|---|---|
| Product governance | Product owner | Product owner | Rankings architect | All |
| Implementation sequencing | Rankings architect | Engineering lead | Product owner | All |
| Eligibility (WS-1) | Rankings architect | Product owner + Data integrity | Engineering lead | Public UI, admin |
| Snapshots (WS-2) | Rankings architect | Engineering lead | Data integrity | Public trends |
| Policy registry (WS-3) | Rankings architect | Product owner | Engineering lead | WS-1, WS-6 |
| Merges (WS-4) | Data integrity lead | Data integrity + Product | Rankings architect | WS-5, profiles |
| Accumulation (WS-5) | Rankings architect | Engineering lead | Data integrity | Live boards |
| Carryover (WS-6) | Rankings architect | Product owner | Engineering lead | June job |
| Formula versioning (WS-7) | Rankings architect | Product + Engineering | Data integrity | Snapshots |
| Schema migrations (G6) | Engineering lead | Engineering + Data safety | Rankings architect | All write paths |
| Operational guardrails | Project maintainer | Project maintainer | Rankings architect | All agents/devs |

---

## Sign-Off Requirements

### Who must sign what

| Artifact / decision | Required signatories | Decision options |
|---|---|---|
| **G0 governance freeze** | Product owner + Engineering lead | Approve / Conditional / Hold |
| **Invariant Registry (INV-01–INV-17)** | Rankings architect (verification design) + Engineering lead (implementability) | Per-invariant Acknowledge / Waiver (with record) |
| **Gate approver roster (G0–G7-M)** | Product owner | Acknowledge |
| **Risk register (R-01–R-18)** | Owner per risk + Rankings architect (register integrity) | Acknowledge ownership |
| **Phase 0 inventories (final)** | Engineering lead (read/compute/schema) + Rankings architect (eligibility/snapshot) | Complete / Gaps logged |
| **Merge path inventory** | Data integrity lead | Complete / Gaps logged |
| **Test strategy outline** | Engineering lead | Approve outline |
| **Rollback playbooks outline** | Engineering lead + Data integrity lead | Approve outline |
| **G1 entry readiness (G1-R01–R05)** | Rankings architect + Engineering lead | Ready / Not ready |
| **PROJECT_STATUS cross-link** | Project maintainer | Recorded |

### Conditional approval rules

- **Conditional:** Specific checklist items (G0-01–G0-14) remain open; each must cite artifact path, owner, and target date. G1 planning may proceed only for items explicitly listed in the condition scope.
- **Hold:** G0 not closed; no G1 implementation work authorized. Blockers documented in `g0-signoff.md`.

### Waiver authority

| Waiver type | Approver |
|---|---|
| Gate skip or combine | Product owner + Engineering lead (written waiver record) |
| Invariant waiver | Rankings architect → Product owner (architecture review required) |
| P-W1 (G4 without P-G6) | Product owner + Engineering lead (signed acknowledgment) |

---

## Package Artifact Index

| # | Artifact | Path | Status at package issue |
|---|---|---|---|
| 1 | G0 Closure Package (this document) | `docs/planning/G0_CLOSURE_PACKAGE.md` | Complete |
| 2 | G0 sign-off template | `docs/planning/g0-signoff.md` | To Complete (signatures) |
| 3 | Invariant ownership matrix | `docs/planning/invariant-ownership-matrix.md` | Complete (pending sign-off) |
| 4 | Risk ownership matrix | `docs/planning/risk-register.md` | Complete (pending owner acknowledgment) |
| 5 | Gate ownership matrix | `docs/planning/gate-ownership-matrix.md` | Complete |
| 6 | Artifact registry | `docs/planning/artifact-registry.md` | Complete |
| 7 | G0 evidence checklist | `docs/planning/g0-evidence-checklist.md` | Complete (pending verification) |
| 8 | G1 entry checklist | `docs/planning/g1-entry-checklist.md` | Complete (pending G1 kickoff) |
| 9 | Doc validation matrix | `docs/planning/doc-validation-matrix.md` | To Create (M0.2) |
| 10 | R-READ read-path register (final) | `docs/planning/r-read-inventory.md` | To Create (M0.4) |
| 11 | G6 schema delta spec | `docs/planning/g6-schema-delta.md` | To Create (M0.3) |
| 12 | Eligibility duplication map | `docs/planning/eligibility-duplication-map.md` | To Create (M0.4) |
| 13 | Test strategy outline | `docs/planning/test-strategy-outline.md` | To Create (M0.6) |
| 14 | Rollback playbooks outline | `docs/planning/rollback-playbooks-outline.md` | To Create (M0.6) |

Full registry with owners and gate dependencies: [`artifact-registry.md`](artifact-registry.md).

---

## PROJECT_STATUS Cross-Link Record

**Requirement (G0-08):** `docs/PROJECT_STATUS.md` must cross-reference the Rankings Engine baseline; baseline must acknowledge PROJECT_STATUS as operational guardrails.

| Document | Cross-link action | Status |
|---|---|---|
| `docs/PROJECT_STATUS.md` | Add **Rankings Engine Governance** section linking to `RANKINGS_ENGINE_BASELINE.md`, `RANKINGS_ENGINE_PHASE0_PLAN.md`, and this closure package | **Required at G0 close** |
| `docs/RANKINGS_ENGINE_BASELINE.md` | Already references PROJECT_STATUS (§Document Control, Appendix B) | Complete |
| `docs/RANKINGS_ENGINE_PHASE0_PLAN.md` | Already references PROJECT_STATUS (§Document Control, §5 counts) | Complete |

**Recommended PROJECT_STATUS insertion (Project maintainer):**

```markdown
## Rankings Engine Governance

- Architecture baseline: `docs/RANKINGS_ENGINE_BASELINE.md` v1.0
- Phase 0 plan: `docs/RANKINGS_ENGINE_PHASE0_PLAN.md` v1.0
- G0 closure package: `docs/planning/G0_CLOSURE_PACKAGE.md`
- ADR index: `docs/adr/INDEX.md`
- Gate status: G0 [pending/closed] — see `docs/planning/g0-signoff.md`
- Stable counts in this document remain operational guardrails; G6+ scope may reference broader dataset counts per Phase 0 dual-citation table.
```

---

## G0 Closure Checklist (Ordered Steps)

Execute in order. Do not skip steps without a recorded waiver.

| Step | Action | Owner | Output |
|---|---|---|---|
| **1** | Confirm baseline v1.0 and Phase 0 plan v1.0 are committed in `docs/` | Rankings architect | G0-01 ✓ |
| **2** | Publish ADR index; verify ADR-001–015 Accepted | Rankings architect | G0-02 ✓ |
| **3** | Complete doc validation matrix (P0 A-1, P1 A-2, WS-1–WS-7, blockers) | Rankings architect | G0-03, G0-04, G0-05 |
| **4** | Finalize inventories: read-path, compute, snapshot, eligibility, schema delta | Engineering lead + Rankings architect | G0-09 |
| **5** | Assign risk owners; review High/Critical items (R-01–R-03, R-05–R-07, R-11, R-15) | Rankings architect + Data integrity lead | G0-10 |
| **6** | Complete invariant ownership matrix; obtain architect + engineering acknowledgment | Rankings architect | G0-06 |
| **7** | Publish gate ownership matrix; confirm approver roster | Product owner | G0-07 |
| **8** | Approve test strategy and rollback playbooks (outline level) | Engineering lead | G0-11, G0-12 |
| **9** | Record PROJECT_STATUS cross-link | Project maintainer | G0-08 |
| **10** | Verify no gate skip without waiver record | Engineering lead | G0-13 |
| **11** | Complete G0 evidence checklist (G0-01–G0-14) | Product owner + Engineering lead | Evidence pack |
| **12** | Execute G0 sign-off (Approve / Conditional / Hold) | Product owner + Engineering lead | G0-14 |
| **13** | If Approved: authorize G1 planning kickoff per G1 entry checklist | Rankings architect | G1-R01–R05 |

---

## Post-G0 Authorization Boundary

| Authorized after G0 close | Still blocked until respective gate |
|---|---|
| G1 WS-1 verdict engine **planning and design** | G1 sign-off for implementation |
| G6/G4/G7 **planning** artifacts | G6/G4/G7 explicit approval for execution |
| Inventory maintenance and gap tracking | Schema migrations (G6) |
| Test matrix skeleton expansion | Rating recomputes, merges, snapshot publish |
| Read-only Formula v2 preview scripts | Formula v2 writes (G6 + G7) |

---

## References

| Document | Path |
|---|---|
| Rankings Engine Baseline Package v1.0 | `docs/RANKINGS_ENGINE_BASELINE.md` |
| Phase 0 Implementation Plan v1.0 | `docs/RANKINGS_ENGINE_PHASE0_PLAN.md` |
| ADR Index | `docs/adr/INDEX.md` |
| Project Status and Guardrails | `docs/PROJECT_STATUS.md` |
| PHRANK Requirements | `docs/PHRANK_requirements.md` |
| Age Group Context | `docs/ranking-age-context.md` |

---

*End of G0 Closure Package v1.0*
