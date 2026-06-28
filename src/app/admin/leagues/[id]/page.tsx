import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { requireAdminUser } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { LeagueMetadataForm, LeagueSeasonGames } from "../LeagueDetailClient";

export const metadata = {
  title: "League | Admin",
  description: "League detail, seasons, and games."
};

function formatDate(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "—";
}

export default async function AdminLeagueDetailPage({ params }: { params: { id: string } }) {
  await requireAdminUser();

  const league = await prisma.league.findFirst({
    where: { id: params.id, deletedAt: null },
    include: {
      seasons: {
        where: { deletedAt: null },
        orderBy: { seasonYear: "desc" },
        include: {
          games: {
            where: { deletedAt: null },
            include: {
              homeTeam: { select: { name: true } },
              awayTeam: { select: { name: true } }
            },
            orderBy: { gameDate: "desc" },
            take: 100
          }
        }
      }
    }
  });

  if (!league) notFound();

  const seasons = league.seasons.map((season) => ({
    id: season.id,
    name: season.name,
    seasonYear: season.seasonYear,
    startsOn: formatDate(season.startsOn),
    endsOn: formatDate(season.endsOn),
    games: season.games.map((game) => ({
      id: game.id,
      gameNumber: game.gameNumber ?? "Game",
      gameDate: formatDate(game.gameDate),
      homeTeamName: game.homeTeam.name,
      awayTeamName: game.awayTeam.name,
      homeScore: game.homeScore,
      awayScore: game.awayScore
    }))
  }));

  return (
    <>
      <AdminPageHeader
        backLink={{ href: "/admin/leagues", label: "Leagues" }}
        title={league.name}
        statusBadge={`Tier ${league.tier}`}
      />
      <LeagueMetadataForm league={{ id: league.id, name: league.name, tier: league.tier, logoUrl: league.logoUrl }} />
      <LeagueSeasonGames leagueId={league.id} seasons={seasons} />
    </>
  );
}
