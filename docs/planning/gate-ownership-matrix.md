# Gate Ownership Matrix (G0 – G7-M)

**Authority:** `docs/RANKINGS_ENGINE_BASELINE.md` §3, §7  
**Maintainer:** Rankings architect  
**Rule:** All gates require explicit human approval. No gate self-promotes.

---

## Gate Registry

| Gate | Name | Approver(s) | Documentation required | Entry precondition | Exit criterion | Blocked operations while active / unclosed |
|---|---|---|---|---|---|---|
| **G0** | Governance freeze | Product owner + Engineering lead | Signed baseline package; invariant registry; Phase 0 artifacts; this closure package | All specs + blocker resolutions approved | Governance baseline locked in `docs/`; G0 sign-off record complete | No Phase A+ implementation without G0 close (planning only) |
| **G1** | Verdict engine (WS-1) | Engineering lead (+ Product owner consult on threshold policy) | WS-1 spec sign-off; verdict payload schema; G1 test matrix; eligibility duplication map closure | G0 closed | Verdict hierarchy P1–P15, precedence, and payload fields defined and agreed; INV-04 consolidation plan executed | No duplicate threshold logic in new code paths; no rating math changes |
| **G2** | Policy registry (WS-2, WS-3) | Engineering lead | WS-2/WS-3 spec sign-off; launch `policyVersionId` definition; snapshot lifecycle design | G1 closed | Active launch policy version resolvable; snapshot DRAFT→PUBLISHED→SUPERSEDED defined | No policy retro-edits to historical snapshots |
| **G3-P** | Merge pilot | Data integrity lead (+ Product owner per tier) | Per-group merge plan + audit JSON; tier progression R2-d | G2 closed | Pilot tier(s) complete per WS-4 R2-d | Snapshot publish for affected boards during in-flight merge |
| **G3-R** | Merge rollback window | Data integrity lead | 72h rollback record per merge group | G3-P per group | All open rollback windows closed | **Monthly snapshot publish locked** (WS-4 R2-c) |
| **G3-F** | Forward correction | Data integrity lead + Product owner | Forward-correction taxonomy record (Split / Re-canonicalize) | G3-R closed for affected group | Correction approved and audited; prospective only | N/A (post-window correction path) |
| **G6** | Schema readiness | Engineering lead + Data safety review | Schema design doc; R-READ audit report; backfill verification plan; `g6-schema-delta.md` | G3 complete (G3-F closed for all groups) | P-G6 satisfied: versioned uniqueness, v1 backfill verified, R-READ hardened, snapshot provenance fields | **Any v2 `PlayerRating` write**; schema migration without approval |
| **G4-P** | Recompute pilot (read-only) | Rankings architect | Pilot validation report; G4-P acceptance criteria | G3 complete (may parallel G6 prep) | Bounded v1 universe validation approved; read-only, non-persisting | No persist of pilot results to production tables |
| **G5** | Carryover enablement | Product owner | Rollover dry-run report; WS-6 parameter confirmation | G2 closed (policy) + feeds G4 | First rollover dry-run approved; INV-07 tests pass | **June 1 rollover job** until G5 closed |
| **G4** | Universe recompute | Product owner + Data integrity lead | Recompute impact report; lineage record design; backup plan | **G6 (P-G6)** OR **P-W1 signed waiver** | v1 counts verified; lineage records complete; live ratings reflect lifetime accumulation | Full universe recompute without G4 approval |
| **G7** | Formula v2 cutover | Product owner | v2 preview comparison; rollback rehearsal; neutral profile weight audit (INV-13) | G4 complete; v2 shadow validated | `isPublic=true` on v2; v1 → RETIRED; neutral profile confirmed | **Public formula pointer flip**; tier multipliers; non-zero shrinkage |
| **G7-M** | Mature policy activation | Product owner | Policy change memo; rank movement analysis; new `policyVersionId` record | **Separate approval** after G7 stable | New policy version active; snapshot lineage started under new policy | Tier multipliers and/or `shrinkageK≠0` without G7-M approval |

---

## Gate Preconditions (Forks)

| Fork | Rule | Waiver authority |
|---|---|---|
| **P-G6** | G6 schema landed: `@@unique([gameStatId, formulaVersionId])`, `@@unique([playerId, ageGroup, formulaVersionId])`, v1 backfill verified, R-READ hardened | Default path — no waiver |
| **P-W1** | Alternative to P-G6: G4 scoped exclusively to `formulaVersionId = v1`; no v2 writes until G6 | Product owner + Engineering lead |
| **G7 profile** | At G7: `shrinkageK=0`, `leagueWeight=opponentFactor=teamFactor=1.00`, tier multipliers inactive | Product owner (G7 sign-off) |
| **G7-M profile** | Tier multipliers and/or `shrinkageK≠0` activate only via new `policyVersionId` | Product owner (G7-M sign-off) |

---

## Operations Blocked by Active Gate State

| Active state | Blocked operations | Enforced by |
|---|---|---|
| G0 not closed | G1+ implementation (except planning authorized by conditional G0) | Engineering lead |
| Any G3-R window open | Monthly snapshot publish | Data integrity lead |
| G3 merge in flight | Snapshot publish for affected boards | Data integrity lead |
| Before G6 + R-READ | Any v2 `PlayerRating` write | Engineering lead |
| Before G7 approval | Public formula pointer flip (`isPublic`) | Product owner |
| G7 without G7-M | Tier multipliers, non-zero shrinkage | Product owner |
| Before G5 | June 1 age-group rollover job | Rankings architect |
| Before G3 exit | G4 universe recompute | Data integrity lead + Rankings architect |
| Before G4 approval | Production lifetime rating persist (beyond incremental v1) | Product owner |

---

## Approver Roster (named at G0-07)

| Gate | Approver role | Named approver | Backup |
|---|---|---|---|
| G0 | Product owner | _______________ | _______________ |
| G0 | Engineering lead | _______________ | _______________ |
| G1–G2 | Engineering lead | _______________ | _______________ |
| G3-P/R/F | Data integrity lead | _______________ | _______________ |
| G6 | Engineering lead | _______________ | _______________ |
| G6 | Data safety review | _______________ | _______________ |
| G4-P | Rankings architect | _______________ | _______________ |
| G4 | Product owner | _______________ | _______________ |
| G4 | Data integrity lead | _______________ | _______________ |
| G5 | Product owner | _______________ | _______________ |
| G7 | Product owner | _______________ | _______________ |
| G7-M | Product owner | _______________ | _______________ |

---

## Escalation Paths

| Situation | Escalate to | Gate impact |
|---|---|---|
| Invariant violation detected | Rankings architect → Product owner | May block gate |
| Merge rollback after 72h window | Data integrity lead → G3-F approval | G3-F required |
| Formula cutover defect post-G7 | Product owner → G7 rollback (pointer flip) | Emergency G7 rollback |
| Policy replay non-determinism | Data integrity lead → WS-3 review | G2/G7-M |
| Schema constraint blocks v1/v2 coexistence | Engineering lead → G6 scope review | G6 scope change |

---

## Gate Documentation Checklist (per gate close)

| Gate | Required evidence artifact |
|---|---|
| G0 | `g0-signoff.md`, `g0-evidence-checklist.md` |
| G1 | WS-1 signed spec, G1 test matrix, duplication map closure |
| G2 | Launch policy version ID, WS-2 lifecycle doc |
| G3-P | Per-group merge audit JSON |
| G3-R | Rollback window close record |
| G3-F | Forward correction approval |
| G6 | R-READ audit report, backfill verification |
| G4-P | Pilot validation report |
| G5 | Rollover dry-run report |
| G4 | Recompute impact report, count verification |
| G7 | v2 comparison report, rollback rehearsal log |
| G7-M | Policy bump memo, rank movement analysis |

---

*Derived from baseline §3 and §7 — v1.0*
