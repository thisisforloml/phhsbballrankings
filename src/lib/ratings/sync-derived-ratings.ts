import { AgeGroup, PlayerGender } from "@prisma/client";
import { revalidatePath } from "next/cache";
import {
  regenerateNationalRankingSnapshots,
  type NationalRankingBoard
} from "@/lib/rankings/national-snapshot-regeneration";
import { getActivePolicyVersionId } from "@/lib/ratings/active-formula";
import {
  projectHomeBoardTierNormalizedRatings,
  recomputeTierNormalizedV1Ratings
} from "@/lib/ratings/tier-normalized-v1";
import { computeProgramTeamRatings } from "@/lib/team-ratings/compute-program-team-ratings";

export type SyncDerivedRatingsOptions = {
  snapshotBoards?: NationalRankingBoard[];
  allSnapshots?: boolean;
  teamRatingScope?: { ageGroup?: AgeGroup; gender?: PlayerGender };
  revalidatePublicPaths?: boolean;
};

export async function syncDerivedRatingsAfterEvidenceChange(options: SyncDerivedRatingsOptions = {}) {
  const playerRatings = await recomputeTierNormalizedV1Ratings({ execute: true });
  const homeBoard = await projectHomeBoardTierNormalizedRatings({ execute: true });
  const teamRatings = await computeProgramTeamRatings(options.teamRatingScope ?? {});

  let snapshots: Awaited<ReturnType<typeof regenerateNationalRankingSnapshots>> | null = null;
  if (options.allSnapshots) {
    snapshots = await regenerateNationalRankingSnapshots();
  } else if (options.snapshotBoards?.length) {
    snapshots = await regenerateNationalRankingSnapshots({ boards: options.snapshotBoards });
  }

  if (options.revalidatePublicPaths !== false) {
    revalidatePath("/rankings");
    revalidatePath("/teams");
    revalidatePath("/search");
    revalidatePath("/admin/players");
    revalidatePath("/admin/team-ratings");
  }

  return {
    policyVersionId: getActivePolicyVersionId(),
    playerRatings: {
      created: playerRatings.created,
      updated: playerRatings.updated,
      totalPlayersProcessed: playerRatings.targets.length
    },
    homeBoard: {
      created: homeBoard.created,
      updated: homeBoard.updated,
      skippedExisting: homeBoard.skippedExisting,
      limboCount: homeBoard.limboCount
    },
    teamRatings: {
      upserted: teamRatings.upserted,
      deleted: teamRatings.deleted,
      totalRows: teamRatings.totalRows
    },
    snapshots
  };
}

export async function syncDerivedRatingsForSubmissionBoard(input: {
  ageGroup: AgeGroup;
  gender: PlayerGender;
}) {
  return syncDerivedRatingsAfterEvidenceChange({
    snapshotBoards: [{ ageGroup: input.ageGroup, gender: input.gender }],
    teamRatingScope: { ageGroup: input.ageGroup, gender: input.gender }
  });
}
