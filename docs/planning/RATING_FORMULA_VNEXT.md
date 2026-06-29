# Rating Formula vNext — Methodology Specification

**Status:** Shadow / design — not approved for production  
**Policy ID:** `rating-formula-vnext-shadow-v1`  
**Effective:** Read-only preview until calibration and explicit approval

---

## 1. Purpose

Formula vNext reformulates player ratings so public boards reflect **calendar-age home brackets** while incorporating statistically bounded context from:

1. Box score (primary signal)
2. Opponent strength (team/program rating)
3. Teammate/team context
4. Advanced metrics (supporting, non-double-counted)
5. Age (home bracket, playing up/down)

Production Formula v1 remains unchanged until shadow validation passes and an explicit recompute is approved.

---

## 2. Two-Layer Architecture

### Layer A — Game Score (per player-game)

**Input:** Verified `GameStat` + Formula v1 `finalPerformanceScore` as `baseGameScore`.

**Context adjustments (multiplicative + bounded additive):**

```
adjustedGameScore = min(100,
  baseGameScore × opponentFactor × teamFactor × leagueWeight × ageFactor
  + advancedBonus
)
effectiveWeight = recencyWeight × playingDownDiscount
```

| Factor | Source | Bounds |
|--------|--------|--------|
| `opponentFactor` | `ProgramTeamRating` for opponent program | 0.85 – 1.15 |
| `teamFactor` | Teammate avg base score vs player prior rating | 0.90 – 1.10 |
| `leagueWeight` | `League.tier` (tier 1 strongest) | 1.0 – 1.4 |
| `ageFactor` | Playing up (+8%/year) or playing down (−6%/year) | 0.88 – 1.24 |
| `advancedBonus` | PER, WS, PIE, eFG%, TS% composite | −5 – +10 |
| `recencyWeight` | Days since game | 0.6 – 1.0 |

Initial shadow defaults follow governance tier direction: tier 1 → 1.40, tier 2 → 1.25, tier 3 → 1.10, tier 4 → 1.00. These remain shadow-only until validation and explicit production recompute approval.

### Layer B — Player Rating (per home bracket)

**Home board** = calendar age bracket as of evaluation date (`getRankingAgeBracket`).

Games accumulate into the player's **home bracket** regardless of competition age group when evidence role is `HOME` or `PLAYING_UP`.

```
observedRating = Σ(adjustedGameScore × effectiveWeight) / Σ(effectiveWeight)
adjustedRating = (n × observed + k × boardMean) / (n + k)   // shrinkage
```

| Parameter | Boys | Girls |
|-----------|------|-------|
| Shrinkage prior games `k` | 10 | 5 |

**Rating basis labels:**

| Label | Condition |
|-------|-----------|
| `DIRECT` | All games at home competition level |
| `PROJECTED` | All games playing up |
| `BLENDED` | Mix of home and playing up |

---

## 3. Target Variable (Calibration)

**Primary target:** Next-game `baseGameScore` within the same player (temporal holdout).

**Secondary targets:**

- Rank stability (Spearman ρ > 0.85 vs v1 on mature-game players)
- Low-game volatility reduction (≤3-game players move less than ±8 rating points vs v1)
- Cross-bracket limbo resolution (playing-up players gain home-board rating)

Coefficients are tuned to minimize holdout MAE, subject to stability constraints.

---

## 4. Validation Metrics

| Metric | Threshold (initial gate) |
|--------|--------------------------|
| Holdout MAE (next game) | ≤ v1 MAE or within +0.5 |
| Rank stability (≥10 games) | Spearman ρ ≥ 0.85 |
| Top-10 movement | ≤ 3 players per board |
| Low-game rating std dev | Decrease vs v1 |
| Limbo cases resolved | 100% of playing-up + qualified |

---

## 5. Statistical Guardrails

1. **No arbitrary weights** — all multipliers start from v1/TPI/ADR defaults; calibration script fits bounded adjustments.
2. **Regularization** — ridge penalty on coefficient deviations from defaults.
3. **Segmentation** — calibrate per age group + gender where n ≥ 30 games.
4. **Prospective-only** — policy changes versioned; historical snapshots immutable (ADR-007, ADR-013).
5. **No production writes** until shadow reports approved.

---

## 6. Factor Hierarchy (Precedence)

1. Verified evidence gate (official games only)
2. Box score base game score (Formula v1 GPS)
3. Opponent/program strength
4. Teammate opportunity context
5. League tier
6. Age playing-up/down
7. Advanced metric bonus (capped)
8. Recency weighting
9. Shrinkage to board mean

---

## 7. Explicit Non-Goals (vNext Shadow v1)

- Position-specific models (await position coverage)
- Minutes-normalized per-minute ratings (await minutes coverage)
- Formula v2 full replacement (coexists; vNext is policy layer on v1 GPS)
- Public board switch (requires approval after calibration)

---

## 8. Implementation References

| Component | Path |
|-----------|------|
| Shadow library | `src/lib/ratings/formula-vnext/` |
| Baseline audit | `scripts/rating-reformulation-baseline-audit.ts` |
| Shadow preview | `scripts/rating-reformulation-shadow-preview.ts` |
| Calibration | `scripts/rating-reformulation-calibration.ts` |
| Versioning plan | `docs/planning/RATING_FORMULA_VERSIONING_PLAN.md` |

---

## 9. Related ADRs

| ADR | Relationship |
|-----|--------------|
| ADR-008 | Extends accumulation to home-board + cross-bracket evidence |
| ADR-009 | Playing-up projection aligns with carryover prior concept |
| ADR-012 | League tier applied once at game layer |
| ADR-004 | Override cross-bracket becomes rating-affecting via projection |

---

## 10. Approval Gates Before Production

- [ ] Baseline audit reviewed
- [ ] Calibration report meets validation thresholds
- [ ] Side-by-side board movement reviewed by rankings architect
- [ ] Schema versioning plan executed (G6)
- [ ] Explicit user approval for recompute
