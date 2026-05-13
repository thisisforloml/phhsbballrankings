import { AgeGroup, PlayerGender, RankingScope } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

const formulaVersionNumber = 1;
const ageGroup = AgeGroup.U19;
const eligibilityRules = [
  {
    gender: PlayerGender.BOYS,
    minimumVerifiedGames: 10
  },
  {
    gender: PlayerGender.GIRLS,
    minimumVerifiedGames: 5
  }
] as const;

type Issue = {
  gender?: PlayerGender;
  snapshotId?: string;
  playerId?: string;
  message: string;
};

async function expectedEligibleRatings(gender: PlayerGender, minimumVerifiedGames: number) {
  return prisma.playerRating.findMany({
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
          displayName: true
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
}

async function main() {
  const issues: Issue[] = [];
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

  const totalHistoricalSnapshots = await prisma.rankingSnapshot.count({
    where: {
      scope: RankingScope.NATIONAL,
      ageGroup,
      formulaVersionId: formulaVersion.id,
      city: null,
      region: null
    }
  });

  const snapshotSummaries = [];
  let boysRowsChecked = 0;
  let girlsRowsChecked = 0;
  let latestBoysSnapshotId: string | null = null;
  let latestGirlsSnapshotId: string | null = null;

  for (const rule of eligibilityRules) {
    const snapshot = await prisma.rankingSnapshot.findFirst({
      where: {
        scope: RankingScope.NATIONAL,
        ageGroup,
        gender: rule.gender,
        formulaVersionId: formulaVersion.id,
        city: null,
        region: null
      },
      include: {
        rows: {
          include: {
            player: {
              select: {
                displayName: true
              }
            }
          },
          orderBy: {
            rank: "asc"
          }
        }
      },
      orderBy: [
        {
          weekOf: "desc"
        },
        {
          createdAt: "desc"
        }
      ]
    });

    if (!snapshot) {
      issues.push({
        gender: rule.gender,
        message: "Latest Formula v1 U19 NATIONAL snapshot was not found."
      });
      continue;
    }

    if (rule.gender === PlayerGender.BOYS) latestBoysSnapshotId = snapshot.id;
    if (rule.gender === PlayerGender.GIRLS) latestGirlsSnapshotId = snapshot.id;

    const expectedRatings = await expectedEligibleRatings(rule.gender, rule.minimumVerifiedGames);

    if (snapshot.rows.length !== expectedRatings.length) {
      issues.push({
        gender: rule.gender,
        snapshotId: snapshot.id,
        message: `Expected ${expectedRatings.length} snapshot rows, found ${snapshot.rows.length}.`
      });
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

      if (!expected) {
        issues.push({
          gender: rule.gender,
          snapshotId: snapshot.id,
          playerId: row.playerId,
          message: "Snapshot row player is not public eligible under current Formula v1 rules."
        });
      }

      if (seenRanks.has(row.rank)) {
        issues.push({
          gender: rule.gender,
          snapshotId: snapshot.id,
          playerId: row.playerId,
          message: `Duplicate rank ${row.rank}.`
        });
      }
      seenRanks.add(row.rank);

      if (seenPlayers.has(row.playerId)) {
        issues.push({
          gender: rule.gender,
          snapshotId: snapshot.id,
          playerId: row.playerId,
          message: "Duplicate playerId within snapshot."
        });
      }
      seenPlayers.add(row.playerId);

      if (previousRating !== null && actualRating > previousRating) {
        issues.push({
          gender: rule.gender,
          snapshotId: snapshot.id,
          playerId: row.playerId,
          message: `Rows are not sorted by rating descending: ${actualRating} follows ${previousRating}.`
        });
      }
      previousRating = actualRating;

      if (expected) {
        const expectedRating = Number(expected.rating.adjustedRating);

        if (row.rank !== expected.rank) {
          issues.push({
            gender: rule.gender,
            snapshotId: snapshot.id,
            playerId: row.playerId,
            message: `Expected rank ${expected.rank}, found ${row.rank}.`
          });
        }

        if (Math.abs(actualRating - expectedRating) > 0.01) {
          issues.push({
            gender: rule.gender,
            snapshotId: snapshot.id,
            playerId: row.playerId,
            message: `Expected rating ${expectedRating}, found ${actualRating}.`
          });
        }

        if (row.starRating !== expected.rating.starRating) {
          issues.push({
            gender: rule.gender,
            snapshotId: snapshot.id,
            playerId: row.playerId,
            message: `Expected starRating ${expected.rating.starRating}, found ${row.starRating}.`
          });
        }

        if (row.verifiedGameCount !== expected.rating.verifiedGameCount) {
          issues.push({
            gender: rule.gender,
            snapshotId: snapshot.id,
            playerId: row.playerId,
            message: `Expected verifiedGameCount ${expected.rating.verifiedGameCount}, found ${row.verifiedGameCount}.`
          });
        }
      }
    }

    for (let rank = 1; rank <= snapshot.rows.length; rank += 1) {
      if (!seenRanks.has(rank)) {
        issues.push({
          gender: rule.gender,
          snapshotId: snapshot.id,
          message: `Missing continuous rank ${rank}.`
        });
      }
    }

    snapshotSummaries.push({
      gender: rule.gender,
      snapshotId: snapshot.id,
      weekOf: snapshot.weekOf.toISOString(),
      createdAt: snapshot.createdAt.toISOString(),
      expectedRows: expectedRatings.length,
      actualRows: snapshot.rows.length,
      top10Preview: snapshot.rows.slice(0, 10).map((row) => ({
        rank: row.rank,
        playerId: row.playerId,
        displayName: row.player.displayName,
        rating: Number(row.rating),
        starRating: row.starRating,
        verifiedGameCount: row.verifiedGameCount
      }))
    });
  }

  console.log(
    JSON.stringify(
      {
        formulaVersionId: formulaVersion.id,
        totalHistoricalSnapshots,
        latestSnapshotsChecked: snapshotSummaries.length,
        latestBoysSnapshotId,
        latestGirlsSnapshotId,
        boysRowsChecked,
        girlsRowsChecked,
        snapshotSummaries,
        issues,
        validationPassed: issues.length === 0
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