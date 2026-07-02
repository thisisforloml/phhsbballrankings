-- AlterTable
ALTER TABLE "organizer_applications"
ADD COLUMN IF NOT EXISTS "adminNotes" TEXT,
ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "deletedById" UUID;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "organizer_applications_deletedAt_idx" ON "organizer_applications"("deletedAt");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'organizer_applications_deletedById_fkey'
  ) THEN
    ALTER TABLE "organizer_applications"
    ADD CONSTRAINT "organizer_applications_deletedById_fkey"
    FOREIGN KEY ("deletedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
