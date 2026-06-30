/**
 * Verify optimized ranking board output matches prior loading strategy.
 * Usage: npx tsx scripts/verify-rankings-output.ts
 */
import assert from "node:assert/strict";
import { AgeGroup, PlayerGender } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { resolveActivePlayerRatingFilter } from "../src/lib/ratings/player-rating-query";
import {
  affiliationGameStatsFromBoardStats,
  buildParticipationMapFromBoardStats,
  loadRankingBoardGameStatsByPlayerIds,
  primaryCompetitionFromSummary,
} from "../src/lib/player-competition-context";
import { resolvePrimaryRankingAffiliation } from "../src/lib/player-display-affiliation";

const playerSelect = {
  id: true,
  displayName: true,
  city: true,
  region: true,
  position: true,
  heightCm: true,
  birthDate: true,
  firstRankingEligibilityAt: true,
  classYearOverride: true,
  photoUrl: true,
  gender: true,
  schoolOverride: true,
  ageGroupOverride: true,
  currentProgram: { select: { fullName: true, abbreviation: true, type: true } },
} as const;

const legacyNestedSelect = {
  ...playerSelect,
  gameStats: {
    where: { deletedAt: null },
    include: {
      team: { include: { program: { select: { fullName: true, abbreviation: true, type: true } } } },
      game: { select: { gameDate: true } },
    },
    orderBy: { game: { gameDate: "desc" } },
    take: 40,
  },
} as const;

function rowSignature(input: {
  playerId: string;
  displayName: string;
  currentTeam: string;
  rating: number;
  starRating: number;
  primaryCompetition: string | null;
  rank: number;
}) {
  return JSON.stringify(input);
}

async function legacyRows(gender: PlayerGender, ageGroup: AgeGroup, formulaVersionId: string, policyVersionId: string) {
  const ratings = await prisma.playerRating.findMany({
    where: {
      ageGroup,
      formulaVersionId,
      policyVersionId,
      player: { gender, deletedAt: null },
    },
    include: { player: { select: legacyNestedSelect } },
    orderBy: [{ adjustedRating: "desc" }, { verifiedGameCount: "desc" }, { player: { displayName: "asc" } }],
  });

  const participation = await (async () => {
    const { loadCompetitionParticipationByPlayerIds } = await import("../src/lib/player-competition-context");
    return loadCompetitionParticipationByPlayerIds(ratings.map((r) => r.playerId));
  })();

  return ratings.map((rating, index) => {
    const primary = primaryCompetitionFromSummary(
      participation.get(rating.playerId) ?? {
        primary: null,
        totalVerifiedGames: 0,
        competitionCount: 0,
        competitions: [],
      }
    );
    return rowSignature({
      rank: index + 1,
      playerId: rating.playerId,
      displayName: rating.player.displayName,
      currentTeam: resolvePrimaryRankingAffiliation({
        schoolOverride: rating.player.schoolOverride,
        currentProgram: rating.player.currentProgram,
        gameStats: rating.player.gameStats,
      }),
      rating: Number(rating.adjustedRating),
      starRating: rating.starRating,
      primaryCompetition: primary?.shortName ?? null,
    });
  });
}

async function optimizedRows(
  gender: PlayerGender,
  ageGroup: AgeGroup,
  formulaVersionId: string,
  policyVersionId: string
) {
  const ratings = await prisma.playerRating.findMany({
    where: {
      ageGroup,
      formulaVersionId,
      policyVersionId,
      player: { gender, deletedAt: null },
    },
    include: { player: { select: playerSelect } },
    orderBy: [{ adjustedRating: "desc" }, { verifiedGameCount: "desc" }, { player: { displayName: "asc" } }],
  });

  const playerIds = ratings.map((r) => r.playerId);
  const statsByPlayer = await loadRankingBoardGameStatsByPlayerIds(playerIds);
  const participation = buildParticipationMapFromBoardStats(playerIds, statsByPlayer);

  return ratings.map((rating, index) => {
    const boardStats = statsByPlayer.get(rating.playerId) ?? [];
    const primary = primaryCompetitionFromSummary(
      participation.get(rating.playerId) ?? {
        primary: null,
        totalVerifiedGames: 0,
        competitionCount: 0,
        competitions: [],
      }
    );
    return rowSignature({
      rank: index + 1,
      playerId: rating.playerId,
      displayName: rating.player.displayName,
      currentTeam: resolvePrimaryRankingAffiliation({
        schoolOverride: rating.player.schoolOverride,
        currentProgram: rating.player.currentProgram,
        gameStats: affiliationGameStatsFromBoardStats(boardStats),
      }),
      rating: Number(rating.adjustedRating),
      starRating: rating.starRating,
      primaryCompetition: primary?.shortName ?? null,
    });
  });
}

async function main() {
  const filter = await resolveActivePlayerRatingFilter();
  if (!filter.formulaVersionId) throw new Error("Missing formulaVersionId");

  for (const ageGroup of [AgeGroup.U13, AgeGroup.U16, AgeGroup.U19] as const) {
    for (const gender of [PlayerGender.BOYS, PlayerGender.GIRLS] as const) {
      const legacy = await legacyRows(gender, ageGroup, filter.formulaVersionId, filter.policyVersionId);
      const optimized = await optimizedRows(gender, ageGroup, filter.formulaVersionId, filter.policyVersionId);
      assert.deepEqual(optimized, legacy, `${ageGroup}/${gender} mismatch`);
      console.log(`OK ${ageGroup}/${gender} (${legacy.length} rows)`);
    }
  }

  console.log("All ranking boards identical.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
