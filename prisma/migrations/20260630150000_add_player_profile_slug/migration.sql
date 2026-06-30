-- Add indexed profile slug for /players/[slug] lookups.
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "profile_slug" TEXT;

-- Backfill only unambiguous slugs (matches legacy resolvePlayerIdBySlug single-match rule).
WITH computed AS (
  SELECT
    id,
    trim(both '-' from regexp_replace(lower("displayName"), '[^a-z0-9]+', '-', 'g')) AS slug
  FROM "players"
  WHERE "deletedAt" IS NULL
),
unique_slugs AS (
  SELECT slug
  FROM computed
  WHERE slug <> ''
  GROUP BY slug
  HAVING count(*) = 1
)
UPDATE "players" AS p
SET "profile_slug" = c.slug
FROM computed AS c
INNER JOIN unique_slugs AS u ON u.slug = c.slug
WHERE p.id = c.id;

CREATE UNIQUE INDEX IF NOT EXISTS "players_profile_slug_key" ON "players"("profile_slug");
