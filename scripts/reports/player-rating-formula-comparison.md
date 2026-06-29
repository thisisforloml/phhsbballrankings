# Player Rating Formula Comparison

Generated: 2026-05-31T08:29:02.005Z

## Current Production Formula Summary

- Formula v1 computes raw GamePerformanceScore values from official imported GameStats.
- Current raw score uses points, missed FG/FT costs, rebounds, assists, steals, blocks, turnovers, personal fouls, and fouls drawn.
- Raw game values are percentile-scaled to 1-100 within the imported submission context.
- PlayerRating is the simple average of stored finalPerformanceScore values for the processed age/season context.
- Current production ratings do not apply Bayesian shrinkage in the active post-import processing path.
- Current public ranking/snapshot generation sorts existing PlayerRating rows; this comparison does not update those rows.

## Candidate Formula Summary

- Claude candidate uses league/season possessions, PPP, rebound rates, and FT-cost-per-foul.
- Raw game value excludes plus-minus.
- Candidate scores are percentile-scaled within normalized age/gender/competition/season pools.
- Player ratings are reported both with Bayesian shrinkage and without shrinkage.
- Claude No Shrinkage = recency-weighted average of candidate game scores with no pull toward age-group mean.
- Advanced bonus is reported separately because it can double-count efficiency already captured by missed-shot and FT costs.

## Read-only Guardrails

- Active official games are read as non-deleted `SUBMITTED` or `VERIFIED` Game rows, matching the current imported/published dataset convention.
- No database writes were performed.
- No PlayerRating, GamePerformanceScore, RankingSnapshot, GameStat, or Game rows were updated.
- The JSON and Markdown files are reports only.

## PYBC U16 Boys / PYBC 15U

Input: 36 games, 930 GameStats, 133 players, 1 scaling pools.

### Top 10 Side by Side

| rank | current | claudeShrink | claudeNoShrink | claudeAdvancedShrink |
| --- | --- | --- | --- | --- |
| 1 | Jesse Arellano (94.05) | Akhiro Franz Reynon (71.37) | Rye Teodor Villaruz (94.47) | Akhiro Franz Reynon (71.17) |
| 2 | Rye Teodor Villaruz (93.78) | Jesse Arellano (69.88) | Jesse Arellano (93) | Jesse Arellano (69.54) |
| 3 | Akhiro Franz Reynon (90.09) | Rye Teodor Villaruz (69.25) | Akhiro Franz Reynon (91.65) | Rye Teodor Villaruz (69) |
| 4 | Thadeus Angeles (89.57) | Riley Yuan Dela Cruz (65.79) | Thadeus Angeles (88.35) | Riley Yuan Dela Cruz (65.64) |
| 5 | Riley Yuan Dela Cruz (88.42) | Kurt Devron Benitez (64.45) | Riley Yuan Dela Cruz (86.69) | Kurt Devron Benitez (64.39) |
| 6 | Kurt Devron Benitez (87.75) | Thadeus Angeles (63.8) | Kurt Devron Benitez (86.41) | Thadeus Angeles (64.01) |
| 7 | Allain Escober (83.5) | Xerone Dizon (63.75) | Allain Escober (84.53) | Xerone Dizon (63.66) |
| 8 | Derict Reyes (82.57) | Allain Escober (63.67) | Derict Reyes (83.47) | Allain Escober (63.3) |
| 9 | Lawrence Tombocon (82.46) | Lawrence Tombocon (63.1) | Lawrence Tombocon (83.13) | Lawrence Tombocon (63.27) |
| 10 | Roan Lee Ancheta (79.77) | Chester Cruz (62.48) | Xerone Dizon (82.1) | Chester Cruz (61.88) |

### Distribution

```json
{
  "currentFormula": {
    "min": 8.93,
    "p25": 33.89,
    "median": 46.05,
    "p75": 65.19,
    "max": 94.05,
    "mean": 49.21
  },
  "claudeShrink": {
    "min": 33.34,
    "p25": 43.28,
    "median": 47.81,
    "p75": 55.56,
    "max": 71.37,
    "mean": 49.44
  },
  "claudeNoShrink": {
    "min": 10.86,
    "p25": 32.38,
    "median": 46.65,
    "p75": 64.92,
    "max": 94.47,
    "mean": 49.07
  },
  "claudeWithAdvancedShrink": {
    "min": 33.28,
    "p25": 43.22,
    "median": 48.22,
    "p75": 55.89,
    "max": 71.17,
    "mean": 49.48
  }
}
```

### Biggest Risers - Claude With Shrinkage

| change | player | current | candidate | games | ppg | ts |
| --- | --- | --- | --- | --- | --- | --- |
| 29 | Steven Daya | 18.8 | 43.39 | 2 | 0.5 | 8.5 |
| 27 | Vincent Nido | 29.18 | 45.16 | 2 | 0 | 0 |
| 24 | Joaquin Miguel Gelera | 29.23 | 45.11 | 2 | 0 | 0 |
| 23 | William Sulit | 26.05 | 43.83 | 3 | 0.7 | 25.8 |
| 17 | Mustapha Hasim | 37.73 | 47.01 | 7 | 4.3 | 36 |
| 16 | AJ Arma | 37.7 | 46.93 | 5 | 2.4 | 55.1 |
| 13 | Michael Tan Estrevillo | 68.41 | 60.16 | 11 | 7.8 | 41.1 |
| 10 | Eli Dulot | 70.27 | 60.54 | 12 | 7.4 | 50.2 |
| 10 | Kian Pachoco | 21.43 | 40.89 | 5 | 0.6 | 27.6 |
| 10 | Kaeden Pio Rapista | 55.57 | 53.73 | 10 | 6.2 | 39.7 |

### Biggest Fallers - Claude With Shrinkage

| change | player | current | candidate | games | ppg | ts |
| --- | --- | --- | --- | --- | --- | --- |
| -19 | Leon Sequerra | 39.95 | 43.12 | 12 | 1.8 | 46.6 |
| -17 | Calix Tubig | 40.9 | 43.69 | 7 | 2.4 | 47.9 |
| -16 | Prince Labong | 30.62 | 39.04 | 9 | 2.9 | 32.8 |
| -14 | Ryoma Tanaka | 35 | 41.51 | 8 | 1.1 | 34.4 |
| -13 | Marcus Gamboa | 29.4 | 39.34 | 8 | 2.6 | 29.1 |
| -12 | Rafael Dela Cruz | 34.79 | 41.59 | 11 | 2 | 42.6 |
| -12 | Andrei Calizo | 61.55 | 51.19 | 3 | 5.7 | 53.9 |
| -12 | Adrian Dela Cruz | 35.05 | 41.8 | 10 | 2 | 30.6 |
| -10 | Yul Gerard Nicolas | 44.63 | 45.46 | 10 | 4.2 | 35 |
| -10 | Dave Badion | 39.87 | 44.13 | 7 | 3.6 | 29.3 |

### Biggest Risers - Claude No Shrinkage

| change | player | current | noShrink | games | ppg | ts |
| --- | --- | --- | --- | --- | --- | --- |
| 16 | Mustapha Hasim | 37.73 | 44.06 | 7 | 4.3 | 36 |
| 14 | AJ Arma | 37.7 | 42.65 | 5 | 2.4 | 55.1 |
| 13 | Yuri Alfaro | 48.08 | 52.42 | 4 | 4.8 | 41.7 |
| 12 | Migz Capistrano | 29.22 | 32.78 | 6 | 0.8 | 51.2 |
| 12 | Aaron Gidoc | 32.08 | 36.06 | 9 | 1 | 21.7 |
| 11 | Andrei Miguel Albino | 42.05 | 47.93 | 6 | 4.5 | 47 |
| 9 | Rain Camunias | 25.06 | 28.12 | 8 | 1.3 | 25.8 |
| 9 | Kaeden Pio Rapista | 55.57 | 58.4 | 10 | 6.2 | 39.7 |
| 9 | Zani Acera | 36.45 | 39.43 | 8 | 3.3 | 41.6 |
| 7 | Dwayne Fuentes | 68.69 | 71.83 | 8 | 13.5 | 39.6 |

### Biggest Fallers - Claude No Shrinkage

| change | player | current | noShrink | games | ppg | ts |
| --- | --- | --- | --- | --- | --- | --- |
| -15 | Calix Tubig | 40.9 | 36 | 7 | 2.4 | 47.9 |
| -15 | Jhaybie Batungbakal | 44.4 | 37.57 | 3 | 6 | 59.2 |
| -13 | Marco Vicente | 35.5 | 29.67 | 3 | 1.3 | 16.1 |
| -11 | Swey Cruz | 44.77 | 40.61 | 5 | 2.8 | 31.3 |
| -9 | Joaquin Miguel Gelera | 29.23 | 25.3 | 2 | 0 | 0 |
| -8 | Martin Morales | 48.89 | 46.57 | 11 | 4.8 | 39.1 |
| -8 | Acee Abar | 72.74 | 67.09 | 8 | 13.9 | 48.3 |
| -7 | Yul Gerard Nicolas | 44.63 | 41.84 | 10 | 4.2 | 35 |
| -7 | Dave Badion | 39.87 | 37.08 | 7 | 3.6 | 29.3 |
| -7 | Joaquin Sy | 26.21 | 23.7 | 4 | 2 | 50 |

### Low-Game Outliers - Claude No Shrinkage

| player | rank | noShrink | games | ppg | ts |
| --- | --- | --- | --- | --- | --- |
| Rye Teodor Villaruz | 1 | 94.47 | 8 | 23.3 | 48.4 |
| Jesse Arellano | 2 | 93 | 9 | 14.8 | 48.1 |
| Thadeus Angeles | 4 | 88.35 | 6 | 16 | 66.3 |
| Riley Yuan Dela Cruz | 5 | 86.69 | 8 | 16 | 53.1 |
| Kurt Devron Benitez | 6 | 86.41 | 7 | 14.4 | 60 |
| Allain Escober | 7 | 84.53 | 7 | 17 | 48.7 |
| Derict Reyes | 8 | 83.47 | 6 | 12.3 | 42 |
| Lawrence Tombocon | 9 | 83.13 | 7 | 12.9 | 53.9 |
| Xerone Dizon | 10 | 82.1 | 8 | 12.6 | 45.1 |
| Royette Villareal | 11 | 79.74 | 5 | 12.2 | 56.3 |

### Star Band Distribution

```json
{
  "current": {
    "1": 92,
    "2": 16,
    "3": 16,
    "4": 6,
    "5": 3
  },
  "claudeShrink": {
    "1": 116,
    "2": 16,
    "3": 1
  },
  "claudeNoShrink": {
    "1": 93,
    "2": 15,
    "3": 15,
    "4": 7,
    "5": 3
  },
  "claudeAdvancedShrink": {
    "1": 117,
    "2": 15,
    "3": 1
  }
}
```

### Star Band Changes - Claude With Shrinkage

| player | currentStar | candidateStar | current | candidate | games |
| --- | --- | --- | --- | --- | --- |
| Thadeus Angeles | 4 | 2 | 89.57 | 63.8 | 6 |
| Rye Teodor Villaruz | 5 | 2 | 93.78 | 69.25 | 8 |
| Jesse Arellano | 5 | 2 | 94.05 | 69.88 | 9 |
| Kurt Devron Benitez | 4 | 2 | 87.75 | 64.45 | 7 |
| Riley Yuan Dela Cruz | 4 | 2 | 88.42 | 65.79 | 8 |
| Derict Reyes | 4 | 2 | 82.57 | 61.97 | 6 |
| Allain Escober | 4 | 2 | 83.5 | 63.67 | 7 |
| Dennis Yojan Necesario | 3 | 1 | 77.95 | 58.17 | 5 |
| Royette Villareal | 3 | 1 | 78.8 | 59.3 | 5 |
| Lawrence Tombocon | 4 | 2 | 82.46 | 63.1 | 7 |
| Akhiro Franz Reynon | 5 | 3 | 90.09 | 71.37 | 11 |
| Roan Lee Ancheta | 3 | 2 | 79.77 | 61.49 | 8 |
| Tristan Teoc | 3 | 1 | 72.91 | 56.16 | 4 |
| Juan Xian Coronel | 3 | 1 | 76.08 | 59.83 | 8 |
| Chester Cruz | 3 | 2 | 78.52 | 62.48 | 8 |

### Star Band Changes - Claude No Shrinkage

| player | currentStar | noShrinkStar | current | noShrink | games |
| --- | --- | --- | --- | --- | --- |
| Acee Abar | 3 | 2 | 72.74 | 67.09 | 8 |
| Andrei Calizo | 2 | 1 | 61.55 | 58.26 | 3 |
| Ron Jireh Mayor | 2 | 1 | 61.34 | 58.16 | 7 |
| Dwayne Fuentes | 2 | 3 | 68.69 | 71.83 | 8 |
| Xerone Dizon | 3 | 4 | 79.42 | 82.1 | 8 |
| Stephen Uy | 1 | 2 | 59.54 | 62.06 | 10 |
| Philip Andrei Ong | 3 | 2 | 71.2 | 69.02 | 5 |
| Michael Tan Estrevillo | 2 | 3 | 68.41 | 70.24 | 11 |

## Boys U19

Input: 143 games, 3615 GameStats, 302 players, 2 scaling pools.

### Top 10 Side by Side

| rank | current | claudeShrink | claudeNoShrink | claudeAdvancedShrink |
| --- | --- | --- | --- | --- |
| 1 | Jude Eriobu (98.33) | Jude Eriobu (78.43) | Jude Eriobu (98.58) | Jude Eriobu (78.29) |
| 2 | Josef Calo-oy (93.1) | Cabs Cabonilas (73.75) | Josef Calo-oy (93.17) | Cabs Cabonilas (73.45) |
| 3 | Mark Esperanza (90.61) | Josef Calo-oy (73.6) | Mark Esperanza (91.55) | Ray Ladica (73.12) |
| 4 | Sean Franco (88.82) | Ray Ladica (73.45) | Cabs Cabonilas (88.26) | Sean Franco (73.08) |
| 5 | Steven Creus (88.41) | Sean Franco (73.39) | Steven Creus (87.87) | Josef Calo-oy (73.08) |
| 6 | Ray Ladica (88.34) | Moussa Diakite (71.7) | Ray Ladica (87.8) | Moussa Diakite (71.4) |
| 7 | Cabs Cabonilas (88.19) | Mark Esperanza (70.94) | Sean Franco (87.7) | Steven Creus (71.23) |
| 8 | Moussa Diakite (87.27) | Maco Dabao (70.88) | Maco Dabao (87.34) | Mark Esperanza (70.67) |
| 9 | Maco Dabao (87.15) | Steven Creus (70.5) | Jetlee Melano (87.32) | Maco Dabao (70.04) |
| 10 | Jetlee Melano (86.36) | Jetlee Melano (70.18) | Moussa Diakite (86.7) | Jetlee Melano (69.86) |

### Distribution

```json
{
  "currentFormula": {
    "min": 4.51,
    "p25": 30.32,
    "median": 41.7,
    "p75": 60.8,
    "max": 98.33,
    "mean": 46.01
  },
  "claudeShrink": {
    "min": 28.79,
    "p25": 39.69,
    "median": 44.35,
    "p75": 53.97,
    "max": 78.43,
    "mean": 47.49
  },
  "claudeNoShrink": {
    "min": 6.73,
    "p25": 30.27,
    "median": 42.3,
    "p75": 60.3,
    "max": 98.58,
    "mean": 46.2
  },
  "claudeWithAdvancedShrink": {
    "min": 29.03,
    "p25": 39.75,
    "median": 44.43,
    "p75": 54.09,
    "max": 78.29,
    "mean": 47.55
  }
}
```

### Biggest Risers - Claude With Shrinkage

| change | player | current | candidate | games | ppg | ts |
| --- | --- | --- | --- | --- | --- | --- |
| 130 | Andrei Lumaking | 10.68 | 42.97 | 1 | 0 | 0 |
| 129 | Herbert Adajar | 22.49 | 44.72 | 1 | 1 | 26.6 |
| 114 | Dean Parasa | 23.9 | 44.29 | 1 | 0 | - |
| 114 | Alfonso Villavicencio | 23.33 | 43.89 | 2 | 1 | 17 |
| 104 | Chazmyr Olaes | 16.74 | 42.1 | 2 | 0 | 0 |
| 99 | Dwayne Evangelista | 17.76 | 41.98 | 2 | 0 | - |
| 89 | Vandolf Urdaneta | 19.99 | 41.75 | 2 | 0 | 0 |
| 83 | Evo Castillo | 30.03 | 44.54 | 1 | 2 | 33.3 |
| 74 | Richmund Someros | 4.51 | 39.62 | 2 | 0 | 0 |
| 73 | Matt Integro | 19.75 | 40.69 | 3 | 0 | 0 |

### Biggest Fallers - Claude With Shrinkage

| change | player | current | candidate | games | ppg | ts |
| --- | --- | --- | --- | --- | --- | --- |
| -68 | CJ Ferrer | 69.84 | 48.41 | 1 | 4 | 50 |
| -58 | Pertjude Binagatan | 32.46 | 36.36 | 14 | 2.1 | 47.2 |
| -52 | Deron Llamas | 33.55 | 37.53 | 15 | 1.1 | 28.7 |
| -52 | Jastien Dagcutan | 38.55 | 39.86 | 17 | 2.5 | 43.5 |
| -51 | Kint Aurita | 30.38 | 36.13 | 17 | 1.5 | 35.3 |
| -49 | Jose Jomalesa | 31.29 | 36.45 | 15 | 2.1 | 39.5 |
| -45 | Sofiane Bouzina | 38.78 | 40.59 | 18 | 3.5 | 41.8 |
| -44 | Mark Gutierrez | 32.73 | 37.59 | 13 | 1.3 | 42.2 |
| -43 | Shawn Vergara | 32.77 | 38.12 | 18 | 3.1 | 31.3 |
| -42 | Nazi Babad | 27.66 | 34.07 | 13 | 1.5 | 33.7 |

### Biggest Risers - Claude No Shrinkage

| change | player | current | noShrink | games | ppg | ts |
| --- | --- | --- | --- | --- | --- | --- |
| 63 | Alfonso Villavicencio | 23.33 | 32.35 | 2 | 1 | 17 |
| 44 | Herbert Adajar | 22.49 | 29.93 | 1 | 1 | 26.6 |
| 38 | Cee Jay Castillejo | 33.32 | 39.69 | 1 | 0 | - |
| 37 | Q Molina | 30.28 | 35.94 | 6 | 2.2 | 38.8 |
| 29 | Chazmyr OIaes | 41.45 | 48.55 | 2 | 4 | 40.5 |
| 23 | Sky Jazul | 37.76 | 41.75 | 8 | 2.6 | 42.8 |
| 23 | Daniel Altamirano | 29.87 | 32.64 | 7 | 2.9 | 39.9 |
| 22 | Marvic Mesina | 30.26 | 33.21 | 13 | 2 | 37.6 |
| 22 | Ashley Scott | 41.69 | 46.13 | 2 | 1.5 | 54.3 |
| 21 | Dean Paras | 52.48 | 56.32 | 1 | 3 | 150 |

### Biggest Fallers - Claude No Shrinkage

| change | player | current | noShrink | games | ppg | ts |
| --- | --- | --- | --- | --- | --- | --- |
| -30 | Pertjude Binagatan | 32.46 | 29.33 | 14 | 2.1 | 47.2 |
| -22 | Earl Dahino | 44.39 | 40.56 | 20 | 2.1 | 37 |
| -20 | Dominic Labao | 25.46 | 22.55 | 14 | 2 | 48.5 |
| -20 | Nazi Babad | 27.66 | 24.75 | 13 | 1.5 | 33.7 |
| -18 | Jastien Dagcutan | 38.55 | 36.14 | 17 | 2.5 | 43.5 |
| -18 | Ryoji Ortencio | 35.6 | 32.72 | 4 | 1 | 82 |
| -17 | Jared Ferreros | 51.22 | 48.47 | 2 | 4 | 103.1 |
| -16 | YJ Lacsamana | 41.07 | 38.52 | 8 | 2.1 | 43.5 |
| -16 | Benedict Tauber Jr. | 42.21 | 40.19 | 15 | 2.5 | 55.6 |
| -16 | Rayver Quinday | 32.91 | 31.28 | 1 | 0 | - |

### Low-Game Outliers - Claude No Shrinkage

| player | rank | noShrink | games | ppg | ts |
| --- | --- | --- | --- | --- | --- |
| CJ Ferrer | 42 | 70.59 | 1 | 4 | 50 |
| Jheremy Godoy | 55 | 67.82 | 4 | 8.8 | 46.2 |
| Audwyn Tamayo | 71 | 62.27 | 9 | 8 | 55.2 |
| Dean Paras | 86 | 56.32 | 1 | 3 | 150 |
| Pertiyude Binagatan | 112 | 50.69 | 1 | 3 | 64.7 |
| Tomas Cruz | 114 | 50.38 | 6 | 2.5 | 52.8 |
| Chazmyr OIaes | 127 | 48.55 | 2 | 4 | 40.5 |
| Jared Ferreros | 128 | 48.47 | 2 | 4 | 103.1 |
| Ashley Scott | 131 | 46.13 | 2 | 1.5 | 54.3 |
| Mark Andrada | 136 | 44.76 | 1 | 2 | 50 |

### Star Band Distribution

```json
{
  "current": {
    "1": 223,
    "2": 36,
    "3": 25,
    "4": 15,
    "5": 3
  },
  "claudeShrink": {
    "1": 254,
    "2": 38,
    "3": 10
  },
  "claudeNoShrink": {
    "1": 225,
    "2": 32,
    "3": 28,
    "4": 14,
    "5": 3
  },
  "claudeAdvancedShrink": {
    "1": 257,
    "2": 36,
    "3": 9
  }
}
```

### Star Band Changes - Claude With Shrinkage

| player | currentStar | candidateStar | current | candidate | games |
| --- | --- | --- | --- | --- | --- |
| CJ Ferrer | 2 | 1 | 69.84 | 48.41 | 1 |
| Jude Eriobu | 5 | 3 | 98.33 | 78.43 | 16 |
| Mark Esperanza | 5 | 3 | 90.61 | 70.94 | 12 |
| Josef Calo-oy | 5 | 3 | 93.1 | 73.6 | 14 |
| Steven Creus | 4 | 3 | 88.41 | 70.5 | 14 |
| Maco Dabao | 4 | 3 | 87.15 | 70.88 | 15 |
| Jetlee Melano | 4 | 3 | 86.36 | 70.18 | 14 |
| Andrei Ugaddan | 4 | 2 | 85.47 | 69.41 | 14 |
| Patrick Pasinos | 4 | 2 | 82.31 | 66.74 | 14 |
| Moussa Diakite | 4 | 3 | 87.27 | 71.7 | 17 |
| Sean Franco | 4 | 3 | 88.82 | 73.39 | 19 |
| Jheremy Godoy | 2 | 1 | 67.71 | 52.38 | 4 |
| Bronwyn Tepan | 3 | 2 | 78.56 | 63.41 | 14 |
| Yusuf Mikailu | 4 | 2 | 80.87 | 65.89 | 14 |
| Ray Ladica | 4 | 3 | 88.34 | 73.45 | 19 |

### Star Band Changes - Claude No Shrinkage

| player | currentStar | noShrinkStar | current | noShrink | games |
| --- | --- | --- | --- | --- | --- |
| Bruce Tubongbanua | 2 | 3 | 68.1 | 70.95 | 14 |
| Datu Usop | 2 | 3 | 68.49 | 70.93 | 11 |
| Kirk Cañete | 3 | 2 | 71.96 | 69.85 | 14 |
| Juris San Juan | 3 | 2 | 70.5 | 68.71 | 14 |
| Jhustin Hallare | 2 | 3 | 69.31 | 71.05 | 14 |
| Ray Relojo | 2 | 3 | 68.69 | 70.27 | 14 |
| Joshua Scott | 2 | 1 | 60.8 | 59.52 | 14 |
| Lance Nitura | 3 | 2 | 70.75 | 69.62 | 15 |
| Ezekiel Zamoras | 2 | 1 | 60.17 | 59.15 | 15 |
| Yusuf Mikailu | 4 | 3 | 80.87 | 79.95 | 14 |
| CJ Ferrer | 2 | 3 | 69.84 | 70.59 | 1 |

## Girls U19

Input: 14 games, 331 GameStats, 56 players, 1 scaling pools.

### Top 10 Side by Side

| rank | current | claudeShrink | claudeNoShrink | claudeAdvancedShrink |
| --- | --- | --- | --- | --- |
| 1 | Aubrey Lapasaran (89.8) | Aubrey Lapasaran (73.15) | Aubrey Lapasaran (89.86) | Aubrey Lapasaran (72.93) |
| 2 | Adin Rosano (87.7) | Adin Rosano (71.83) | Adin Rosano (87.72) | Adin Rosano (71.32) |
| 3 | Riri Perez (87.44) | Riri Perez (71.67) | Riri Perez (87.47) | Riri Perez (71.19) |
| 4 | Janice Oczon (78.92) | Lea Pinuela (66.39) | Lea Pinuela (78.88) | Lea Pinuela (66.06) |
| 5 | Pia Petalcorin (78.31) | Janice Oczon (65.82) | Janice Oczon (77.95) | Janice Oczon (65.6) |
| 6 | Lea Pinuela (77.91) | Pia Petalcorin (64.1) | Apyang Dulay (76.91) | Pia Petalcorin (64.38) |
| 7 | Koukou Talla (74.99) | Apyang Dulay (63.05) | Pia Petalcorin (76.74) | Apyang Dulay (62.53) |
| 8 | Apyang Dulay (74.6) | Koukou Talla (61.5) | Ima Navarro (73.51) | Ruiza Olmos (61.71) |
| 9 | Ima Navarro (72.7) | Ruiza Olmos (61.44) | Koukou Talla (70.94) | Koukou Talla (61.51) |
| 10 | Ruiza Olmos (71.84) | Ima Navarro (61.19) | Ruiza Olmos (70.84) | Ima Navarro (60.8) |

### Distribution

```json
{
  "currentFormula": {
    "min": 13.6,
    "p25": 27.8,
    "median": 45.55,
    "p75": 59.76,
    "max": 89.8,
    "mean": 46.81
  },
  "claudeShrink": {
    "min": 29.15,
    "p25": 39.1,
    "median": 45.53,
    "p75": 53.48,
    "max": 73.15,
    "mean": 47.41
  },
  "claudeNoShrink": {
    "min": 13.6,
    "p25": 28.81,
    "median": 44.43,
    "p75": 58.52,
    "max": 89.86,
    "mean": 46.41
  },
  "claudeWithAdvancedShrink": {
    "min": 29.46,
    "p25": 38.68,
    "median": 45.58,
    "p75": 54.21,
    "max": 72.93,
    "mean": 47.44
  }
}
```

### Biggest Risers - Claude With Shrinkage

| change | player | current | candidate | games | ppg | ts |
| --- | --- | --- | --- | --- | --- | --- |
| 17 | Irish Notarte | 13.6 | 40.94 | 1 | 0 | 0 |
| 5 | CJ Luz Roque | 26.9 | 40.07 | 3 | 1.7 | 83.3 |
| 5 | Cheska Gozum | 49.54 | 49.14 | 5 | 7.4 | 50.3 |
| 4 | Fia Martinez | 45.55 | 47.49 | 6 | 7.8 | 33.6 |
| 3 | Kairi Ebao | 34.65 | 41.97 | 6 | 4 | 27.8 |
| 2 | Hazell Winar | 39.45 | 43.32 | 6 | 4 | 28.1 |
| 2 | Fritz Cuaresma | 32.8 | 41.38 | 2 | 1 | 20 |
| 2 | Keisha Ogario | 52.35 | 50.45 | 6 | 4 | 42.4 |
| 2 | Queennie Cordero | 43.97 | 45.53 | 4 | 5.3 | 50.3 |
| 2 | Trishma Arciaga | 39.06 | 42.96 | 4 | 3.5 | 46.7 |

### Biggest Fallers - Claude With Shrinkage

| change | player | current | candidate | games | ppg | ts |
| --- | --- | --- | --- | --- | --- | --- |
| -8 | Rhys Luzana | 29.65 | 35.31 | 7 | 1.4 | 46 |
| -6 | Angelika Agad | 46.75 | 42.95 | 7 | 4.9 | 51 |
| -5 | Ari Hew | 37.55 | 39.56 | 6 | 1.5 | 25.3 |
| -5 | Pau Arciaga | 41.02 | 41.13 | 5 | 3.8 | 56.7 |
| -4 | Nadine Labay | 49.75 | 46.48 | 6 | 6.2 | 51.9 |
| -3 | Louise Doque | 21.63 | 32.75 | 6 | 0.7 | 18.2 |
| -2 | Chloe Mariano | 28.22 | 37.76 | 6 | 1.5 | 43.1 |
| -2 | Tyler Templo | 28.4 | 39.1 | 6 | 11.2 | 32.9 |
| -2 | Alessia Palmiey | 22.17 | 33.75 | 6 | 1.3 | 22.9 |
| -2 | Audrey Biongcog | 53.8 | 48.8 | 5 | 5.8 | 46.3 |

### Biggest Risers - Claude No Shrinkage

| change | player | current | noShrink | games | ppg | ts |
| --- | --- | --- | --- | --- | --- | --- |
| 5 | Cheska Gozum | 49.54 | 51.88 | 5 | 7.4 | 50.3 |
| 4 | CJ Luz Roque | 26.9 | 29.5 | 3 | 1.7 | 83.3 |
| 4 | Fia Martinez | 45.55 | 48.38 | 6 | 7.8 | 33.6 |
| 3 | Keisha Ogario | 52.35 | 53.82 | 6 | 4 | 42.4 |
| 3 | Kairi Ebao | 34.65 | 38.28 | 6 | 4 | 27.8 |
| 2 | Hazell Winar | 39.45 | 40.75 | 6 | 4 | 28.1 |
| 2 | Apyang Dulay | 74.6 | 76.91 | 6 | 10.5 | 44.6 |
| 2 | Zoe Ablang | 26.95 | 29.33 | 6 | 3.8 | 25.2 |
| 2 | Chloe Mariano | 28.22 | 30.56 | 6 | 1.5 | 43.1 |
| 2 | Tyler Templo | 28.4 | 33.01 | 6 | 11.2 | 32.9 |

### Biggest Fallers - Claude No Shrinkage

| change | player | current | noShrink | games | ppg | ts |
| --- | --- | --- | --- | --- | --- | --- |
| -5 | Rhys Luzana | 29.65 | 27.38 | 7 | 1.4 | 46 |
| -5 | Angelika Agad | 46.75 | 40.47 | 7 | 4.9 | 51 |
| -4 | Fritz Cuaresma | 32.8 | 28.81 | 2 | 1 | 20 |
| -4 | Nadine Labay | 49.75 | 46.55 | 6 | 6.2 | 51.9 |
| -3 | Sophie Sanares | 24.29 | 22.06 | 4 | 2.3 | 28.1 |
| -3 | KJ Badajos | 55.07 | 50.61 | 8 | 7.1 | 44 |
| -3 | Pau Arciaga | 41.02 | 35.84 | 5 | 3.8 | 56.7 |
| -2 | Hasly Mallari | 55.52 | 53.57 | 8 | 6.1 | 42.4 |
| -2 | Pia Petalcorin | 78.31 | 76.74 | 7 | 12.9 | 51.8 |
| -2 | Sandra Abrantes | 51.83 | 49.38 | 7 | 6 | 43.4 |

### Low-Game Outliers - Claude No Shrinkage

| player | rank | noShrink | games | ppg | ts |
| --- | --- | --- | --- | --- | --- |
| Queennie Cordero | 29 | 44.43 | 4 | 5.3 | 50.3 |
| Yuyi Capinpin | 30 | 42.31 | 4 | 4.5 | 39.3 |
| Trishma Arciaga | 34 | 38.65 | 4 | 3.5 | 46.7 |
| Laela Mateo | 37 | 35.13 | 4 | 3.8 | 23.1 |
| CJ Luz Roque | 41 | 29.5 | 3 | 1.7 | 83.3 |
| Fritz Cuaresma | 43 | 28.81 | 2 | 1 | 20 |
| Zia Kallos | 44 | 27.5 | 3 | 3.3 | 26.3 |
| Bela Chuidian | 46 | 25.41 | 4 | 0.5 | 20 |
| Sophie Sanares | 49 | 22.06 | 4 | 2.3 | 28.1 |
| Denise Calig-onan | 53 | 18.78 | 4 | 0.5 | 17 |

### Star Band Distribution

```json
{
  "current": {
    "1": 42,
    "2": 3,
    "3": 8,
    "4": 3
  },
  "claudeShrink": {
    "1": 46,
    "2": 7,
    "3": 3
  },
  "claudeNoShrink": {
    "1": 42,
    "2": 3,
    "3": 8,
    "4": 3
  },
  "claudeAdvancedShrink": {
    "1": 46,
    "2": 7,
    "3": 3
  }
}
```

### Star Band Changes - Claude With Shrinkage

| player | currentStar | candidateStar | current | candidate | games |
| --- | --- | --- | --- | --- | --- |
| Aubrey Lapasaran | 4 | 3 | 89.8 | 73.15 | 8 |
| Adin Rosano | 4 | 3 | 87.7 | 71.83 | 8 |
| Riri Perez | 4 | 3 | 87.44 | 71.67 | 8 |
| Pia Petalcorin | 3 | 2 | 78.31 | 64.1 | 7 |
| Koukou Talla | 3 | 2 | 74.99 | 61.5 | 8 |
| Janice Oczon | 3 | 2 | 78.92 | 65.82 | 8 |
| Apyang Dulay | 3 | 2 | 74.6 | 63.05 | 6 |
| Lea Pinuela | 3 | 2 | 77.91 | 66.39 | 8 |
| Ima Navarro | 3 | 2 | 72.7 | 61.19 | 6 |
| Ching Ching Gales | 3 | 1 | 70.7 | 59.36 | 6 |
| Zane Singson | 2 | 1 | 68.99 | 58.45 | 8 |
| Ruiza Olmos | 3 | 2 | 71.84 | 61.44 | 8 |
| Bing Padigos | 2 | 1 | 66.35 | 55.96 | 6 |
| Sabel Anacan | 2 | 1 | 66.85 | 58.13 | 8 |

### Star Band Changes - Claude No Shrinkage

_No rows._

## Initial Recommendation

- The possession-informed raw game value is a stronger direction than the current simpler production score because it prices missed shots, rebounds, turnovers, fouls, and creation using league context.
- Disabling shrinkage fixes most top-score compression, but it reintroduces low-game volatility where minimum-game eligibility is not applied.
- Current public boards may rely on eligibility thresholds to handle low-sample players instead of shrinking all ratings.
- The advanced bonus should remain off until calibrated; it likely double-counts efficiency because missed-shot and missed-FT costs already reward efficient scoring.
- Before production adoption, validate with coaches/scouts on a few known competitions and decide whether percentile scaling should be competition-only or cross-competition with explicit league weights.

## JSON Report

See `scripts/reports/player-rating-formula-comparison.json`.
