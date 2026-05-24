-- CreateEnum
CREATE TYPE "ProgramType" AS ENUM ('SCHOOL', 'CLUB', 'TEAM', 'UNKNOWN');

-- AlterTable
ALTER TABLE "players" ADD COLUMN     "currentProgramId" UUID;

-- AlterTable
ALTER TABLE "teams" ADD COLUMN     "programId" UUID;

-- CreateTable
CREATE TABLE "programs" (
    "id" UUID NOT NULL,
    "fullName" TEXT NOT NULL,
    "abbreviation" TEXT,
    "type" "ProgramType" NOT NULL DEFAULT 'UNKNOWN',
    "city" TEXT,
    "region" TEXT,
    "aliases" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_program_history" (
    "id" UUID NOT NULL,
    "playerId" UUID NOT NULL,
    "fromProgramId" UUID,
    "toProgramId" UUID,
    "effectiveDate" TIMESTAMP(3),
    "note" TEXT,
    "changeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_program_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "programs_fullName_idx" ON "programs"("fullName");

-- CreateIndex
CREATE INDEX "programs_abbreviation_idx" ON "programs"("abbreviation");

-- CreateIndex
CREATE INDEX "programs_deletedAt_idx" ON "programs"("deletedAt");

-- CreateIndex
CREATE INDEX "player_program_history_playerId_idx" ON "player_program_history"("playerId");

-- CreateIndex
CREATE INDEX "players_currentProgramId_idx" ON "players"("currentProgramId");

-- AddForeignKey
ALTER TABLE "players" ADD CONSTRAINT "players_currentProgramId_fkey" FOREIGN KEY ("currentProgramId") REFERENCES "programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_program_history" ADD CONSTRAINT "player_program_history_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_program_history" ADD CONSTRAINT "player_program_history_fromProgramId_fkey" FOREIGN KEY ("fromProgramId") REFERENCES "programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_program_history" ADD CONSTRAINT "player_program_history_toProgramId_fkey" FOREIGN KEY ("toProgramId") REFERENCES "programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
