import { AgeGroup, PlayerGender } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

const publicEligibilityMinimumGames = 15;
const leaderboardLimit = 30;

type LeaderboardRow = {
  rank: number;
  playerId: string;
  displayName: string;
  adjustedRating: number;
  observedRating: number;
  verifiedGameCount: number;
  starRating: number;
  publicEligible: boolean;
};

function toLeaderboardRows(
  ratings: Array<{
    playerId: string;
    adjustedRating: unknown;
    observedRating: unknown;
    verifiedGameCount: number;
    starRating: number;
    player: {
      displayName: string;
    };
  }>
): LeaderboardRow[] {
  return ratings.map((rating, index) => ({
    rank: index + 1,
    playerId: rating.playerId,
    displayName: rating.player.displayName,
    adjustedRating: Number(rating.adjustedRating),
    observedRating: Number(rating.observedRating),
    verifiedGameCount: rating.verifiedGameCount,
    starRating: rating.starRating,
    publicEligible: rating.verifiedGameCount >= publicEligibilityMinimumGames
  }));
}

async function loadRatings(gender: PlayerGender) {
  const ratings = await prisma.playerRating.findMany({
    where: {
      ageGroup: AgeGroup.U19,
      player: {
        gender,
        deletedAt: null
      }
    },
    include: {
      player: {
        select: {
          displayName: true
        }
      }
    },
    orderBy: [
      {
        adjustedRating: "desc"
      },
      {
        verifiedGameCount: "desc"
      },
      {
        player: {
          displayName: "asc"
        }
      }
    ]
  });

  return toLeaderboardRows(ratings);
}

async function main() {
  const boys = await loadRatings(PlayerGender.BOYS);
  const girls = await loadRatings(PlayerGender.GIRLS);
  const publicEligibleBoys = boys.filter((row) => row.publicEligible);
  const publicEligibleGirls = girls.filter((row) => row.publicEligible);

  console.log(
    JSON.stringify(
      {
        ageGroup: AgeGroup.U19,
        formulaVersion: "Formula v1 current PlayerRating rows",
        publicEligibilityMinimumGames,
        counts: {
          totalBoysRated: boys.length,
          totalGirlsRated: girls.length,
          boysPublicEligible: publicEligibleBoys.length,
          girlsPublicEligible: publicEligibleGirls.length
        },
        top30Boys: boys.slice(0, leaderboardLimit),
        top30Girls: girls.slice(0, leaderboardLimit),
        topPublicEligibleBoys: publicEligibleBoys.slice(0, leaderboardLimit),
        topPublicEligibleGirls: publicEligibleGirls.slice(0, leaderboardLimit)
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
