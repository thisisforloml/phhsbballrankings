import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { AgeGroup, PlayerGender, VerificationStatus } from "@prisma/client";
import { computeFormulaV2LeagueContext, computeFormulaV2RawGameValue, percentileScaleToRating, weeklyGameWeight } from "../src/lib/advanced-metrics";
import { normalizeCompetitionDisplayName } from "../src/lib/competition-naming";
import { prisma } from "../src/lib/prisma";

const projectRoot = "D:\\Peach Basket";
const reportsDir = path.join(projectRoot, "scripts", "reports");
const jsonReportPath = path.join(reportsDir, "formula-v2-preview.json");
const markdownReportPath = path.join(reportsDir, "formula-v2-preview.md");

type OfficialStat = Awaited<ReturnType<typeof loadOfficialStats>>[number];

type BoardKey = `${AgeGroup}:${PlayerGender}`;

type LeaguePool = {
  key: string;
  ageGroup: AgeGroup;
  gender: PlayerGender;
  competitionName: string;
  seasonName: string;
  gameStats: number;
  games: number;
  averages: ReturnType<typeof computeFormulaV2LeagueContext>;
};

type ScoredGame = {
  gameStatId: string;
  gameId: string;
  gameNumber: string | null;
  gameDate: Date;
  playerId: string;
  displayName: string;
  currentProgram: string | null;
  position: string | null;
  ageGroup: AgeGroup;
  gender: PlayerGender;
  competitionName: string;
  seasonName: string;
  poolKey: string;
  rawGameValue: number;
  v2PerformanceScore: number;
  currentProductionGameScore: number | null;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls: number;
  foulsDrawn: number | null;
};

type PlayerCandidate = {
  playerId: string;
  displayName: string;
  currentProgram: string | null;
  position: string | null;
  ageGroup: AgeGroup;
  gender: PlayerGender;
  games: number;
  v2Rating: number;
  currentProductionRating: number | null;
  currentVerifiedGameCount: number | null;
  currentStarRating: number | null;
  starRating: number;
  eligible: boolean;
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  tov: number;
  gameRefs: string[];
  rank: number;
  currentRank: number | null;
  rankDelta: number | null;
};

type BoardReport = {
  key: BoardKey;
  label: string;
  ageGroup: AgeGroup;
  gender: PlayerGender;
  input: {
    games: number;
    gameStats: number;
    players: number;
    scalingPools: number;
    eligiblePlayers: number;
  };
  top10: PlayerCandidate[];
  top10SideBySide: Array<{
    rank: number;
    formulaV2: string;
    currentProduction: string;
  }>;
  starDistribution: Record<string, number>;
  currentStarDistribution: Record<string, number>;
  biggestRisers: PlayerCandidate[];
  biggestFallers: PlayerCandidate[];
  lowGameOutliers: PlayerCandidate[];
  ratingDistribution: {
    min: number;
    p25: number;
    median: number;
    p75: number;
    max: number;
    mean: number;
  } | null;
};

function round(value: number, places = 2) {
  return Number(value.toFixed(places));
}

function numberValue(value: unknown, fallback = 0) {
  if (value === null || value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function weightedAverage(values: Array<{ value: number; weight: number }>) {
  const totalWeight = values.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight === 0) return 0;
  return values.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight;
}

function starRating(value: number) {
  if (value >= 90) return 5;
  if (value >= 80) return 4;
  if (value >= 70) return 3;
  if (value >= 60) return 2;
  return 1;
}

function displayGender(gender: PlayerGender) {
  return gender === PlayerGender.GIRLS ? "Girls" : "Boys";
}

function minimumGames(gender: PlayerGender) {
  return gender === PlayerGender.GIRLS ? 5 : 10;
}

function competitionName(stat: OfficialStat) {
  return normalizeCompetitionDisplayName(stat.game.season.league.name) || stat.game.season.league.name;
}

function seasonName(stat: OfficialStat) {
  const competition = competitionName(stat);
  return competition === "PYBC 15U" ? "Full Competition" : stat.game.season.name;
}

function boardKey(ageGroup: AgeGroup, gender: PlayerGender): BoardKey {
  return `${ageGroup}:${gender}`;
}

function poolKey(stat: OfficialStat) {
  return [
    stat.game.season.league.ageGroup,
    stat.player.gender,
    competitionName(stat),
    seasonName(stat)
  ].join("::");
}

function currentGameScore(stat: OfficialStat) {
  const finalScore = stat.performanceScore?.finalPerformanceScore;
  const performanceScore = stat.performanceScore?.performanceScore;
  if (finalScore !== null && finalScore !== undefined) return numberValue(finalScore);
  if (performanceScore !== null && performanceScore !== undefined) return numberValue(performanceScore);
  return null;
}

function missingInputWarnings(stats: OfficialStat[]) {
  const requiredFields: Array<keyof Pick<OfficialStat, "fieldGoalsMade" | "fieldGoalsAttempt" | "freeThrowsMade" | "freeThrowsAttempt" | "offensiveRebounds" | "defensiveRebounds" | "rebounds" | "assists" | "steals" | "blocks" | "turnovers" | "fouls">> = [
    "fieldGoalsMade",
    "fieldGoalsAttempt",
    "freeThrowsMade",
    "freeThrowsAttempt",
    "offensiveRebounds",
    "defensiveRebounds",
    "rebounds",
    "assists",
    "steals",
    "blocks",
    "turnovers",
    "fouls"
  ];

  const warnings: string[] = [];
  for (const field of requiredFields) {
    const count = stats.filter((stat) => stat[field] === null || stat[field] === undefined).length;
    if (count > 0) warnings.push(`${count} GameStat rows have missing ${field}; preview treated missing numeric values as 0.`);
  }

  const missingFoulsDrawn = stats.filter((stat) => stat.foulsDrawn === null || stat.foulsDrawn === undefined).length;
  if (missingFoulsDrawn > 0) {
    warnings.push(`${missingFoulsDrawn} GameStat rows have missing foulsDrawn; Formula v2 excludes FD value for those rows instead of assuming 0.`);
  }

  return warnings;
}

async function loadOfficialStats() {
  return prisma.gameStat.findMany({
    where: {
      deletedAt: null,
      player: { deletedAt: null },
      game: {
        deletedAt: null,
        verificationStatus: { in: [VerificationStatus.SUBMITTED, VerificationStatus.VERIFIED] },
        season: { deletedAt: null, league: { deletedAt: null } }
      }
    },
    include: {
      performanceScore: {
        select: {
          finalPerformanceScore: true,
          performanceScore: true
        }
      },
      player: {
        select: {
          id: true,
          displayName: true,
          gender: true,
          position: true,
          currentProgram: { select: { fullName: true } },
          currentRatings: {
            select: {
              ageGroup: true,
              adjustedRating: true,
              verifiedGameCount: true,
              starRating: true
            }
          }
        }
      },
      game: {
        select: {
          id: true,
          gameNumber: true,
          gameDate: true,
          season: {
            select: {
              id: true,
              name: true,
              league: {
                select: {
                  id: true,
                  name: true,
                  ageGroup: true
                }
              }
            }
          }
        }
      }
    }
  });
}

function computeLeaguePools(stats: OfficialStat[]): LeaguePool[] {
  const byPool = new Map<string, OfficialStat[]>();
  for (const stat of stats) {
    const key = poolKey(stat);
    byPool.set(key, [...(byPool.get(key) ?? []), stat]);
  }

  return [...byPool.entries()]
    .map(([key, poolStats]) => ({
      key,
      ageGroup: poolStats[0].game.season.league.ageGroup,
      gender: poolStats[0].player.gender,
      competitionName: competitionName(poolStats[0]),
      seasonName: seasonName(poolStats[0]),
      gameStats: poolStats.length,
      games: new Set(poolStats.map((stat) => stat.gameId)).size,
      averages: computeFormulaV2LeagueContext(poolStats)
    }))
    .sort((left, right) => left.ageGroup.localeCompare(right.ageGroup) || left.gender.localeCompare(right.gender) || left.competitionName.localeCompare(right.competitionName));
}

function computeScoredGames(stats: OfficialStat[], pools: LeaguePool[]) {
  const poolByKey = new Map(pools.map((pool) => [pool.key, pool]));
  const statsByPool = new Map<string, OfficialStat[]>();
  for (const stat of stats) {
    const key = poolKey(stat);
    statsByPool.set(key, [...(statsByPool.get(key) ?? []), stat]);
  }

  const scoredGames: ScoredGame[] = [];
  for (const [key, poolStats] of statsByPool) {
    const pool = poolByKey.get(key);
    if (!pool) continue;

    const rawValues = poolStats.map((stat) => computeFormulaV2RawGameValue(stat, pool.averages));
    const scaledValues = percentileScaleToRating(rawValues);

    for (let index = 0; index < poolStats.length; index += 1) {
      const stat = poolStats[index];
      scoredGames.push({
        gameStatId: stat.id,
        gameId: stat.gameId,
        gameNumber: stat.game.gameNumber,
        gameDate: stat.game.gameDate,
        playerId: stat.playerId,
        displayName: stat.player.displayName,
        currentProgram: stat.player.currentProgram?.fullName ?? null,
        position: stat.player.position,
        ageGroup: stat.game.season.league.ageGroup,
        gender: stat.player.gender,
        competitionName: competitionName(stat),
        seasonName: seasonName(stat),
        poolKey: key,
        rawGameValue: rawValues[index],
        v2PerformanceScore: scaledValues[index],
        currentProductionGameScore: currentGameScore(stat),
        points: stat.points,
        rebounds: stat.rebounds,
        assists: stat.assists,
        steals: numberValue(stat.steals),
        blocks: numberValue(stat.blocks),
        turnovers: numberValue(stat.turnovers),
        fouls: numberValue(stat.fouls),
        foulsDrawn: stat.foulsDrawn
      });
    }
  }

  return scoredGames;
}

function getCurrentRating(stat: OfficialStat, ageGroup: AgeGroup) {
  return stat.player.currentRatings.find((rating) => rating.ageGroup === ageGroup) ?? null;
}

function computeBoardReport(key: BoardKey, games: ScoredGame[], sourceStats: OfficialStat[], previewDate: Date): BoardReport {
  const [ageGroup, gender] = key.split(":") as [AgeGroup, PlayerGender];
  const byPlayer = new Map<string, ScoredGame[]>();
  const statsByPlayer = new Map<string, OfficialStat>();

  for (const game of games) byPlayer.set(game.playerId, [...(byPlayer.get(game.playerId) ?? []), game]);
  for (const stat of sourceStats) {
    if (stat.game.season.league.ageGroup === ageGroup && stat.player.gender === gender) {
      statsByPlayer.set(stat.playerId, stat);
    }
  }

  const rows: PlayerCandidate[] = [...byPlayer.entries()].map(([playerId, playerGames]) => {
    const sourceStat = statsByPlayer.get(playerId);
    const currentRating = sourceStat ? getCurrentRating(sourceStat, ageGroup) : null;
    const v2Rating = weightedAverage(playerGames.map((game) => ({
      value: game.v2PerformanceScore,
      weight: weeklyGameWeight(game.gameDate, previewDate)
    })));
    const gamesPlayed = playerGames.length;
    const points = playerGames.reduce((sum, game) => sum + game.points, 0);
    const rebounds = playerGames.reduce((sum, game) => sum + game.rebounds, 0);
    const assists = playerGames.reduce((sum, game) => sum + game.assists, 0);
    const steals = playerGames.reduce((sum, game) => sum + game.steals, 0);
    const blocks = playerGames.reduce((sum, game) => sum + game.blocks, 0);
    const turnovers = playerGames.reduce((sum, game) => sum + game.turnovers, 0);

    return {
      playerId,
      displayName: playerGames[0].displayName,
      currentProgram: playerGames[0].currentProgram,
      position: playerGames[0].position,
      ageGroup,
      gender,
      games: gamesPlayed,
      v2Rating,
      currentProductionRating: currentRating ? numberValue(currentRating.adjustedRating) : null,
      currentVerifiedGameCount: currentRating?.verifiedGameCount ?? null,
      currentStarRating: currentRating?.starRating ?? null,
      starRating: starRating(v2Rating),
      eligible: gamesPlayed >= minimumGames(gender),
      ppg: points / gamesPlayed,
      rpg: rebounds / gamesPlayed,
      apg: assists / gamesPlayed,
      spg: steals / gamesPlayed,
      bpg: blocks / gamesPlayed,
      tov: turnovers / gamesPlayed,
      gameRefs: playerGames.map((game) => game.gameNumber ?? game.gameId).sort(),
      rank: 0,
      currentRank: null,
      rankDelta: null
    };
  });

  const rankedV2 = rows.sort((left, right) => right.v2Rating - left.v2Rating || right.games - left.games || left.displayName.localeCompare(right.displayName));
  rankedV2.forEach((row, index) => {
    row.rank = index + 1;
  });

  const rankedCurrent = rows
    .filter((row) => row.currentProductionRating !== null)
    .sort((left, right) => (right.currentProductionRating ?? 0) - (left.currentProductionRating ?? 0) || (right.currentVerifiedGameCount ?? 0) - (left.currentVerifiedGameCount ?? 0) || left.displayName.localeCompare(right.displayName));
  rankedCurrent.forEach((row, index) => {
    row.currentRank = index + 1;
  });

  for (const row of rows) {
    row.rankDelta = row.currentRank === null ? null : row.currentRank - row.rank;
  }

  const eligibleRows = rankedV2.filter((row) => row.eligible);
  const currentTop = rankedCurrent.slice(0, 10);
  const v2Top = rankedV2.slice(0, 10);
  const values = rows.map((row) => row.v2Rating).sort((left, right) => left - right);

  return {
    key,
    label: `${ageGroup} ${displayGender(gender)}`,
    ageGroup,
    gender,
    input: {
      games: new Set(games.map((game) => game.gameId)).size,
      gameStats: games.length,
      players: rows.length,
      scalingPools: new Set(games.map((game) => game.poolKey)).size,
      eligiblePlayers: eligibleRows.length
    },
    top10: v2Top,
    top10SideBySide: Array.from({ length: 10 }, (_, index) => ({
      rank: index + 1,
      formulaV2: v2Top[index] ? `${v2Top[index].displayName} (${round(v2Top[index].v2Rating)})` : "-",
      currentProduction: currentTop[index] ? `${currentTop[index].displayName} (${round(currentTop[index].currentProductionRating ?? 0)})` : "-"
    })),
    starDistribution: distribution(rows, (row) => row.starRating),
    currentStarDistribution: distribution(rows, (row) => row.currentStarRating),
    biggestRisers: rows.filter((row) => row.rankDelta !== null).sort((left, right) => (right.rankDelta ?? 0) - (left.rankDelta ?? 0)).slice(0, 15),
    biggestFallers: rows.filter((row) => row.rankDelta !== null).sort((left, right) => (left.rankDelta ?? 0) - (right.rankDelta ?? 0)).slice(0, 15),
    lowGameOutliers: rankedV2.filter((row) => !row.eligible).slice(0, 15),
    ratingDistribution: values.length ? {
      min: round(values[0]),
      p25: round(percentile(values, 0.25)),
      median: round(percentile(values, 0.5)),
      p75: round(percentile(values, 0.75)),
      max: round(values[values.length - 1]),
      mean: round(average(values))
    } : null
  };
}

function percentile(sortedValues: number[], p: number) {
  return sortedValues[Math.min(sortedValues.length - 1, Math.floor((sortedValues.length - 1) * p))];
}

function distribution<T>(rows: T[], getter: (row: T) => number | null) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const value = getter(row);
    if (value === null) return acc;
    acc[String(value)] = (acc[String(value)] ?? 0) + 1;
    return acc;
  }, {});
}

function playerSummary(row: PlayerCandidate) {
  return {
    rank: row.rank,
    currentRank: row.currentRank,
    rankDelta: row.rankDelta,
    playerId: row.playerId,
    displayName: row.displayName,
    program: row.currentProgram,
    position: row.position,
    games: row.games,
    eligible: row.eligible,
    formulaV2Rating: round(row.v2Rating),
    currentProductionRating: row.currentProductionRating === null ? null : round(row.currentProductionRating),
    currentVerifiedGameCount: row.currentVerifiedGameCount,
    starRating: row.starRating,
    currentStarRating: row.currentStarRating,
    ppg: round(row.ppg, 1),
    rpg: round(row.rpg, 1),
    apg: round(row.apg, 1),
    spg: round(row.spg, 1),
    bpg: round(row.bpg, 1),
    tov: round(row.tov, 1),
    gameRefs: row.gameRefs
  };
}

function markdownTable(rows: Array<Record<string, string | number | null | boolean>>) {
  if (!rows.length) return "_No rows._";
  const headers = Object.keys(rows[0]);
  const header = `| ${headers.join(" | ")} |`;
  const separator = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${headers.map((key) => String(row[key] ?? "-").replace(/\|/g, "\\|")).join(" | ")} |`);
  return [header, separator, ...body].join("\n");
}

function buildMarkdown(report: {
  generatedAt: string;
  previewDate: string;
  guardrails: Record<string, boolean>;
  inputs: Record<string, number>;
  leagueSeasonAverages: LeaguePool[];
  boards: BoardReport[];
  warnings: string[];
}) {
  const lines = [
    "# Formula v2 Preview",
    "",
    `Generated: ${report.generatedAt}`,
    `Preview date for recency weighting: ${report.previewDate}`,
    "",
    "## Guardrails",
    "",
    "- Read-only Formula v2 preview path.",
    "- No `LeagueSeasonAverage`, `GamePerformanceScore`, `PlayerRating`, `RankingSnapshot`, `Game`, or `GameStat` rows were written.",
    "- No production leaderboard output was changed.",
    "- Formula v2 uses `formulaVersionTag = 2` only as a future write target note; this preview does not write rows.",
    "",
    "## Formula v2 Candidate",
    "",
    "- Possession-informed raw game value.",
    "- Missed FG/FT costs included.",
    "- Rebounds, assists, steals, blocks, turnovers, fouls, and fouls drawn valued from league PPP/context where available.",
    "- No plus-minus in the main formula.",
    "- Percentile-scaled game performance within gender + age group + season/competition pool.",
    "- Recency-weighted player average: last 2 weeks = 1.00, last month = 0.80, older = 0.60.",
    "- No Bayesian shrinkage.",
    "- Advanced Bonus disabled.",
    "- League weight, opponent factor, and team context are neutral at 1.00.",
    "",
    "## Input Summary",
    "",
    "```json",
    JSON.stringify(report.inputs, null, 2),
    "```",
    "",
    "## League/Season Averages Computed In Memory",
    "",
    markdownTable(report.leagueSeasonAverages.map((pool) => ({
      board: `${pool.ageGroup} ${displayGender(pool.gender)}`,
      competition: pool.competitionName,
      season: pool.seasonName,
      games: pool.games,
      gameStats: pool.gameStats,
      possessions: round(pool.averages.possessions, 1),
      ppp: round(pool.averages.leaguePPP, 3),
      drbPct: round(pool.averages.leagueDRBPct * 100, 1),
      orbPct: round(pool.averages.leagueORBPct * 100, 1),
      ftCostPerFoul: round(pool.averages.leagueFTCostPerFoul, 3)
    }))),
    ""
  ];

  for (const board of report.boards) {
    lines.push(
      `## ${board.label}`,
      "",
      `Input: ${board.input.games} games, ${board.input.gameStats} GameStats, ${board.input.players} players, ${board.input.scalingPools} scaling pools, ${board.input.eligiblePlayers} players meeting current eligibility minimum.`,
      "",
      "### Top 10 Side by Side",
      "",
      markdownTable(board.top10SideBySide),
      "",
      "### Formula v2 Top 10",
      "",
      markdownTable(board.top10.map((row) => ({
        rank: row.rank,
        player: row.displayName,
        rating: round(row.v2Rating),
        current: row.currentProductionRating === null ? null : round(row.currentProductionRating),
        games: row.games,
        stars: row.starRating,
        ppg: round(row.ppg, 1),
        rpg: round(row.rpg, 1),
        apg: round(row.apg, 1)
      }))),
      "",
      "### Star Distribution",
      "",
      "```json",
      JSON.stringify({ formulaV2: board.starDistribution, currentProduction: board.currentStarDistribution }, null, 2),
      "```",
      "",
      "### Rating Distribution",
      "",
      "```json",
      JSON.stringify(board.ratingDistribution, null, 2),
      "```",
      "",
      "### Biggest Risers",
      "",
      markdownTable(board.biggestRisers.slice(0, 10).map((row) => ({
        delta: row.rankDelta,
        player: row.displayName,
        v2Rank: row.rank,
        currentRank: row.currentRank,
        v2: round(row.v2Rating),
        current: row.currentProductionRating === null ? null : round(row.currentProductionRating),
        games: row.games
      }))),
      "",
      "### Biggest Fallers",
      "",
      markdownTable(board.biggestFallers.slice(0, 10).map((row) => ({
        delta: row.rankDelta,
        player: row.displayName,
        v2Rank: row.rank,
        currentRank: row.currentRank,
        v2: round(row.v2Rating),
        current: row.currentProductionRating === null ? null : round(row.currentProductionRating),
        games: row.games
      }))),
      "",
      "### Low-Game Outliers",
      "",
      markdownTable(board.lowGameOutliers.slice(0, 10).map((row) => ({
        rank: row.rank,
        player: row.displayName,
        rating: round(row.v2Rating),
        games: row.games,
        minimum: minimumGames(board.gender),
        ppg: round(row.ppg, 1)
      }))),
      ""
    );
  }

  lines.push(
    "## Warnings / Risks",
    "",
    report.warnings.length ? report.warnings.map((warning) => `- ${warning}`).join("\n") : "- None.",
    "",
    "## Snapshot Confirmation",
    "",
    "- No ranking snapshots were generated.",
    ""
  );

  return lines.join("\n");
}

async function main() {
  mkdirSync(reportsDir, { recursive: true });
  const generatedAt = new Date();
  const previewDate = generatedAt;
  const stats = await loadOfficialStats();
  const warnings = missingInputWarnings(stats);
  const pools = computeLeaguePools(stats);
  const scoredGames = computeScoredGames(stats, pools);
  const boardKeys = [...new Set(scoredGames.map((game) => boardKey(game.ageGroup, game.gender)))].sort() as BoardKey[];
  const boards = boardKeys.map((key) => {
    const [ageGroup, gender] = key.split(":") as [AgeGroup, PlayerGender];
    return computeBoardReport(
      key,
      scoredGames.filter((game) => game.ageGroup === ageGroup && game.gender === gender),
      stats,
      previewDate
    );
  });

  const report = {
    generatedAt: generatedAt.toISOString(),
    previewDate: previewDate.toISOString(),
    command: "npm.cmd run ratings:v2:preview",
    reportPaths: {
      markdown: markdownReportPath,
      json: jsonReportPath
    },
    guardrails: {
      readOnly: true,
      databaseWrites: false,
      leagueSeasonAverageWrites: false,
      gamePerformanceScoreWrites: false,
      playerRatingWrites: false,
      rankingSnapshotsGenerated: false,
      publicLeaderboardChanged: false
    },
    formula: {
      name: "Formula v2 Candidate - Claude No Shrinkage",
      formulaVersionTagWhenImplemented: 2,
      bayesianShrinkage: false,
      advancedBonus: false,
      plusMinus: false,
      leagueWeight: 1,
      opponentFactor: 1,
      teamContextFactor: 1
    },
    inputs: {
      totalOfficialActiveGames: new Set(stats.map((stat) => stat.gameId)).size,
      totalOfficialActiveGameStats: stats.length,
      totalPlayersWithStats: new Set(stats.map((stat) => stat.playerId)).size,
      leagueSeasonPools: pools.length
    },
    leagueSeasonAverages: pools.map((pool) => ({
      key: pool.key,
      ageGroup: pool.ageGroup,
      gender: pool.gender,
      competitionName: pool.competitionName,
      seasonName: pool.seasonName,
      games: pool.games,
      gameStats: pool.gameStats,
      averages: {
        points: round(pool.averages.points, 1),
        possessions: round(pool.averages.possessions, 3),
        leaguePPP: round(pool.averages.leaguePPP, 6),
        leagueDRBPct: round(pool.averages.leagueDRBPct, 6),
        leagueORBPct: round(pool.averages.leagueORBPct, 6),
        leagueFTCostPerFoul: round(pool.averages.leagueFTCostPerFoul, 6)
      }
    })),
    boards: boards.map((board) => ({
      ...board,
      top10: board.top10.map(playerSummary),
      biggestRisers: board.biggestRisers.map(playerSummary),
      biggestFallers: board.biggestFallers.map(playerSummary),
      lowGameOutliers: board.lowGameOutliers.map(playerSummary)
    })),
    warnings,
    snapshotConfirmation: {
      rankingSnapshotsGenerated: false
    }
  };

  writeFileSync(jsonReportPath, JSON.stringify(report, null, 2));
  writeFileSync(markdownReportPath, buildMarkdown({
    generatedAt: report.generatedAt,
    previewDate: report.previewDate,
    guardrails: report.guardrails,
    inputs: report.inputs,
    leagueSeasonAverages: pools,
    boards,
    warnings
  }));

  console.log(JSON.stringify({
    reportPaths: report.reportPaths,
    inputs: report.inputs,
    boards: boards.map((board) => ({
      label: board.label,
      games: board.input.games,
      gameStats: board.input.gameStats,
      players: board.input.players,
      eligiblePlayers: board.input.eligiblePlayers,
      top10SideBySide: board.top10SideBySide,
      starDistribution: board.starDistribution,
      lowGameOutliers: board.lowGameOutliers.slice(0, 5).map(playerSummary)
    })),
    warnings,
    guardrails: report.guardrails
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
