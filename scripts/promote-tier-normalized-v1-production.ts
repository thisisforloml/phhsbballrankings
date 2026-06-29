/**
 * Promote tier-normalized v1 to production: complete rating rows + snapshots.
 *
 * Usage: npx tsx scripts/promote-tier-normalized-v1-production.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AgeGroup, PlayerGender } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { getPublicBoardRows } from "../src/lib/public-board-ranks";
import { FORMULA_TIER_NORMALIZED_V1_POLICY_ID, FORMULA_V1_VERSION_NUMBER } from "../src/lib/ratings/formula-constants";
import { getActivePolicyVersionId } from "../src/lib/ratings/active-formula";
import {
  projectHomeBoardTierNormalizedRatings,
  recomputeTierNormalizedV1Ratings
} from "../src/lib/ratings/tier-normalized-v1";
import { getLatestNationalRankings } from "../src/lib/rankings";
import { execSync } from "node:child_process";

const reportsDir = join(process.cwd(), "scripts", "reports");
const LUCAS_ID = "7d4bf62d-ee82-4ec7-87d1-6b2ea92ce5db";
const JUDE_ID = "f577b054-2284-4433-8bb7-2dbdc541ec4e";
const XYRIEL_ID = "cce0c1c6-0170-45ed-bb28-6b7382821e82";

async function main() {
  const recompute = await recomputeTierNormalizedV1Ratings({ execute: true });
  const projected = await projectHomeBoardTierNormalizedRatings({ execute: true });

  execSync("npx tsx scripts/regenerate-national-ranking-snapshots.ts", {
    cwd: process.cwd(),
    stdio: "inherit"
  });

  const formulaVersion = await prisma.formulaVersion.findUnique({
    where: { versionNumber: FORMULA_V1_VERSION_NUMBER },
    select: { id: true }
  });
  if (!formulaVersion) throw new Error("Formula v1 not found.");

  const activePolicy = getActivePolicyVersionId();
  const shadowCount = await prisma.playerRating.count({
    where: { formulaVersionId: formulaVersion.id, policyVersionId: FORMULA_TIER_NORMALIZED_V1_POLICY_ID }
  });

  const rankings = await getLatestNationalRankings();
  const u19Boys = getPublicBoardRows(rankings.snapshotsByAge.U19.boys);
  const u16Boys = getPublicBoardRows(rankings.snapshotsByAge.U16.boys);

  const lucas = u19Boys.find((row) => row.playerId === LUCAS_ID);
  const jude = u19Boys.find((row) => row.playerId === JUDE_ID);
  const xyriel = u16Boys.find((row) => row.playerId === XYRIEL_ID);

  const report = {
    generatedAt: new Date().toISOString(),
    mode: "production-promotion",
    activePolicyVersionId: activePolicy,
    recompute: {
      targets: recompute.targets.length,
      created: recompute.created,
      updated: recompute.updated
    },
    projectedHomeBoard: projected,
    shadowRowCount: shadowCount,
    publicBoard: {
      u19BoysTop5: u19Boys.slice(0, 5).map((row) => ({
        rank: row.rank,
        displayName: row.displayName,
        rating: row.rating,
        primary: row.primaryCompetition?.shortName ?? null
      })),
      u16BoysTop5: u16Boys.slice(0, 5).map((row) => ({
        rank: row.rank,
        displayName: row.displayName,
        rating: row.rating
      })),
      lucas: lucas
        ? { rank: lucas.rank, rating: lucas.rating, primary: lucas.primaryCompetition?.shortName ?? null }
        : null,
      jude: jude ? { rank: jude.rank, rating: jude.rating } : null,
      xyriel: xyriel ? { rank: xyriel.rank, rating: xyriel.rating } : null
    }
  };

  mkdirSync(reportsDir, { recursive: true });
  const jsonPath = join(reportsDir, "promote-tier-normalized-v1-production.json");
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  console.log(`Wrote ${jsonPath}`);
  console.log(`Active policy: ${activePolicy}`);
  console.log(`Lucas Kaw public rank: #${lucas?.rank ?? "—"} at ${lucas?.rating ?? "—"}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
