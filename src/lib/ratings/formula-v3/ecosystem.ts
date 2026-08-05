import { prisma } from "@/lib/prisma";
import {
  buildCompetitionStrengthProfile,
  type CompetitionStrengthInput
} from "@/lib/ratings/competition-strength-v1";
import {
  buildFormulaV3Ratings,
  type FormulaV3IndependentGameScore,
  loadFormulaV3Evidence,
  scoreIndependentGames} from "@/lib/ratings/formula-v3";
import {
  computeTeamTpiV2,
  type TeamTpiV2GameInput,
  type TeamTpiV2Result
} from "@/lib/team-ratings/team-tpi-v2";
function average(values: number[], fallback = 0) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : fallback;
}

function poolKey(row: FormulaV3IndependentGameScore) {
  return `${row.seasonId}|${row.competitionAgeGroup}|${row.gender}`;
}

function boardKey(row: FormulaV3IndependentGameScore) {
  return `${row.ratingAgeGroup}|${row.gender}`;
}

function sumNullable(
  rows: FormulaV3IndependentGameScore[],
  getter: (row: FormulaV3IndependentGameScore) => number | null
) {
  const values = rows.map(getter);
  return values.some((value) => value === null)
    ? null
    : values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

function estimatePossessions(rows: FormulaV3IndependentGameScore[]) {
  const attempts = sumNullable(rows, (row) => row.fieldGoalsAttempt);
  const offensiveRebounds = sumNullable(rows, (row) => row.offensiveRebounds);
  const turnovers = sumNullable(rows, (row) => row.turnovers);
  const freeThrowAttempts = sumNullable(rows, (row) => row.freeThrowsAttempt);
  if (attempts === null || offensiveRebounds === null || turnovers === null || freeThrowAttempts === null) {
    return null;
  }
  return Math.max(1, attempts - offensiveRebounds + turnovers + 0.44 * freeThrowAttempts);
}

type CompetitionGroup = {
  rows: FormulaV3IndependentGameScore[];
  playerRatings: number[];
  crossoverDeltas: number[];
  crossoverPlayers: Set<string>;
};

function buildCompetitionGroups(rows: FormulaV3IndependentGameScore[]) {
  const groups = new Map<string, CompetitionGroup>();
  const playerPoolScores = new Map<string, Map<string, number[]>>();

  for (const row of rows) {
    const key = poolKey(row);
    const group = groups.get(key) ?? {
      rows: [],
      playerRatings: [],
      crossoverDeltas: [],
      crossoverPlayers: new Set<string>()
    };
    group.rows.push(row);
    groups.set(key, group);

    const playerBoard = `${row.playerId}|${boardKey(row)}`;
    const pools = playerPoolScores.get(playerBoard) ?? new Map<string, number[]>();
    const scores = pools.get(key) ?? [];
    scores.push(row.stabilizedIndependentScore);
    pools.set(key, scores);
    playerPoolScores.set(playerBoard, pools);
  }

  for (const group of groups.values()) {
    const byPlayer = new Map<string, number[]>();
    for (const row of group.rows) {
      const scores = byPlayer.get(row.playerId) ?? [];
      scores.push(row.stabilizedIndependentScore);
      byPlayer.set(row.playerId, scores);
    }
    group.playerRatings = [...byPlayer.values()].map((scores) => average(scores, 50));
  }

  for (const [playerBoard, pools] of playerPoolScores) {
    if (pools.size < 2) continue;
    const playerId = playerBoard.split("|")[0];
    const means = [...pools.entries()].map(([key, scores]) => [key, average(scores, 50)] as const);
    for (const [key, value] of means) {
      const alternatives = means.filter(([otherKey]) => otherKey !== key).map(([, score]) => score);
      const group = groups.get(key);
      if (!group || !alternatives.length) continue;
      group.crossoverDeltas.push(value - average(alternatives, 50));
      group.crossoverPlayers.add(playerId);
    }
  }

  return groups;
}

function buildCompetitionProfiles(
  groups: Map<string, CompetitionGroup>,
  teamRatings: TeamTpiV2Result[] = []
) {
  const teamRatingsByPool = new Map<string, number[]>();
  for (const team of teamRatings) {
    const ratings = teamRatingsByPool.get(team.poolKey) ?? [];
    ratings.push(team.rating);
    teamRatingsByPool.set(team.poolKey, ratings);
  }

  const inputs: CompetitionStrengthInput[] = [...groups.entries()].map(([key, group]) => {
    const first = group.rows[0];
    return {
      poolKey: key,
      leagueId: first.leagueId,
      seasonId: first.seasonId,
      label: `${first.leagueName} / ${first.competitionAgeLabel} / ${first.gender}`,
      tier: first.leagueTier,
      qualityScore: first.leagueQualityScore,
      governanceVerified: first.leagueVerificationStatus === "VERIFIED",
      governanceEvidenceScore: first.leagueGovernanceEvidenceScore ?? first.leagueQualityScore,
      gameCount: new Set(group.rows.map((row) => row.gameId)).size,
      teamCount: new Set(group.rows.map((row) => row.teamId)).size,
      playerCount: new Set(group.rows.map((row) => row.playerId)).size,
      crossoverPlayerCount: group.crossoverPlayers.size,
      independentPlayerRatings: group.playerRatings,
      teamPerformanceRatings: teamRatingsByPool.get(key) ?? [],
      crossoverDeltas: group.crossoverDeltas
    };
  });

  return inputs
    .map(buildCompetitionStrengthProfile)
    .sort((left, right) => right.strengthRating - left.strengthRating || left.label.localeCompare(right.label));
}

function priorRosterRating(
  history: Map<string, number[]>,
  rows: FormulaV3IndependentGameScore[]
) {
  const rotation = [...rows]
    .sort((left, right) => (right.minutes ?? 0) - (left.minutes ?? 0))
    .slice(0, 8);
  let weightedSum = 0;
  let totalWeight = 0;
  for (const row of rotation) {
    const scores = history.get(row.playerId) ?? [];
    if (!scores.length) continue;
    const reliability = scores.length / (scores.length + 5);
    const estimate = 50 + (average(scores, 50) - 50) * reliability;
    const minutesWeight = row.minutes !== null && row.minutes > 0 ? row.minutes : 1;
    weightedSum += estimate * minutesWeight;
    totalWeight += minutesWeight;
  }
  return totalWeight > 0 ? weightedSum / totalWeight : null;
}

async function buildTeamGameInputs(rows: FormulaV3IndependentGameScore[]) {
  const gameIds = [...new Set(rows.map((row) => row.gameId))];
  const games = await prisma.game.findMany({
    where: { id: { in: gameIds }, deletedAt: null },
    select: {
      id: true,
      gameDate: true,
      homeTeamId: true,
      awayTeamId: true,
      homeScore: true,
      awayScore: true,
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } }
    }
  });
  const dbGames = new Map(games.map((game) => [game.id, game]));
  const byGame = new Map<string, FormulaV3IndependentGameScore[]>();
  for (const row of rows) {
    const bucket = byGame.get(row.gameId) ?? [];
    bucket.push(row);
    byGame.set(row.gameId, bucket);
  }

  const history = new Map<string, number[]>();
  const output: TeamTpiV2GameInput[] = [];
  const orderedDates = [...new Set(games.map((game) => game.gameDate.toISOString().slice(0, 10)))].sort();
  for (const date of orderedDates) {
    const dayRows = rows.filter((row) => row.gameDate.toISOString().slice(0, 10) === date);
    const dayGameIds = games
      .filter((game) => game.gameDate.toISOString().slice(0, 10) === date)
      .map((game) => game.id);
    for (const gameId of dayGameIds) {
      const statRows = byGame.get(gameId) ?? [];
      const game = dbGames.get(gameId);
      if (!game || !statRows.length) continue;
      const first = statRows[0];
      const homeRows = statRows.filter((row) => row.teamId === game.homeTeamId);
      const awayRows = statRows.filter((row) => row.teamId === game.awayTeamId);
      output.push({
        gameId,
        gameDate: game.gameDate,
        poolKey: poolKey(first),
        ageGroup: first.competitionAgeGroup,
        gender: first.gender,
        homeTeamId: game.homeTeamId,
        awayTeamId: game.awayTeamId,
        homeTeamName: game.homeTeam.name,
        awayTeamName: game.awayTeam.name,
        homeScore: game.homeScore,
        awayScore: game.awayScore,
        homePossessions: estimatePossessions(homeRows),
        awayPossessions: estimatePossessions(awayRows),
        homeRosterStrength: priorRosterRating(history, homeRows),
        awayRosterStrength: priorRosterRating(history, awayRows)
      });
    }

    // Prevent same-day results from leaking into other games on that date.
    for (const row of dayRows) {
      const scores = history.get(row.playerId) ?? [];
      scores.push(row.stabilizedIndependentScore);
      history.set(row.playerId, scores);
    }
  }

  return output;
}

export async function buildFormulaV33Ecosystem(evaluationDate = new Date()) {
  const loaded = await loadFormulaV3Evidence(evaluationDate);
  const independent = scoreIndependentGames(loaded.rows);
  const groups = buildCompetitionGroups(independent.rows);
  const initialProfiles = buildCompetitionProfiles(groups);
  const initialMap = new Map(initialProfiles.map((profile) => [profile.poolKey, profile]));
  const teamGames = await buildTeamGameInputs(independent.rows);
  const firstTeamPass = computeTeamTpiV2(teamGames, initialMap, evaluationDate);
  const competitionProfiles = buildCompetitionProfiles(groups, firstTeamPass);
  const competitionMap = new Map(competitionProfiles.map((profile) => [profile.poolKey, profile]));
  const teamRatings = computeTeamTpiV2(teamGames, competitionMap, evaluationDate);
  const playerCandidate = buildFormulaV3Ratings(independent.rows, evaluationDate, undefined, competitionMap);

  return {
    evaluationDate,
    loaded,
    independent,
    competitionProfiles,
    teamGames,
    teamRatings,
    playerCandidate
  };
}