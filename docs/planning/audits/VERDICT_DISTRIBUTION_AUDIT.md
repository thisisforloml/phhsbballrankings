# Verdict Distribution Audit

**Date:** 2026-06-17  
**Policy:** `launch-v1` (Boys 10 / Girls 5 verified games)  
**Engine:** WS-1 `evaluateEligibility()`  
**Scope:** All `PlayerRating` rows across U13 / U16 / U19 × Boys / Girls  
**Mode:** Read-only analysis — no code changes, migrations, recomputes, or remediation executed

**Companion artifacts:** `verdict-distribution-summary.json`, `AG4_W0_BASELINE_REPORT.md`

---

## Executive Summary

Of **940** rating rows in the database, only **66 (7.0%)** qualify for the public board (`RANKED` + `publicRankAllowed`). **874 players are off-board**, dominated by two WS-1 paths:

| Rank | Precedence | Reason | Off-board count | Share of off-board |
|---:|---|---|---:|---:|
| 1 | **P7** | Below launch game threshold | **460** | **52.6%** |
| 2 | **P12** | Unknown DOB with sufficient games | **349** | **39.9%** |
| 3 | **P2** | Graduated (class year) | 49 | 5.6% |
| 4 | **P3** | Out of age bracket | 16 | 1.8% |

**No player is off-board due to P6 (zero games) or P8 (no rating basis)** in the current dataset — every rated player has verified games and a target-board rating row.

The public board is not blocked by eligibility logic bugs; it is blocked by **data completeness (DOB)** and **verified game volume** under `launch-v1` thresholds.

---

## 1. Distribution Report

### 1.1 Global verdict distribution (all age groups)

| Verdict | Count | % of pool |
|---|---:|---:|
| PROVISIONAL | 809 | 86.1% |
| RANKED | 66 | 7.0% |
| FORMER | 49 | 5.2% |
| HIDDEN | 16 | 1.7% |

### 1.2 Provisional reason breakdown (all off-board PROVISIONAL = 809)

| `provisionalReason` | Precedence | Count | % of all off-board |
|---|---|---:|---:|
| **BELOW_THRESHOLD** | P7 | **460** | 52.6% |
| **UNKNOWN_DOB** | P12 | **349** | 39.9% |
| OVERRIDE_CROSS_BRACKET | P14 | 0 | 0% |
| CARRYOVER_ONLY | — | 0 | 0% |

### 1.3 Exclusion reason breakdown (HIDDEN + FORMER = 65)

| `exclusionReason` | Precedence | Count | Verdict |
|---|---|---:|---|
| GRADUATED | P2 | 49 | FORMER |
| OUT_OF_BRACKET | P3 | 16 | HIDDEN |
| UNTRUSTED_UNKNOWN_DOB | P11 | 0 | — |
| ZERO_GAMES | P6 | 0 | — |
| NO_RATING_BASIS | P8 | 0 | — |
| RANKING_INACTIVE | P1 | 0 | — |

### 1.4 By age group × gender × verdict

| Age | Gender | Pool | RANKED | PROVISIONAL | FORMER | HIDDEN | Board yield |
|---|---|---:|---:|---:|---:|---:|---:|
| U13 | Boys | 138 | 0 | 138 | 0 | 0 | **0%** |
| U16 | Boys | 253 | 7 | 246 | 0 | 0 | **2.8%** |
| U19 | Boys | 493 | 59 | 369 | 49 | 16 | **12.0%** |
| U19 | Girls | 56 | 0 | 56 | 0 | 0 | **0%** |

*No U13/U16 Girls `PlayerRating` rows exist in the current database.*

### 1.5 U19 Boys off-board decomposition (n=434)

| Root path | Count | % of U19 Boys off-board |
|---|---:|---:|
| P7 — below threshold | 194 | 44.7% |
| P12 — unknown DOB, games qualify | 175 | 40.3% |
| P2 — graduated | 49 | 11.3% |
| P3 — out of bracket | 16 | 3.7% |

### 1.6 U19 Girls off-board decomposition (n=56)

| Root path | Count | % of U19 Girls off-board |
|---|---:|---:|
| P12 — unknown DOB, games qualify | 45 | **80.4%** |
| P7 — below threshold | 11 | 19.6% |
| P2 — graduated | 0 | 0% |

### 1.7 `classYearOverride` presence

| Segment | On public board | Off board |
|---|---:|---:|
| With `classYearOverride` | **0** | 12 |
| Without override | **66** | 862 |

All **66 RANKED** players reached the board **without** relying on `classYearOverride`. All 12 overrides in the pool are on off-board players — overrides do not currently bypass WS-1 gates.

### 1.8 Game-count threshold failure analysis

| Segment | Count | Meaning |
|---|---:|---|
| Below threshold **with** DOB | 21 | Need more verified games only |
| Below threshold **without** DOB | 445 | P7 fires before P12 in many cases; still need games + DOB |
| At/above threshold **without** DOB | 355 | **Primary DOB opportunity** — qualified on games but P12 blocks |
| At/above threshold **with** DOB | 119 | Eligible path; 66 RANKED + remainder FORMER/HIDDEN/out-of-bracket |
| Zero games | 0 | Not a factor in current data |

### 1.9 U19 Boys — games short of threshold (P7 subset, n=194)

| Games short | Players |
|---:|---:|
| 1 | 15 |
| 2 | 32 |
| 3 | 30 |
| 4 | 32 |
| 5 | 24 |
| 6 | 22 |
| 7 | 14 |
| 8 | 12 |
| 9 | 13 |

**118 of 194 (61%)** are within **1–4 games** of the Boys threshold (10). This is the highest-leverage game-count cohort.

### 1.10 Unknown DOB causes

| Path | Count | On board? |
|---|---:|---|
| P12 — `UNKNOWN_DOB` (games ≥ threshold, STANDARD trust) | 349 | **No** |
| P7 — `BELOW_THRESHOLD` with no DOB | 444 | No |
| P11 — `UNTRUSTED_UNKNOWN_DOB` | 0 | No |
| RANKED with override only (no DOB) | 0 | — |
| RANKED with DOB | 66 | **Yes** |

**100% of RANKED players have `birthDate`.** Unknown DOB is the single largest structural barrier after game count.

---

## 2. Root-Cause Analysis

### 2.1 Dominant cause #1 — Below launch threshold (P7) — 52.6%

WS-1 `launch-v1` requires **10 verified games (Boys)** or **5 (Girls)**. Nearly half of all off-board players have insufficient `verifiedGameCount` for their gender.

**Why it dominates U13/U16:**
- Younger age groups have shorter competition history in the dataset.
- U13 Boys: 117/138 off-board via P7 (84.8%).
- U16 Boys: 138/246 off-board via P7 (56.1%).

**Why it still matters for U19 Boys:**
- 194 players are P7 — many are **1–4 games away** from threshold.
- This is normal pipeline behavior, not a formula defect.

### 2.2 Dominant cause #2 — Unknown DOB (P12) — 39.9%

Players with **enough verified games** but **no `birthDate`** receive `PROVISIONAL` / `UNKNOWN_DOB` and are **excluded from the public board** per RC-1 (post-G1 contract).

**Why it dominates U19 Girls:**
- 45/56 off-board Girls (80%) are P12.
- Only 11 Girls are P7 — most Girls with ratings have ≥5 games but lack DOB.

**Why it matters for U19 Boys:**
- 175 Boys are P12 — would be RANKED candidates if DOB were entered and bracket/class-year rules pass.

**Architectural note:** Plan text (AG-4 §4.2) allows override-only RANKED; WS-1 does not. Empirically **0** players reach RANKED without DOB today.

### 2.3 Secondary cause — Graduation (P2) — 5.6%

49 U19 Boys are `FORMER` via class-year exclusion (June 1 of class year). These are **correct exclusions** — not recoverable without policy change. They should never appear on the public board or AG-4 recruiting filter.

### 2.4 Minor cause — Out of bracket (P3) — 1.8%

16 U19 Boys are `HIDDEN` / `OUT_OF_BRACKET` — age computation places them outside U13/U16/U19. Requires DOB correction or they remain permanently off the U19 board.

### 2.5 What is NOT causing exclusions

| Hypothesis | Finding |
|---|---|
| Zero games (P6) | 0 cases |
| Missing rating row (P8) | 0 cases |
| Untrusted competition (P11) | 0 cases — all unknown DOB use STANDARD trust default |
| Override cross-bracket (P14) | 0 cases |
| `classYearOverride` bypass | 0 on-board; 12 off-board overrides ineffective |

---

## 3. Public-Board Growth Opportunities

Ranked by **impact × feasibility** (no policy changes assumed):

| Priority | Lever | Est. addressable pool | Mechanism |
|---|---|---:|---|
| **1** | **DOB entry** for game-qualified players | **349** (P12 global); **175** U19 Boys; **45** U19 Girls | Admin/roster bio completion → P12 clears → RANKED if bracket + class-year pass |
| **2** | **Verified game accumulation** (near-threshold) | **118** U19 Boys within 1–4 games of 10 | Imports + stat verification; P7 → P9/P10 |
| **3** | **Girls threshold advantage** | 11 U19 Girls P7 | Only 5 games required — small cohort; DOB is bigger lever |
| **4** | **U16 Boys pipeline** | 138 P7 + 108 P12 | AG-3 launch prep; 7 already RANKED |
| **5** | **Override audit** | 12 off-board | Fix mis-set overrides; unlikely to add board rows without DOB |

### Scenario modeling (illustrative, not executed)

| Scenario | Approx. new RANKED (upper bound) | Caveats |
|---|---:|---|
| All P12 players gain valid DOB + pass bracket | +349 | Some may hit P3 OUT_OF_BRACKET or P2 FORMER |
| U19 Boys P12 → RANKED | +175 | Largest single-board gain |
| U19 Boys P7 within 1 game → threshold | +15 | Immediate near-win |
| U19 Girls P12 → RANKED | +45 | Would activate entire Girls board |

**Realistic near-term board growth** comes from **DOB backfill on game-qualified players**, not threshold policy changes.

---

## 4. U16 Readiness Implications

### Current state

| Metric | U16 Boys |
|---|---:|
| Rating pool | 253 |
| Public RANKED | **7** (2.8% yield) |
| Off-board P7 | 138 (54.5% of pool) |
| Off-board P12 | 108 (42.7% of pool) |

### Assessment

| Gate | Status | Notes |
|---|---|---|
| Eligibility engine | **Ready** | WS-1 evaluates U16 identically |
| Meaningful board size | **Not ready** | 7 RANKED is thin for AG-3 public launch |
| Dominant blockers | P7 + P12 | Same pattern as U19 — games + DOB |
| FORMER/HIDDEN | **Minimal** | 0 FORMER/HIDDEN in U16 pool today |

### AG-3 launch recommendation

U16 public launch should treat **data readiness** as the gate, not eligibility code:

1. Prioritize DOB entry for U16-rated players with ≥10 Boys / ≥5 Girls verified games.
2. Track U16 P7 near-threshold cohort separately (likely similar 1–4 game cluster).
3. Do not lower thresholds for launch — growth should come from verified games + bios.
4. Expect U16 yield to remain **lower than U19** until competition history matures.

---

## 5. U13 Readiness Implications

### Current state

| Metric | U13 Boys |
|---|---:|
| Rating pool | 138 |
| Public RANKED | **0** (0% yield) |
| Off-board P7 | 117 (84.8%) |
| Off-board P12 | 21 (15.2%) |

### Assessment

| Gate | Status | Notes |
|---|---|---|
| Eligibility engine | **Ready** | No U13-specific code gap |
| Public board content | **Empty** | Zero RANKED across entire U13 pool |
| Primary blocker | **P7** | 10-game Boys threshold is steep for youngest cohort |
| Secondary blocker | **P12** | DOB missing on small subset |

### U13 launch recommendation

U13 is **not launch-ready** on data grounds:

1. **0% board yield** — any U13 public page would be empty or require "Coming Soon" (current UI pattern).
2. Threshold policy (`launch-v1` Boys 10) may be **structurally harsh** for U13 — product may need U13-specific threshold discussion (policy decision, not audit execution).
3. DOB coverage matters less until game threshold is met.
4. No U13 Girls ratings exist — Girls board would also be empty.

---

## 6. AG-4 Recruiting-View Implications

### 6.1 Boys U19 — viable

| Metric | Value | AG-4 impact |
|---|---:|---|
| RANKED board | 59 | Chips have substance |
| Class of 2027 | 34 | Primary recruiting bucket |
| Class of 2028 | 25 | Secondary bucket |
| Null-class RANKED | 0 | `includeUnknownClass` unused |
| P12 off-board (game-qualified, no DOB) | 175 | **Hidden from recruiting view** — not a filter issue |

AG-4 filters **only RANKED rows**. The recruiting view cannot surface the 175 game-qualified Boys who lack DOB — they are off-board at the eligibility layer, not the class-year layer.

**Implication:** Coaches using class-year filters see a **high-quality but narrow** slice (59 players). Full recruiting universe is larger in the database but WS-1 intentionally excludes it.

### 6.2 Girls U19 — not viable

| Metric | Value |
|---|---:|
| RANKED | **0** |
| P12 off-board | 45 (80% of pool) |
| P7 off-board | 11 |

AG-4 Girls chips would render **empty states only**. Root cause is **DOB gap**, not class-year filter design.

### 6.3 Graduated players (P2)

49 U19 Boys are FORMER — correctly excluded before AG-4 runs. No "Show graduated" toggle at MVP. June rollover will shrink chip buckets as class years graduate.

### 6.4 `classYearOverride`

12 overrides exist, all off-board. Override does not currently create RANKED rows. AG-4 `effectiveClassYear` will derive from DOB for all 59 RANKED Boys — **100% class-year coverage** on board.

### 6.5 AG-4 W1–W4 vs data remediation

| Workstream | Solves |
|---|---|
| AG-4 W1–W4 (filter UX) | **Presentation** of existing 59 Boys RANKED |
| DOB backfill (admin/data) | **Population** growth — up to +175 Boys, +45 Girls |
| Game imports | P7 near-threshold cohort |

**AG-4 implementation should proceed** for Boys. **AG-4 launch marketing** should set expectations: recruiting filter shows RANKED national board subset, not all rated athletes in the database.

---

## Appendix: Precedence Path Reference

| Rule | Verdict | Reason field | Off-board count |
|---|---|---|---:|
| P7 | PROVISIONAL | `BELOW_THRESHOLD` | 460 |
| P12 | PROVISIONAL | `UNKNOWN_DOB` | 349 |
| P2 | FORMER | `GRADUATED` | 49 |
| P3 | HIDDEN | `OUT_OF_BRACKET` | 16 |
| P9/P10 | RANKED | — | 66 (on board) |

---

*End of Verdict Distribution Audit*
