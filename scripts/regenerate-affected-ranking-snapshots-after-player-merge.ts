import { AgeGroup, PlayerGender, RankingScope, PrismaClient } from "@prisma/client";
import { getClassYear, isRankingEligibleByClassYear } from "../src/lib/ranking-eligibility";

const prisma = new PrismaClient();
const scriptPath = "D:\\Peach Basket\\scripts\\regenerate-affected-ranking-snapshots-after-player-merge.ts";
const affectedSnapshotIds = [
  "0e7cf39c-b67c-4c3a-8f10-08ab801a8734",
  "319b72cd-91c1-4e8b-bf0e-2f870ea1eadc"
];

function minimumVerifiedGamesForContext(ageGroup: AgeGroup, gender: PlayerGender) {
  if (ageGroup === AgeGroup.U16 && gender === PlayerGender.BOYS) return 1;
  if (ageGroup === AgeGroup.U19 && gender === PlayerGender.BOYS) return 10;
  if (ageGroup === AgeGroup.U19 && gender === PlayerGender.GIRLS) return 5;
  return gender === PlayerGender.GIRLS ? 5 : 10;
}

function contiguousRanks(ranks: number[]) {
  const sorted = ranks.slice().sort((left, right) => left - right);
  return sorted.every((rank, index) => rank === index + 1);
}

function snapshotKey(snapshot: { scope: RankingScope; ageGroup: AgeGroup | null; gender: PlayerGender; weekOf: Date; city: string | null; region: string | null }) {
  return [snapshot.scope, snapshot.ageGroup ?? "none", snapshot.gender, snapshot.weekOf.toISOString(), snapshot.city ?? "", snapshot.region ?? ""].join("|");
}

async function buildRowsForSnapshot(snapshot: {
  id: string;
  scope: RankingScope;
  ageGroup: AgeGroup | null;
  gender: PlayerGender;
  weekOf: Date;
  city: string | null;
  region: string | null;
}) {
  if (snapshot.scope !== RankingScope.NATIONAL) {
    throw new Error(`Unsupported snapshot scope for scoped regeneration: ${snapshot.id} / ${snapshot.scope}`);
  }
  if (!snapshot.ageGroup) {
    throw new Error(`Snapshot ${snapshot.id} does not have an ageGroup.`);
  }
  if (snapshot.city || snapshot.region) {
    throw new Error(`Snapshot ${snapshot.id} is not a national city/region-null snapshot.`);
  }

  const minimumVerifiedGames = minimumVerifiedGamesForContext(snapshot.ageGroup, snapshot.gender);
  const ratings = await prisma.playerRating.findMany({
    where: {
      ageGroup: snapshot.ageGroup,
      verifiedGameCount: { gte: minimumVerifiedGames },
      player: { gender: snapshot.gender, deletedAt: null }
    },
    include: { player: { select: { id: true, displayName: true, birthDate: true, deletedAt: true } } },
    orderBy: [{ adjustedRating: "desc" }, { verifiedGameCount: "desc" }, { player: { displayName: "asc" } }]
  });
  const eligibleByGames = ratings.map((rating) => ({
    playerId: rating.playerId,
    displayName: rating.player.displayName,
    adjustedRating: Number(rating.adjustedRating),
    verifiedGameCount: rating.verifiedGameCount,
    starRating: rating.starRating,
    birthDate: rating.player.birthDate,
    classYear: getClassYear(rating.player.birthDate)
  }));
  const excludedByClassYear = eligibleByGames.filter((rating) => !isRankingEligibleByClassYear(rating.birthDate, snapshot.weekOf));
  const excludedIds = new Set(excludedByClassYear.map((rating) => rating.playerId));
  const finalRows = eligibleByGames.filter((rating) => !excludedIds.has(rating.playerId));
  const rows = finalRows.map((rating, index) => ({
    snapshotId: snapshot.id,
    playerId: rating.playerId,
    rank: index + 1,
    rating: rating.adjustedRating,
    starRating: rating.starRating,
    verifiedGameCount: rating.verifiedGameCount,
    movement: 0
  }));

  return {
    minimumVerifiedGames,
    eligibleByGames: eligibleByGames.length,
    excludedByClassYear: excludedByClassYear.length,
    missingBirthDate: eligibleByGames.filter((row) => row.birthDate === null).length,
    rows,
    top10Preview: finalRows.slice(0, 10).map((row, index) => ({
      rank: index + 1,
      playerId: row.playerId,
      displayName: row.displayName,
      adjustedRating: row.adjustedRating,
      verifiedGameCount: row.verifiedGameCount,
      starRating: row.starRating,
      classYear: row.classYear
    }))
  };
}

type BuiltSnapshotRows = Awaited<ReturnType<typeof buildRowsForSnapshot>>;

async function getSnapshotRowCounts() {
  const snapshots = await prisma.rankingSnapshot.findMany({ select: { id: true, _count: { select: { rows: true } } } });
  return new Map(snapshots.map((snapshot) => [snapshot.id, snapshot._count.rows]));
}

async function main() {
  const beforeSnapshotCount = await prisma.rankingSnapshot.count();
  const beforeAllRowCount = await prisma.rankingSnapshotRow.count();
  const beforeRowCounts = await getSnapshotRowCounts();
  const affectedSet = new Set(affectedSnapshotIds);

  const snapshots = await prisma.rankingSnapshot.findMany({
    where: { id: { in: affectedSnapshotIds } },
    include: { rows: { include: { player: { select: { id: true, displayName: true, deletedAt: true } } }, orderBy: { rank: "asc" } } },
    orderBy: [{ ageGroup: "asc" }, { gender: "asc" }]
  });
  if (snapshots.length !== affectedSnapshotIds.length) {
    throw new Error(`Expected ${affectedSnapshotIds.length} affected snapshots, found ${snapshots.length}.`);
  }

  const beforeSnapshots = snapshots.map((snapshot) => ({
    id: snapshot.id,
    scope: snapshot.scope,
    weekOf: snapshot.weekOf.toISOString(),
    ageGroup: snapshot.ageGroup ? String(snapshot.ageGroup) : null,
    gender: String(snapshot.gender),
    rowCountBefore: snapshot.rows.length,
    deletedPlayersBefore: snapshot.rows.filter((row) => row.player.deletedAt !== null).map((row) => ({ rowId: row.id, playerId: row.playerId, displayName: row.player.displayName })),
    ranksContiguousBefore: contiguousRanks(snapshot.rows.map((row) => row.rank))
  }));
  const duplicateScopeKeys = new Set<string>();
  for (const snapshot of snapshots) {
    const key = snapshotKey(snapshot);
    if (duplicateScopeKeys.has(key)) throw new Error(`Duplicate affected snapshot scope key: ${key}`);
    duplicateScopeKeys.add(key);
  }

  const rowsBySnapshot: Array<{ snapshot: (typeof snapshots)[number]; built: BuiltSnapshotRows }> = [];
  for (const snapshot of snapshots) {
    const built = await buildRowsForSnapshot(snapshot);
    rowsBySnapshot.push({ snapshot, built });
  }

  await prisma.$transaction(async (tx) => {
    for (const item of rowsBySnapshot) {
      await tx.rankingSnapshotRow.deleteMany({ where: { snapshotId: item.snapshot.id } });
      if (item.built.rows.length) {
        await tx.rankingSnapshotRow.createMany({ data: item.built.rows });
      }
    }
  });

  const afterSnapshotCount = await prisma.rankingSnapshot.count();
  const afterAllRowCount = await prisma.rankingSnapshotRow.count();
  const afterRowCounts = await getSnapshotRowCounts();
  const afterSnapshots = await prisma.rankingSnapshot.findMany({
    where: { id: { in: affectedSnapshotIds } },
    include: { rows: { include: { player: { select: { id: true, displayName: true, deletedAt: true } } }, orderBy: { rank: "asc" } } },
    orderBy: [{ ageGroup: "asc" }, { gender: "asc" }]
  });

  const regenerated = afterSnapshots.map((snapshot) => {
    const build = rowsBySnapshot.find((item) => item.snapshot.id === snapshot.id)?.built;
    const ranks = snapshot.rows.map((row) => row.rank);
    const playerIds = snapshot.rows.map((row) => row.playerId);
    return {
      id: snapshot.id,
      scope: snapshot.scope,
      weekOf: snapshot.weekOf.toISOString(),
      ageGroup: snapshot.ageGroup ? String(snapshot.ageGroup) : null,
      gender: String(snapshot.gender),
      rowCountBefore: beforeRowCounts.get(snapshot.id) ?? null,
      rowCountAfter: snapshot.rows.length,
      minimumVerifiedGames: build?.minimumVerifiedGames ?? null,
      eligibleByGames: build?.eligibleByGames ?? null,
      excludedByClassYear: build?.excludedByClassYear ?? null,
      missingBirthDate: build?.missingBirthDate ?? null,
      deletedPlayersAfter: snapshot.rows.filter((row) => row.player.deletedAt !== null).map((row) => ({ rowId: row.id, playerId: row.playerId, displayName: row.player.displayName })),
      duplicatePlayerRows: playerIds.length - new Set(playerIds).size,
      rankValidation: {
        contiguous: contiguousRanks(ranks),
        firstRank: ranks.length ? Math.min(...ranks) : null,
        lastRank: ranks.length ? Math.max(...ranks) : null,
        rowCount: snapshot.rows.length
      },
      top10Preview: snapshot.rows.slice(0, 10).map((row) => ({
        rank: row.rank,
        playerId: row.playerId,
        displayName: row.player.displayName,
        rating: Number(row.rating),
        starRating: row.starRating,
        verifiedGameCount: row.verifiedGameCount
      }))
    };
  });

  const unaffectedChanged = Array.from(beforeRowCounts.entries())
    .filter(([id]) => !affectedSet.has(id))
    .map(([id, beforeCount]) => ({ id, beforeCount, afterCount: afterRowCounts.get(id) ?? null, unchanged: beforeCount === (afterRowCounts.get(id) ?? null) }))
    .filter((row) => !row.unchanged);
  const deletedPlayersInAnySnapshotRows = await prisma.rankingSnapshotRow.findMany({
    where: { player: { deletedAt: { not: null } } },
    include: { player: { select: { displayName: true } }, snapshot: { select: { ageGroup: true, gender: true, weekOf: true } } }
  });

  const u16Boys = regenerated.find((snapshot) => snapshot.ageGroup === "U16" && snapshot.gender === "BOYS");
  const u19Affected = regenerated.filter((snapshot) => snapshot.ageGroup === "U19");
  const validation = {
    rankingSnapshotCountUnchanged: beforeSnapshotCount === afterSnapshotCount,
    onlyAffectedSnapshotRowSetsChanged: unaffectedChanged.length === 0,
    unaffectedSnapshotRowCountsUnchanged: unaffectedChanged.length === 0,
    noDeletedPlayersInSnapshotRows: deletedPlayersInAnySnapshotRows.length === 0,
    noDeletedPlayersInAffectedRows: regenerated.every((snapshot) => snapshot.deletedPlayersAfter.length === 0),
    noDuplicatePlayerRowsWithinAffectedSnapshots: regenerated.every((snapshot) => snapshot.duplicatePlayerRows === 0),
    affectedRanksContiguous: regenerated.every((snapshot) => snapshot.rankValidation.contiguous),
    u16BoysShowsRank1: u16Boys ? u16Boys.rankValidation.firstRank === 1 : true,
    u19AffectedRanksContiguous: u19Affected.every((snapshot) => snapshot.rankValidation.contiguous),
    rowsUseActivePlayerRatingsOnly: regenerated.every((snapshot) => snapshot.deletedPlayersAfter.length === 0)
  };
  const validationPassed = Object.values(validation).every(Boolean);

  console.log(JSON.stringify({
    scriptPath,
    snapshotsInspectedBefore: beforeSnapshots,
    snapshotsRegenerated: regenerated,
    beforeAfterRowCounts: {
      totalRowsBefore: beforeAllRowCount,
      totalRowsAfter: afterAllRowCount,
      affected: regenerated.map((snapshot) => ({ id: snapshot.id, before: snapshot.rowCountBefore, after: snapshot.rowCountAfter }))
    },
    deletedSourceRowsAbsent: validation.noDeletedPlayersInSnapshotRows,
    rankValidation: regenerated.map((snapshot) => ({ id: snapshot.id, ageGroup: snapshot.ageGroup, gender: snapshot.gender, ...snapshot.rankValidation })),
    unaffectedSnapshotValidation: {
      unaffectedSnapshotRowCountsUnchanged: validation.unaffectedSnapshotRowCountsUnchanged,
      changedUnaffectedSnapshots: unaffectedChanged
    },
    deletedPlayersInAnySnapshotRows: deletedPlayersInAnySnapshotRows.map((row) => ({
      rowId: row.id,
      playerId: row.playerId,
      displayName: row.player.displayName,
      snapshotId: row.snapshotId,
      ageGroup: row.snapshot.ageGroup ? String(row.snapshot.ageGroup) : null,
      gender: String(row.snapshot.gender),
      weekOf: row.snapshot.weekOf.toISOString().slice(0, 10)
    })),
    validation,
    validationPassed
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
