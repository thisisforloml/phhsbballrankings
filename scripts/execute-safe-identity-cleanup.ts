/**
 * Execute Safe Identity Cleanup (approved scope from IDENTITY_INTEGRITY_SWEEP.md).
 *
 * Usage:
 *   npx tsx scripts/execute-safe-identity-cleanup.ts           # dry-run
 *   npx tsx scripts/execute-safe-identity-cleanup.ts --execute
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { prisma } from "../src/lib/prisma";

const EXECUTE = process.argv.includes("--execute");
const REPORT_DIR = join(process.cwd(), "docs", "planning", "audits");
const REPORT_JSON = join(REPORT_DIR, "safe-identity-cleanup-execution.json");
const REPORT_MD = join(REPORT_DIR, "SAFE_IDENTITY_CLEANUP_EXECUTION.md");

const PROGRAM_SHELL_IDS = [
  "1ec13bb5-3fea-420c-a3b6-3a849922a3b6",
  "b3009ae6-ac6f-43d4-af9a-fb45613fc20b",
  "2a5f2b40-109d-49df-9df6-c34eb3b44672"
] as const;

const ZERO_ACTIVITY_TEAM_IDS = [
  "e9b2dc44-3103-4612-ab7a-5ce67e7ef6a8",
  "acb69a9e-e10c-4486-b3e1-9fe8c056c57c",
  "1f44864b-91c6-4b52-a1d3-1b88eee3b487",
  "4108ff02-d59f-41aa-9219-070d56cfa5bc",
  "b9efc141-ef1a-4214-aebf-3a9db0f2071d",
  "53650e64-ec1e-48cd-b2eb-5f575362e691",
  "c010e83f-8a2d-4084-8497-0bea7119c6db",
  "8b25947c-21d2-4878-a44f-32dc5160b5bd",
  "8f999ac0-0823-4eac-91af-842957c026ff",
  "9ebec3dc-2e89-4a32-9326-54297c71f8bc",
  "d81d5179-b450-4eba-b7a2-07f558a9268c",
  "f2705e3c-8cb6-4c27-84e9-8941e6c8599a",
  "7543e4de-09d2-45e5-869e-341a760b59b8",
  "e560fa7d-c846-465b-98b4-7704cb17416b",
  "e8e50710-0e6a-4482-ae1d-452b3471fdde",
  "8d66d8b4-c047-4257-b3b7-3d87b1a09aa3",
  "7c2934ce-f07a-4f5c-af9e-d3d291b7428c"
] as const;

const EOIN_BRAGA_PLAYER_ID = "af064d5d-eb5f-4ddd-ad46-f619a17592c2";

const PLAYER_MERGE_GROUPS = [
  {
    label: "Liam Jardin / Liam Franko Jardin",
    playerIds: ["2e36b608-bfe7-416c-8e77-095f26d2379d", "c29f6596-8ddd-4c04-ac3b-2be6b8ce63a9"] as const
  },
  {
    label: "Franco Macapagal / Franco Javier Macapagal",
    playerIds: ["61c28d47-e2cf-4f59-bc71-8629f435f95f", "0b541b5e-09c5-454a-9ac8-4bac29260738"] as const
  }
] as const;

type Counts = {
  activePrograms: number;
  activeTeams: number;
  activePlayers: number;
  activeGameStats: number;
  gamePerformanceScores: number;
  playerRatings: number;
  rankingSnapshotRows: number;
};

async function snapshotCounts(): Promise<Counts> {
  const [activePrograms, activeTeams, activePlayers, activeGameStats, gamePerformanceScores, playerRatings, rankingSnapshotRows] =
    await Promise.all([
      prisma.program.count({ where: { deletedAt: null } }),
      prisma.team.count({ where: { deletedAt: null } }),
      prisma.player.count({ where: { deletedAt: null } }),
      prisma.gameStat.count({ where: { deletedAt: null } }),
      prisma.gamePerformanceScore.count({ where: { deletedAt: null } }),
      prisma.playerRating.count(),
      prisma.rankingSnapshotRow.count()
    ]);
  return { activePrograms, activeTeams, activePlayers, activeGameStats, gamePerformanceScores, playerRatings, rankingSnapshotRows };
}

async function teamReferenceCounts(teamId: string) {
  const [gameStat, gameHome, gameAway, rosterSeasons, teamRatings] = await Promise.all([
    prisma.gameStat.count({ where: { deletedAt: null, teamId } }),
    prisma.game.count({ where: { deletedAt: null, homeTeamId: teamId } }),
    prisma.game.count({ where: { deletedAt: null, awayTeamId: teamId } }),
    prisma.playerTeamSeason.count({ where: { deletedAt: null, teamId } }),
    prisma.teamRating.count({ where: { teamId } })
  ]);
  return { gameStat, gameHome, gameAway, rosterSeasons, teamRatings, total: gameStat + gameHome + gameAway + rosterSeasons + teamRatings };
}

async function programShellCounts(programId: string) {
  const [teams, players, transferFrom, transferTo] = await Promise.all([
    prisma.team.count({ where: { deletedAt: null, programId } }),
    prisma.player.count({ where: { deletedAt: null, currentProgramId: programId } }),
    prisma.playerProgramHistory.count({ where: { fromProgramId: programId } }),
    prisma.playerProgramHistory.count({ where: { toProgramId: programId } })
  ]);
  return { teams, players, transferFrom, transferTo, total: teams + players + transferFrom + transferTo };
}

async function resolveEoinBragaTargetProgramId() {
  const player = await prisma.player.findUnique({
    where: { id: EOIN_BRAGA_PLAYER_ID, deletedAt: null },
    select: {
      id: true,
      displayName: true,
      currentProgramId: true,
      currentProgram: { select: { id: true, fullName: true } },
      rosterSeasons: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: {
          createdAt: true,
          team: {
            select: {
              id: true,
              name: true,
              programId: true,
              program: { select: { id: true, fullName: true } }
            }
          }
        }
      }
    }
  });
  if (!player) throw new Error("Eoin Braga player not found.");

  const rosterMismatches = player.rosterSeasons.filter(
    (row) => row.team.programId && row.team.programId !== player.currentProgramId
  );
  const rosterVotes = new Map<string, { id: string; fullName: string; count: number; latestTeam: string }>();
  for (const row of player.rosterSeasons) {
    const program = row.team.program;
    if (!program) continue;
    const entry = rosterVotes.get(program.id) ?? {
      id: program.id,
      fullName: program.fullName,
      count: 0,
      latestTeam: row.team.name
    };
    entry.count += 1;
    rosterVotes.set(program.id, entry);
  }
  const rosterRanked = Array.from(rosterVotes.values()).sort((a, b) => b.count - a.count);

  const mismatchTarget = rosterMismatches[0]?.team.program ?? null;
  const target = mismatchTarget ?? rosterRanked[0] ?? null;

  if (!target) throw new Error("Cannot resolve Eoin Braga program from roster evidence.");

  return {
    player,
    targetProgramId: target.id,
    targetProgramName: target.fullName,
    evidence: {
      rosterProgramVotes: rosterRanked,
      rosterMismatches: rosterMismatches.map((row) => ({
        team: row.team.name,
        program: row.team.program?.fullName ?? null,
        createdAt: row.createdAt.toISOString()
      })),
      currentProgram: player.currentProgram
    }
  };
}

async function pickCanonicalPlayer(playerIds: readonly [string, string]) {
  const players = await prisma.player.findMany({
    where: { id: { in: [...playerIds] }, deletedAt: null },
    select: {
      id: true,
      displayName: true,
      createdAt: true,
      _count: { select: { gameStats: { where: { deletedAt: null } } } }
    }
  });
  if (players.length !== 2) throw new Error(`Expected 2 active players, found ${players.length}: ${playerIds.join(", ")}`);

  const sorted = [...players].sort(
    (a, b) =>
      b._count.gameStats - a._count.gameStats ||
      a.createdAt.getTime() - b.createdAt.getTime() ||
      a.displayName.localeCompare(b.displayName)
  );
  const canonical = sorted[0];
  const duplicate = sorted[1];

  const canonicalGameIds = new Set(
    (
      await prisma.gameStat.findMany({
        where: { playerId: canonical.id, deletedAt: null },
        select: { gameId: true }
      })
    ).map((r) => r.gameId)
  );
  const duplicateStats = await prisma.gameStat.findMany({
    where: { playerId: duplicate.id, deletedAt: null },
    select: { id: true, gameId: true }
  });
  const conflicts = duplicateStats.filter((s) => canonicalGameIds.has(s.gameId)).map((s) => s.gameId);
  if (conflicts.length > 0) {
    throw new Error(`Same-game conflict for merge ${canonical.displayName}/${duplicate.displayName}: ${conflicts.join(", ")}`);
  }

  return { canonical, duplicate, duplicateGameStatIds: duplicateStats.map((s) => s.id) };
}

async function main() {
  const beforeCounts = await snapshotCounts();
  const blocked: string[] = [];
  const validation: Record<string, unknown> = {};

  const programValidations = [];
  for (const programId of PROGRAM_SHELL_IDS) {
    const program = await prisma.program.findUnique({
      where: { id: programId },
      select: { id: true, fullName: true, deletedAt: true }
    });
    if (!program || program.deletedAt) {
      blocked.push(`Program ${programId} missing or already retired.`);
      continue;
    }
    const refs = await programShellCounts(programId);
    programValidations.push({ programId, fullName: program.fullName, refs, safe: refs.teams === 0 && refs.players === 0 });
    if (refs.teams !== 0 || refs.players !== 0) {
      blocked.push(`Program ${program.fullName} (${programId}) not empty: teams=${refs.teams}, players=${refs.players}`);
    }
  }

  const teamValidations = [];
  for (const teamId of ZERO_ACTIVITY_TEAM_IDS) {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, name: true, deletedAt: true, program: { select: { fullName: true } } }
    });
    if (!team || team.deletedAt) {
      blocked.push(`Team ${teamId} missing or already retired.`);
      continue;
    }
    const refs = await teamReferenceCounts(teamId);
    const gameActivityClear = refs.gameStat === 0 && refs.gameHome === 0 && refs.gameAway === 0;
    teamValidations.push({
      teamId,
      teamName: team.name,
      programName: team.program?.fullName ?? null,
      refs,
      safe: gameActivityClear,
      rosterSeasonsNote: refs.rosterSeasons > 0 ? `${refs.rosterSeasons} roster row(s) remain on soft-deleted team` : null
    });
    if (!gameActivityClear) {
      blocked.push(`Team ${team.name} (${teamId}) has activity: stats=${refs.gameStat}, home=${refs.gameHome}, away=${refs.gameAway}`);
    }
  }

  const eoin = await resolveEoinBragaTargetProgramId();
  const eoinNeedsFix = eoin.player.currentProgramId !== eoin.targetProgramId;

  const mergePlans = [];
  for (const group of PLAYER_MERGE_GROUPS) {
    const plan = await pickCanonicalPlayer(group.playerIds);
    mergePlans.push({ label: group.label, ...plan });
  }

  validation.programs = programValidations;
  validation.teams = teamValidations;
  validation.eoinBraga = {
    currentProgramId: eoin.player.currentProgramId,
    targetProgramId: eoin.targetProgramId,
    targetProgramName: eoin.targetProgramName,
    needsFix: eoinNeedsFix,
    evidence: eoin.evidence
  };
  validation.playerMerges = mergePlans.map((p) => ({
    label: p.label,
    canonical: { id: p.canonical.id, displayName: p.canonical.displayName, gameStats: p.canonical._count.gameStats },
    duplicate: { id: p.duplicate.id, displayName: p.duplicate.displayName, gameStats: p.duplicate._count.gameStats },
    duplicateGameStatIds: p.duplicateGameStatIds
  }));

  if (blocked.length > 0 && EXECUTE) {
    throw new Error(`Pre-flight blocked:\n${blocked.join("\n")}`);
  }

  const execution = {
    programsRetired: [] as Array<{ id: string; fullName: string }>,
    teamsRetired: [] as Array<{ id: string; name: string }>,
    eoinBraga: null as null | { from: string | null; to: string; updated: boolean },
    playerMerges: [] as Array<{
      label: string;
      canonicalId: string;
      duplicateId: string;
      gameStatsReassigned: number;
      gamePerformanceScoresReassigned: number;
      playerRatingsDeleted: number;
      rankingSnapshotRowsDeleted: number;
    }>
  };

  if (EXECUTE) {
    const archivedAt = new Date();

    await prisma.$transaction(async (tx) => {
      for (const row of programValidations) {
        if (!row.safe) continue;
        const updated = await tx.program.updateMany({
          where: {
            id: row.programId,
            deletedAt: null,
            teams: { none: { deletedAt: null } },
            currentPlayers: { none: { deletedAt: null } }
          },
          data: { deletedAt: archivedAt }
        });
        if (updated.count !== 1) throw new Error(`Failed to retire program ${row.programId}`);
        execution.programsRetired.push({ id: row.programId, fullName: row.fullName });
      }

      for (const row of teamValidations) {
        if (!row.safe) continue;
        const updated = await tx.team.updateMany({
          where: {
            id: row.teamId,
            deletedAt: null,
            gameStats: { none: { deletedAt: null } },
            homeGames: { none: { deletedAt: null } },
            awayGames: { none: { deletedAt: null } }
          },
          data: { deletedAt: archivedAt }
        });
        if (updated.count !== 1) throw new Error(`Failed to retire team ${row.teamId}`);
        execution.teamsRetired.push({ id: row.teamId, name: row.teamName });
      }

      if (eoinNeedsFix) {
        const updated = await tx.player.updateMany({
          where: { id: EOIN_BRAGA_PLAYER_ID, deletedAt: null },
          data: { currentProgramId: eoin.targetProgramId }
        });
        if (updated.count !== 1) throw new Error("Failed to update Eoin Braga currentProgramId");
      }
      execution.eoinBraga = {
        from: eoin.player.currentProgram?.fullName ?? null,
        to: eoin.targetProgramName,
        updated: eoinNeedsFix
      };

      for (const plan of mergePlans) {
        const duplicateGameStatIds = plan.duplicateGameStatIds;
        const gpsRows =
          duplicateGameStatIds.length > 0
            ? await tx.gamePerformanceScore.findMany({
                where: { gameStatId: { in: duplicateGameStatIds } },
                select: { id: true }
              })
            : [];

        const gameStatUpdate = await tx.gameStat.updateMany({
          where: { id: { in: duplicateGameStatIds } },
          data: { playerId: plan.canonical.id }
        });

        const gpsUpdate = await tx.gamePerformanceScore.updateMany({
          where: { id: { in: gpsRows.map((r) => r.id) } },
          data: { playerId: plan.canonical.id }
        });
        if (gpsUpdate.count !== gpsRows.length) {
          throw new Error(`GPS reassignment mismatch for ${plan.label}`);
        }

        const ratingDelete = await tx.playerRating.deleteMany({ where: { playerId: plan.duplicate.id } });
        const snapshotDelete = await tx.rankingSnapshotRow.deleteMany({ where: { playerId: plan.duplicate.id } });

        const playerDelete = await tx.player.updateMany({
          where: { id: plan.duplicate.id, deletedAt: null },
          data: { deletedAt: archivedAt }
        });
        if (playerDelete.count !== 1) throw new Error(`Failed to soft-delete duplicate for ${plan.label}`);

        execution.playerMerges.push({
          label: plan.label,
          canonicalId: plan.canonical.id,
          duplicateId: plan.duplicate.id,
          gameStatsReassigned: gameStatUpdate.count,
          gamePerformanceScoresReassigned: gpsUpdate.count,
          playerRatingsDeleted: ratingDelete.count,
          rankingSnapshotRowsDeleted: snapshotDelete.count
        });
      }
    });
  }

  const afterCounts = EXECUTE ? await snapshotCounts() : beforeCounts;

  const report = {
    generatedAt: new Date().toISOString(),
    mode: EXECUTE ? "executed" : "dry-run",
    beforeCounts,
    afterCounts,
    deltas: EXECUTE
      ? {
          activePrograms: afterCounts.activePrograms - beforeCounts.activePrograms,
          activeTeams: afterCounts.activeTeams - beforeCounts.activeTeams,
          activePlayers: afterCounts.activePlayers - beforeCounts.activePlayers,
          activeGameStats: afterCounts.activeGameStats - beforeCounts.activeGameStats,
          gamePerformanceScores: afterCounts.gamePerformanceScores - beforeCounts.gamePerformanceScores,
          playerRatings: afterCounts.playerRatings - beforeCounts.playerRatings,
          rankingSnapshotRows: afterCounts.rankingSnapshotRows - beforeCounts.rankingSnapshotRows
        }
      : null,
    validation,
    blocked,
    execution: EXECUTE ? execution : null,
    rollbackNotes: {
      programs: PROGRAM_SHELL_IDS.map((id) => `UPDATE programs SET "deletedAt" = NULL WHERE id = '${id}';`),
      teams: ZERO_ACTIVITY_TEAM_IDS.map((id) => `UPDATE teams SET "deletedAt" = NULL WHERE id = '${id}';`),
      eoinBraga: eoin.player.currentProgramId
        ? `UPDATE players SET "currentProgramId" = '${eoin.player.currentProgramId}' WHERE id = '${EOIN_BRAGA_PLAYER_ID}';`
        : `UPDATE players SET "currentProgramId" = NULL WHERE id = '${EOIN_BRAGA_PLAYER_ID}';`,
      playerMerges:
        "Restore soft-deleted duplicate players (deletedAt=NULL), reassign GameStats/GPS back to duplicate playerIds, recreate PlayerRating/RankingSnapshotRow from backup if deleted."
    },
    skippedByPolicy: [
      "Kenzo Centeno / Kenzo Rui Centeno",
      "Shaun Haw / Shaun Jordan Haw",
      "Andres Braganza / Andres Thaddeus Braganza",
      "Christiane Chan cluster",
      "Roberto Sison cluster",
      "U19/16U team merge pairs (high risk — not in approved scope)"
    ]
  };

  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2), "utf8");
  writeFileSync(REPORT_MD, formatReportMd(report), "utf8");

  console.log(JSON.stringify({ mode: report.mode, blocked, deltas: report.deltas, execution: report.execution, paths: { REPORT_JSON, REPORT_MD } }, null, 2));
}

function formatReportMd(report: {
  generatedAt: string;
  mode: string;
  beforeCounts: Counts;
  afterCounts: Counts;
  deltas: Record<string, number> | null;
  blocked: string[];
  execution: {
    programsRetired: Array<{ id: string; fullName: string }>;
    teamsRetired: Array<{ id: string; name: string }>;
    eoinBraga: { from: string | null; to: string; updated: boolean } | null;
    playerMerges: Array<{ label: string; canonicalId: string; duplicateId: string; gameStatsReassigned: number }>;
  } | null;
  rollbackNotes: Record<string, unknown>;
  skippedByPolicy: string[];
  validation: { eoinBraga?: { targetProgramName: string } };
}) {
  return `# Safe Identity Cleanup Execution

**Generated:** ${report.generatedAt}  
**Mode:** ${report.mode}

## Before / After Counts

| Metric | Before | After | Delta |
|---|---:|---:|---:|
| Active Programs | ${report.beforeCounts.activePrograms} | ${report.afterCounts.activePrograms} | ${report.deltas?.activePrograms ?? "—"} |
| Active Teams | ${report.beforeCounts.activeTeams} | ${report.afterCounts.activeTeams} | ${report.deltas?.activeTeams ?? "—"} |
| Active Players | ${report.beforeCounts.activePlayers} | ${report.afterCounts.activePlayers} | ${report.deltas?.activePlayers ?? "—"} |
| Active GameStats | ${report.beforeCounts.activeGameStats} | ${report.afterCounts.activeGameStats} | ${report.deltas?.activeGameStats ?? "—"} |
| GamePerformanceScores | ${report.beforeCounts.gamePerformanceScores} | ${report.afterCounts.gamePerformanceScores} | ${report.deltas?.gamePerformanceScores ?? "—"} |
| PlayerRatings | ${report.beforeCounts.playerRatings} | ${report.afterCounts.playerRatings} | ${report.deltas?.playerRatings ?? "—"} |
| RankingSnapshotRows | ${report.beforeCounts.rankingSnapshotRows} | ${report.afterCounts.rankingSnapshotRows} | ${report.deltas?.rankingSnapshotRows ?? "—"} |

## Execution Summary

- Programs retired: ${report.execution?.programsRetired.length ?? 0}
- Teams retired: ${report.execution?.teamsRetired.length ?? 0}
- Eoin Braga program fix: ${report.execution?.eoinBraga?.updated ? `yes → ${report.execution.eoinBraga.to}` : "no change needed"}
- Player merges: ${report.execution?.playerMerges.length ?? 0}

## Blocked Items

${report.blocked.length ? report.blocked.map((b) => `- ${b}`).join("\n") : "- None"}

## Skipped (Out of Scope)

${report.skippedByPolicy.map((s) => `- ${s}`).join("\n")}
`;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
