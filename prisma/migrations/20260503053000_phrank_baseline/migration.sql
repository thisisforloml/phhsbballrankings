-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'ORGANIZER', 'PREMIUM_VIEWER');

-- CreateEnum
CREATE TYPE "PlayerGender" AS ENUM ('BOYS', 'GIRLS');

-- CreateEnum
CREATE TYPE "AgeGroup" AS ENUM ('U13', 'U16', 'U18', 'U22');

-- CreateEnum
CREATE TYPE "SeasonStatus" AS ENUM ('UPCOMING', 'ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'VERIFIED', 'REJECTED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "LeagueVerificationStatus" AS ENUM ('PROVISIONAL', 'VERIFIED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "RankingScope" AS ENUM ('NATIONAL', 'REGION', 'CITY', 'AGE_GROUP');

-- CreateEnum
CREATE TYPE "SubmissionType" AS ENUM ('LIVE_PORTAL', 'POST_GAME_PORTAL', 'STAFF_MANUAL_ENTRY');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "players" (
    "id" UUID NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "gender" "PlayerGender" NOT NULL DEFAULT 'BOYS',
    "photoUrl" TEXT,
    "heightCm" INTEGER,
    "city" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_profile_submissions" (
    "id" UUID NOT NULL,
    "playerId" UUID,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "position" TEXT,
    "heightCm" INTEGER,
    "photoUrl" TEXT,
    "city" TEXT,
    "region" TEXT,
    "contact" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "player_profile_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizer_applications" (
    "id" UUID NOT NULL,
    "applicantName" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "leagueName" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "experienceNotes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "organizer_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leagues" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "ageGroup" "AgeGroup" NOT NULL,
    "organizerName" TEXT NOT NULL,
    "city" TEXT,
    "region" TEXT,
    "verificationStatus" "LeagueVerificationStatus" NOT NULL DEFAULT 'PROVISIONAL',
    "adminNotes" TEXT,
    "sanctionScore" INTEGER NOT NULL DEFAULT 0,
    "teamCountScore" INTEGER NOT NULL DEFAULT 0,
    "gamesPerTeamScore" INTEGER NOT NULL DEFAULT 0,
    "complianceScore" INTEGER NOT NULL DEFAULT 10,
    "playerQualityScore" INTEGER,
    "qualityScore" INTEGER NOT NULL DEFAULT 0,
    "tier" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "leagues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_league_access" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "leagueId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "user_league_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seasons" (
    "id" UUID NOT NULL,
    "leagueId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "seasonYear" INTEGER NOT NULL,
    "status" "SeasonStatus" NOT NULL DEFAULT 'UPCOMING',
    "startsOn" TIMESTAMP(3) NOT NULL,
    "endsOn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_team_seasons" (
    "id" UUID NOT NULL,
    "playerId" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "seasonId" UUID NOT NULL,
    "adminOverride" BOOLEAN NOT NULL DEFAULT false,
    "overrideReason" TEXT,
    "startsOn" TIMESTAMP(3),
    "endsOn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "player_team_seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "games" (
    "id" UUID NOT NULL,
    "seasonId" UUID NOT NULL,
    "homeTeamId" UUID NOT NULL,
    "awayTeamId" UUID NOT NULL,
    "gameNumber" TEXT,
    "gameDate" TIMESTAMP(3) NOT NULL,
    "venueName" TEXT,
    "city" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "referees" TEXT,
    "attendance" INTEGER,
    "homeScore" INTEGER NOT NULL,
    "awayScore" INTEGER NOT NULL,
    "homeQ1" INTEGER,
    "homeQ2" INTEGER,
    "homeQ3" INTEGER,
    "homeQ4" INTEGER,
    "awayQ1" INTEGER,
    "awayQ2" INTEGER,
    "awayQ3" INTEGER,
    "awayQ4" INTEGER,
    "sourceName" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "submissionType" "SubmissionType" NOT NULL,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_stats" (
    "id" UUID NOT NULL,
    "gameId" UUID NOT NULL,
    "playerId" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "jerseyNumber" TEXT,
    "starter" BOOLEAN NOT NULL DEFAULT false,
    "minutes" DECIMAL(5,2),
    "points" INTEGER NOT NULL,
    "offensiveRebounds" INTEGER,
    "defensiveRebounds" INTEGER,
    "rebounds" INTEGER NOT NULL,
    "assists" INTEGER NOT NULL,
    "steals" INTEGER,
    "blocks" INTEGER,
    "turnovers" INTEGER,
    "fouls" INTEGER,
    "foulsDrawn" INTEGER,
    "plusMinus" INTEGER,
    "fieldGoalsMade" INTEGER,
    "fieldGoalsAttempt" INTEGER,
    "twoMade" INTEGER,
    "twoAttempt" INTEGER,
    "threeMade" INTEGER,
    "threeAttempt" INTEGER,
    "freeThrowsMade" INTEGER,
    "freeThrowsAttempt" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "game_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formula_versions" (
    "id" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "weights" JSONB NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "formula_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_performance_scores" (
    "id" UUID NOT NULL,
    "gameId" UUID NOT NULL,
    "gameStatId" UUID NOT NULL,
    "playerId" UUID NOT NULL,
    "formulaVersionId" UUID NOT NULL,
    "productionScore" DECIMAL(8,3) NOT NULL,
    "leagueWeight" DECIMAL(5,3) NOT NULL,
    "opponentFactor" DECIMAL(5,3) NOT NULL,
    "teamFactor" DECIMAL(5,3) NOT NULL,
    "performanceScore" DECIMAL(8,3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "game_performance_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_ratings" (
    "id" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "seasonId" UUID NOT NULL,
    "rating" DECIMAL(5,2) NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_ratings" (
    "id" UUID NOT NULL,
    "playerId" UUID NOT NULL,
    "ageGroup" "AgeGroup" NOT NULL,
    "observedRating" DECIMAL(5,2) NOT NULL,
    "adjustedRating" DECIMAL(5,2) NOT NULL,
    "verifiedGameCount" INTEGER NOT NULL,
    "starRating" INTEGER NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ranking_snapshots" (
    "id" UUID NOT NULL,
    "scope" "RankingScope" NOT NULL,
    "ageGroup" "AgeGroup",
    "city" TEXT,
    "region" TEXT,
    "weekOf" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ranking_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ranking_snapshot_rows" (
    "id" UUID NOT NULL,
    "snapshotId" UUID NOT NULL,
    "playerId" UUID NOT NULL,
    "rank" INTEGER NOT NULL,
    "rating" DECIMAL(5,2) NOT NULL,
    "starRating" INTEGER NOT NULL,
    "verifiedGameCount" INTEGER NOT NULL,
    "movement" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ranking_snapshot_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "entityType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "previousData" JSONB,
    "newData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");

-- CreateIndex
CREATE INDEX "players_displayName_idx" ON "players"("displayName");

-- CreateIndex
CREATE INDEX "players_birthDate_idx" ON "players"("birthDate");

-- CreateIndex
CREATE INDEX "players_gender_idx" ON "players"("gender");

-- CreateIndex
CREATE INDEX "players_region_city_idx" ON "players"("region", "city");

-- CreateIndex
CREATE INDEX "players_deletedAt_idx" ON "players"("deletedAt");

-- CreateIndex
CREATE INDEX "player_profile_submissions_status_createdAt_idx" ON "player_profile_submissions"("status", "createdAt");

-- CreateIndex
CREATE INDEX "organizer_applications_status_createdAt_idx" ON "organizer_applications"("status", "createdAt");

-- CreateIndex
CREATE INDEX "teams_name_idx" ON "teams"("name");

-- CreateIndex
CREATE INDEX "teams_region_city_idx" ON "teams"("region", "city");

-- CreateIndex
CREATE INDEX "teams_deletedAt_idx" ON "teams"("deletedAt");

-- CreateIndex
CREATE INDEX "leagues_ageGroup_idx" ON "leagues"("ageGroup");

-- CreateIndex
CREATE INDEX "leagues_qualityScore_tier_idx" ON "leagues"("qualityScore", "tier");

-- CreateIndex
CREATE INDEX "leagues_verificationStatus_idx" ON "leagues"("verificationStatus");

-- CreateIndex
CREATE INDEX "leagues_region_city_idx" ON "leagues"("region", "city");

-- CreateIndex
CREATE INDEX "leagues_deletedAt_idx" ON "leagues"("deletedAt");

-- CreateIndex
CREATE INDEX "user_league_access_leagueId_idx" ON "user_league_access"("leagueId");

-- CreateIndex
CREATE INDEX "user_league_access_deletedAt_idx" ON "user_league_access"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_league_access_userId_leagueId_key" ON "user_league_access"("userId", "leagueId");

-- CreateIndex
CREATE INDEX "seasons_seasonYear_status_idx" ON "seasons"("seasonYear", "status");

-- CreateIndex
CREATE INDEX "seasons_deletedAt_idx" ON "seasons"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "seasons_leagueId_name_key" ON "seasons"("leagueId", "name");

-- CreateIndex
CREATE INDEX "player_team_seasons_teamId_seasonId_idx" ON "player_team_seasons"("teamId", "seasonId");

-- CreateIndex
CREATE INDEX "player_team_seasons_deletedAt_idx" ON "player_team_seasons"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "player_team_seasons_playerId_seasonId_key" ON "player_team_seasons"("playerId", "seasonId");

-- CreateIndex
CREATE INDEX "games_verificationStatus_gameDate_idx" ON "games"("verificationStatus", "gameDate");

-- CreateIndex
CREATE INDEX "games_seasonId_gameDate_idx" ON "games"("seasonId", "gameDate");

-- CreateIndex
CREATE INDEX "games_deletedAt_idx" ON "games"("deletedAt");

-- CreateIndex
CREATE INDEX "game_stats_playerId_idx" ON "game_stats"("playerId");

-- CreateIndex
CREATE INDEX "game_stats_teamId_idx" ON "game_stats"("teamId");

-- CreateIndex
CREATE INDEX "game_stats_deletedAt_idx" ON "game_stats"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "game_stats_gameId_playerId_key" ON "game_stats"("gameId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "formula_versions_versionNumber_key" ON "formula_versions"("versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "game_performance_scores_gameStatId_key" ON "game_performance_scores"("gameStatId");

-- CreateIndex
CREATE INDEX "game_performance_scores_playerId_idx" ON "game_performance_scores"("playerId");

-- CreateIndex
CREATE INDEX "game_performance_scores_formulaVersionId_idx" ON "game_performance_scores"("formulaVersionId");

-- CreateIndex
CREATE INDEX "game_performance_scores_deletedAt_idx" ON "game_performance_scores"("deletedAt");

-- CreateIndex
CREATE INDEX "team_ratings_rating_idx" ON "team_ratings"("rating");

-- CreateIndex
CREATE UNIQUE INDEX "team_ratings_teamId_seasonId_key" ON "team_ratings"("teamId", "seasonId");

-- CreateIndex
CREATE INDEX "player_ratings_ageGroup_adjustedRating_idx" ON "player_ratings"("ageGroup", "adjustedRating");

-- CreateIndex
CREATE UNIQUE INDEX "player_ratings_playerId_ageGroup_key" ON "player_ratings"("playerId", "ageGroup");

-- CreateIndex
CREATE INDEX "ranking_snapshots_scope_ageGroup_city_region_weekOf_idx" ON "ranking_snapshots"("scope", "ageGroup", "city", "region", "weekOf");

-- CreateIndex
CREATE INDEX "ranking_snapshots_weekOf_idx" ON "ranking_snapshots"("weekOf");

-- CreateIndex
CREATE INDEX "ranking_snapshot_rows_rank_idx" ON "ranking_snapshot_rows"("rank");

-- CreateIndex
CREATE UNIQUE INDEX "ranking_snapshot_rows_snapshotId_playerId_key" ON "ranking_snapshot_rows"("snapshotId", "playerId");

-- CreateIndex
CREATE INDEX "audit_log_entityType_entityId_idx" ON "audit_log"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_log_createdAt_idx" ON "audit_log"("createdAt");

-- AddForeignKey
ALTER TABLE "user_league_access" ADD CONSTRAINT "user_league_access_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_league_access" ADD CONSTRAINT "user_league_access_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "leagues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "leagues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_team_seasons" ADD CONSTRAINT "player_team_seasons_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_team_seasons" ADD CONSTRAINT "player_team_seasons_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_team_seasons" ADD CONSTRAINT "player_team_seasons_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_stats" ADD CONSTRAINT "game_stats_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_stats" ADD CONSTRAINT "game_stats_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_stats" ADD CONSTRAINT "game_stats_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_performance_scores" ADD CONSTRAINT "game_performance_scores_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_performance_scores" ADD CONSTRAINT "game_performance_scores_gameStatId_fkey" FOREIGN KEY ("gameStatId") REFERENCES "game_stats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_performance_scores" ADD CONSTRAINT "game_performance_scores_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_performance_scores" ADD CONSTRAINT "game_performance_scores_formulaVersionId_fkey" FOREIGN KEY ("formulaVersionId") REFERENCES "formula_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_ratings" ADD CONSTRAINT "team_ratings_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_ratings" ADD CONSTRAINT "team_ratings_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_ratings" ADD CONSTRAINT "player_ratings_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ranking_snapshot_rows" ADD CONSTRAINT "ranking_snapshot_rows_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "ranking_snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ranking_snapshot_rows" ADD CONSTRAINT "ranking_snapshot_rows_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

