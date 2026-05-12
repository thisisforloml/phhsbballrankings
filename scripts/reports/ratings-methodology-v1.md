# Ratings Methodology v1

## Purpose

Formula v1 is a transparent baseline model for converting one player box score into a possession-informed Raw Game Value, then scaling that value into a 1-100 rating.

Formula v1 is not the final scientific model. It is designed to be explainable, auditable, and conservative while the dataset is still early. Later formula versions should be calibrated statistically using larger historical data, cross-league validation, and predictive testing.

## Data-Derived Inputs

Formula v1 uses league-season context derived from the available box scores.

For each comparison pool, compute:

```text
LeaguePossessions = FGA - OREB + TOV + 0.44 * FTA
LeaguePPP = Points / LeaguePossessions
LeagueDefRebRate = DREB / (DREB + OpponentOREB)
LeagueOffRebRate = OREB / (OREB + OpponentDREB)
```

The comparison pool should initially be:

```text
same ageGroup + same gender + same league-season
```

For the current UAAP Season 88 HS dataset, boys and girls should be evaluated in separate pools.

## Temporary Formula v1 Assumptions

Formula v1 uses these temporary assumptions:

```text
assistCreationShare = 0.35
blockRetentionFactor = 0.60
stealFactor = 1.00
foulDrawnFactor = 0.35
foulCostFactor = 0.35
offensiveReboundValueFactor = 1.00
```

These values are conservative and subject to recalibration:

- `assistCreationShare = 0.35` gives partial creation credit for assists without double-counting the made basket already captured in points.
- `blockRetentionFactor = 0.60` values blocks below steals because blocks do not always end possessions.
- `stealFactor = 1.00` treats steals as full possession-gain events.
- `foulDrawnFactor = 0.35` gives modest positive credit for drawing fouls without assuming every foul drawn creates a full possession of value.
- `foulCostFactor = 0.35` gives modest negative credit for committing fouls without trying to infer exact free throw consequences from incomplete foul context.
- `offensiveReboundValueFactor = 1.00` values offensive rebounds as possession extensions.

Formula v1 does not use `LeagueFTPointsPerFoul = FTM / PF`.

## Box Score Derived Fields

For each `GameStat` row:

```text
missedFG = FGA - FGM
missedFT = FTA - FTM
twoMade = FGM - 3PM
twoAttempt = FGA - 3PA
```

Efficiency fields:

```text
eFG% = (FGM + 0.5 * 3PM) / FGA
```

If `FGA = 0`, then `eFG% = null`.

```text
TS% = PTS / (2 * (FGA + 0.44 * FTA))
```

If `FGA + 0.44 * FTA = 0`, then `TS% = null`.

## Required Fields

For the current UAAP Season 88 HS dataset, the source includes these fields, so Formula v1 should require them and should not silently default them to `0`:

- `STL`
- `BLK`
- `TOV`
- `PF`
- `FD`

If any of those fields are missing in this dataset, the row should be flagged and skipped from Formula v1 processing until corrected.

The following core fields are also required:

- `PTS`
- `FGM`
- `FGA`
- `3PM`
- `3PA`
- `FTM`
- `FTA`
- `OREB`
- `DREB`
- `TRB`
- `AST`

## Exact RawGameValue Equation

Formula v1:

```text
RawGameValue =
  PTS
  + (OREB * LeaguePPP * offensiveReboundValueFactor)
  + (DREB * LeaguePPP * LeagueOffRebRate)
  + (AST * LeaguePPP * assistCreationShare)
  + (STL * LeaguePPP * stealFactor)
  + (BLK * LeaguePPP * blockRetentionFactor)
  + (FD * LeaguePPP * foulDrawnFactor)
  - (missedFG * LeaguePPP * LeagueDefRebRate)
  - (missedFT * 0.44 * LeaguePPP)
  - (TOV * LeaguePPP)
  - (PF * LeaguePPP * foulCostFactor)
```

Component rationale:

- `PTS` gives direct scoreboard credit.
- `OREB` extends possessions and is valued as a possession recovery.
- `DREB` ends opponent possessions, but is valued through `LeagueOffRebRate` because defensive rebounds are less scarce than offensive rebounds.
- `AST` receives partial creation credit and avoids double-counting scoring.
- `STL` is a clean possession gain.
- `BLK` is positive but discounted because the defense does not always recover the ball.
- `FD` is positive but conservative because foul context is incomplete.
- `missedFG` is negative based on the likelihood that the defense secures the rebound.
- `missedFT` is negative using the standard `0.44` free throw possession factor.
- `TOV` is negative as a direct lost possession.
- `PF` is negative but conservative because exact foul consequences are not inferred in v1.

## Scaling To 1-100

Raw Game Value should be scaled by percentile within the comparison pool.

```text
percentile = rankPercentile(RawGameValue within pool)
ScaledGameScore = 1 + percentile * 99
```

The result is bounded from `1` to `100`.

Percentile scaling is recommended for v1 because the current dataset is small and may not be normally distributed. It is also easier to explain: a score reflects where a performance sits relative to the current comparison pool.

## Storage Mapping

### FormulaVersion

Create or reuse a Formula v1 record:

```text
versionNumber = 1
description = "Formula v1 possession-informed transparent baseline box-score model"
isPublic = false
weights = {
  "assistCreationShare": 0.35,
  "blockRetentionFactor": 0.60,
  "stealFactor": 1.00,
  "foulDrawnFactor": 0.35,
  "foulCostFactor": 0.35,
  "offensiveReboundValueFactor": 1.00,
  "scaling": "percentile",
  "leagueWeight": 1.000,
  "opponentFactor": 1.000,
  "teamFactor": 1.000
}
```

### GamePerformanceScore

For each eligible player-game:

```text
productionScore = RawGameValue
leagueWeight = 1.000
opponentFactor = 1.000
teamFactor = 1.000
performanceScore = ScaledGameScore
formulaVersionTag = 1
effectiveFieldGoalPct = eFG%
trueShootingPct = TS%
finalPerformanceScore = ScaledGameScore
processedAt = now
```

Formula v1 must keep:

```text
leagueWeight = 1.000
opponentFactor = 1.000
teamFactor = 1.000
```

### PlayerRating

For each player:

```text
observedRating = average ScaledGameScore across eligible games
adjustedRating = observedRating for initial internal v1, or shrinkage-adjusted rating in a later phase
verifiedGameCount = count of eligible games
starRating = fixed band conversion from adjustedRating
```

Public ranking eligibility should remain separate from internal rating computation. Players below the public game-count minimum can have internal/provisional ratings but should not appear in official public rankings.

### Formula v1 Star Rating Bands

Formula v1 converts `adjustedRating` into `starRating` using fixed transparent rating bands:

```text
rating < 60 = 1 star
rating >= 60 and < 70 = 2 stars
rating >= 70 and < 80 = 3 stars
rating >= 80 and < 90 = 4 stars
rating >= 90 and <= 100 = 5 stars
```

These bands are intentionally simple for launch-stage public communication. They replace the earlier percentile-based internal star conversion while keeping the underlying `adjustedRating` sorted by rating value. Future versions can recalibrate star thresholds using larger historical samples and outcome validation.

## Exclusions From Formula v1

Formula v1 must not include:

- Plus-minus
- Strong opponent factor
- Strong team factor
- Hardcoded league boost
- Hardcoded league preference
- Manual stat weights unrelated to possession value
- Percentile-based star thresholds for Formula v1 PlayerRating
- Ratings from invalid or incomplete source rows

Plus-minus is excluded because it is lineup-dependent and noisy in small samples.

Opponent, team, and league factors are fixed at `1.000` in v1 to avoid over-adjusting before enough data exists for calibration.

## Future Calibration Plan

Later formula versions should replace temporary assumptions with statistically calibrated values.

Recommended future calibration steps:

1. Validate whether Raw Game Value predicts future player performance.
2. Compare ratings against later cross-league performance.
3. Estimate league quality using connected games, common opponents, and player movement.
4. Add opponent adjustment only after stable team ratings exist.
5. Add team context only after role, usage, and team strength can be separated.
6. Test z-score scaling once the dataset is large enough and distributions are stable.
7. Calibrate star thresholds against long-term player outcomes.
8. Consider regularized plus-minus or lineup-adjusted models if lineup/play-by-play data becomes available.

