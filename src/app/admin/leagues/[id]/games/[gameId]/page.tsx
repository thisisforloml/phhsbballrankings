import { notFound } from "next/navigation";

import { LeagueGameAdminClient } from "@/app/admin/leagues/LeagueGameAdminClient";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { requireAdminUser } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Game | Admin",
  description: "Review and edit official game evidence."
};

export default async function AdminLeagueGamePage({
  params
}: {
  params: { id: string; gameId: string };
}) {
  const [, game] = await Promise.all([
    requireAdminUser(),
    prisma.game.findFirst({
    where: {
      id: params.gameId,
      deletedAt: null,
      season: { leagueId: params.id, deletedAt: null, league: { deletedAt: null } }
    },
    include: {
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
      stats: {
        where: { deletedAt: null },
        include: {
          player: { select: { displayName: true } },
          team: { select: { name: true } }
        },
        orderBy: { points: "desc" }
      }
    }
    }),
  ]);

  if (!game) notFound();

  const audits = await prisma.gameEditAudit.findMany({
    where: { gameId: game.id },
    include: { editedBy: { select: { name: true, username: true } } },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  return (
    <>
      <AdminPageHeader title="Game evidence" />
      <LeagueGameAdminClient
        leagueId={params.id}
        game={{
          id: game.id,
          gameNumber: game.gameNumber ?? "Game",
          gameDate: game.gameDate.toISOString().slice(0, 10),
          homeTeamName: game.homeTeam.name,
          awayTeamName: game.awayTeam.name,
          homeScore: game.homeScore,
          awayScore: game.awayScore
        }}
        stats={game.stats.map((row) => ({
          id: row.id,
          playerName: row.player.displayName,
          teamName: row.team.name,
          points: row.points,
          rebounds: row.rebounds,
          assists: row.assists
        }))}
        audits={audits.map((row) => ({
          id: row.id,
          entityType: row.entityType,
          fieldName: row.fieldName,
          oldValue: row.oldValue,
          newValue: row.newValue,
          reason: row.reason,
          createdAt: row.createdAt.toISOString().slice(0, 16).replace("T", " "),
          editorName: row.editedBy.name || row.editedBy.username
        }))}
      />
    </>
  );
}
