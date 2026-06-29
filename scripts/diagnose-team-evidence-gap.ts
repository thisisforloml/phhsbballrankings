import { SubmissionType, VerificationStatus } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { resolveImportedOfficialGameIds } from "../src/lib/team-ratings/team-evidence-imported-games";

async function main() {
  const imported = await resolveImportedOfficialGameIds();
  const games = await prisma.game.findMany({
    where: {
      deletedAt: null,
      submissionType: SubmissionType.STAFF_MANUAL_ENTRY,
      verificationStatus: { in: [VerificationStatus.SUBMITTED, VerificationStatus.VERIFIED] }
    },
    include: { season: { include: { league: true } } }
  });
  const missing = games.filter((game) => !imported.has(game.id));
  const byLeague = new Map<string, number>();
  for (const game of missing) {
    const key = game.season.league.name;
    byLeague.set(key, (byLeague.get(key) ?? 0) + 1);
  }
  console.log(JSON.stringify({
    missing: missing.length,
    total: games.length,
    byLeague: [...byLeague.entries()].sort((left, right) => right[1] - left[1])
  }, null, 2));
}

main().finally(() => prisma.$disconnect());
