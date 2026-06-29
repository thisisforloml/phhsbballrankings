import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const program = await prisma.program.findFirst({
    where: { fullName: "PYBC 15U", deletedAt: null },
    select: {
      id: true,
      fullName: true,
      abbreviation: true,
      type: true,
      city: true,
      region: true,
      aliases: true,
      teams: {
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          _count: { select: { homeGames: true, awayGames: true, gameStats: true } }
        }
      },
      currentPlayers: {
        where: { deletedAt: null },
        select: { id: true, displayName: true }
      }
    }
  });

  const result = {
    dryRun: true,
    target: "PYBC 15U",
    programFound: Boolean(program),
    program,
    recommendedAction: !program
      ? "NO_ACTION"
      : program.teams.length === 0 && program.currentPlayers.length === 0
        ? "RETIRE_OR_HIDE_WITH_APPROVAL"
        : "NEEDS_REVIEW",
    wouldRequireDbWrite: Boolean(program),
    guardrails: [
      "This script is read-only.",
      "PYBC 15U is league/competition context, not a team Program.",
      "Only retire or hide this Program after explicit approval.",
      "Do not delete, merge, recompute ratings, or regenerate snapshots."
    ]
  };

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ dryRun: true, validationPassed: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
