import { AgeGroup, PlayerGender, PrismaClient, VerificationStatus } from "@prisma/client";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const prisma = new PrismaClient();
const reportPath = join(process.cwd(), "scripts", "reports", "post-cleanup-data-health-audit.json");

const sanSebastianCanonicalTeamId = "08b4a2a4-670b-4a02-a88b-4a6151c0c343";
const sanSebastianSourceTeamId = "7543e4de-09d2-45e5-869e-341a760b59b8";

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inferGender(...values: Array<string | null | undefined>) {
  return values.filter(Boolean).join(" ").toLowerCase().includes("girl") ? PlayerGender.GIRLS : PlayerGender.BOYS;
}

function dateOnly(date: Date | null | undefined) {
  return date ? date.toISOString().slice(0, 10) : null;
}

function ranksAreContiguous(ranks: number[]) {
  const sorted = ranks.slice().sort((left, right) => left - right);
  return sorted.every((rank, index) => rank === index + 1);
}

function reportFileStatus(relativePath: string) {
  const absolutePath = join(process.cwd(), relativePath);
  if (!existsSync(absolutePath)) {
    return { path: relativePath, exists: false, stale: true, reason: "Report file is missing; regenerate from current data if needed." };
  }
  const content = readFileSync(absolutePath, "utf8");
  const stats = statSync(absolutePath);
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { path: relativePath, exists: true, modifiedAt: stats.mtime.toISOString(), stale: true, reason: "Report is not valid JSON." };
  }
  const text = JSON.stringify(parsed);
  const referencesSoftDeletedMergeSources =
    text.includes("12 approved duplicate player") ||
    text.includes("MERGE_APPROVED_CANDIDATE") ||
    text.includes("sourcePlayerIds") ||
    text.includes("duplicatePlayerIds");
  return {
    path: relativePath,
    exists: true,
    modifiedAt: stats.mtime.toISOString(),
    stale: referencesSoftDeletedMergeSources,
    reason: referencesSoftDeletedMergeSources
      ? "Report was part of the pre/post merge planning flow and may reference players that are now soft-deleted or merged."
      : "Report exists; regenerate only if current duplicate diagnostics are needed."
  };
}

async function activeGamesForTeam(teamId: string) {
  const games = await prisma.game.findMany({
    where: {
      deletedAt: null,
      verificationStatus: VerificationStatus.VERIFIED,
      OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }]
    },
    include: { season: { include: { league: true } } }
  });
  const statsCount = await prisma.gameStat.count({
    where: {
      deletedAt: null,
      teamId,
      game: { deletedAt: null, verificationStatus: VerificationStatus.VERIFIED }
    }
  });
  return { games, statsCount };
}

async function main() {
  const [
    programs,
    teams,
    activePlayers,
    softDeletedPlayers,
    playersWithoutCurrentProgram,
    rankingSnapshotCount,
    rankingSnapshotRowCount,
    snapshots
  ] = await Promise.all([
    prisma.program.findMany({ where: { deletedAt: null }, include: { teams: { where: { deletedAt: null } } }, orderBy: { fullName: "asc" } }),
    prisma.team.findMany({ where: { deletedAt: null }, include: { program: true }, orderBy: { name: "asc" } }),
    prisma.player.count({ where: { deletedAt: null } }),
    prisma.player.count({ where: { deletedAt: { not: null } } }),
    prisma.player.count({ where: { deletedAt: null, currentProgramId: null } }),
    prisma.rankingSnapshot.count(),
    prisma.rankingSnapshotRow.count(),
    prisma.rankingSnapshot.findMany({
      include: {
        rows: {
          include: { player: { select: { id: true, displayName: true, deletedAt: true } } },
          orderBy: { rank: "asc" }
        }
      },
      orderBy: [{ ageGroup: "asc" }, { gender: "asc" }, { weekOf: "desc" }]
    })
  ]);

  const activeGames = await prisma.game.findMany({
    where: { deletedAt: null, verificationStatus: VerificationStatus.VERIFIED },
    include: {
      homeTeam: { include: { program: true } },
      awayTeam: { include: { program: true } },
      season: { include: { league: true } },
      stats: { where: { deletedAt: null }, select: { id: true, teamId: true } }
    }
  });

  const activeTeamIds = new Set<string>();
  const teamUsage = new Map<string, {
    teamId: string;
    teamName: string;
    programId: string | null;
    programFullName: string | null;
    officialGames: Set<string>;
    activeGameStats: number;
    contexts: Set<string>;
  }>();

  function ensureTeam(team: { id: string; name: string; programId: string | null; program?: { fullName: string } | null }) {
    const existing = teamUsage.get(team.id);
    if (existing) return existing;
    const row = {
      teamId: team.id,
      teamName: team.name,
      programId: team.programId,
      programFullName: team.program?.fullName ?? null,
      officialGames: new Set<string>(),
      activeGameStats: 0,
      contexts: new Set<string>()
    };
    teamUsage.set(team.id, row);
    return row;
  }

  for (const game of activeGames) {
    const home = ensureTeam(game.homeTeam);
    const away = ensureTeam(game.awayTeam);
    const homeGender = inferGender(game.season.league.name, game.homeTeam.name);
    const awayGender = inferGender(game.season.league.name, game.awayTeam.name);
    const homeContext = `${game.homeTeam.programId ?? "no-program"}|${game.season.league.ageGroup}|${homeGender}|${game.season.leagueId}|${game.seasonId}`;
    const awayContext = `${game.awayTeam.programId ?? "no-program"}|${game.season.league.ageGroup}|${awayGender}|${game.season.leagueId}|${game.seasonId}`;
    activeTeamIds.add(game.homeTeamId);
    activeTeamIds.add(game.awayTeamId);
    home.officialGames.add(game.id);
    away.officialGames.add(game.id);
    home.contexts.add(homeContext);
    away.contexts.add(awayContext);
    home.activeGameStats += game.stats.filter((stat) => stat.teamId === game.homeTeamId).length;
    away.activeGameStats += game.stats.filter((stat) => stat.teamId === game.awayTeamId).length;
  }

  const activeTeamRecords = teams.filter((team) => activeTeamIds.has(team.id));
  const inactiveTeamRecords = teams.filter((team) => !activeTeamIds.has(team.id));

  const sameContext = new Map<string, Array<{ teamId: string; teamName: string; programFullName: string | null; officialGames: number; activeGameStats: number }>>();
  for (const usage of teamUsage.values()) {
    for (const context of usage.contexts) {
      const list = sameContext.get(context) ?? [];
      list.push({
        teamId: usage.teamId,
        teamName: usage.teamName,
        programFullName: usage.programFullName,
        officialGames: usage.officialGames.size,
        activeGameStats: usage.activeGameStats
      });
      sameContext.set(context, list);
    }
  }
  const sameContextDuplicateActiveTeamGroups = Array.from(sameContext.entries())
    .filter(([, group]) => group.length > 1)
    .map(([context, group]) => {
      const [, ageGroup, gender, leagueId, seasonId] = context.split("|");
      return { context, ageGroup, gender, leagueId, seasonId, programFullName: group[0]?.programFullName ?? null, teams: group };
    });

  const programsWithNoActiveTeams = programs
    .filter((program) => !program.teams.some((team) => activeTeamIds.has(team.id)))
    .map((program) => ({ programId: program.id, fullName: program.fullName, linkedTeamCount: program.teams.length }));
  const programsWithHighInactiveTeamRecords = programs
    .map((program) => ({
      programId: program.id,
      fullName: program.fullName,
      activeTeamCount: program.teams.filter((team) => activeTeamIds.has(team.id)).length,
      inactiveTeamCount: program.teams.filter((team) => !activeTeamIds.has(team.id)).length
    }))
    .filter((program) => program.inactiveTeamCount >= 4)
    .sort((left, right) => right.inactiveTeamCount - left.inactiveTeamCount);

  const [sanSebastianSourceUsage, sanSebastianCanonicalUsage] = await Promise.all([
    activeGamesForTeam(sanSebastianSourceTeamId),
    activeGamesForTeam(sanSebastianCanonicalTeamId)
  ]);
  const sanSebastianDuplicateResolved =
    sanSebastianSourceUsage.games.length === 0 &&
    sanSebastianSourceUsage.statsCount === 0 &&
    !sameContextDuplicateActiveTeamGroups.some((group) => group.programFullName === "San Sebastian College-Recoletos");

  const activePlayerRows = await prisma.player.findMany({
    where: { deletedAt: null },
    include: {
      currentProgram: true,
      gameStats: { where: { deletedAt: null }, select: { id: true } },
      performanceScores: { where: { deletedAt: null }, select: { id: true } },
      currentRatings: { select: { id: true } },
      rankingRows: { select: { id: true } }
    }
  });
  const byNormalizedPlayerName = new Map<string, typeof activePlayerRows>();
  for (const player of activePlayerRows) {
    const key = normalizeName(player.displayName);
    if (!key) continue;
    const list = byNormalizedPlayerName.get(key) ?? [];
    list.push(player);
    byNormalizedPlayerName.set(key, list);
  }
  const duplicatePlayerGroupsRemaining = Array.from(byNormalizedPlayerName.entries())
    .filter(([, players]) => players.length > 1)
    .map(([normalizedName, players]) => ({
      normalizedName,
      classification: new Set(players.map((player) => player.currentProgramId ?? "none")).size === 1 && new Set(players.map((player) => player.gender)).size === 1 ? "NEEDS_REVIEW_SAME_PROGRAM" : "NEEDS_REVIEW_MIXED_CONTEXT",
      players: players.map((player) => ({
        playerId: player.id,
        displayName: player.displayName,
        currentProgram: player.currentProgram?.fullName ?? null,
        gender: player.gender,
        gameStats: player.gameStats.length,
        gamePerformanceScores: player.performanceScores.length,
        playerRatings: player.currentRatings.length,
        snapshotRows: player.rankingRows.length
      }))
    }));

  const [
    gameStatsPointingToDeletedPlayers,
    gamePerformanceScoresPointingToDeletedPlayers,
    playerRatingsPointingToDeletedPlayers,
    snapshotRowsPointingToDeletedPlayers
  ] = await Promise.all([
    prisma.gameStat.count({ where: { player: { deletedAt: { not: null } } } }),
    prisma.gamePerformanceScore.count({ where: { player: { deletedAt: { not: null } } } }),
    prisma.playerRating.count({ where: { player: { deletedAt: { not: null } } } }),
    prisma.rankingSnapshotRow.count({ where: { player: { deletedAt: { not: null } } } })
  ]);

  const duplicateRowsBySnapshot = snapshots
    .map((snapshot) => {
      const playerIds = snapshot.rows.map((row) => row.playerId);
      return {
        snapshotId: snapshot.id,
        ageGroup: snapshot.ageGroup ? String(snapshot.ageGroup) : null,
        gender: String(snapshot.gender),
        duplicatePlayerRows: playerIds.length - new Set(playerIds).size
      };
    })
    .filter((snapshot) => snapshot.duplicatePlayerRows > 0);

  function latestSnapshot(ageGroup: AgeGroup, gender: PlayerGender) {
    return snapshots
      .filter((snapshot) => snapshot.ageGroup === ageGroup && snapshot.gender === gender)
      .sort((left, right) => right.weekOf.getTime() - left.weekOf.getTime())[0] ?? null;
  }

  function validateSnapshot(ageGroup: AgeGroup, gender: PlayerGender) {
    const snapshot = latestSnapshot(ageGroup, gender);
    if (!snapshot) {
      return { ageGroup, gender, exists: false, startsAtOne: false, contiguous: false, rowCount: 0, duplicatePlayerRows: 0, deletedPlayers: 0 };
    }
    const ranks = snapshot.rows.map((row) => row.rank);
    const playerIds = snapshot.rows.map((row) => row.playerId);
    return {
      id: snapshot.id,
      ageGroup,
      gender,
      weekOf: snapshot.weekOf.toISOString(),
      exists: true,
      startsAtOne: ranks.length > 0 && Math.min(...ranks) === 1,
      contiguous: ranksAreContiguous(ranks),
      rowCount: snapshot.rows.length,
      duplicatePlayerRows: playerIds.length - new Set(playerIds).size,
      deletedPlayers: snapshot.rows.filter((row) => row.player.deletedAt !== null).length
    };
  }

  const rankingValidation = {
    rankingSnapshotCount,
    rankingSnapshotRowCount,
    u16Boys: validateSnapshot(AgeGroup.U16, PlayerGender.BOYS),
    u19Boys: validateSnapshot(AgeGroup.U19, PlayerGender.BOYS),
    u19Girls: validateSnapshot(AgeGroup.U19, PlayerGender.GIRLS),
    duplicateRowsBySnapshot,
    deletedPlayersInSnapshots: snapshotRowsPointingToDeletedPlayers,
    noDuplicatePlayerRowsInSameSnapshot: duplicateRowsBySnapshot.length === 0,
    noDeletedPlayersInSnapshots: snapshotRowsPointingToDeletedPlayers === 0
  };

  const deletedPlayerReferenceIssues = {
    gameStatsPointingToDeletedPlayers,
    gamePerformanceScoresPointingToDeletedPlayers,
    playerRatingsPointingToDeletedPlayers,
    snapshotRowsPointingToDeletedPlayers
  };

  const adminReports = {
    duplicateCleanupPlan: reportFileStatus("scripts/reports/duplicate-cleanup-plan.json"),
    allPlayerMergePlan: reportFileStatus("scripts/reports/all-player-merge-plan.json"),
    recommendation: "Regenerate duplicate cleanup/player merge reports from current data before planning any additional merge or hide/delete action; archive the old merge planning reports after confirming they are no longer used by admin review pages."
  };

  const remainingIssues = [
    ...(sameContextDuplicateActiveTeamGroups.length ? [`${sameContextDuplicateActiveTeamGroups.length} same-context active team duplicate group(s) remain.`] : []),
    ...(duplicatePlayerGroupsRemaining.length ? [`${duplicatePlayerGroupsRemaining.length} exact normalized active player duplicate group(s) remain.`] : []),
    ...(Object.values(deletedPlayerReferenceIssues).some((count) => count > 0) ? ["Some records still point to soft-deleted players."] : []),
    ...(!rankingValidation.u16Boys.startsAtOne || !rankingValidation.u16Boys.contiguous ? ["U16 Boys rankings are not contiguous from rank 1."] : []),
    ...(!rankingValidation.u19Boys.startsAtOne || !rankingValidation.u19Boys.contiguous ? ["U19 Boys rankings are not contiguous from rank 1."] : []),
    ...(!rankingValidation.u19Girls.startsAtOne || !rankingValidation.u19Girls.contiguous ? ["U19 Girls rankings are missing or not contiguous from rank 1."] : []),
    ...(programsWithHighInactiveTeamRecords.length ? [`${programsWithHighInactiveTeamRecords.length} Program(s) have unusually high inactive team records.`] : [])
  ];

  const validationPassed =
    sameContextDuplicateActiveTeamGroups.length === 0 &&
    sanSebastianDuplicateResolved &&
    duplicatePlayerGroupsRemaining.length === 0 &&
    Object.values(deletedPlayerReferenceIssues).every((count) => count === 0) &&
    rankingValidation.u16Boys.startsAtOne &&
    rankingValidation.u16Boys.contiguous &&
    rankingValidation.u19Boys.startsAtOne &&
    rankingValidation.u19Boys.contiguous &&
    rankingValidation.u19Girls.startsAtOne &&
    rankingValidation.u19Girls.contiguous &&
    rankingValidation.noDuplicatePlayerRowsInSameSnapshot &&
    rankingValidation.noDeletedPlayersInSnapshots;

  const report = {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    programs: {
      totalPrograms: programs.length,
      programsWithNoActiveTeams,
      programsWithHighInactiveTeamRecords,
      programsWithPossibleSameContextActiveDuplicateTeams: sameContextDuplicateActiveTeamGroups.map((group) => group.programFullName)
    },
    teams: {
      activeTeamRecords: activeTeamRecords.length,
      inactiveTeamRecords: inactiveTeamRecords.length,
      sameContextDuplicateActiveTeamGroups,
      sanSebastianDuplicateResolved,
      sanSebastian: {
        sourceTeamId: sanSebastianSourceTeamId,
        sourceActiveGames: sanSebastianSourceUsage.games.length,
        sourceActiveGameStats: sanSebastianSourceUsage.statsCount,
        canonicalTeamId: sanSebastianCanonicalTeamId,
        canonicalActiveGames: sanSebastianCanonicalUsage.games.length,
        canonicalActiveGameStats: sanSebastianCanonicalUsage.statsCount
      }
    },
    players: {
      activePlayers,
      softDeletedPlayers,
      playersWithoutCurrentProgramId: playersWithoutCurrentProgram,
      possibleDuplicatePlayerGroupsAfterMerge: duplicatePlayerGroupsRemaining,
      deletedPlayerReferenceIssues
    },
    rankings: rankingValidation,
    adminReports,
    summary: {
      validationPassed,
      remainingIssues,
      duplicateTeamGroupsRemaining: sameContextDuplicateActiveTeamGroups.length,
      duplicatePlayerGroupsRemaining: duplicatePlayerGroupsRemaining.length,
      deletedPlayerReferenceIssues,
      rankingValidation,
      recommendedNextSteps: [
        ...(duplicatePlayerGroupsRemaining.length ? ["Review remaining exact-name player duplicate groups manually; do not merge without a new approved repair plan."] : []),
        ...(sameContextDuplicateActiveTeamGroups.length ? ["Create focused repair plans for any remaining same-context active team duplicate groups."] : []),
        ...(programsWithHighInactiveTeamRecords.length ? ["Keep inactive team records hidden in normal Program Management and review whether test-only records should be archived or deleted in a separately approved cleanup."] : []),
        "Regenerate duplicate-cleanup-plan.json and all-player-merge-plan.json from current data before using them for future repairs.",
        "Archive pre-merge planning reports once current admin duplicate review no longer depends on them."
      ]
    }
  };

  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ reportPath, ...report.summary }, null, 2));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
