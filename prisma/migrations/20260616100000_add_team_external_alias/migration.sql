-- CreateTable
CREATE TABLE "team_external_aliases" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "externalLabel" TEXT NOT NULL,
    "normalizedExternalLabel" TEXT NOT NULL,
    "teamId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_external_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "team_external_aliases_teamId_idx" ON "team_external_aliases"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "team_external_aliases_provider_normalizedExternalLabel_key" ON "team_external_aliases"("provider", "normalizedExternalLabel");

-- AddForeignKey
ALTER TABLE "team_external_aliases" ADD CONSTRAINT "team_external_aliases_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
