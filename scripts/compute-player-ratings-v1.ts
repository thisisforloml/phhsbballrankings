import { readFileSync } from "node:fs";
import path from "node:path";
import { AgeGroup, PlayerGender } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

const projectRoot = "D:\\OnCourt Rankings PH";
const formulaVersionNumber = 1;
const expectedTotalGamePerformanceScores = 1885;

const pools = [
  {
    label: "U19 + BOYS + UAAP Season 88 HS Boys Basketball / Season 88",
    leagueName: "UAAP Season 88 HS Boys Basketball",
    ageGroup: AgeGroup.U19,
    gender: PlayerGender.BOYS,
    seasonName: "Season 88",
    expectedGamePerformanceScores: 1554,
    batchFiles: [
      "scripts/data/uaap-s88-hs-boys-batch-01.json",
      "scripts/data/uaap-s88-hs-boys-batch-02.json",
      "scripts/data/uaap-s88-hs-boys-batch-03.json",
      "scripts/data/uaap-s88-hs-boys-batch-04.json",
      "scripts/data/uaap-s88-hs-boys-batch-05.json",
      "scripts/data/uaap-s88-hs-boys-batch-06.json"
    ]
  },
  {
    label: "U19 + GIRLS + UAAP Season 88 HS Girls Basketball / Season 88",
    leagueName: "UAAP Season 88 HS Girls Basketball",
    ageGroup: AgeGroup.U19,
    gender: PlayerGender.GIRLS,
    seasonName: "Season 88",
    expectedGamePerformanceScores: 331,
    batchFiles: [
      "scripts/data/uaap-s88-hs-girls-batch-01.json",
      "scripts/data/uaap-s88-hs-girls-batch-02.json"
    ]
  }
] as const;

type SourceLeague = {
  name?: unknown;
  ageGroup?: unknown;
};

type SourceSeason = {
  name?: unknown;
};

type SourcePlayer = {
  name?: unknown;
};

type SourceGame = {
  gameNumber?: unknown;
  players?: SourcePlayer[];
};

type SourceData = {
  league?: SourceLeague;
  season?: SourceSeason;
  games?: SourceGame[];
};

type PlayerScore = {
  playerId: string;
  displayName: string;
  scores: number[];
};

type PlayerRatingInput = {
  playerId: string;
  displayName: string;
  observedRating: number;
  adjustedRating: number;
  verifiedGameCount: number;
  starRating: number;
  pool: string;
  gender: PlayerGender;
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

function parseAgeGroup(value: unknown) {
  const ageGroup = requiredString(value, "league.ageGroup");

  if (!Object.values(AgeGroup).includes(ageGroup as AgeGroup)) {
    throw new Error(`Unsupported ageGroup: ${ageGroup}`);
  }

  return ageGroup as AgeGroup;
}

function loadBatch(relativePath: string) {
  const data = JSON.parse(readFileSync(path.join(projectRoot, relativePath), "utf8")) as SourceData;

  if (!data.league || !data.season || !Array.isArray(data.games)) {
    throw new Error(`${relativePath} has an invalid batch wrapper.`);
  }

  return data;
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function starFromAdjustedRating(adjustedRating: number) {
  if (adjustedRating >= 90) return 5;
  if (adjustedRating >= 80) return 4;
  if (adjustedRating >= 70) return 3;
  if (adjustedRating >= 60) return 2;
  return 1;
}

async function resolveSeasonId(data: SourceData) {
  const leagueName = requiredString(data.league?.name, "league.name");
  const ageGroup = parseAgeGroup(data.league?.ageGroup);
  const seasonName = requiredString(data.season?.name, "season.name");
  const league = await prisma.league.findFirst({
    where: {
      name: leagueName,
      ageGroup,
      deletedAt: null
    }
  });

  if (!league) {
    throw new Error(`Missing active league: ${leagueName} (${ageGroup}).`);
  }

  const season = await prisma.season.findUnique({
    where: {
      leagueId_name: {
        leagueId: league.id,
        name: seasonName
      }
    }
  });

  if (!season || season.deletedAt !== null) {
    throw new Error(`Missing active season: ${seasonName} for ${leagueName}.`);
  }

  return season.id;
}

async function resolveGamePerformanceScore(params: {
  batchPath: string;
  formulaVersionId: string;
  seasonId: string;
  gameNumber: string;
  playerName: string;
  gender: PlayerGender;
}) {
  const games = await prisma.game.findMany({
    where: {
      gameNumber: params.gameNumber,
      seasonId: params.seasonId,
      deletedAt: null
    },
    select: {
      id: true
    }
  });

  if (games.length !== 1) {
    throw new Error(`${params.batchPath}: expected exactly one game for ${params.gameNumber}, found ${games.length}.`);
  }

  const displayName = cleanPlayerName(params.playerName);
  const players = await prisma.player.findMany({
    where: {
      displayName,
      gender: params.gender,
      deletedAt: null
    },
    select: {
      id: true,
      displayName: true
    }
  });

  if (players.length !== 1) {
    throw new Error(`${params.batchPath}: expected exactly one ${params.gender} player for ${displayName}, found ${players.length}.`);
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
    throw new Error(`${params.batchPath}: missing active GameStat for ${params.gameNumber} / ${displayName}.`);
  }

  const gamePerformanceScore = await prisma.gamePerformanceScore.findUnique({
    where: {
      gameStatId: gameStat.id
    },
    select: {
      id: true,
      formulaVersionId: true,
      finalPerformanceScore: true,
      deletedAt: true
    }
  });

  if (!gamePerformanceScore || gamePerformanceScore.deletedAt !== null) {
    throw new Error(`${params.batchPath}: missing active GamePerformanceScore for ${params.gameNumber} / ${displayName}.`);
  }

  if (gamePerformanceScore.formulaVersionId !== params.formulaVersionId) {
    throw new Error(`${params.batchPath}: GamePerformanceScore ${gamePerformanceScore.id} does not use FormulaVersion v1.`);
  }

  if (gamePerformanceScore.finalPerformanceScore === null) {
    throw new Error(`${params.batchPath}: GamePerformanceScore ${gamePerformanceScore.id} is missing finalPerformanceScore.`);
  }

  return {
    gamePerformanceScoreId: gamePerformanceScore.id,
    playerId: players[0].id,
    displayName: players[0].displayName,
    finalPerformanceScore: Number(gamePerformanceScore.finalPerformanceScore)
  };
}

async function loadPoolPlayerScores(pool: (typeof pools)[number], formulaVersionId: string) {
  const seenGamePerformanceScoreIds = new Set<string>();
  const playerScores = new Map<string, PlayerScore>();
  let loadedGamePerformanceScores = 0;

  for (const batchPath of pool.batchFiles) {
    const data = loadBatch(batchPath);
    const seasonId = await resolveSeasonId(data);

    for (const sourceGame of data.games!) {
      const gameNumber = requiredString(sourceGame.gameNumber, "game.gameNumber");

      if (!Array.isArray(sourceGame.players)) {
        throw new Error(`${batchPath}: ${gameNumber} is missing players array.`);
      }

      for (const sourcePlayer of sourceGame.players) {
        const score = await resolveGamePerformanceScore({
          batchPath,
          formulaVersionId,
          seasonId,
          gameNumber,
          playerName: requiredString(sourcePlayer.name, "player.name"),
          gender: pool.gender
        });

        if (seenGamePerformanceScoreIds.has(score.gamePerformanceScoreId)) {
          throw new Error(`Duplicate GamePerformanceScore id found while building expected set: ${score.gamePerformanceScoreId}.`);
        }

        seenGamePerformanceScoreIds.add(score.gamePerformanceScoreId);
        loadedGamePerformanceScores += 1;

        const existing = playerScores.get(score.playerId);
        if (existing) {
          existing.scores.push(score.finalPerformanceScore);
        } else {
          playerScores.set(score.playerId, {
            playerId: score.playerId,
            displayName: score.displayName,
            scores: [score.finalPerformanceScore]
          });
        }
      }
    }
  }

  if (loadedGamePerformanceScores !== pool.expectedGamePerformanceScores) {
    throw new Error(`${pool.label}: expected ${pool.expectedGamePerformanceScores} GamePerformanceScores, got ${loadedGamePerformanceScores}.`);
  }

  return {
    loadedGamePerformanceScores,
    playerScores: [...playerScores.values()]
  };
}

function buildPlayerRatingInputs(pool: (typeof pools)[number], playerScores: PlayerScore[]) {
  return playerScores.map((player) => {
    const observedRating = average(player.scores);
    const adjustedRating = observedRating;

    return {
      playerId: player.playerId,
      displayName: player.displayName,
      observedRating,
      adjustedRating,
      verifiedGameCount: player.scores.length,
      starRating: starFromAdjustedRating(adjustedRating),
      pool: pool.label,
      gender: pool.gender
    };
  });
}

async function main() {
  const formulaVersion = await prisma.formulaVersion.findUnique({
    where: {
      versionNumber: formulaVersionNumber
    }
  });

  if (!formulaVersion) {
    throw new Error(`Missing FormulaVersion versionNumber ${formulaVersionNumber}.`);
  }

  const allRatingInputs: PlayerRatingInput[] = [];
  const poolSummaries = [];
  let totalLoadedGamePerformanceScores = 0;

  for (const pool of pools) {
    const poolScores = await loadPoolPlayerScores(pool, formulaVersion.id);
    totalLoadedGamePerformanceScores += poolScores.loadedGamePerformanceScores;
    const ratingInputs = buildPlayerRatingInputs(pool, poolScores.playerScores);
    allRatingInputs.push(...ratingInputs);
    poolSummaries.push({
      label: pool.label,
      loadedGamePerformanceScores: poolScores.loadedGamePerformanceScores,
      playersProcessed: ratingInputs.length
    });
  }

  if (totalLoadedGamePerformanceScores !== expectedTotalGamePerformanceScores) {
    throw new Error(`Expected ${expectedTotalGamePerformanceScores} total GamePerformanceScores, got ${totalLoadedGamePerformanceScores}.`);
  }

  let playerRatingsCreated = 0;
  let playerRatingsUpdated = 0;

  for (const rating of allRatingInputs) {
    const existing = await prisma.playerRating.findUnique({
      where: {
        playerId_ageGroup: {
          playerId: rating.playerId,
          ageGroup: AgeGroup.U19
        }
      },
      select: {
        id: true
      }
    });

    await prisma.playerRating.upsert({
      where: {
        playerId_ageGroup: {
          playerId: rating.playerId,
          ageGroup: AgeGroup.U19
        }
      },
      update: {
        observedRating: rating.observedRating,
        adjustedRating: rating.adjustedRating,
        verifiedGameCount: rating.verifiedGameCount,
        starRating: rating.starRating
      },
      create: {
        playerId: rating.playerId,
        ageGroup: AgeGroup.U19,
        observedRating: rating.observedRating,
        adjustedRating: rating.adjustedRating,
        verifiedGameCount: rating.verifiedGameCount,
        starRating: rating.starRating
      }
    });

    if (existing) {
      playerRatingsUpdated += 1;
    } else {
      playerRatingsCreated += 1;
    }
  }

  const observedRatings = allRatingInputs.map((rating) => rating.observedRating);
  const starDistribution = allRatingInputs.reduce<Record<string, number>>((distribution, rating) => {
    distribution[String(rating.starRating)] = (distribution[String(rating.starRating)] ?? 0) + 1;
    return distribution;
  }, {});
  const playersBelow15Games = allRatingInputs.filter((rating) => rating.verifiedGameCount < 15).length;
  const top10Preview = pools.map((pool) => ({
    pool: pool.label,
    players: allRatingInputs
      .filter((rating) => rating.pool === pool.label)
      .sort((left, right) => right.observedRating - left.observedRating)
      .slice(0, 10)
      .map((rating) => ({
        playerId: rating.playerId,
        displayName: rating.displayName,
        observedRating: rating.observedRating,
        adjustedRating: rating.adjustedRating,
        verifiedGameCount: rating.verifiedGameCount,
        starRating: rating.starRating
      }))
  }));

  console.log(
    JSON.stringify(
      {
        formulaVersionId: formulaVersion.id,
        totalEligibleGamePerformanceScores: totalLoadedGamePerformanceScores,
        totalPlayersProcessed: allRatingInputs.length,
        playerRatingsCreated,
        playerRatingsUpdated,
        boysPlayersProcessed: allRatingInputs.filter((rating) => rating.gender === PlayerGender.BOYS).length,
        girlsPlayersProcessed: allRatingInputs.filter((rating) => rating.gender === PlayerGender.GIRLS).length,
        minObservedRating: observedRatings.length ? Math.min(...observedRatings) : null,
        maxObservedRating: observedRatings.length ? Math.max(...observedRatings) : null,
        starDistribution,
        playersBelow15Games,
        poolsProcessed: poolSummaries,
        top10Preview
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




