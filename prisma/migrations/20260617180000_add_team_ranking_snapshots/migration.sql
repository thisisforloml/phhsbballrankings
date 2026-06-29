-- CreateEnum
CREATE TYPE "TeamRankingSnapshotStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SUPERSEDED');

-- CreateTable
CREATE TABLE "team_ranking_snapshots" (
    "id" UUID NOT NULL,
    "ageGroup" "AgeGroup" NOT NULL,
    "gender" "PlayerGender" NOT NULL,
    "weekOf" TIMESTAMP(3) NOT NULL,
    "teamFormulaVersionId" UUID NOT NULL,
    "evidencePolicyVersion" TEXT NOT NULL,
    "thresholdPolicyVersion" TEXT NOT NULL,
    "status" "TeamRankingSnapshotStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "supersededAt" TIMESTAMP(3),
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "evaluationDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_ranking_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_ranking_snapshot_rows" (
    "id" UUID NOT NULL,
    "snapshotId" UUID NOT NULL,
    "programId" UUID NOT NULL,
    "rank" INTEGER NOT NULL,
    "rating" DECIMAL(5,2) NOT NULL,
    "verifiedGameCount" INTEGER NOT NULL,
    "verifiedOpponentCount" INTEGER NOT NULL,
    "verifiedCompetitionCount" INTEGER NOT NULL,
    "programName" TEXT NOT NULL,
    "programAbbreviation" TEXT,
    "movement" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "team_ranking_snapshot_rows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "team_ranking_snapshots_ageGroup_gender_weekOf_teamFormulaVers_key" ON "team_ranking_snapshots"("ageGroup", "gender", "weekOf", "teamFormulaVersionId", "evidencePolicyVersion", "thresholdPolicyVersion");

-- CreateIndex
CREATE INDEX "team_ranking_snapshots_ageGroup_gender_weekOf_idx" ON "team_ranking_snapshots"("ageGroup", "gender", "weekOf");

-- CreateIndex
CREATE INDEX "team_ranking_snapshots_status_weekOf_idx" ON "team_ranking_snapshots"("status", "weekOf");

-- CreateIndex
CREATE INDEX "team_ranking_snapshots_teamFormulaVersionId_idx" ON "team_ranking_snapshots"("teamFormulaVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "team_ranking_snapshot_rows_snapshotId_programId_key" ON "team_ranking_snapshot_rows"("snapshotId", "programId");

-- CreateIndex
CREATE INDEX "team_ranking_snapshot_rows_snapshotId_rank_idx" ON "team_ranking_snapshot_rows"("snapshotId", "rank");

-- CreateIndex
CREATE INDEX "team_ranking_snapshot_rows_programId_idx" ON "team_ranking_snapshot_rows"("programId");

-- AddForeignKey
ALTER TABLE "team_ranking_snapshots" ADD CONSTRAINT "team_ranking_snapshots_teamFormulaVersionId_fkey" FOREIGN KEY ("teamFormulaVersionId") REFERENCES "team_formula_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_ranking_snapshot_rows" ADD CONSTRAINT "team_ranking_snapshot_rows_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "team_ranking_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_ranking_snapshot_rows" ADD CONSTRAINT "team_ranking_snapshot_rows_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
