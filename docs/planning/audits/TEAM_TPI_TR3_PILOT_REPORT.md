# TR-3 Read-Only TPI Pilot Report

**Status:** Read-only validation complete  
**Date:** 2026-06-17  
**Formula:** TPI-v1 ([TEAM_TPI_SPEC.md](../TEAM_TPI_SPEC.md))  
**Machine output:** [scripts/reports/tpi-v1-pilot-latest.json](../../scripts/reports/tpi-v1-pilot-latest.json)  
**Runner:** `scripts/tpi-v1-pilot-readonly.ts` (no DB writes)

---

## Executive Summary

| Cohort | Status | Result |
|---|---|---|
| **A — PYBC U16 Boys (canonical 8 / 37 games)** | **Computed** | TPI ordering aligns with W-L; V-TR-01–08 pass on deduped board |
| **B — UAAP schools** | **Skipped** | TR-1 blocked — 8 programs with same-program duplicate Teams |
| **Club programs** | **Excluded** | Per scope |

### Go / No-Go

**Recommendation: B — Minor parameter adjustments required before TR-4/5 implementation.**

TPI-v1 **structure is validated** on PYBC U16 Boys. Rankings are credible and stable across `k ∈ {4,6,8}`. Proceed to implementation only after:

1. **Evidence policy:** PYBC games are `SUBMITTED`, not `VERIFIED` — production spec requires `VERIFIED` (or explicit policy amendment).
2. **League tier:** PYBC stored at **tier 1** — tier weight inactive (1.00); assign tier 2+ for developmental competitions before national launch.
3. **UAAP Cohort B:** Re-run after TR-1 merges.
4. **Optional tuning:** Consider slightly stronger margin spread — current board compresses to 46–51 TPI range.

**Not recommended:** C (formula redesign) — no structural failure observed.

---

## 1. Pilot Methodology

### 1.1 Evaluation parameters

| Parameter | Value |
|---|---|
| Evaluation date | 2026-06-17 |
| Formula | TPI-v1 hybrid WPI + 2-pass opponent refinement |
| Shrinkage `k` | 6 (launch default) |
| Board key | `(programId, ageGroup, gender)` |
| Min games / opponents | 8 / 3 |

### 1.2 Evidence modes

| Mode | Status filter | Purpose |
|---|---|---|
| **VERIFIED_STRICT** | `VERIFIED` only | Production spec compliance |
| **SUBMITTED_PILOT** | `SUBMITTED` + `VERIFIED` | Operational dataset pilot |

**Finding:** All 74 PYBC game rows are `SUBMITTED`; **0 are `VERIFIED`**. Cohort A results use **SUBMITTED_PILOT** mode. Strict mode returns empty — **blocks production persist until games are verified or policy is amended.**

### 1.3 Deduplication

74 raw `Game` rows → **37 unique games** after dedupe by `gameNumber` (duplicate season/league imports). Matches PROJECT_STATUS checkpoint.

### 1.4 Board separation

Initial mixed-age ranking was rejected. Final output uses **separate boards** per `ageGroup:gender`. Cohort A = **U16:Boys** only.

---

## 2. Pilot Computation Plan — Cohort A (PYBC U16 Boys)

| Program | programId | Age | Gender | Games | Opponents | Pass-0 | Pass-1 Obs | **TPI (k=6)** | W-L |
|---|---|---|---:|---:|---:|---:|---:|---:|---|
| San Pedro Spartans | `b5c79a29-…` | U16 | Boys | 12 | 7 | 56.67 | 52.36 | **51.11** | 8-4 |
| Prime Ascencion Medical Supplies San Anton | `10bdfbd4-…` | U16 | Boys | 9 | 7 | 56.67 | 51.85 | **50.72** | 6-3 |
| Smile 360 Bullies | `58f9e2a2-…` | U16 | Boys | 9 | 7 | 56.67 | 51.44 | **50.55** | 6-3 |
| Migrafix Doc Boleros | `132b41bb-…` | U16 | Boys | 10 | 7 | 54.00 | 51.31 | **50.54** | 6-4 |
| JPM-TEC San Beda | `65908829-…` | U16 | Boys | 9 | 7 | 52.22 | 50.89 | **50.35** | 5-4 |
| Lev Construction Full Potential | `b668fd23-…` | U16 | Boys | 8 | 7 | 45.00 | 48.72 | **49.55** | 3-5 |
| JMTG Medical Trading Infinite | `7e62a36c-…` | U16 | Boys | 8 | 7 | 45.00 | 48.12 | **49.31** | 3-5 |
| Migueluz Trading Moderno | `68b06396-…` | U16 | Boys | 9 | 7 | 30.00 | 43.77 | **47.56** | 0-9 |

All 8 programs are **public-eligible** (≥8 games, ≥3 opponents).

---

## 3. Ranking Outputs — PYBC U16 Boys National Board

| Rank | Program | TPI | Games | Opponents | W-L | W-L Rank |
|---:|---|---:|---:|---:|---|---:|
| 1 | San Pedro Spartans | 51.11 | 12 | 7 | 8-4 | 1 |
| 2 | Prime Ascencion Medical Supplies San Anton | 50.72 | 9 | 7 | 6-3 | 2 |
| 3 | Smile 360 Bullies | 50.55 | 9 | 7 | 6-3 | 3 |
| 4 | Migrafix Doc Boleros | 50.54 | 10 | 7 | 6-4 | 4 |
| 5 | JPM-TEC San Beda | 50.35 | 9 | 7 | 5-4 | 5 |
| 6 | Lev Construction Full Potential | 49.55 | 8 | 7 | 3-5 | 7 |
| 7 | JMTG Medical Trading Infinite | 49.31 | 8 | 7 | 3-5 | 6 |
| 8 | Migueluz Trading Moderno | 47.56 | 9 | 7 | 0-9 | 8 |

**TPI vs W-L:** Top 5 identical order. Bottom tier: JMTG ranks below LEV on TPI despite identical 3-5 records (SOS/margin — **expected**, not a defect).

---

## 4. Contribution Audit

Per-game component averages (effective-weight denominator). Shrinkage applied after Pass-1 observed.

### 4.1 #1 — San Pedro Spartans

| Component | Per-game avg | Effect |
|---|---:|---|
| Outcome | +1.92 | Win-heavy record |
| Margin | +0.53 | +132 point diff supports rank |
| Opponent | −0.04 | Neutral schedule |
| Recency | −65.66* | Games aged vs eval date — see §5 |
| **Shrinkage** | **−1.25** | Pull toward 50 (12 games) |
| Pass-1 observed | 52.36 | |
| **TPI adjusted** | **51.11** | |

### 4.2 #8 — Migueluz Trading Moderno

| Component | Per-game avg | Effect |
|---|---:|---|
| Outcome | −5.02 | 0-9 record |
| Margin | −1.43 | Negative point diff |
| Opponent | +0.10 | Slight schedule lift |
| Recency | −58.20* | Aged games |
| **Shrinkage** | **+3.79** | Pull toward 50 (9 losses) |
| Pass-1 observed | 43.77 | |
| **TPI adjusted** | **47.56** | |

\*Recency decomposition shows counterfactual “if all games were today” delta; PYBC tournament dates are months before eval date. **Operational note:** use evaluation date = last game date + ε for in-season boards, or accept decay for cross-season national view.

---

## 5. Sanity Checks

### 5.1 Validation matrix (U16 Boys board)

| ID | Pass | Detail |
|---|---|---|
| V-TR-01 | ✓ | 8 unique `(programId, ageGroup, gender)` keys |
| V-TR-02 | ✓ | Game contributions match per-program counts |
| V-TR-03 | ✓ | 37 deduped games |
| V-TR-04 | ✓ | 200-day recency ratio = 0.463 (expect ~0.46) |
| V-TR-05 | ✓ | Single tier weight per game |
| V-TR-06 | ✓ | All 8 eligible (none below threshold) |
| V-TR-07 | ✓ | All rows have `programId` |
| V-TR-08 | ✓ | No duplicate programs on board |
| V-TR-09 | — | Deferred (no UI cutover) |
| V-TR-10 | — | Deferred (no homepage) |

### 5.2 Anomaly review

| Check | Finding | Severity |
|---|---|---|
| Undefeated weak schedule | None undefeated | — |
| Strong teams ranked too low | San Pedro #1 on both TPI and W-L | None |
| Schedule exploitation | 6-3 cluster separated by margin/SOS | Low — working as designed |
| Tier inflation | **PYBC tier = 1** → all weights 1.00 | **Medium** — assign tier 2 before launch |
| Recency anomalies | Large decay; all PYBC games months old | **Low** — document eval-date policy |
| TPI compression | Spread 47.56–51.11 (3.5 pts) | **Low** — consider margin coeff tune in v1.1 policy |
| Winless inflation | Migueluz 47.56 despite 0-9; shrinkage +3.79 | Acceptable — still last |

### 5.3 Cohort B — UAAP

**Skipped.** Eight programs with multiple active Teams per `programId` (Adamson, Ateneo, DLSZ, FEU, NU, UST, UP, UE). Re-run TR-3 after approved TR-1 merges.

### 5.4 Out-of-scope: PYBC U13 Boys

Separate board (37 games, 8 programs) computed for regression only — **not Cohort A**. Chef's Magic MLO #1 (10-2). Documented in JSON; not used for go/no-go.

---

## 6. Sensitivity Review — k ∈ {4, 6, 8}

PYBC U16 Boys — **rank order stable** across all k values.

| k | Max rank Δ vs k=6 | Max TPI Δ vs k=6 | Order stable |
|---:|---:|---:|:---:|
| 4 | 0 | 0.64 | ✓ |
| 6 | 0 | 0.00 | ✓ |
| 8 | 0 | 0.48 | ✓ |

| Rank | k=4 | k=6 | k=8 |
|---:|---:|---:|---:|
| 1 | San Pedro 51.35 | San Pedro 51.11 | San Pedro 50.93 |
| 8 | Migueluz 46.94 | Migueluz 47.56 | Migueluz 47.98 |

**Conclusion:** `k=6` launch default is robust; no rank reordering in sensitivity band.

---

## 7. Recommendation

### Decision: **B — Minor parameter adjustments required**

| Area | Verdict |
|---|---|
| Formula structure (hybrid WPI + 2-pass SOS) | **Approved for implementation path** |
| PYBC U16 ranking credibility | **Pass** |
| Shrinkage k=6 | **Pass** |
| Production readiness | **Hold** — evidence + tier + UAAP |

### Required before TR-4 (schema) / TR-5 (persist)

| # | Action | Owner |
|---|---|---|
| 1 | Promote PYBC games to `VERIFIED` **or** amend TEAM-POLICY to accept `SUBMITTED` for trusted imports | Product + data integrity |
| 2 | Set PYBC league `tier = 2` (Developmental) minimum | Admin / data integrity |
| 3 | Complete TR-1 UAAP merges; re-run Cohort B | Data integrity |
| 4 | Define evaluation-date policy (season-end vs rolling “today”) | Product |
| 5 | Optional: bump `marginAdj` divisor 20→15 for wider TPI spread (policy bump, not formula version) | Rankings architect |

### Not required

- Formula redesign (C)
- Change to k (stable at 6)
- Separate boards per age/gender (already correct)

---

## 8. Artifacts

| Artifact | Path |
|---|---|
| Pilot JSON | `scripts/reports/tpi-v1-pilot-latest.json` |
| Pilot runner | `scripts/tpi-v1-pilot-readonly.ts` |
| TPI spec | `docs/planning/TEAM_TPI_SPEC.md` |
| TR-0/TR-1 readiness | `docs/planning/audits/TEAM_RANKINGS_TR0_TR1_READINESS.md` |

### Re-run command

```bash
npx tsx scripts/tpi-v1-pilot-readonly.ts
```

---

## Approval

| Role | TR-3 sign-off |
|---|---|
| Rankings architect | [x] Report authored 2026-06-17 |
| Product owner | [ ] |
| Data integrity lead | [ ] |

---

*End of TR-3 Read-Only TPI Pilot Report*
