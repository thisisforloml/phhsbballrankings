-- G6 Player Rating Formula Versioning — DRAFT ONLY
-- Do NOT execute without explicit approval.
-- See docs/planning/RATING_FORMULA_VERSIONING_PLAN.md

-- 1) GamePerformanceScore: allow multiple formula versions per game stat
ALTER TABLE game_performance_scores DROP CONSTRAINT IF EXISTS game_performance_scores_gameStatId_key;
CREATE UNIQUE INDEX IF NOT EXISTS game_performance_scores_game_stat_formula_unique
  ON game_performance_scores ("gameStatId", "formulaVersionId");

-- 2) PlayerRating: add formula + policy version columns
ALTER TABLE player_ratings
  ADD COLUMN IF NOT EXISTS "formulaVersionId" UUID,
  ADD COLUMN IF NOT EXISTS "policyVersionId" TEXT;

-- Backfill existing rows to Formula v1
UPDATE player_ratings pr
SET "formulaVersionId" = fv.id
FROM formula_versions fv
WHERE fv."versionNumber" = 1
  AND pr."formulaVersionId" IS NULL;

ALTER TABLE player_ratings
  ALTER COLUMN "formulaVersionId" SET NOT NULL;

ALTER TABLE player_ratings
  ADD CONSTRAINT player_ratings_formula_version_id_fkey
  FOREIGN KEY ("formulaVersionId") REFERENCES formula_versions(id);

DROP INDEX IF EXISTS player_ratings_player_id_age_group_key;
CREATE UNIQUE INDEX IF NOT EXISTS player_ratings_player_age_formula_unique
  ON player_ratings ("playerId", "ageGroup", "formulaVersionId");

CREATE INDEX IF NOT EXISTS player_ratings_formula_age_rating_idx
  ON player_ratings ("formulaVersionId", "ageGroup", "adjustedRating");

-- 3) RankingSnapshot: policy provenance (ADR-013)
ALTER TABLE ranking_snapshots
  ADD COLUMN IF NOT EXISTS "policyVersionId" TEXT;
