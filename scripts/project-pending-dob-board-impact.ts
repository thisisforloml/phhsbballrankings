/**
 * Project public board impact after PENDING DOB policy.
 * Usage: npx tsx scripts/project-pending-dob-board-impact.ts
 */
import { AgeGroup, PlayerGender } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { buildEligibilityInput, evaluateEligibility, isPublicBoardVisible } from "../src/lib/eligibility";

const boards: Array<{ ageGroup: AgeGroup; gender: PlayerGender }> = [
  { ageGroup: AgeGroup.U19, gender: PlayerGender.BOYS },
  { ageGroup: AgeGroup.U19, gender: PlayerGender.GIRLS },
  { ageGroup: AgeGroup.U16, gender: PlayerGender.BOYS },
  { ageGroup: AgeGroup.U13, gender: PlayerGender.BOYS }
];

async function main() {
  const formulaVersion = await prisma.formulaVersion.findUnique({ where: { versionNumber: 1 }, select: { id: true } });

  const results = [];
  for (const board of boards) {
    const ratings = await prisma.playerRating.findMany({
      where: { ageGroup: board.ageGroup, player: { gender: board.gender, deletedAt: null } },
      include: {
        player: {
          select: {
            id: true,
            gender: true,
            birthDate: true,
            firstRankingEligibilityAt: true,
            classYearOverride: true,
            ageGroupOverride: true
          }
        }
      }
    });

    let rankedVerified = 0;
    let pendingVisible = 0;
    let snapshotEligible = 0;

    for (const rating of ratings) {
      const verdict = evaluateEligibility(
        buildEligibilityInput({
          playerId: rating.playerId,
          gender: rating.player.gender,
          birthDate: rating.player.birthDate,
          firstRankingEligibilityAt: rating.player.firstRankingEligibilityAt,
          classYearOverride: rating.player.classYearOverride,
          ageGroupOverride: rating.player.ageGroupOverride,
          ratingAgeGroup: rating.ageGroup as "U13" | "U16" | "U19",
          verifiedGameCount: rating.verifiedGameCount,
          evaluatedBoard: board.ageGroup as "U13" | "U16" | "U19",
          formulaVersionId: formulaVersion?.id ?? null
        })
      );

      if (verdict.verdict === "RANKED" && verdict.publicRankAllowed) rankedVerified += 1;
      if (verdict.ageVerificationStatus === "PENDING" && isPublicBoardVisible(verdict)) pendingVisible += 1;
      if (verdict.snapshotEligible) snapshotEligible += 1;
    }

    results.push({
      board: `${board.ageGroup} ${board.gender === PlayerGender.GIRLS ? "Girls" : "Boys"}`,
      pool: ratings.length,
      rankedVerified,
      pendingVisible,
      totalPublic: rankedVerified + pendingVisible,
      snapshotEligible
    });
  }

  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
