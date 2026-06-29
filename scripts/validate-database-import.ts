import { readFileSync } from "node:fs";
import path from "node:path";
import { PlayerGender } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

const projectRoot = "D:\\Peach Basket";
const expectedGameStatRows = 1885;

const batchFiles = [
  { path: "scripts/data/uaap-s88-hs-boys-batch-01.json", gender: PlayerGender.BOYS },
  { path: "scripts/data/uaap-s88-hs-boys-batch-02.json", gender: PlayerGender.BOYS },
  { path: "scripts/data/uaap-s88-hs-boys-batch-03.json", gender: PlayerGender.BOYS },
  { path: "scripts/data/uaap-s88-hs-boys-batch-04.json", gender: PlayerGender.BOYS },
  { path: "scripts/data/uaap-s88-hs-boys-batch-05.json", gender: PlayerGender.BOYS },
  { path: "scripts/data/uaap-s88-hs-boys-batch-06.json", gender: PlayerGender.BOYS },
  { path: "scripts/data/uaap-s88-hs-girls-batch-01.json", gender: PlayerGender.GIRLS },
  { path: "scripts/data/uaap-s88-hs-girls-batch-02.json", gender: PlayerGender.GIRLS }
] as const;

type SourceLeague = { name?: unknown; ageGroup?: unknown };
type SourceSeason = { name?: unknown };
type SourcePlayer = Record<string, unknown>;
type SourceGame = Record<string, unknown> & { players?: SourcePlayer[] };
type SourceData = { league?: SourceLeague; season?: SourceSeason; games?: SourceGame[] };

function requiredString(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Missing or invalid ${label}.`);
  return value.trim();
}

function requiredNumber(value: unknown, label: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`Missing or invalid ${label}.`);
  return value;
}

function cleanPlayerName(name: unknown) {
  return requiredString(name, "player.name").replace(/^\*+/, "").trim();
}

function loadBatch(relativePath: string) {
  const data = JSON.parse(readFileSync(path.join(projectRoot, relativePath), "utf8")) as SourceData;
  if (!data.league || !data.season || !Array.isArray(data.games)) throw new Error(`${relativePath} has invalid wrapper.`);
  return data;
}

async function resolveSeason(data: SourceData) {
  const leagueName = requiredString(data.league?.name, "league.name");
  const ageGroup = requiredString(data.league?.ageGroup, "league.ageGroup");
  const seasonName = requiredString(data.season?.name, "season.name");
  const league = await prisma.league.findFirst({ where: { name: leagueName, ageGroup: ageGroup as never, deletedAt: null } });
  if (!league) throw new Error(`Missing league ${leagueName} ${ageGroup}`);
  const season = await prisma.season.findUnique({ where: { leagueId_name: { leagueId: league.id, name: seasonName } } });
  if (!season || season.deletedAt !== null) throw new Error(`Missing active season ${seasonName}`);
  return season;
}

async function main() {
  const missingGames = [];
  const missingPlayers = [];
  const missingGameStats = [];
  const pointTotalChecks = [];
  const importedGameIds = new Set<string>();
  let totalGamesInJson = 0;
  let totalPlayerRowsInJson = 0;
  let gamesMatched = 0;
  let playersMatched = 0;
  let gameStatsMatched = 0;

  for (const batch of batchFiles) {
    const data = loadBatch(batch.path);
    const season = await resolveSeason(data);

    for (const sourceGame of data.games!) {
      totalGamesInJson += 1;
      const gameNumber = requiredString(sourceGame.gameNumber, "game.gameNumber");
      const homeTeamName = requiredString(sourceGame.homeTeamName, "game.homeTeamName");
      const awayTeamName = requiredString(sourceGame.awayTeamName, "game.awayTeamName");
      const gameMatches = await prisma.game.findMany({
        where: { gameNumber, seasonId: season.id, deletedAt: null },
        include: { homeTeam: true, awayTeam: true }
      });

      if (gameMatches.length !== 1) {
        missingGames.push({ file: batch.path, gameNumber, matchesFound: gameMatches.length });
        totalPlayerRowsInJson += (sourceGame.players ?? []).length;
        continue;
      }

      const game = gameMatches[0];
      gamesMatched += 1;
      importedGameIds.add(game.id);
      let summedHomePlayerPoints = 0;
      let summedAwayPlayerPoints = 0;

      for (const sourcePlayer of sourceGame.players ?? []) {
        totalPlayerRowsInJson += 1;
        const displayName = cleanPlayerName(sourcePlayer.name);
        const teamName = requiredString(sourcePlayer.team, "player.team");
        const points = requiredNumber(sourcePlayer.PTS, "PTS");
        const playerMatches = await prisma.player.findMany({ where: { displayName, gender: batch.gender, deletedAt: null } });

        if (playerMatches.length !== 1) {
          missingPlayers.push({ file: batch.path, gameNumber, displayName, gender: batch.gender, matchesFound: playerMatches.length });
          continue;
        }

        const player = playerMatches[0];
        playersMatched += 1;
        const gameStat = await prisma.gameStat.findUnique({ where: { gameId_playerId: { gameId: game.id, playerId: player.id } } });

        if (!gameStat) {
          missingGameStats.push({ file: batch.path, gameNumber, displayName, gameId: game.id, playerId: player.id });
          continue;
        }

        gameStatsMatched += 1;
        if (teamName === homeTeamName) summedHomePlayerPoints += points;
        if (teamName === awayTeamName) summedAwayPlayerPoints += points;
      }

      pointTotalChecks.push({
        file: batch.path,
        gameNumber,
        homeTeam: game.homeTeam.name,
        awayTeam: game.awayTeam.name,
        homeScore: game.homeScore,
        awayScore: game.awayScore,
        summedHomePlayerPoints,
        summedAwayPlayerPoints,
        pointsMatchHomeScore: summedHomePlayerPoints === game.homeScore,
        pointsMatchAwayScore: summedAwayPlayerPoints === game.awayScore
      });
    }
  }

  const totalGameStatRowsForImportedGames = await prisma.gameStat.count({
    where: { gameId: { in: [...importedGameIds] }, deletedAt: null }
  });
  const validationPassed =
    missingGames.length === 0 &&
    missingPlayers.length === 0 &&
    missingGameStats.length === 0 &&
    pointTotalChecks.every((check) => check.pointsMatchHomeScore && check.pointsMatchAwayScore) &&
    totalGameStatRowsForImportedGames === expectedGameStatRows;

  console.log(JSON.stringify({
    totalGamesInJson,
    totalPlayerRowsInJson,
    gamesMatched,
    playersMatched,
    gameStatsMatched,
    totalGameStatRowsForImportedGames,
    expectedGameStatRows,
    missingGames,
    missingPlayers,
    missingGameStats,
    pointTotalChecks,
    validationPassed
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
