import "server-only";

import { notFound } from "next/navigation";

import { slugify } from "@/lib/format";
import { getActivePolicyVersionId } from "@/lib/ratings/active-formula";

import { prisma } from "./prisma";
import { getPublicBoardRows } from "./public-board-ranks";
import { getLatestNationalRankings } from "./rankings";

export async function getPublicProgramHub(programId: string) {
  const program = await prisma.program.findFirst({
    where: { id: programId, deletedAt: null },
    include: {
      teams: {
        where: { deletedAt: null },
        orderBy: { name: "asc" },
        take: 12
      }
    }
  });

  if (!program) notFound();

  const rankings = await getLatestNationalRankings();
  const boardRows = [
    ...getPublicBoardRows(rankings.snapshots.boys),
    ...getPublicBoardRows(rankings.snapshots.girls)
  ];

  const players = await prisma.player.findMany({
    where: { currentProgramId: program.id, deletedAt: null },
    select: {
      id: true,
      displayName: true,
      position: true,
      currentRatings: {
        where: {
          ageGroup: "U19",
          policyVersionId: getActivePolicyVersionId()
        },
        take: 1,
        select: { adjustedRating: true, verifiedGameCount: true }
      }
    },
    take: 20
  });

  const topPlayers = players
    .map((player) => {
      const board = boardRows.find((row) => row.playerId === player.id);
      const rating = player.currentRatings[0];
      return {
        playerId: player.id,
        slug: slugify(player.displayName),
        displayName: player.displayName,
        position: player.position,
        rating: rating ? Number(rating.adjustedRating) : board?.rating ?? 0,
        nationalRank: board ? boardRows.findIndex((row) => row.playerId === player.id) + 1 : null,
        verifiedGameCount: rating?.verifiedGameCount ?? board?.verifiedGameCount ?? 0
      };
    })
    .filter((player) => player.rating > 0)
    .sort((left, right) => right.rating - left.rating)
    .slice(0, 10);

  return {
    program,
    teams: program.teams,
    topPlayers
  };
}
