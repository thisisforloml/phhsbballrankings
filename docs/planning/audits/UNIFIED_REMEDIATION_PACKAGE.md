# Unified Remediation Package

**Generated:** 2026-06-17T10:14:34.944Z
**Mode:** Read-only analysis — no data mutations

---

## Executive Summary

| Metric | Value |
|---|---:|
| Master queue items | 44 |
| Import items | 14 |
| DOB batch items | 21 |
| Duplicate player clusters | 7 |
| Duplicate program groups | 2 |
| **Projected RANKED gain (all items)** | **+306** |
| Projected P7 reduction | −304 |
| Projected P12 reduction | −498 |
| P12 DOB blockers (live) | 328 |
| Near-threshold players (live) | 292 |

### Ranking Impact Formula

`Ranking Impact = Expected RANKED gain + (Expected P7 reduction × 0.1)`

`ROI Score = Ranking Impact ÷ Effort Score` (low=1, medium=2, high=3)

### Key DOB Constraint

328 players are P12 (UNKNOWN_DOB). DOB alone unlocks RANKED only when verified games ≥ threshold (8 boys / 6 girls). 13 U19 Girls and 175 U19 Boys already meet game threshold but remain blocked; U19 Girls board is empty (0 RANKED). Imports without DOB shift players P7→P12 rather than clearing blockers — coordinate DOB batches (NU/UST Girls first) with high-ROI imports (PYBC 15U).

### Live Database Counts

| Entity | Count |
|---|---:|
| players | 930 |
| activeGames | 405 |
| gameStats | 9391 |
| playerRatings | 940 |
| programs | 55 |
| teams | 81 |

---

## Master Remediation Queue

| Priority | Queue | Action | Board | RANKED | P7↓ | P12↓ | Effort | Impact | ROI |
|---:|---|---|---|---:|---:|---:|---|---:|---:|
| 1 | DOB | Enter DOB: Unassigned U19 Boys batch | U19 Boys | +78 | −0 | −78 | high (3) | 78 | 26 |
| 2 | DOB | Enter DOB: U19 Boys remaining programs (11 programs) | U19 Boys | +38 | −0 | −38 | high (3) | 38 | 12.67 |
| 3 | IMPORT | Import: PYBC 15U (Family rollup) | U16 Boys | +0 | −85 | −85 | low (1) | 8.5 | 8.5 |
| 4 | DOB | Enter DOB: NU/UST U19 Girls batch | U19 Girls | +13 | −0 | −24 | medium (2) | 13 | 6.5 |
| 5 | DOB | Enter DOB: Far Eastern U16 batch | U16 | +13 | −0 | −13 | medium (2) | 13 | 6.5 |
| 6 | DOB | Enter DOB: Ateneo U16 batch | U16 | +13 | −0 | −13 | medium (2) | 13 | 6.5 |
| 7 | DOB | Enter DOB: DLSZ U16 batch | U16 | +11 | −0 | −11 | medium (2) | 11 | 5.5 |
| 8 | DOB | Enter DOB: U16 remaining programs (2 programs) | U16 | +16 | −0 | −16 | high (3) | 16 | 5.33 |
| 9 | DOB | Enter DOB: NU U16 batch | U16 | +15 | −0 | −15 | high (3) | 15 | 5 |
| 10 | DOB | Enter DOB: University of U19 Boys batch | U19 Boys | +10 | −0 | −10 | medium (2) | 10 | 5 |
| 11 | DOB | Enter DOB: Adamson University U16 batch | U16 | +10 | −0 | −10 | medium (2) | 10 | 5 |
| 12 | DOB | Enter DOB: UST U16 batch | U16 | +10 | −0 | −10 | medium (2) | 10 | 5 |
| 13 | DOB | Enter DOB: University of U16 batch | U16 | +10 | −0 | −10 | medium (2) | 10 | 5 |
| 14 | DOB | Enter DOB: San Pedro Spartans U16 batch | U16 | +10 | −0 | −10 | medium (2) | 10 | 5 |
| 15 | DOB | Enter DOB: San Beda U19 Boys batch | U19 Boys | +9 | −0 | −9 | medium (2) | 9 | 4.5 |
| 16 | DOB | Enter DOB: University of U19 Boys batch | U19 Boys | +9 | −0 | −9 | medium (2) | 9 | 4.5 |
| 17 | IMPORT | Import: Philippine Youth Basketball Championship - 15U (1) | U16 Boys | +0 | −42 | −11 | low (1) | 4.2 | 4.2 |
| 18 | IMPORT | Import: PYBC 15U (1) | U16 Boys | +0 | −42 | −11 | low (1) | 4.2 | 4.2 |
| 19 | DOB | Enter DOB: San Sebastian College-Recoletos U19 Boys batch | U19 Boys | +8 | −0 | −8 | medium (2) | 8 | 4 |
| 20 | DOB | Enter DOB: Arellano University U19 Boys batch | U19 Boys | +8 | −0 | −8 | medium (2) | 8 | 4 |
| 21 | DOB | Enter DOB: Jose Rizal University U19 Boys batch | U19 Boys | +8 | −0 | −8 | medium (2) | 8 | 4 |
| 22 | DOB | Enter DOB: Lyceum of U19 Boys batch | U19 Boys | +7 | −0 | −7 | medium (2) | 7 | 3.5 |
| 23 | IMPORT | Import: Philippine Youth Basketball Championship – 13u (Season 2026) | U13 Boys | +0 | −23 | −5 | low (1) | 2.3 | 2.3 |
| 24 | DUPLICATE_PROGRAM | Consolidate program: San Pedro Spartans / San Pedro Spartans | — | +0 | −0 | −0 | low (1) | 2 | 2 |
| 25 | DUPLICATE_PROGRAM | Consolidate program: LEV Construction Full Potential / Lev Construction Full Potential | — | +0 | −0 | −0 | low (1) | 2 | 2 |
| 26 | IMPORT | Import: UAAP Season 88 HS Boys Basketball (Season 88) | U19 Boys | +1 | −9 | −3 | low (1) | 1.9 | 1.9 |
| 27 | IMPORT | Import: 5th Stallion Cup – Teens 17u (Season 2026) | U19 Boys | +0 | −17 | −17 | low (1) | 1.7 | 1.7 |
| 28 | IMPORT | Import: 5th Stallion Cup – Teens 17u (Season 2025) | U19 Boys | +0 | −17 | −17 | low (1) | 1.7 | 1.7 |
| 29 | IMPORT | Import: PYBC U16 Boys Basketball (2025 Season) | U16 Boys | +0 | −12 | −4 | low (1) | 1.2 | 1.2 |
| 30 | DUPLICATE_PLAYER | Review player merge: Christiane Chan / Christiane Dion Chan / Vance Chan | — | +2 | −2 | −0 | medium (2) | 2.2 | 1.1 |
| 31 | DUPLICATE_PLAYER | Review player merge: Roberto Sison / Roberto Sancho Sison / Denver Sison | — | +2 | −2 | −0 | medium (2) | 2.2 | 1.1 |
| 32 | IMPORT | Import: 6th Stallion Cup Teens – Jumbo Plastic Conference 18u (Season 2026) | U19 Boys | +0 | −10 | −0 | low (1) | 1 | 1 |
| 33 | IMPORT | Import: UAAP Season 88 HS Girls Basketball (Season 88) | U19 Girls | +0 | −9 | −7 | low (1) | 0.9 | 0.9 |
| 34 | IMPORT | Import: 4th Stallion Cup – Teens 17u (Season 2026) | U19 Boys | +0 | −9 | −3 | low (1) | 0.9 | 0.9 |
| 35 | IMPORT | Import: NCAA Season 101 Junior's Basketball (Season 101) | U19 Boys | +0 | −9 | −3 | low (1) | 0.9 | 0.9 |
| 36 | IMPORT | Import: 3rd Stallion Cup – Teens 17u (Season 2026) | U19 Boys | +0 | −6 | −1 | low (1) | 0.6 | 0.6 |
| 37 | DUPLICATE_PLAYER | Review player merge: Kenzo Centeno / Kenzo Rui Centeno | — | +1 | −1 | −0 | medium (2) | 1.1 | 0.55 |
| 38 | DUPLICATE_PLAYER | Review player merge: Shaun Haw / Shaun Jordan Haw | — | +1 | −1 | −0 | medium (2) | 1.1 | 0.55 |
| 39 | DUPLICATE_PLAYER | Review player merge: Andres Braganza / Andres Thaddeus Braganza | — | +1 | −1 | −0 | medium (2) | 1.1 | 0.55 |
| 40 | DUPLICATE_PLAYER | Review player merge: Liam Jardin / Liam Franko Jardin | — | +1 | −1 | −0 | medium (2) | 1.1 | 0.55 |
| 41 | DUPLICATE_PLAYER | Review player merge: Franco Macapagal / Franco Javier Macapagal | — | +1 | −1 | −0 | medium (2) | 1.1 | 0.55 |
| 42 | IMPORT | Import: UAAP Season 88 16U Boys Basketball (Season 88) | U16 Boys | +0 | −5 | −3 | low (1) | 0.5 | 0.5 |
| 43 | DOB | Enter DOB: Ateneo U19 Girls batch | U19 Girls | +0 | −0 | −12 | medium (2) | 0 | 0 |
| 44 | DOB | Enter DOB: DLSZ U19 Girls batch | U19 Girls | +0 | −0 | −9 | medium (2) | 0 | 0 |

---

## Top 10 Actions

### #1 Enter DOB: Unassigned U19 Boys batch
- Queue: DOB · Board: U19 Boys
- Expected: +78 RANKED, −0 P7, −78 P12
- Effort: high · Ranking Impact: 78 · ROI: 26
- 78 P12 players (78 at ≥8 games, avg 18.6 games)

### #2 Enter DOB: U19 Boys remaining programs (11 programs)
- Queue: DOB · Board: U19 Boys
- Expected: +38 RANKED, −0 P7, −38 P12
- Effort: high · Ranking Impact: 38 · ROI: 12.67
- 38 P12 players across Colegio de, Malayan High, Emilio Aguinaldo College, University of, UST, La Salle, DLSZ, Ateneo, Adamson University, NU, Far Eastern

### #3 Import: PYBC 15U (Family rollup)
- Queue: IMPORT · Board: U16 Boys
- Expected: +0 RANKED, −85 P7, −85 P12
- Effort: low · Ranking Impact: 8.5 · ROI: 8.5
- 10 game(s) in submission inventory not in DB

### #4 Enter DOB: NU/UST U19 Girls batch
- Queue: DOB · Board: U19 Girls
- Expected: +13 RANKED, −0 P7, −24 P12
- Effort: medium · Ranking Impact: 13 · ROI: 6.5
- 24 P12 players (13 at ≥8 games, avg 7.1 games)

### #5 Enter DOB: Far Eastern U16 batch
- Queue: DOB · Board: U16
- Expected: +13 RANKED, −0 P7, −13 P12
- Effort: medium · Ranking Impact: 13 · ROI: 6.5
- 13 P12 players (13 at ≥8 games, avg 15.5 games)

### #6 Enter DOB: Ateneo U16 batch
- Queue: DOB · Board: U16
- Expected: +13 RANKED, −0 P7, −13 P12
- Effort: medium · Ranking Impact: 13 · ROI: 6.5
- 13 P12 players (13 at ≥8 games, avg 13.0 games)

### #7 Enter DOB: DLSZ U16 batch
- Queue: DOB · Board: U16
- Expected: +11 RANKED, −0 P7, −11 P12
- Effort: medium · Ranking Impact: 11 · ROI: 5.5
- 11 P12 players (11 at ≥8 games, avg 12.6 games)

### #8 Enter DOB: U16 remaining programs (2 programs)
- Queue: DOB · Board: U16
- Expected: +16 RANKED, −0 P7, −16 P12
- Effort: high · Ranking Impact: 16 · ROI: 5.33
- 16 P12 players across University of, Unassigned

### #9 Enter DOB: NU U16 batch
- Queue: DOB · Board: U16
- Expected: +15 RANKED, −0 P7, −15 P12
- Effort: high · Ranking Impact: 15 · ROI: 5
- 15 P12 players (15 at ≥8 games, avg 14.1 games)

### #10 Enter DOB: University of U19 Boys batch
- Queue: DOB · Board: U19 Boys
- Expected: +10 RANKED, −0 P7, −10 P12
- Effort: medium · Ranking Impact: 10 · ROI: 5
- 10 P12 players (10 at ≥8 games, avg 13.3 games)
