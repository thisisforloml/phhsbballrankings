import { readFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../src/lib/prisma";

const reportPath = join(process.cwd(), "scripts", "reports", "roster-only-canonicalization-plan.json");
const EXPECTED_READY_COUNT = 73;
const execute = process.argv.includes("--execute");

type ReportRow = {
  playerTeamSeasonId: string;
  playerId: string;
  playerName: string;
  currentSourceTeamId: string;
  currentSourceTeamName: string;
  currentSeasonId: string;
  currentSeasonName: string;
  status: string;
  recommendedTargetTeam: null | {
    teamId: string;
    teamName: string;
  };
};

type ReportGroup = {
  programId: string;
  programName: string;
  sourceTeamId: string;
  sourceTeamName: string;
  rows: ReportRow[];
};

type Report = {
  summary: {
    READY_FOR_APPROVAL: number;
  };
  groups: ReportGroup[];
};

function loadReport() {
  return JSON.parse(readFileSync(reportPath, "utf8")) as Report;
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

async function protectedCounts() {
  const [
    games,
    gameStats,
    gamePerformanceScores,
    playerRatings,
    rankingSnapshots,
    rankingSnapshotRows,
    players,
    programs,
    teams
  ] = await Promise.all([
    prisma.game.count(),
    prisma.gameStat.count(),
    prisma.gamePerformanceScore.count(),
    prisma.playerRating.count(),
    prisma.rankingSnapshot.count(),
    prisma.rankingSnapshotRow.count(),
    prisma.player.count(),
    prisma.program.count(),
    prisma.team.count()
  ]);
  return {
    games,
    gameStats,
    gamePerformanceScores,
    playerRatings,
    rankingSnapshots,
    rankingSnapshotRows,
    players,
    programs,
    teams
  };
}

function assertEqualCounts(before: Awaited<ReturnType<typeof protectedCounts>>, after: Awaited<ReturnType<typeof protectedCounts>>) {
  const changed = Object.entries(before).filter(([key, value]) => after[key as keyof typeof after] !== value);
  if (changed.length) {
    throw new Error(`Protected counts changed unexpectedly: ${changed.map(([key, value]) => `${key} ${value} -> ${after[key as keyof typeof after]}`).join(", ")}`);
  }
}

async function validateRows(groups: ReportGroup[], readyRows: Array<ReportRow & { programId: string; programName: string }>, blockedRows: Array<ReportRow & { programId: string; programName: string }>) {
  const errors: string[] = [];
  const readyIds = new Set(readyRows.map((row) => row.playerTeamSeasonId));
  const duplicateReadyIds = readyRows.map((row) => row.playerTeamSeasonId).filter((id, index, ids) => ids.indexOf(id) !== index);
  if (duplicateReadyIds.length) errors.push(`Duplicate ready PlayerTeamSeason IDs: ${unique(duplicateReadyIds).join(", ")}`);
  for (const blocked of blockedRows) {
    if (readyIds.has(blocked.playerTeamSeasonId)) {
      errors.push(`Blocked row is also marked ready: ${blocked.playerTeamSeasonId}`);
    }
  }

  const sourceTeamIds = unique(groups.map((group) => group.sourceTeamId));
  const targetTeamIds = unique(readyRows.map((row) => row.recommendedTargetTeam?.teamId).filter((id): id is string => Boolean(id)));
  const teamIds = unique([...sourceTeamIds, ...targetTeamIds]);
  const teams = await prisma.team.findMany({
    where: { id: { in: teamIds }, deletedAt: null },
    select: { id: true, name: true, programId: true }
  });
  const teamById = new Map(teams.map((team) => [team.id, team]));

  const playerTeamSeasons = await prisma.playerTeamSeason.findMany({
    where: { id: { in: unique([...readyRows, ...blockedRows].map((row) => row.playerTeamSeasonId)) }, deletedAt: null },
    select: { id: true, playerId: true, teamId: true, seasonId: true }
  });
  const rosterById = new Map(playerTeamSeasons.map((row) => [row.id, row]));

  for (const row of readyRows) {
    if (row.status !== "READY_FOR_APPROVAL") errors.push(`Ready batch contains non-ready row ${row.playerTeamSeasonId}: ${row.status}`);
    if (!row.recommendedTargetTeam) {
      errors.push(`Ready row missing target Team: ${row.playerTeamSeasonId}`);
      continue;
    }
    if (row.currentSourceTeamId === row.recommendedTargetTeam.teamId) errors.push(`Ready row source and target are identical: ${row.playerTeamSeasonId}`);
    const roster = rosterById.get(row.playerTeamSeasonId);
    if (!roster) {
      errors.push(`PlayerTeamSeason row missing/deleted: ${row.playerTeamSeasonId}`);
      continue;
    }
    if (roster.teamId !== row.currentSourceTeamId) {
      errors.push(`PlayerTeamSeason ${row.playerTeamSeasonId} current team changed: expected ${row.currentSourceTeamId}, found ${roster.teamId}`);
    }
    if (roster.playerId !== row.playerId) errors.push(`PlayerTeamSeason ${row.playerTeamSeasonId} player changed: expected ${row.playerId}, found ${roster.playerId}`);
    if (roster.seasonId !== row.currentSeasonId) errors.push(`PlayerTeamSeason ${row.playerTeamSeasonId} season changed: expected ${row.currentSeasonId}, found ${roster.seasonId}`);
    const sourceTeam = teamById.get(row.currentSourceTeamId);
    const targetTeam = teamById.get(row.recommendedTargetTeam.teamId);
    if (!sourceTeam) errors.push(`Source Team missing/deleted: ${row.currentSourceTeamId}`);
    if (!targetTeam) errors.push(`Target Team missing/deleted: ${row.recommendedTargetTeam.teamId}`);
    if (sourceTeam && sourceTeam.programId !== row.programId) errors.push(`Source Team ${sourceTeam.name} is not under expected Program ${row.programId}`);
    if (targetTeam && targetTeam.programId !== row.programId) errors.push(`Target Team ${targetTeam.name} is not under expected Program ${row.programId}`);
    if (sourceTeam && targetTeam && sourceTeam.programId !== targetTeam.programId) {
      errors.push(`Source/target Program mismatch for ${row.playerTeamSeasonId}: ${sourceTeam.programId} vs ${targetTeam.programId}`);
    }
  }

  for (const row of blockedRows) {
    const roster = rosterById.get(row.playerTeamSeasonId);
    if (!roster) continue;
    if (roster.teamId !== row.currentSourceTeamId) {
      errors.push(`Blocked row has already moved or changed unexpectedly: ${row.playerTeamSeasonId}`);
    }
  }

  if (errors.length) {
    throw new Error(`Validation failed:\n- ${errors.join("\n- ")}`);
  }
}

function buildMoveSummary(rows: Array<ReportRow & { programId: string; programName: string }>) {
  const summary = new Map<string, {
    programName: string;
    sourceTeamName: string;
    targetTeamName: string;
    count: number;
    players: string[];
  }>();
  for (const row of rows) {
    const key = `${row.programId}:${row.currentSourceTeamId}:${row.recommendedTargetTeam?.teamId}`;
    const current = summary.get(key) ?? {
      programName: row.programName,
      sourceTeamName: row.currentSourceTeamName,
      targetTeamName: row.recommendedTargetTeam?.teamName ?? "",
      count: 0,
      players: []
    };
    current.count += 1;
    current.players.push(row.playerName);
    summary.set(key, current);
  }
  return Array.from(summary.values()).sort((left, right) => left.programName.localeCompare(right.programName));
}

async function main() {
  const report = loadReport();
  const readyRows = report.groups.flatMap((group) =>
    group.rows
      .filter((row) => row.status === "READY_FOR_APPROVAL")
      .map((row) => ({ ...row, programId: group.programId, programName: group.programName }))
  );
  const blockedRows = report.groups.flatMap((group) =>
    group.rows
      .filter((row) => row.status !== "READY_FOR_APPROVAL")
      .map((row) => ({ ...row, programId: group.programId, programName: group.programName }))
  );

  if (report.summary.READY_FOR_APPROVAL !== EXPECTED_READY_COUNT || readyRows.length !== EXPECTED_READY_COUNT) {
    throw new Error(`Expected exactly ${EXPECTED_READY_COUNT} READY_FOR_APPROVAL rows, found summary=${report.summary.READY_FOR_APPROVAL}, rows=${readyRows.length}. Regenerate/review the plan before execution.`);
  }

  const beforeProtectedCounts = await protectedCounts();
  await validateRows(report.groups, readyRows, blockedRows);
  const beforeSourceTargetCounts = await sourceTargetCounts(readyRows);

  let updatedRows = 0;
  if (execute) {
    await prisma.$transaction(async (tx) => {
      for (const row of readyRows) {
        const result = await tx.playerTeamSeason.updateMany({
          where: {
            id: row.playerTeamSeasonId,
            playerId: row.playerId,
            seasonId: row.currentSeasonId,
            teamId: row.currentSourceTeamId,
            deletedAt: null
          },
          data: { teamId: row.recommendedTargetTeam!.teamId }
        });
        if (result.count !== 1) {
          throw new Error(`Expected to update exactly one PlayerTeamSeason row ${row.playerTeamSeasonId}, updated ${result.count}`);
        }
        updatedRows += result.count;
      }
    });
  }

  const afterProtectedCounts = await protectedCounts();
  assertEqualCounts(beforeProtectedCounts, afterProtectedCounts);
  const afterSourceTargetCounts = await sourceTargetCounts(readyRows);

  if (execute) {
    await validatePostExecute(readyRows, blockedRows);
  }

  console.log(JSON.stringify({
    mode: execute ? "execute" : "dry-run",
    reportPath,
    expectedReadyRows: EXPECTED_READY_COUNT,
    readyRows: readyRows.length,
    blockedRowsUntouchedByPlan: blockedRows.length,
    updatedRows,
    moveSummary: buildMoveSummary(readyRows),
    beforeSourceTargetCounts,
    afterSourceTargetCounts,
    protectedCountsBefore: beforeProtectedCounts,
    protectedCountsAfter: afterProtectedCounts,
    protectedCountsUnchanged: true,
    writesPerformed: execute
  }, null, 2));
}

async function sourceTargetCounts(rows: Array<ReportRow & { programId: string; programName: string }>) {
  const teamIds = unique(rows.flatMap((row) => [row.currentSourceTeamId, row.recommendedTargetTeam!.teamId]));
  const counts = await Promise.all(teamIds.map(async (teamId) => ({
    teamId,
    playerTeamSeasonCount: await prisma.playerTeamSeason.count({ where: { teamId, deletedAt: null } })
  })));
  return counts;
}

async function validatePostExecute(readyRows: Array<ReportRow & { programId: string; programName: string }>, blockedRows: Array<ReportRow & { programId: string; programName: string }>) {
  const ready = await prisma.playerTeamSeason.findMany({
    where: { id: { in: readyRows.map((row) => row.playerTeamSeasonId) }, deletedAt: null },
    select: { id: true, teamId: true }
  });
  const readyById = new Map(ready.map((row) => [row.id, row.teamId]));
  const errors: string[] = [];
  for (const row of readyRows) {
    if (readyById.get(row.playerTeamSeasonId) !== row.recommendedTargetTeam!.teamId) {
      errors.push(`Ready row not moved to target: ${row.playerTeamSeasonId}`);
    }
  }
  const blocked = await prisma.playerTeamSeason.findMany({
    where: { id: { in: blockedRows.map((row) => row.playerTeamSeasonId) }, deletedAt: null },
    select: { id: true, teamId: true }
  });
  const blockedById = new Map(blocked.map((row) => [row.id, row.teamId]));
  for (const row of blockedRows) {
    if (blockedById.get(row.playerTeamSeasonId) !== row.currentSourceTeamId) {
      errors.push(`Blocked row moved unexpectedly: ${row.playerTeamSeasonId}`);
    }
  }
  if (errors.length) throw new Error(`Post-execute validation failed:\n- ${errors.join("\n- ")}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
