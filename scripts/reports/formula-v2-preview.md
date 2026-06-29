# Formula v2 Preview

Generated: 2026-05-31T08:54:26.552Z
Preview date for recency weighting: 2026-05-31T08:54:26.552Z

## Guardrails

- Read-only Formula v2 preview path.
- No `LeagueSeasonAverage`, `GamePerformanceScore`, `PlayerRating`, `RankingSnapshot`, `Game`, or `GameStat` rows were written.
- No production leaderboard output was changed.
- Formula v2 uses `formulaVersionTag = 2` only as a future write target note; this preview does not write rows.

## Formula v2 Candidate

- Possession-informed raw game value.
- Missed FG/FT costs included.
- Rebounds, assists, steals, blocks, turnovers, fouls, and fouls drawn valued from league PPP/context where available.
- No plus-minus in the main formula.
- Percentile-scaled game performance within gender + age group + season/competition pool.
- Recency-weighted player average: last 2 weeks = 1.00, last month = 0.80, older = 0.60.
- No Bayesian shrinkage.
- Advanced Bonus disabled.
- League weight, opponent factor, and team context are neutral at 1.00.

## Input Summary

```json
{
  "totalOfficialActiveGames": 253,
  "totalOfficialActiveGameStats": 6340,
  "totalPlayersWithStats": 601,
  "leagueSeasonPools": 5
}
```

## League/Season Averages Computed In Memory

| board | competition | season | games | gameStats | possessions | ppp | drbPct | orbPct | ftCostPerFoul |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| U16 Boys | PYBC 15U | Full Competition | 36 | 930 | 6598.5 | 0.808 | 62.1 | 37.9 | 0.499 |
| U16 Boys | UAAP Season 88 16U Boys Basketball | Season 88 | 60 | 1464 | 10425.9 | 0.884 | 66.7 | 33.3 | 0.622 |
| U19 Boys | NCAA Season 101 Junior's Basketball | Season 101 | 81 | 2061 | 13790.9 | 0.892 | 67.1 | 32.9 | 0.637 |
| U19 Boys | UAAP Season 88 HS Boys Basketball | Season 88 | 62 | 1554 | 10054.7 | 0.933 | 68.9 | 31.1 | 0.647 |
| U19 Girls | UAAP Season 88 HS Girls Basketball | Season 88 | 14 | 331 | 2602.9 | 0.823 | 57.3 | 42.7 | 0.533 |

## U16 Boys

Input: 96 games, 2394 GameStats, 253 players, 2 scaling pools, 115 players meeting current eligibility minimum.

### Top 10 Side by Side

| rank | formulaV2 | currentProduction |
| --- | --- | --- |
| 1 | Goodluck Okebata (95.5) | Goodluck Okebata (96.58) |
| 2 | Rye Teodor Villaruz (94.5) | Rye Teodor Villaruz (93.28) |
| 3 | Jesse Arellano (93.26) | Jesse Arellano (93.11) |
| 4 | Prince Cariño (92.35) | Akhiro Franz Reynon (92.94) |
| 5 | Moussa Diakite (90.74) | Prince Cariño (92.5) |
| 6 | Akhiro Franz Reynon (90.43) | Tristan Teoc (91.85) |
| 7 | Thadeus Angeles (89.04) | Jim Andrie Braza (90.59) |
| 8 | Fran Flores (88.65) | Moussa Diakite (89.91) |
| 9 | Riley Yuan Dela Cruz (88.09) | Lawrence Tombocon (89.26) |
| 10 | Kurt Devron Benitez (87.59) | Fran Flores (88.11) |

### Formula v2 Top 10

| rank | player | rating | current | games | stars | ppg | rpg | apg |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Goodluck Okebata | 95.5 | 96.58 | 14 | 5 | 19.7 | 13.4 | 2.5 |
| 2 | Rye Teodor Villaruz | 94.5 | 93.28 | 8 | 5 | 23.3 | 10.1 | 1.1 |
| 3 | Jesse Arellano | 93.26 | 93.11 | 9 | 5 | 14.8 | 16.1 | 2 |
| 4 | Prince Cariño | 92.35 | 92.5 | 17 | 5 | 19.2 | 13.7 | 1.5 |
| 5 | Moussa Diakite | 90.74 | 89.91 | 16 | 5 | 16.9 | 12.6 | 1.4 |
| 6 | Akhiro Franz Reynon | 90.43 | 92.94 | 11 | 5 | 17.6 | 14.4 | 1.5 |
| 7 | Thadeus Angeles | 89.04 | 87.02 | 6 | 4 | 16 | 3.5 | 2 |
| 8 | Fran Flores | 88.65 | 88.11 | 14 | 4 | 18.4 | 4.4 | 4.8 |
| 9 | Riley Yuan Dela Cruz | 88.09 | 85.73 | 8 | 4 | 16 | 5.9 | 2.8 |
| 10 | Kurt Devron Benitez | 87.59 | 85.3 | 7 | 4 | 14.4 | 7.7 | 1.9 |

### Star Distribution

```json
{
  "formulaV2": {
    "1": 181,
    "2": 25,
    "3": 28,
    "4": 13,
    "5": 6
  },
  "currentProduction": {
    "1": 180,
    "2": 23,
    "3": 26,
    "4": 17,
    "5": 7
  }
}
```

### Rating Distribution

```json
{
  "min": 6.62,
  "p25": 31.33,
  "median": 45.63,
  "p75": 63.12,
  "max": 95.5,
  "mean": 48.12
}
```

### Biggest Risers

| delta | player | v2Rank | currentRank | v2 | current | games |
| --- | --- | --- | --- | --- | --- | --- |
| 96 | Emmanuel Ynigo Lencioco | 146 | 242 | 40.16 | 18.66 | 4 |
| 69 | Dwayne Cads | 179 | 248 | 33.22 | 14.83 | 6 |
| 60 | Zo Ang | 158 | 218 | 38.16 | 25.41 | 7 |
| 58 | Jaleel Balagapo | 92 | 150 | 54.67 | 40.68 | 8 |
| 52 | Justine Dwyne Abanes | 61 | 113 | 63.98 | 50.09 | 6 |
| 41 | Acee Abar | 41 | 82 | 71.3 | 57.86 | 8 |
| 41 | Clarenz Joseph Miguel Eslao | 131 | 172 | 44.33 | 35.14 | 7 |
| 38 | Yul Gerard Nicolas | 126 | 164 | 45.67 | 37.21 | 10 |
| 38 | Raiven Venkatesh | 149 | 187 | 39.86 | 31.59 | 8 |
| 38 | Prince Labong | 195 | 233 | 30.52 | 21.84 | 9 |

### Biggest Fallers

| delta | player | v2Rank | currentRank | v2 | current | games |
| --- | --- | --- | --- | --- | --- | --- |
| -114 | Kian Pachoco | 237 | 123 | 22.7 | 46.21 | 5 |
| -99 | Mustapha Hasim | 165 | 66 | 37.19 | 62.44 | 7 |
| -73 | Kobe James Buban | 118 | 45 | 47.89 | 72.3 | 3 |
| -61 | Swey Cruz | 162 | 101 | 37.91 | 51.92 | 5 |
| -60 | Andrei Francisco | 128 | 68 | 45.08 | 62.11 | 3 |
| -44 | Aaron Gidoc | 187 | 143 | 32.14 | 41.72 | 9 |
| -42 | Gab Lacandazo | 97 | 55 | 53.61 | 67.13 | 6 |
| -40 | Yohan Mendoza | 114 | 74 | 48.32 | 59.52 | 5 |
| -38 | AJ Arma | 164 | 126 | 37.65 | 45.65 | 5 |
| -38 | Zani Acera | 166 | 128 | 37.19 | 45.47 | 8 |

### Low-Game Outliers

| rank | player | rating | games | minimum | ppg |
| --- | --- | --- | --- | --- | --- |
| 2 | Rye Teodor Villaruz | 94.5 | 8 | 10 | 23.3 |
| 3 | Jesse Arellano | 93.26 | 9 | 10 | 14.8 |
| 7 | Thadeus Angeles | 89.04 | 6 | 10 | 16 |
| 9 | Riley Yuan Dela Cruz | 88.09 | 8 | 10 | 16 |
| 10 | Kurt Devron Benitez | 87.59 | 7 | 10 | 14.4 |
| 11 | Allain Escober | 85.58 | 7 | 10 | 17 |
| 13 | Derict Reyes | 83.3 | 6 | 10 | 12.3 |
| 15 | Lawrence Tombocon | 81.44 | 7 | 10 | 12.9 |
| 17 | Xerone Dizon | 80.74 | 8 | 10 | 12.6 |
| 20 | Royette Villareal | 79.73 | 5 | 10 | 12.2 |

## U19 Boys

Input: 143 games, 3615 GameStats, 302 players, 2 scaling pools, 214 players meeting current eligibility minimum.

### Top 10 Side by Side

| rank | formulaV2 | currentProduction |
| --- | --- | --- |
| 1 | Jude Eriobu (98.5) | Jude Eriobu (98.33) |
| 2 | Josef Calo-oy (93.17) | Josef Calo-oy (93.1) |
| 3 | Mark Esperanza (91.55) | Mark Esperanza (90.61) |
| 4 | Cabs Cabonilas (87.98) | Sean Franco (88.82) |
| 5 | Steven Creus (87.87) | Steven Creus (88.41) |
| 6 | Ray Ladica (87.8) | Ray Ladica (88.34) |
| 7 | Sean Franco (87.7) | Cabs Cabonilas (88.19) |
| 8 | Moussa Diakite (87.57) | Moussa Diakite (87.27) |
| 9 | Maco Dabao (87.45) | Maco Dabao (87.15) |
| 10 | Jetlee Melano (86.89) | Jetlee Melano (86.36) |

### Formula v2 Top 10

| rank | player | rating | current | games | stars | ppg | rpg | apg |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Jude Eriobu | 98.5 | 98.33 | 16 | 5 | 23.4 | 17.3 | 0.4 |
| 2 | Josef Calo-oy | 93.17 | 93.1 | 14 | 5 | 20.9 | 4.6 | 1.4 |
| 3 | Mark Esperanza | 91.55 | 90.61 | 12 | 5 | 20.3 | 5.2 | 4.6 |
| 4 | Cabs Cabonilas | 87.98 | 88.19 | 19 | 4 | 17.3 | 9.5 | 3.6 |
| 5 | Steven Creus | 87.87 | 88.41 | 14 | 4 | 14.9 | 8.4 | 1.1 |
| 6 | Ray Ladica | 87.8 | 88.34 | 19 | 4 | 18.3 | 5.7 | 1.6 |
| 7 | Sean Franco | 87.7 | 88.82 | 19 | 4 | 16.8 | 10 | 2.7 |
| 8 | Moussa Diakite | 87.57 | 87.27 | 17 | 4 | 10.4 | 13 | 0.7 |
| 9 | Maco Dabao | 87.45 | 87.15 | 15 | 4 | 17.7 | 5.8 | 2.4 |
| 10 | Jetlee Melano | 86.89 | 86.36 | 14 | 4 | 14.9 | 5.9 | 1 |

### Star Distribution

```json
{
  "formulaV2": {
    "1": 224,
    "2": 32,
    "3": 29,
    "4": 14,
    "5": 3
  },
  "currentProduction": {
    "1": 223,
    "2": 36,
    "3": 25,
    "4": 15,
    "5": 3
  }
}
```

### Rating Distribution

```json
{
  "min": 6.73,
  "p25": 30.3,
  "median": 42.25,
  "p75": 60.87,
  "max": 98.5,
  "mean": 46.24
}
```

### Biggest Risers

| delta | player | v2Rank | currentRank | v2 | current | games |
| --- | --- | --- | --- | --- | --- | --- |
| 61 | Alfonso Villavicencio | 214 | 275 | 32.35 | 23.33 | 2 |
| 45 | Herbert Adajar | 232 | 277 | 29.93 | 22.49 | 1 |
| 38 | Cee Jay Castillejo | 166 | 204 | 39.69 | 33.32 | 1 |
| 30 | Chazmyr OIaes | 126 | 156 | 48.55 | 41.45 | 2 |
| 23 | Q Molina | 206 | 229 | 33.23 | 30.28 | 6 |
| 23 | Marvic Mesina | 207 | 230 | 33.21 | 30.26 | 13 |
| 22 | Daniel Altamirano | 212 | 234 | 32.64 | 29.87 | 7 |
| 21 | Dean Paras | 86 | 107 | 56.32 | 52.48 | 1 |
| 21 | Ashley Scott | 132 | 153 | 46.13 | 41.69 | 2 |
| 16 | Kevin Frogoso | 87 | 103 | 56.12 | 53.81 | 14 |

### Biggest Fallers

| delta | player | v2Rank | currentRank | v2 | current | games |
| --- | --- | --- | --- | --- | --- | --- |
| -29 | Pertjude Binagatan | 240 | 211 | 29.33 | 32.46 | 14 |
| -22 | Liam Acido | 242 | 220 | 29.19 | 30.99 | 5 |
| -20 | Deron Llamas | 222 | 202 | 31.11 | 33.55 | 15 |
| -20 | Nazi Babad | 267 | 247 | 24.54 | 27.66 | 13 |
| -19 | Ryoji Ortencio | 211 | 192 | 32.72 | 35.6 | 4 |
| -18 | Carsson Vidanes | 241 | 223 | 29.2 | 30.63 | 13 |
| -17 | Earl Dahino | 157 | 140 | 40.56 | 44.39 | 20 |
| -17 | Dominic Labao | 277 | 260 | 23.33 | 25.46 | 14 |
| -16 | YJ Lacsamana | 175 | 159 | 38.52 | 41.07 | 8 |
| -16 | Evo Castillo | 249 | 233 | 28.01 | 30.03 | 1 |

### Low-Game Outliers

| rank | player | rating | games | minimum | ppg |
| --- | --- | --- | --- | --- | --- |
| 43 | CJ Ferrer | 70.59 | 1 | 10 | 4 |
| 55 | Jheremy Godoy | 67.82 | 4 | 10 | 8.8 |
| 71 | Audwyn Tamayo | 62.63 | 9 | 10 | 8 |
| 86 | Dean Paras | 56.32 | 1 | 10 | 3 |
| 108 | Jared Ferreros | 51.95 | 2 | 10 | 4 |
| 114 | Tomas Cruz | 50.77 | 6 | 10 | 2.5 |
| 116 | Pertiyude Binagatan | 50.69 | 1 | 10 | 3 |
| 126 | Chazmyr OIaes | 48.55 | 2 | 10 | 4 |
| 131 | Chester Tulabut | 46.67 | 8 | 10 | 2.5 |
| 132 | Ashley Scott | 46.13 | 2 | 10 | 1.5 |

## U19 Girls

Input: 14 games, 331 GameStats, 56 players, 1 scaling pools, 45 players meeting current eligibility minimum.

### Top 10 Side by Side

| rank | formulaV2 | currentProduction |
| --- | --- | --- |
| 1 | Aubrey Lapasaran (90.18) | Aubrey Lapasaran (89.8) |
| 2 | Riri Perez (88.19) | Adin Rosano (87.7) |
| 3 | Adin Rosano (87.4) | Riri Perez (87.44) |
| 4 | Janice Oczon (78.74) | Janice Oczon (78.93) |
| 5 | Pia Petalcorin (77.67) | Pia Petalcorin (78.31) |
| 6 | Lea Pinuela (77.61) | Lea Pinuela (77.91) |
| 7 | Apyang Dulay (75.35) | Koukou Talla (74.99) |
| 8 | Koukou Talla (75.29) | Apyang Dulay (74.6) |
| 9 | Ima Navarro (73.95) | Ima Navarro (72.7) |
| 10 | Ruiza Olmos (71.65) | Ruiza Olmos (71.84) |

### Formula v2 Top 10

| rank | player | rating | current | games | stars | ppg | rpg | apg |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Aubrey Lapasaran | 90.18 | 89.8 | 8 | 5 | 18.1 | 5.6 | 3.4 |
| 2 | Riri Perez | 88.19 | 87.44 | 8 | 4 | 15.3 | 10.8 | 5.8 |
| 3 | Adin Rosano | 87.4 | 87.7 | 8 | 4 | 14.8 | 9.5 | 5.8 |
| 4 | Janice Oczon | 78.74 | 78.93 | 8 | 3 | 12.8 | 9.3 | 2.6 |
| 5 | Pia Petalcorin | 77.67 | 78.31 | 7 | 3 | 12.9 | 4.4 | 1.9 |
| 6 | Lea Pinuela | 77.61 | 77.91 | 8 | 3 | 13 | 3.6 | 4.5 |
| 7 | Apyang Dulay | 75.35 | 74.6 | 6 | 3 | 10.5 | 6.7 | 1.7 |
| 8 | Koukou Talla | 75.29 | 74.99 | 8 | 3 | 11.4 | 9.3 | 1.4 |
| 9 | Ima Navarro | 73.95 | 72.7 | 6 | 3 | 13.8 | 8.2 | 1.5 |
| 10 | Ruiza Olmos | 71.65 | 71.84 | 8 | 3 | 8 | 7.4 | 1.3 |

### Star Distribution

```json
{
  "formulaV2": {
    "1": 42,
    "2": 4,
    "3": 7,
    "4": 2,
    "5": 1
  },
  "currentProduction": {
    "1": 42,
    "2": 3,
    "3": 8,
    "4": 3
  }
}
```

### Rating Distribution

```json
{
  "min": 13.6,
  "p25": 28.47,
  "median": 45.87,
  "p75": 59.39,
  "max": 90.18,
  "mean": 46.78
}
```

### Biggest Risers

| delta | player | v2Rank | currentRank | v2 | current | games |
| --- | --- | --- | --- | --- | --- | --- |
| 2 | Sophia Townes | 25 | 27 | 49.42 | 49 | 5 |
| 2 | Tyler Templo | 39 | 41 | 33.1 | 28.4 | 6 |
| 2 | Zoe Ablang | 42 | 44 | 28.65 | 26.95 | 6 |
| 1 | Riri Perez | 2 | 3 | 88.19 | 87.44 | 8 |
| 1 | Apyang Dulay | 7 | 8 | 75.35 | 74.6 | 6 |
| 1 | Nadine Labay | 23 | 24 | 50.5 | 49.75 | 6 |
| 1 | Fia Martinez | 28 | 29 | 46.75 | 45.55 | 6 |
| 1 | Hazell Winar | 33 | 34 | 40.15 | 39.45 | 6 |
| 1 | Kairi Ebao | 37 | 38 | 35.65 | 34.65 | 6 |
| 1 | CJ Luz Roque | 44 | 45 | 27.5 | 26.9 | 3 |

### Biggest Fallers

| delta | player | v2Rank | currentRank | v2 | current | games |
| --- | --- | --- | --- | --- | --- | --- |
| -2 | Zia Kallos | 45 | 43 | 27.5 | 27.8 | 3 |
| -2 | Sophie Sanares | 48 | 46 | 22.86 | 24.29 | 4 |
| -1 | Adin Rosano | 3 | 2 | 87.4 | 87.7 | 8 |
| -1 | Koukou Talla | 8 | 7 | 75.29 | 74.99 | 8 |
| -1 | Ice Gerona | 24 | 23 | 49.66 | 50.08 | 5 |
| -1 | Cheska Gozum | 26 | 25 | 49 | 49.54 | 5 |
| -1 | Zia Onate | 27 | 26 | 48.79 | 49.21 | 7 |
| -1 | Angelika Agad | 29 | 28 | 45.87 | 46.75 | 7 |
| -1 | Pau Arciaga | 34 | 33 | 39.88 | 41.02 | 5 |
| -1 | Laela Mateo | 38 | 37 | 34.83 | 35.43 | 4 |

### Low-Game Outliers

| rank | player | rating | games | minimum | ppg |
| --- | --- | --- | --- | --- | --- |
| 30 | Yuyi Capinpin | 44.35 | 4 | 5 | 4.5 |
| 31 | Queennie Cordero | 43.3 | 4 | 5 | 5.3 |
| 35 | Trishma Arciaga | 38.31 | 4 | 5 | 3.5 |
| 38 | Laela Mateo | 34.83 | 4 | 5 | 3.8 |
| 40 | Fritz Cuaresma | 29.95 | 2 | 5 | 1 |
| 44 | CJ Luz Roque | 27.5 | 3 | 5 | 1.7 |
| 45 | Zia Kallos | 27.5 | 3 | 5 | 3.3 |
| 46 | Bela Chuidian | 24.89 | 4 | 5 | 0.5 |
| 48 | Sophie Sanares | 22.86 | 4 | 5 | 2.3 |
| 53 | Denise Calig-onan | 18.1 | 4 | 5 | 0.5 |

## Warnings / Risks

- None.

## Snapshot Confirmation

- No ranking snapshots were generated.
