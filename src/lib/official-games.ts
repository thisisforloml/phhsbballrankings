import "server-only";

import { notFound } from "next/navigation";

import { normalizeCompetitionDisplayName } from "@/lib/competition-naming";
import { prisma } from "@/lib/prisma";

import { slugify } from "./format";

function inferGender(...values: Array<string | null | undefined>) {
  return values.filter(Boolean).join(" ").toLowerCase().includes("girls") ? "Girls" : "Boys";
}

export async function getOfficialLeagueDetail(id: string) {
  const leagues = await prisma.league.findMany({
    where: { deletedAt: null },
    include: {
      seasons: {
        where: { deletedAt: null },
        include: {
          games: {
            where: { deletedAt: null },
            include: { homeTeam: true, awayTeam: true },
            orderBy: [{ gameDate: "desc" }, { gameNumber: "desc" }]
          }
        },
        orderBy: { seasonYear: "desc" }
      }
    },
    orderBy: { name: "asc" }
  });
  const requestedLeague = leagues.find((league) => league.id === id) ?? null;
  const groupedMatch = id.match(/^competition-(.+)-(u13|u16|u19)$/i);
  const targetDisplayName = requestedLeague ? normalizeCompetitionDisplayName(requestedLeague.name) || requestedLeague.name : null;
  const targetAgeGroup = requestedLeague?.ageGroup ?? null;
  const matchingLeagues = requestedLeague
    ? leagues.filter((league) => (normalizeCompetitionDisplayName(league.name) || league.name) === targetDisplayName && league.ageGroup === targetAgeGroup)
    : groupedMatch
      ? leagues.filter((league) => {
          const displayName = normalizeCompetitionDisplayName(league.name) || league.name;
          return slugify(displayName) === groupedMatch[1] && String(league.ageGroup).toLowerCase() === groupedMatch[2].toLowerCase();
        })
      : [];

  const primary = requestedLeague ?? matchingLeagues[0] ?? null;
  if (!primary) notFound();

  const displayName = normalizeCompetitionDisplayName(primary.name) || primary.name;
  return {
    ...primary,
    id: matchingLeagues.length > 1 || displayName !== primary.name ? `competition-${slugify(displayName)}-${String(primary.ageGroup).toLowerCase()}` : primary.id,
    name: displayName,
    seasons: matchingLeagues.flatMap((league) => league.seasons)
  };
}

export async function getOfficialGameDetail(id: string) {
  const game = await prisma.game.findFirst({
    where: { id, deletedAt: null },
    include: {
      homeTeam: true,
      awayTeam: true,
      season: { include: { league: true } },
      stats: {
        where: { deletedAt: null },
        include: { player: true, team: true },
        orderBy: [{ team: { name: "asc" } }, { player: { displayName: "asc" } }]
      }
    }
  });
  if (!game) notFound();
  return { ...game, gender: inferGender(game.season.league.name, game.homeTeam.name, game.awayTeam.name) };
}

export async function getLeagueTopPerformers(leagueId: string, limit = 8) {
  const league = await getOfficialLeagueDetail(leagueId);
  const gameIds = league.seasons.flatMap((season) => season.games.map((game) => game.id));
  if (!gameIds.length) return [];

  const stats = await prisma.gameStat.findMany({
    where: { deletedAt: null, gameId: { in: gameIds } },
    select: {
      playerId: true,
      points: true,
      player: { select: { displayName: true, position: true } }
    }
  });

  const totals = new Map<string, { slug: string; displayName: string; position: string | null; points: number; games: number }>();
  for (const stat of stats) {
    const current = totals.get(stat.playerId) ?? {
      slug: slugify(stat.player.displayName),
      displayName: stat.player.displayName,
      position: stat.player.position,
      points: 0,
      games: 0
    };
    current.points += stat.points ?? 0;
    current.games += 1;
    totals.set(stat.playerId, current);
  }

  return [...totals.values()]
    .map((row) => ({ ...row, ppg: row.games ? Number((row.points / row.games).toFixed(1)) : 0 }))
    .sort((left, right) => right.ppg - left.ppg || right.points - left.points)
    .slice(0, limit);
}
