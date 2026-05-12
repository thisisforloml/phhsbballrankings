-- Add persistent identity fields for ranking snapshots.
-- ranking_snapshots currently has zero rows, so required columns are safe.

DROP INDEX IF EXISTS "ranking_snapshots_scope_ageGroup_city_region_weekOf_idx";
DROP INDEX IF EXISTS "ranking_snapshots_weekOf_idx";

ALTER TABLE "ranking_snapshots"
  ADD COLUMN "gender" "PlayerGender" NOT NULL,
  ADD COLUMN "formulaVersionId" UUID NOT NULL;

ALTER TABLE "ranking_snapshots"
  ADD CONSTRAINT "ranking_snapshots_formulaVersionId_fkey"
  FOREIGN KEY ("formulaVersionId") REFERENCES "formula_versions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "ranking_snapshots_scope_ageGroup_gender_city_region_weekOf_idx"
  ON "ranking_snapshots"("scope", "ageGroup", "gender", "city", "region", "weekOf");

CREATE INDEX "ranking_snapshots_formulaVersionId_idx"
  ON "ranking_snapshots"("formulaVersionId");

CREATE INDEX "ranking_snapshots_weekOf_idx"
  ON "ranking_snapshots"("weekOf");
