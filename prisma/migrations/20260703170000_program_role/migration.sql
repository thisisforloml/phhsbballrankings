-- CreateEnum
CREATE TYPE "ProgramRole" AS ENUM ('GROUP', 'OPERATIONAL');

-- AlterTable
ALTER TABLE "programs" ADD COLUMN "programRole" "ProgramRole" NOT NULL DEFAULT 'OPERATIONAL';
