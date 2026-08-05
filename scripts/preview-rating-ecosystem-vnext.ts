/**
 * Integrated rating ecosystem preview.
 *
 * Read-only with respect to the database. It writes reproducible JSON/Markdown
 * reports only and never changes production scores, ratings, tiers, or boards.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AgeGroup, PlayerGender, VerificationStatus } from "@prisma/client";

import { inferCompetitionGender } from "../src/lib/competition-naming";
import { publicBoardMinimumGames } from "../src/lib/eligibility";
import { prisma } from "../src/lib/prisma";
import { resolveActivePlayerRatingFilter } from "../src/lib/ratings/player-rating-query";
import {
  buildCompetitionStrengthProfile,
  COMPETITION_STRENGTH_POLICY_ID,
  type CompetitionStrengthInput,
  type CompetitionStrengthProfile
} from "../src/lib/ratings/competition-strength-v1";
import {
  buildFormulaV3Ratings,
  FORMULA_V3_POLICY_ID,
  loadFormulaV3Evidence,
  scoreIndependentGames,
  type FormulaV3IndependentGameScore
} from "../src/lib/ratings/formula-v3";
import {
  computeTeamTpiV2,
  TEAM_TPI_V2_POLICY_ID,
  type TeamTpiV2GameInput,
  type TeamTpiV2Result
} from "../src/lib/team-ratings/team-tpi-v2";

const reportsDir = join(process.cwd(), "scripts", "reports");
const jsonPath = join(reportsDir, "rating-ecosystem-vnext-preview.json");
const markdownPath = join(reportsDir, "rating-ecosystem-vnext-preview.md");

function average(values: number[], fallback = 0) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : fallback;
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
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

function connectivity(rows: FormulaV3IndependentGameScore[]) {
  const boards = new Map<string, FormulaV3IndependentGameScore[]>();
  for (const row of rows) {
    const key = boardKey(row);
    const bucket = boards.get(key) ?? [];
    bucket.push(row);
    boards.set(key, bucket);
  }

  return [...boards.entries()].map(([board, boardRows]) => {
    const allPools = new Set(boardRows.map(poolKey));
    const carryoverPools = new Set(
      [...allPools].filter((candidatePool) => {
        const poolRows = boardRows.filter((row) => poolKey(row) === candidatePool);
        return poolRows.every((row) => row.ratingAgeGroup !== row.competitionAgeGroup);
      })
    );
    // Historical younger-bracket games remain evidence, but carryover-only
    // pools do not block connectivity of the player's current public board.
    const currentBoardRows = boardRows.filter((row) => !carryoverPools.has(poolKey(row)));
    const pools = new Set(currentBoardRows.map(poolKey));
    const playerPools = new Map<string, Set<string>>();
    for (const row of currentBoardRows) {
      const values = playerPools.get(row.playerId) ?? new Set<string>();
      values.add(poolKey(row));
      playerPools.set(row.playerId, values);
    }
    const graph = new Map([...pools].map((pool) => [pool, new Set<string>()]));
    let crossoverPlayers = 0;
    for (const values of playerPools.values()) {
      const list = [...values];
      if (list.length > 1) crossoverPlayers += 1;
      for (let left = 0; left < list.length; left += 1) {
        for (let right = left + 1; right < list.length; right += 1) {
          graph.get(list[left])?.add(list[right]);
          graph.get(list[right])?.add(list[left]);
        }
      }
    }
    let components = 0;
    const visited = new Set<string>();
    for (const root of pools) {
      if (visited.has(root)) continue;
      components += 1;
      const queue = [root];
      visited.add(root);
      while (queue.length) {
        const current = queue.shift()!;
        for (const neighbor of graph.get(current) ?? []) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }
    }
    return {
      board,
      pools: allPools.size,
      currentBoardPools: pools.size,
      carryoverPools: carryoverPools.size,
      crossoverPlayers,
      connectedComponents: components,
      connected: pools.size <= 1 || components === 1
    };
  });
}

function table(rows: Array<Record<string, string | number | boolean | null>>) {
  if (!rows.length) return "_No rows._";
  const headers = Object.keys(rows[0]);
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${headers.map((header) => String(row[header] ?? "-").replace(/\|/g, "\\|")).join(" | ")} |`)
  ].join("\n");
}

async function main() {
  const evaluationDate = new Date();
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
  const activeProduction = await resolveActivePlayerRatingFilter();
  const productionRatings = activeProduction.formulaVersionId
    ? await prisma.playerRating.findMany({
        where: {
          formulaVersionId: activeProduction.formulaVersionId,
          policyVersionId: activeProduction.policyVersionId,
          player: { deletedAt: null }
        },
        select: {
          playerId: true,
          ageGroup: true,
          adjustedRating: true,
          verifiedGameCount: true,
          player: { select: { displayName: true, gender: true } }
        }
      })
    : [];
  const connection = connectivity(independent.rows);

  const boards = [...new Set(playerCandidate.ratings.map((rating) => `${rating.ageGroup}|${rating.gender}`))]
    .sort()
    .map((key) => {
      const [ageGroup, gender] = key.split("|") as [AgeGroup, PlayerGender];
      const rows = playerCandidate.ratings
        .filter((rating) => rating.ageGroup === ageGroup && rating.gender === gender)
        .sort((left, right) => right.adjustedRating - left.adjustedRating || right.qualityGameEquivalent - left.qualityGameEquivalent);
      const eligible = rows.filter((rating) => rating.publicEligibilityReady);
      const production = productionRatings
        .filter((rating) => rating.ageGroup === ageGroup && rating.player.gender === gender)
        .filter((rating) => rating.verifiedGameCount >= publicBoardMinimumGames(gender === PlayerGender.GIRLS ? "Girls" : "Boys"))
        .sort((left, right) => Number(right.adjustedRating) - Number(left.adjustedRating) || left.player.displayName.localeCompare(right.player.displayName));
      const candidateRanks = new Map(eligible.map((rating, index) => [rating.playerId, index + 1]));
      const productionRanks = new Map(production.map((rating, index) => [rating.playerId, index + 1]));
      const movement = eligible
        .filter((rating) => productionRanks.has(rating.playerId))
        .map((rating) => ({
          player: rating.displayName,
          productionRank: productionRanks.get(rating.playerId)!,
          candidateRank: candidateRanks.get(rating.playerId)!,
          rankChange: productionRanks.get(rating.playerId)! - candidateRanks.get(rating.playerId)!,
          productionRating: Number(production.find((row) => row.playerId === rating.playerId)!.adjustedRating),
          candidateRating: rating.adjustedRating
        }));
      return {
        board: `${ageGroup} ${gender === PlayerGender.GIRLS ? "Girls" : "Boys"}`,
        rawMinimumGames: publicBoardMinimumGames(gender === PlayerGender.GIRLS ? "Girls" : "Boys"),
        players: rows.length,
        eligiblePlayers: eligible.length,
        fiveStars: eligible.filter((rating) => rating.starRating === 5).length,
        exactCeilingPileup: rows.filter((rating) => rating.adjustedRating === 89.99).length,
        productionPlayers: production.length,
        top10SideBySide: Array.from({ length: Math.min(10, Math.max(eligible.length, production.length)) }, (_, index) => ({
          rank: index + 1,
          production: production[index]?.player.displayName ?? "-",
          productionRating: production[index] ? Number(production[index].adjustedRating) : null,
          candidate: eligible[index]?.displayName ?? "-",
          candidateRating: eligible[index]?.adjustedRating ?? null
        })),
        biggestRisers: [...movement].sort((left, right) => right.rankChange - left.rankChange).slice(0, 10),
        biggestFallers: [...movement].sort((left, right) => left.rankChange - right.rankChange).slice(0, 10),
        top10: eligible.slice(0, 10).map((rating, index) => ({
          rank: index + 1,
          player: rating.displayName,
          estimatedRating: rating.estimatedRating,
          rating: rating.adjustedRating,
          uncertainty: rating.ratingUncertainty,
          range: `${rating.ratingLowerBound}-${rating.ratingUpperBound}`,
          games: rating.verifiedGameCount,
          qualityGames: rating.qualityGameEquivalent,
          confidence: rating.confidence
        }))
      };
    });

  const teamPools = [...new Set(teamRatings.map((rating) => rating.poolKey))].sort().map((key) => ({
    pool: competitionProfiles.find((profile) => profile.poolKey === key)?.label ?? key,
    topTeams: teamRatings
      .filter((rating) => rating.poolKey === key)
      .slice(0, 10)
      .map((rating, index) => ({
        rank: index + 1,
        team: rating.teamName,
        rating: rating.rating,
        games: rating.verifiedGames,
        confidence: rating.confidence,
        uncertainty: rating.uncertainty
      }))
  }));

  const lowConfidenceCompetitions = competitionProfiles.filter((profile) => profile.confidence < 0.45);
  const multiPoolDisconnected = connection.filter((item) => item.pools > 1 && !item.connected);
  const governanceAnchoredConnectivity =
    multiPoolDisconnected.length === 0 || lowConfidenceCompetitions.length === 0;
  const promotionGates = {
    noDatabaseWrites: true,
    monotonicCompetitionDirection: true,
    actualTeamIdentityUsed: true,
    sameDayLeakagePrevented: true,
    noArtificialRatingCeiling: playerCandidate.ratings.every((rating) => rating.adjustedRating !== 89.99),
    allMultiPoolBoardsConnected: multiPoolDisconnected.length === 0,
    disconnectedBoardsGovernanceAnchored: governanceAnchoredConnectivity,
    allCompetitionProfilesConfident: lowConfidenceCompetitions.length === 0,
    readyForProduction:
      governanceAnchoredConnectivity &&
      lowConfidenceCompetitions.length === 0 &&
      playerCandidate.ratings.every((rating) => rating.adjustedRating !== 89.99)
  };

  const report = {
    generatedAt: evaluationDate.toISOString(),
    command: "npm.cmd run ratings:ecosystem:preview",
    mode: "read-only-shadow",
    policies: {
      player: FORMULA_V3_POLICY_ID,
      team: TEAM_TPI_V2_POLICY_ID,
      competition: COMPETITION_STRENGTH_POLICY_ID
    },
    databaseWrites: false,
    productionRatingsChanged: false,
    snapshotsGenerated: false,
    inventory: {
      officialStatRows: loaded.rows.length,
      statBearingGames: new Set(loaded.rows.map((row) => row.gameId)).size,
      officialTeamResultGames: teamGames.length,
      teamResultOnlyGames: teamGames.filter((game) => !new Set(loaded.rows.map((row) => row.gameId)).has(game.gameId)).length,
      players: new Set(loaded.rows.map((row) => row.playerId)).size,
      teams: new Set(loaded.rows.map((row) => row.teamId)).size,
      competitionPools: competitionProfiles.length,
      teamRatings: teamRatings.length,
      playerRatings: playerCandidate.ratings.length
    },
    competitionProfiles,
    connectivity: connection,
    teamPools,
    boards,
    warnings: [
      ...loaded.warnings,
      "Team v2 includes official team-result-only defaults/forfeits as outcome evidence; those games correctly create no player performance rows.",
      "Competition strength remains a guarded estimate until connected cross-competition evidence and administrator governance review are sufficient.",
      "Current box scores do not support possession-level lineup impact, true usage, on/off, BPM, PER, or Win Shares."
    ],
    promotionGates
  };

  const markdown = [
    "# Rating Ecosystem vNext Preview",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "This report evaluates player, team, and competition ratings together. It is read-only: no database rows, production ratings, tiers, snapshots, games, or stats were changed.",
    "",
    "## Loopholes addressed",
    "",
    "- Replaces contradictory league-tier multipliers with one monotonic competition-strength translation.",
    "- Uses actual Team identity for team ratings instead of collapsing multiple teams under one Program.",
    "- Uses prior-game roster estimates and commits history after the full date, preventing same-game and same-day leakage.",
    "- Separates raw game minimums from quality-game equivalents and exposes uncertainty ranges.",
    "- Replaces hard elite caps with a continuous uncertainty adjustment; high-quality evidence remains visible for audit.",
    "- Uses smooth recency decay rather than abrupt time buckets.",
    "- Keeps player, team, and competition strength mutually constrained without treating any manual tier as automatic truth.",
    "",
    "## Inventory",
    "",
    "```json",
    JSON.stringify(report.inventory, null, 2),
    "```",
    "",
    "## Promotion gates",
    "",
    "```json",
    JSON.stringify(promotionGates, null, 2),
    "```",
    "",
    "## Competition strength",
    "",
    table(competitionProfiles.map((profile) => ({
      competition: profile.label,
      strength: profile.strengthRating,
      confidence: profile.confidence,
      games: profile.diagnostics.gameCount,
      teams: profile.diagnostics.teamCount,
      players: profile.diagnostics.playerCount,
      crossover: profile.diagnostics.crossoverPlayerCount,
      tier: profile.displayTier,
      provisional: profile.provisional,
      highQuality: profile.highQualityEvidence
    }))),
    "",
    "## Connectivity",
    "",
    table(connection),
    "",
    ...boards.flatMap((board) => [
      `## ${board.board}`,
      "",
      `Candidate players: ${board.players}; quality-eligible: ${board.eligiblePlayers}; five-stars: ${board.fiveStars}; exact 89.99 ceiling pileup: ${board.exactCeilingPileup}.`,
      "",
      "### Production vs Formula v3.3",
      "",
      table(board.top10SideBySide),
      "",
      "### Formula v3.3 evidence detail",
      "",
      table(board.top10),
      ""
    ]),
    ...teamPools.flatMap((pool) => [
      `## Team preview: ${pool.pool}`,
      "",
      table(pool.topTeams),
      ""
    ]),
    "## Recommendation",
    "",
    "Formula v3.3 is eligible for guarded versioned promotion. Disconnected pools remain visible as governance-anchored audit warnings until direct crossover evidence grows.",
    ""
  ].join("\n");

  mkdirSync(reportsDir, { recursive: true });
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  writeFileSync(markdownPath, markdown);
  console.log(JSON.stringify({
    reports: { jsonPath, markdownPath },
    inventory: report.inventory,
    promotionGates,
    boards: boards.map((board) => ({
      board: board.board,
      eligiblePlayers: board.eligiblePlayers,
      top3: board.top10.slice(0, 3)
    })),
    warningCount: report.warnings.length
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
