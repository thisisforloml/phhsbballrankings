import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import type { Prisma } from "@prisma/client";

import { prisma } from "../src/lib/prisma";

const reportPath = path.join(process.cwd(), "scripts", "reports", "split-multi-context-teams-plan.json");
const execute = process.argv.includes("--execute");
const expectedArg = process.argv.find((value) => value.startsWith("--expected-ready="));
const expectedReadyTeams = expectedArg ? Number(expectedArg.split("=")[1]) : null;

type TargetPlan = {
  contextKey: string;
  proposedName: string;
  seasonIds: string[];
  gameIds: string[];
  gameStats: number;
  rosterRowIds: string[];
  teamRatingIds: string[];
  retainsSourceTeam: boolean;
  existingTargetTeamId: string | null;
};

type SplitPlan = {
  status: "EXECUTE_READY" | "NEEDS_REVIEW";
  fingerprint: string;
  program: { id: string; name: string };
  sourceTeam: {
    id: string;
    name: string;
    city: string;
    region: string;
    logoUrl: string | null;
    officialGames: number;
    officialGameStats: number;
    activeRosterRows: number;
    teamRatings: number;
  };
  proposedTeams: TargetPlan[];
};

type SplitReport = {
  readOnly: boolean;
  summary: { mixedContextTeams: number; executeReady: number; needsReview: number; newTeamsRequired: number };
  plans: SplitPlan[];
};

function loadReport() {
  return JSON.parse(readFileSync(reportPath, "utf8")) as SplitReport;
}

async function protectedCounts() {
  const [games, gameStats, performanceScores, playerRatings, rankingSnapshots, rankingSnapshotRows, players, programs, leagues, seasons, teams, teamRatings] = await Promise.all([
    prisma.game.count(),
    prisma.gameStat.count(),
    prisma.gamePerformanceScore.count(),
    prisma.playerRating.count(),
    prisma.rankingSnapshot.count(),
    prisma.rankingSnapshotRow.count(),
    prisma.player.count(),
    prisma.program.count(),
    prisma.league.count(),
    prisma.season.count(),
    prisma.team.count(),
    prisma.teamRating.count(),
  ]);
  return { games, gameStats, performanceScores, playerRatings, rankingSnapshots, rankingSnapshotRows, players, programs, leagues, seasons, teams, teamRatings };
}

function expectedTargetIds(plans: SplitPlan[]) {
  const ids = new Map<string, string>();
  for (const plan of plans) {
    for (const target of plan.proposedTeams) {
      if (!target.retainsSourceTeam) ids.set(`${plan.sourceTeam.id}:${target.contextKey}`, randomUUID());
    }
  }
  return ids;
}

async function validateLiveScope(plans: SplitPlan[]) {
  const errors: string[] = [];
  for (const plan of plans) {
    if (plan.status !== "EXECUTE_READY") {
      errors.push(`${plan.program.name}/${plan.sourceTeam.name} is ${plan.status}.`);
      continue;
    }
    if (plan.proposedTeams.filter((target) => target.retainsSourceTeam).length !== 1) {
      errors.push(`${plan.sourceTeam.name} must retain exactly one source context.`);
    }
    if (plan.proposedTeams.some((target) => target.existingTargetTeamId)) {
      errors.push(`${plan.sourceTeam.name} has an existing target Team and cannot use this focused path.`);
    }

    const source = await prisma.team.findFirst({
      where: { id: plan.sourceTeam.id, name: plan.sourceTeam.name, programId: plan.program.id, deletedAt: null },
      select: { id: true },
    });
    if (!source) errors.push(`Source Team changed or is missing: ${plan.sourceTeam.name} (${plan.sourceTeam.id}).`);

    const proposedNames = plan.proposedTeams.map((target) => target.proposedName);
    const conflictingTargets = await prisma.team.findMany({
      where: { id: { not: plan.sourceTeam.id }, programId: plan.program.id, name: { in: proposedNames }, deletedAt: null },
      select: { id: true, name: true },
    });
    if (conflictingTargets.length) errors.push(`Target Team already exists for ${plan.sourceTeam.name}: ${conflictingTargets.map((team) => `${team.name} (${team.id})`).join(", ")}.`);

    for (const target of plan.proposedTeams) {
      const games = await prisma.game.findMany({
        where: { id: { in: target.gameIds }, deletedAt: null },
        select: { id: true, seasonId: true, homeTeamId: true, awayTeamId: true },
      });
      if (games.length !== target.gameIds.length) errors.push(`${plan.sourceTeam.name}/${target.contextKey}: expected ${target.gameIds.length} games, found ${games.length}.`);
      for (const game of games) {
        if (!target.seasonIds.includes(game.seasonId)) errors.push(`${game.id} no longer belongs to the expected season context.`);
        if (game.homeTeamId !== plan.sourceTeam.id && game.awayTeamId !== plan.sourceTeam.id) errors.push(`${game.id} no longer references source Team ${plan.sourceTeam.id}.`);
      }

      const statCount = await prisma.gameStat.count({
        where: { gameId: { in: target.gameIds }, teamId: plan.sourceTeam.id, deletedAt: null },
      });
      if (statCount !== target.gameStats) errors.push(`${plan.sourceTeam.name}/${target.contextKey}: expected ${target.gameStats} GameStats, found ${statCount}.`);

      const rosters = await prisma.playerTeamSeason.findMany({
        where: { id: { in: target.rosterRowIds }, deletedAt: null },
        select: { id: true, teamId: true, seasonId: true },
      });
      if (rosters.length !== target.rosterRowIds.length) errors.push(`${plan.sourceTeam.name}/${target.contextKey}: roster scope changed.`);
      for (const roster of rosters) {
        if (roster.teamId !== plan.sourceTeam.id || !target.seasonIds.includes(roster.seasonId)) errors.push(`Roster row ${roster.id} changed Team or season.`);
      }

      const ratings = await prisma.teamRating.findMany({
        where: { id: { in: target.teamRatingIds } },
        select: { id: true, teamId: true, seasonId: true },
      });
      if (ratings.length !== target.teamRatingIds.length) errors.push(`${plan.sourceTeam.name}/${target.contextKey}: TeamRating scope changed.`);
      for (const rating of ratings) {
        if (rating.teamId !== plan.sourceTeam.id || !target.seasonIds.includes(rating.seasonId)) errors.push(`TeamRating ${rating.id} changed Team or season.`);
      }
    }
  }
  if (errors.length) throw new Error(`Mixed-context Team split validation failed:\n- ${errors.join("\n- ")}`);
}

function assertProtectedCounts(before: Awaited<ReturnType<typeof protectedCounts>>, after: Awaited<ReturnType<typeof protectedCounts>>, expectedNewTeams: number) {
  const unchangedKeys = ["games", "gameStats", "performanceScores", "playerRatings", "rankingSnapshots", "rankingSnapshotRows", "players", "programs", "leagues", "seasons", "teamRatings"] as const;
  const changes = unchangedKeys.filter((key) => before[key] !== after[key]).map((key) => `${key}: ${before[key]} -> ${after[key]}`);
  if (after.teams !== before.teams + expectedNewTeams) changes.push(`teams: expected ${before.teams + expectedNewTeams}, found ${after.teams}`);
  if (changes.length) throw new Error(`Protected count validation failed: ${changes.join(", ")}`);
}

async function validatePostExecute(plans: SplitPlan[], targetIds: Map<string, string>) {
  const errors: string[] = [];
  for (const plan of plans) {
    for (const target of plan.proposedTeams) {
      const targetId = target.retainsSourceTeam ? plan.sourceTeam.id : targetIds.get(`${plan.sourceTeam.id}:${target.contextKey}`)!;
      const team = await prisma.team.findFirst({ where: { id: targetId, programId: plan.program.id, name: target.proposedName, deletedAt: null }, select: { id: true } });
      if (!team) errors.push(`Canonical Team was not created/renamed correctly: ${target.proposedName}.`);
      const games = await prisma.game.count({ where: { id: { in: target.gameIds }, OR: [{ homeTeamId: targetId }, { awayTeamId: targetId }] } });
      if (games !== target.gameIds.length) errors.push(`${target.proposedName}: expected ${target.gameIds.length} game references, found ${games}.`);
      const stats = await prisma.gameStat.count({ where: { gameId: { in: target.gameIds }, teamId: targetId, deletedAt: null } });
      if (stats !== target.gameStats) errors.push(`${target.proposedName}: expected ${target.gameStats} GameStats, found ${stats}.`);
      const rosters = await prisma.playerTeamSeason.count({ where: { id: { in: target.rosterRowIds }, teamId: targetId, deletedAt: null } });
      if (rosters !== target.rosterRowIds.length) errors.push(`${target.proposedName}: expected ${target.rosterRowIds.length} roster rows, found ${rosters}.`);
      const ratings = await prisma.teamRating.count({ where: { id: { in: target.teamRatingIds }, teamId: targetId } });
      if (ratings !== target.teamRatingIds.length) errors.push(`${target.proposedName}: expected ${target.teamRatingIds.length} TeamRatings, found ${ratings}.`);
    }
  }
  if (errors.length) throw new Error(`Post-execute Team split validation failed:\n- ${errors.join("\n- ")}`);
}

async function main() {
  const report = loadReport();
  const plans = report.plans;
  if (!report.readOnly) throw new Error("Expected a read-only reviewed report.");
  if (report.summary.executeReady !== plans.length || report.summary.mixedContextTeams !== plans.length || report.summary.needsReview !== 0) {
    throw new Error(`Report scope is not fully execute-ready: mixed=${report.summary.mixedContextTeams}, ready=${report.summary.executeReady}, review=${report.summary.needsReview}, rows=${plans.length}.`);
  }
  if (execute && (expectedReadyTeams === null || !Number.isInteger(expectedReadyTeams) || expectedReadyTeams <= 0)) {
    throw new Error("Execute requires --expected-ready=<positive reviewed count>.");
  }
  if (expectedReadyTeams !== null && plans.length !== expectedReadyTeams) {
    throw new Error(`Expected exactly ${expectedReadyTeams} EXECUTE_READY Teams; report contains ${plans.length}.`);
  }

  await validateLiveScope(plans);
  const before = await protectedCounts();
  const targetIds = expectedTargetIds(plans);
  const operations: Prisma.PrismaPromise<unknown>[] = [];

  if (execute) {
    for (const plan of plans) {
      const retained = plan.proposedTeams.find((target) => target.retainsSourceTeam)!;
      operations.push(prisma.team.update({ where: { id: plan.sourceTeam.id }, data: { name: retained.proposedName } }));
      for (const target of plan.proposedTeams.filter((row) => !row.retainsSourceTeam)) {
        const targetId = targetIds.get(`${plan.sourceTeam.id}:${target.contextKey}`)!;
        operations.push(prisma.team.create({ data: { id: targetId, name: target.proposedName, city: plan.sourceTeam.city, region: plan.sourceTeam.region, logoUrl: plan.sourceTeam.logoUrl, programId: plan.program.id } }));
        operations.push(prisma.game.updateMany({ where: { id: { in: target.gameIds }, homeTeamId: plan.sourceTeam.id }, data: { homeTeamId: targetId } }));
        operations.push(prisma.game.updateMany({ where: { id: { in: target.gameIds }, awayTeamId: plan.sourceTeam.id }, data: { awayTeamId: targetId } }));
        operations.push(prisma.gameStat.updateMany({ where: { gameId: { in: target.gameIds }, teamId: plan.sourceTeam.id }, data: { teamId: targetId } }));
        if (target.rosterRowIds.length) operations.push(prisma.playerTeamSeason.updateMany({ where: { id: { in: target.rosterRowIds }, teamId: plan.sourceTeam.id }, data: { teamId: targetId } }));
        if (target.teamRatingIds.length) operations.push(prisma.teamRating.updateMany({ where: { id: { in: target.teamRatingIds }, teamId: plan.sourceTeam.id }, data: { teamId: targetId } }));
      }
    }
    await prisma.$transaction(operations);
  }

  const after = await protectedCounts();
  if (execute) {
    assertProtectedCounts(before, after, report.summary.newTeamsRequired);
    await validatePostExecute(plans, targetIds);
  } else if (JSON.stringify(before) !== JSON.stringify(after)) {
    throw new Error("Dry-run changed protected counts unexpectedly.");
  }

  console.log(JSON.stringify({
    mode: execute ? "execute" : "dry-run",
    reportPath,
    teamsValidated: plans.length,
    newTeamsRequired: report.summary.newTeamsRequired,
    plannedOperations: operations.length,
    plans: plans.map((plan) => ({
      program: plan.program.name,
      sourceTeam: plan.sourceTeam.name,
      fingerprint: plan.fingerprint,
      targets: plan.proposedTeams.map((target) => ({ name: target.proposedName, retainsSourceTeam: target.retainsSourceTeam, games: target.gameIds.length, gameStats: target.gameStats, rosterRows: target.rosterRowIds.length, teamRatings: target.teamRatingIds.length })),
    })),
    protectedCountsBefore: before,
    protectedCountsAfter: after,
    writesPerformed: execute,
  }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
