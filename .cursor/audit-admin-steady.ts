/**
 * Steady-state cold vs warm admin benchmarks (includes new list caches).
 * npx tsx .cursor/audit-admin-steady.ts
 */
import { performance } from "node:perf_hooks";
import { prisma } from "../src/lib/prisma";
import { loadManagedPlayerListPage, clearManagedPlayerListPageCache } from "../src/lib/admin/load-managed-player-list";
import { loadAdminPlayerFilterContext, clearAdminPlayerFilterContextCache } from "../src/lib/admin/load-admin-player-filter-context";
import { loadManagedTeams, clearManagedTeamsCache } from "../src/lib/admin/load-managed-teams";
import { loadProgramListRows, clearProgramListCache } from "../src/lib/admin/load-program-list";
import { loadAdminSubmissionQueue, clearAdminSubmissionQueueCache } from "../src/lib/admin/load-admin-submission-queue";
import { loadAdminLeaguesList, clearAdminLeaguesListCache } from "../src/lib/admin/load-admin-leagues-list";
import { loadAdminOpsPageData, clearAdminOpsPageCache } from "../src/lib/admin/load-admin-ops-page-data";
import { loadAdminDataHealthSignals, clearAdminDataHealthSignalsCache } from "../src/lib/admin/load-admin-data-health-signals";

const F = { search: "", program: "All", gender: "All", ageBracket: "All" as const };

async function avg(fn: () => Promise<void>, n = 5) {
  await fn();
  const samples: number[] = [];
  for (let i = 0; i < n; i++) {
    const start = performance.now();
    await fn();
    samples.push(performance.now() - start);
  }
  return Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
}

async function main() {
  const auth = await avg(() => prisma.user.findFirst({ where: { deletedAt: null }, take: 1 }).then(() => undefined));

  await loadManagedPlayerListPage(F, 1);
  await loadManagedTeams();
  await loadProgramListRows();
  await loadAdminSubmissionQueue(100);
  await loadAdminLeaguesList();
  await loadAdminOpsPageData();
  await loadAdminDataHealthSignals();

  const playersCold = await avg(async () => {
    clearManagedPlayerListPageCache();
    clearAdminPlayerFilterContextCache();
    await Promise.all([loadManagedPlayerListPage(F, 1), loadAdminPlayerFilterContext()]);
  });
  const playersWarm = await avg(async () => {
    await Promise.all([loadManagedPlayerListPage(F, 1), loadAdminPlayerFilterContext()]);
  });

  const teamsCold = await avg(async () => {
    clearManagedTeamsCache();
    await loadManagedTeams();
  });
  const teamsWarm = await avg(() => loadManagedTeams().then(() => undefined));

  const programsCold = await avg(async () => {
    clearProgramListCache();
    await loadProgramListRows();
  });
  const programsWarm = await avg(() => loadProgramListRows().then(() => undefined));

  const submissionsCold = await avg(async () => {
    clearAdminSubmissionQueueCache();
    await loadAdminSubmissionQueue(100);
  });
  const submissionsWarm = await avg(() => loadAdminSubmissionQueue(100).then(() => undefined));

  const leaguesCold = await avg(async () => {
    clearAdminLeaguesListCache();
    await loadAdminLeaguesList();
  });
  const leaguesWarm = await avg(() => loadAdminLeaguesList().then(() => undefined));

  const opsCold = await avg(async () => {
    clearAdminOpsPageCache();
    await loadAdminOpsPageData();
  });
  const opsWarm = await avg(() => loadAdminOpsPageData().then(() => undefined));

  const dataHealthCold = await avg(async () => {
    clearAdminDataHealthSignalsCache();
    await loadAdminDataHealthSignals();
  });
  const dataHealthWarm = await avg(() => loadAdminDataHealthSignals().then(() => undefined));

  console.table({
    authDbLookup: auth,
    playersCold,
    playersWarm,
    teamsCold,
    teamsWarm,
    programsCold,
    programsWarm,
    submissionsCold,
    submissionsWarm,
    leaguesCold,
    leaguesWarm,
    opsCold,
    opsWarm,
    dataHealthCold,
    dataHealthWarm,
  });
}

main().finally(() => prisma.$disconnect());
