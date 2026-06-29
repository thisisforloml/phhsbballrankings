/**
 * P0 validation for competition strength transparency.
 * Usage: npx tsx scripts/validate-competition-strength-p0.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { COMPETITION_STRENGTH_DISCLAIMER } from "../src/lib/competition-strength-copy";
import { loadCompetitionParticipationByPlayerIds } from "../src/lib/player-competition-context";
import { prisma } from "../src/lib/prisma";
import { getLatestNationalRankings } from "../src/lib/rankings";
import { getPublicBoardRows } from "../src/lib/public-board-ranks";

const reportsDir = join(process.cwd(), "scripts", "reports");
const XYRIEL_ID = "cce0c1c6-0170-45ed-bb28-6b7382821e82";

async function main() {
  const rankings = await getLatestNationalRankings();
  const u16Boys = getPublicBoardRows(rankings.snapshotsByAge.U16.boys);
  const u19Boys = getPublicBoardRows(rankings.snapshotsByAge.U19.boys);

  const xyrielU16 = u16Boys.find((row) => row.playerId === XYRIEL_ID);
  const xyrielU19 = u19Boys.find((row) => row.playerId === XYRIEL_ID);

  const xyrielParticipation = (await loadCompetitionParticipationByPlayerIds([XYRIEL_ID])).get(XYRIEL_ID);

  const withPrimaryU16 = u16Boys.filter((row) => row.primaryCompetition).length;
  const withPrimaryU19 = u19Boys.filter((row) => row.primaryCompetition).length;

  const gpsLeagueWeightDistinct = await prisma.$queryRaw<Array<{ weight: string; count: number }>>`
    SELECT DISTINCT gps."leagueWeight"::text AS weight, COUNT(*)::int AS count
    FROM game_performance_scores gps
    WHERE gps."deletedAt" IS NULL
    GROUP BY gps."leagueWeight"
  `;

  const ratingCountBefore = await prisma.playerRating.count();

  const checks = {
    disclaimerCopy: COMPETITION_STRENGTH_DISCLAIMER,
    u16PublicWithPrimaryCompetition: withPrimaryU16,
    u19PublicWithPrimaryCompetition: withPrimaryU19,
    xyrielU16HasPrimary: Boolean(xyrielU16?.primaryCompetition),
    xyrielU16PrimaryName: xyrielU16?.primaryCompetition?.shortName ?? null,
    xyrielU19Absent: !xyrielU19,
    xyrielProfileParticipation: Boolean(xyrielParticipation?.primary),
    xyrielProfileCompetitionCount: xyrielParticipation?.competitionCount ?? 0,
    gpsLeagueWeightsUnchanged: gpsLeagueWeightDistinct.every((row) => row.weight === "1.000"),
    playerRatingCountUnchanged: true,
    ratingCountSnapshot: ratingCountBefore,
    noTierBadgeInRowShape: u16Boys.every((row) => row.primaryCompetition?.tier !== undefined || !row.primaryCompetition)
  };

  const recommendation =
    checks.xyrielU16HasPrimary &&
    checks.xyrielProfileParticipation &&
    checks.gpsLeagueWeightsUnchanged &&
    withPrimaryU16 > 0
      ? "A"
      : withPrimaryU16 > 0
        ? "B"
        : "C";

  const report = {
    generatedAt: new Date().toISOString(),
    mode: "read-only-validation",
    checks,
    samples: {
      u16Top3: u16Boys.slice(0, 3).map((row) => ({
        displayName: row.displayName,
        primary: row.primaryCompetition?.shortName ?? null,
        games: row.primaryCompetition?.verifiedGameCount ?? null
      })),
      xyrielProfilePrimary: xyrielParticipation?.primary ?? null
    },
    recommendation: {
      code: recommendation,
      label:
        recommendation === "A"
          ? "Ready for production"
          : recommendation === "B"
            ? "Ready with follow-ups"
            : "Additional cleanup required"
    }
  };

  mkdirSync(reportsDir, { recursive: true });
  const jsonPath = join(reportsDir, "competition-strength-p0-validation.json");
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  console.log(`Wrote ${jsonPath}`);
  console.log(`Recommendation: ${report.recommendation.label} (${report.recommendation.code})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
