import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { AgeGroup, PlayerGender, VerificationStatus } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { normalizeCompetitionDisplayName } from "../src/lib/competition-naming";

const projectRoot = "D:\\Peach Basket";
const reportsDir = path.join(projectRoot, "scripts", "reports");
const jsonPath = path.join(reportsDir, "player-rating-formula-comparison.json");
const markdownPath = path.join(reportsDir, "player-rating-formula-comparison.md");

type StatRow = Awaited<ReturnType<typeof loadOfficialStats>>[number];

type BoardConfig = {
  id: string;
  label: string;
  ageGroup: AgeGroup;
  gender: PlayerGender;
  competitionName?: string;
};

type ScoredGame = {
  gameStatId: string;
  playerId: string;
  displayName: string;
  currentTeam: string | null;
  position: string | null;
  gameDate: Date;
  gameNumber: string | null;
  competitionName: string;
  poolKey: string;
  currentFormulaScore: number | null;
  claudeRaw: number;
  claudeRawWithAdvancedBonus: number;
  advancedBonus: number | null;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fga: number;
  fgm: number;
  fta: number;
  ftm: number;
};

type PlayerBoardRow = {
  playerId: string;
  displayName: string;
  currentTeam: string | null;
  position: string | null;
  games: number;
  currentFormulaRating: number | null;
  currentFormulaRank: number | null;
  storedPlayerRating: number | null;
  claudeObserved: number;
  claudeAdjusted: number;
  claudeNoShrink: number;
  claudeNoShrinkRank: number;
  claudeAdvancedObserved: number;
  claudeAdvancedAdjusted: number;
  claudeRank: number;
  claudeAdvancedRank: number;
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  tov: number;
  fgPct: number | null;
  tsPct: number | null;
  starCurrent: number | null;
  starClaude: number;
  starClaudeNoShrink: number;
  starClaudeAdvanced: number;
};

function num(value: unknown, fallback = 0) {
  if (value === null || value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round(value: number, places = 2) {
  return Number(value.toFixed(places));
}

function safeDivide(numerator: number, denominator: number) {
  return denominator === 0 ? null : numerator / denominator;
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function starBand(value: number) {
  if (value >= 90) return 5;
  if (value >= 80) return 4;
  if (value >= 70) return 3;
  if (value >= 60) return 2;
  return 1;
}

function percentileScale(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const percentileByValue = new Map<number, number>();

  for (let i = 0; i < sorted.length; i += 1) {
    const value = sorted[i];
    if (percentileByValue.has(value)) continue;

    let last = i;
    while (last + 1 < sorted.length && sorted[last + 1] === value) last += 1;

    const percentile = sorted.length === 1 ? 1 : ((i + last) / 2) / (sorted.length - 1);
    percentileByValue.set(value, percentile);
    i = last;
  }

  return values.map((value) => 1 + (percentileByValue.get(value) ?? 0) * 99);
}

function rankRows<T>(rows: T[], score: (row: T) => number, tieBreak: (left: T, right: T) => number = () => 0) {
  return [...rows].sort((left, right) => score(right) - score(left) || tieBreak(left, right));
}

function recencyWeight(gameDate: Date, latestDate: Date) {
  const ageMs = latestDate.getTime() - gameDate.getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  if (ageMs <= 14 * dayMs) return 1;
  if (ageMs <= 31 * dayMs) return 0.8;
  return 0.6;
}

function weightedAverage(values: Array<{ value: number; weight: number }>) {
  const totalWeight = values.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight === 0) return 0;
  return values.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight;
}

function displayGender(gender: PlayerGender) {
  return gender === PlayerGender.GIRLS ? "Girls" : "Boys";
}

function competitionDisplayName(rawName: string) {
  return normalizeCompetitionDisplayName(rawName) || rawName;
}

function seasonDisplayName(competitionName: string, rawSeasonName: string) {
  return competitionName === "PYBC 15U" ? "Full Competition" : rawSeasonName;
}

function poolKeyForStat(stat: StatRow) {
  const competition = competitionDisplayName(stat.game.season.league.name);
  return [
    stat.game.season.league.ageGroup,
    stat.player.gender,
    competition,
    seasonDisplayName(competition, stat.game.season.name)
  ].join("::");
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
            select: { ageGroup: true, adjustedRating: true, verifiedGameCount: true, starRating: true }
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
              league: { select: { id: true, name: true, ageGroup: true } }
            }
          }
        }
      }
    }
  });
}

function boardConfigs(stats: StatRow[]): BoardConfig[] {
  const configs: BoardConfig[] = [];
  if (stats.some((stat) => stat.game.season.league.ageGroup === AgeGroup.U16 && stat.player.gender === PlayerGender.BOYS && competitionDisplayName(stat.game.season.league.name) === "PYBC 15U")) {
    configs.push({ id: "pybc-u16-boys", label: "PYBC U16 Boys / PYBC 15U", ageGroup: AgeGroup.U16, gender: PlayerGender.BOYS, competitionName: "PYBC 15U" });
  }
  if (stats.some((stat) => stat.game.season.league.ageGroup === AgeGroup.U19 && stat.player.gender === PlayerGender.BOYS)) {
    configs.push({ id: "u19-boys", label: "Boys U19", ageGroup: AgeGroup.U19, gender: PlayerGender.BOYS });
  }
  if (stats.some((stat) => stat.game.season.league.ageGroup === AgeGroup.U19 && stat.player.gender === PlayerGender.GIRLS)) {
    configs.push({ id: "u19-girls", label: "Girls U19", ageGroup: AgeGroup.U19, gender: PlayerGender.GIRLS });
  }
  return configs;
}

function filterBoardStats(stats: StatRow[], board: BoardConfig) {
  return stats.filter((stat) => {
    const competition = competitionDisplayName(stat.game.season.league.name);
    return stat.game.season.league.ageGroup === board.ageGroup
      && stat.player.gender === board.gender
      && (!board.competitionName || competition === board.competitionName);
  });
}

function leagueConstants(stats: StatRow[]) {
  const totals = stats.reduce((sum, stat) => {
    const fga = num(stat.fieldGoalsAttempt);
    const fgm = num(stat.fieldGoalsMade);
    const fta = num(stat.freeThrowsAttempt);
    const ftm = num(stat.freeThrowsMade);
    const oreb = num(stat.offensiveRebounds);
    const dreb = num(stat.defensiveRebounds);
    const trb = num(stat.rebounds);
    const tov = num(stat.turnovers);
    const pf = num(stat.fouls);
    return {
      pts: sum.pts + stat.points,
      fga: sum.fga + fga,
      fgm: sum.fgm + fgm,
      fta: sum.fta + fta,
      ftm: sum.ftm + ftm,
      oreb: sum.oreb + oreb,
      dreb: sum.dreb + dreb,
      trb: sum.trb + trb,
      tov: sum.tov + tov,
      pf: sum.pf + pf
    };
  }, { pts: 0, fga: 0, fgm: 0, fta: 0, ftm: 0, oreb: 0, dreb: 0, trb: 0, tov: 0, pf: 0 });

  const possessions = totals.fga - totals.oreb + totals.tov + 0.44 * totals.fta;
  const leaguePPP = safeDivide(totals.pts, possessions) ?? 0;
  const leagueDRBPct = safeDivide(totals.dreb, totals.trb) ?? 0;
  const leagueORBPct = safeDivide(totals.oreb, totals.trb) ?? 0;
  const leagueFTCostPerFoul = totals.pf === 0 ? 0 : (totals.ftm * leaguePPP) / totals.pf;
  const leagueTS = safeDivide(totals.pts, 2 * (totals.fga + 0.44 * totals.fta)) ?? 0;

  return { ...totals, possessions, leaguePPP, leagueDRBPct, leagueORBPct, leagueFTCostPerFoul, leagueTS };
}

function claudeRaw(stat: StatRow, constants: ReturnType<typeof leagueConstants>, includeAdvancedBonus: boolean) {
  const fgm = num(stat.fieldGoalsMade);
  const fga = num(stat.fieldGoalsAttempt);
  const ftm = num(stat.freeThrowsMade);
  const fta = num(stat.freeThrowsAttempt);
  const threeMade = num(stat.threeMade);
  const missedFG = Math.max(0, fga - fgm);
  const missedFT = Math.max(0, fta - ftm);
  const oreb = num(stat.offensiveRebounds);
  const dreb = num(stat.defensiveRebounds);
  const ast = num(stat.assists);
  const stl = num(stat.steals);
  const blk = num(stat.blocks);
  const tov = num(stat.turnovers);
  const pf = num(stat.fouls);
  const fdValue = stat.foulsDrawn === null ? 0 : num(stat.foulsDrawn) * constants.leagueFTCostPerFoul;

  const raw =
    stat.points
    - missedFG * constants.leaguePPP * constants.leagueDRBPct
    - missedFT * 0.44 * constants.leaguePPP
    + oreb * constants.leaguePPP
    + dreb * constants.leaguePPP * constants.leagueORBPct
    + ast * constants.leaguePPP * 0.35
    + stl * constants.leaguePPP
    + blk * constants.leaguePPP * 0.65
    - tov * constants.leaguePPP
    - pf * constants.leagueFTCostPerFoul
    + fdValue;

  const ts = safeDivide(stat.points, 2 * (fga + 0.44 * fta));
  const advancedBonus = fga > 0 && fta > 0 && ts !== null
    ? clamp((ts - constants.leagueTS) * stat.points * 0.5, -5, 10)
    : null;

  return {
    raw,
    rawWithAdvancedBonus: raw + (includeAdvancedBonus ? advancedBonus ?? 0 : 0),
    advancedBonus,
    ts
  };
}

function scoreBoardGames(stats: StatRow[]) {
  const pools = new Map<string, StatRow[]>();
  for (const stat of stats) {
    const key = poolKeyForStat(stat);
    pools.set(key, [...(pools.get(key) ?? []), stat]);
  }

  const scored: ScoredGame[] = [];
  for (const [poolKey, poolStats] of pools) {
    const constants = leagueConstants(poolStats);
    const rawRows = poolStats.map((stat) => ({ stat, ...claudeRaw(stat, constants, false), advanced: claudeRaw(stat, constants, true) }));
    const scaled = percentileScale(rawRows.map((row) => row.raw));
    const scaledAdvanced = percentileScale(rawRows.map((row) => row.advanced.rawWithAdvancedBonus));

    for (let i = 0; i < rawRows.length; i += 1) {
      const row = rawRows[i];
      const competitionName = competitionDisplayName(row.stat.game.season.league.name);
      scored.push({
        gameStatId: row.stat.id,
        playerId: row.stat.playerId,
        displayName: row.stat.player.displayName,
        currentTeam: row.stat.player.currentProgram?.fullName ?? null,
        position: row.stat.player.position,
        gameDate: row.stat.game.gameDate,
        gameNumber: row.stat.game.gameNumber,
        competitionName,
        poolKey,
        currentFormulaScore: row.stat.performanceScore?.finalPerformanceScore === null || row.stat.performanceScore?.finalPerformanceScore === undefined
          ? row.stat.performanceScore?.performanceScore === null || row.stat.performanceScore?.performanceScore === undefined ? null : num(row.stat.performanceScore.performanceScore)
          : num(row.stat.performanceScore.finalPerformanceScore),
        claudeRaw: scaled[i],
        claudeRawWithAdvancedBonus: scaledAdvanced[i],
        advancedBonus: row.advancedBonus,
        points: row.stat.points,
        rebounds: row.stat.rebounds,
        assists: row.stat.assists,
        steals: num(row.stat.steals),
        blocks: num(row.stat.blocks),
        turnovers: num(row.stat.turnovers),
        fga: num(row.stat.fieldGoalsAttempt),
        fgm: num(row.stat.fieldGoalsMade),
        fta: num(row.stat.freeThrowsAttempt),
        ftm: num(row.stat.freeThrowsMade)
      });
    }
  }

  return scored;
}

function playerRows(stats: StatRow[], scoredGames: ScoredGame[], board: BoardConfig): PlayerBoardRow[] {
  const latestDate = new Date(Math.max(...scoredGames.map((game) => game.gameDate.getTime())));
  const gamesByPlayer = new Map<string, ScoredGame[]>();
  for (const game of scoredGames) gamesByPlayer.set(game.playerId, [...(gamesByPlayer.get(game.playerId) ?? []), game]);

  const currentRankByPlayer = new Map<string, number>();
  const storedRatingByPlayer = new Map<string, number>();
  const boardStatsByPlayer = new Map(stats.map((stat) => [stat.playerId, stat.player]));
  for (const player of new Map([...boardStatsByPlayer.entries()]).values()) {
    const rating = player.currentRatings.find((row) => row.ageGroup === board.ageGroup);
    if (rating) storedRatingByPlayer.set(player.id, num(rating.adjustedRating));
  }
  const currentRanked = [...gamesByPlayer.entries()]
    .map(([playerId, games]) => ({ playerId, rating: average(games.map((game) => game.currentFormulaScore).filter((value): value is number => value !== null)) }))
    .filter((row) => row.rating > 0)
    .sort((left, right) => right.rating - left.rating || (boardStatsByPlayer.get(left.playerId)?.displayName ?? "").localeCompare(boardStatsByPlayer.get(right.playerId)?.displayName ?? ""));
  currentRanked.forEach((row, index) => currentRankByPlayer.set(row.playerId, index + 1));

  const baseRows = [...gamesByPlayer.entries()].map(([playerId, games]) => {
    const weightedClaude = weightedAverage(games.map((game) => ({ value: game.claudeRaw, weight: recencyWeight(game.gameDate, latestDate) })));
    const weightedClaudeAdvanced = weightedAverage(games.map((game) => ({ value: game.claudeRawWithAdvancedBonus, weight: recencyWeight(game.gameDate, latestDate) })));
    const currentScores = games.map((game) => game.currentFormulaScore).filter((value): value is number => value !== null);
    const fga = games.reduce((sum, game) => sum + game.fga, 0);
    const fgm = games.reduce((sum, game) => sum + game.fgm, 0);
    const fta = games.reduce((sum, game) => sum + game.fta, 0);
    const points = games.reduce((sum, game) => sum + game.points, 0);
    const ts = safeDivide(points, 2 * (fga + 0.44 * fta));

    return {
      playerId,
      displayName: games[0].displayName,
      currentTeam: games[0].currentTeam,
      position: games[0].position,
      games: games.length,
      currentFormulaRating: currentScores.length ? average(currentScores) : null,
      currentFormulaRank: currentRankByPlayer.get(playerId) ?? null,
      storedPlayerRating: storedRatingByPlayer.get(playerId) ?? null,
      claudeObserved: weightedClaude,
      claudeAdjusted: weightedClaude,
      claudeNoShrink: weightedClaude,
      claudeNoShrinkRank: 0,
      claudeAdvancedObserved: weightedClaudeAdvanced,
      claudeAdvancedAdjusted: weightedClaudeAdvanced,
      claudeRank: 0,
      claudeAdvancedRank: 0,
      ppg: points / games.length,
      rpg: games.reduce((sum, game) => sum + game.rebounds, 0) / games.length,
      apg: games.reduce((sum, game) => sum + game.assists, 0) / games.length,
      spg: games.reduce((sum, game) => sum + game.steals, 0) / games.length,
      bpg: games.reduce((sum, game) => sum + game.blocks, 0) / games.length,
      tov: games.reduce((sum, game) => sum + game.turnovers, 0) / games.length,
      fgPct: safeDivide(fgm, fga),
      tsPct: ts,
      starCurrent: currentScores.length ? starBand(average(currentScores)) : null,
      starClaude: 1,
      starClaudeNoShrink: 1,
      starClaudeAdvanced: 1
    };
  });

  const ageMean = average(baseRows.map((row) => row.claudeObserved));
  const ageMeanAdvanced = average(baseRows.map((row) => row.claudeAdvancedObserved));
  const priorGames = board.gender === PlayerGender.GIRLS ? 5 : 10;

  for (const row of baseRows) {
    row.claudeAdjusted = ((row.games * row.claudeObserved) + (priorGames * ageMean)) / (row.games + priorGames);
    row.claudeAdvancedAdjusted = ((row.games * row.claudeAdvancedObserved) + (priorGames * ageMeanAdvanced)) / (row.games + priorGames);
    row.starClaude = starBand(row.claudeAdjusted);
    row.starClaudeNoShrink = starBand(row.claudeNoShrink);
    row.starClaudeAdvanced = starBand(row.claudeAdvancedAdjusted);
  }

  rankRows(baseRows, (row) => row.claudeAdjusted, (left, right) => left.displayName.localeCompare(right.displayName))
    .forEach((row, index) => { row.claudeRank = index + 1; });
  rankRows(baseRows, (row) => row.claudeNoShrink, (left, right) => left.displayName.localeCompare(right.displayName))
    .forEach((row, index) => { row.claudeNoShrinkRank = index + 1; });
  rankRows(baseRows, (row) => row.claudeAdvancedAdjusted, (left, right) => left.displayName.localeCompare(right.displayName))
    .forEach((row, index) => { row.claudeAdvancedRank = index + 1; });

  return baseRows;
}

function distribution(rows: PlayerBoardRow[], getter: (row: PlayerBoardRow) => number | null) {
  const values = rows.map(getter).filter((value): value is number => value !== null);
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const pct = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))];
  return {
    min: round(sorted[0]),
    p25: round(pct(0.25)),
    median: round(pct(0.5)),
    p75: round(pct(0.75)),
    max: round(sorted[sorted.length - 1]),
    mean: round(average(values))
  };
}

function summarizeBoard(board: BoardConfig, stats: StatRow[]) {
  const scored = scoreBoardGames(stats);
  const rows = playerRows(stats, scored, board);
  const currentRanked = rankRows(rows.filter((row) => row.currentFormulaRating !== null), (row) => row.currentFormulaRating ?? 0, (left, right) => left.displayName.localeCompare(right.displayName));
  const claudeRanked = rankRows(rows, (row) => row.claudeAdjusted, (left, right) => left.displayName.localeCompare(right.displayName));
  const claudeNoShrinkRanked = rankRows(rows, (row) => row.claudeNoShrink, (left, right) => left.displayName.localeCompare(right.displayName));
  const claudeAdvancedRanked = rankRows(rows, (row) => row.claudeAdvancedAdjusted, (left, right) => left.displayName.localeCompare(right.displayName));

  const biggestRisersShrink = rows
    .filter((row) => row.currentFormulaRank !== null)
    .map((row) => ({ ...row, rankChange: (row.currentFormulaRank ?? 0) - row.claudeRank }))
    .sort((left, right) => right.rankChange - left.rankChange)
    .slice(0, 15);
  const biggestFallersShrink = rows
    .filter((row) => row.currentFormulaRank !== null)
    .map((row) => ({ ...row, rankChange: (row.currentFormulaRank ?? 0) - row.claudeRank }))
    .sort((left, right) => left.rankChange - right.rankChange)
    .slice(0, 15);

  const biggestRisersNoShrink = rows
    .filter((row) => row.currentFormulaRank !== null)
    .map((row) => ({ ...row, rankChange: (row.currentFormulaRank ?? 0) - row.claudeNoShrinkRank }))
    .sort((left, right) => right.rankChange - left.rankChange)
    .slice(0, 15);
  const biggestFallersNoShrink = rows
    .filter((row) => row.currentFormulaRank !== null)
    .map((row) => ({ ...row, rankChange: (row.currentFormulaRank ?? 0) - row.claudeNoShrinkRank }))
    .sort((left, right) => left.rankChange - right.rankChange)
    .slice(0, 15);

  const minimum = board.gender === PlayerGender.GIRLS ? 5 : 10;
  const lowGameOutliers = claudeRanked.filter((row) => row.games < minimum).slice(0, 15);
  const lowGameOutliersNoShrink = claudeNoShrinkRanked.filter((row) => row.games < minimum).slice(0, 15);
  const highVolumeInefficientScorers = rows
    .filter((row) => row.ppg >= 10 && row.games >= Math.min(minimum, 5) && (row.tsPct ?? 0) < 0.48)
    .sort((left, right) => right.ppg - left.ppg)
    .slice(0, 15);
  const defensiveReboundingSpecialists = rows
    .filter((row) => row.games >= Math.min(minimum, 5))
    .sort((left, right) => (right.rpg + right.spg + right.bpg) - (left.rpg + left.spg + left.bpg))
    .slice(0, 15);
  const starBandChanges = rows
    .filter((row) => row.starCurrent !== null && row.starCurrent !== row.starClaude)
    .sort((left, right) => Math.abs((right.currentFormulaRating ?? 0) - right.claudeAdjusted) - Math.abs((left.currentFormulaRating ?? 0) - left.claudeAdjusted))
    .slice(0, 25);
  const starBandChangesNoShrink = rows
    .filter((row) => row.starCurrent !== null && row.starCurrent !== row.starClaudeNoShrink)
    .sort((left, right) => Math.abs((right.currentFormulaRating ?? 0) - right.claudeNoShrink) - Math.abs((left.currentFormulaRating ?? 0) - left.claudeNoShrink))
    .slice(0, 25);

  const top25CurrentVsCandidate = Array.from({ length: 25 }, (_, index) => {
    const current = currentRanked[index] ?? null;
    const candidate = claudeRanked[index] ?? null;
    const noShrink = claudeNoShrinkRanked[index] ?? null;
    return {
      rank: index + 1,
      current: current ? briefPlayer(current, "current") : null,
      claude: candidate ? briefPlayer(candidate, "claude") : null,
      claudeNoShrink: noShrink ? briefPlayer(noShrink, "claudeNoShrink") : null
    };
  });

  const top10SideBySide = Array.from({ length: 10 }, (_, index) => {
    const current = currentRanked[index] ?? null;
    const candidate = claudeRanked[index] ?? null;
    const noShrink = claudeNoShrinkRanked[index] ?? null;
    const advanced = claudeAdvancedRanked[index] ?? null;
    return {
      rank: index + 1,
      current: current ? `${current.displayName} (${round(current.currentFormulaRating ?? 0)})` : "-",
      claudeShrink: candidate ? `${candidate.displayName} (${round(candidate.claudeAdjusted)})` : "-",
      claudeNoShrink: noShrink ? `${noShrink.displayName} (${round(noShrink.claudeNoShrink)})` : "-",
      claudeAdvancedShrink: advanced ? `${advanced.displayName} (${round(advanced.claudeAdvancedAdjusted)})` : "-"
    };
  });

  return {
    id: board.id,
    label: board.label,
    ageGroup: board.ageGroup,
    gender: displayGender(board.gender),
    competitionName: board.competitionName ?? "All active official competitions",
    input: {
      gameStats: stats.length,
      games: new Set(stats.map((stat) => stat.gameId)).size,
      players: rows.length,
      pools: new Set(scored.map((game) => game.poolKey)).size
    },
    distributions: {
      currentFormula: distribution(rows, (row) => row.currentFormulaRating),
      claudeShrink: distribution(rows, (row) => row.claudeAdjusted),
      claudeNoShrink: distribution(rows, (row) => row.claudeNoShrink),
      claudeWithAdvancedShrink: distribution(rows, (row) => row.claudeAdvancedAdjusted),
    },
    top25CurrentVsCandidate,
    top25ClaudeNoShrink: claudeNoShrinkRanked.slice(0, 25).map((row, index) => ({ rank: index + 1, ...briefPlayer(row, "claudeNoShrink") })),
    top25ClaudeWithAdvanced: claudeAdvancedRanked.slice(0, 25).map((row, index) => ({ rank: index + 1, ...briefPlayer(row, "claudeAdvanced") })),
    biggestRisers: biggestRisersShrink.map((row) => ({ rankChange: row.rankChange, ...briefPlayer(row, "both") })),
    biggestFallers: biggestFallersShrink.map((row) => ({ rankChange: row.rankChange, ...briefPlayer(row, "both") })),
    biggestRisersNoShrink: biggestRisersNoShrink.map((row) => ({ rankChange: row.rankChange, ...briefPlayer(row, "claudeNoShrink") })),
    biggestFallersNoShrink: biggestFallersNoShrink.map((row) => ({ rankChange: row.rankChange, ...briefPlayer(row, "claudeNoShrink") })),
    lowGameOutliers: lowGameOutliers.map((row) => briefPlayer(row, "claude")),
    lowGameOutliersNoShrink: lowGameOutliersNoShrink.map((row) => briefPlayer(row, "claudeNoShrink")),
    highVolumeInefficientScorers: highVolumeInefficientScorers.map((row) => briefPlayer(row, "both")),
    defensiveReboundingSpecialists: defensiveReboundingSpecialists.map((row) => briefPlayer(row, "both")),
    starBandChanges: starBandChanges.map((row) => ({
      ...briefPlayer(row, "both"),
      starCurrent: row.starCurrent,
      starClaude: row.starClaude
    })),
    starBandChangesNoShrink: starBandChangesNoShrink.map((row) => ({
      ...briefPlayer(row, "claudeNoShrink"),
      starCurrent: row.starCurrent,
      starClaudeNoShrink: row.starClaudeNoShrink
    })),
    starDistribution: {
      current: starDistribution(rows, (row) => row.starCurrent),
      claudeShrink: starDistribution(rows, (row) => row.starClaude),
      claudeNoShrink: starDistribution(rows, (row) => row.starClaudeNoShrink),
      claudeAdvancedShrink: starDistribution(rows, (row) => row.starClaudeAdvanced)
    },
    advancedBonusDiagnostics: {
      averageBonusWhereAvailable: round(average(scored.map((game) => game.advancedBonus).filter((value): value is number => value !== null)), 3),
      maxBonus: round(Math.max(0, ...scored.map((game) => game.advancedBonus ?? 0)), 3),
      minBonus: round(Math.min(0, ...scored.map((game) => game.advancedBonus ?? 0)), 3),
      note: "Advanced bonus changes the percentile input after efficiency is already partly paid/penalized through missed shots and free throws; treat as likely double-count risk unless calibrated."
    },
    top10SideBySide,
    rowsByPlayerId: Object.fromEntries(rows.map((row) => [row.playerId, row]))
  };

  function briefPlayer(row: PlayerBoardRow, mode: "current" | "claude" | "claudeNoShrink" | "claudeAdvanced" | "both") {
    return {
      playerId: row.playerId,
      displayName: row.displayName,
      team: row.currentTeam,
      position: row.position,
      games: row.games,
      currentRank: row.currentFormulaRank,
      currentRating: row.currentFormulaRating === null ? null : round(row.currentFormulaRating),
      storedPlayerRating: row.storedPlayerRating === null ? null : round(row.storedPlayerRating),
      claudeRank: row.claudeRank,
      claudeRating: round(row.claudeAdjusted),
      claudeNoShrinkRank: row.claudeNoShrinkRank,
      claudeNoShrink: round(row.claudeNoShrink),
      claudeAdvancedRank: row.claudeAdvancedRank,
      claudeAdvancedRating: round(row.claudeAdvancedAdjusted),
      ppg: round(row.ppg, 1),
      rpg: round(row.rpg, 1),
      apg: round(row.apg, 1),
      spg: round(row.spg, 1),
      bpg: round(row.bpg, 1),
      tov: round(row.tov, 1),
      fgPct: row.fgPct === null ? null : round(row.fgPct * 100, 1),
      tsPct: row.tsPct === null ? null : round(row.tsPct * 100, 1),
      comparisonMode: mode
    };
  }
}

function starDistribution(rows: PlayerBoardRow[], getter: (row: PlayerBoardRow) => number | null) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const star = getter(row);
    if (star === null) return acc;
    acc[String(star)] = (acc[String(star)] ?? 0) + 1;
    return acc;
  }, {});
}

function markdownTable(rows: Array<Record<string, string | number | null>>) {
  if (!rows.length) return "_No rows._";
  const headers = Object.keys(rows[0]);
  const line = `| ${headers.join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${headers.map((header) => String(row[header] ?? "-").replace(/\|/g, "\\|")).join(" | ")} |`);
  return [line, sep, ...body].join("\n");
}

function buildMarkdown(report: Record<string, unknown>, boardReports: ReturnType<typeof summarizeBoard>[]) {
  const sections = [
    "# Player Rating Formula Comparison",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Current Production Formula Summary",
    "",
    "- Formula v1 computes raw GamePerformanceScore values from official imported GameStats.",
    "- Current raw score uses points, missed FG/FT costs, rebounds, assists, steals, blocks, turnovers, personal fouls, and fouls drawn.",
    "- Raw game values are percentile-scaled to 1-100 within the imported submission context.",
    "- PlayerRating is the simple average of stored finalPerformanceScore values for the processed age/season context.",
    "- Current production ratings do not apply Bayesian shrinkage in the active post-import processing path.",
    "- Current public ranking/snapshot generation sorts existing PlayerRating rows; this comparison does not update those rows.",
    "",
    "## Candidate Formula Summary",
    "",
    "- Claude candidate uses league/season possessions, PPP, rebound rates, and FT-cost-per-foul.",
    "- Raw game value excludes plus-minus.",
    "- Candidate scores are percentile-scaled within normalized age/gender/competition/season pools.",
    "- Player ratings are reported both with Bayesian shrinkage and without shrinkage.",
    "- Claude No Shrinkage = recency-weighted average of candidate game scores with no pull toward age-group mean.",
    "- Advanced bonus is reported separately because it can double-count efficiency already captured by missed-shot and FT costs.",
    "",
    "## Read-only Guardrails",
    "",
    "- Active official games are read as non-deleted `SUBMITTED` or `VERIFIED` Game rows, matching the current imported/published dataset convention.",
    "- No database writes were performed.",
    "- No PlayerRating, GamePerformanceScore, RankingSnapshot, GameStat, or Game rows were updated.",
    "- The JSON and Markdown files are reports only.",
    ""
  ];

  for (const board of boardReports) {
    sections.push(
      `## ${board.label}`,
      "",
      `Input: ${board.input.games} games, ${board.input.gameStats} GameStats, ${board.input.players} players, ${board.input.pools} scaling pools.`,
      "",
      "### Top 10 Side by Side",
      "",
      markdownTable(board.top10SideBySide),
      "",
      "### Distribution",
      "",
      "```json",
      JSON.stringify(board.distributions, null, 2),
      "```",
      "",
      "### Biggest Risers - Claude With Shrinkage",
      "",
      markdownTable(board.biggestRisers.slice(0, 10).map((row) => ({
        change: row.rankChange,
        player: row.displayName,
        current: row.currentRating,
        candidate: row.claudeRating,
        games: row.games,
        ppg: row.ppg,
        ts: row.tsPct
      }))),
      "",
      "### Biggest Fallers - Claude With Shrinkage",
      "",
      markdownTable(board.biggestFallers.slice(0, 10).map((row) => ({
        change: row.rankChange,
        player: row.displayName,
        current: row.currentRating,
        candidate: row.claudeRating,
        games: row.games,
        ppg: row.ppg,
        ts: row.tsPct
      }))),
      "",
      "### Biggest Risers - Claude No Shrinkage",
      "",
      markdownTable(board.biggestRisersNoShrink.slice(0, 10).map((row) => ({
        change: row.rankChange,
        player: row.displayName,
        current: row.currentRating,
        noShrink: row.claudeNoShrink,
        games: row.games,
        ppg: row.ppg,
        ts: row.tsPct
      }))),
      "",
      "### Biggest Fallers - Claude No Shrinkage",
      "",
      markdownTable(board.biggestFallersNoShrink.slice(0, 10).map((row) => ({
        change: row.rankChange,
        player: row.displayName,
        current: row.currentRating,
        noShrink: row.claudeNoShrink,
        games: row.games,
        ppg: row.ppg,
        ts: row.tsPct
      }))),
      "",
      "### Low-Game Outliers - Claude No Shrinkage",
      "",
      markdownTable(board.lowGameOutliersNoShrink.slice(0, 10).map((row) => ({
        player: row.displayName,
        rank: row.claudeNoShrinkRank,
        noShrink: row.claudeNoShrink,
        games: row.games,
        ppg: row.ppg,
        ts: row.tsPct
      }))),
      "",
      "### Star Band Distribution",
      "",
      "```json",
      JSON.stringify(board.starDistribution, null, 2),
      "```",
      "",
      "### Star Band Changes - Claude With Shrinkage",
      "",
      markdownTable(board.starBandChanges.slice(0, 15).map((row) => ({
        player: row.displayName,
        currentStar: row.starCurrent,
        candidateStar: row.starClaude,
        current: row.currentRating,
        candidate: row.claudeRating,
        games: row.games
      }))),
      "",
      "### Star Band Changes - Claude No Shrinkage",
      "",
      markdownTable(board.starBandChangesNoShrink.slice(0, 15).map((row) => ({
        player: row.displayName,
        currentStar: row.starCurrent,
        noShrinkStar: row.starClaudeNoShrink,
        current: row.currentRating,
        noShrink: row.claudeNoShrink,
        games: row.games
      }))),
      ""
    );
  }

  sections.push(
    "## Initial Recommendation",
    "",
    "- The possession-informed raw game value is a stronger direction than the current simpler production score because it prices missed shots, rebounds, turnovers, fouls, and creation using league context.",
    "- Disabling shrinkage fixes most top-score compression, but it reintroduces low-game volatility where minimum-game eligibility is not applied.",
    "- Current public boards may rely on eligibility thresholds to handle low-sample players instead of shrinking all ratings.",
    "- The advanced bonus should remain off until calibrated; it likely double-counts efficiency because missed-shot and missed-FT costs already reward efficient scoring.",
    "- Before production adoption, validate with coaches/scouts on a few known competitions and decide whether percentile scaling should be competition-only or cross-competition with explicit league weights.",
    "",
    "## JSON Report",
    "",
    `See \`${path.relative(projectRoot, jsonPath).replace(/\\/g, "/")}\`.`,
    ""
  );

  return sections.join("\n");
}

async function main() {
  mkdirSync(reportsDir, { recursive: true });
  const stats = await loadOfficialStats();
  const boards = boardConfigs(stats);
  const boardReports = boards.map((board) => summarizeBoard(board, filterBoardStats(stats, board)));
  const report = {
    generatedAt: new Date().toISOString(),
    command: "npx.cmd tsx scripts/compare-player-rating-formulas.ts",
    guardrails: {
      readOnly: true,
      databaseWrites: false,
      productionRatingsUpdated: false,
      snapshotsGenerated: false
    },
    currentFormulaSummary: {
      source: "src/lib/submission-post-import-processing.ts",
      scale: "percentile within imported submission context",
      playerRating: "simple average of stored finalPerformanceScore values in current production path",
      bayesianShrinkage: false
    },
    candidateFormulaSummary: {
      source: "Claude draft from user prompt",
      scale: "percentile within normalized age/gender/competition/season pool",
      recencyWeighting: true,
      bayesianShrinkage: "reported as original Claude shrinkage and no-shrinkage variants",
      advancedBonusVariant: true,
      plusMinusIncluded: false
    },
    boards: boardReports.map(({ rowsByPlayerId: _rowsByPlayerId, ...board }) => board)
  };

  writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  writeFileSync(markdownPath, buildMarkdown(report, boardReports));

  const sideBySide = boardReports.map((board) => ({
    board: board.label,
    top10: board.top10SideBySide
  }));
  console.log(JSON.stringify({
    reportPaths: {
      json: jsonPath,
      markdown: markdownPath
    },
    boardsCompared: boardReports.map((board) => ({
      id: board.id,
      label: board.label,
      games: board.input.games,
      gameStats: board.input.gameStats,
      players: board.input.players,
      currentTopPlayer: board.top10SideBySide[0]?.current ?? null,
      claudeTopPlayer: board.top10SideBySide[0]?.claudeShrink ?? null,
      claudeNoShrinkTopPlayer: board.top10SideBySide[0]?.claudeNoShrink ?? null,
      starBandChanges: board.starBandChanges.length,
      starBandChangesNoShrink: board.starBandChangesNoShrink.length,
      lowGameOutliers: board.lowGameOutliers.length
    })),
    sideBySide
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
