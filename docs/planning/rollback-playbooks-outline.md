# Rollback Playbooks Outline (Planning)

**Authority:** Phase 0 WP-0.9; Phase 0 §10  
**Owner:** Data integrity lead (merge); Engineering lead (schema/recompute)  
**Gate:** G0-12 (outline approval)  
**Status:** Outline only — operational runbooks expanded at respective gates

---

## Scenario Matrix

| Scenario | Trigger | Rollback action | Verification | Owner |
|---|---|---|---|---|
| **G3-R merge rollback** | Within 72h of merge group | Reverse reassignment per WS-4 audit | Player count, GPS ownership, slug resolution | Data integrity lead |
| **G3-F forward correction** | Post-window canonical error | Split / re-canonicalize (prospective only) | Audit trail + approval record | Data integrity lead |
| **G6 migration defect** | Public output drift | Migration down / hotfix per engineering lead | R-READ parity suite | Engineering lead |
| **G4 recompute defect** | Lineage mismatch | Restore pre-G4 rating backup (**requires approval + backup plan**) | PlayerRating counts vs PROJECT_STATUS | Engineering lead |
| **G7 cutover defect** | Rank order anomaly | Flip `isPublic` pointer back to v1 (ADR-011) | Public board spot check | Product owner |
| **G7-M policy defect** | Unintended shrinkage/tiers | Revert active `policyVersionId` pointer | Policy registry query | Product owner |
| **Snapshot publish abort** | G3-R window open | Do not publish; retain DRAFT | WS-4 R2-c compliance | Rankings architect |

---

## G3-R Merge Rollback (72h Window)

| Step | Action |
|---|---|
| 1 | Confirm within 72h of merge group execution |
| 2 | Load merge audit JSON for group |
| 3 | Reverse playerId reassignments on GPS, PlayerRating, snapshots |
| 4 | Verify slug aliases reverted or marked inactive |
| 5 | Run count verification checklist |
| 6 | Close rollback record; notify gate owner |

**Publish lock:** No snapshot publish while any G3-R window open (WS-4 R2-c).

---

## G7 Pointer-Flip Rollback

| Step | Action |
|---|---|
| 1 | Product owner declares rollback |
| 2 | Set v2 `isPublic=false`; v1 `isPublic=true` |
| 3 | Verify public `/rankings` serves v1 order |
| 4 | Document incident; schedule root-cause before retry |
| 5 | v2 shadow data preserved (INV-09) |

---

## G6 Schema Rollback Constraints

- Down migration may not drop v1 rows if v2 shadow exists
- Backup before migration mandatory
- Parity suite must pass before re-attempt

---

## Stable Count Verification Checklist (Post-Rollback)

| Table | S88 expected | Verified |
|---|---:|---|
| Player | 216 | [ ] |
| Active Game | 76 | [ ] |
| GamePerformanceScore | 1,885 | [ ] |
| PlayerRating | 181 | [ ] |
| RankingSnapshot | 2 | [ ] |
| RankingSnapshotRow | 138 | [ ] |

**Owner:** Project maintainer

---

## G7 Rollback Decision Tree (Product Owner)

```
Rank order anomaly detected post-G7
├── Severity: cosmetic (<3 positions, single board)
│   └── Monitor 24h; document; no flip
├── Severity: material (board order materially wrong)
│   └── Product owner approves pointer flip to v1
└── Severity: data corruption suspected
    └── Hold public updates; engineering + data integrity incident review
```

---

## Approval

| Role | Playbooks acknowledged | Date |
|---|---|---|
| Data integrity lead | [ ] | |
| Engineering lead | [ ] | |
| Product owner (G7 tree) | [ ] | |

---

*G0-12 deliverable — v1.0*
