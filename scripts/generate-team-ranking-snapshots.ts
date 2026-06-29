/**
 * TR-7: Generate team ranking snapshots (DRAFT → optional PUBLISHED).
 * Usage: npx tsx scripts/generate-team-ranking-snapshots.ts [--publish]
 * Requires TEAM_SNAPSHOT_PUBLISH_ENABLED=true for writes.
 */
import { AgeGroup, PlayerGender, TeamRankingSnapshotStatus } from "@prisma/client";
import { buildTeamSnapshotBoardRows } from "../src/lib/team-ratings/build-team-snapshot-board-rows";
import { TEAM_SNAPSHOT_PUBLISH_ENABLED } from "../src/lib/team-ratings/feature-flags";
import { assertTeamSnapshotMutable } from "../src/lib/team-ratings/snapshot-immutability";
import { TEAM_EVIDENCE_POLICY_V1, TEAM_FORMULA_SLUG_V1, TEAM_THRESHOLD_POLICY_V1 } from "../src/lib/team-ratings/constants";
import { prisma } from "../src/lib/prisma";
import { getMonthStart } from "../src/lib/ranking-eligibility";

const boards: Array<{ ageGroup: AgeGroup; gender: PlayerGender }> = [
  { ageGroup: AgeGroup.U13, gender: PlayerGender.BOYS },
  { ageGroup: AgeGroup.U16, gender: PlayerGender.BOYS },
  { ageGroup: AgeGroup.U19, gender: PlayerGender.BOYS },
  { ageGroup: AgeGroup.U19, gender: PlayerGender.GIRLS }
];

async function main() {
  const publish = process.argv.includes("--publish");

  if (!TEAM_SNAPSHOT_PUBLISH_ENABLED) {
    console.log(JSON.stringify({ status: "SKIPPED", reason: "TEAM_SNAPSHOT_PUBLISH_ENABLED=false" }, null, 2));
    return;
  }

  const formulaVersion = await prisma.teamFormulaVersion.findUnique({
    where: { slug: TEAM_FORMULA_SLUG_V1 }
  });
  if (!formulaVersion) throw new Error(`Missing ${TEAM_FORMULA_SLUG_V1}`);

  const weekOf = getMonthStart(new Date());
  const evaluationDate = new Date();
  const results = [];

  for (const board of boards) {
    const built = await buildTeamSnapshotBoardRows({
      ageGroup: board.ageGroup,
      gender: board.gender,
      evaluationDate,
      teamFormulaVersionId: formulaVersion.id,
      evidencePolicyVersion: TEAM_EVIDENCE_POLICY_V1,
      thresholdPolicyVersion: TEAM_THRESHOLD_POLICY_V1
    });

    if (built.rows.length === 0) {
      results.push({ board: `${board.ageGroup}:${board.gender}`, action: "skipped", reason: "no eligible rows" });
      continue;
    }

    const existing = await prisma.teamRankingSnapshot.findFirst({
      where: {
        ageGroup: board.ageGroup,
        gender: board.gender,
        weekOf,
        teamFormulaVersionId: formulaVersion.id,
        evidencePolicyVersion: TEAM_EVIDENCE_POLICY_V1,
        thresholdPolicyVersion: TEAM_THRESHOLD_POLICY_V1
      }
    });

    if (existing?.status === TeamRankingSnapshotStatus.PUBLISHED) {
      results.push({ board: `${board.ageGroup}:${board.gender}`, action: "skipped", reason: "already published" });
      continue;
    }

    if (existing) {
      assertTeamSnapshotMutable(existing.status);
    }

    const rowCreates = built.rows.map((row) => ({
      programId: row.programId,
      rank: row.rank,
      rating: row.rating,
      verifiedGameCount: row.verifiedGameCount,
      verifiedOpponentCount: row.verifiedOpponentCount,
      verifiedCompetitionCount: row.verifiedCompetitionCount,
      programName: row.programName,
      programAbbreviation: row.programAbbreviation,
      movement: row.movement
    }));

    const snapshot = await prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.teamRankingSnapshotRow.deleteMany({ where: { snapshotId: existing.id } });
        return tx.teamRankingSnapshot.update({
          where: { id: existing.id },
          data: {
            rowCount: built.rows.length,
            evaluationDate,
            status: publish ? TeamRankingSnapshotStatus.PUBLISHED : TeamRankingSnapshotStatus.DRAFT,
            publishedAt: publish ? evaluationDate : null,
            rows: { create: rowCreates }
          }
        });
      }

      return tx.teamRankingSnapshot.create({
        data: {
          ageGroup: board.ageGroup,
          gender: board.gender,
          weekOf,
          teamFormulaVersionId: formulaVersion.id,
          evidencePolicyVersion: TEAM_EVIDENCE_POLICY_V1,
          thresholdPolicyVersion: TEAM_THRESHOLD_POLICY_V1,
          evaluationDate,
          rowCount: built.rows.length,
          status: publish ? TeamRankingSnapshotStatus.PUBLISHED : TeamRankingSnapshotStatus.DRAFT,
          publishedAt: publish ? evaluationDate : null,
          rows: { create: rowCreates }
        }
      });
    });

    if (publish) {
      await prisma.teamRankingSnapshot.updateMany({
        where: {
          ageGroup: board.ageGroup,
          gender: board.gender,
          status: TeamRankingSnapshotStatus.PUBLISHED,
          weekOf: { lt: weekOf },
          teamFormulaVersionId: formulaVersion.id,
          evidencePolicyVersion: TEAM_EVIDENCE_POLICY_V1,
          thresholdPolicyVersion: TEAM_THRESHOLD_POLICY_V1,
          id: { not: snapshot.id }
        },
        data: {
          status: TeamRankingSnapshotStatus.SUPERSEDED,
          supersededAt: evaluationDate
        }
      });
    }

    results.push({
      board: `${board.ageGroup}:${board.gender}`,
      action: existing ? "updated" : "created",
      snapshotId: snapshot.id,
      status: snapshot.status,
      rowCount: built.rows.length,
      liveEligibleCount: built.liveEligibleCount
    });
  }

  console.log(JSON.stringify({ weekOf: weekOf.toISOString(), publish, results }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
