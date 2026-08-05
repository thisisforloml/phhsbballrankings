import { AgeGroup, PlayerGender, RankingScope } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getMonthStart } from "@/lib/ranking-eligibility";
import { getActivePlayerFormulaConfig } from "@/lib/ratings/active-formula";
import { buildSnapshotBoardRows } from "@/lib/snapshot-board-rows";

export const NATIONAL_RANKING_BOARDS = [
  { ageGroup: AgeGroup.U13, gender: PlayerGender.BOYS },
  { ageGroup: AgeGroup.U13, gender: PlayerGender.GIRLS },
  { ageGroup: AgeGroup.U16, gender: PlayerGender.BOYS },
  { ageGroup: AgeGroup.U16, gender: PlayerGender.GIRLS },
  { ageGroup: AgeGroup.U19, gender: PlayerGender.BOYS },
  { ageGroup: AgeGroup.U19, gender: PlayerGender.GIRLS }
] as const;

export type NationalRankingBoard = (typeof NATIONAL_RANKING_BOARDS)[number];

export type UpsertNationalSnapshotResult = {
  ageGroup: AgeGroup;
  gender: PlayerGender;
  action: "created" | "updated" | "skipped";
  snapshotId: string | null;
  rowsCreated: number;
};

async function upsertNationalRankingSnapshot(params: {
  ageGroup: AgeGroup;
  gender: PlayerGender;
  formulaVersionId: string;
  policyVersionId: string;
  snapshotDate: Date;
  evaluationDate: Date;
}): Promise<UpsertNationalSnapshotResult> {
  const built = await buildSnapshotBoardRows({
    ageGroup: params.ageGroup,
    gender: params.gender,
    evaluationDate: params.evaluationDate,
    formulaVersionId: params.formulaVersionId,
    policyVersionId: params.policyVersionId
  });

  const existing = await prisma.rankingSnapshot.findMany({
    where: {
      scope: RankingScope.NATIONAL,
      ageGroup: params.ageGroup,
      gender: params.gender,
      formulaVersionId: params.formulaVersionId,
      policyVersionId: params.policyVersionId,
      weekOf: params.snapshotDate,
      city: null,
      region: null
    },
    select: { id: true }
  });

  if (existing.length > 1) {
    throw new Error(
      `Multiple snapshots for ${params.ageGroup} ${params.gender} at ${params.snapshotDate.toISOString()}.`
    );
  }

  const rows = built.rows.map((row) => ({
    playerId: row.playerId,
    rank: row.rank,
    rating: row.rating,
    starRating: row.starRating,
    verifiedGameCount: row.verifiedGameCount,
    movement: row.movement,
    ageVerificationStatus: row.ageVerificationStatus
  }));

  if (!rows.length) {
    return {
      ageGroup: params.ageGroup,
      gender: params.gender,
      action: "skipped",
      snapshotId: null,
      rowsCreated: 0
    };
  }

  if (existing.length === 1) {
    const snapshotId = existing[0].id;
    await prisma.$transaction(async (tx) => {
      await tx.rankingSnapshotRow.deleteMany({ where: { snapshotId } });
      await tx.rankingSnapshot.update({
        where: { id: snapshotId },
        data: { rows: { create: rows } }
      });
    });
    return {
      ageGroup: params.ageGroup,
      gender: params.gender,
      action: "updated",
      snapshotId,
      rowsCreated: rows.length
    };
  }

  const snapshot = await prisma.rankingSnapshot.create({
    data: {
      scope: RankingScope.NATIONAL,
      ageGroup: params.ageGroup,
      gender: params.gender,
      formulaVersionId: params.formulaVersionId,
      policyVersionId: params.policyVersionId,
      weekOf: params.snapshotDate,
      city: null,
      region: null,
      rows: { create: rows }
    },
    select: { id: true }
  });

  return {
    ageGroup: params.ageGroup,
    gender: params.gender,
    action: "created",
    snapshotId: snapshot.id,
    rowsCreated: rows.length
  };
}

export async function regenerateNationalRankingSnapshots(options: {
  boards?: NationalRankingBoard[];
  /** Snapshot identity (`weekOf`). Defaults to current month start. */
  snapshotDate?: Date;
  /** Eligibility evaluation date for row membership. Defaults to now so refreshed snapshots match the live public board. */
  evaluationDate?: Date;
  formulaVersionNumber?: number;
  policyVersionId?: string;
} = {}) {
  const activeFormula = getActivePlayerFormulaConfig();
  const formulaVersionNumber = options.formulaVersionNumber ?? activeFormula.formulaVersionNumber;
  const policyVersionId = options.policyVersionId ?? activeFormula.policyVersionId;
  const formulaVersion = await prisma.formulaVersion.findUnique({
    where: { versionNumber: formulaVersionNumber },
    select: { id: true }
  });
  if (!formulaVersion) throw new Error("Formula version row not found: " + formulaVersionNumber);

  const snapshotDate = options.snapshotDate ?? getMonthStart(new Date());
  const evaluationDate = options.evaluationDate ?? new Date();
  const boards = options.boards ?? NATIONAL_RANKING_BOARDS;
  const results: UpsertNationalSnapshotResult[] = [];

  for (const board of boards) {
    results.push(
      await upsertNationalRankingSnapshot({
        ...board,
        formulaVersionId: formulaVersion.id,
        policyVersionId,
        snapshotDate,
        evaluationDate
      })
    );
  }

  return {
    formulaVersionId: formulaVersion.id,
    snapshotDate: snapshotDate.toISOString(),
    evaluationDate: evaluationDate.toISOString(),
    results
  };
}
