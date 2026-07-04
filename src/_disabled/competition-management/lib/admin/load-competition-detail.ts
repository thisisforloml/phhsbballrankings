import { VerificationStatus } from "@prisma/client";

import type {
  ManagedCompetition,
  ManagedDivision,
  ManagedSeason,
} from "@/lib/admin/competition-management/types";
import { prisma } from "@/lib/prisma";

const officialStatuses: VerificationStatus[] = [VerificationStatus.VERIFIED, VerificationStatus.SUBMITTED];

function formatDate(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : null;
}

export type CompetitionDetail = {
  competition: ManagedCompetition;
  seasons: ManagedSeason[];
  divisions: ManagedDivision[];
};

export async function loadCompetitionDetail(competitionId: string): Promise<CompetitionDetail | null> {
  const row = await prisma.league.findFirst({
    where: { id: competitionId, deletedAt: null },
    include: {
      _count: {
        select: {
          seasons: { where: { deletedAt: null } },
        },
      },
      seasons: {
        where: { deletedAt: null },
        orderBy: [{ isCurrent: "desc" }, { seasonYear: "desc" }, { name: "asc" }],
        include: {
          _count: {
            select: {
              games: { where: { deletedAt: null } },
              divisions: { where: { deletedAt: null } },
            },
          },
          divisions: {
            where: { deletedAt: null },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            include: {
              _count: {
                select: {
                  games: { where: { deletedAt: null } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!row) return null;

  const gameCount = row.seasons.reduce((sum, season) => sum + season._count.games, 0);
  const competition: ManagedCompetition = {
    id: row.id,
    name: row.name,
    shortName: row.shortName,
    organization: row.organizerName,
    seasonType: row.seasonType,
    country: row.country,
    region: row.region,
    sport: row.sport,
    defaultAgeGroups: row.defaultAgeGroups.length ? row.defaultAgeGroups : [row.ageGroup],
    defaultGenders: row.defaultGenders,
    status: row.status,
    logoUrl: row.logoUrl,
    website: row.website,
    notes: row.adminNotes,
    tier: row.tier,
    ageGroup: row.ageGroup,
    seasonCount: row._count.seasons,
    gameCount,
  };

  const seasons: ManagedSeason[] = row.seasons.map((season) => ({
    id: season.id,
    name: season.name,
    seasonNumber: season.seasonNumber,
    seasonYear: season.seasonYear,
    startsOn: formatDate(season.startsOn) ?? "",
    endsOn: formatDate(season.endsOn),
    status: season.status,
    isCurrent: season.isCurrent,
    gameCount: season._count.games,
    divisionCount: season._count.divisions,
  }));

  const divisions: ManagedDivision[] = row.seasons.flatMap((season) =>
    season.divisions.map((division) => ({
      id: division.id,
      seasonId: season.id,
      name: division.name,
      ageGroup: division.ageGroup,
      gender: division.gender,
      status: division.status,
      sortOrder: division.sortOrder,
      gameCount: division._count.games,
    })),
  );

  return { competition, seasons, divisions };
}

export type CompetitionAnalytics = {
  seasonCount: number;
  divisionCount: number;
  teamCount: number;
  gameCount: number;
  verifiedGameCount: number;
  playerCount: number;
  ratingCount: number;
  coverage: {
    gamesWithDivision: number;
    gamesWithoutDivision: number;
    verifiedRate: number;
  };
  recentImports: Array<{
    id: string;
    title: string;
    status: string;
    createdAt: string;
  }>;
  recentGames: Array<{
    id: string;
    gameNumber: string | null;
    gameDate: string;
    homeTeamName: string;
    awayTeamName: string;
    divisionName: string | null;
    verificationStatus: string;
  }>;
};

export async function loadCompetitionAnalytics(competitionId: string): Promise<CompetitionAnalytics | null> {
  const detail = await loadCompetitionDetail(competitionId);
  if (!detail) return null;

  const seasonIds = detail.seasons.map((season) => season.id);

  const [games, recentImports] = await Promise.all([
    prisma.game.findMany({
      where: { deletedAt: null, seasonId: { in: seasonIds } },
      select: {
        id: true,
        gameNumber: true,
        gameDate: true,
        verificationStatus: true,
        divisionId: true,
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
        division: { select: { name: true } },
        _count: { select: { stats: { where: { deletedAt: null } } } },
      },
      orderBy: { gameDate: "desc" },
      take: 25,
    }),
    prisma.importRecord.findMany({
      where: { deletedAt: null, leagueId: competitionId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
      },
    }),
  ]);

  const gameIds = games.map((game) => game.id);
  const teamIds = new Set<string>();

  const allSeasonGames = await prisma.game.findMany({
    where: { deletedAt: null, seasonId: { in: seasonIds } },
    select: {
      id: true,
      verificationStatus: true,
      divisionId: true,
      homeTeamId: true,
      awayTeamId: true,
    },
  });

  for (const game of allSeasonGames) {
    teamIds.add(game.homeTeamId);
    teamIds.add(game.awayTeamId);
  }

  const verifiedGameCount = allSeasonGames.filter((game) => officialStatuses.includes(game.verificationStatus)).length;
  const gamesWithDivision = allSeasonGames.filter((game) => game.divisionId).length;

  const playerCount =
    gameIds.length === 0
      ? 0
      : await prisma.gameStat.findMany({
          where: { deletedAt: null, gameId: { in: allSeasonGames.map((game) => game.id) } },
          distinct: ["playerId"],
          select: { playerId: true },
        }).then((rows) => rows.length);

  const ratingCount = await prisma.playerRating.count({
    where: {
      player: {
        gameStats: {
          some: {
            deletedAt: null,
            game: { deletedAt: null, seasonId: { in: seasonIds } },
          },
        },
      },
    },
  });

  return {
    seasonCount: detail.seasons.length,
    divisionCount: detail.divisions.length,
    teamCount: teamIds.size,
    gameCount: allSeasonGames.length,
    verifiedGameCount,
    playerCount,
    ratingCount,
    coverage: {
      gamesWithDivision,
      gamesWithoutDivision: allSeasonGames.length - gamesWithDivision,
      verifiedRate: allSeasonGames.length ? Math.round((verifiedGameCount / allSeasonGames.length) * 100) : 0,
    },
    recentImports: recentImports.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    })),
    recentGames: games.map((game) => ({
      id: game.id,
      gameNumber: game.gameNumber,
      gameDate: formatDate(game.gameDate) ?? "",
      homeTeamName: game.homeTeam.name,
      awayTeamName: game.awayTeam.name,
      divisionName: game.division?.name ?? null,
      verificationStatus: game.verificationStatus,
    })),
  };
}
