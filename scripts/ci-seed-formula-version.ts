import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.formulaVersion.upsert({
    where: { versionNumber: 1 },
    update: {},
    create: {
      versionNumber: 1,
      description: "Formula v1 metadata for isolated CI builds.",
      isPublic: false,
      weights: {},
      effectiveFrom: new Date("2020-01-01T00:00:00.000Z")
    }
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });