# Formula v3 Contextual Player Rating Preview

Generated: 2026-08-05T10:42:23.606Z

Read-only shadow evaluation. No PlayerRating, GamePerformanceScore, FormulaVersion, RankingSnapshot, Game, or GameStat rows were written.

## Design

- Box-score value prices scoring, missed shots/free throws, rebounds, assists, steals, blocks, turnovers, fouls, and fouls drawn using competition possession context.
- Honest advanced metrics provide a capped secondary adjustment from TS%, eFG%, AST/TO, and defensive activity. Missing inputs are omitted and reweighted, not treated as zero.
- Opponent and teammate individual strength use reliability-adjusted ratings from games completed before the current game date.
- Team strength is the average of prior participant ratings for that Team and Season.
- Team baseline and game-lineup deviation are separated to avoid double-counting the same players.
- Context can move a game score by at most 4.5 points. Displayed ratings use recency weighting and no Bayesian shrinkage.
- Plus-minus, official-style ORTG/DRTG, BPM, PER, and Win Shares are excluded because current youth box scores do not consistently provide possession-level lineup inputs needed to estimate them honestly.

## Inventory

```json
{
  "officialStatRows": 10198,
  "officialGames": 463,
  "players": 1395,
  "pools": 12,
  "candidateRatings": 1412,
  "currentProductionRatings": 1500,
  "playersOnMultipleCandidateBoards": 17
}
```

## Input Coverage (%)

```json
{
  "minutes": 100,
  "fieldGoalAttempts": 100,
  "threePointAttempts": 100,
  "freeThrowAttempts": 100,
  "turnovers": 100,
  "steals": 100,
  "blocks": 100,
  "fouls": 100,
  "foulsDrawn": 100
}
```

## Temporal next-game diagnostic

This is an initial stability check, not a promotion-grade causal validation. It tests whether a contextualized game score predicts the player's next independent game score at least as well as the unadjusted score.

```json
{
  "samples": 8749,
  "independentMae": 25.208,
  "contextualMae": 25.194,
  "improvement": 0.014,
  "passesInitialGate": true
}
```

## Context Guardrails

```json
{
  "minimum": -1.195,
  "maximum": 1.385,
  "average": 0.042,
  "absoluteAverage": 0.211,
  "nonNeutralPercent": 91.1,
  "cappedAt": 4.5,
  "sameGameLeakagePrevented": true,
  "sameDayLeakagePrevented": true
}
```

## U13 Boys

Candidate ratings: 128; eligible at current 10-game threshold: 21; eligible production rows: 21; eligible overlap: 21; rank correlation: 1.

### Eligible Top 10 Side by Side

| rank | production | productionRating | v3 | v3Rating | v3Games |
| --- | --- | --- | --- | --- | --- |
| 1 | Xander Dulfo | 81.98 | Xander Dulfo | 89.8 | 12 |
| 2 | Syrus Demate | 80.71 | Syrus Demate | 89.58 | 12 |
| 3 | Patrick Tumbaga | 80.25 | Patrick Tumbaga | 87.97 | 12 |
| 4 | Kirov Acedo | 77.58 | Kirov Acedo | 84.78 | 10 |
| 5 | Ethan Suangco | 75.06 | Ethan Suangco | 83.77 | 12 |
| 6 | Reign Driz | 70.83 | Reign Driz | 77.72 | 11 |
| 7 | Zach Agustin | 67.42 | Zach Agustin | 73.54 | 11 |
| 8 | Gian Castro | 67.1 | Gian Castro | 73.52 | 10 |
| 9 | Jordan Dela Rosa | 55.92 | Jordan Dela Rosa | 60.93 | 12 |
| 10 | Kian Antonio | 54.61 | Kian Antonio | 59.59 | 11 |

### Biggest Risers

| change | player | production | v3 | games |
| --- | --- | --- | --- | --- |
| 0 | Xander Dulfo | 81.98 | 89.8 | 12 |
| 0 | Syrus Demate | 80.71 | 89.58 | 12 |
| 0 | Patrick Tumbaga | 80.25 | 87.97 | 12 |
| 0 | Kirov Acedo | 77.58 | 84.78 | 10 |
| 0 | Ethan Suangco | 75.06 | 83.77 | 12 |
| 0 | Reign Driz | 70.83 | 77.72 | 11 |
| 0 | Zach Agustin | 67.42 | 73.54 | 11 |
| 0 | Gian Castro | 67.1 | 73.52 | 10 |
| 0 | Jordan Dela Rosa | 55.92 | 60.93 | 12 |
| 0 | Kian Antonio | 54.61 | 59.59 | 11 |

### Biggest Fallers

| change | player | production | v3 | games |
| --- | --- | --- | --- | --- |
| 0 | Xander Dulfo | 81.98 | 89.8 | 12 |
| 0 | Syrus Demate | 80.71 | 89.58 | 12 |
| 0 | Patrick Tumbaga | 80.25 | 87.97 | 12 |
| 0 | Kirov Acedo | 77.58 | 84.78 | 10 |
| 0 | Ethan Suangco | 75.06 | 83.77 | 12 |
| 0 | Reign Driz | 70.83 | 77.72 | 11 |
| 0 | Zach Agustin | 67.42 | 73.54 | 11 |
| 0 | Gian Castro | 67.1 | 73.52 | 10 |
| 0 | Jordan Dela Rosa | 55.92 | 60.93 | 12 |
| 0 | Kian Antonio | 54.61 | 59.59 | 11 |

### Low-sample leaders (not public-eligible)

| rank | player | rating | games | confidence |
| --- | --- | --- | --- | --- |
| 1 | Liam Santo | 97.5 | 4 | DEVELOPING |
| 2 | Andre Kitong | 97.49 | 6 | DEVELOPING |
| 3 | Aiden Kitong | 97.09 | 2 | PROVISIONAL |
| 4 | Cristhop Calvero | 95.92 | 5 | DEVELOPING |
| 5 | Liam Santos | 88.65 | 2 | PROVISIONAL |
| 6 | Philip Jr. Punzalan | 85.82 | 6 | DEVELOPING |
| 7 | Coi Aver Moncal | 83.89 | 8 | DEVELOPING |
| 8 | Oscar Bagion | 81.91 | 8 | DEVELOPING |
| 9 | Xian Latay | 81.3 | 7 | DEVELOPING |
| 10 | Matthew Paraiso | 80.46 | 8 | DEVELOPING |

## U16 Boys

Candidate ratings: 253; eligible at current 10-game threshold: 114; eligible production rows: 121; eligible overlap: 114; rank correlation: 0.988.

### Eligible Top 10 Side by Side

| rank | production | productionRating | v3 | v3Rating | v3Games |
| --- | --- | --- | --- | --- | --- |
| 1 | Goodluck Okebata | 96.58 | Goodluck Okebata | 96.75 | 14 |
| 2 | Prince Cariño | 92.5 | Moussa Diakite | 91.29 | 33 |
| 3 | Moussa Diakite | 89.91 | Akhiro Franz Reynon | 83.93 | 15 |
| 4 | Francel Flores | 88.11 | Francel Flores | 82.59 | 28 |
| 5 | Xyriel Macahipay | 84.13 | JD Juangco | 82 | 11 |
| 6 | Akhiro Franz Reynon | 83.78 | Mark Perdigon | 81.5 | 14 |
| 7 | Denden Enriquez | 83.14 | CJ Tabbuga | 80.91 | 15 |
| 8 | Keefe Iledan | 82.19 | Gab Castro | 79.36 | 15 |
| 9 | Sky Jazul | 81.13 | Rowie Cabañero | 78.72 | 17 |
| 10 | CJ Tabbuga | 80.41 | Keefe Iledan | 78.45 | 25 |

### Biggest Risers

| change | player | production | v3 | games |
| --- | --- | --- | --- | --- |
| 16 | Kaeden Pio Rapista | 51.68 | 56.98 | 10 |
| 16 | Marvic Mesina | 30.26 | 37.44 | 13 |
| 13 | Michael Tan Estrevillo | 63.62 | 71.42 | 11 |
| 13 | Rain Gabryle Cajilig | 44.93 | 50.46 | 11 |
| 12 | Bangelo Abo-Abo | 46.39 | 53.14 | 12 |
| 12 | Yul Gerard Nicolas | 41.51 | 46.51 | 10 |
| 12 | Louise Sinda | 29.07 | 31.3 | 10 |
| 11 | Martin Morales | 45.47 | 49.57 | 11 |
| 10 | Khryz Alexandr Samson | 64.97 | 71.51 | 11 |
| 10 | Leon Sequerra | 37.15 | 39.42 | 12 |

### Biggest Fallers

| change | player | production | v3 | games |
| --- | --- | --- | --- | --- |
| -20 | Prince Cariño | 92.5 | 71.31 | 35 |
| -20 | Denden Enriquez | 83.14 | 68.77 | 35 |
| -20 | Sky Jazul | 81.13 | 65.3 | 18 |
| -6 | Austin Delos Santos | 54.57 | 52.97 | 14 |
| -4 | Kean Poquiz | 58.41 | 56.32 | 28 |
| -2 | Keefe Iledan | 82.19 | 78.45 | 25 |
| -2 | Karl Yeshua Vengco | 63.9 | 63.26 | 15 |
| -2 | Alison Jordan | 46.53 | 45.85 | 14 |
| -2 | Zandro Lugatiman | 40.85 | 38.22 | 14 |
| -1 | Stef Bernarte | 69.15 | 68.85 | 13 |

### Low-sample leaders (not public-eligible)

| rank | player | rating | games | confidence |
| --- | --- | --- | --- | --- |
| 1 | Rye Teodor Villaruz | 94.87 | 8 | DEVELOPING |
| 2 | Jesse Arellano | 94.6 | 9 | DEVELOPING |
| 3 | Thadeus Angeles | 91.78 | 6 | DEVELOPING |
| 4 | Kurt Devron Benitez | 90.13 | 7 | DEVELOPING |
| 5 | Riley Yuan Dela Cruz | 89.54 | 8 | DEVELOPING |
| 6 | Allain Escober | 86.92 | 7 | DEVELOPING |
| 7 | Derict Reyes | 84.48 | 6 | DEVELOPING |
| 8 | Lawrence Tombocon | 84.03 | 7 | DEVELOPING |
| 9 | Xerone Dizon | 81.54 | 8 | DEVELOPING |
| 10 | Royette Villareal | 81.28 | 5 | DEVELOPING |

## U19 Boys

Candidate ratings: 975; eligible at current 10-game threshold: 250; eligible production rows: 312; eligible overlap: 247; rank correlation: 0.993.

### Eligible Top 10 Side by Side

| rank | production | productionRating | v3 | v3Rating | v3Games |
| --- | --- | --- | --- | --- | --- |
| 1 | Jude Eriobu | 98.33 | Jude Eriobu | 99 | 16 |
| 2 | Josef Calo-oy | 91.82 | Mark Esperanza | 95.59 | 12 |
| 3 | Mark Esperanza | 90.61 | Yuan Ramirez | 95.54 | 22 |
| 4 | Sean Franco | 88.82 | Lucas Kaw | 95.53 | 22 |
| 5 | Steven Creus | 88.41 | Josef Calo-oy | 95.39 | 22 |
| 6 | John Ray Ladica | 88.34 | Steven Creus | 92.72 | 14 |
| 7 | Cabs Cabonilas | 88.19 | Allen Te | 91.74 | 17 |
| 8 | Lucas Kaw | 87.4 | Xyriel Macahipay | 90.9 | 16 |
| 9 | Moussa Diakite | 87.27 | Jetlee Melano | 90.25 | 14 |
| 10 | Maco Dabao | 87.15 | Joaquin Escudero | 89.65 | 18 |

### Biggest Risers

| change | player | production | v3 | games |
| --- | --- | --- | --- | --- |
| 76 | Romnick Araneta | 30.29 | 36.5 | 10 |
| 76 | Kobe Urbina | 28.91 | 33.96 | 13 |
| 73 | Johari Domingo | 46.17 | 55.15 | 17 |
| 73 | Ethan Carniyan | 29.82 | 35.35 | 13 |
| 72 | John Dela Cruz | 42.75 | 49.15 | 17 |
| 72 | Dustin Bathan | 42.04 | 48.72 | 14 |
| 72 | Isiah Chua | 30.05 | 35.59 | 20 |
| 72 | Daniel Cobico | 22.1 | 25.06 | 10 |
| 71 | Raphael Bautista | 35.52 | 42.74 | 11 |
| 71 | Yan Tagorda | 34.17 | 41.1 | 19 |

### Biggest Fallers

| change | player | production | v3 | games |
| --- | --- | --- | --- | --- |
| -3 | Josef Calo-oy | 91.82 | 95.39 | 22 |
| -1 | Steven Creus | 88.41 | 92.72 | 14 |
| -1 | Joe Bayobay | 84.03 | 86.29 | 11 |
| 0 | Jude Eriobu | 98.33 | 99 | 16 |
| 0 | Prince Cayl Lumbre | 80.97 | 82.65 | 10 |
| 1 | Mark Esperanza | 90.61 | 95.59 | 12 |
| 3 | Jetlee Melano | 86.36 | 90.25 | 14 |
| 4 | Lucas Kaw | 87.4 | 95.53 | 22 |
| 4 | Patrick Pasinos | 83.87 | 88.28 | 19 |
| 6 | Xyriel Macahipay | 84.9 | 90.9 | 16 |

### Low-sample leaders (not public-eligible)

| rank | player | rating | games | confidence |
| --- | --- | --- | --- | --- |
| 1 | Dwayne Canete | 100 | 1 | PROVISIONAL |
| 2 | Prince Torres | 100 | 1 | PROVISIONAL |
| 3 | Jd Turko | 97.46 | 1 | PROVISIONAL |
| 4 | Julian Villano | 97.21 | 3 | DEVELOPING |
| 5 | Greggy Calma | 96.93 | 5 | DEVELOPING |
| 6 | Querubin Fulgencio | 95.95 | 1 | PROVISIONAL |
| 7 | Reimune Andrei Aldep | 95.09 | 5 | DEVELOPING |
| 8 | Jaime Jacob Iii Hizon | 94.88 | 8 | DEVELOPING |
| 9 | Dairick Emmanuel Duterte | 93.73 | 2 | PROVISIONAL |
| 10 | Joren Garcia | 93.34 | 1 | PROVISIONAL |

## U19 Girls

Candidate ratings: 56; eligible at current 5-game threshold: 45; eligible production rows: 45; eligible overlap: 45; rank correlation: 0.998.

### Eligible Top 10 Side by Side

| rank | production | productionRating | v3 | v3Rating | v3Games |
| --- | --- | --- | --- | --- | --- |
| 1 | Aubrey Lapasaran | 89.8 | Aubrey Lapasaran | 91.91 | 8 |
| 2 | Adin Rosano | 87.7 | Adin Rosano | 89.3 | 8 |
| 3 | Riri Perez | 87.44 | Riri Perez | 89.05 | 8 |
| 4 | Janice Oczon | 78.92 | Janice Oczon | 79.69 | 8 |
| 5 | Pia Petalcorin | 78.31 | Lea Pinuela | 79.55 | 8 |
| 6 | Lea Pinuela | 77.91 | Pia Petalcorin | 79.36 | 7 |
| 7 | Koukou Talla | 74.99 | Koukou Talla | 75.82 | 8 |
| 8 | Apyang Dulay | 74.6 | Apyang Dulay | 75.82 | 6 |
| 9 | Ima Navarro | 72.7 | Ima Navarro | 73.62 | 6 |
| 10 | Ruiza Olmos | 71.84 | Ruiza Olmos | 72.62 | 8 |

### Biggest Risers

| change | player | production | v3 | games |
| --- | --- | --- | --- | --- |
| 2 | Nadine Labay | 49.75 | 51.22 | 6 |
| 1 | Lea Pinuela | 77.91 | 79.55 | 8 |
| 1 | Zane Singson | 68.99 | 70.06 | 8 |
| 1 | Bri Katigbak | 55.49 | 56.59 | 8 |
| 1 | Zia Onate | 49.21 | 49.63 | 7 |
| 1 | Kairi Ebao | 34.65 | 34.86 | 6 |
| 1 | Tyler Templo | 28.4 | 31.88 | 6 |
| 1 | Zoe Ablang | 26.95 | 28.31 | 6 |
| 1 | Louise Doque | 21.63 | 20.94 | 6 |
| 1 | Matia Molina | 17 | 17.6 | 6 |

### Biggest Fallers

| change | player | production | v3 | games |
| --- | --- | --- | --- | --- |
| -1 | Pia Petalcorin | 78.31 | 79.36 | 7 |
| -1 | Ching Ching Gales | 70.7 | 69.93 | 6 |
| -1 | Hasly Mallari | 55.52 | 55.62 | 8 |
| -1 | Sandra Abrantes | 51.83 | 51.03 | 7 |
| -1 | Ice Gerona | 50.08 | 49.68 | 5 |
| -1 | Cheska Gozum | 49.54 | 49.46 | 5 |
| -1 | Ari Hew | 37.55 | 34.84 | 6 |
| -1 | Rhys Luzana | 29.65 | 28.93 | 7 |
| -1 | Chloe Mariano | 28.23 | 27.35 | 6 |
| -1 | Alessia Palmiey | 22.18 | 20 | 6 |

### Low-sample leaders (not public-eligible)

| rank | player | rating | games | confidence |
| --- | --- | --- | --- | --- |
| 1 | Yuyi Capinpin | 43.69 | 4 | DEVELOPING |
| 2 | Queennie Cordero | 43.41 | 4 | DEVELOPING |
| 3 | Trishma Arciaga | 38.19 | 4 | DEVELOPING |
| 4 | Laela Mateo | 33.38 | 4 | DEVELOPING |
| 5 | Fritz Cuaresma | 26.9 | 2 | PROVISIONAL |
| 6 | Zia Kallos | 26.56 | 3 | DEVELOPING |
| 7 | CJ Luz Roque | 26.18 | 3 | DEVELOPING |
| 8 | Bela Chuidian | 22.99 | 4 | DEVELOPING |
| 9 | Sophie Sanares | 21.06 | 4 | DEVELOPING |
| 10 | Denise Calig-onan | 16.92 | 4 | DEVELOPING |

## Production Recommendation

Do not switch the public leaderboard from this preview alone. Require a coach/scout review set, a next-game or held-out outcome benchmark, stable board coverage, and an explicit versioned write/promotion run. Formula v3 should be inserted under its own FormulaVersion and policy only after those gates pass.
