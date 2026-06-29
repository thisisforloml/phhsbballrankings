import { readFileSync } from "node:fs";
import path from "node:path";
import { AgeGroup, PlayerGender } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

const projectRoot = "D:\\Peach Basket";
const formulaVersionNumber = 1;
const expectedGameStats = 1885;

const batchGroups = [
  {
    gender: PlayerGender.BOYS,
    files: [
      "scripts/data/uaap-s88-hs-boys-batch-01.json",
      "scripts/data/uaap-s88-hs-boys-batch-02.json",
      "scripts/data/uaap-s88-hs-boys-batch-03.json",
      "scripts/data/uaap-s88-hs-boys-batch-04.json",
      "scripts/data/uaap-s88-hs-boys-batch-05.json",
      "scripts/data/uaap-s88-hs-boys-batch-06.json"
    ]
  },
  {
    gender: PlayerGender.GIRLS,
    files: [
      "scripts/data/uaap-s88-hs-girls-batch-01.json",
      "scripts/data/uaap-s88-hs-girls-batch-02.json"
    ]
  }
] as const;

type SourceData = {
  league?: {
    name?: unknown;
  };
  season?: {
    name?: unknown;
  };
  games?: SourceGame[];
};

type SourceGame = {
  gameNumber?: unknown;
  players?: SourcePlayer[];
};

type SourcePlayer = {
  name?: unknown;
};

type ExpectedRow = {
  batchFile: string;
  gameNumber: string;
  gameId: string;
  gameStatId: string;
  playerId: string;
  playerDisplayName: string;
};

type MissingGamePerformanceScore = {
  gameNumber: string;
  playerDisplayName: string;
  gameStatId: string;
  reason: string;
};

type MissingPlayerRating = {
  playerId: string;
  playerDisplayName: string;
  reason: string;
};

type MismatchedVerifiedGameCount = {
  playerId: string;
  playerDisplayName: string;
  expectedVerifiedGameCount: number;
  actualVerifiedGameCount: number;
};

type InvalidRatingRange = {
  playerId: string;
  playerDisplayName: string;
  field: "observedRating" | "adjustedRating";
  value: number;
};

type InvalidStarRating = {
  playerId: string;
  playerDisplayName: string;
  adjustedRating: number;
  expectedStarRating: number;
  actualStarRating: number;
};

function requiredString(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing or invalid ${label}.`);
  }

  return value.trim();
}

function cleanPlayerName(value: unknown) {
  let name = requiredString(value, "player.name");

  while (name.startsWith("*")) {
    name = name.slice(1).trim();
  }

  return name;
}

function loadBatch(relativePath: string) {
  const data = JSON.parse(readFileSync(path.join(projectRoot, relativePath), "utf8")) as SourceData;

  if (!data.league || !data.season || !Array.isArray(data.games)) {
    throw new Error(`${relativePath} has an invalid batch wrapper.`);
  }

  return data;
}

function isRatingOutOfRange(value: number) {
  return value < 1 || value > 100;
}

function expectedStarRatingFromAdjustedRating(adjustedRating: number) {
  if (adjustedRating >= 90) return 5;
  if (adjustedRating >= 80) return 4;
  if (adjustedRating >= 70) return 3;
  if (adjustedRating >= 60) return 2;
  return 1;
}

async function resolveExpectedRows() {
  const rows: ExpectedRow[] = [];
  const seenGameStatIds = new Set<string>();

  for (const group of batchGroups) {
    for (const batchFile of group.files) {
      const data = loadBatch(batchFile);
      const leagueName = requiredString(data.league?.name, "league.name");
      const seasonName = requiredString(data.season?.name, "season.name");
      const league = await prisma.league.findFirst({
        where: {
          name: leagueName,
          ageGroup: AgeGroup.U19,
          deletedAt: null
        },
        select: {
          id: true
        }
      });

      if (!league) {
        throw new Error(`${batchFile}: missing active U19 league ${leagueName}.`);
      }

      const season = await prisma.season.findUnique({
        where: {
          leagueId_name: {
            leagueId: league.id,
            name: seasonName
          }
        },
        select: {
          id: true,
          deletedAt: true
        }
      });

      if (!season || season.deletedAt !== null) {
        throw new Error(`${batchFile}: missing active season ${seasonName} for ${leagueName}.`);
      }

      for (const sourceGame of data.games!) {
        const gameNumber = requiredString(sourceGame.gameNumber, "game.gameNumber");
        const games = await prisma.game.findMany({
          where: {
            gameNumber,
            seasonId: season.id,
            deletedAt: null
          },
          select: {
            id: true
          }
        });

        if (games.length !== 1) {
          throw new Error(`${batchFile}: expected exactly one game for ${gameNumber}, found ${games.length}.`);
        }

        if (!Array.isArray(sourceGame.players)) {
          throw new Error(`${batchFile}: ${gameNumber} is missing players array.`);
        }

        for (const sourcePlayer of sourceGame.players) {
          const displayName = cleanPlayerName(sourcePlayer.name);
          const players = await prisma.player.findMany({
            where: {
              displayName,
              gender: group.gender,
              deletedAt: null
            },
            select: {
              id: true,
              displayName: true
            }
          });

          if (players.length !== 1) {
            throw new Error(`${batchFile}: expected exactly one ${group.gender} player for ${displayName}, found ${players.length}.`);
          }

          const gameStat = await prisma.gameStat.findUnique({
            where: {
              gameId_playerId: {
                gameId: games[0].id,
                playerId: players[0].id
              }
            },
            select: {
              id: true,
              deletedAt: true
            }
          });

          if (!gameStat || gameStat.deletedAt !== null) {
            throw new Error(`${batchFile}: missing active GameStat for ${gameNumber} / ${displayName}.`);
          }

          if (seenGameStatIds.has(gameStat.id)) {
            throw new Error(`Duplicate expected GameStat id found: ${gameStat.id}.`);
          }

          seenGameStatIds.add(gameStat.id);
          rows.push({
            batchFile,
            gameNumber,
            gameId: games[0].id,
            gameStatId: gameStat.id,
            playerId: players[0].id,
            playerDisplayName: players[0].displayName
          });
        }
      }
    }
  }

  return rows;
}

async function main() {
  const formulaVersion = await prisma.formulaVersion.findUnique({
    where: {
      versionNumber: formulaVersionNumber
    },
    select: {
      id: true
    }
  });

  const expectedRows = await resolveExpectedRows();
  const expectedGameStatIds = new Set(expectedRows.map((row) => row.gameStatId));
  const missingGamePerformanceScores: MissingGamePerformanceScore[] = [];
  const gamePerformanceScoresByPlayer = new Map<string, number>();
  let gamePerformanceScoresChecked = 0;

  if (formulaVersion) {
    for (const row of expectedRows) {
      const scores = await prisma.gamePerformanceScore.findMany({
        where: {
          gameStatId: row.gameStatId,
          formulaVersionId: formulaVersion.id,
          deletedAt: null
        },
        select: {
          id: true
        }
      });

      if (scores.length !== 1) {
        missingGamePerformanceScores.push({
          gameNumber: row.gameNumber,
          playerDisplayName: row.playerDisplayName,
          gameStatId: row.gameStatId,
          reason: `Expected exactly one Formula v1 GamePerformanceScore, found ${scores.length}.`
        });
        continue;
      }

      gamePerformanceScoresChecked += 1;
      gamePerformanceScoresByPlayer.set(row.playerId, (gamePerformanceScoresByPlayer.get(row.playerId) ?? 0) + 1);
    }
  } else {
    for (const row of expectedRows) {
      missingGamePerformanceScores.push({
        gameNumber: row.gameNumber,
        playerDisplayName: row.playerDisplayName,
        gameStatId: row.gameStatId,
        reason: `FormulaVersion versionNumber ${formulaVersionNumber} does not exist.`
      });
    }
  }

  const totalValidatedGamePerformanceScores = formulaVersion
    ? await prisma.gamePerformanceScore.count({
        where: {
          formulaVersionId: formulaVersion.id,
          deletedAt: null,
          gameStatId: {
            in: [...expectedGameStatIds]
          }
        }
      })
    : 0;

  const playerDisplayNames = new Map<string, string>();
  for (const row of expectedRows) {
    playerDisplayNames.set(row.playerId, row.playerDisplayName);
  }

  const missingPlayerRatings: MissingPlayerRating[] = [];
  const mismatchedVerifiedGameCounts: MismatchedVerifiedGameCount[] = [];
  const invalidRatingRanges: InvalidRatingRange[] = [];
  const invalidStarRatings: InvalidStarRating[] = [];
  let playerRatingsChecked = 0;

  for (const [playerId, expectedCount] of gamePerformanceScoresByPlayer) {
    const displayName = playerDisplayNames.get(playerId) ?? playerId;
    const playerRating = await prisma.playerRating.findUnique({
      where: {
        playerId_ageGroup: {
          playerId,
          ageGroup: AgeGroup.U19
        }
      },
      select: {
        observedRating: true,
        adjustedRating: true,
        verifiedGameCount: true,
        starRating: true
      }
    });

    if (!playerRating) {
      missingPlayerRatings.push({
        playerId,
        playerDisplayName: displayName,
        reason: "Missing PlayerRating for playerId + ageGroup U19."
      });
      continue;
    }

    playerRatingsChecked += 1;

    if (playerRating.verifiedGameCount !== expectedCount) {
      mismatchedVerifiedGameCounts.push({
        playerId,
        playerDisplayName: displayName,
        expectedVerifiedGameCount: expectedCount,
        actualVerifiedGameCount: playerRating.verifiedGameCount
      });
    }

    const observedRating = Number(playerRating.observedRating);
    const adjustedRating = Number(playerRating.adjustedRating);

    if (isRatingOutOfRange(observedRating)) {
      invalidRatingRanges.push({
        playerId,
        playerDisplayName: displayName,
        field: "observedRating",
        value: observedRating
      });
    }

    if (isRatingOutOfRange(adjustedRating)) {
      invalidRatingRanges.push({
        playerId,
        playerDisplayName: displayName,
        field: "adjustedRating",
        value: adjustedRating
      });
    }

    const expectedStarRating = expectedStarRatingFromAdjustedRating(adjustedRating);

    if (playerRating.starRating !== expectedStarRating) {
      invalidStarRatings.push({
        playerId,
        playerDisplayName: displayName,
        adjustedRating,
        expectedStarRating,
        actualStarRating: playerRating.starRating
      });
    }
  }

  const rankingSnapshotsFound = await prisma.rankingSnapshot.count();
  const playersChecked = gamePerformanceScoresByPlayer.size;
  const validationPassed =
    Boolean(formulaVersion) &&
    expectedRows.length === expectedGameStats &&
    totalValidatedGamePerformanceScores === expectedGameStats &&
    gamePerformanceScoresChecked === expectedGameStats &&
    missingGamePerformanceScores.length === 0 &&
    missingPlayerRatings.length === 0 &&
    mismatchedVerifiedGameCounts.length === 0 &&
    invalidRatingRanges.length === 0 &&
    invalidStarRatings.length === 0;

  console.log(
    JSON.stringify(
      {
        formulaVersionId: formulaVersion?.id ?? null,
        expectedGameStats: expectedRows.length,
        gamePerformanceScoresChecked,
        playersChecked,
        playerRatingsChecked,
        missingGamePerformanceScores,
        missingPlayerRatings,
        mismatchedVerifiedGameCounts,
        invalidRatingRanges,
        invalidStarRatings,
        rankingSnapshotsFound,
        validationPassed
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

