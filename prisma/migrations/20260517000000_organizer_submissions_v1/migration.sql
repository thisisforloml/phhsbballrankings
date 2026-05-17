-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'IMPORTED');

-- CreateEnum
CREATE TYPE "OrganizerSubmissionType" AS ENUM ('PASTE_JSON', 'UPLOAD_JSON', 'UPLOAD_CSV', 'UPLOAD_XLSX');

-- CreateTable
CREATE TABLE "submissions" (
    "id" UUID NOT NULL,
    "submittedByUserId" UUID NOT NULL,
    "type" "OrganizerSubmissionType" NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "title" TEXT NOT NULL,
    "leagueName" TEXT,
    "gameDate" TIMESTAMP(3),
    "originalFilename" TEXT,
    "mimeType" TEXT,
    "fileSizeBytes" INTEGER,
    "storedFilePath" TEXT,
    "rawText" TEXT,
    "parsedPreview" JSONB,
    "validationSummary" JSONB,
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "submissions_submittedByUserId_createdAt_idx" ON "submissions"("submittedByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "submissions_status_createdAt_idx" ON "submissions"("status", "createdAt");

-- CreateIndex
CREATE INDEX "submissions_type_idx" ON "submissions"("type");

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;