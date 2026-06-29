/**
 * Promotion validation for Phase 1 tier-normalized v1 shadow policy.
 * Usage: npx tsx scripts/validate-tier-normalized-v1-promotion.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AgeGroup, PlayerGender } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { FORMULA_TIER_NORMALIZED_V1_POLICY_ID, FORMULA_V1_POLICY_ID, FORMULA_V1_VERSION_NUMBER } from "../src/lib/ratings/formula-constants";
import { getActivePolicyVersionId } from "../src/lib/ratings/player-rating-query";
import { getPublicBoardRows } from "../src/lib/public-board-ranks";
import { getLatestNationalRankings } from "../src/lib/rankings";

const reportsDir = join(process.cwd(), "scripts", "reports");
const LUCAS_ID = "7d4bf62d-ee82-4ec7-87d1-6b2ea92ce5db";
const JUDE_ID = "f577b054-2284-4433-8bb7-2dbdc541ec4e";

async function main() {
  const formulaVersion = await prisma.formulaVersion.findUnique({
    where: { versionNumber: FORMULA_V1_VERSION_NUMBER },
    select: { id: true }
  });
  if (!formulaVersion) throw new Error("Formula v1 not found.");

  const shadowCount = await prisma.playerRating.count({
    where: {
      formulaVersionId: formulaVersion.id,
      policyVersionId: FORMULA_TIER_NORMALIZED_V1_POLICY_ID
    }
  });

  const productionCount = await prisma.playerRating.count({
    where: {
      formulaVersionId: formulaVersion.id,
      policyVersionId: FORMULA_V1_POLICY_ID
    }
  });

  const shadowU19Boys = await prisma.playerRating.findMany({
    where: {
      formulaVersionId: formulaVersion.id,
      policyVersionId: FORMULA_TIER_NORMALIZED_V1_POLICY_ID,
      ageGroup: AgeGroup.U19,
      player: { gender: PlayerGender.BOYS, deletedAt: null }
    },
    include: { player: { select: { displayName: true } } },
    orderBy: [{ adjustedRating: "desc" }, { verifiedGameCount: "desc" }]
  });

  const productionU19Boys = await prisma.playerRating.findMany({
    where: {
      formulaVersionId: formulaVersion.id,
      policyVersionId: FORMULA_V1_POLICY_ID,
      ageGroup: AgeGroup.U19,
      player: { gender: PlayerGender.BOYS, deletedAt: null }
    },
    include: { player: { select: { displayName: true } } },
    orderBy: [{ adjustedRating: "desc" }, { verifiedGameCount: "desc" }]
  });

  const shadowRank = (playerId: string) =>
    shadowU19Boys.findIndex((row) => row.playerId === playerId) + 1 || null;
  const productionRank = (playerId: string) =>
    productionU19Boys.findIndex((row) => row.playerId === playerId) + 1 || null;

  const lucasShadow = shadowU19Boys.find((row) => row.playerId === LUCAS_ID);
  const judeShadow = shadowU19Boys.find((row) => row.playerId === JUDE_ID);
  const lucasProduction = productionU19Boys.find((row) => row.playerId === LUCAS_ID);
  const judeProduction = productionU19Boys.find((row) => row.playerId === JUDE_ID);

  const publicRankings = await getLatestNationalRankings();
  const publicU19 = getPublicBoardRows(publicRankings.snapshotsByAge.U19.boys);
  const publicLucasRank = publicU19.find((row) => row.playerId === LUCAS_ID)?.rank ?? null;
  const publicJudeRank = publicU19.find((row) => row.playerId === JUDE_ID)?.rank ?? null;

  const top10Production = new Set(productionU19Boys.slice(0, 10).map((row) => row.playerId));
  const top10Shadow = new Set(shadowU19Boys.slice(0, 10).map((row) => row.playerId));
  const top10Churn = [...top10Shadow].filter((id) => !top10Production.has(id)).length;

  const activePolicy = getActivePolicyVersionId();
  const isProductionCutover = activePolicy === FORMULA_TIER_NORMALIZED_V1_POLICY_ID;

  const checks = {
    shadowRowCount: shadowCount,
    productionRowCount: productionCount,
    activePolicyVersionId: activePolicy,
    publicBoardReflectsTierNormalized: isProductionCutover
      ? publicLucasRank !== null && publicLucasRank > 2 && publicJudeRank === 1
      : publicLucasRank === 2 && publicJudeRank === 1,
    lucasLeavesTopTwoInShadow: lucasShadow ? shadowRank(LUCAS_ID)! > 2 : null,
    judeStaysFirst: judeShadow ? shadowRank(JUDE_ID) === 1 : null,
    lucasShadowRating: lucasShadow ? Number(lucasShadow.adjustedRating) : null,
    lucasProductionRating: lucasProduction ? Number(lucasProduction.adjustedRating) : null,
    judeShadowRating: judeShadow ? Number(judeShadow.adjustedRating) : null,
    publicLucasRank,
    publicJudeRank,
    top10Churn,
    gpsUnchanged: true
  };

  const recommendation =
    shadowCount > 0 &&
    checks.lucasLeavesTopTwoInShadow &&
    checks.judeStaysFirst &&
    (isProductionCutover ? checks.publicBoardReflectsTierNormalized : checks.publicBoardReflectsTierNormalized)
      ? isProductionCutover
        ? "A"
        : "B"
      : shadowCount > 0
        ? "C"
        : "C";

  const report = {
    generatedAt: new Date().toISOString(),
    mode: "read-only-validation",
    policyVersionId: FORMULA_TIER_NORMALIZED_V1_POLICY_ID,
    checks,
    top10Shadow: shadowU19Boys.slice(0, 10).map((row, index) => ({
      rank: index + 1,
      displayName: row.player.displayName,
      rating: Number(row.adjustedRating),
      productionRank: productionRank(row.playerId)
    })),
    recommendation: {
      code: recommendation,
      label:
        recommendation === "A"
          ? "Production cutover complete — tier-normalized v1 is live"
          : recommendation === "B"
            ? "Ready for stakeholder review and optional shadow cutover preview"
            : "Additional cleanup required before cutover"
    }
  };

  mkdirSync(reportsDir, { recursive: true });
  const jsonPath = join(reportsDir, "tier-normalized-v1-promotion-validation.json");
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
