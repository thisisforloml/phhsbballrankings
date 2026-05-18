import { AgeGroup, PlayerGender, RankingScope } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { getClassYear, getMonthStart, isRankingEligibleByClassYear } from "../src/lib/ranking-eligibility";

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
  birthDate: Date | null;
  classYear: number | null;
};

type EligibilityPool = {
  gender: PlayerGender;
  eligibleByGames: EligibleRating[];
  finalEligibleRatings: EligibleRating[];
  excludedByClassYear: EligibleRating[];
  missingBirthDate: EligibleRating[];
};

type SnapshotResult = {
  gender: PlayerGender;
  snapshotId: string | null;
  rowsCreated: number;
  action: "created" | "updated" | "skipped";
  reason?: string;
};

function toPreviewRow(row: EligibleRating, index: number) {
  return {
    rank: index + 1,
    playerId: row.playerId,
    displayName: row.displayName,
    adjustedRating: row.adjustedRating,
    verifiedGameCount: row.verifiedGameCount,
    starRating: row.starRating,
    classYear: row.classYear
  };
}

async function loadEligibilityPool(gender: PlayerGender, minimumVerifiedGames: number, snapshotDate: Date): Promise<EligibilityPool> {
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
          region: true,
          birthDate: true
        }
      }
    },
    orderBy: [
      { adjustedRating: "desc" },
      { verifiedGameCount: "desc" },
      { player: { displayName: "asc" } }
    ]
  });

  const eligibleByGames = ratings.map((rating) => ({
    playerId: rating.playerId,
    displayName: rating.player.displayName,
    adjustedRating: Number(rating.adjustedRating),
    verifiedGameCount: rating.verifiedGameCount,
    starRating: rating.starRating,
    city: rating.player.city,
    region: rating.player.region,
    birthDate: rating.player.birthDate,
    classYear: getClassYear(rating.player.birthDate)
  }));

  const excludedByClassYear = eligibleByGames.filter((rating) => !isRankingEligibleByClassYear(rating.birthDate, snapshotDate));
  const excludedIds = new Set(excludedByClassYear.map((rating) => rating.playerId));
  const finalEligibleRatings = eligibleByGames.filter((rating) => !excludedIds.has(rating.playerId));
  const missingBirthDate = eligibleByGames.filter((rating) => rating.birthDate === null);

  return { gender, eligibleByGames, finalEligibleRatings, excludedByClassYear, missingBirthDate };
}

async function createOrUpdateSnapshotForGender(params: {
  gender: PlayerGender;
  formulaVersionId: string;
  eligibleRatings: EligibleRating[];
  snapshotDate: Date;
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
      weekOf: params.snapshotDate,
      city: null,
      region: null
    },
    select: { id: true }
  });

  if (existingSnapshots.length > 1) {
    throw new Error(`Found ${existingSnapshots.length} existing ${params.gender} snapshots for Formula v1 / ${ageGroup} / ${params.snapshotDate.toISOString()}.`);
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
      await tx.rankingSnapshotRow.deleteMany({ where: { snapshotId } });

      return tx.rankingSnapshot.update({
        where: { id: snapshotId },
        data: {
          scope: RankingScope.NATIONAL,
          ageGroup,
          gender: params.gender,
          formulaVersionId: params.formulaVersionId,
          city: null,
          region: null,
          weekOf: params.snapshotDate,
          rows: { create: rows }
        },
        select: { id: true, rows: { select: { id: true } } }
      });
    });

    return { gender: params.gender, snapshotId: updatedSnapshot.id, rowsCreated: updatedSnapshot.rows.length, action: "updated" };
  }

  const snapshot = await prisma.rankingSnapshot.create({
    data: {
      scope: RankingScope.NATIONAL,
      ageGroup,
      gender: params.gender,
      formulaVersionId: params.formulaVersionId,
      city: null,
      region: null,
      weekOf: params.snapshotDate,
      rows: { create: rows }
    },
    select: { id: true, rows: { select: { id: true } } }
  });

  return { gender: params.gender, snapshotId: snapshot.id, rowsCreated: snapshot.rows.length, action: "created" };
}

function summarizeExcluded(rows: EligibleRating[]) {
  return rows.map((row) => ({
    playerId: row.playerId,
    displayName: row.displayName,
    verifiedGameCount: row.verifiedGameCount,
    classYear: row.classYear
  }));
}

async function main() {
  const formulaVersion = await prisma.formulaVersion.findUnique({
    where: { versionNumber: formulaVersionNumber },
    select: { id: true }
  });

  if (!formulaVersion) throw new Error(`Missing FormulaVersion versionNumber ${formulaVersionNumber}.`);

  const snapshotDate = getMonthStart(new Date());
  const boysPool = await loadEligibilityPool(eligibilityRules.U19_BOYS.gender, eligibilityRules.U19_BOYS.minimumVerifiedGames, snapshotDate);
  const girlsPool = await loadEligibilityPool(eligibilityRules.U19_GIRLS.gender, eligibilityRules.U19_GIRLS.minimumVerifiedGames, snapshotDate);

  const boysResult = await createOrUpdateSnapshotForGender({
    gender: PlayerGender.BOYS,
    formulaVersionId: formulaVersion.id,
    eligibleRatings: boysPool.finalEligibleRatings,
    snapshotDate
  });
  const girlsResult = await createOrUpdateSnapshotForGender({
    gender: PlayerGender.GIRLS,
    formulaVersionId: formulaVersion.id,
    eligibleRatings: girlsPool.finalEligibleRatings,
    snapshotDate
  });

  const results = [boysResult, girlsResult];

  console.log(JSON.stringify({
    formulaVersionId: formulaVersion.id,
    ageGroup,
    snapshotDate: snapshotDate.toISOString(),
    monthStart: snapshotDate.toISOString(),
    eligibilityRules: {
      boys: { ageGroup, gender: PlayerGender.BOYS, minimumVerifiedGames: eligibilityRules.U19_BOYS.minimumVerifiedGames, classYearCutoff: "Eligible through May 31 of class year; excluded starting June 1." },
      girls: { ageGroup, gender: PlayerGender.GIRLS, minimumVerifiedGames: eligibilityRules.U19_GIRLS.minimumVerifiedGames, classYearCutoff: "Eligible through May 31 of class year; excluded starting June 1." }
    },
    snapshotsCreated: results.filter((result) => result.action === "created").map((result) => ({ gender: result.gender, snapshotId: result.snapshotId, rowsCreated: result.rowsCreated, action: result.action })),
    snapshotsUpdated: results.filter((result) => result.action === "updated").map((result) => ({ gender: result.gender, snapshotId: result.snapshotId, rowsCreated: result.rowsCreated, action: result.action })),
    snapshotsSkipped: results.filter((result) => result.action === "skipped").map((result) => ({ gender: result.gender, reason: result.reason })),
    boysEligibleByGames: boysPool.eligibleByGames.length,
    girlsEligibleByGames: girlsPool.eligibleByGames.length,
    boysExcludedByClassYear: boysPool.excludedByClassYear.length,
    girlsExcludedByClassYear: girlsPool.excludedByClassYear.length,
    boysMissingBirthDate: boysPool.missingBirthDate.length,
    girlsMissingBirthDate: girlsPool.missingBirthDate.length,
    boysRowsCreated: boysResult.rowsCreated,
    girlsRowsCreated: girlsResult.rowsCreated,
    boysExcludedByClassYearPreview: summarizeExcluded(boysPool.excludedByClassYear),
    girlsExcludedByClassYearPreview: summarizeExcluded(girlsPool.excludedByClassYear),
    top10BoysPreview: boysPool.finalEligibleRatings.slice(0, 10).map(toPreviewRow),
    top10GirlsPreview: girlsPool.finalEligibleRatings.slice(0, 10).map(toPreviewRow)
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
