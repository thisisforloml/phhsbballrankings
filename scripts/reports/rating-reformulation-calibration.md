# Rating Reformulation Calibration Report

Generated: 2026-06-18T07:09:57.926Z

## Holdout (next-game prediction)

| Model | MAE |
|-------|-----|
| v1 baseline (raw base score) | 22.866 |
| vNext calibrated | 26.198 |
| Improvement | -3.332 |

## Calibrated Parameters

| Parameter | Default | Calibrated |
|-----------|---------|------------|
| opponentSlope | 0.0025 | 0.00125 |
| playingUpPerYear | 0.08 | 0.08 |

## Rank Stability (≥10 games)

- Mature players: 421
- Spearman ρ: 0.964
- Passes gate (≥0.85): YES

## Recommendation

Calibrated params need review — do not promote to production

Read-only. No database writes.
