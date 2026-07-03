-- AlterTable
ALTER TABLE "programs" ADD COLUMN IF NOT EXISTS "parentProgramId" UUID;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "programs_parentProgramId_idx" ON "programs"("parentProgramId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'programs_parentProgramId_fkey'
  ) THEN
    ALTER TABLE "programs"
    ADD CONSTRAINT "programs_parentProgramId_fkey"
    FOREIGN KEY ("parentProgramId") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
