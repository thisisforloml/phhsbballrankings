/**
 * Diagnose U19 Boys players on live board but missing from snapshot rows.
 */
import { AgeGroup, PlayerGender } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { getPublicBoardRows } from "../src/lib/public-board-ranks";
import { buildLatestNationalRankingsLive } from "../src/lib/rankings";
import { buildLatestNationalRankingsFromSnapshots } from "../src/lib/rankings-snapshot-read";
import { buildSnapshotBoardRows } from "../src/lib/snapshot-board-rows";
import { getMonthStart } from "../src/lib/ranking-eligibility";
import { getActivePolicyVersionId } from "../src/lib/ratings/active-formula";
import { FORMULA_V1_VERSION_NUMBER } from "../src/lib/ratings/formula-constants";

async function main() {
  const formulaVersion = await prisma.formulaVersion.findUnique({
    where: { versionNumber: FORMULA_V1_VERSION_NUMBER },
    select: { id: true },
  });
  if (!formulaVersion) throw new Error("no formula version");

  const monthStart = getMonthStart(new Date());
  const today = new Date();

  const [builtMonthStart, builtToday] = await Promise.all([
    buildSnapshotBoardRows({
      ageGroup: AgeGroup.U19,
      gender: PlayerGender.BOYS,
      evaluationDate: monthStart,
      formulaVersionId: formulaVersion.id,
    }),
    buildSnapshotBoardRows({
      ageGroup: AgeGroup.U19,
      gender: PlayerGender.BOYS,
      evaluationDate: today,
      formulaVersionId: formulaVersion.id,
    }),
  ]);

  const live = await buildLatestNationalRankingsLive(["U19"]);
  const snapshot = await buildLatestNationalRankingsFromSnapshots(["U19"]);
  const liveIds = new Set(getPublicBoardRows(live.snapshotsByAge.U19.boys).map((r) => r.playerId));
  const snapIds = new Set(getPublicBoardRows(snapshot.snapshotsByAge.U19.boys).map((r) => r.playerId));
  const onlyLive = [...liveIds].filter((id) => !snapIds.has(id));

  const players = await prisma.player.findMany({
    where: { id: { in: onlyLive } },
    select: { id: true, displayName: true, birthDate: true, classYearOverride: true },
  });

  const inBuiltMonth = new Set(builtMonthStart.rows.map((r) => r.playerId));
  const inBuiltToday = new Set(builtToday.rows.map((r) => r.playerId));

  console.log(
    JSON.stringify(
      {
        policyVersionId: getActivePolicyVersionId(),
        monthStart: monthStart.toISOString(),
        today: today.toISOString(),
        livePublicCount: liveIds.size,
        snapshotPublicCount: snapIds.size,
        builtMonthStartCount: builtMonthStart.rows.length,
        builtTodayCount: builtToday.rows.length,
        onlyLive,
        players: players.map((p) => ({
          ...p,
          inBuiltMonthStart: inBuiltMonth.has(p.id),
          inBuiltToday: inBuiltToday.has(p.id),
        })),
      },
      null,
      2
    )
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
