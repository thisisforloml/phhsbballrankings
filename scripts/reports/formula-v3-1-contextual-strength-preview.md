# Formula v3.3 Continuous Strength Player Rating Preview

Generated: 2026-08-05T15:08:57.384Z

Read-only shadow evaluation. No PlayerRating, GamePerformanceScore, FormulaVersion, RankingSnapshot, Game, or GameStat rows were written.

## Design

- Box-score value prices scoring, missed shots/free throws, rebounds, assists, steals, blocks, turnovers, fouls, and fouls drawn using competition possession context.
- Honest advanced metrics provide a capped secondary adjustment from TS%, eFG%, AST/TO, and defensive activity. Missing inputs are omitted and reweighted, not treated as zero.
- Opponent and teammate individual strength use reliability-adjusted ratings from games completed before the current game date.
- Team strength is the average of prior participant ratings for that Team and Season.
- Team baseline and game-lineup deviation are separated to avoid double-counting the same players.
- Competition strength continuously translates within-competition scores onto a national scale; lower-strength evidence contributes less without creating hard rating ceilings.
- Per-32 production contributes at most 12% and only after eight minutes; low-minute spikes cannot activate it.
- Playing-up years are reported for context but add no direct rating points; opponent and competition evidence carry the difficulty signal.
- Consistency is reported as confidence evidence and does not directly penalize talent.
- Public eligibility remains separate from rating ability; quality-game equivalents expose repeated weak-schedule accumulation.
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
  "contextualMae": 24.655,
  "improvement": 0.553,
  "passesInitialGate": true
}
```

## Competition Strength and Connectivity

The stored League tier is a conservative governance prior, not an automatically learned truth. Cross-competition player overlap is reported as the calibration network required before promotion.

```json
{
  "competitions": [
    {
      "key": "f14b052d-6786-4173-85b2-979b3b6f0781|c4884785-34a9-4b1b-8841-06a390cfc74a|U19|BOYS",
      "league": "NCAA Season 101 Junior's Basketball",
      "tier": 1,
      "qualityScore": 0,
      "age": "U19",
      "gender": "BOYS",
      "games": 81,
      "players": 136,
      "statRows": 1518
    },
    {
      "key": "8b7084c8-e21e-4adb-997b-a40efa2abd55|dc6cf367-da52-4385-8f3d-4b9fcff713f6|U18|BOYS",
      "league": "Philippine Youth Basketball Championship – 18U",
      "tier": 1,
      "qualityScore": 0,
      "age": "U18",
      "gender": "BOYS",
      "games": 15,
      "players": 99,
      "statRows": 374
    },
    {
      "key": "c112c09d-75ac-46ed-96e4-ce2852bfba75|39a4a46c-6362-411f-ae85-6f631414f30b|U16|BOYS",
      "league": "UAAP Season 88 16U Boys Basketball",
      "tier": 1,
      "qualityScore": 0,
      "age": "U16",
      "gender": "BOYS",
      "games": 60,
      "players": 118,
      "statRows": 1464
    },
    {
      "key": "d721a82a-f182-4a54-983a-01453650ec9e|77858fdc-9a0b-4b4a-8820-4ad0a105a8a9|U19|BOYS",
      "league": "UAAP Season 88 HS Boys Basketball",
      "tier": 1,
      "qualityScore": 85,
      "age": "U19",
      "gender": "BOYS",
      "games": 62,
      "players": 97,
      "statRows": 1150
    },
    {
      "key": "ea377aba-7d8a-48b9-acb1-0ecaa1e12aef|308c354b-3f3e-418e-ba34-5d6f7de9485e|U19|GIRLS",
      "league": "UAAP Season 88 HS Girls Basketball",
      "tier": 1,
      "qualityScore": 85,
      "age": "U19",
      "gender": "GIRLS",
      "games": 14,
      "players": 56,
      "statRows": 331
    },
    {
      "key": "a886f9a2-35e5-4cd0-a0bf-4a2c1e20ab53|20a1251b-36c3-422b-a054-d537d4a5491c|U18|BOYS",
      "league": "Junior MPBL Season 4 – 18U",
      "tier": 2,
      "qualityScore": 0,
      "age": "U18",
      "gender": "BOYS",
      "games": 48,
      "players": 534,
      "statRows": 1393
    },
    {
      "key": "87e9d0c6-d5d4-41f5-9d1c-e495cd16baad|757fb031-d320-46a5-b9b6-e05fa321c0e7|U13|BOYS",
      "league": "Philippine Youth Basketball Championship – 13U",
      "tier": 3,
      "qualityScore": 0,
      "age": "U13",
      "gender": "BOYS",
      "games": 35,
      "players": 129,
      "statRows": 900
    },
    {
      "key": "636a2e94-13d9-4c6b-8d6a-becfb8db764b|e7269f1b-0b16-4929-93cb-24683b87db44|U15|BOYS",
      "league": "Philippine Youth Basketball Championship – 15U",
      "tier": 3,
      "qualityScore": 0,
      "age": "U15",
      "gender": "BOYS",
      "games": 36,
      "players": 133,
      "statRows": 930
    },
    {
      "key": "8a446be5-fab1-4f60-9bb1-28f05f766f94|5a9fbea3-ca68-4d65-9e84-dd03cdfa572a|U18|BOYS",
      "league": "Stallion Cup - 18U",
      "tier": 3,
      "qualityScore": 0,
      "age": "U18",
      "gender": "BOYS",
      "games": 25,
      "players": 81,
      "statRows": 456
    },
    {
      "key": "97522351-bfe3-47fb-9bb5-0ec66e32fb42|40a580af-9bb7-4cb3-9c7f-04c1da153b82|U17|BOYS",
      "league": "Stallion Cup – 17U",
      "tier": 3,
      "qualityScore": 0,
      "age": "U17",
      "gender": "BOYS",
      "games": 25,
      "players": 83,
      "statRows": 517
    },
    {
      "key": "97522351-bfe3-47fb-9bb5-0ec66e32fb42|b2797e91-ac78-4b09-82f8-13c979ed0a94|U17|BOYS",
      "league": "Stallion Cup – 17U",
      "tier": 3,
      "qualityScore": 0,
      "age": "U17",
      "gender": "BOYS",
      "games": 32,
      "players": 96,
      "statRows": 657
    },
    {
      "key": "97522351-bfe3-47fb-9bb5-0ec66e32fb42|ad8c32e3-9c9e-4191-aa87-9c403fbd10f2|U17|BOYS",
      "league": "Stallion Cup – 17U",
      "tier": 3,
      "qualityScore": 0,
      "age": "U17",
      "gender": "BOYS",
      "games": 30,
      "players": 81,
      "statRows": 508
    }
  ],
  "connectivity": [
    {
      "board": "U19|BOYS",
      "pools": 9,
      "crossoverPlayers": 140,
      "connectedComponents": 2,
      "largestComponentPools": 8,
      "promotionConnected": false
    },
    {
      "board": "U16|BOYS",
      "pools": 7,
      "crossoverPlayers": 16,
      "connectedComponents": 2,
      "largestComponentPools": 6,
      "promotionConnected": false
    },
    {
      "board": "U13|BOYS",
      "pools": 1,
      "crossoverPlayers": 0,
      "connectedComponents": 1,
      "largestComponentPools": 1,
      "promotionConnected": true
    },
    {
      "board": "U19|GIRLS",
      "pools": 1,
      "crossoverPlayers": 0,
      "connectedComponents": 1,
      "largestComponentPools": 1,
      "promotionConnected": true
    }
  ],
  "artificialCeilingPileup": 0
}
```

## Promotion Gates

```json
{
  "noWrites": true,
  "temporalNonRegression": true,
  "allMultiPoolBoardsConnected": false,
  "noMultiBoardIdentityConflicts": false,
  "tierGovernanceReviewRequired": true,
  "readyForPublicPromotion": false
}
```

## Context Guardrails

```json
{
  "minimum": -1.194,
  "maximum": 1.363,
  "average": 0.013,
  "absoluteAverage": 0.195,
  "nonNeutralPercent": 91.2,
  "cappedAt": 4.5,
  "sameGameLeakagePrevented": true,
  "sameDayLeakagePrevented": true
}
```

## U13 Boys

Candidate ratings: 128; eligible at current 10-game threshold: 21; eligible production rows: 21; eligible overlap: 21; rank correlation: 0.999.

### Eligible Top 10 Side by Side

| rank | production | productionRating | v3 | v3Rating | v3Games |
| --- | --- | --- | --- | --- | --- |
| 1 | Xander Dulfo | 81.98 | Xander Dulfo | 74.76 | 12 |
| 2 | Syrus Demate | 80.71 | Syrus Demate | 74.12 | 12 |
| 3 | Patrick Tumbaga | 80.25 | Patrick Tumbaga | 72.41 | 12 |
| 4 | Kirov Acedo | 77.58 | Kirov Acedo | 69.84 | 10 |
| 5 | Ethan Suangco | 75.06 | Ethan Suangco | 69.14 | 12 |
| 6 | Reign Driz | 70.83 | Reign Driz | 63.42 | 11 |
| 7 | Zach Agustin | 67.42 | Zach Agustin | 60.47 | 11 |
| 8 | Gian Castro | 67.1 | Gian Castro | 59.32 | 10 |
| 9 | Jordan Dela Rosa | 55.92 | Jordan Dela Rosa | 50.3 | 12 |
| 10 | Kian Antonio | 54.61 | Kian Antonio | 49.41 | 11 |

### Biggest Risers

| change | player | production | v3 | games |
| --- | --- | --- | --- | --- |
| 1 | Kailie Tiu | 46.28 | 40.71 | 11 |
| 0 | Xander Dulfo | 81.98 | 74.76 | 12 |
| 0 | Syrus Demate | 80.71 | 74.12 | 12 |
| 0 | Patrick Tumbaga | 80.25 | 72.41 | 12 |
| 0 | Kirov Acedo | 77.58 | 69.84 | 10 |
| 0 | Ethan Suangco | 75.06 | 69.14 | 12 |
| 0 | Reign Driz | 70.83 | 63.42 | 11 |
| 0 | Zach Agustin | 67.42 | 60.47 | 11 |
| 0 | Gian Castro | 67.1 | 59.32 | 10 |
| 0 | Jordan Dela Rosa | 55.92 | 50.3 | 12 |

### Biggest Fallers

| change | player | production | v3 | games |
| --- | --- | --- | --- | --- |
| -1 | Ibrahim Salem | 46.65 | 39.57 | 11 |
| 0 | Xander Dulfo | 81.98 | 74.76 | 12 |
| 0 | Syrus Demate | 80.71 | 74.12 | 12 |
| 0 | Patrick Tumbaga | 80.25 | 72.41 | 12 |
| 0 | Kirov Acedo | 77.58 | 69.84 | 10 |
| 0 | Ethan Suangco | 75.06 | 69.14 | 12 |
| 0 | Reign Driz | 70.83 | 63.42 | 11 |
| 0 | Zach Agustin | 67.42 | 60.47 | 11 |
| 0 | Gian Castro | 67.1 | 59.32 | 10 |
| 0 | Jordan Dela Rosa | 55.92 | 50.3 | 12 |

### Low-sample leaders (not public-eligible)

| rank | player | rating | games | confidence |
| --- | --- | --- | --- | --- |
| 1 | Liam Santo | 81.37 | 4 | PROVISIONAL |
| 2 | Andre Kitong | 81.13 | 6 | DEVELOPING |
| 3 | Aiden Kitong | 80.24 | 2 | PROVISIONAL |
| 4 | Cristhop Calvero | 80.07 | 5 | DEVELOPING |
| 5 | Liam Santos | 73.18 | 2 | PROVISIONAL |
| 6 | Philip Jr. Punzalan | 70.71 | 6 | DEVELOPING |
| 7 | Coi Aver Moncal | 69.54 | 8 | DEVELOPING |
| 8 | Xian Latay | 67.17 | 7 | DEVELOPING |
| 9 | Oscar Bagion | 66.88 | 8 | DEVELOPING |
| 10 | Leiam Osorio | 66.41 | 9 | DEVELOPING |

## U16 Boys

Candidate ratings: 253; eligible at current 10-game threshold: 114; eligible production rows: 121; eligible overlap: 114; rank correlation: 0.991.

### Eligible Top 10 Side by Side

| rank | production | productionRating | v3 | v3Rating | v3Games |
| --- | --- | --- | --- | --- | --- |
| 1 | Goodluck Okebata | 96.58 | Goodluck Okebata | 92.52 | 14 |
| 2 | Prince Cariño | 92.5 | Moussa Diakite | 87.18 | 33 |
| 3 | Moussa Diakite | 89.91 | Francel Flores | 77.89 | 28 |
| 4 | Francel Flores | 88.11 | JD Juangco | 77.21 | 11 |
| 5 | Xyriel Macahipay | 84.13 | Mark Perdigon | 76.44 | 14 |
| 6 | Akhiro Franz Reynon | 83.78 | CJ Tabbuga | 75.2 | 15 |
| 7 | Denden Enriquez | 83.14 | Gab Castro | 74.5 | 15 |
| 8 | Keefe Iledan | 82.19 | Keefe Iledan | 73.4 | 25 |
| 9 | Sky Jazul | 81.13 | Lorenzo Purugganan | 72.34 | 14 |
| 10 | CJ Tabbuga | 80.41 | Rowie Cabañero | 72.07 | 17 |

### Biggest Risers

| change | player | production | v3 | games |
| --- | --- | --- | --- | --- |
| 20 | Marvic Mesina | 30.26 | 33.2 | 13 |
| 13 | Louise Sinda | 29.07 | 27.42 | 10 |
| 12 | Jaidel Daa | 38.81 | 37.98 | 20 |
| 12 | Loin Lalong-Isip | 36.77 | 35.19 | 15 |
| 10 | Rain Gabryle Cajilig | 44.93 | 41.74 | 11 |
| 10 | Jordan Cayabyab | 28.08 | 24.74 | 12 |
| 10 | Ryley Floirendo | 25 | 21.6 | 12 |
| 10 | Nicus Calma | 24.27 | 20.19 | 12 |
| 10 | Max Romero | 22.68 | 18.43 | 14 |
| 9 | Juan Mallabo | 72.03 | 70.04 | 14 |

### Biggest Fallers

| change | player | production | v3 | games |
| --- | --- | --- | --- | --- |
| -16 | Prince Cariño | 92.5 | 66.76 | 35 |
| -15 | Sky Jazul | 81.13 | 60.24 | 18 |
| -14 | Denden Enriquez | 83.14 | 63.68 | 35 |
| -9 | Akhiro Franz Reynon | 83.78 | 69.23 | 15 |
| -6 | Eiron Shan Ramos | 68.39 | 57.71 | 10 |
| -6 | Austin Delos Santos | 54.57 | 46.91 | 14 |
| -6 | Zandro Lugatiman | 40.85 | 31.84 | 14 |
| -2 | Marcus Stephen Uy | 55.37 | 49.3 | 10 |
| -1 | Khryz Alexandr Samson | 64.97 | 58.08 | 11 |
| -1 | John Addatu | 62.53 | 54.16 | 14 |

### Low-sample leaders (not public-eligible)

| rank | player | rating | games | confidence |
| --- | --- | --- | --- | --- |
| 1 | Jesse Arellano | 78.53 | 9 | DEVELOPING |
| 2 | Rye Teodor Villaruz | 78 | 8 | DEVELOPING |
| 3 | Thadeus Angeles | 76.2 | 6 | DEVELOPING |
| 4 | Kurt Devron Benitez | 74.83 | 7 | DEVELOPING |
| 5 | Riley Yuan Dela Cruz | 74.12 | 8 | DEVELOPING |
| 6 | Allain Escober | 69.61 | 7 | DEVELOPING |
| 7 | Derict Reyes | 69.07 | 6 | DEVELOPING |
| 8 | Lawrence Tombocon | 68.74 | 7 | DEVELOPING |
| 9 | Xerone Dizon | 66.09 | 8 | DEVELOPING |
| 10 | Royette Villareal | 65.67 | 5 | DEVELOPING |

## U19 Boys

Candidate ratings: 975; eligible at current 10-game threshold: 250; eligible production rows: 312; eligible overlap: 247; rank correlation: 0.985.

### Eligible Top 10 Side by Side

| rank | production | productionRating | v3 | v3Rating | v3Games |
| --- | --- | --- | --- | --- | --- |
| 1 | Jude Eriobu | 98.33 | Jude Eriobu | 95.55 | 16 |
| 2 | Josef Calo-oy | 91.82 | Mark Esperanza | 90.36 | 12 |
| 3 | Mark Esperanza | 90.61 | Josef Calo-oy | 89.46 | 22 |
| 4 | Sean Franco | 88.82 | Steven Creus | 88.28 | 14 |
| 5 | Steven Creus | 88.41 | Xyriel Macahipay | 86.48 | 16 |
| 6 | John Ray Ladica | 88.34 | Jetlee Melano | 85.73 | 14 |
| 7 | Cabs Cabonilas | 88.19 | Patrick Pasinos | 82.15 | 19 |
| 8 | Lucas Kaw | 87.4 | Jaime Teodoro | 80.73 | 22 |
| 9 | Moussa Diakite | 87.27 | Yuan Ramirez | 79.94 | 22 |
| 10 | Maco Dabao | 87.15 | Lucas Kaw | 79.93 | 22 |

### Biggest Risers

| change | player | production | v3 | games |
| --- | --- | --- | --- | --- |
| 84 | Dustin Bathan | 42.04 | 44.55 | 14 |
| 83 | Johari Domingo | 46.17 | 50.48 | 17 |
| 80 | John Dela Cruz | 42.75 | 44.7 | 17 |
| 78 | Romnick Araneta | 30.29 | 32.2 | 10 |
| 78 | Ethan Carniyan | 29.82 | 31.34 | 13 |
| 78 | Kobe Urbina | 28.91 | 30.27 | 13 |
| 76 | Raphael Bautista | 35.52 | 38.59 | 11 |
| 76 | Yan Tagorda | 34.17 | 36.89 | 19 |
| 75 | Adi Alagaban | 42.51 | 43.22 | 19 |
| 75 | Jermaine Sapo | 39.03 | 40.97 | 18 |

### Biggest Fallers

| change | player | production | v3 | games |
| --- | --- | --- | --- | --- |
| -2 | Lucas Kaw | 87.4 | 79.93 | 22 |
| -1 | Josef Calo-oy | 91.82 | 89.46 | 22 |
| 0 | Jude Eriobu | 98.33 | 95.55 | 16 |
| 1 | Mark Esperanza | 90.61 | 90.36 | 12 |
| 1 | Steven Creus | 88.41 | 88.28 | 14 |
| 1 | Allen Te | 83.02 | 76.45 | 17 |
| 2 | Yuan Ramirez | 87.06 | 79.94 | 22 |
| 3 | Joaquin Escudero | 80.77 | 74.59 | 18 |
| 3 | Joshua Chua | 80.6 | 73.72 | 23 |
| 3 | Christian Pedarce | 78.82 | 72.12 | 16 |

### Low-sample leaders (not public-eligible)

| rank | player | rating | games | confidence |
| --- | --- | --- | --- | --- |
| 1 | Julian Villano | 89.56 | 3 | PROVISIONAL |
| 2 | Reimune Andrei Aldep | 87.04 | 5 | DEVELOPING |
| 3 | Jaime Jacob Iii Hizon | 86.92 | 8 | DEVELOPING |
| 4 | Dairick Emmanuel Duterte | 86.74 | 2 | PROVISIONAL |
| 5 | Dwayne Canete | 86.43 | 1 | PROVISIONAL |
| 6 | Prince Torres | 85.51 | 1 | PROVISIONAL |
| 7 | Andwel Cabanero | 85.4 | 2 | PROVISIONAL |
| 8 | Justine Santos | 85.2 | 6 | DEVELOPING |
| 9 | Mark Lester Rosales | 84.19 | 4 | DEVELOPING |
| 10 | Jd Turko | 83.48 | 1 | PROVISIONAL |

## U19 Girls

Candidate ratings: 56; eligible at current 5-game threshold: 45; eligible production rows: 45; eligible overlap: 45; rank correlation: 0.998.

### Eligible Top 10 Side by Side

| rank | production | productionRating | v3 | v3Rating | v3Games |
| --- | --- | --- | --- | --- | --- |
| 1 | Aubrey Lapasaran | 89.8 | Aubrey Lapasaran | 87.44 | 8 |
| 2 | Adin Rosano | 87.7 | Adin Rosano | 84.19 | 8 |
| 3 | Riri Perez | 87.44 | Riri Perez | 83.26 | 8 |
| 4 | Janice Oczon | 78.92 | Janice Oczon | 74.78 | 8 |
| 5 | Pia Petalcorin | 78.31 | Pia Petalcorin | 74.71 | 7 |
| 6 | Lea Pinuela | 77.91 | Lea Pinuela | 73.57 | 8 |
| 7 | Koukou Talla | 74.99 | Koukou Talla | 70.31 | 8 |
| 8 | Apyang Dulay | 74.6 | Apyang Dulay | 70.05 | 6 |
| 9 | Ima Navarro | 72.7 | Ruiza Olmos | 68.32 | 8 |
| 10 | Ruiza Olmos | 71.84 | Ima Navarro | 66.66 | 6 |

### Biggest Risers

| change | player | production | v3 | games |
| --- | --- | --- | --- | --- |
| 2 | Zia Onate | 49.21 | 44.08 | 7 |
| 1 | Ruiza Olmos | 71.84 | 68.32 | 8 |
| 1 | Zane Singson | 68.99 | 64.49 | 8 |
| 1 | Bri Katigbak | 55.49 | 51.55 | 8 |
| 1 | Nadine Labay | 49.75 | 44.65 | 6 |
| 1 | Sophia Townes | 49 | 42.6 | 5 |
| 1 | Tyler Templo | 28.4 | 24.64 | 6 |
| 1 | Zoe Ablang | 26.95 | 22.26 | 6 |
| 1 | Louise Doque | 21.63 | 16.8 | 6 |
| 0 | Aubrey Lapasaran | 89.8 | 87.44 | 8 |

### Biggest Fallers

| change | player | production | v3 | games |
| --- | --- | --- | --- | --- |
| -2 | Ice Gerona | 50.08 | 43.73 | 5 |
| -2 | Cheska Gozum | 49.54 | 41.34 | 5 |
| -1 | Ima Navarro | 72.7 | 66.66 | 6 |
| -1 | Ching Ching Gales | 70.7 | 64.27 | 6 |
| -1 | Hasly Mallari | 55.52 | 50.53 | 8 |
| -1 | Rhys Luzana | 29.65 | 23.94 | 7 |
| -1 | Chloe Mariano | 28.23 | 22.09 | 6 |
| -1 | Alessia Palmiey | 22.18 | 15.53 | 6 |
| 0 | Aubrey Lapasaran | 89.8 | 87.44 | 8 |
| 0 | Adin Rosano | 87.7 | 84.19 | 8 |

### Low-sample leaders (not public-eligible)

| rank | player | rating | games | confidence |
| --- | --- | --- | --- | --- |
| 1 | Yuyi Capinpin | 34.67 | 4 | DEVELOPING |
| 2 | Queennie Cordero | 34.11 | 4 | DEVELOPING |
| 3 | Trishma Arciaga | 30.58 | 4 | DEVELOPING |
| 4 | Laela Mateo | 27.81 | 4 | DEVELOPING |
| 5 | Fritz Cuaresma | 22.46 | 2 | PROVISIONAL |
| 6 | CJ Luz Roque | 20.28 | 3 | DEVELOPING |
| 7 | Zia Kallos | 19.97 | 3 | DEVELOPING |
| 8 | Bela Chuidian | 19.26 | 4 | DEVELOPING |
| 9 | Sophie Sanares | 16.55 | 4 | DEVELOPING |
| 10 | Denise Calig-onan | 11.81 | 4 | DEVELOPING |

## Production Recommendation

Do not switch the public leaderboard from this preview alone. Competition tiers require governance review, disconnected competition pools require bridge evidence, multi-board identity conflicts must be resolved, and an explicit versioned write/promotion run must be approved.
