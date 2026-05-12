-- Safely replace AgeGroup enum values U13/U16/U18/U22 with U13/U16/U19.
-- Existing U18 rows are migrated to U19. U22 is intentionally unsupported for this version.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "leagues" WHERE "ageGroup" = 'U22'::"AgeGroup") THEN
    RAISE EXCEPTION 'Cannot remove AgeGroup U22: leagues table still contains U22 rows.';
  END IF;

  IF EXISTS (SELECT 1 FROM "player_ratings" WHERE "ageGroup" = 'U22'::"AgeGroup") THEN
    RAISE EXCEPTION 'Cannot remove AgeGroup U22: player_ratings table still contains U22 rows.';
  END IF;

  IF EXISTS (SELECT 1 FROM "ranking_snapshots" WHERE "ageGroup" = 'U22'::"AgeGroup") THEN
    RAISE EXCEPTION 'Cannot remove AgeGroup U22: ranking_snapshots table still contains U22 rows.';
  END IF;
END $$;

ALTER TYPE "AgeGroup" RENAME TO "AgeGroup_old";

CREATE TYPE "AgeGroup" AS ENUM ('U13', 'U16', 'U19');

ALTER TABLE "leagues"
  ALTER COLUMN "ageGroup" TYPE "AgeGroup"
  USING (
    CASE
      WHEN "ageGroup"::text = 'U18' THEN 'U19'
      ELSE "ageGroup"::text
    END
  )::"AgeGroup";

ALTER TABLE "player_ratings"
  ALTER COLUMN "ageGroup" TYPE "AgeGroup"
  USING (
    CASE
      WHEN "ageGroup"::text = 'U18' THEN 'U19'
      ELSE "ageGroup"::text
    END
  )::"AgeGroup";

ALTER TABLE "ranking_snapshots"
  ALTER COLUMN "ageGroup" TYPE "AgeGroup"
  USING (
    CASE
      WHEN "ageGroup"::text = 'U18' THEN 'U19'
      ELSE "ageGroup"::text
    END
  )::"AgeGroup";

DROP TYPE "AgeGroup_old";
