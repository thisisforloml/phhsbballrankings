# Rating Ecosystem vNext Preview

Generated: 2026-08-05T15:21:32.132Z

This report evaluates player, team, and competition ratings together. It is read-only: no database rows, production ratings, tiers, snapshots, games, or stats were changed.

## Loopholes addressed

- Replaces contradictory league-tier multipliers with one monotonic competition-strength translation.
- Uses actual Team identity for team ratings instead of collapsing multiple teams under one Program.
- Uses prior-game roster estimates and commits history after the full date, preventing same-game and same-day leakage.
- Separates raw game minimums from quality-game equivalents and exposes uncertainty ranges.
- Replaces hard elite caps with a continuous uncertainty adjustment; high-quality evidence remains visible for audit.
- Uses smooth recency decay rather than abrupt time buckets.
- Keeps player, team, and competition strength mutually constrained without treating any manual tier as automatic truth.

## Inventory

```json
{
  "officialStatRows": 10198,
  "statBearingGames": 463,
  "officialTeamResultGames": 463,
  "teamResultOnlyGames": 0,
  "players": 1395,
  "teams": 97,
  "competitionPools": 12,
  "teamRatings": 105,
  "playerRatings": 1412
}
```

## Promotion gates

```json
{
  "noDatabaseWrites": true,
  "monotonicCompetitionDirection": true,
  "actualTeamIdentityUsed": true,
  "sameDayLeakagePrevented": true,
  "noArtificialRatingCeiling": true,
  "allMultiPoolBoardsConnected": false,
  "allCompetitionProfilesConfident": false,
  "readyForProduction": false
}
```

## Competition strength

| competition | strength | confidence | games | teams | players | crossover | tier | provisional | highQuality |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| NCAA Season 101 Junior's Basketball / U19 / BOYS | 95.9 | 1 | 81 | 10 | 136 | 29 | 1 | false | true |
| UAAP Season 88 HS Boys Basketball / U19 / BOYS | 94.92 | 1 | 62 | 8 | 97 | 15 | 1 | false | true |
| UAAP Season 88 HS Girls Basketball / U19 / GIRLS | 89.2 | 0.406 | 14 | 4 | 56 | 0 | 1 | true | false |
| UAAP Season 88 16U Boys Basketball / U16 / BOYS | 87.86 | 1 | 60 | 8 | 118 | 14 | 1 | false | true |
| Philippine Youth Basketball Championship – 18U / U18 / BOYS | 87.77 | 0.791 | 15 | 6 | 99 | 28 | 1 | false | true |
| Stallion Cup - 18U / U18 / BOYS | 74.8 | 0.909 | 25 | 7 | 81 | 52 | 2 | false | false |
| Junior MPBL Season 4 – 18U / U18 / BOYS | 72.2 | 1 | 48 | 23 | 534 | 54 | 2 | false | false |
| Philippine Youth Basketball Championship – 13U / U13 / BOYS | 67 | 0.75 | 35 | 8 | 129 | 0 | 3 | false | false |
| Philippine Youth Basketball Championship – 15U / U15 / BOYS | 66.35 | 0.771 | 36 | 8 | 133 | 1 | 3 | false | false |
| Stallion Cup – 17U / U17 / BOYS | 66.26 | 0.981 | 30 | 8 | 81 | 65 | 3 | false | false |
| Stallion Cup – 17U / U17 / BOYS | 63.41 | 1 | 32 | 8 | 96 | 74 | 3 | false | false |
| Stallion Cup – 17U / U17 / BOYS | 63.07 | 0.909 | 25 | 7 | 83 | 55 | 3 | false | false |

## Connectivity

| board | pools | crossoverPlayers | connectedComponents | connected |
| --- | --- | --- | --- | --- |
| U19\|BOYS | 9 | 140 | 2 | false |
| U16\|BOYS | 7 | 16 | 2 | false |
| U13\|BOYS | 1 | 0 | 1 | true |
| U19\|GIRLS | 1 | 0 | 1 | true |

## U13 Boys

Candidate players: 128; quality-eligible: 17; five-stars: 0; exact 89.99 ceiling pileup: 0.

### Production vs Formula v3.3

| rank | production | productionRating | candidate | candidateRating |
| --- | --- | --- | --- | --- |
| 1 | Xander Dulfo | 81.98 | Xander Dulfo | 81.45 |
| 2 | Syrus Demate | 80.71 | Syrus Demate | 80.67 |
| 3 | Patrick Tumbaga | 80.25 | Patrick Tumbaga | 78.79 |
| 4 | Kirov Acedo | 77.58 | Ethan Suangco | 75.29 |
| 5 | Ethan Suangco | 75.06 | Reign Driz | 69.04 |
| 6 | Reign Driz | 70.83 | Zach Agustin | 65.98 |
| 7 | Zach Agustin | 67.42 | Jordan Dela Rosa | 55.19 |
| 8 | Gian Castro | 67.1 | Kian Antonio | 54.33 |
| 9 | Jordan Dela Rosa | 55.92 | Tim Cruz | 52.67 |
| 10 | Kian Antonio | 54.61 | Kailie Tiu | 45.05 |

### Formula v3.3 evidence detail

| rank | player | estimatedRating | rating | uncertainty | range | games | qualityGames | confidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Xander Dulfo | 83.12 | 81.45 | 3.34 | 74.89-88.01 | 12 | 9.43 | ESTABLISHED |
| 2 | Syrus Demate | 82.61 | 80.67 | 3.87 | 73.09-88.26 | 12 | 9.43 | ESTABLISHED |
| 3 | Patrick Tumbaga | 81.05 | 78.79 | 4.51 | 69.95-87.63 | 12 | 9.43 | ESTABLISHED |
| 4 | Ethan Suangco | 77.62 | 75.29 | 4.66 | 66.16-84.42 | 12 | 9.43 | ESTABLISHED |
| 5 | Reign Driz | 72.66 | 69.04 | 7.25 | 54.83-83.24 | 11 | 8.64 | ESTABLISHED |
| 6 | Zach Agustin | 68.98 | 65.98 | 6 | 54.22-77.75 | 11 | 8.64 | ESTABLISHED |
| 7 | Jordan Dela Rosa | 58.48 | 55.19 | 6.59 | 42.27-68.1 | 12 | 9.43 | ESTABLISHED |
| 8 | Kian Antonio | 57.09 | 54.33 | 5.53 | 43.48-65.17 | 11 | 8.64 | ESTABLISHED |
| 9 | Tim Cruz | 56.62 | 52.67 | 7.9 | 37.19-68.16 | 12 | 9.43 | ESTABLISHED |
| 10 | Kailie Tiu | 48.29 | 45.05 | 6.49 | 32.32-57.77 | 11 | 8.64 | ESTABLISHED |

## U16 Boys

Candidate players: 253; quality-eligible: 108; five-stars: 1; exact 89.99 ceiling pileup: 0.

### Production vs Formula v3.3

| rank | production | productionRating | candidate | candidateRating |
| --- | --- | --- | --- | --- |
| 1 | Goodluck Okebata | 96.58 | Goodluck Okebata | 94.2 |
| 2 | Prince Cariño | 92.5 | Moussa Diakite | 89.82 |
| 3 | Moussa Diakite | 89.91 | Francel Flores | 80.45 |
| 4 | Francel Flores | 88.11 | JD Juangco | 78.68 |
| 5 | Xyriel Macahipay | 84.13 | Mark Perdigon | 78.34 |
| 6 | Akhiro Franz Reynon | 83.78 | CJ Tabbuga | 76.46 |
| 7 | Denden Enriquez | 83.14 | Gab Castro | 76.01 |
| 8 | Keefe Iledan | 82.19 | Keefe Iledan | 75.69 |
| 9 | Sky Jazul | 81.13 | Akhiro Franz Reynon | 74.64 |
| 10 | CJ Tabbuga | 80.41 | Lorenzo Purugganan | 73.74 |

### Formula v3.3 evidence detail

| rank | player | estimatedRating | rating | uncertainty | range | games | qualityGames | confidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Goodluck Okebata | 94.95 | 94.2 | 1.5 | 91.26-97.14 | 14 | 12.9 | ESTABLISHED |
| 2 | Moussa Diakite | 90.93 | 89.82 | 2.21 | 85.48-94.16 | 33 | 31.18 | ESTABLISHED |
| 3 | Francel Flores | 81.9 | 80.45 | 2.91 | 74.74-86.16 | 28 | 26.43 | ESTABLISHED |
| 4 | JD Juangco | 81.19 | 78.68 | 5.02 | 68.84-88.51 | 11 | 10.13 | ESTABLISHED |
| 5 | Mark Perdigon | 79.98 | 78.34 | 3.28 | 71.91-84.76 | 14 | 12.9 | ESTABLISHED |
| 6 | CJ Tabbuga | 79.93 | 76.46 | 6.94 | 62.86-90.05 | 15 | 13.82 | ESTABLISHED |
| 7 | Gab Castro | 78.75 | 76.01 | 5.48 | 65.28-86.74 | 15 | 13.82 | ESTABLISHED |
| 8 | Keefe Iledan | 77.83 | 75.69 | 4.28 | 67.3-84.07 | 25 | 23.49 | ESTABLISHED |
| 9 | Akhiro Franz Reynon | 77.33 | 74.64 | 5.38 | 64.08-85.19 | 15 | 11.87 | ESTABLISHED |
| 10 | Lorenzo Purugganan | 77.19 | 73.74 | 6.91 | 60.2-87.28 | 14 | 12.9 | ESTABLISHED |

## U19 Boys

Candidate players: 975; quality-eligible: 249; five-stars: 4; exact 89.99 ceiling pileup: 0.

### Production vs Formula v3.3

| rank | production | productionRating | candidate | candidateRating |
| --- | --- | --- | --- | --- |
| 1 | Jude Eriobu | 98.33 | Jude Eriobu | 98.33 |
| 2 | Josef Calo-oy | 91.82 | Mark Esperanza | 94.09 |
| 3 | Mark Esperanza | 90.61 | Josef Calo-oy | 91.97 |
| 4 | Sean Franco | 88.82 | Steven Creus | 91.79 |
| 5 | Steven Creus | 88.41 | Xyriel Macahipay | 89.92 |
| 6 | John Ray Ladica | 88.34 | Jetlee Melano | 89.3 |
| 7 | Cabs Cabonilas | 88.19 | Yuan Ramirez | 87.93 |
| 8 | Lucas Kaw | 87.4 | Lucas Kaw | 87.19 |
| 9 | Moussa Diakite | 87.27 | Patrick Pasinos | 84.68 |
| 10 | Maco Dabao | 87.15 | Jaime Teodoro | 83.3 |

### Formula v3.3 evidence detail

| rank | player | estimatedRating | rating | uncertainty | range | games | qualityGames | confidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Jude Eriobu | 99.08 | 98.33 | 1.5 | 95.39-100 | 16 | 15.47 | ESTABLISHED |
| 2 | Mark Esperanza | 95.18 | 94.09 | 2.17 | 89.83-98.35 | 12 | 11.68 | ESTABLISHED |
| 3 | Josef Calo-oy | 92.73 | 91.97 | 1.52 | 88.99-94.94 | 22 | 20.18 | ESTABLISHED |
| 4 | Steven Creus | 93.07 | 91.79 | 2.55 | 86.79-96.79 | 14 | 13.63 | ESTABLISHED |
| 5 | Xyriel Macahipay | 91.13 | 89.92 | 2.42 | 85.17-94.67 | 16 | 15.42 | ESTABLISHED |
| 6 | Jetlee Melano | 90.39 | 89.3 | 2.19 | 85-93.59 | 14 | 13.54 | ESTABLISHED |
| 7 | Yuan Ramirez | 88.68 | 87.93 | 1.5 | 84.99-90.87 | 22 | 17.49 | ESTABLISHED |
| 8 | Lucas Kaw | 87.94 | 87.19 | 1.5 | 84.25-90.13 | 22 | 17.19 | ESTABLISHED |
| 9 | Patrick Pasinos | 86.37 | 84.68 | 3.38 | 78.06-91.3 | 19 | 17.72 | ESTABLISHED |
| 10 | Jaime Teodoro | 84.57 | 83.3 | 2.54 | 78.33-88.28 | 22 | 20.18 | ESTABLISHED |

## U19 Girls

Candidate players: 56; quality-eligible: 45; five-stars: 0; exact 89.99 ceiling pileup: 0.

### Production vs Formula v3.3

| rank | production | productionRating | candidate | candidateRating |
| --- | --- | --- | --- | --- |
| 1 | Aubrey Lapasaran | 89.8 | Aubrey Lapasaran | 88.46 |
| 2 | Adin Rosano | 87.7 | Adin Rosano | 85.32 |
| 3 | Riri Perez | 87.44 | Riri Perez | 84.21 |
| 4 | Janice Oczon | 78.92 | Pia Petalcorin | 76.11 |
| 5 | Pia Petalcorin | 78.31 | Janice Oczon | 75.97 |
| 6 | Lea Pinuela | 77.91 | Lea Pinuela | 74.9 |
| 7 | Koukou Talla | 74.99 | Koukou Talla | 71.61 |
| 8 | Apyang Dulay | 74.6 | Apyang Dulay | 71.31 |
| 9 | Ima Navarro | 72.7 | Ruiza Olmos | 70.04 |
| 10 | Ruiza Olmos | 71.84 | Ima Navarro | 68.1 |

### Formula v3.3 evidence detail

| rank | player | estimatedRating | rating | uncertainty | range | games | qualityGames | confidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Aubrey Lapasaran | 90.69 | 88.46 | 4.47 | 79.7-97.21 | 8 | 7.44 | DEVELOPING |
| 2 | Adin Rosano | 87.64 | 85.32 | 4.64 | 76.22-94.42 | 8 | 7.44 | DEVELOPING |
| 3 | Riri Perez | 87.36 | 84.21 | 6.31 | 71.85-96.57 | 8 | 7.44 | DEVELOPING |
| 4 | Pia Petalcorin | 78.9 | 76.11 | 5.58 | 65.18-87.05 | 7 | 6.51 | DEVELOPING |
| 5 | Janice Oczon | 79.7 | 75.97 | 7.45 | 61.38-90.57 | 8 | 7.44 | DEVELOPING |
| 6 | Lea Pinuela | 78.23 | 74.9 | 6.67 | 61.83-87.97 | 8 | 7.44 | DEVELOPING |
| 7 | Koukou Talla | 75.85 | 71.61 | 8.49 | 54.97-88.24 | 8 | 7.44 | DEVELOPING |
| 8 | Apyang Dulay | 75.8 | 71.31 | 8.98 | 53.7-88.92 | 6 | 5.58 | DEVELOPING |
| 9 | Ruiza Olmos | 72.66 | 70.04 | 5.23 | 59.79-80.3 | 8 | 7.44 | DEVELOPING |
| 10 | Ima Navarro | 72.42 | 68.1 | 8.66 | 51.13-85.06 | 6 | 5.58 | DEVELOPING |

## Team preview: Junior MPBL Season 4 – 18U / U18 / BOYS

| rank | team | rating | games | confidence | uncertainty |
| --- | --- | --- | --- | --- | --- |
| 1 | San Juan U19 Boys | 52.46 | 8 | 0.766 | 5.27 |
| 2 | Antipolo U19 Boys | 51.73 | 3 | 0.374 | 10.76 |
| 3 | Palawan U19 Boys | 51.63 | 4 | 0.489 | 9.15 |
| 4 | N. Ecija U19 Boys | 51.62 | 4 | 0.498 | 9.02 |
| 5 | Valenzuela U19 Boys | 51.19 | 4 | 0.484 | 9.23 |
| 6 | San Pedro Spartans U18 Boys | 51.02 | 6 | 0.672 | 6.59 |
| 7 | Batangas U19 Boys | 51.01 | 6 | 0.666 | 6.67 |
| 8 | Biñan U19 Boys | 50.35 | 3 | 0.365 | 10.89 |
| 9 | Muntinlupa U19 Boys | 50.24 | 4 | 0.497 | 9.04 |
| 10 | Bulacan U19 Boys | 50.21 | 5 | 0.597 | 7.65 |

## Team preview: UAAP Season 88 HS Girls Basketball / U19 / GIRLS

| rank | team | rating | games | confidence | uncertainty |
| --- | --- | --- | --- | --- | --- |
| 1 | UST Tigress Cubs | 52.31 | 8 | 0.482 | 9.26 |
| 2 | NUNS Lady Bullpups | 52.27 | 8 | 0.481 | 9.26 |
| 3 | De La Salle Zobel Lady Junior Archers | 50.37 | 6 | 0.404 | 10.35 |
| 4 | Ateneo Lady Eaglets | 49.05 | 6 | 0.404 | 10.34 |

## Team preview: UAAP Season 88 16U Boys Basketball / U16 / BOYS

| rank | team | rating | games | confidence | uncertainty |
| --- | --- | --- | --- | --- | --- |
| 1 | NUNS Bullpups 16U | 54.02 | 16 | 0.818 | 4.55 |
| 2 | FEU - Diliman Baby Tamaraws 16U | 52.65 | 18 | 0.877 | 3.73 |
| 3 | UST Tiger Cubs 16U | 52.63 | 15 | 0.789 | 4.96 |
| 4 | Adamson Baby Falcons 16U | 52.46 | 15 | 0.789 | 4.96 |
| 5 | UE Junior Warriors 16U | 52.04 | 14 | 0.76 | 5.37 |
| 6 | Ateneo Blue Eaglets 16U | 50.88 | 14 | 0.76 | 5.37 |
| 7 | De La Salle Zobel Junior Archers 16U | 49.34 | 14 | 0.76 | 5.37 |
| 8 | UP Junior Fighting Maroons 16U | 49.3 | 14 | 0.76 | 5.37 |

## Team preview: Stallion Cup – 17U / U17 / BOYS

| rank | team | rating | games | confidence | uncertainty |
| --- | --- | --- | --- | --- | --- |
| 1 | Bistrot Le Coucou U19 Boys | 51.01 | 8 | 0.584 | 7.82 |
| 2 | Chatime U17 Boys | 49.99 | 8 | 0.584 | 7.82 |
| 3 | Celsius | 49.9 | 8 | 0.584 | 7.82 |
| 4 | BBC U17 Boys | 49.89 | 8 | 0.584 | 7.82 |
| 5 | Ogalala U19 Boys | 49.3 | 6 | 0.525 | 8.64 |
| 6 | Torch | 49.28 | 6 | 0.525 | 8.64 |
| 7 | Fruteria | 48.94 | 6 | 0.525 | 8.64 |

## Team preview: Stallion Cup - 18U / U18 / BOYS

| rank | team | rating | games | confidence | uncertainty |
| --- | --- | --- | --- | --- | --- |
| 1 | BBC U18 Boys | 51.71 | 8 | 0.68 | 6.48 |
| 2 | JJ Sports | 51.67 | 8 | 0.683 | 6.44 |
| 3 | Chatime U18 Boys | 51.43 | 8 | 0.684 | 6.42 |
| 4 | Charm U18 Boys | 50.38 | 8 | 0.679 | 6.5 |
| 5 | Azarias | 50.25 | 6 | 0.594 | 7.69 |
| 6 | Amsteel U18 Boys | 49.81 | 6 | 0.591 | 7.73 |
| 7 | Gold Cross U18 Boys | 49.47 | 6 | 0.586 | 7.8 |

## Team preview: Philippine Youth Basketball Championship – 13U / U13 / BOYS

| rank | team | rating | games | confidence | uncertainty |
| --- | --- | --- | --- | --- | --- |
| 1 | Chef's Magic MLO Basketball 13U | 51.39 | 12 | 0.701 | 6.19 |
| 2 | Jet's Barbershop 13U | 51.19 | 12 | 0.701 | 6.19 |
| 3 | Smile 360 Bullies U13 Boys | 50.59 | 8 | 0.584 | 7.82 |
| 4 | JPM-TEC San Beda U13 Boys | 50.04 | 8 | 0.584 | 7.82 |
| 5 | Aces Solar Locked In 13U | 49.78 | 7 | 0.555 | 8.23 |
| 6 | GTG Foundation Los Baños Gallants 13U | 49.59 | 8 | 0.584 | 7.82 |
| 7 | TOPS Mordeno 13U | 48.69 | 7 | 0.555 | 8.23 |
| 8 | EMDS Rizal Knights 13U | 48.16 | 8 | 0.584 | 7.82 |

## Team preview: UAAP Season 88 HS Boys Basketball / U19 / BOYS

| rank | team | rating | games | confidence | uncertainty |
| --- | --- | --- | --- | --- | --- |
| 1 | NUNS Bullpups | 54.67 | 18 | 0.96 | 2.57 |
| 2 | Ateneo Blue Eaglets | 53.82 | 16 | 0.879 | 3.69 |
| 3 | FEU - Diliman Baby Tamaraws | 53.63 | 19 | 0.996 | 2.05 |
| 4 | UE Junior Warriors | 51.81 | 14 | 0.805 | 4.73 |
| 5 | De La Salle Zobel Junior Archers | 51.79 | 15 | 0.843 | 4.2 |
| 6 | Adamson Baby Falcons | 51.54 | 14 | 0.805 | 4.73 |
| 7 | UST Tiger Cubs | 51.53 | 14 | 0.805 | 4.73 |
| 8 | UP Junior Fighting Maroons | 49.56 | 14 | 0.805 | 4.73 |

## Team preview: Stallion Cup – 17U / U17 / BOYS

| rank | team | rating | games | confidence | uncertainty |
| --- | --- | --- | --- | --- | --- |
| 1 | Amsteel U17 Boys | 50.91 | 9 | 0.613 | 7.41 |
| 2 | Gold Cross U17 Boys | 50.64 | 9 | 0.613 | 7.41 |
| 3 | Torch | 50.22 | 8 | 0.584 | 7.82 |
| 4 | Auto-Gard | 50.19 | 7 | 0.555 | 8.23 |
| 5 | Charm U17 Boys | 49.97 | 9 | 0.613 | 7.41 |
| 6 | BBC U17 Boys | 49.6 | 6 | 0.525 | 8.64 |
| 7 | Celsius | 49.12 | 7 | 0.555 | 8.23 |
| 8 | Tapa Mama | 48.9 | 5 | 0.496 | 9.05 |

## Team preview: Stallion Cup – 17U / U17 / BOYS

| rank | team | rating | games | confidence | uncertainty |
| --- | --- | --- | --- | --- | --- |
| 1 | BBC U17 Boys | 50.88 | 9 | 0.613 | 7.41 |
| 2 | Boysen | 50.83 | 9 | 0.613 | 7.41 |
| 3 | Firestone | 50.25 | 9 | 0.613 | 7.41 |
| 4 | Charm U17 Boys | 49.75 | 7 | 0.555 | 8.23 |
| 5 | Buttery & Co | 49.64 | 9 | 0.613 | 7.41 |
| 6 | Gold Cross U17 Boys | 49.64 | 7 | 0.555 | 8.23 |
| 7 | MARCars U19 Boys | 49.29 | 7 | 0.555 | 8.23 |
| 8 | Fair N Square | 48.74 | 7 | 0.555 | 8.23 |

## Team preview: NCAA Season 101 Junior's Basketball / U19 / BOYS

| rank | team | rating | games | confidence | uncertainty |
| --- | --- | --- | --- | --- | --- |
| 1 | Mapúa Red Robins | 53.3 | 18 | 0.877 | 3.73 |
| 2 | EAC Brigadiers | 53.09 | 18 | 0.877 | 3.73 |
| 3 | Arellano Braves | 52.92 | 19 | 0.906 | 3.32 |
| 4 | Letran Squires | 52.81 | 20 | 0.935 | 2.91 |
| 5 | LSGH Greenies | 52.76 | 14 | 0.76 | 5.37 |
| 6 | Perpetual Junior Daltas | 51.93 | 15 | 0.789 | 4.96 |
| 7 | San Sebastian Golden Staglets | 51.81 | 15 | 0.789 | 4.96 |
| 8 | LPU Junior Pirates | 51.46 | 14 | 0.76 | 5.37 |
| 9 | San Beda Red Cubs | 51.43 | 15 | 0.789 | 4.96 |
| 10 | JRU Light Bombers | 50.85 | 14 | 0.76 | 5.37 |

## Team preview: Philippine Youth Basketball Championship – 18U / U18 / BOYS

| rank | team | rating | games | confidence | uncertainty |
| --- | --- | --- | --- | --- | --- |
| 1 | Mapúa Red Robins | 52.67 | 5 | 0.601 | 7.58 |
| 2 | Grupong Bedista - San Beda U18 Boys | 51.77 | 6 | 0.674 | 6.56 |
| 3 | San Pedro Spartans U18 Boys | 51.77 | 6 | 0.673 | 6.58 |
| 4 | D'Generals x Pro Dimes U18 Boys | 50.77 | 5 | 0.62 | 7.33 |
| 5 | Pria CPA Review Center U18 Boys | 49.29 | 4 | 0.495 | 9.07 |
| 6 | 1118 Autospa Dragons U18 Boys | 49.21 | 4 | 0.478 | 9.31 |

## Team preview: Philippine Youth Basketball Championship – 15U / U15 / BOYS

| rank | team | rating | games | confidence | uncertainty |
| --- | --- | --- | --- | --- | --- |
| 1 | San Pedro Spartans U15 Boys | 50.73 | 12 | 0.701 | 6.19 |
| 2 | Prime Ascencion Medical Supplies San Anton | 50.57 | 9 | 0.613 | 7.41 |
| 3 | Migrafix Doc Boleros | 50.54 | 10 | 0.643 | 7 |
| 4 | JPM-TEC San Beda U15 Boys | 50.4 | 9 | 0.613 | 7.41 |
| 5 | Smile 360 Bullies U15 Boys | 50.01 | 8 | 0.584 | 7.82 |
| 6 | LEV Construction Full Potential | 49.87 | 7 | 0.555 | 8.23 |
| 7 | JMTG Medical Trading Infinite | 49.5 | 8 | 0.584 | 7.82 |
| 8 | Migueluz Trading Moderno | 48.3 | 9 | 0.613 | 7.41 |

## Recommendation

Keep production unchanged. Resolve disconnected competition pools, review low-confidence competition profiles, define team-result-only handling, validate calibration on held-out games, and approve versioned storage/promotion before any write path is introduced.
