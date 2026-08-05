# Rating Ecosystem vNext Preview

Generated: 2026-08-05T16:00:52.741Z

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
  "playerRatings": 1395
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
  "allCompetitionProfilesConfident": true,
  "readyForProduction": false
}
```

## Competition strength

| competition | strength | confidence | games | teams | players | crossover | tier | provisional | highQuality |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| NCAA Season 101 Junior's Basketball / U19 / BOYS | 95.9 | 1 | 81 | 10 | 136 | 29 | 1 | false | true |
| UAAP Season 88 HS Boys Basketball / U19 / BOYS | 94.92 | 1 | 62 | 8 | 97 | 21 | 1 | false | true |
| UAAP Season 88 HS Girls Basketball / U19 / GIRLS | 89.2 | 0.688 | 14 | 4 | 56 | 0 | 1 | false | true |
| Philippine Youth Basketball Championship – 18U / U18 / BOYS | 88.88 | 0.791 | 15 | 6 | 99 | 29 | 1 | false | true |
| UAAP Season 88 16U Boys Basketball / U16 / BOYS | 84.2 | 1 | 60 | 8 | 118 | 25 | 2 | false | true |
| Junior MPBL Season 4 – 18U / U18 / BOYS | 75.84 | 1 | 48 | 23 | 534 | 64 | 2 | false | false |
| Stallion Cup - 18U / U18 / BOYS | 74.8 | 0.909 | 25 | 7 | 81 | 52 | 2 | false | false |
| Philippine Youth Basketball Championship – 13U / U13 / BOYS | 67 | 0.75 | 35 | 8 | 129 | 0 | 3 | false | false |
| Stallion Cup – 17U / U17 / BOYS | 66.26 | 0.981 | 30 | 8 | 81 | 65 | 3 | false | false |
| Stallion Cup – 17U / U17 / BOYS | 63.41 | 1 | 32 | 8 | 96 | 74 | 3 | false | false |
| Stallion Cup – 17U / U17 / BOYS | 63.07 | 0.909 | 25 | 7 | 83 | 55 | 3 | false | false |
| Philippine Youth Basketball Championship – 15U / U15 / BOYS | 62.45 | 0.896 | 36 | 8 | 133 | 7 | 3 | false | false |

## Connectivity

| board | pools | currentBoardPools | carryoverPools | crossoverPlayers | connectedComponents | connected |
| --- | --- | --- | --- | --- | --- | --- |
| U19\|BOYS | 10 | 8 | 2 | 140 | 1 | true |
| U16\|BOYS | 7 | 2 | 5 | 0 | 2 | false |
| U13\|BOYS | 1 | 1 | 0 | 0 | 1 | true |
| U19\|GIRLS | 1 | 1 | 0 | 0 | 1 | true |

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

Candidate players: 236; quality-eligible: 96; five-stars: 1; exact 89.99 ceiling pileup: 0.

### Production vs Formula v3.3

| rank | production | productionRating | candidate | candidateRating |
| --- | --- | --- | --- | --- |
| 1 | Goodluck Okebata | 96.58 | Goodluck Okebata | 93.09 |
| 2 | Prince Cariño | 92.5 | Moussa Diakite | 89.33 |
| 3 | Moussa Diakite | 89.91 | Francel Flores | 79.89 |
| 4 | Francel Flores | 88.11 | Mark Perdigon | 77.46 |
| 5 | Xyriel Macahipay | 84.13 | CJ Tabbuga | 75.59 |
| 6 | Akhiro Franz Reynon | 83.78 | Gab Castro | 75.16 |
| 7 | Denden Enriquez | 83.14 | Keefe Iledan | 75.12 |
| 8 | Keefe Iledan | 82.19 | Akhiro Franz Reynon | 73.98 |
| 9 | Sky Jazul | 81.13 | Rowie Cabañero | 72.91 |
| 10 | CJ Tabbuga | 80.41 | Lorenzo Purugganan | 72.91 |

### Formula v3.3 evidence detail

| rank | player | estimatedRating | rating | uncertainty | range | games | qualityGames | confidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Goodluck Okebata | 93.84 | 93.09 | 1.5 | 90.15-96.03 | 14 | 12.56 | ESTABLISHED |
| 2 | Moussa Diakite | 90.43 | 89.33 | 2.21 | 85-93.65 | 33 | 30.8 | ESTABLISHED |
| 3 | Francel Flores | 81.33 | 79.89 | 2.88 | 74.24-85.54 | 28 | 26.1 | ESTABLISHED |
| 4 | Mark Perdigon | 79.1 | 77.46 | 3.27 | 71.05-83.87 | 14 | 12.56 | ESTABLISHED |
| 5 | CJ Tabbuga | 79.05 | 75.59 | 6.92 | 62.02-89.15 | 15 | 13.46 | ESTABLISHED |
| 6 | Gab Castro | 77.89 | 75.16 | 5.46 | 64.45-85.86 | 15 | 13.46 | ESTABLISHED |
| 7 | Keefe Iledan | 77.25 | 75.12 | 4.25 | 66.79-83.45 | 25 | 23.13 | ESTABLISHED |
| 8 | Akhiro Franz Reynon | 76.62 | 73.98 | 5.27 | 63.65-84.31 | 15 | 11.69 | ESTABLISHED |
| 9 | Rowie Cabañero | 75.75 | 72.91 | 5.68 | 61.77-84.04 | 17 | 15.31 | ESTABLISHED |
| 10 | Lorenzo Purugganan | 76.35 | 72.91 | 6.89 | 59.4-86.42 | 14 | 12.56 | ESTABLISHED |

## U19 Boys

Candidate players: 975; quality-eligible: 258; five-stars: 5; exact 89.99 ceiling pileup: 0.

### Production vs Formula v3.3

| rank | production | productionRating | candidate | candidateRating |
| --- | --- | --- | --- | --- |
| 1 | Jude Eriobu | 98.33 | Jude Eriobu | 98.33 |
| 2 | Josef Calo-oy | 91.82 | Mark Esperanza | 94.09 |
| 3 | Mark Esperanza | 90.61 | Josef Calo-oy | 92.35 |
| 4 | Sean Franco | 88.82 | Steven Creus | 91.79 |
| 5 | Steven Creus | 88.41 | Xyriel Macahipay | 90.01 |
| 6 | John Ray Ladica | 88.34 | Jetlee Melano | 89.29 |
| 7 | Cabs Cabonilas | 88.19 | Yuan Ramirez | 87.93 |
| 8 | Lucas Kaw | 87.4 | Lucas Kaw | 87.19 |
| 9 | Moussa Diakite | 87.27 | Patrick Pasinos | 85 |
| 10 | Maco Dabao | 87.15 | Jaime Teodoro | 83.75 |

### Formula v3.3 evidence detail

| rank | player | estimatedRating | rating | uncertainty | range | games | qualityGames | confidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Jude Eriobu | 99.08 | 98.33 | 1.5 | 95.39-100 | 16 | 15.47 | ESTABLISHED |
| 2 | Mark Esperanza | 95.18 | 94.09 | 2.17 | 89.83-98.35 | 12 | 11.68 | ESTABLISHED |
| 3 | Josef Calo-oy | 93.1 | 92.35 | 1.5 | 89.41-95.29 | 22 | 20.37 | ESTABLISHED |
| 4 | Steven Creus | 93.07 | 91.79 | 2.55 | 86.79-96.79 | 14 | 13.63 | ESTABLISHED |
| 5 | Xyriel Macahipay | 91.22 | 90.01 | 2.43 | 85.25-94.77 | 16 | 15.44 | ESTABLISHED |
| 6 | Jetlee Melano | 90.39 | 89.29 | 2.19 | 85-93.59 | 14 | 13.54 | ESTABLISHED |
| 7 | Yuan Ramirez | 88.68 | 87.93 | 1.5 | 84.99-90.87 | 22 | 17.49 | ESTABLISHED |
| 8 | Lucas Kaw | 87.94 | 87.19 | 1.5 | 84.25-90.13 | 22 | 17.19 | ESTABLISHED |
| 9 | Patrick Pasinos | 86.68 | 85 | 3.37 | 78.39-91.61 | 19 | 17.84 | ESTABLISHED |
| 10 | Jaime Teodoro | 85.03 | 83.75 | 2.56 | 78.73-88.76 | 22 | 20.37 | ESTABLISHED |

## U19 Girls

Candidate players: 56; quality-eligible: 45; five-stars: 0; exact 89.99 ceiling pileup: 0.

### Production vs Formula v3.3

| rank | production | productionRating | candidate | candidateRating |
| --- | --- | --- | --- | --- |
| 1 | Aubrey Lapasaran | 89.8 | Aubrey Lapasaran | 89.05 |
| 2 | Adin Rosano | 87.7 | Adin Rosano | 85.88 |
| 3 | Riri Perez | 87.44 | Riri Perez | 84.6 |
| 4 | Janice Oczon | 78.92 | Pia Petalcorin | 76.56 |
| 5 | Pia Petalcorin | 78.31 | Janice Oczon | 76.3 |
| 6 | Lea Pinuela | 77.91 | Lea Pinuela | 75.26 |
| 7 | Koukou Talla | 74.99 | Koukou Talla | 71.89 |
| 8 | Apyang Dulay | 74.6 | Apyang Dulay | 71.58 |
| 9 | Ima Navarro | 72.7 | Ruiza Olmos | 70.53 |
| 10 | Ruiza Olmos | 71.84 | Ima Navarro | 68.37 |

### Formula v3.3 evidence detail

| rank | player | estimatedRating | rating | uncertainty | range | games | qualityGames | confidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Aubrey Lapasaran | 90.69 | 89.05 | 3.28 | 82.63-95.48 | 8 | 7.44 | DEVELOPING |
| 2 | Adin Rosano | 87.64 | 85.88 | 3.52 | 78.99-92.77 | 8 | 7.44 | DEVELOPING |
| 3 | Riri Perez | 87.36 | 84.6 | 5.53 | 73.76-95.44 | 8 | 7.44 | DEVELOPING |
| 4 | Pia Petalcorin | 78.9 | 76.56 | 4.68 | 67.39-85.74 | 7 | 6.51 | DEVELOPING |
| 5 | Janice Oczon | 79.7 | 76.3 | 6.8 | 62.96-89.63 | 8 | 7.44 | DEVELOPING |
| 6 | Lea Pinuela | 78.23 | 75.26 | 5.94 | 63.62-86.9 | 8 | 7.44 | DEVELOPING |
| 7 | Koukou Talla | 75.85 | 71.89 | 7.93 | 56.35-87.43 | 8 | 7.44 | DEVELOPING |
| 8 | Apyang Dulay | 75.8 | 71.58 | 8.46 | 55-88.15 | 6 | 5.58 | DEVELOPING |
| 9 | Ruiza Olmos | 72.66 | 70.53 | 4.27 | 62.17-78.89 | 8 | 7.44 | DEVELOPING |
| 10 | Ima Navarro | 72.42 | 68.37 | 8.11 | 52.48-84.26 | 6 | 5.58 | DEVELOPING |

## Team preview: Junior MPBL Season 4 – 18U / U18 / BOYS

| rank | team | rating | games | confidence | uncertainty |
| --- | --- | --- | --- | --- | --- |
| 1 | San Juan U19 Boys | 52.68 | 8 | 0.766 | 5.27 |
| 2 | Antipolo U19 Boys | 51.87 | 3 | 0.374 | 10.76 |
| 3 | N. Ecija U19 Boys | 51.79 | 4 | 0.498 | 9.02 |
| 4 | Palawan U19 Boys | 51.79 | 4 | 0.489 | 9.15 |
| 5 | Valenzuela U19 Boys | 51.35 | 4 | 0.484 | 9.23 |
| 6 | Batangas U19 Boys | 51.22 | 6 | 0.666 | 6.67 |
| 7 | San Pedro Spartans U18 Boys | 51.22 | 6 | 0.672 | 6.59 |
| 8 | Biñan U19 Boys | 50.49 | 3 | 0.365 | 10.89 |
| 9 | Muntinlupa U19 Boys | 50.41 | 4 | 0.497 | 9.04 |
| 10 | Bulacan U19 Boys | 50.39 | 5 | 0.597 | 7.65 |

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
| 1 | NUNS Bullpups 16U | 53.79 | 16 | 0.818 | 4.55 |
| 2 | FEU - Diliman Baby Tamaraws 16U | 52.41 | 18 | 0.877 | 3.73 |
| 3 | UST Tiger Cubs 16U | 52.4 | 15 | 0.789 | 4.96 |
| 4 | Adamson Baby Falcons 16U | 52.23 | 15 | 0.789 | 4.96 |
| 5 | UE Junior Warriors 16U | 51.81 | 14 | 0.76 | 5.37 |
| 6 | Ateneo Blue Eaglets 16U | 50.65 | 14 | 0.76 | 5.37 |
| 7 | De La Salle Zobel Junior Archers 16U | 49.12 | 14 | 0.76 | 5.37 |
| 8 | UP Junior Fighting Maroons 16U | 49.08 | 14 | 0.76 | 5.37 |

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
| 1 | NUNS Bullpups | 54.67 | 18 | 0.959 | 2.57 |
| 2 | Ateneo Blue Eaglets | 53.82 | 16 | 0.879 | 3.69 |
| 3 | FEU - Diliman Baby Tamaraws | 53.63 | 19 | 0.996 | 2.05 |
| 4 | UE Junior Warriors | 51.81 | 14 | 0.805 | 4.73 |
| 5 | De La Salle Zobel Junior Archers | 51.79 | 15 | 0.842 | 4.21 |
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
| 1 | Mapúa Red Robins | 52.72 | 5 | 0.601 | 7.58 |
| 2 | Grupong Bedista - San Beda U18 Boys | 51.83 | 6 | 0.674 | 6.56 |
| 3 | San Pedro Spartans U18 Boys | 51.83 | 6 | 0.673 | 6.58 |
| 4 | D'Generals x Pro Dimes U18 Boys | 50.83 | 5 | 0.62 | 7.33 |
| 5 | Pria CPA Review Center U18 Boys | 49.34 | 4 | 0.495 | 9.08 |
| 6 | 1118 Autospa Dragons U18 Boys | 49.26 | 4 | 0.478 | 9.31 |

## Team preview: Philippine Youth Basketball Championship – 15U / U15 / BOYS

| rank | team | rating | games | confidence | uncertainty |
| --- | --- | --- | --- | --- | --- |
| 1 | San Pedro Spartans U15 Boys | 50.5 | 12 | 0.701 | 6.19 |
| 2 | Prime Ascencion Medical Supplies San Anton | 50.37 | 9 | 0.613 | 7.41 |
| 3 | Migrafix Doc Boleros | 50.32 | 10 | 0.643 | 7 |
| 4 | JPM-TEC San Beda U15 Boys | 50.2 | 9 | 0.613 | 7.41 |
| 5 | Smile 360 Bullies U15 Boys | 49.82 | 8 | 0.584 | 7.82 |
| 6 | LEV Construction Full Potential | 49.7 | 7 | 0.555 | 8.23 |
| 7 | JMTG Medical Trading Infinite | 49.31 | 8 | 0.584 | 7.82 |
| 8 | Migueluz Trading Moderno | 48.09 | 9 | 0.613 | 7.41 |

## Recommendation

Keep production unchanged. Resolve disconnected competition pools, review low-confidence competition profiles, define team-result-only handling, validate calibration on held-out games, and approve versioned storage/promotion before any write path is introduced.
