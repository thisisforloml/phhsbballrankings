import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();
const root = process.cwd();
const schemaPath = path.join(root, "prisma", "schema.prisma");
const batchFiles = [
  "scripts/data/uaap-s88-hs-boys-batch-01.json",
  "scripts/data/uaap-s88-hs-boys-batch-02.json",
  "scripts/data/uaap-s88-hs-boys-batch-03.json",
  "scripts/data/uaap-s88-hs-boys-batch-04.json",
  "scripts/data/uaap-s88-hs-boys-batch-05.json",
  "scripts/data/uaap-s88-hs-boys-batch-06.json",
  "scripts/data/uaap-s88-hs-girls-batch-01.json",
  "scripts/data/uaap-s88-hs-girls-batch-02.json"
];

type SourceBatch = {
  league: { name: string };
  season: { name: string };
  games: Array<{ gameNumber: string }>;
};

type LoadedGame = {
  id: string;
  gameNumber: string | null;
  season: {
    name: string;
    league: { name: string };
  };
};

function gameKey(leagueName: string, seasonName: string, gameNumber: string | null) {
  return `${leagueName}||${seasonName}||${gameNumber ?? ""}`;
}

function loadValidatedGameKeys() {
  const keys = new Set<string>();

  for (const file of batchFiles) {
    const batch = JSON.parse(fs.readFileSync(path.join(root, file), "utf8")) as SourceBatch;
    for (const game of batch.games) {
      keys.add(gameKey(batch.league.name, batch.season.name, game.gameNumber));
    }
  }

  return keys;
}

function assertGamePerformanceScoreSupportsSoftDelete() {
  const schema = fs.readFileSync(schemaPath, "utf8");
  const match = schema.match(/model\s+GamePerformanceScore\s+\{[\s\S]*?\n\}/);
  if (!match || !/\bdeletedAt\s+DateTime\?/.test(match[0])) {
    throw new Error("GamePerformanceScore does not support deletedAt soft delete. Cleanup stopped before modifying data.");
  }
}

function splitValidatedGames(games: LoadedGame[], validatedKeys: Set<string>) {
  const validated = [] as LoadedGame[];
  const nonValidated = [] as LoadedGame[];

  for (const game of games) {
    const key = gameKey(game.season.league.name, game.season.name, game.gameNumber);
    if (validatedKeys.has(key)) validated.push(game);
    else nonValidated.push(game);
  }

  return { validated, nonValidated };
}

async function loadActiveGames() {
  return prisma.game.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      gameNumber: true,
      season: {
        select: {
          name: true,
          league: { select: { name: true } }
        }
      }
    }
  });
}

async function main() {
  assertGamePerformanceScoreSupportsSoftDelete();

  const validatedKeys = loadValidatedGameKeys();
  const activeGamesBefore = await loadActiveGames();
  const { validated: validatedBefore, nonValidated: nonValidatedBefore } = splitValidatedGames(activeGamesBefore, validatedKeys);
  const nonValidatedGameIds = nonValidatedBefore.map((game) => game.id);

  const [nonValidatedGameStatsAffected, nonValidatedGamePerformanceScoresAffected] = await Promise.all([
    prisma.gameStat.count({ where: { gameId: { in: nonValidatedGameIds }, deletedAt: null } }),
    prisma.gamePerformanceScore.count({ where: { gameId: { in: nonValidatedGameIds }, deletedAt: null } })
  ]);

  const mutation = await prisma.$transaction(async (tx) => {
    const gamePerformanceScores = await tx.gamePerformanceScore.updateMany({
      where: { gameId: { in: nonValidatedGameIds }, deletedAt: null },
      data: { deletedAt: new Date() }
    });

    const gameStats = await tx.gameStat.updateMany({
      where: { gameId: { in: nonValidatedGameIds }, deletedAt: null },
      data: { deletedAt: new Date() }
    });

    const games = await tx.game.updateMany({
      where: { id: { in: nonValidatedGameIds }, deletedAt: null },
      data: { deletedAt: new Date() }
    });

    return {
      gamePerformanceScoresSoftDeleted: gamePerformanceScores.count,
      gameStatsSoftDeleted: gameStats.count,
      gamesSoftDeleted: games.count
    };
  });

  const activeGamesAfter = await loadActiveGames();
  const { validated: validatedAfter, nonValidated: nonValidatedAfter } = splitValidatedGames(activeGamesAfter, validatedKeys);
  const validatedGameIdsAfter = validatedAfter.map((game) => game.id);
  const nonValidatedGameIdsAfter = nonValidatedAfter.map((game) => game.id);

  const activeValidatedGameStatsAfter = await prisma.gameStat.count({
    where: { gameId: { in: validatedGameIdsAfter }, deletedAt: null }
  });
  const activeNonValidatedGameStatsAfter = await prisma.gameStat.count({
    where: { gameId: { in: nonValidatedGameIdsAfter }, deletedAt: null }
  });

  const formulaVersion = await prisma.formulaVersion.findUnique({
    where: { versionNumber: 1 },
    select: { id: true }
  });
  const activeValidatedFormulaV1GamePerformanceScoresAfter = formulaVersion
    ? await prisma.gamePerformanceScore.count({
        where: {
          formulaVersionId: formulaVersion.id,
          gameId: { in: validatedGameIdsAfter },
          deletedAt: null,
          gameStat: { deletedAt: null }
        }
      })
    : 0;

  const output = {
    cleanup: {
      activeGamesBefore: activeGamesBefore.length,
      validatedActiveGamesBefore: validatedBefore.length,
      nonValidatedActiveGamesBefore: nonValidatedBefore.length,
      nonValidatedGameStatsAffected,
      nonValidatedGamePerformanceScoresAffected,
      gameStatsSoftDeleted: mutation.gameStatsSoftDeleted,
      gamePerformanceScoresSoftDeleted: mutation.gamePerformanceScoresSoftDeleted,
      gamesSoftDeleted: mutation.gamesSoftDeleted,
      activeGamesAfter: activeGamesAfter.length,
      activeValidatedGamesAfter: validatedAfter.length,
      activeNonValidatedGamesAfter: nonValidatedAfter.length
    },
    validation: {
      validatedActiveGamesEquals76: validatedAfter.length === 76,
      activeNonValidatedGamesEquals0: nonValidatedAfter.length === 0,
      activeGameStatRowsForValidatedGames: activeValidatedGameStatsAfter,
      activeGameStatRowsForValidatedGamesEquals1885: activeValidatedGameStatsAfter === 1885,
      activeGameStatRowsForNonValidatedGames: activeNonValidatedGameStatsAfter,
      activeGameStatRowsForNonValidatedGamesEquals0: activeNonValidatedGameStatsAfter === 0,
      activeFormulaV1GamePerformanceScoresForValidatedGames: activeValidatedFormulaV1GamePerformanceScoresAfter,
      activeFormulaV1GamePerformanceScoresForValidatedGamesEquals1885: activeValidatedFormulaV1GamePerformanceScoresAfter === 1885
    }
  };

  console.log(JSON.stringify(output, null, 2));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
