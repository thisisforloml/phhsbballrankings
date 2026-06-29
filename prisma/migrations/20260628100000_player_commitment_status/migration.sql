-- CreateEnum
CREATE TYPE "PlayerCommitmentStatus" AS ENUM ('UNDECLARED', 'COMMITTED');

-- AlterTable
ALTER TABLE "players" ADD COLUMN "commitmentStatus" "PlayerCommitmentStatus" NOT NULL DEFAULT 'UNDECLARED',
ADD COLUMN "committedUniversity" TEXT;
