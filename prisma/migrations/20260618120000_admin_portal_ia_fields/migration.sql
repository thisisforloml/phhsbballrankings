-- CreateEnum
CREATE TYPE "ProfileClaimStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REVOKED');

-- AlterTable
ALTER TABLE "players" ADD COLUMN "hometown" TEXT;

-- Backfill hometown from city
UPDATE "players" SET "hometown" = "city" WHERE "hometown" IS NULL;

-- AlterTable
ALTER TABLE "teams" ADD COLUMN "logoUrl" TEXT;

-- AlterTable
ALTER TABLE "leagues" ADD COLUMN "logoUrl" TEXT;

-- CreateTable
CREATE TABLE "profile_claims" (
    "id" UUID NOT NULL,
    "playerId" UUID NOT NULL,
    "claimantUserId" UUID,
    "status" "ProfileClaimStatus" NOT NULL DEFAULT 'PENDING',
    "claimantName" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "message" TEXT,
    "evidenceJson" JSONB,
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMP(3),
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profile_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_claim_profiles" (
    "playerId" UUID NOT NULL,
    "claimId" UUID NOT NULL,
    "contactEmail" TEXT,
    "socialLinks" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_claim_profiles_pkey" PRIMARY KEY ("playerId")
);

-- CreateTable
CREATE TABLE "game_edit_audits" (
    "id" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "gameId" UUID NOT NULL,
    "fieldName" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "reason" TEXT NOT NULL,
    "editedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_edit_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "profile_claims_status_createdAt_idx" ON "profile_claims"("status", "createdAt");

-- CreateIndex
CREATE INDEX "profile_claims_playerId_idx" ON "profile_claims"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "player_claim_profiles_claimId_key" ON "player_claim_profiles"("claimId");

-- CreateIndex
CREATE INDEX "game_edit_audits_gameId_createdAt_idx" ON "game_edit_audits"("gameId", "createdAt");

-- CreateIndex
CREATE INDEX "game_edit_audits_entityType_entityId_idx" ON "game_edit_audits"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "profile_claims" ADD CONSTRAINT "profile_claims_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_claims" ADD CONSTRAINT "profile_claims_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_claim_profiles" ADD CONSTRAINT "player_claim_profiles_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_claim_profiles" ADD CONSTRAINT "player_claim_profiles_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "profile_claims"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_edit_audits" ADD CONSTRAINT "game_edit_audits_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
