# Rating Reform Phase 1 Decision Brief

**Generated:** 2026-06-18  
**Status:** Read-only preview complete; no production writes performed.

## Decision

We can push forward with a **Phase 1 tier-normalized Formula v1 reform**, but only as the next controlled rating-policy candidate. Do **not** promote full vNext yet and do **not** execute a production recompute without explicit approval.

The current public board problem is real: Formula v1 lets circuit-heavy profiles compete directly against UAAP/NCAA-heavy profiles without a competition-strength adjustment. P0 transparency explains this; it does not fix the rating number.

## What I changed

- Added `scripts/rating-reformulation-tier-normalized-preview.ts`
- Added `npm run rating:reformulation:tier-preview`
- Corrected shadow vNext tier direction in `src/lib/ratings/formula-vnext/params.ts`
- Updated `docs/planning/RATING_FORMULA_VNEXT.md` to state the governance convention: tier 1 is strongest

All work is read-only/preparatory. No GPS, PlayerRating, RankingSnapshot, eligibility, or schema writes were made.

## Phase 1 candidate

Recommended first candidate: **Soft lower-tier discount**

| Tier | Meaning | Weight |
|------|---------|-------:|
| 1 | UAAP/NCAA flagship/highest current tier | 1.00 |
| 2 | Strong secondary | 0.97 |
| 3 | Circuit / lower competitive tier | 0.93 |
| 4 | Lowest tier | 0.90 |

This is intentionally more conservative than the earlier `1.40 / 1.10` simulation, which created excessive rating inflation and large board movement.

## Validation results

Preview artifact:

- `scripts/reports/rating-reformulation-tier-normalized-preview.md`
- `scripts/reports/rating-reformulation-tier-normalized-preview.json`

Method:

- Keep current public board membership fixed.
- Keep current eligibility fixed.
- Recalculate order using tier-normalized v1 game scores.
- No writes.

### Movement summary

| Board | Candidate | Avg abs rank delta | Avg abs rating delta | Top-10 churn | Top-25 churn |
|------|-----------|-------------------:|---------------------:|-------------:|-------------:|
| U19 Boys | Soft discount | 5.81 | 1.47 | 2 | 1 |
| U16 Boys | Soft discount | 3.61 | 1.52 | 3 | 2 |
| U19 Girls | Soft discount | 0.00 | 0.00 | 0 | 0 |
| U13 Boys | Soft discount | 0.00 | 4.01 | 0 | 0 |

### Lucas / UAAP sanity check

| Player | Current | Soft preview | Rating impact | Interpretation |
|--------|--------:|-------------:|--------------:|----------------|
| Jude Eriobu | #1 | #1 | 98.33 → 98.33 | UAAP anchor protected |
| Lucas Kaw | #2 | #4 | 93.98 → 87.40 | Circuit-heavy profile no longer reads as clear #2 |
| Josef Calo-oy | #4 | #2 | 93.10 → 93.10 | NCAA/flagship profile moves above circuit-heavy profiles |

This is the first candidate that directly addresses the concern: Lucas remains a strong player, but the board no longer implies he is better than every UAAP/NCAA player except Jude.

## Why not full vNext yet

Full vNext includes opponent strength, teammate context, playing-up/down, recency, shrinkage, and home-board accumulation. It is directionally right, but it is too much to activate in one step because:

- The previous high-multiplier tier simulation produced excessive churn.
- Opponent/program ratings need another validation pass.
- Global TypeScript currently fails on unrelated legacy scripts, so production recompute tooling should be cleaned before promotion.
- Ranking stakeholders should review named-player movement before a public board cutover.

## Recommended rollout

1. **Adopt Phase 1 candidate as the next dry-run policy.**
2. Add a write-path plan that would create a new policy/version row rather than overwrite Formula v1.
3. Run side-by-side public boards for stakeholder review:
   - Lucas Kaw
   - Jude Eriobu
   - Josef Calo-oy
   - Xyriel Macahipay
   - Prince Cariño
   - top 25 U19 Boys
   - top 25 U16 Boys
4. After approval, run a versioned recompute and generate fresh snapshots.
5. Keep P0 disclaimer until the tier-aware policy is actually public.

## Blockers before production

- Explicit approval required for any rating recompute or snapshot generation.
- Clean or isolate existing TypeScript failures in legacy scripts.
- Confirm final tier map with stakeholder language.
- Decide whether unknown-DOB provisional players should be allowed in the same public rank order after tier normalization, or displayed separately.

## Rollback plan

Rollback is simple at this stage:

1. Remove `rating:reformulation:tier-preview` from `package.json`.
2. Delete `scripts/rating-reformulation-tier-normalized-preview.ts`.
3. Revert the shadow-only tier direction edit in `src/lib/ratings/formula-vnext/params.ts` if needed.
4. No database rollback required because there were no writes.

If a future production recompute is approved, rollback must be version-based: switch public read paths back to `launch-v1`, preserve generated rows/snapshots for audit, and do not rewrite historical snapshots.

## Recommendation

**Proceed with Phase 1, not full vNext.**

The soft tier-normalized candidate is credible enough to move to stakeholder review and recompute planning. It fixes the specific Lucas/circuit-heavy credibility issue with limited top-board churn, while keeping the implementation smaller and easier to audit than full vNext.

## Execution update (2026-06-18)

Shadow policy rows were written after dry-run approval:

- Policy: `formula-v1-tier-normalized-soft-v1`
- Rows created: **938** (`npm run rating:tier-normalized:recompute:execute`)
- Public board: **unchanged** (still production v1 snapshots)
- Preview shadow board (U19 Boys rating pool):
  - Jude Eriobu: #1 → #1 (98.33)
  - Josef Calo-oy: #5 → #2 (93.10)
  - Lucas Kaw: #3 → #9 (93.98 → 87.40)
  - Greggy Calma: #2 → #5

To preview shadow ratings locally without changing production:

```env
PLAYER_RATING_FORMULA_MODE=shadow-tier-normalized-v1
```

Validation: `npm run rating:tier-normalized:validate`  
Artifacts: `scripts/reports/recompute-tier-normalized-v1-ratings.json`, `scripts/reports/tier-normalized-v1-promotion-validation.json`

**Not done yet:** snapshot regeneration, public cutover, GPS rewrite, or full vNext promotion.
