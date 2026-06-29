import { ProgramType } from "@prisma/client";
import { Suspense } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { requireAdminUser } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { getAgeBracketAsOfMarch31, getClassYear } from "@/lib/ranking-eligibility";
import { resolveAdminPlayerStats } from "@/lib/admin/resolve-admin-player-stats";
import { resolvePrimaryRankingAffiliation } from "@/lib/player-display-affiliation";
import { PlayerManagementClient, type ManagedPlayer } from "./PlayerManagementClient";

export const metadata = {
  title: "Players | Admin",
  description: "Edit player profiles."
};

export default async function AdminPlayersPage() {
  await requireAdminUser();

  const [players, programs] = await Promise.all([
    prisma.player.findMany({
    where: {
      deletedAt: null
    },
    include: {
      currentProgram: true,
      currentRatings: {
        orderBy: { ageGroup: "desc" },
      },
      gameStats: {
        where: { deletedAt: null },
        include: {
          team: { select: { name: true, program: { select: { fullName: true, abbreviation: true, type: true } } } },
          game: { select: { id: true, gameDate: true } },
        },
        orderBy: { game: { gameDate: "desc" } },
        take: 40
      }
    },
    orderBy: {
      displayName: "asc"
    }
  }),
    prisma.program.findMany({
      where: { deletedAt: null, type: ProgramType.SCHOOL },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" }
    })
  ]);

  const serializedPlayers: ManagedPlayer[] = players.map((player) => {
    const computedAgeBracket = getAgeBracketAsOfMarch31(player.birthDate);
    const { rating, verifiedGameCount } = resolveAdminPlayerStats(player);
    const schoolDisplay = resolvePrimaryRankingAffiliation({
      schoolOverride: player.schoolOverride,
      currentProgram: player.currentProgram,
      gameStats: player.gameStats
    });

    return {
      id: player.id,
      displayName: player.displayName,
      firstName: player.firstName,
      lastName: player.lastName,
      gender: player.gender,
      school: schoolDisplay,
      schoolOverride: player.schoolOverride,
      computedAgeBracket,
      ageGroupOverride: player.ageGroupOverride,
      displayAgeBracket: player.ageGroupOverride || computedAgeBracket || "Unknown",
      hometown: player.hometown ?? player.city,
      region: player.region,
      currentProgramId: player.currentProgramId,
      position: player.position,
      heightCm: player.heightCm,
      birthDate: player.birthDate ? player.birthDate.toISOString().slice(0, 10) : "",
      calculatedClassYear: getClassYear(player.birthDate),
      classYearOverride: player.classYearOverride,
      photoUrl: player.photoUrl,
      rating,
      verifiedGameCount,
      commitmentStatus: player.commitmentStatus ?? "UNDECLARED",
      committedUniversity: player.committedUniversity ?? null,
    };
  });

  return (
    <>
      <AdminPageHeader title="Players" statusBadge={`${serializedPlayers.length} records`} />
      <Suspense fallback={null}>
        <PlayerManagementClient players={serializedPlayers} programs={programs} />
      </Suspense>
    </>
  );
}
