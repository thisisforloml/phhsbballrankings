import { prisma } from "../src/lib/prisma";

const activePlayerId = "94bf23af-63ac-4b45-8daf-df6038cc404c";
const softDeletedDuplicateId = "a11d4a79-39cf-42e2-b7d5-4b8538e6af68";

async function main() {
  await prisma.player.update({
    where: { id: activePlayerId },
    data: {
      displayName: "Mark Jade Dulin",
      firstName: "Mark",
      lastName: "Jade Dulin"
    }
  });

  const activeCorrectCount = await prisma.player.count({
    where: {
      displayName: "Mark Jade Dulin",
      gender: "BOYS",
      deletedAt: null
    }
  });

  const activeIncorrectCount = await prisma.player.count({
    where: {
      displayName: "Mark jade Dulin",
      gender: "BOYS",
      deletedAt: null
    }
  });

  const softDeletedDuplicate = await prisma.player.findUnique({
    where: { id: softDeletedDuplicateId },
    select: {
      id: true,
      displayName: true,
      deletedAt: true
    }
  });

  console.log(JSON.stringify({
    updatedPlayerId: activePlayerId,
    activeBoysMarkJadeDulinCount: activeCorrectCount,
    activeBoysMarkLowercaseJadeDulinCount: activeIncorrectCount,
    softDeletedDuplicate: softDeletedDuplicate ? {
      id: softDeletedDuplicate.id,
      displayName: softDeletedDuplicate.displayName,
      deletedAt: softDeletedDuplicate.deletedAt ? softDeletedDuplicate.deletedAt.toISOString() : null,
      remainsDeleted: softDeletedDuplicate.deletedAt !== null
    } : null,
    validationPassed: activeCorrectCount === 1 && activeIncorrectCount === 0 && softDeletedDuplicate?.deletedAt !== null
  }, null, 2));
}

main()
  .catch((error) => {
    console.log(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });