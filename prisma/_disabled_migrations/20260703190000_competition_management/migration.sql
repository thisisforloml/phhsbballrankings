-- Competition management: extend leagues/seasons, add divisions and import records.

CREATE TYPE "CompetitionSeasonType" AS ENUM ('ACADEMIC', 'CALENDAR', 'TOURNAMENT', 'YEAR_ROUND');
CREATE TYPE "CompetitionSport" AS ENUM ('BASKETBALL');
CREATE TYPE "CompetitionStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
CREATE TYPE "ImportSourceType" AS ENUM ('SUBMISSION', 'URL_IMPORT', 'MANUAL');
CREATE TYPE "ImportRecordStatus" AS ENUM (
  'PENDING',
  'NEEDS_REVIEW',
  'DUPLICATES',
  'ALIAS_SUGGESTIONS',
  'FAILED',
  'PUBLISHED',
  'RESOLVED'
);

ALTER TABLE "leagues"
  ADD COLUMN "shortName" TEXT,
  ADD COLUMN "seasonType" "CompetitionSeasonType",
  ADD COLUMN "country" TEXT DEFAULT 'Philippines',
  ADD COLUMN "sport" "CompetitionSport" DEFAULT 'BASKETBALL',
  ADD COLUMN "defaultAgeGroups" "AgeGroup"[] DEFAULT ARRAY[]::"AgeGroup"[],
  ADD COLUMN "defaultGenders" "PlayerGender"[] DEFAULT ARRAY[]::"PlayerGender"[],
  ADD COLUMN "status" "CompetitionStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "website" TEXT;

CREATE INDEX "leagues_status_idx" ON "leagues"("status");

ALTER TABLE "seasons"
  ADD COLUMN "seasonNumber" INTEGER,
  ADD COLUMN "isCurrent" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "seasons_leagueId_isCurrent_idx" ON "seasons"("leagueId", "isCurrent");

CREATE TABLE "season_divisions" (
  "id" UUID NOT NULL,
  "seasonId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "ageGroup" "AgeGroup",
  "gender" "PlayerGender",
  "status" "SeasonStatus" NOT NULL DEFAULT 'ACTIVE',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "season_divisions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "season_divisions_seasonId_name_key" ON "season_divisions"("seasonId", "name");
CREATE INDEX "season_divisions_seasonId_deletedAt_idx" ON "season_divisions"("seasonId", "deletedAt");

ALTER TABLE "season_divisions"
  ADD CONSTRAINT "season_divisions_seasonId_fkey"
  FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "games" ADD COLUMN "divisionId" UUID;
CREATE INDEX "games_divisionId_idx" ON "games"("divisionId");
ALTER TABLE "games"
  ADD CONSTRAINT "games_divisionId_fkey"
  FOREIGN KEY ("divisionId") REFERENCES "season_divisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "import_records" (
  "id" UUID NOT NULL,
  "sourceType" "ImportSourceType" NOT NULL,
  "submissionId" UUID,
  "title" TEXT NOT NULL,
  "status" "ImportRecordStatus" NOT NULL DEFAULT 'PENDING',
  "leagueId" UUID,
  "seasonId" UUID,
  "summary" JSONB,
  "duplicateCount" INTEGER NOT NULL DEFAULT 0,
  "aliasSuggestionCount" INTEGER NOT NULL DEFAULT 0,
  "errorMessage" TEXT,
  "submittedByUserId" UUID,
  "publishedAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "import_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "import_records_submissionId_key" ON "import_records"("submissionId");
CREATE INDEX "import_records_status_createdAt_idx" ON "import_records"("status", "createdAt");
CREATE INDEX "import_records_leagueId_idx" ON "import_records"("leagueId");
CREATE INDEX "import_records_seasonId_idx" ON "import_records"("seasonId");
CREATE INDEX "import_records_deletedAt_idx" ON "import_records"("deletedAt");

ALTER TABLE "import_records"
  ADD CONSTRAINT "import_records_leagueId_fkey"
  FOREIGN KEY ("leagueId") REFERENCES "leagues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "import_records"
  ADD CONSTRAINT "import_records_seasonId_fkey"
  FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "import_records"
  ADD CONSTRAINT "import_records_submissionId_fkey"
  FOREIGN KEY ("submissionId") REFERENCES "submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "import_records"
  ADD CONSTRAINT "import_records_submittedByUserId_fkey"
  FOREIGN KEY ("submittedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
