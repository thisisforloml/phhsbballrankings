-- Option B: home-board v1 provenance metadata (no rating value changes)
ALTER TABLE "player_ratings" ADD COLUMN IF NOT EXISTS "ratingBasis" TEXT;
