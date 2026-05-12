import { AgeGroup, PlayerGender, RankingScope } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

const formulaVersionNumber = 1;
const ageGroup = AgeGroup.U19;
const eligibilityRules = {
  U19_BOYS: {
    gender: PlayerGender.BOYS,
    minimumVerifiedGames: 10
  },
  U19_GIRLS: {
    gender: PlayerGender.GIRLS,
    minimumVerifiedGames: 5
  }
} as const;

type EligibleRating = {
  playerId: string;
  displayName: string;
  adjustedRating: number;
  verifiedGameCount: number;
  starRating: number;
  city: string;
  region: string;
};

type SnapshotResult = {
  gender: PlayerGender;
  snapshotId: string | null;
  rowsCreated: number;
  action: "created" | "updated" | "skipped";
  reason?: string;
};

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function toPreviewRow(row: EligibleRating, index: number) {
  return {
    rank: index + 1,
    playerId: row.playerId,
    displayName: row.displayName,
    adjustedRating: row.adjustedRating,
    verifiedGameCount: row.verifiedGameCount,
    starRating: row.starRating
  };
}

async function loadEligibleRatings(gender: PlayerGender, minimumVerifiedGames: number) {
  const ratings = await prisma.playerRating.findMany({
    where: {
      ageGroup,
      verifiedGameCount: {
        gte: minimumVerifiedGames
      },
      player: {
        gender,
        deletedAt: null
      }
    },
    include: {
      player: {
        select: {
          displayName: true,
          city: true,
          region: true
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

  return ratings.map((rating) => ({
    playerId: rating.playerId,
    displayName: rating.player.displayName,
    adjustedRating: Number(rating.adjustedRating),
    verifiedGameCount: rating.verifiedGameCount,
    starRating: rating.starRating,
    city: rating.player.city,
    region: rating.player.region
  }));
}

async function createOrUpdateSnapshotForGender(params: {
  gender: PlayerGender;
  formulaVersionId: string;
  eligibleRatings: EligibleRating[];
  weekOf: Date;
}): Promise<SnapshotResult> {
  if (params.eligibleRatings.length === 0) {
    return {
      gender: params.gender,
      snapshotId: null,
      rowsCreated: 0,
      action: "skipped",
      reason: "No public-eligible players."
    };
  }

  const existingSnapshots = await prisma.rankingSnapshot.findMany({
    where: {
      scope: RankingScope.NATIONAL,
      ageGroup,
      gender: params.gender,
      formulaVersionId: params.formulaVersionId,
      weekOf: params.weekOf,
      city: null,
      region: null
    },
    select: {
      id: true
    }
  });

  if (existingSnapshots.length > 1) {
    throw new Error(
      `Found ${existingSnapshots.length} existing ${params.gender} snapshots for Formula v1 / ${ageGroup} / ${params.weekOf.toISOString()}.`
    );
  }

  const rows = params.eligibleRatings.map((rating, index) => ({
    playerId: rating.playerId,
    rank: index + 1,
    rating: rating.adjustedRating,
    starRating: rating.starRating,
    verifiedGameCount: rating.verifiedGameCount,
    movement: 0
  }));

  if (existingSnapshots.length === 1) {
    const snapshotId = existingSnapshots[0].id;
    const updatedSnapshot = await prisma.$transaction(async (tx) => {
      await tx.rankingSnapshotRow.deleteMany({
        where: {
          snapshotId
        }
      });

      return tx.rankingSnapshot.update({
        where: {
          id: snapshotId
        },
        data: {
          scope: RankingScope.NATIONAL,
          ageGroup,
          gender: params.gender,
          formulaVersionId: params.formulaVersionId,
          city: null,
          region: null,
          weekOf: params.weekOf,
          rows: {
            create: rows
          }
        },
        select: {
          id: true,
          rows: {
            select: {
              id: true
            }
          }
        }
      });
    });

    return {
      gender: params.gender,
      snapshotId: updatedSnapshot.id,
      rowsCreated: updatedSnapshot.rows.length,
      action: "updated"
    };
  }

  const snapshot = await prisma.rankingSnapshot.create({
    data: {
      scope: RankingScope.NATIONAL,
      ageGroup,
      gender: params.gender,
      formulaVersionId: params.formulaVersionId,
      city: null,
      region: null,
      weekOf: params.weekOf,
      rows: {
        create: rows
      }
    },
    select: {
      id: true,
      rows: {
        select: {
          id: true
        }
      }
    }
  });

  return {
    gender: params.gender,
    snapshotId: snapshot.id,
    rowsCreated: snapshot.rows.length,
    action: "created"
  };
}

async function main() {
  const formulaVersion = await prisma.formulaVersion.findUnique({
    where: {
      versionNumber: formulaVersionNumber
    },
    select: {
      id: true
    }
  });

  if (!formulaVersion) {
    throw new Error(`Missing FormulaVersion versionNumber ${formulaVersionNumber}.`);
  }

  const weekOf = startOfUtcDay(new Date());
  const boysEligibleRatings = await loadEligibleRatings(
    eligibilityRules.U19_BOYS.gender,
    eligibilityRules.U19_BOYS.minimumVerifiedGames
  );
  const girlsEligibleRatings = await loadEligibleRatings(
    eligibilityRules.U19_GIRLS.gender,
    eligibilityRules.U19_GIRLS.minimumVerifiedGames
  );

  const boysResult = await createOrUpdateSnapshotForGender({
    gender: PlayerGender.BOYS,
    formulaVersionId: formulaVersion.id,
    eligibleRatings: boysEligibleRatings,
    weekOf
  });
  const girlsResult = await createOrUpdateSnapshotForGender({
    gender: PlayerGender.GIRLS,
    formulaVersionId: formulaVersion.id,
    eligibleRatings: girlsEligibleRatings,
    weekOf
  });

  const results = [boysResult, girlsResult];

  console.log(
    JSON.stringify(
      {
        formulaVersionId: formulaVersion.id,
        ageGroup,
        weekOf: weekOf.toISOString(),
        eligibilityRules: {
          boys: {
            ageGroup,
            gender: PlayerGender.BOYS,
            minimumVerifiedGames: eligibilityRules.U19_BOYS.minimumVerifiedGames
          },
          girls: {
            ageGroup,
            gender: PlayerGender.GIRLS,
            minimumVerifiedGames: eligibilityRules.U19_GIRLS.minimumVerifiedGames
          }
        },
        snapshotsCreated: results
          .filter((result) => result.action === "created")
          .map((result) => ({
            gender: result.gender,
            snapshotId: result.snapshotId,
            rowsCreated: result.rowsCreated,
            action: result.action
          })),
        snapshotsUpdated: results
          .filter((result) => result.action === "updated")
          .map((result) => ({
            gender: result.gender,
            snapshotId: result.snapshotId,
            rowsCreated: result.rowsCreated,
            action: result.action
          })),
        snapshotsSkipped: results
          .filter((result) => result.action === "skipped")
          .map((result) => ({
            gender: result.gender,
            reason: result.reason
          })),
        boysEligibleCount: boysEligibleRatings.length,
        girlsEligibleCount: girlsEligibleRatings.length,
        boysRowsCreated: boysResult.rowsCreated,
        girlsRowsCreated: girlsResult.rowsCreated,
        top10BoysPreview: boysEligibleRatings.slice(0, 10).map(toPreviewRow),
        top10GirlsPreview: girlsEligibleRatings.slice(0, 10).map(toPreviewRow)
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
