import { PrismaClient, AgeGroup } from "@prisma/client";
import { getActivePolicyVersionId } from "../src/lib/ratings/active-formula";

const prisma = new PrismaClient();
const policy = getActivePolicyVersionId();

async function main() {
  const [players, u19Ratings, u16Ratings] = await Promise.all([
    prisma.player.count({ where: { deletedAt: null } }),
    prisma.playerRating.count({
      where: { policyVersionId: policy, ageGroup: AgeGroup.U19, player: { deletedAt: null, gender: "BOYS" } },
    }),
    prisma.playerRating.count({
      where: { policyVersionId: policy, ageGroup: AgeGroup.U16, player: { deletedAt: null, gender: "BOYS" } },
    }),
  ]);

  console.log(JSON.stringify({ players, u19Ratings, u16Ratings }, null, 2));
  await prisma.$disconnect();
}

main();
