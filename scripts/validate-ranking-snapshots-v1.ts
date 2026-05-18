import { AgeGroup, PlayerGender, RankingScope } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { getClassYear, getMonthStart, isRankingEligibleByClassYear } from "../src/lib/ranking-eligibility";

const formulaVersionNumber = 1;
const ageGroup = AgeGroup.U19;
const eligibilityRules = [
  { gender: PlayerGender.BOYS, minimumVerifiedGames: 10 },
  { gender: PlayerGender.GIRLS, minimumVerifiedGames: 5 }
] as const;

type Issue = { gender?: PlayerGender; snapshotId?: string; playerId?: string; message: string };
type Info = { gender?: PlayerGender; snapshotId?: string; playerId?: string; message: string };

function isMonthStart(date: Date) {
  return date.getTime() === getMonthStart(date).getTime();
}

async function expectedEligibleRatings(gender: PlayerGender, minimumVerifiedGames: number, snapshotDate: Date) {
  const ratings = await prisma.playerRating.findMany({
    where: {
      ageGroup,
      verifiedGameCount: { gte: minimumVerifiedGames },
      player: { gender, deletedAt: null }
    },
    include: {
      player: {
        select: {
          displayName: true,
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

  return ratings.filter((rating) => isRankingEligibleByClassYear(rating.player.birthDate, snapshotDate));
}

async function latestMonthlySnapshot(params: { gender: PlayerGender; formulaVersionId: string }) {
  const snapshots = await prisma.rankingSnapshot.findMany({
    where: {
      scope: RankingScope.NATIONAL,
      ageGroup,
      gender: params.gender,
      formulaVersionId: params.formulaVersionId,
      city: null,
      region: null
    },
    include: {
      rows: {
        include: {
          player: {
            select: {
              displayName: true,
              birthDate: true
            }
          }
        },
        orderBy: { rank: "asc" }
      }
    },
    orderBy: [
      { weekOf: "desc" },
      { createdAt: "desc" }
    ]
  });

  return snapshots.find((snapshot) => isMonthStart(snapshot.weekOf)) ?? null;
}

async function main() {
  const issues: Issue[] = [];
  const informational: Info[] = [];
  const formulaVersion = await prisma.formulaVersion.findUnique({
    where: { versionNumber: formulaVersionNumber },
    select: { id: true }
  });

  if (!formulaVersion) throw new Error(`Missing FormulaVersion versionNumber ${formulaVersionNumber}.`);

  const totalHistoricalSnapshots = await prisma.rankingSnapshot.count({
    where: {
      scope: RankingScope.NATIONAL,
      ageGroup,
      formulaVersionId: formulaVersion.id,
      city: null,
      region: null
    }
  });

  const snapshotState = await prisma.rankingSnapshot.findMany({
    where: {
      scope: RankingScope.NATIONAL,
      ageGroup,
      formulaVersionId: formulaVersion.id,
      city: null,
      region: null
    },
    select: {
      id: true,
      gender: true,
      weekOf: true,
      createdAt: true,
      _count: { select: { rows: true } }
    },
    orderBy: [{ weekOf: "desc" }, { createdAt: "desc" }]
  });

  const snapshotSummaries = [];
  let boysRowsChecked = 0;
  let girlsRowsChecked = 0;
  let latestBoysSnapshotId: string | null = null;
  let latestGirlsSnapshotId: string | null = null;
  let boysMissingBirthDate = 0;
  let girlsMissingBirthDate = 0;

  for (const rule of eligibilityRules) {
    const snapshot = await latestMonthlySnapshot({ gender: rule.gender, formulaVersionId: formulaVersion.id });

    if (!snapshot) {
      issues.push({ gender: rule.gender, message: "Latest monthly Formula v1 U19 NATIONAL snapshot was not found." });
      continue;
    }

    if (!isMonthStart(snapshot.weekOf)) {
      issues.push({ gender: rule.gender, snapshotId: snapshot.id, message: `Snapshot weekOf is not first day of month: ${snapshot.weekOf.toISOString()}.` });
    }

    if (rule.gender === PlayerGender.BOYS) latestBoysSnapshotId = snapshot.id;
    if (rule.gender === PlayerGender.GIRLS) latestGirlsSnapshotId = snapshot.id;

    const expectedRatings = await expectedEligibleRatings(rule.gender, rule.minimumVerifiedGames, snapshot.weekOf);
    const expectedMissingBirthDate = expectedRatings.filter((rating) => rating.player.birthDate === null);
    if (rule.gender === PlayerGender.BOYS) boysMissingBirthDate = expectedMissingBirthDate.length;
    if (rule.gender === PlayerGender.GIRLS) girlsMissingBirthDate = expectedMissingBirthDate.length;

    for (const rating of expectedMissingBirthDate) {
      informational.push({
        gender: rule.gender,
        playerId: rating.playerId,
        message: `${rating.player.displayName} is eligible with missing birthDate; class-year status is unknown.`
      });
    }

    if (snapshot.rows.length !== expectedRatings.length) {
      issues.push({ gender: rule.gender, snapshotId: snapshot.id, message: `Expected ${expectedRatings.length} snapshot rows, found ${snapshot.rows.length}.` });
    }

    const expectedByPlayerId = new Map(expectedRatings.map((rating, index) => [rating.playerId, { rating, rank: index + 1 }]));
    const seenRanks = new Set<number>();
    const seenPlayers = new Set<string>();
    let previousRating: number | null = null;

    for (const row of snapshot.rows) {
      if (rule.gender === PlayerGender.BOYS) boysRowsChecked += 1;
      if (rule.gender === PlayerGender.GIRLS) girlsRowsChecked += 1;

      const expected = expectedByPlayerId.get(row.playerId);
      const actualRating = Number(row.rating);

      if (!isRankingEligibleByClassYear(row.player.birthDate, snapshot.weekOf)) {
        issues.push({
          gender: rule.gender,
          snapshotId: snapshot.id,
          playerId: row.playerId,
          message: `Class-graduated player appears in latest monthly snapshot. classYear=${getClassYear(row.player.birthDate)}.`
        });
      }

      if (!expected) {
        issues.push({ gender: rule.gender, snapshotId: snapshot.id, playerId: row.playerId, message: "Snapshot row player is not public eligible under current Formula v1 and class-year rules." });
      }

      if (seenRanks.has(row.rank)) issues.push({ gender: rule.gender, snapshotId: snapshot.id, playerId: row.playerId, message: `Duplicate rank ${row.rank}.` });
      seenRanks.add(row.rank);

      if (seenPlayers.has(row.playerId)) issues.push({ gender: rule.gender, snapshotId: snapshot.id, playerId: row.playerId, message: "Duplicate playerId within snapshot." });
      seenPlayers.add(row.playerId);

      if (previousRating !== null && actualRating > previousRating) {
        issues.push({ gender: rule.gender, snapshotId: snapshot.id, playerId: row.playerId, message: `Rows are not sorted by rating descending: ${actualRating} follows ${previousRating}.` });
      }
      previousRating = actualRating;

      if (expected) {
        const expectedRating = Number(expected.rating.adjustedRating);
        if (row.rank !== expected.rank) issues.push({ gender: rule.gender, snapshotId: snapshot.id, playerId: row.playerId, message: `Expected rank ${expected.rank}, found ${row.rank}.` });
        if (Math.abs(actualRating - expectedRating) > 0.01) issues.push({ gender: rule.gender, snapshotId: snapshot.id, playerId: row.playerId, message: `Expected rating ${expectedRating}, found ${actualRating}.` });
        if (row.starRating !== expected.rating.starRating) issues.push({ gender: rule.gender, snapshotId: snapshot.id, playerId: row.playerId, message: `Expected starRating ${expected.rating.starRating}, found ${row.starRating}.` });
        if (row.verifiedGameCount !== expected.rating.verifiedGameCount) issues.push({ gender: rule.gender, snapshotId: snapshot.id, playerId: row.playerId, message: `Expected verifiedGameCount ${expected.rating.verifiedGameCount}, found ${row.verifiedGameCount}.` });
      }
    }

    for (let rank = 1; rank <= snapshot.rows.length; rank += 1) {
      if (!seenRanks.has(rank)) issues.push({ gender: rule.gender, snapshotId: snapshot.id, message: `Missing continuous rank ${rank}.` });
    }

    snapshotSummaries.push({
      gender: rule.gender,
      snapshotId: snapshot.id,
      snapshotDate: snapshot.weekOf.toISOString(),
      weekOf: snapshot.weekOf.toISOString(),
      createdAt: snapshot.createdAt.toISOString(),
      expectedRows: expectedRatings.length,
      actualRows: snapshot.rows.length,
      missingBirthDatePlayers: expectedMissingBirthDate.length,
      top10Preview: snapshot.rows.slice(0, 10).map((row) => ({
        rank: row.rank,
        playerId: row.playerId,
        displayName: row.player.displayName,
        rating: Number(row.rating),
        starRating: row.starRating,
        verifiedGameCount: row.verifiedGameCount,
        classYear: getClassYear(row.player.birthDate)
      }))
    });
  }

  console.log(JSON.stringify({
    formulaVersionId: formulaVersion.id,
    totalHistoricalSnapshots,
    snapshotState: snapshotState.map((snapshot) => ({
      id: snapshot.id,
      gender: snapshot.gender,
      weekOf: snapshot.weekOf.toISOString(),
      isMonthlySnapshot: isMonthStart(snapshot.weekOf),
      rowCount: snapshot._count.rows,
      createdAt: snapshot.createdAt.toISOString()
    })),
    latestMonthlySnapshotsChecked: snapshotSummaries.length,
    latestBoysSnapshotId,
    latestGirlsSnapshotId,
    boysRowsChecked,
    girlsRowsChecked,
    boysMissingBirthDate,
    girlsMissingBirthDate,
    snapshotSummaries,
    informational,
    issues,
    validationPassed: issues.length === 0
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
