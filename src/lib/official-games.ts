import "server-only";

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

function inferGender(...values: Array<string | null | undefined>) {
  return values.filter(Boolean).join(" ").toLowerCase().includes("girls") ? "Girls" : "Boys";
}

export async function getOfficialLeagueDetail(id: string) {
  const league = await prisma.league.findFirst({
    where: { id, deletedAt: null },
    include: {
      seasons: {
        where: { deletedAt: null },
        include: {
          games: {
            where: { deletedAt: null },
            include: { homeTeam: true, awayTeam: true },
            orderBy: [{ gameDate: "asc" }, { gameNumber: "asc" }]
          }
        },
        orderBy: { seasonYear: "desc" }
      }
    }
  });
  if (!league) notFound();
  return league;
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
