import { readFileSync } from "node:fs";
import path from "node:path";
import { AgeGroup, PlayerGender } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

const projectRoot = "D:\\OnCourt Rankings PH";
const formulaVersionNumber = 1;
const formulaDescription = "Formula v1 possession-informed transparent baseline box-score model";
const expectedTotalEligibleGameStats = 1885;

const assumptions = {
  assistCreationShare: 0.35,
  blockRetentionFactor: 0.6,
  stealFactor: 1,
  foulDrawnFactor: 0.35,
  foulCostFactor: 0.35,
  offensiveReboundValueFactor: 1,
  scaling: "percentile",
  leagueWeight: 1,
  opponentFactor: 1,
  teamFactor: 1
} as const;

const pools = [
  {
    label: "U19 + BOYS + UAAP Season 88 HS Boys Basketball / Season 88",
    leagueName: "UAAP Season 88 HS Boys Basketball",
    ageGroup: AgeGroup.U19,
    gender: PlayerGender.BOYS,
    seasonName: "Season 88",
    expectedEligibleGameStats: 1554,
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
    expectedEligibleGameStats: 331,
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

type RequiredGameStat = {
  id: string;
  gameId: string;
  playerId: string;
  points: number;
  fieldGoalsMade: number | null;
  fieldGoalsAttempt: number | null;
  threeMade: number | null;
  threeAttempt: number | null;
  freeThrowsMade: number | null;
  freeThrowsAttempt: number | null;
  offensiveRebounds: number | null;
  defensiveRebounds: number | null;
  rebounds: number;
  assists: number;
  steals: number | null;
  blocks: number | null;
  turnovers: number | null;
  fouls: number | null;
  foulsDrawn: number | null;
};

type ComputedGameScore = {
  stat: RequiredGameStat;
  rawGameValue: number;
  scaledGameScore: number;
  effectiveFieldGoalPct: number | null;
  trueShootingPct: number | null;
};

type SkippedRow = {
  pool: string;
  gameStatId: string;
  playerId: string;
  reasons: string[];
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

function requireStatFields(pool: string, stat: RequiredGameStat): SkippedRow | null {
  const requiredFields: Array<keyof RequiredGameStat> = [
    "points",
    "fieldGoalsMade",
    "fieldGoalsAttempt",
    "threeMade",
    "threeAttempt",
    "freeThrowsMade",
    "freeThrowsAttempt",
    "offensiveRebounds",
    "defensiveRebounds",
    "rebounds",
    "assists",
    "steals",
    "blocks",
    "turnovers",
    "fouls",
    "foulsDrawn"
  ];
  const reasons = requiredFields
    .filter((field) => stat[field] === null || stat[field] === undefined)
    .map((field) => `Missing ${field}.`);

  if (!reasons.length) return null;
  return {
    pool,
    gameStatId: stat.id,
    playerId: stat.playerId,
    reasons
  };
}

function safeDivide(numerator: number, denominator: number) {
  return denominator === 0 ? null : numerator / denominator;
}

function percentileScale(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const valueToPercentile = new Map<number, number>();

  for (let index = 0; index < sorted.length; index += 1) {
    const value = sorted[index];
    if (valueToPercentile.has(value)) continue;

    let lastIndex = index;
    while (lastIndex + 1 < sorted.length && sorted[lastIndex + 1] === value) {
      lastIndex += 1;
    }

    const averageRankIndex = (index + lastIndex) / 2;
    const percentile = sorted.length === 1 ? 1 : averageRankIndex / (sorted.length - 1);
    valueToPercentile.set(value, percentile);
    index = lastIndex;
  }

  return values.map((value) => 1 + (valueToPercentile.get(value) ?? 0) * 99);
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

async function resolveGameStatFromSourceRow(params: {
  batchPath: string;
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
      id: true
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
      gameId: true,
      playerId: true,
      points: true,
      fieldGoalsMade: true,
      fieldGoalsAttempt: true,
      threeMade: true,
      threeAttempt: true,
      freeThrowsMade: true,
      freeThrowsAttempt: true,
      offensiveRebounds: true,
      defensiveRebounds: true,
      rebounds: true,
      assists: true,
      steals: true,
      blocks: true,
      turnovers: true,
      fouls: true,
      foulsDrawn: true,
      deletedAt: true
    }
  });

  if (!gameStat || gameStat.deletedAt !== null) {
    throw new Error(`${params.batchPath}: missing active GameStat for ${params.gameNumber} / ${displayName}.`);
  }

  return gameStat;
}

async function loadPoolStats(pool: (typeof pools)[number]) {
  const stats: RequiredGameStat[] = [];
  const seenGameStatIds = new Set<string>();

  for (const batchPath of pool.batchFiles) {
    const data = loadBatch(batchPath);
    const seasonId = await resolveSeasonId(data);

    for (const sourceGame of data.games!) {
      const gameNumber = requiredString(sourceGame.gameNumber, "game.gameNumber");

      if (!Array.isArray(sourceGame.players)) {
        throw new Error(`${batchPath}: ${gameNumber} is missing players array.`);
      }

      for (const sourcePlayer of sourceGame.players) {
        const gameStat = await resolveGameStatFromSourceRow({
          batchPath,
          seasonId,
          gameNumber,
          playerName: requiredString(sourcePlayer.name, "player.name"),
          gender: pool.gender
        });

        if (seenGameStatIds.has(gameStat.id)) {
          throw new Error(`Duplicate GameStat id found while building expected set: ${gameStat.id}.`);
        }

        seenGameStatIds.add(gameStat.id);
        stats.push(gameStat);
      }
    }
  }

  if (stats.length !== pool.expectedEligibleGameStats) {
    throw new Error(`${pool.label}: expected ${pool.expectedEligibleGameStats} eligible GameStats, got ${stats.length}.`);
  }

  return stats;
}

function computePoolScores(pool: string, stats: RequiredGameStat[]) {
  const skippedRows: SkippedRow[] = [];
  const eligibleStats = stats.filter((stat) => {
    const skipped = requireStatFields(pool, stat);
    if (skipped) {
      skippedRows.push(skipped);
      return false;
    }

    return true;
  });

  const totals = eligibleStats.reduce(
    (sum, stat) => {
      const fga = stat.fieldGoalsAttempt!;
      const oreb = stat.offensiveRebounds!;
      const tov = stat.turnovers!;
      const fta = stat.freeThrowsAttempt!;
      const dreb = stat.defensiveRebounds!;

      return {
        points: sum.points + stat.points,
        fga: sum.fga + fga,
        oreb: sum.oreb + oreb,
        dreb: sum.dreb + dreb,
        tov: sum.tov + tov,
        fta: sum.fta + fta
      };
    },
    { points: 0, fga: 0, oreb: 0, dreb: 0, tov: 0, fta: 0 }
  );

  const leaguePossessions = totals.fga - totals.oreb + totals.tov + 0.44 * totals.fta;
  const leaguePPP = safeDivide(totals.points, leaguePossessions);
  // At the full league-season pool level, total opponent offensive rebounds equals total offensive rebounds,
  // and total opponent defensive rebounds equals total defensive rebounds, so pooled OREB/DREB totals are
  // used as the opponent rebound totals approximation.
  const leagueDefRebRate = safeDivide(totals.dreb, totals.dreb + totals.oreb);
  const leagueOffRebRate = safeDivide(totals.oreb, totals.oreb + totals.dreb);

  if (leaguePPP === null || leagueDefRebRate === null || leagueOffRebRate === null) {
    throw new Error(`Could not compute league context for ${pool}.`);
  }

  const rawScores = eligibleStats.map((stat) => {
    const fgm = stat.fieldGoalsMade!;
    const fga = stat.fieldGoalsAttempt!;
    const threeMade = stat.threeMade!;
    const threeAttempt = stat.threeAttempt!;
    const ftm = stat.freeThrowsMade!;
    const fta = stat.freeThrowsAttempt!;
    const oreb = stat.offensiveRebounds!;
    const dreb = stat.defensiveRebounds!;
    const assists = stat.assists;
    const steals = stat.steals!;
    const blocks = stat.blocks!;
    const turnovers = stat.turnovers!;
    const fouls = stat.fouls!;
    const foulsDrawn = stat.foulsDrawn!;
    const missedFG = fga - fgm;
    const missedFT = fta - ftm;
    const twoMade = fgm - threeMade;
    const twoAttempt = fga - threeAttempt;

    if (missedFG < 0) throw new Error(`Invalid missedFG for GameStat ${stat.id}.`);
    if (missedFT < 0) throw new Error(`Invalid missedFT for GameStat ${stat.id}.`);
    if (twoMade < 0) throw new Error(`Invalid twoMade for GameStat ${stat.id}.`);
    if (twoAttempt < 0) throw new Error(`Invalid twoAttempt for GameStat ${stat.id}.`);

    const effectiveFieldGoalPct = fga === 0 ? null : (fgm + 0.5 * threeMade) / fga;
    const trueShootingDenominator = 2 * (fga + 0.44 * fta);
    const trueShootingPct = trueShootingDenominator === 0 ? null : stat.points / trueShootingDenominator;
    const rawGameValue =
      stat.points +
      oreb * leaguePPP * assumptions.offensiveReboundValueFactor +
      dreb * leaguePPP * leagueOffRebRate +
      assists * leaguePPP * assumptions.assistCreationShare +
      steals * leaguePPP * assumptions.stealFactor +
      blocks * leaguePPP * assumptions.blockRetentionFactor +
      foulsDrawn * leaguePPP * assumptions.foulDrawnFactor -
      missedFG * leaguePPP * leagueDefRebRate -
      missedFT * 0.44 * leaguePPP -
      turnovers * leaguePPP -
      fouls * leaguePPP * assumptions.foulCostFactor;

    return {
      stat,
      rawGameValue,
      scaledGameScore: 0,
      effectiveFieldGoalPct,
      trueShootingPct
    };
  });

  const scaledScores = percentileScale(rawScores.map((score) => score.rawGameValue));
  const scores = rawScores.map((score, index) => ({
    ...score,
    scaledGameScore: scaledScores[index]
  }));

  return {
    skippedRows,
    scores,
    context: {
      leaguePossessions,
      leaguePPP,
      leagueDefRebRate,
      leagueOffRebRate
    }
  };
}

async function main() {
  const now = new Date();
  const formulaVersion = await prisma.formulaVersion.upsert({
    where: {
      versionNumber: formulaVersionNumber
    },
    update: {
      description: formulaDescription,
      isPublic: false,
      weights: assumptions
    },
    create: {
      versionNumber: formulaVersionNumber,
      description: formulaDescription,
      isPublic: false,
      weights: assumptions,
      effectiveFrom: now
    }
  });

  const skippedRows: SkippedRow[] = [];
  const allScores: ComputedGameScore[] = [];
  const allGameStatIds = new Set<string>();
  const poolsProcessed = [];

  for (const pool of pools) {
    const stats = await loadPoolStats(pool);
    const result = computePoolScores(pool.label, stats);
    skippedRows.push(...result.skippedRows);
    allScores.push(...result.scores);
    for (const stat of stats) allGameStatIds.add(stat.id);
    poolsProcessed.push({
      label: pool.label,
      loadedGameStats: stats.length,
      eligibleGameStats: result.scores.length,
      skippedRows: result.skippedRows.length,
      ...result.context
    });
  }

  if (allScores.length !== expectedTotalEligibleGameStats) {
    throw new Error(`Expected ${expectedTotalEligibleGameStats} total eligible GameStats, got ${allScores.length}.`);
  }

  if (allGameStatIds.size !== expectedTotalEligibleGameStats) {
    throw new Error(`Expected ${expectedTotalEligibleGameStats} unique GameStat ids, got ${allGameStatIds.size}.`);
  }

  let gamePerformanceScoresCreated = 0;
  let gamePerformanceScoresUpdated = 0;

  for (const score of allScores) {
    const existing = await prisma.gamePerformanceScore.findUnique({
      where: {
        gameStatId: score.stat.id
      },
      select: {
        id: true
      }
    });

    await prisma.gamePerformanceScore.upsert({
      where: {
        gameStatId: score.stat.id
      },
      update: {
        gameId: score.stat.gameId,
        playerId: score.stat.playerId,
        formulaVersionId: formulaVersion.id,
        productionScore: score.rawGameValue,
        leagueWeight: assumptions.leagueWeight,
        opponentFactor: assumptions.opponentFactor,
        teamFactor: assumptions.teamFactor,
        performanceScore: score.scaledGameScore,
        formulaVersionTag: formulaVersionNumber,
        effectiveFieldGoalPct: score.effectiveFieldGoalPct,
        trueShootingPct: score.trueShootingPct,
        finalPerformanceScore: score.scaledGameScore,
        processedAt: now,
        deletedAt: null
      },
      create: {
        gameId: score.stat.gameId,
        gameStatId: score.stat.id,
        playerId: score.stat.playerId,
        formulaVersionId: formulaVersion.id,
        productionScore: score.rawGameValue,
        leagueWeight: assumptions.leagueWeight,
        opponentFactor: assumptions.opponentFactor,
        teamFactor: assumptions.teamFactor,
        performanceScore: score.scaledGameScore,
        formulaVersionTag: formulaVersionNumber,
        effectiveFieldGoalPct: score.effectiveFieldGoalPct,
        trueShootingPct: score.trueShootingPct,
        finalPerformanceScore: score.scaledGameScore,
        processedAt: now
      }
    });

    if (existing) {
      gamePerformanceScoresUpdated += 1;
    } else {
      gamePerformanceScoresCreated += 1;
    }
  }

  const rawValues = allScores.map((score) => score.rawGameValue);
  const scaledValues = allScores.map((score) => score.scaledGameScore);

  console.log(
    JSON.stringify(
      {
        formulaVersionId: formulaVersion.id,
        poolsProcessed,
        totalEligibleGameStats: allScores.length,
        gamePerformanceScoresCreated,
        gamePerformanceScoresUpdated,
        skippedRows,
        minRawGameValue: rawValues.length ? Math.min(...rawValues) : null,
        maxRawGameValue: rawValues.length ? Math.max(...rawValues) : null,
        minScaledGameScore: scaledValues.length ? Math.min(...scaledValues) : null,
        maxScaledGameScore: scaledValues.length ? Math.max(...scaledValues) : null
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

