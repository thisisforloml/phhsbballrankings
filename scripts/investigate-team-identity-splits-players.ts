import { prisma } from "../src/lib/prisma";

const PYBC_13U_LEAGUE = "87e9d0c6-d5d4-41f5-9d1c-e495cd16baad";
const PYBC_13U_SEASON = "757fb031-d320-46a5-b9b6-e05fa321c0e7";

async function playerSet(teamId: string, leagueId?: string, seasonId?: string) {
  const stats = await prisma.gameStat.findMany({
    where: {
      deletedAt: null,
      teamId,
      ...(leagueId && seasonId
        ? { game: { seasonId, season: { leagueId } } }
        : {})
    },
    select: { playerId: true, player: { select: { displayName: true } }, gameId: true }
  });
  return stats;
}

function summarize(label: string, statsA: Awaited<ReturnType<typeof playerSet>>, statsB: Awaited<ReturnType<typeof playerSet>>) {
  const setA = new Set(statsA.map((row) => row.playerId));
  const setB = new Set(statsB.map((row) => row.playerId));
  const shared = [...setA].filter((id) => setB.has(id));
  const name = (id: string) =>
    statsA.find((row) => row.playerId === id)?.player.displayName ??
    statsB.find((row) => row.playerId === id)?.player.displayName ??
    id;
  return {
    label,
    playersA: setA.size,
    playersB: setB.size,
    sharedCount: shared.length,
    sharedNames: shared.map(name),
    onlyA: [...setA].filter((id) => !setB.has(id)).map(name),
    onlyB: [...setB].filter((id) => !setA.has(id)).map(name),
    jaccardPercent: (() => {
      const union = new Set([...setA, ...setB]).size;
      return union ? Number(((shared.length / union) * 100).toFixed(1)) : 0;
    })()
  };
}

async function main() {
  const bistroA = "ff96c815-68e3-4402-804a-4d49c91313ed";
  const bistroB = "8f0ddc95-b993-4fbf-a903-ce53ab2bbaad";
  const smileA = "48b03b46-91b7-4acb-9b85-1a8278c33773";
  const smileB = "de02c99c-0b47-49f4-8af1-693b5dbf7493";

  const bistroAll = summarize("Bistro all", await playerSet(bistroA), await playerSet(bistroB));
  const smileAll = summarize("Smile all", await playerSet(smileA), await playerSet(smileB));
  const smilePybc = summarize(
    "Smile PYBC 13u Season 2026",
    await playerSet(smileA, PYBC_13U_LEAGUE, PYBC_13U_SEASON),
    await playerSet(smileB, PYBC_13U_LEAGUE, PYBC_13U_SEASON)
  );

  const smilePybcGamesA = await prisma.game.findMany({
    where: {
      deletedAt: null,
      seasonId: PYBC_13U_SEASON,
      OR: [{ homeTeamId: smileA }, { awayTeamId: smileA }]
    },
    select: {
      id: true,
      gameNumber: true,
      gameDate: true,
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } }
    },
    orderBy: { gameDate: "asc" }
  });

  const smilePybcGamesB = await prisma.game.findMany({
    where: {
      deletedAt: null,
      seasonId: PYBC_13U_SEASON,
      OR: [{ homeTeamId: smileB }, { awayTeamId: smileB }]
    },
    select: {
      id: true,
      gameNumber: true,
      gameDate: true,
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } }
    },
    orderBy: { gameDate: "asc" }
  });

  console.log(JSON.stringify({ bistroAll, smileAll, smilePybc, smilePybcGamesA, smilePybcGamesB }, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
