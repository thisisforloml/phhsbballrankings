# Rating Reformulation Baseline Audit

Generated: 2026-06-18T07:09:45.643Z

## Summary

- **GPS rows (v1):** 9391
- **PlayerRating rows:** 938
- **ProgramTeamRating rows:** 66
- **Cross-bracket evidence cases:** 840 (playing up: 13, limbo: 9)
- **Calendar board mismatches:** 13

## v1 Context Factors (Production)

| Factor | Neutral (1.0) % |
|--------|------------------|
| Opponent | 100% |
| Team | 100% |
| League | 100% |

Production v1 stores context factor columns but applies neutral weights.

## Field Coverage for Calibration

| Field | Coverage |
|-------|----------|
| BirthDate | 149/928 (16.1%) |
| Position | 164 (17.7%) |
| Minutes on GameStat | 9391 rows |
| eFG% on GPS | 8424/9391 |
| ProgramTeamRating | 66 |

## Calibration Readiness

Expand program team ratings and DOB coverage before calibration

## Cross-Bracket Samples (Top)

| Player | Competition | Home | Role | Games | Avg | Limbo |
|--------|-------------|------|------|-------|-----|-------|
| Nico Koa | U19 | — | UNKNOWN | 32 | 31.66 | no |
| Mateo De La Paz | U19 | — | UNKNOWN | 32 | 63.85 | no |
| Aidan Kaw | U19 | — | UNKNOWN | 31 | 74.69 | no |
| Marcus Fernandez | U19 | — | UNKNOWN | 30 | 66.63 | no |
| Savian Go | U19 | — | UNKNOWN | 30 | 52.9 | no |
| Kurt Chua | U19 | — | UNKNOWN | 29 | 47.26 | no |
| Andwele Poa | U19 | — | UNKNOWN | 28 | 53.4 | no |
| Earl Solis | U19 | — | UNKNOWN | 28 | 70.01 | no |
| Hans Go | U19 | — | UNKNOWN | 28 | 84.08 | no |
| Miguel Lim | U19 | — | UNKNOWN | 28 | 60.09 | no |
| Liam Ang | U19 | — | UNKNOWN | 27 | 47.18 | no |
| Kaleb Chua | U19 | — | UNKNOWN | 27 | 43.18 | no |
| Drew Cagadoc | U19 | — | UNKNOWN | 26 | 24.38 | no |
| Josh Lim | U19 | — | UNKNOWN | 25 | 67.72 | no |
| Marcus Tiu | U19 | — | UNKNOWN | 25 | 20.84 | no |
| Kenzo Centeno | U19 | — | UNKNOWN | 25 | 53.1 | no |
| Sean Yu | U19 | — | UNKNOWN | 24 | 18.94 | no |
| Xander Ty | U19 | — | UNKNOWN | 22 | 36.94 | no |
| Yuan Ramirez | U19 | — | UNKNOWN | 22 | 93.61 | no |
| Enzo Sosuan | U19 | — | UNKNOWN | 22 | 67.19 | no |
| Rocco Aranillo | U19 | — | UNKNOWN | 22 | 51.46 | no |
| Lucas Kaw | U19 | — | UNKNOWN | 22 | 93.98 | no |
| Alonzo Tsai | U19 | — | UNKNOWN | 22 | 51.16 | no |
| Kurt Ong | U19 | — | UNKNOWN | 22 | 40.99 | no |
| Eanne Vargas | U19 | — | UNKNOWN | 21 | 62.11 | no |

## Low-Game High-Rating Volatility

- Jordan Yeng (U19): 89.96 over 3 games
- Liam Santos (U13): 88.74 over 2 games
- Aiden Kitong (U13): 95.83 over 2 games
- Joshua Hayden Chua (U19): 87.84 over 1 games

Read-only audit. No database writes.
