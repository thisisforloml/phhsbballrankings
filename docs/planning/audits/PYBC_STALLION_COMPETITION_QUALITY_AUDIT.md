# PYBC vs Stallion Competition Quality Audit

**Generated:** 2026-06-18T13:33:26.690Z  
**Mode:** Read-only  
**Machine report:** `scripts/reports/pybc-stallion-competition-quality-audit.json`

## Executive summary

| Metric | PYBC | Stallion |
| --- | --- | --- |
| Leagues | 2 | 2 |
| Games | 74 | 114 |
| GPS rows | 1830 | 2151 |
| Unique players | 269 | 193 |
| Mean player avg GPS | 48.84 | 47.34 |

**Overlapping players (both competitions):** 0  
**Overlap with ≥3 games in each:** 0  
**Programs in both competitions:** 0  
**Teams (normalized name) in both:** 0  
**GPS rows with Program linkage:** 100%

## Critical limitation

**Zero same-player overlap.** PYBC leagues are **U13/U16**; Stallion leagues are **U19**. Cross-competition player GPS comparison is **not possible** with current data. Population-level GPS means are shown for transparency but **must not** be used alone for tier ordering (within-game percentile scaling + age mismatch).

## Population-level GPS (non-overlap — descriptive only)

| Stat | PYBC game GPS | Stallion game GPS | PYBC player avg | Stallion player avg |
| --- | ---: | ---: | ---: | ---: |
| Mean | 50.5 | 50.5 | 48.84 | 47.34 |
| Median | 50.5 | 50.5 | 45.42 | 44.26 |
| P25 / P75 | 25.55 / 75.34 | 26.1 / 75.32 | 32.8 / 64.51 | 28.08 / 65.36 |
| Std dev | 28.69 | 28.69 | 20.93 | 21.83 |

## Recommendation

| Field | Value |
| --- | --- |
| **Recommended PYBC tier** | **Tier 2** |
| **Evidence conclusion** | **Inconclusive** |
| **Confidence** | **LOW** |
| **Additional evidence required** | **Yes** |

Zero same-player overlap. PYBC covers U13/U16; Stallion covers U19 — populations are not age-aligned. Population mean GPS gap (PYBC 48.84 vs Stallion 47.34, Δ +1.5) is **not** valid evidence for tier ordering because GPS is within-game percentile-scaled and age groups differ. Governance rubric (COMPETITION_TIER_GOVERNANCE_FRAMEWORK.md) independently places PYBC and Stallion both at Tier 2 (Elite National Circuit); this audit cannot confirm or refute that via cross-player GPS.

### Expected impact on future rating governance

Provisional Tier 2 assignment stands from governance rubric only — not GPS-validated. Do not activate tier weights or finalize PYBC tier until age-aligned cross-competition evidence exists. Current DB Tier 3 for PYBC should not be changed on GPS grounds alone.

### Additional evidence notes

- Import age-aligned cohorts (e.g. PYBC 17U/19U or Stallion U16) to enable same-player comparison.
- No Program appears in both PYBC and Stallion — clubs use separate team records per competition despite Program linkage on GPS rows.
- Target ≥15 players with ≥3 games in each competition before GPS-based tier inference.
- Use team-name overlap analysis (see report) as supplementary program signal until Program linkage is complete.
- Complete League Quality Score computation for PYBC seasons.

## Aggregate GPS comparison

| Metric | Value |
| --- | ---: |
| Mean PYBC avg GPS (overlap players) | 0 |
| Mean Stallion avg GPS (overlap players) | 0 |
| Mean GPS delta (PYBC − Stallion) | 0 |
| Median GPS delta | 0 |
| Std dev of deltas | 0 |
| PYBC higher (count) | 0 |
| Stallion higher (count) | 0 |
| Tied (count) | 0 |

### Delta distribution (PYBC avg − Stallion avg)

| Range | Players |
| --- | ---: |
| — | 0 |

### Outliers

**Top positive (PYBC > Stallion):**

- None

**Top negative (Stallion > PYBC):**

- None

## Overlapping players (top 25 by |Δ|)

| Player | PYBC G | Stallion G | PYBC avg | Stallion avg | Δ GPS | PYBC %ile | Stallion %ile | Δ %ile |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| — | No overlapping players | — | — | — | — | — | — | — |

## Program overlap (via programId)

| Program | PYBC games | Stallion games | PYBC team avg GPS | Stallion team avg GPS | Δ |
| --- | ---: | ---: | ---: | ---: | ---: |
| — | No program overlap | — | — | — |

## Team overlap (normalized team name)

| Team | PYBC G | Stallion G | PYBC players | Stallion players | PYBC avg GPS | Stallion avg GPS | Δ |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| — | No normalized team-name overlap | — | — | — | — | — |

## Methodology

- **GPS:** Formula v1 `finalPerformanceScore` per game.
- **Player avg:** Arithmetic mean of game GPS within each competition family.
- **Percentile:** Player's competition average vs all player averages in that family (0–100).
- **Delta:** PYBC avg GPS − Stallion avg GPS (negative = higher in Stallion).
- **Age-group note:** PYBC leagues are U13/U16; Stallion leagues are U19 — direct player overlap may reflect multi-age careers or data linkage, not same-season cohort.

---

*Read-only audit — no data modified.*
