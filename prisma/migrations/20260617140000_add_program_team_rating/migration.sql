-- CreateTable
CREATE TABLE "team_formula_versions" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "parameters" JSONB NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_formula_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program_team_ratings" (
    "id" UUID NOT NULL,
    "programId" UUID NOT NULL,
    "ageGroup" "AgeGroup" NOT NULL,
    "gender" "PlayerGender" NOT NULL,
    "rating" DECIMAL(5,2) NOT NULL,
    "observedRating" DECIMAL(5,2),
    "effectiveGameWeight" DECIMAL(8,3),
    "verifiedGameCount" INTEGER NOT NULL,
    "verifiedOpponentCount" INTEGER NOT NULL,
    "verifiedCompetitionCount" INTEGER NOT NULL,
    "publicBoardEligible" BOOLEAN NOT NULL DEFAULT false,
    "teamFormulaVersionId" UUID NOT NULL,
    "evidencePolicyVersion" TEXT NOT NULL,
    "thresholdPolicyVersion" TEXT NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "program_team_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "team_formula_versions_slug_key" ON "team_formula_versions"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "team_formula_versions_versionNumber_key" ON "team_formula_versions"("versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "program_team_ratings_programId_ageGroup_gender_key" ON "program_team_ratings"("programId", "ageGroup", "gender");

-- CreateIndex
CREATE INDEX "program_team_ratings_ageGroup_gender_rating_idx" ON "program_team_ratings"("ageGroup", "gender", "rating");

-- CreateIndex
CREATE INDEX "program_team_ratings_publicBoardEligible_ageGroup_gender_rat_idx" ON "program_team_ratings"("publicBoardEligible", "ageGroup", "gender", "rating");

-- CreateIndex
CREATE INDEX "program_team_ratings_computedAt_idx" ON "program_team_ratings"("computedAt");

-- AddForeignKey
ALTER TABLE "program_team_ratings" ADD CONSTRAINT "program_team_ratings_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_team_ratings" ADD CONSTRAINT "program_team_ratings_teamFormulaVersionId_fkey" FOREIGN KEY ("teamFormulaVersionId") REFERENCES "team_formula_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed TPI-v1 (TEAM-EVIDENCE-v1-official-import defaults in parameters)
INSERT INTO "team_formula_versions" (
    "id",
    "slug",
    "versionNumber",
    "description",
    "parameters",
    "effectiveFrom",
    "isPublic",
    "createdAt"
) VALUES (
    'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    'TPI-v1',
    1,
    'Team Performance Index v1 — hybrid WPI with 2-pass opponent refinement',
    '{"shrinkageK":6,"halfLifeDays":180,"maxAgeDays":540,"boardPrior":50,"minGames":8,"minOpponents":3,"passIterations":2,"evidencePolicyVersion":"TEAM-EVIDENCE-v1-official-import","thresholdPolicyVersion":"TEAM-POLICY-v1-launch"}'::jsonb,
    '2026-06-17 00:00:00'::timestamp,
    true,
    CURRENT_TIMESTAMP
) ON CONFLICT ("slug") DO NOTHING;
