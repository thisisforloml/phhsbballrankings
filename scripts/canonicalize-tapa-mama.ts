/**
 * Dry-run by default. Pass --apply to execute Tapa Mama program merge.
 * Canonical: fc1763c0-d1bd-42bb-92ba-72e8b45224bb / Tapa Mama U19 Boys
 * Ghost: f48ed107-e567-416e-b5a2-a1e07968b717 / Tapa Mama 14u U19 Boys
 */
import { prisma } from "../src/lib/prisma";

const CANONICAL_PROGRAM_ID = "fc1763c0-d1bd-42bb-92ba-72e8b45224bb";
const CANONICAL_TEAM_ID = "10ba586d-7c5d-4fd1-b4af-0d95107fb495";
const GHOST_PROGRAM_ID = "f48ed107-e567-416e-b5a2-a1e07968b717";
const GHOST_TEAM_ID = "e88622e0-9db4-4391-9638-a3c833a9f300";
const GHOST_GAME_IDS = [
  "2b0955e9-9542-400d-bb68-f2e636ccf80f",
  "0cd39192-46ba-4bdf-8cab-44395ad46605"
];

const apply = process.argv.includes("--apply");

async function main() {
  const ghostStats = await prisma.gameStat.count({ where: { teamId: GHOST_TEAM_ID, deletedAt: null } });
  console.log(`Ghost team GameStats: ${ghostStats} (expected 0)`);
  console.log(`Games to repoint: ${GHOST_GAME_IDS.join(", ")}`);

  if (!apply) {
    console.log("Dry run only. Re-run with --apply to merge Tapa Mama programs.");
    return;
  }

  if (ghostStats > 0) {
    throw new Error("Aborting: ghost team has GameStats. Manual review required.");
  }

  await prisma.$transaction([
    ...GHOST_GAME_IDS.map((gameId) =>
      prisma.game.updateMany({
        where: { id: gameId, deletedAt: null },
        data: { awayTeamId: CANONICAL_TEAM_ID }
      })
    ),
    prisma.program.update({
      where: { id: CANONICAL_PROGRAM_ID },
      data: {
        aliases: ["TAPA MAMA", "Tapa Mama", "Tapa Mama 14u", "TAPA MAMA 14U"]
      }
    }),
    prisma.team.update({ where: { id: GHOST_TEAM_ID }, data: { deletedAt: new Date() } }),
    prisma.program.update({ where: { id: GHOST_PROGRAM_ID }, data: { deletedAt: new Date() } })
  ]);

  console.log("Tapa Mama merge complete. Recompute team ratings separately if needed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
