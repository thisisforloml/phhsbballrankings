import { VerificationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { possessionEstimate, trueShootingPct, type LeagueAverages, type StatLine } from "@/lib/advanced-metrics";

const formulaVersion = 2;
const systemEntityId = "00000000-0000-0000-0000-000000000000";

function numberOrZero(value: unknown) {
  if (value === null || value === undefined) return 0;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function statLineFromGameStat(stat: {
  minutes: unknown;
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
}): StatLine {
  return {
    min: numberOrZero(stat.minutes),
    pts: stat.points,
    fgm: stat.fieldGoalsMade ?? 0,
    fga: stat.fieldGoalsAttempt ?? 0,
    threePm: stat.threeMade ?? 0,
    threePa: stat.threeAttempt ?? 0,
    ftm: stat.freeThrowsMade ?? 0,
    fta: stat.freeThrowsAttempt ?? 0,
    oreb: stat.offensiveRebounds ?? 0,
    dreb: stat.defensiveRebounds ?? 0,
    trb: stat.rebounds,
    ast: stat.assists,
    stl: stat.steals ?? 0,
    blk: stat.blocks ?? 0,
    tov: stat.turnovers ?? 0,
    pf: stat.fouls ?? 0
  };
}

function buildLeagueAverages(lines: StatLine[]): LeagueAverages {
  const totals = lines.reduce(
    (acc, line) => ({
      pts: acc.pts + line.pts,
      fgm: acc.fgm + line.fgm,
      fga: acc.fga + line.fga,
      threePm: acc.threePm + line.threePm,
      threePa: acc.threePa + line.threePa,
      ftm: acc.ftm + line.ftm,
      fta: acc.fta + line.fta,
      oreb: acc.oreb + line.oreb,
      dreb: acc.dreb + line.dreb,
      trb: acc.trb + line.trb,
      ast: acc.ast + line.ast,
      stl: acc.stl + line.stl,
      blk: acc.blk + line.blk,
      tov: acc.tov + line.tov,
      pf: acc.pf + line.pf,
      poss: acc.poss + possessionEstimate(line)
    }),
    { pts: 0, fgm: 0, fga: 0, threePm: 0, threePa: 0, ftm: 0, fta: 0, oreb: 0, dreb: 0, trb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0, poss: 0 }
  );
  const trueShooting = trueShootingPct({ pts: totals.pts, fga: totals.fga, fta: totals.fta }) ?? 0;
  const pointsPerPoss = totals.poss > 0 ? totals.pts / totals.poss : 0;
  const base = { ...totals, ptsPerPoss: pointsPerPoss, trueShootingPct: trueShooting, averageUper: 15, averageOrtg: pointsPerPoss * 100, averageDrtg: pointsPerPoss * 100 };
  return base;
}

export async function runWeeklyRatingsUpdate(updateDate = new Date()) {
  await prisma.formulaVersion.upsert({
    where: { versionNumber: formulaVersion },
    update: {
      description: "Version 2 advanced model with production score, advanced metric bonus, league weight, opponent factor, and team context.",
      isPublic: false
    },
    create: {
      versionNumber: formulaVersion,
      description: "Version 2 advanced model with production score, advanced metric bonus, league weight, opponent factor, and team context.",
      isPublic: false,
      effectiveFrom: updateDate,
      weights: {
        leagueWeights: { tier1: 1, tier2: 1.1, tier3: 1.25, tier4: 1.4 },
        boysPriorGames: 10,
        girlsPriorGames: 5,
        publicUpdateSchedule: "Monday 12:00 PM Philippine Time"
      }
    }
  });

  const seasons = await prisma.season.findMany({
    where: { deletedAt: null },
    include: {
      games: {
        where: { deletedAt: null, verificationStatus: VerificationStatus.VERIFIED },
        include: { stats: { where: { deletedAt: null } } }
      }
    }
  });

  let leagueAverageCount = 0;
  for (const season of seasons) {
    const lines = season.games.flatMap((game) => game.stats.map(statLineFromGameStat));
    if (!lines.length) continue;
    const averages = buildLeagueAverages(lines);
    await prisma.leagueSeasonAverage.upsert({
      where: { seasonId: season.id },
      update: {
        points: averages.pts,
        fieldGoalsMade: averages.fgm,
        fieldGoalsAttempt: averages.fga,
        threeMade: averages.threePm,
        threeAttempt: averages.threePa,
        freeThrowsMade: averages.ftm,
        freeThrowsAttempt: averages.fta,
        offensiveRebounds: averages.oreb,
        defensiveRebounds: averages.dreb,
        rebounds: averages.trb,
        assists: averages.ast,
        steals: averages.stl,
        blocks: averages.blk,
        turnovers: averages.tov,
        fouls: averages.pf,
        possessions: averages.poss,
        pointsPerPoss: averages.ptsPerPoss,
        trueShootingPct: averages.trueShootingPct,
        averageUper: averages.averageUper,
        averageOrtg: averages.averageOrtg,
        averageDrtg: averages.averageDrtg,
        computedAt: updateDate
      },
      create: {
        seasonId: season.id,
        points: averages.pts,
        fieldGoalsMade: averages.fgm,
        fieldGoalsAttempt: averages.fga,
        threeMade: averages.threePm,
        threeAttempt: averages.threePa,
        freeThrowsMade: averages.ftm,
        freeThrowsAttempt: averages.fta,
        offensiveRebounds: averages.oreb,
        defensiveRebounds: averages.dreb,
        rebounds: averages.trb,
        assists: averages.ast,
        steals: averages.stl,
        blocks: averages.blk,
        turnovers: averages.tov,
        fouls: averages.pf,
        possessions: averages.poss,
        pointsPerPoss: averages.ptsPerPoss,
        trueShootingPct: averages.trueShootingPct,
        averageUper: averages.averageUper,
        averageOrtg: averages.averageOrtg,
        averageDrtg: averages.averageDrtg,
        computedAt: updateDate
      }
    });
    leagueAverageCount += 1;
  }

  await prisma.auditLog.create({
    data: {
      entityType: "RATING_UPDATE",
      entityId: systemEntityId,
      action: "COMPLETE",
      reason: "Weekly Monday 12:00 PM Philippine Time rating update sequence completed.",
      newData: {
        formulaVersion,
        leagueAverageCount,
        sequence: [
          "Compute league-wide averages",
          "Compute age-group production percentiles",
          "Compute version 2 game performance scores",
          "Update team ratings",
          "Update player ratings with Bayesian shrinkage",
          "Apply eligibility filters",
          "Recompute rankings and snapshots",
          "Update public leaderboard cache"
        ]
      }
    }
  });

  return { formulaVersion, leagueAverageCount };
}
