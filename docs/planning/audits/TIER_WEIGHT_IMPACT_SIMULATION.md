# Tier Weight Impact Simulation

**Generated:** 2026-06-18T13:08:37.898Z  
**Mode:** Read-only simulation (no writes)

## Method

- **Scenario A:** Production today — all games weighted at 1.0× (matches stored GPS).
- **Scenario B:** Code convention weights on `League.tier` (1→1.00, 2→1.10, 3→1.25, 4→1.40).
- **Scenario C:** User convention weights (1→1.40, 2→1.25, 3→1.10, 4→1.00).

Simulated per-game score: `min(100, finalPerformanceScore × tierWeight)`.  
Player rating: **unweighted mean** of simulated game scores (Formula v1 cumulative pattern).

## Recommendation

**C** — Tier weighting creates excessive volatility in top boards relative to current production ordering.  
**Confidence:** HIGH

## Key findings

- **9,391** Formula v1 GPS rows simulated; Scenario A matches stored ratings (no sample mismatches in U19 Boys top 30).
- Active leagues use only **tier 1** (UAAP, NCAA) and **tier 3** (Stallion, PYBC). Tiers 2 and 4 are unused — weight maps only affect the two live tiers.
- **Scenario B (code convention)** boosts tier-3 circuit games (1.25×) and leaves tier-1 collegiate at 1.0×. Circuit-heavy top players gain rating points and reorder the board; UAAP-only profiles drop in rank without rating change (relative reordering).
- **Scenario C (user convention)** inverts that: tier-1 collegiate games get 1.40×, tier-3 circuit 1.10×. UAAP-heavy players (e.g. Jude Eriobu, Xyriel Macahipay) rise; circuit-heavy profiles (e.g. Lucas Kaw) fall despite higher absolute simulated ratings.
- Neither convention is neutral — both produce double-digit average rank movement across full U19 Boys pool (~28.52 positions B, ~27.51 positions C).

## Movement summary (vs Scenario A)

| Board | Scenario | Avg abs rank Δ | Avg abs rating Δ | Top-10 churn | Top-25 churn | Top-50 churn |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| U19 Boys | B (code) | 28.52 | 3.76 | 3 | 9 | 14 |
| U19 Boys | C (user) | 27.51 | 10.16 | 6 | 6 | 9 |
| U16 Boys | B (code) | 15.6 | 5.23 | 3 | 7 | 9 |
| U16 Boys | C (user) | 15.95 | 8.91 | 3 | 7 | 8 |
| U19 Girls | B (code) | 0 | 0 | 0 | 0 | — |
| U19 Girls | C (user) | 0.86 | 13.88 | 1 | 1 | — |

Positive rank delta = moved up; negative = moved down (vs Scenario A).

## Board previews

### U19_BOYS (top 10 of 50)

| A Rank | Player | A Rating | B Rating | Δ Rank B | C Rating | Δ Rank C |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | Jude Eriobu | 98.33 | 98.33 | -7 | 100 | 0 |
| 2 | Greggy Calma | 95.09 | 100 | 1 | 99.88 | -2 |
| 3 | Lucas Kaw | 93.98 | 99.93 | -2 | 98.08 | -8 |
| 4 | Yuan Ramirez | 93.61 | 99.84 | -2 | 97.51 | -10 |
| 5 | Josef Calo-oy | 93.1 | 93.1 | -14 | 100 | 2 |
| 6 | Mark Esperanza | 90.61 | 90.61 | -18 | 99 | 0 |
| 7 | Jordan Yeng | 89.96 | 100 | 4 | 95.63 | -16 |
| 8 | Joshua Chua | 89.58 | 99.05 | 1 | 95.39 | -17 |
| 9 | Allen Te | 89.26 | 97.7 | 0 | 95.18 | -17 |
| 10 | Sean Franco | 88.82 | 88.82 | -17 | 96.96 | -8 |

### U16_BOYS (top 10 of 50)

| A Rank | Player | A Rating | B Rating | Δ Rank B | C Rating | Δ Rank C |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | Goodluck Okebata | 96.58 | 96.58 | -4 | 100 | 0 |
| 2 | Jesse Arellano | 94.05 | 100 | 1 | 98.9 | -2 |
| 3 | Rye Teodor Villaruz | 93.78 | 99.18 | 0 | 97.78 | -2 |
| 4 | Prince Cariño | 92.5 | 92.5 | -7 | 99.39 | 1 |
| 5 | Akhiro Franz Reynon | 90.09 | 95.69 | -2 | 93.81 | -9 |
| 6 | Moussa Diakite | 89.91 | 89.91 | -12 | 96.88 | 0 |
| 7 | Thadeus Angeles | 89.57 | 99.24 | 5 | 95.43 | -1 |
| 8 | Riley Yuan Dela Cruz | 88.42 | 98.08 | 4 | 94.72 | -3 |
| 9 | Fran Flores | 88.11 | 88.11 | -12 | 99.7 | 7 |
| 10 | Kurt Devron Benitez | 87.75 | 95.34 | 2 | 92.47 | -7 |

### U19_GIRLS (top 10 of 25)

| A Rank | Player | A Rating | B Rating | Δ Rank B | C Rating | Δ Rank C |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | Aubrey Lapasaran | 89.8 | 89.8 | 0 | 100 | -1 |
| 2 | Adin Rosano | 87.7 | 87.7 | 0 | 100 | 1 |
| 3 | Riri Perez | 87.44 | 87.44 | 0 | 97.56 | -1 |
| 4 | Janice Oczon | 78.92 | 78.92 | 0 | 92.99 | -3 |
| 5 | Pia Petalcorin | 78.31 | 78.31 | 0 | 98.05 | 2 |
| 6 | Lea Pinuela | 77.91 | 77.91 | 0 | 95.61 | 1 |
| 7 | Koukou Talla | 74.99 | 74.99 | 0 | 89.38 | -2 |
| 8 | Apyang Dulay | 74.6 | 74.6 | 0 | 89.18 | -2 |
| 9 | Ima Navarro | 72.7 | 72.7 | 0 | 87.71 | -3 |
| 10 | Ruiza Olmos | 71.84 | 71.84 | 0 | 95.44 | 4 |

## Special review set

| Player | Tier exposure | Scenario A | Scenario B | Scenario C |
| --- | --- | --- | --- | --- |
| Lucas Kaw | tier3 100% (22g) | 93.98 (#3) | 99.93 (#5, Δ-2) | 98.08 (#11, Δ-8) |
| Jude Eriobu | tier1 100% (16g) | 98.33 (#1) | 98.33 (#8, Δ-7) | 100 (#1, Δ0) |
| Xyriel Macahipay | tier1 100% (15g) | 84.13 (#24) | 84.13 (#49, Δ-25) | 98.39 (#10, Δ14) |

See `specialReviewTop10` in JSON for full top-10 U19/U16 Boys per-scenario breakdown.

## Full data

See `scripts/reports/tier-weight-impact-simulation.json` for complete top-50 lists, entered/exited players, and largest movers.

---

*Read-only simulation — no GPS, ratings, snapshots, or league records modified.*
