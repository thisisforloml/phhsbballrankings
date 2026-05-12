CREATE TABLE "league_season_averages" (
    "id" UUID NOT NULL,
    "seasonId" UUID NOT NULL,
    "points" DECIMAL(12,3) NOT NULL,
    "fieldGoalsMade" DECIMAL(12,3) NOT NULL,
    "fieldGoalsAttempt" DECIMAL(12,3) NOT NULL,
    "threeMade" DECIMAL(12,3) NOT NULL,
    "threeAttempt" DECIMAL(12,3) NOT NULL,
    "freeThrowsMade" DECIMAL(12,3) NOT NULL,
    "freeThrowsAttempt" DECIMAL(12,3) NOT NULL,
    "offensiveRebounds" DECIMAL(12,3) NOT NULL,
    "defensiveRebounds" DECIMAL(12,3) NOT NULL,
    "rebounds" DECIMAL(12,3) NOT NULL,
    "assists" DECIMAL(12,3) NOT NULL,
    "steals" DECIMAL(12,3) NOT NULL,
    "blocks" DECIMAL(12,3) NOT NULL,
    "turnovers" DECIMAL(12,3) NOT NULL,
    "fouls" DECIMAL(12,3) NOT NULL,
    "possessions" DECIMAL(12,3) NOT NULL,
    "pointsPerPoss" DECIMAL(12,6) NOT NULL,
    "trueShootingPct" DECIMAL(8,5),
    "averageUper" DECIMAL(8,5),
    "averageOrtg" DECIMAL(8,3),
    "averageDrtg" DECIMAL(8,3),
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "league_season_averages_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "game_performance_scores" ADD COLUMN "formulaVersionTag" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "game_performance_scores" ADD COLUMN "effectiveFieldGoalPct" DECIMAL(8,5);
ALTER TABLE "game_performance_scores" ADD COLUMN "trueShootingPct" DECIMAL(8,5);
ALTER TABLE "game_performance_scores" ADD COLUMN "usagePct" DECIMAL(8,5);
ALTER TABLE "game_performance_scores" ADD COLUMN "unadjustedPer" DECIMAL(8,5);
ALTER TABLE "game_performance_scores" ADD COLUMN "playerEfficiencyRating" DECIMAL(8,5);
ALTER TABLE "game_performance_scores" ADD COLUMN "offensiveRating" DECIMAL(8,3);
ALTER TABLE "game_performance_scores" ADD COLUMN "defensiveRating" DECIMAL(8,3);
ALTER TABLE "game_performance_scores" ADD COLUMN "pie" DECIMAL(8,5);
ALTER TABLE "game_performance_scores" ADD COLUMN "offensiveWinShares" DECIMAL(8,5);
ALTER TABLE "game_performance_scores" ADD COLUMN "defensiveWinShares" DECIMAL(8,5);
ALTER TABLE "game_performance_scores" ADD COLUMN "winShares" DECIMAL(8,5);
ALTER TABLE "game_performance_scores" ADD COLUMN "winSharesPer48" DECIMAL(8,5);
ALTER TABLE "game_performance_scores" ADD COLUMN "apmBox" DECIMAL(8,5);
ALTER TABLE "game_performance_scores" ADD COLUMN "rpmEstimate" DECIMAL(8,5);
ALTER TABLE "game_performance_scores" ADD COLUMN "advancedMetricBonus" DECIMAL(8,3);
ALTER TABLE "game_performance_scores" ADD COLUMN "finalPerformanceScore" DECIMAL(8,3);
ALTER TABLE "game_performance_scores" ADD COLUMN "processedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "league_season_averages_seasonId_key" ON "league_season_averages"("seasonId");
ALTER TABLE "league_season_averages" ADD CONSTRAINT "league_season_averages_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
