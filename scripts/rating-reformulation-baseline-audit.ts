/**
 * Read-only baseline audit for rating reformulation.
 * Usage: npx tsx scripts/rating-reformulation-baseline-audit.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AgeGroup, PlayerGender, VerificationStatus } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { FORMULA_V1_VERSION_NUMBER } from "../src/lib/player-rating-cumulative";
import { getCurrentRankingAgeBracket, getRankingAgeBracket } from "../src/lib/ranking-eligibility";
import { deriveEvidenceRole } from "../src/lib/ratings/formula-vnext/context-factors";

const reportsDir = join(process.cwd(), "scripts", "reports");
const jsonPath = join(reportsDir, "rating-reformulation-baseline-audit.json");
const mdPath = join(reportsDir, "rating-reformulation-baseline-audit.md");

function distribution(values: number[]) {
  if (!values.length) return { count: 0, min: null, max: null, mean: null, median: null, stdDev: null };
  const sorted = [...values].sort((a, b) => a - b);
  const mean = sorted.reduce((s, v) => s + v, 0) / sorted.length;
  const variance = sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / sorted.length;
  return {
    count: sorted.length,
    min: sorted[0],
    max: sorted.at(-1)!,
    mean: Number(mean.toFixed(2)),
    median: sorted[Math.floor(sorted.length / 2)],
    stdDev: Number(Math.sqrt(variance).toFixed(2))
  };
}

async function main() {
  const asOfDate = new Date();
  const formulaVersion = await prisma.formulaVersion.findUnique({
    where: { versionNumber: FORMULA_V1_VERSION_NUMBER },
    select: { id: true }
  });

  const [
    playerCount,
    playersWithDob,
    playersWithPosition,
    playersWithMinutes,
    gpsCount,
    playerRatingCount,
    programTeamRatingCount,
    leaguesWithTier
  ] = await Promise.all([
    prisma.player.count({ where: { deletedAt: null } }),
    prisma.player.count({ where: { deletedAt: null, birthDate: { not: null } } }),
    prisma.player.count({ where: { deletedAt: null, position: { not: null } } }),
    prisma.gameStat.count({ where: { deletedAt: null, minutes: { not: null } } }),
    prisma.gamePerformanceScore.count({
      where: { deletedAt: null, formulaVersion: { versionNumber: FORMULA_V1_VERSION_NUMBER } }
    }),
    prisma.playerRating.count(),
    prisma.programTeamRating.count(),
    prisma.league.count({ where: { deletedAt: null } })
  ]);

  const gpsContext = await prisma.gamePerformanceScore.findMany({
    where: {
      deletedAt: null,
      formulaVersionId: formulaVersion?.id,
      finalPerformanceScore: { not: null }
    },
    select: {
      finalPerformanceScore: true,
      leagueWeight: true,
      opponentFactor: true,
      teamFactor: true,
      effectiveFieldGoalPct: true,
      trueShootingPct: true,
      playerEfficiencyRating: true,
      winShares: true,
      pie: true,
      player: {
        select: {
          id: true,
          displayName: true,
          gender: true,
          birthDate: true,
          classYearOverride: true
        }
      },
      game: {
        select: {
          season: { select: { league: { select: { ageGroup: true, tier: true, name: true } } } }
        }
      }
    }
  });

  const playerRatings = await prisma.playerRating.findMany({
    include: {
      player: {
        select: {
          displayName: true,
          gender: true,
          birthDate: true,
          classYearOverride: true,
          deletedAt: true
        }
      }
    }
  });

  const finalScores = gpsContext.map((row) => Number(row.finalPerformanceScore));
  const neutralOpponent = gpsContext.filter((row) => Number(row.opponentFactor) === 1).length;
  const neutralTeam = gpsContext.filter((row) => Number(row.teamFactor) === 1).length;
  const neutralLeague = gpsContext.filter((row) => Number(row.leagueWeight) === 1).length;

  const crossBracketCases: Array<{
    playerId: string;
    displayName: string;
    competitionAgeGroup: AgeGroup;
    homeBracket: string | null;
    evidenceRole: string;
    gpsCount: number;
    avgBaseScore: number;
    hasCompetitionRating: boolean;
    hasHomeRating: boolean;
    publicLimbo: boolean;
  }> = [];

  const byPlayerComp = new Map<string, { scores: number[]; playerId: string; displayName: string; competition: AgeGroup; gender: PlayerGender; birthDate: Date | null; classYearOverride: number | null }>();
  for (const row of gpsContext) {
    const key = `${row.player.id}|${row.game.season.league.ageGroup}`;
    const bucket = byPlayerComp.get(key) ?? {
      scores: [],
      playerId: row.player.id,
      displayName: row.player.displayName,
      competition: row.game.season.league.ageGroup,
      gender: row.player.gender,
      birthDate: row.player.birthDate,
      classYearOverride: row.player.classYearOverride
    };
    bucket.scores.push(Number(row.finalPerformanceScore));
    byPlayerComp.set(key, bucket);
  }

  const ratingSet = new Set(playerRatings.map((r) => `${r.playerId}|${r.ageGroup}`));

  for (const bucket of byPlayerComp.values()) {
    const homeBracket = getCurrentRankingAgeBracket(
      bucket.birthDate,
      asOfDate,
      bucket.classYearOverride,
      bucket.competition
    );
    const role = deriveEvidenceRole(homeBracket, bucket.competition);
    if (role === "HOME") continue;

    const hasCompetitionRating = ratingSet.has(`${bucket.playerId}|${bucket.competition}`);
    const homeKey = homeBracket && homeBracket !== "OUT_OF_RANGE" ? `${bucket.playerId}|${homeBracket}` : null;
    const hasHomeRating = homeKey ? ratingSet.has(homeKey) : false;
    const publicLimbo = role === "PLAYING_UP" && !hasHomeRating && hasCompetitionRating;

    crossBracketCases.push({
      playerId: bucket.playerId,
      displayName: bucket.displayName,
      competitionAgeGroup: bucket.competition,
      homeBracket,
      evidenceRole: role,
      gpsCount: bucket.scores.length,
      avgBaseScore: Number((bucket.scores.reduce((s, v) => s + v, 0) / bucket.scores.length).toFixed(2)),
      hasCompetitionRating,
      hasHomeRating,
      publicLimbo
    });
  }

  const volatilityByGames = new Map<number, number[]>();
  for (const rating of playerRatings) {
    if (rating.player.deletedAt) continue;
    const key = rating.verifiedGameCount;
    const bucket = volatilityByGames.get(key) ?? [];
    bucket.push(Number(rating.adjustedRating));
    volatilityByGames.set(key, bucket);
  }

  const lowGameHighRating = playerRatings
    .filter((r) => r.verifiedGameCount <= 3 && Number(r.adjustedRating) >= 85)
    .map((r) => ({
      playerId: r.playerId,
      displayName: r.player.displayName,
      ageGroup: r.ageGroup,
      games: r.verifiedGameCount,
      rating: Number(r.adjustedRating)
    }));

  const wrongBoard = playerRatings
    .filter((r) => {
      if (r.player.deletedAt || !r.player.birthDate) return false;
      const home = getRankingAgeBracket(r.player.birthDate, asOfDate);
      return home !== null && home !== "OUT_OF_RANGE" && home !== r.ageGroup;
    })
    .map((r) => ({
      playerId: r.playerId,
      displayName: r.player.displayName,
      storedBoard: r.ageGroup,
      homeBracket: getRankingAgeBracket(r.player.birthDate, asOfDate),
      rating: Number(r.adjustedRating),
      games: r.verifiedGameCount
    }));

  const fieldCoverage = {
    players: { total: playerCount, withBirthDate: playersWithDob, birthDatePct: Number(((playersWithDob / playerCount) * 100).toFixed(1)) },
    withPosition: { count: playersWithPosition, pct: Number(((playersWithPosition / playerCount) * 100).toFixed(1)) },
    gameStatsWithMinutes: playersWithMinutes,
    gpsWithEfg: gpsContext.filter((r) => r.effectiveFieldGoalPct !== null).length,
    gpsWithPer: gpsContext.filter((r) => r.playerEfficiencyRating !== null).length,
    gpsWithWinShares: gpsContext.filter((r) => r.winShares !== null).length,
    programTeamRatings: programTeamRatingCount,
    leaguesWithTier
  };

  const report = {
    generatedAt: asOfDate.toISOString(),
    mode: "read-only",
    productionFormula: "v1",
    counts: {
      players: playerCount,
      gps: gpsCount,
      playerRatings: playerRatingCount,
      programTeamRatings: programTeamRatingCount
    },
    fieldCoverage,
    v1ContextFactors: {
      opponentNeutralPct: Number(((neutralOpponent / gpsContext.length) * 100).toFixed(1)),
      teamNeutralPct: Number(((neutralTeam / gpsContext.length) * 100).toFixed(1)),
      leagueNeutralPct: Number(((neutralLeague / gpsContext.length) * 100).toFixed(1))
    },
    finalScoreDistribution: distribution(finalScores),
    crossBracket: {
      totalCases: crossBracketCases.length,
      playingUp: crossBracketCases.filter((c) => c.evidenceRole === "PLAYING_UP").length,
      playingDown: crossBracketCases.filter((c) => c.evidenceRole === "PLAYING_DOWN").length,
      publicLimbo: crossBracketCases.filter((c) => c.publicLimbo).length,
      samples: crossBracketCases.sort((a, b) => b.gpsCount - a.gpsCount).slice(0, 25)
    },
    calendarBoardMismatch: {
      count: wrongBoard.length,
      samples: wrongBoard.slice(0, 25)
    },
    volatility: {
      lowGameHighRating,
      ratingByGameCount: [...volatilityByGames.entries()]
        .sort(([a], [b]) => a - b)
        .map(([games, ratings]) => ({ games, ...distribution(ratings) }))
    },
    calibrationReadiness: {
      sufficientForOpponentFactor: programTeamRatingCount > 0,
      sufficientForAgeContext: playersWithDob / playerCount >= 0.5,
      sufficientForAdvancedMetrics: gpsContext.filter((r) => r.effectiveFieldGoalPct !== null).length / gpsContext.length >= 0.5,
      sufficientForMinutesNormalization: playersWithMinutes > 0,
      recommendation:
        programTeamRatingCount > 0 && playersWithDob / playerCount >= 0.5
          ? "Ready for shadow calibration with bounded context factors"
          : "Expand program team ratings and DOB coverage before calibration"
    }
  };

  mkdirSync(reportsDir, { recursive: true });
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  writeFileSync(
    mdPath,
    `# Rating Reformulation Baseline Audit

Generated: ${report.generatedAt}

## Summary

- **GPS rows (v1):** ${report.counts.gps}
- **PlayerRating rows:** ${report.counts.playerRatings}
- **ProgramTeamRating rows:** ${report.counts.programTeamRatings}
- **Cross-bracket evidence cases:** ${report.crossBracket.totalCases} (playing up: ${report.crossBracket.playingUp}, limbo: ${report.crossBracket.publicLimbo})
- **Calendar board mismatches:** ${report.calendarBoardMismatch.count}

## v1 Context Factors (Production)

| Factor | Neutral (1.0) % |
|--------|------------------|
| Opponent | ${report.v1ContextFactors.opponentNeutralPct}% |
| Team | ${report.v1ContextFactors.teamNeutralPct}% |
| League | ${report.v1ContextFactors.leagueNeutralPct}% |

Production v1 stores context factor columns but applies neutral weights.

## Field Coverage for Calibration

| Field | Coverage |
|-------|----------|
| BirthDate | ${fieldCoverage.players.withBirthDate}/${fieldCoverage.players.total} (${fieldCoverage.players.birthDatePct}%) |
| Position | ${fieldCoverage.withPosition.count} (${fieldCoverage.withPosition.pct}%) |
| Minutes on GameStat | ${fieldCoverage.gameStatsWithMinutes} rows |
| eFG% on GPS | ${fieldCoverage.gpsWithEfg}/${report.counts.gps} |
| ProgramTeamRating | ${fieldCoverage.programTeamRatings} |

## Calibration Readiness

${report.calibrationReadiness.recommendation}

## Cross-Bracket Samples (Top)

| Player | Competition | Home | Role | Games | Avg | Limbo |
|--------|-------------|------|------|-------|-----|-------|
${report.crossBracket.samples
  .map(
    (s) =>
      `| ${s.displayName} | ${s.competitionAgeGroup} | ${s.homeBracket ?? "—"} | ${s.evidenceRole} | ${s.gpsCount} | ${s.avgBaseScore} | ${s.publicLimbo ? "YES" : "no"} |`
  )
  .join("\n")}

## Low-Game High-Rating Volatility

${report.volatility.lowGameHighRating.length ? report.volatility.lowGameHighRating.map((r) => `- ${r.displayName} (${r.ageGroup}): ${r.rating} over ${r.games} games`).join("\n") : "None flagged."}

Read-only audit. No database writes.
`
  );

  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${mdPath}`);
  console.log(`Cross-bracket limbo cases: ${report.crossBracket.publicLimbo}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
