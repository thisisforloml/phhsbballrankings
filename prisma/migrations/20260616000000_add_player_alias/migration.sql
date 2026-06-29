-- CreateTable
CREATE TABLE "player_aliases" (
    "id" UUID NOT NULL,
    "playerId" UUID NOT NULL,
    "aliasName" TEXT NOT NULL,
    "gender" "PlayerGender" NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'seed',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "player_aliases_playerId_idx" ON "player_aliases"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "player_aliases_aliasName_gender_key" ON "player_aliases"("aliasName", "gender");

-- AddForeignKey
ALTER TABLE "player_aliases" ADD CONSTRAINT "player_aliases_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
