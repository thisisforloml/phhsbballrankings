import { AgeGroup, PlayerGender } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { invalidateAdminEvidenceCaches } from "@/lib/admin/invalidate-admin-caches";
import { revalidatePublicRankingSurfaces } from "@/lib/public-cache-revalidation";
import {
  type NationalRankingBoard,
  regenerateNationalRankingSnapshots
} from "@/lib/rankings/national-snapshot-regeneration";
import { getActivePlayerFormulaConfig, getActivePolicyVersionId } from "@/lib/ratings/active-formula";
import { recomputeFormulaV33Ratings } from "@/lib/ratings/recompute-formula-v33";
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
  const activeFormula = getActivePlayerFormulaConfig();
  let playerRatings: { created: number; updated: number; totalPlayersProcessed: number };
  let homeBoard: { created: number; updated: number; skippedExisting: number; limboCount: number };

  if (activeFormula.mode === "production-v3") {
    const v3 = await recomputeFormulaV33Ratings({ execute: true });
    playerRatings = {
      created: 0,
      updated: v3.playerRatings,
      totalPlayersProcessed: v3.playerRatings
    };
    homeBoard = { created: 0, updated: 0, skippedExisting: 0, limboCount: 0 };
  } else {
    const v1 = await recomputeTierNormalizedV1Ratings({ execute: true });
    const projected = await projectHomeBoardTierNormalizedRatings({ execute: true });
    playerRatings = {
      created: v1.created ?? 0,
      updated: v1.updated ?? 0,
      totalPlayersProcessed: v1.targets.length
    };
    homeBoard = {
      created: projected.created ?? 0,
      updated: projected.updated ?? 0,
      skippedExisting: projected.skippedExisting,
      limboCount: projected.limboCount
    };
  }

  // Public team standings retain their existing formula. Formula v3.3 uses its
  // in-memory Team TPI only as player-strength context.
  const teamRatings = await computeProgramTeamRatings(options.teamRatingScope ?? {});

  let snapshots: Awaited<ReturnType<typeof regenerateNationalRankingSnapshots>> | null = null;
  if (options.allSnapshots) {
    snapshots = await regenerateNationalRankingSnapshots();
  } else if (options.snapshotBoards?.length) {
    snapshots = await regenerateNationalRankingSnapshots({ boards: options.snapshotBoards });
  }

  if (options.revalidatePublicPaths !== false) {
    revalidatePublicRankingSurfaces();
    invalidateAdminEvidenceCaches();
    revalidatePath("/admin/players");
    revalidatePath("/admin/team-ratings");
  }

  return {
    policyVersionId: getActivePolicyVersionId(),
    playerRatings,
    homeBoard,
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
