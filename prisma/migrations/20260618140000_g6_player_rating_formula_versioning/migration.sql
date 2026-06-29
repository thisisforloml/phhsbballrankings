-- G6: Player rating formula + policy versioning (ADR-010, ADR-013)

-- GamePerformanceScore: allow one row per gameStat per formula version
DROP INDEX IF EXISTS "game_performance_scores_gameStatId_key";
CREATE UNIQUE INDEX "game_performance_scores_gameStatId_formulaVersionId_key"
  ON "game_performance_scores"("gameStatId", "formulaVersionId");

-- PlayerRating: versioned by formula + policy
ALTER TABLE "player_ratings" ADD COLUMN IF NOT EXISTS "formulaVersionId" UUID;
ALTER TABLE "player_ratings" ADD COLUMN IF NOT EXISTS "policyVersionId" TEXT NOT NULL DEFAULT 'formula-v1-production';

UPDATE "player_ratings" pr
SET "formulaVersionId" = fv.id
FROM "formula_versions" fv
WHERE fv."versionNumber" = 1
  AND pr."formulaVersionId" IS NULL;

ALTER TABLE "player_ratings" ALTER COLUMN "formulaVersionId" SET NOT NULL;

ALTER TABLE "player_ratings"
  ADD CONSTRAINT "player_ratings_formulaVersionId_fkey"
  FOREIGN KEY ("formulaVersionId") REFERENCES "formula_versions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX IF EXISTS "player_ratings_playerId_ageGroup_key";
CREATE UNIQUE INDEX "player_ratings_playerId_ageGroup_formulaVersionId_policyVersionId_key"
  ON "player_ratings"("playerId", "ageGroup", "formulaVersionId", "policyVersionId");

CREATE INDEX "player_ratings_formulaVersionId_policyVersionId_ageGroup_adjustedRating_idx"
  ON "player_ratings"("formulaVersionId", "policyVersionId", "ageGroup", "adjustedRating");

-- RankingSnapshot: policy provenance
ALTER TABLE "ranking_snapshots" ADD COLUMN IF NOT EXISTS "policyVersionId" TEXT;
