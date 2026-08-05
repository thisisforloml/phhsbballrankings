/**
 * Formula v3 contextual player-rating preview.
 * Read-only: this script writes report files only, never database rows.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AgeGroup, PlayerGender } from "@prisma/client";

import { publicBoardMinimumGames } from "../src/lib/eligibility";
import { prisma } from "../src/lib/prisma";
import {
  buildFormulaV3Ratings,
  DEFAULT_FORMULA_V3_PARAMS,
  FORMULA_V3_POLICY_ID,
  loadFormulaV3Evidence,
  scoreIndependentGames,
  type FormulaV3GameScore
} from "../src/lib/ratings/formula-v3";
import { resolveActivePlayerRatingFilter } from "../src/lib/ratings/player-rating-query";

const reportsDir = join(process.cwd(), "scripts", "reports");
const jsonPath = join(reportsDir, "formula-v3-3-continuous-strength-preview.json");
const markdownPath = join(reportsDir, "formula-v3-3-continuous-strength-preview.md");

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function competitionDiagnostics(rows: Awaited<ReturnType<typeof loadFormulaV3Evidence>>["rows"]) {
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = `${row.leagueId}|${row.seasonId}|${row.competitionAgeLabel}|${row.gender}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(row);
    groups.set(key, bucket);
  }
  return [...groups.entries()].map(([key, pool]) => ({
    key,
    league: pool[0].leagueName,
    tier: pool[0].leagueTier,
    qualityScore: pool[0].leagueQualityScore,
    age: pool[0].competitionAgeLabel,
    gender: pool[0].gender,
    games: new Set(pool.map((row) => row.gameId)).size,
    players: new Set(pool.map((row) => row.playerId)).size,
    statRows: pool.length
  })).sort((a, b) => a.tier - b.tier || a.league.localeCompare(b.league));
}

function connectivityDiagnostics(rows: Awaited<ReturnType<typeof loadFormulaV3Evidence>>["rows"]) {
  const boardGroups = new Map<string, typeof rows>();
  for (const row of rows) {
    const board = `${row.ratingAgeGroup}|${row.gender}`;
    const bucket = boardGroups.get(board) ?? [];
    bucket.push(row);
    boardGroups.set(board, bucket);
  }
  return [...boardGroups.entries()].map(([board, boardRows]) => {
    const playerPools = new Map<string, Set<string>>();
    const pools = new Set<string>();
    for (const row of boardRows) {
      const pool = `${row.leagueId}|${row.seasonId}|${row.competitionAgeLabel}`;
      pools.add(pool);
      const values = playerPools.get(row.playerId) ?? new Set<string>();
      values.add(pool);
      playerPools.set(row.playerId, values);
    }
    const graph = new Map([...pools].map((pool) => [pool, new Set<string>()]));
    let crossoverPlayers = 0;
    for (const playerPoolSet of playerPools.values()) {
      const list = [...playerPoolSet];
      if (list.length > 1) crossoverPlayers += 1;
      for (let left = 0; left < list.length; left += 1) {
        for (let right = left + 1; right < list.length; right += 1) {
          graph.get(list[left])?.add(list[right]);
          graph.get(list[right])?.add(list[left]);
        }
      }
    }
    const visited = new Set<string>();
    const components: string[][] = [];
    for (const pool of pools) {
      if (visited.has(pool)) continue;
      const component: string[] = [];
      const queue = [pool];
      visited.add(pool);
      while (queue.length) {
        const currentPool = queue.shift()!;
        component.push(currentPool);
        for (const neighbor of graph.get(currentPool) ?? []) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }
      components.push(component);
    }
    return {
      board,
      pools: pools.size,
      crossoverPlayers,
      connectedComponents: components.length,
      largestComponentPools: Math.max(0, ...components.map((component) => component.length)),
      promotionConnected: pools.size <= 1 || components.length === 1
    };
  });
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function starDistribution(rows: Array<{ starRating: number }>) {
  return rows.reduce<Record<string, number>>((result, row) => {
    result[String(row.starRating)] = (result[String(row.starRating)] ?? 0) + 1;
    return result;
  }, {});
}

function spearman(pairs: Array<{ x: number; y: number }>) {
  if (pairs.length < 2) return null;
  const xMean = average(pairs.map((pair) => pair.x));
  const yMean = average(pairs.map((pair) => pair.y));
  let numerator = 0;
  let xDenominator = 0;
  let yDenominator = 0;
  for (const pair of pairs) {
    const x = pair.x - xMean;
    const y = pair.y - yMean;
    numerator += x * y;
    xDenominator += x * x;
    yDenominator += y * y;
  }
  const denominator = Math.sqrt(xDenominator * yDenominator);
  return denominator === 0 ? null : numerator / denominator;
}

function temporalNextGameDiagnostic(rows: FormulaV3GameScore[]) {
  const byPlayer = new Map<string, FormulaV3GameScore[]>();
  for (const row of rows) {
    const bucket = byPlayer.get(row.playerId) ?? [];
    bucket.push(row);
    byPlayer.set(row.playerId, bucket);
  }

  let samples = 0;
  let independentError = 0;
  let contextualError = 0;
  for (const playerRows of byPlayer.values()) {
    const ordered = [...playerRows].sort(
      (a, b) => a.gameDate.getTime() - b.gameDate.getTime() || a.gameId.localeCompare(b.gameId)
    );
    for (let index = 0; index < ordered.length - 1; index += 1) {
      const current = ordered[index];
      const next = ordered[index + 1];
      if (current.gameDate.getTime() === next.gameDate.getTime()) continue;
      samples += 1;
      independentError += Math.abs(current.independentScore - next.independentScore);
      contextualError += Math.abs(current.finalGameScore - next.independentScore);
    }
  }

  const independentMae = samples ? independentError / samples : 0;
  const contextualMae = samples ? contextualError / samples : 0;
  return {
    samples,
    independentMae: round(independentMae, 3),
    contextualMae: round(contextualMae, 3),
    improvement: round(independentMae - contextualMae, 3),
    passesInitialGate: contextualMae <= independentMae + 0.25
  };
}

function table(rows: Array<Record<string, string | number | null>>) {
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
  const candidate = buildFormulaV3Ratings(independent.rows, evaluationDate);
  const active = await resolveActivePlayerRatingFilter();
  const current = active.formulaVersionId
    ? await prisma.playerRating.findMany({
        where: {
          formulaVersionId: active.formulaVersionId,
          policyVersionId: active.policyVersionId,
          player: { deletedAt: null }
        },
        select: {
          playerId: true,
          ageGroup: true,
          adjustedRating: true,
          verifiedGameCount: true,
          starRating: true,
          player: { select: { displayName: true, gender: true } }
        }
      })
    : [];

  const boardKeys = new Set(candidate.ratings.map((row) => `${row.ageGroup}|${row.gender}`));
  const boards = [...boardKeys].sort().map((key) => {
    const [ageGroup, gender] = key.split("|") as [AgeGroup, PlayerGender];
    const minimumGames = publicBoardMinimumGames(gender === PlayerGender.GIRLS ? "Girls" : "Boys");
    const v3 = candidate.ratings
      .filter((row) => row.ageGroup === ageGroup && row.gender === gender)
      .sort((a, b) => b.adjustedRating - a.adjustedRating || b.verifiedGameCount - a.verifiedGameCount || a.displayName.localeCompare(b.displayName));
    const v3Eligible = v3.filter((row) => row.verifiedGameCount >= minimumGames);
    const production = current
      .filter((row) => row.ageGroup === ageGroup && row.player.gender === gender)
      .sort((a, b) => Number(b.adjustedRating) - Number(a.adjustedRating) || b.verifiedGameCount - a.verifiedGameCount || a.player.displayName.localeCompare(b.player.displayName));
    const productionEligible = production.filter((row) => row.verifiedGameCount >= minimumGames);

    const v3Rank = new Map(v3Eligible.map((row, index) => [row.playerId, index + 1]));
    const productionRank = new Map(productionEligible.map((row, index) => [row.playerId, index + 1]));
    const overlap = v3Eligible
      .filter((row) => productionRank.has(row.playerId))
      .map((row) => ({
        playerId: row.playerId,
        displayName: row.displayName,
        v3Rank: v3Rank.get(row.playerId)!,
        productionRank: productionRank.get(row.playerId)!,
        rankDelta: productionRank.get(row.playerId)! - v3Rank.get(row.playerId)!,
        v3Rating: row.adjustedRating,
        qualityGames: row.qualityGameEquivalent,
        highQualityGames: row.highQualityGameEquivalent,
        consistency: row.consistency,
        productionRating: Number(productionEligible.find((item) => item.playerId === row.playerId)!.adjustedRating),
        games: row.verifiedGameCount
      }));

    return {
      key,
      label: `${ageGroup} ${gender === PlayerGender.GIRLS ? "Girls" : "Boys"}`,
      minimumGames,
      candidateCount: v3.length,
      candidateEligibleCount: v3Eligible.length,
      productionCount: production.length,
      productionEligibleCount: productionEligible.length,
      overlapCount: overlap.length,
      rankCorrelation: round(spearman(overlap.map((row) => ({ x: row.productionRank, y: row.v3Rank }))) ?? 0, 3),
      candidateStarDistribution: starDistribution(v3Eligible),
      top10SideBySide: Array.from({ length: Math.min(10, Math.max(v3Eligible.length, productionEligible.length)) }, (_, index) => ({
        rank: index + 1,
        production: productionEligible[index]?.player.displayName ?? "-",
        productionRating: productionEligible[index] ? round(Number(productionEligible[index].adjustedRating)) : null,
        v3: v3Eligible[index]?.displayName ?? "-",
        v3Rating: v3Eligible[index]?.adjustedRating ?? null,
        v3Games: v3Eligible[index]?.verifiedGameCount ?? null
      })),
      biggestRisers: [...overlap].sort((a, b) => b.rankDelta - a.rankDelta).slice(0, 15),
      biggestFallers: [...overlap].sort((a, b) => a.rankDelta - b.rankDelta).slice(0, 15),
      lowSampleOutliers: v3
        .filter((row) => row.verifiedGameCount < minimumGames)
        .slice(0, 20)
        .map((row, index) => ({
          rank: index + 1,
          player: row.displayName,
          rating: row.adjustedRating,
          games: row.verifiedGameCount,
          confidence: row.confidence
        }))
    };
  });

  const coveragePercent = Object.fromEntries(
    Object.entries(loaded.coverage)
      .filter(([key]) => key !== "totalStatRows")
      .map(([key, value]) => [key, round((Number(value) / Math.max(loaded.coverage.totalStatRows, 1)) * 100, 1)])
  );
  const contextAdjustments = candidate.games.map((row) => row.totalContextAdjustment);
  const boardMembershipCount = candidate.ratings.reduce<Map<string, number>>((result, row) => {
    result.set(row.playerId, (result.get(row.playerId) ?? 0) + 1);
    return result;
  }, new Map());
  const multiBoardPlayers = [...boardMembershipCount.values()].filter((count) => count > 1).length;
  const holdout = temporalNextGameDiagnostic(candidate.games);
  const competitions = competitionDiagnostics(loaded.rows);
  const connectivity = connectivityDiagnostics(loaded.rows);
  const report = {
    generatedAt: evaluationDate.toISOString(),
    command: "npm.cmd run ratings:v3.3:preview",
    mode: "read-only-shadow",
    policyVersionId: FORMULA_V3_POLICY_ID,
    databaseWrites: false,
    productionRatingsChanged: false,
    snapshotsGenerated: false,
    inventory: {
      officialStatRows: loaded.rows.length,
      officialGames: new Set(loaded.rows.map((row) => row.gameId)).size,
      players: new Set(loaded.rows.map((row) => row.playerId)).size,
      pools: independent.pools.length,
      candidateRatings: candidate.ratings.length,
      currentProductionRatings: current.length,
      playersOnMultipleCandidateBoards: multiBoardPlayers
    },
    coverage: loaded.coverage,
    coveragePercent,
    temporalNextGameDiagnostic: holdout,
    competitionStrength: {
      provisionalAdminTierPrior: true,
      translations: DEFAULT_FORMULA_V3_PARAMS.competitionTranslation,
      competitions,
      artificialCeilingPileup: candidate.ratings.filter((row) => row.adjustedRating === 89.99).length
    },
    connectivity,
    promotionGates: {
      noWrites: true,
      temporalNonRegression: holdout.passesInitialGate,
      allMultiPoolBoardsConnected: connectivity.every((board) => board.promotionConnected),
      noMultiBoardIdentityConflicts: multiBoardPlayers === 0,
      tierGovernanceReviewRequired: true,
      readyForPublicPromotion: false
    },
    context: {
      minimum: round(Math.min(...contextAdjustments), 3),
      maximum: round(Math.max(...contextAdjustments), 3),
      average: round(average(contextAdjustments), 3),
      absoluteAverage: round(average(contextAdjustments.map(Math.abs)), 3),
      nonNeutralPercent: round((contextAdjustments.filter((value) => Math.abs(value) >= 0.01).length / Math.max(contextAdjustments.length, 1)) * 100, 1),
      cappedAt: 4.5,
      sameGameLeakagePrevented: true,
      sameDayLeakagePrevented: true
    },
    warnings: loaded.warnings,
    boards
  };

  const markdown = [
    "# Formula v3.3 Continuous Strength Player Rating Preview",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Read-only shadow evaluation. No PlayerRating, GamePerformanceScore, FormulaVersion, RankingSnapshot, Game, or GameStat rows were written.",
    "",
    "## Design",
    "",
    "- Box-score value prices scoring, missed shots/free throws, rebounds, assists, steals, blocks, turnovers, fouls, and fouls drawn using competition possession context.",
    "- Honest advanced metrics provide a capped secondary adjustment from TS%, eFG%, AST/TO, and defensive activity. Missing inputs are omitted and reweighted, not treated as zero.",
    "- Opponent and teammate individual strength use reliability-adjusted ratings from games completed before the current game date.",
    "- Team strength is the average of prior participant ratings for that Team and Season.",
    "- Team baseline and game-lineup deviation are separated to avoid double-counting the same players.",
    "- Competition strength continuously translates within-competition scores onto a national scale; lower-strength evidence contributes less without creating hard rating ceilings.",
    "- Per-32 production contributes at most 12% and only after eight minutes; low-minute spikes cannot activate it.",
    "- Playing-up years are reported for context but add no direct rating points; opponent and competition evidence carry the difficulty signal.",
    "- Consistency is reported as confidence evidence and does not directly penalize talent.",
    "- Public eligibility remains separate from rating ability; quality-game equivalents expose repeated weak-schedule accumulation.",
    "- Context can move a game score by at most 4.5 points. Displayed ratings use recency weighting and no Bayesian shrinkage.",
    "- Plus-minus, official-style ORTG/DRTG, BPM, PER, and Win Shares are excluded because current youth box scores do not consistently provide possession-level lineup inputs needed to estimate them honestly.",
    "",
    "## Inventory",
    "",
    "```json",
    JSON.stringify(report.inventory, null, 2),
    "```",
    "",
    "## Input Coverage (%)",
    "",
    "```json",
    JSON.stringify(coveragePercent, null, 2),
    "```",
    "",
    "## Temporal next-game diagnostic",
    "",
    "This is an initial stability check, not a promotion-grade causal validation. It tests whether a contextualized game score predicts the player's next independent game score at least as well as the unadjusted score.",
    "",
    "```json",
    JSON.stringify(holdout, null, 2),
    "```",
    "",
    "## Competition Strength and Connectivity",
    "",
    "The stored League tier is a conservative governance prior, not an automatically learned truth. Cross-competition player overlap is reported as the calibration network required before promotion.",
    "",
    "```json",
    JSON.stringify({ competitions, connectivity, artificialCeilingPileup: report.competitionStrength.artificialCeilingPileup }, null, 2),
    "```",
    "",
    "## Promotion Gates",
    "",
    "```json",
    JSON.stringify(report.promotionGates, null, 2),
    "```",
    "",
    "## Context Guardrails",
    "",
    "```json",
    JSON.stringify(report.context, null, 2),
    "```",
    "",
    ...boards.flatMap((board) => [
      `## ${board.label}`,
      "",
      `Candidate ratings: ${board.candidateCount}; eligible at current ${board.minimumGames}-game threshold: ${board.candidateEligibleCount}; eligible production rows: ${board.productionEligibleCount}; eligible overlap: ${board.overlapCount}; rank correlation: ${board.rankCorrelation}.`,
      "",
      "### Eligible Top 10 Side by Side",
      "",
      table(board.top10SideBySide),
      "",
      "### Biggest Risers",
      "",
      table(board.biggestRisers.slice(0, 10).map((row) => ({
        change: row.rankDelta,
        player: row.displayName,
        production: row.productionRating,
        v3: row.v3Rating,
        games: row.games
      }))),
      "",
      "### Biggest Fallers",
      "",
      table(board.biggestFallers.slice(0, 10).map((row) => ({
        change: row.rankDelta,
        player: row.displayName,
        production: row.productionRating,
        v3: row.v3Rating,
        games: row.games
      }))),
      "",
      "### Low-sample leaders (not public-eligible)",
      "",
      table(board.lowSampleOutliers.slice(0, 10)),
      ""
    ]),
    "## Production Recommendation",
    "",
    "Do not switch the public leaderboard from this preview alone. Competition tiers require governance review, disconnected competition pools require bridge evidence, multi-board identity conflicts must be resolved, and an explicit versioned write/promotion run must be approved.",
    ""
  ].join("\n");

  mkdirSync(reportsDir, { recursive: true });
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  writeFileSync(markdownPath, markdown);
  console.log(JSON.stringify({ report: { jsonPath, markdownPath }, ...report.inventory, boards: boards.map((board) => ({ label: board.label, candidateCount: board.candidateCount, eligible: board.candidateEligibleCount, rankCorrelation: board.rankCorrelation, top3: board.top10SideBySide.slice(0, 3) })), warnings: loaded.warnings.length }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
