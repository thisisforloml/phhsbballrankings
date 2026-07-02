import "server-only";

import { notFound } from "next/navigation";

import { slugify } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { formatClassYear } from "@/lib/ranking-eligibility";
import { resolveProgramIdentity } from "@/lib/uaap-school-display";

function inferGender(...values: Array<string | null | undefined>) {
  return values.filter(Boolean).join(" ").toLowerCase().includes("girls") ? "Girls" : "Boys";
}

function numberValue(value: number | null | undefined) {
  return value ?? 0;
}

function roundOne(value: number) {
  return Number(value.toFixed(1));
}

export async function getPublicTeamProfile(teamId: string) {
  const team = await prisma.team.findFirst({
    where: { id: teamId, deletedAt: null },
    include: { program: true }
  });
  if (!team) notFound();

  const games = await prisma.game.findMany({
    where: {
      deletedAt: null,
      OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }],
      season: { deletedAt: null, league: { deletedAt: null } }
    },
    include: {
      homeTeam: true,
      awayTeam: true,
      season: { include: { league: true } }
    },
    orderBy: [{ gameDate: "desc" }, { gameNumber: "desc" }]
  });

  const stats = await prisma.gameStat.findMany({
    where: {
      deletedAt: null,
      teamId: team.id,
      game: { deletedAt: null }
    },
    include: {
      player: true,
      game: { select: { id: true } }
    }
  });

  let wins = 0;
  let losses = 0;
  let pointsFor = 0;
  let pointsAgainst = 0;
  const recentGames = games.slice(0, 5).map((game) => {
    const isHome = game.homeTeamId === team.id;
    const teamScore = isHome ? game.homeScore : game.awayScore;
    const opponentScore = isHome ? game.awayScore : game.homeScore;
    const opponent = isHome ? game.awayTeam : game.homeTeam;
    if (teamScore > opponentScore) wins += 1;
    else losses += 1;
    return {
      id: game.id,
      gameNumber: game.gameNumber,
      gameDate: game.gameDate,
      verificationStatus: game.verificationStatus,
      seasonName: game.season.name,
      homeScore: game.homeScore,
      awayScore: game.awayScore,
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
      opponentName: opponent.name,
      teamScore,
      opponentScore,
      result: teamScore > opponentScore ? "W" as const : "L" as const
    };
  });

  for (const game of games) {
    const isHome = game.homeTeamId === team.id;
    const teamScore = isHome ? game.homeScore : game.awayScore;
    const opponentScore = isHome ? game.awayScore : game.homeScore;
    pointsFor += teamScore;
    pointsAgainst += opponentScore;
  }
  wins = games.filter((game) => {
    const isHome = game.homeTeamId === team.id;
    return (isHome ? game.homeScore : game.awayScore) > (isHome ? game.awayScore : game.homeScore);
  }).length;
  losses = games.length - wins;

  const playerBuckets = new Map<string, {
    playerId: string;
    displayName: string;
    slug: string;
    position: string | null;
    classYear: string | null;
    heightCm: number | null;
    gameIds: Set<string>;
    points: number;
    rebounds: number;
    assists: number;
  }>();

  for (const stat of stats) {
    const existing = playerBuckets.get(stat.playerId) ?? {
      playerId: stat.playerId,
      displayName: stat.player.displayName,
      slug: slugify(stat.player.displayName),
      position: stat.player.position,
      classYear: stat.player.classYearOverride ? `Class of ${stat.player.classYearOverride}` : formatClassYear(stat.player.birthDate),
      heightCm: stat.player.heightCm,
      gameIds: new Set<string>(),
      points: 0,
      rebounds: 0,
      assists: 0
    };
    existing.gameIds.add(stat.game.id);
    existing.points += numberValue(stat.points);
    existing.rebounds += numberValue(stat.rebounds);
    existing.assists += numberValue(stat.assists);
    playerBuckets.set(stat.playerId, existing);
  }

  const roster = [...playerBuckets.values()]
    .map((player) => {
      const gamesPlayed = player.gameIds.size;
      return {
        playerId: player.playerId,
        displayName: player.displayName,
        slug: player.slug,
        position: player.position,
        classYear: player.classYear,
        heightCm: player.heightCm,
        gamesPlayed,
        ppg: gamesPlayed ? roundOne(player.points / gamesPlayed) : 0,
        rpg: gamesPlayed ? roundOne(player.rebounds / gamesPlayed) : 0,
        apg: gamesPlayed ? roundOne(player.assists / gamesPlayed) : 0
      };
    })
    .sort((left, right) => right.gamesPlayed - left.gamesPlayed || right.ppg - left.ppg || left.displayName.localeCompare(right.displayName));

  const contexts = Array.from(new Map(games.map((game) => [
    `${game.season.league.id}:${game.season.id}`,
    {
      leagueId: game.season.league.id,
      leagueName: game.season.league.name,
      seasonId: game.season.id,
      seasonName: game.season.name,
      ageGroup: game.season.league.ageGroup,
      gender: inferGender(game.season.league.name, team.name)
    }
  ])).values());

  const programIdentity = resolveProgramIdentity(team.name);

  return {
    team: {
      id: team.id,
      name: team.name,
      city: team.city,
      region: team.region,
      programFullName: team.program?.fullName ?? programIdentity.programFullName,
      programAbbreviation: team.program?.abbreviation ?? programIdentity.programAbbreviation,
      programType: team.program?.type ?? programIdentity.programType
    },
    contexts,
    standings: {
      gamesPlayed: games.length,
      wins,
      losses,
      pointsFor,
      pointsAgainst,
      pointDifferential: pointsFor - pointsAgainst,
      winPercentage: games.length ? wins / games.length : 0
    },
    roster,
    recentGames
  };
}

