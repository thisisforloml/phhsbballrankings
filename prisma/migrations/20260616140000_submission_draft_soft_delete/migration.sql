-- AlterEnum
ALTER TYPE "SubmissionStatus" ADD VALUE IF NOT EXISTS 'DRAFT';

-- AlterTable
ALTER TABLE "submissions"
ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "importedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "deletedById" UUID;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "submissions_deletedAt_idx" ON "submissions"("deletedAt");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'submissions_deletedById_fkey'
  ) THEN
    ALTER TABLE "submissions"
    ADD CONSTRAINT "submissions_deletedById_fkey"
    FOREIGN KEY ("deletedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
