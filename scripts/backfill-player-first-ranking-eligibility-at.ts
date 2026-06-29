/**
 * Backfill Player.firstRankingEligibilityAt for no-DOB players at launch threshold.
 *
 * Usage:
 *   npx tsx scripts/backfill-player-first-ranking-eligibility-at.ts
 *   npx tsx scripts/backfill-player-first-ranking-eligibility-at.ts --execute
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { AgeGroup, PlayerGender } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import {
  buildEligibilityInput,
  evaluateEligibility,
  PENDING_POLICY_EFFECTIVE_DATE,
  resolveLaunchThreshold,
  satisfiesPendingPublicPath
} from "../src/lib/eligibility";

const EXECUTE = process.argv.includes("--execute");
const REPORT_PATH = join(process.cwd(), "scripts", "reports", "first-ranking-eligibility-at-backfill.json");

type BackfillRow = {
  playerId: string;
  displayName: string;
  ageGroup: AgeGroup;
  gender: PlayerGender;
  verifiedGameCount: number;
  earliestQualifyingGameDate: string | null;
  assignedAt: string;
  source: "earliest_game" | "policy_effective_date";
};

async function main() {
  const formulaVersion = await prisma.formulaVersion.findUnique({
    where: { versionNumber: 1 },
    select: { id: true }
  });

  const ratings = await prisma.playerRating.findMany({
    where: { player: { deletedAt: null, birthDate: null } },
    include: {
      player: {
        select: {
          id: true,
          displayName: true,
          gender: true,
          birthDate: true,
          firstRankingEligibilityAt: true,
          classYearOverride: true,
          ageGroupOverride: true
        }
      }
    }
  });

  const rows: BackfillRow[] = [];

  for (const rating of ratings) {
    const player = rating.player;
    if (player.birthDate || player.firstRankingEligibilityAt) continue;

    const threshold = resolveLaunchThreshold(player.gender);
    if (rating.verifiedGameCount < threshold) continue;

    const eligibleNow = satisfiesPendingPublicPath(
      buildEligibilityInput({
        playerId: player.id,
        gender: player.gender,
        birthDate: null,
        firstRankingEligibilityAt: null,
        classYearOverride: player.classYearOverride,
        ageGroupOverride: player.ageGroupOverride,
        ratingAgeGroup: rating.ageGroup as "U13" | "U16" | "U19",
        verifiedGameCount: rating.verifiedGameCount,
        evaluatedBoard: rating.ageGroup as "U13" | "U16" | "U19",
        formulaVersionId: formulaVersion?.id ?? null
      }),
      new Date(),
      rating.verifiedGameCount,
      "launch-v1"
    );

    const verdict = evaluateEligibility(
      buildEligibilityInput({
        playerId: player.id,
        gender: player.gender,
        birthDate: null,
        firstRankingEligibilityAt: null,
        classYearOverride: player.classYearOverride,
        ageGroupOverride: player.ageGroupOverride,
        ratingAgeGroup: rating.ageGroup as "U13" | "U16" | "U19",
        verifiedGameCount: rating.verifiedGameCount,
        evaluatedBoard: rating.ageGroup as "U13" | "U16" | "U19",
        formulaVersionId: formulaVersion?.id ?? null
      })
    );

    if (!eligibleNow || verdict.provisionalReason !== "UNKNOWN_DOB") continue;

    const earliestGame = await prisma.gameStat.findFirst({
      where: {
        deletedAt: null,
        playerId: player.id,
        game: {
          deletedAt: null,
          season: { league: { ageGroup: rating.ageGroup } }
        }
      },
      orderBy: { game: { gameDate: "asc" } },
      select: { game: { select: { gameDate: true } } }
    });

    const earliestDate = earliestGame?.game.gameDate ?? null;
    const assignedAt = earliestDate ?? PENDING_POLICY_EFFECTIVE_DATE;

    rows.push({
      playerId: player.id,
      displayName: player.displayName,
      ageGroup: rating.ageGroup,
      gender: player.gender,
      verifiedGameCount: rating.verifiedGameCount,
      earliestQualifyingGameDate: earliestDate?.toISOString() ?? null,
      assignedAt: assignedAt.toISOString(),
      source: earliestDate ? "earliest_game" : "policy_effective_date"
    });
  }

  const uniqueByPlayer = new Map<string, BackfillRow>();
  for (const row of rows) {
    const existing = uniqueByPlayer.get(row.playerId);
    if (!existing || new Date(row.assignedAt) < new Date(existing.assignedAt)) {
      uniqueByPlayer.set(row.playerId, row);
    }
  }

  const candidates = Array.from(uniqueByPlayer.values()).sort((a, b) => a.displayName.localeCompare(b.displayName));

  let updated = 0;
  if (EXECUTE && candidates.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const row of candidates) {
        const result = await tx.player.updateMany({
          where: {
            id: row.playerId,
            deletedAt: null,
            birthDate: null,
            firstRankingEligibilityAt: null
          },
          data: { firstRankingEligibilityAt: new Date(row.assignedAt) }
        });
        updated += result.count;
      }
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    mode: EXECUTE ? "executed" : "dry-run",
    candidateCount: candidates.length,
    updated,
    policyEffectiveDate: PENDING_POLICY_EFFECTIVE_DATE.toISOString(),
    byBoard: candidates.reduce<Record<string, number>>((acc, row) => {
      const key = `${row.ageGroup} ${row.gender === PlayerGender.GIRLS ? "Girls" : "Boys"}`;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
    candidates
  };

  mkdirSync(dirname(REPORT_PATH), { recursive: true });
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");

  console.log(
    JSON.stringify(
      {
        mode: report.mode,
        candidateCount: report.candidateCount,
        updated: report.updated,
        byBoard: report.byBoard,
        reportPath: REPORT_PATH
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
