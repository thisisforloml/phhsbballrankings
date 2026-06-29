-- CreateTable
CREATE TABLE "player_external_aliases" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "externalLabel" TEXT NOT NULL,
    "normalizedExternalLabel" TEXT NOT NULL,
    "playerId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_external_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "player_external_aliases_playerId_idx" ON "player_external_aliases"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "player_external_aliases_provider_normalizedExternalLabel_key" ON "player_external_aliases"("provider", "normalizedExternalLabel");

-- AddForeignKey
ALTER TABLE "player_external_aliases" ADD CONSTRAINT "player_external_aliases_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
