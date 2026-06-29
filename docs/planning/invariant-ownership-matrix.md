# Invariant Ownership Matrix (INV-01 – INV-17)

**Authority:** `docs/RANKINGS_ENGINE_BASELINE.md` §4  
**Gate:** Signed at G0 (G0-06); verified at designated gates  
**Maintainer:** Rankings architect

---

## Sign-Off Block

| Role | Name | Date | Signature / approval ID |
|---|---|---|---|
| Rankings architect (verification design) | | | |
| Engineering lead (implementability) | | | |
| Product owner (acknowledgment) | | | |

**Registry status:** [ ] Unsigned [ ] Signed [ ] Waiver on record: ___________

---

## Matrix

| ID | Invariant | Verification owner | Verification method | Gate verified | Sign-off required |
|---|---|---|---|---|---|
| **INV-01** | Live `PlayerRating` is the authoritative source for public live boards | Engineering lead | Audit public `/rankings` and related routes: live board queries resolve from `PlayerRating`, not snapshot rows; post-G6: filter by active public `formulaVersionId` (R-READ) | G6 (R-READ audit); ongoing regression | **Y** |
| **INV-02** | `RankingSnapshot` + `RankingSnapshotRow` are the authoritative historical record | Rankings architect | Audit trend/history code paths (`player-profile.ts`, snapshot readers): history reads snapshot rows only, never recomputes from live ratings | G2 (lifecycle design); G6 (row provenance) | **Y** |
| **INV-03** | Published snapshots are immutable | Engineering lead | Schema/service audit: no UPDATE/DELETE on PUBLISHED snapshot headers or rows; lifecycle tests in WS-2 test scenarios | G2, G6 | **Y** |
| **INV-04** | Eligibility module (WS-1) is the sole threshold authority | Rankings architect | Code audit: no duplicate threshold logic in import, display, or API paths; Phase 0 duplication map → G1 consolidation | G1 (verdict engine); G2 (policy registry) | **Y** |
| **INV-05** | Merges complete before lifetime accumulation (G3 before G4) | Data integrity lead | Gate enforcement audit: G4 blocked until G3 exit; merge completion checklist before G4 approval | G3, G4 | **Y** |
| **INV-06** | `Game` and `GameStat` are never rewritten by merges, transfers, or policy changes | Data integrity lead | Merge audit review: reassignment of foreign keys only; no stat row mutation; WS-4 pilot audit JSON | G3-P, G3-R | **Y** |
| **INV-07** | Carryover never satisfies eligibility threshold alone | Rankings architect | Unit/integration tests: `gamesQualified` excludes carryover-only basis; WS-6/G5 dry-run verification | G5 | **Y** |
| **INV-08** | League weight applied once at score compute, never at accumulation | Rankings architect | Compute path audit: accumulator consumes `finalPerformanceScore` only; no league multiplier in WS-5 accumulation | G4-P, G4, G7 | **Y** |
| **INV-09** | v1 formula evidence is never overwritten by v2 work | Engineering lead | Count verification: v1 GPS and PlayerRating row counts unchanged after v2 shadow begins; uniqueness constraints per ADR-010 | G6, G6-B (shadow), G7 | **Y** |
| **INV-10** | At most one `FormulaVersion` is public (`isPublic=true`) at a time | Engineering lead | Registry query test: exactly one ACTIVE public formula; G7 cutover checklist | G7 | **Y** |
| **INV-11** | Policy changes are prospective-only | Rankings architect | Snapshot audit: historical snapshots retain frozen `policyVersionId`; no retro-edit scripts | G2, G6 | **Y** |
| **INV-12** | `FormulaVersion.weights` for ACTIVE/RETIRED versions are frozen; parameter change = new version | Rankings architect | Registry audit: no in-place weight edits on ACTIVE/RETIRED; changes create new FormulaVersion or policy bump per ADR-011 | G6, G7, G7-M | **Y** |
| **INV-13** | G7 cutover uses frozen neutral profile until G7-M | Product owner | Pre-G7 weight audit: `shrinkageK=0`, context factors `1.00`, tier multipliers inactive; compare to ADR-011 approved profile | G7 | **Y** |
| **INV-14** | Every published snapshot carries `formulaVersionId` and `policyVersionId` | Engineering lead | Snapshot header audit on new publishes; ADR-013 field population check | G6 | **Y** |
| **INV-15** | Snapshot rows freeze minimum WS-1 verdict provenance | Rankings architect | Row field audit at publish time: verdict subset per ADR-013 / WS-1 payload | G6 | **Y** |
| **INV-16** | Soft-deleted source slugs redirect to canonical player | Data integrity lead | Slug resolution test: alias map consulted; 301/redirect behavior per ADR-014 / WS-4 R2-a | G3-P | **Y** |
| **INV-17** | Age-group progression is controlled June rollover only | Rankings architect | Job audit: no ad-hoc bracket recalculation outside WS-6 rollover job; calendar rule in baseline §6 | G5 | **Y** |

---

## Verification Method Detail

### INV-01 — Live board source of truth

- **Pre-G6:** Confirm `getLatestNationalRankings` and downstream board helpers read live `PlayerRating`.
- **Post-G6:** R-READ audit (`docs/planning/r-read-inventory.md`): every live read filters by active public `formulaVersionId`.
- **Regression anchor:** UAAP S88 public `/rankings` renders without duplicate ratings.

### INV-04 — Sole threshold authority

- **Phase 0 baseline:** Duplication documented in `public-board-ranks.ts`, `players.ts` (Phase 0 §5.4).
- **G1 exit:** Single WS-1 verdict engine; display paths consume verdict, not local thresholds.
- **Sign-off:** Rankings architect certifies consolidation complete at G1 close.

### INV-06 — No Game/GameStat rewrite

- **Merge pilot:** Per-group audit JSON shows playerId reassignment on GPS/PlayerRating only.
- **Forbidden:** UPDATE on `GameStat` stat values during merge.

### INV-09 — v1 preservation

- **Checkpoint counts (S88):** GamePerformanceScore 1,885; PlayerRating 181 — unchanged after v2 shadow.
- **Harness:** `compare-player-rating-formulas.ts`, `validate-ratings-v1*.ts`.

---

## Waiver Process

| Step | Action | Owner |
|---|---|---|
| 1 | Document invariant ID, violation scenario, blast radius | Requestor |
| 2 | Architecture review | Rankings architect |
| 3 | Approve/deny waiver | Product owner |
| 4 | Record in `g0-signoff.md` or gate-specific waiver log | Project maintainer |

**No waiver may authorize historical Game/GameStat rewrite (INV-06) or published snapshot mutation (INV-03) without explicit product + data integrity escalation.**

---

## Review Cadence

| Trigger | Action |
|---|---|
| Each gate close (G1–G7-M) | Reconcile affected invariants; update verification evidence |
| Invariant violation detected | Immediate escalation per baseline §7 |
| Quarterly (post-G1) | Rankings architect spot-check open gaps (e.g., R-READ until G6) |

---

*Derived from baseline §4 — v1.0*
