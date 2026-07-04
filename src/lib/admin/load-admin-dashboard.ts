import { ProgramRole, VerificationStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { activeSubmissionWhere } from "@/lib/submission-lifecycle";

const DASHBOARD_CACHE_MS = 3 * 60 * 1000;

const officialGameStatuses: VerificationStatus[] = [
  VerificationStatus.VERIFIED,
  VerificationStatus.SUBMITTED,
];

export type AdminDashboardSummary = {
  players: number;
  teams: number;
  programs: number;
  competitions: number;
  seasons: number;
  games: number;
  verifiedGames: number;
  ratings: number;
  imports: number;
};

export type AdminDashboardAttention = {
  pendingImports: number;
  duplicateCandidates: number;
  integrityWarnings: number;
  playersWithoutPrograms: number;
  teamsWithoutPrograms: number;
  programsWithoutTeams: number;
  archivedNeedingReview: number;
};

export type AdminDashboardRecentImport = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  href: string;
};

export type AdminDashboardRecentAction = {
  id: string;
  entityType: string;
  action: string;
  actor: string;
  createdAt: string;
};

export type AdminDashboardRecentGame = {
  id: string;
  label: string;
  gameDate: string;
  verificationStatus: string;
  href: string;
};

export type AdminDashboardData = {
  summary: AdminDashboardSummary;
  attention: AdminDashboardAttention;
  recentImports: AdminDashboardRecentImport[];
  recentActions: AdminDashboardRecentAction[];
  recentPublishedGames: AdminDashboardRecentGame[];
};

let dashboardCache: { value: AdminDashboardData; loadedAt: number } | null = null;

export function clearAdminDashboardCache() {
  dashboardCache = null;
}

async function countDuplicateNameGroups() {
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM (
      SELECT LOWER(p."displayName") AS name_key, p.gender
      FROM players p
      WHERE p."deletedAt" IS NULL
      GROUP BY LOWER(p."displayName"), p.gender
      HAVING COUNT(*) > 1
    ) groups
  `;
  return Number(rows[0]?.count ?? 0);
}

async function loadAdminDashboardUncached(): Promise<AdminDashboardData> {
  const [
    players,
    teams,
    programs,
    competitions,
    seasons,
    games,
    verifiedGames,
    ratings,
    imports,
    pendingImports,
    duplicateCandidates,
    playersWithoutPrograms,
    teamsWithoutPrograms,
    programsWithoutTeams,
    playersMissingBirthDate,
    playersOnArchivedProgram,
    playersOnGroupProgram,
    archivedLeagues,
    archivedPrograms,
    archivedSeasons,
    recentSubmissions,
    recentActions,
    recentPublishedGames,
  ] = await Promise.all([
    prisma.player.count({ where: { deletedAt: null } }),
    prisma.team.count({ where: { deletedAt: null } }),
    prisma.program.count({ where: { deletedAt: null } }),
    prisma.league.count({ where: { deletedAt: null } }),
    prisma.season.count({ where: { deletedAt: null } }),
    prisma.game.count({ where: { deletedAt: null } }),
    prisma.game.count({
      where: { deletedAt: null, verificationStatus: { in: officialGameStatuses } },
    }),
    prisma.playerRating.count(),
    prisma.submission.count({ where: activeSubmissionWhere }),
    prisma.submission.count({
      where: {
        ...activeSubmissionWhere,
        status: { in: ["SUBMITTED", "UNDER_REVIEW", "DRAFT", "APPROVED"] },
      },
    }),
    countDuplicateNameGroups(),
    prisma.player.count({ where: { deletedAt: null, currentProgramId: null } }),
    prisma.team.count({ where: { deletedAt: null, programId: null } }),
    prisma.program.count({
      where: {
        deletedAt: null,
        programRole: ProgramRole.OPERATIONAL,
        teams: { none: { deletedAt: null } },
      },
    }),
    prisma.player.count({ where: { deletedAt: null, birthDate: null } }),
    prisma.player.count({
      where: {
        deletedAt: null,
        currentProgram: { deletedAt: { not: null } },
      },
    }),
    prisma.player.count({
      where: {
        deletedAt: null,
        currentProgram: { programRole: ProgramRole.GROUP, deletedAt: null },
      },
    }),
    prisma.league.count({
      where: { deletedAt: { not: null } },
    }),
    prisma.program.count({ where: { deletedAt: { not: null } } }),
    prisma.season.count({ where: { deletedAt: { not: null } } }),
    prisma.submission.findMany({
      where: activeSubmissionWhere,
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, title: true, status: true, createdAt: true },
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        entityType: true,
        action: true,
        createdAt: true,
        user: { select: { name: true, username: true } },
      },
    }),
    prisma.game.findMany({
      where: {
        deletedAt: null,
        verificationStatus: { in: officialGameStatuses },
      },
      orderBy: [{ updatedAt: "desc" }, { gameDate: "desc" }],
      take: 6,
      select: {
        id: true,
        gameNumber: true,
        gameDate: true,
        verificationStatus: true,
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
        season: { select: { leagueId: true } },
      },
    }),
  ]);

  const integrityWarnings =
    playersMissingBirthDate + playersOnArchivedProgram + playersOnGroupProgram + playersWithoutPrograms;

  return {
    summary: {
      players,
      teams,
      programs,
      competitions,
      seasons,
      games,
      verifiedGames,
      ratings,
      imports,
    },
    attention: {
      pendingImports,
      duplicateCandidates,
      integrityWarnings,
      playersWithoutPrograms,
      teamsWithoutPrograms,
      programsWithoutTeams,
      archivedNeedingReview: archivedLeagues + archivedPrograms + archivedSeasons,
    },
    recentImports: recentSubmissions.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      href: `/admin/submissions/${row.id}`,
    })),
    recentActions: recentActions.map((row) => ({
      id: row.id,
      entityType: row.entityType,
      action: row.action,
      actor: row.user?.name ?? row.user?.username ?? "System",
      createdAt: row.createdAt.toISOString(),
    })),
    recentPublishedGames: recentPublishedGames.map((row) => ({
      id: row.id,
      label: `${row.homeTeam.name} vs ${row.awayTeam.name}${row.gameNumber ? ` · ${row.gameNumber}` : ""}`,
      gameDate: row.gameDate.toISOString().slice(0, 10),
      verificationStatus: row.verificationStatus,
      href: `/admin/leagues/${row.season.leagueId}/games/${row.id}`,
    })),
  };
}

export async function loadAdminDashboard(options?: { bypassCache?: boolean }) {
  const now = Date.now();
  if (!options?.bypassCache && dashboardCache && now - dashboardCache.loadedAt < DASHBOARD_CACHE_MS) {
    return dashboardCache.value;
  }

  const value = await loadAdminDashboardUncached();
  dashboardCache = { value, loadedAt: now };
  return value;
}
