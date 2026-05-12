import { AgeGroup, PlayerGender, RankingScope } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

const formulaVersionNumber = 1;
const ageGroup = AgeGroup.U19;
const eligibilityRules = [
  {
    gender: PlayerGender.BOYS,
    minimumVerifiedGames: 10,
    expectedRows: 90
  },
  {
    gender: PlayerGender.GIRLS,
    minimumVerifiedGames: 5,
    expectedRows: 44
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

  const snapshotSummaries = [];
  let totalRowsChecked = 0;

  for (const rule of eligibilityRules) {
    const snapshots = await prisma.rankingSnapshot.findMany({
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
      orderBy: {
        weekOf: "desc"
      }
    });

    if (snapshots.length !== 1) {
      issues.push({
        gender: rule.gender,
        message: `Expected exactly one Formula v1 U19 NATIONAL snapshot, found ${snapshots.length}.`
      });
      continue;
    }

    const snapshot = snapshots[0];
    const expectedRatings = await expectedEligibleRatings(rule.gender, rule.minimumVerifiedGames);

    if (expectedRatings.length !== rule.expectedRows) {
      issues.push({
        gender: rule.gender,
        snapshotId: snapshot.id,
        message: `Expected eligible rating count ${rule.expectedRows}, found ${expectedRatings.length}.`
      });
    }

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

    for (const row of snapshot.rows) {
      totalRowsChecked += 1;
      const expected = expectedByPlayerId.get(row.playerId);

      if (!expected) {
        issues.push({
          gender: rule.gender,
          snapshotId: snapshot.id,
          playerId: row.playerId,
          message: "Snapshot row player is not public eligible under Formula v1 rules."
        });
        continue;
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
          message: "Duplicate player in snapshot rows."
        });
      }
      seenPlayers.add(row.playerId);

      const expectedRating = Number(expected.rating.adjustedRating);
      const actualRating = Number(row.rating);

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

    snapshotSummaries.push({
      gender: rule.gender,
      snapshotId: snapshot.id,
      weekOf: snapshot.weekOf.toISOString(),
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
        ageGroup,
        eligibilityRules: {
          boys: {
            minimumVerifiedGames: 10
          },
          girls: {
            minimumVerifiedGames: 5
          }
        },
        snapshotsChecked: snapshotSummaries.length,
        totalRowsChecked,
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
