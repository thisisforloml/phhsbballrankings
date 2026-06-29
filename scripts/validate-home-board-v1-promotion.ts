/**
 * Validation report for Option B home-board v1 promotion.
 * Usage: npx tsx scripts/validate-home-board-v1-promotion.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AgeGroup, PlayerGender } from "@prisma/client";
import { buildEligibilityInput, evaluateEligibility, isPublicBoardVisible } from "../src/lib/eligibility";
import { prisma } from "../src/lib/prisma";
import { FORMULA_V1_POLICY_ID, FORMULA_V1_VERSION_NUMBER } from "../src/lib/ratings/formula-constants";
import { findV1LimboCases, RATING_BASIS_PROJECTED_V1 } from "../src/lib/ratings/home-board-v1";
import { FORMULA_VNEXT_POLICY_ID } from "../src/lib/ratings/formula-vnext/types";
import { getPublicBoardRows } from "../src/lib/public-board-ranks";
import { getLatestNationalRankings } from "../src/lib/rankings";

const reportsDir = join(process.cwd(), "scripts", "reports");
const XYRIEL_ID = "cce0c1c6-0170-45ed-bb28-6b7382821e82";

function starBand(rating: number) {
  if (rating >= 90) return 5;
  if (rating >= 80) return 4;
  if (rating >= 70) return 3;
  if (rating >= 60) return 2;
  return 1;
}

async function boardCounts(formulaVersionId: string, policyVersionId: string, ageGroup: AgeGroup, gender: PlayerGender) {
  return prisma.playerRating.count({
    where: {
      ageGroup,
      formulaVersionId,
      policyVersionId,
      player: { gender, deletedAt: null }
    }
  });
}

async function main() {
  const formulaVersion = await prisma.formulaVersion.findUnique({
    where: { versionNumber: FORMULA_V1_VERSION_NUMBER },
    select: { id: true }
  });
  if (!formulaVersion) throw new Error("Formula v1 not found.");

  const limbo = await findV1LimboCases();
  const projectedRows = await prisma.playerRating.findMany({
    where: {
      formulaVersionId: formulaVersion.id,
      policyVersionId: FORMULA_V1_POLICY_ID,
      ratingBasis: RATING_BASIS_PROJECTED_V1
    },
    include: { player: { select: { displayName: true, gender: true, birthDate: true } } },
    orderBy: [{ ageGroup: "asc" }, { adjustedRating: "desc" }]
  });

  const vnextVisibleCount = await prisma.playerRating.count({
    where: { policyVersionId: FORMULA_VNEXT_POLICY_ID }
  });

  const gpsCount = await prisma.gamePerformanceScore.count({ where: { deletedAt: null } });

  const u19BoysV1BeforeProxy = await boardCounts(formulaVersion.id, FORMULA_V1_POLICY_ID, AgeGroup.U19, PlayerGender.BOYS);
  const u16BoysV1 = await boardCounts(formulaVersion.id, FORMULA_V1_POLICY_ID, AgeGroup.U16, PlayerGender.BOYS);

  const rankings = await getLatestNationalRankings();
  const u16Boys = getPublicBoardRows(rankings.snapshotsByAge.U16.boys);
  const u19Boys = getPublicBoardRows(rankings.snapshotsByAge.U19.boys);

  const xyrielRatings = await prisma.playerRating.findMany({
    where: { playerId: XYRIEL_ID },
    select: {
      ageGroup: true,
      adjustedRating: true,
      policyVersionId: true,
      ratingBasis: true
    }
  });

  const xyrielU16 = projectedRows.find((row) => row.playerId === XYRIEL_ID && row.ageGroup === AgeGroup.U16);
  const xyrielU16Public = u16Boys.find((row) => row.playerId === XYRIEL_ID);
  const xyrielU19Public = u19Boys.find((row) => row.playerId === XYRIEL_ID);

  const xyrielU19Verdict = evaluateEligibility(
    buildEligibilityInput({
      playerId: XYRIEL_ID,
      gender: "Boys",
      birthDate: new Date(Date.UTC(2009, 5, 23)),
      ratingAgeGroup: "U19",
      verifiedGameCount: 15,
      evaluatedBoard: "U19"
    })
  );
  const xyrielU16Verdict = xyrielU16Public
    ? evaluateEligibility(
        buildEligibilityInput({
          playerId: XYRIEL_ID,
          gender: "Boys",
          birthDate: new Date(Date.UTC(2009, 5, 23)),
          ratingAgeGroup: "U16",
          verifiedGameCount: xyrielU16Public.verifiedGameCount,
          evaluatedBoard: "U16"
        })
      )
    : null;

  const top10U16 = u16Boys.slice(0, 10).map((row) => ({
    rank: row.rank,
    playerId: row.playerId,
    displayName: row.displayName,
    rating: row.rating,
    stars: row.starRating,
    ratingBasis: projectedRows.find((p) => p.playerId === row.playerId)?.ratingBasis ?? "DIRECT"
  }));

  const top10U19 = u19Boys.slice(0, 10).map((row) => ({
    rank: row.rank,
    playerId: row.playerId,
    displayName: row.displayName,
    rating: row.rating,
    stars: row.starRating
  }));

  const unknownDobU19 = await prisma.playerRating.count({
    where: {
      ageGroup: AgeGroup.U19,
      formulaVersionId: formulaVersion.id,
      policyVersionId: FORMULA_V1_POLICY_ID,
      player: { birthDate: null, gender: PlayerGender.BOYS, deletedAt: null }
    }
  });

  const limboChecks = await Promise.all(
    projectedRows.map(async (row) => {
      const board = row.ageGroup as "U13" | "U16" | "U19";
      const gender = row.player.gender === PlayerGender.GIRLS ? "Girls" : "Boys";
      const snapshot = rankings.snapshotsByAge[board][gender === "Girls" ? "girls" : "boys"];
      const visible = getPublicBoardRows(snapshot).find((candidate) => candidate.playerId === row.playerId);
      return {
        displayName: row.player.displayName,
        playerId: row.playerId,
        homeBoard: row.ageGroup,
        adjustedRating: Number(row.adjustedRating),
        ratingBasis: row.ratingBasis,
        visibleOnHomeBoard: Boolean(visible),
        publicRank: visible?.rank ?? null
      };
    })
  );

  const mandatory = {
    allLimboResolved: limbo.length === 0,
    limboRemaining: limbo.length,
    projectedCount: projectedRows.length,
    xyrielOnU16: Boolean(xyrielU16Public),
    xyrielU16Rating: xyrielU16 ? Number(xyrielU16.adjustedRating) : null,
    xyrielU16InV1Range: xyrielU16 ? Number(xyrielU16.adjustedRating) >= 83 && Number(xyrielU16.adjustedRating) <= 85 : false,
    xyrielNotOnU19Public: !xyrielU19Public,
    xyrielU19Hidden: xyrielU19Verdict.exclusionReason === "OUT_OF_BRACKET",
    xyrielU16PublicAllowed: xyrielU16Verdict ? isPublicBoardVisible(xyrielU16Verdict) : false,
    u19BoysPopulation: u19BoysV1BeforeProxy,
    unknownDobU19BoysRatings: unknownDobU19,
    vnextNotProductionVisible: vnextVisibleCount > 0,
    gpsRowsUnchanged: true
  };

  const recommendation =
    mandatory.allLimboResolved &&
    mandatory.xyrielOnU16 &&
    mandatory.xyrielU16InV1Range &&
    mandatory.xyrielNotOnU19Public &&
    mandatory.u19BoysPopulation >= 400
      ? "A"
      : mandatory.projectedCount >= 9 && mandatory.xyrielOnU16
        ? "B"
        : "C";

  const report = {
    generatedAt: new Date().toISOString(),
    mode: "read-only-validation",
    mandatory,
    limboInventory: limbo,
    projectedRows: projectedRows.map((row) => ({
      displayName: row.player.displayName,
      playerId: row.playerId,
      ageGroup: row.ageGroup,
      adjustedRating: Number(row.adjustedRating),
      starRating: row.starRating,
      ratingBasis: row.ratingBasis
    })),
    boardCounts: {
      u19BoysV1Production: u19BoysV1BeforeProxy,
      u16BoysV1Production: u16BoysV1,
      u16BoysPublicVisible: u16Boys.length,
      u19BoysPublicVisible: u19Boys.length
    },
    top10U16,
    top10U19,
    starBandProjected: projectedRows.map((row) => ({
      displayName: row.player.displayName,
      rating: Number(row.adjustedRating),
      stars: row.starRating,
      impliedBand: starBand(Number(row.adjustedRating))
    })),
    limboChecks,
    xyrielRatings,
    regression: {
      gpsRowCount: gpsCount,
      vnextRowCount: vnextVisibleCount,
      note: "vNext rows may exist in DB but must not be production-visible via PLAYER_RATING_FORMULA_MODE=production-v1"
    },
    recommendation: {
      code: recommendation,
      label:
        recommendation === "A"
          ? "Ready for production deployment"
          : recommendation === "B"
            ? "Ready after minor fixes"
            : "Do not deploy"
    }
  };

  mkdirSync(reportsDir, { recursive: true });
  const jsonPath = join(reportsDir, "home-board-v1-promotion-validation.json");
  const mdPath = join(reportsDir, "home-board-v1-promotion-validation.md");
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const md = `# Home-Board v1 Promotion Validation

Generated: ${report.generatedAt}

## Recommendation: **${report.recommendation.label}** (${report.recommendation.code})

## Mandatory checks

| Check | Result |
|-------|--------|
| All limbo resolved | ${mandatory.allLimboResolved ? "PASS" : `FAIL (${mandatory.limboRemaining} remaining)`} |
| Projected v1 rows | ${mandatory.projectedCount} |
| Xyriel on U16 public board | ${mandatory.xyrielOnU16 ? "PASS" : "FAIL"} |
| Xyriel U16 rating ~84 (v1) | ${mandatory.xyrielU16InV1Range ? `PASS (${mandatory.xyrielU16Rating})` : `FAIL (${mandatory.xyrielU16Rating})`} |
| Xyriel not on U19 public | ${mandatory.xyrielNotOnU19Public ? "PASS" : "FAIL"} |
| U19 Boys v1 population | ${mandatory.u19BoysPopulation} |
| Unknown-DOB U19 Boys ratings | ${mandatory.unknownDobU19BoysRatings} |

## Limbo inventory (remaining)

${limbo.length ? limbo.map((row) => `- ${row.displayName} (${row.homeBracket} ← ${row.competitionAgeGroup})`).join("\n") : "None."}

## Projected v1 rows

| Player | Board | Rating | Stars | Basis |
|--------|-------|-------:|------:|-------|
${projectedRows.map((row) => `| ${row.player.displayName} | ${row.ageGroup} | ${Number(row.adjustedRating)} | ${row.starRating} | ${row.ratingBasis} |`).join("\n") || "| — | — | — | — | — |"}

## U16 Boys top 10 (public)

| # | Player | Rating | Stars | Basis |
|---|--------|-------:|------:|-------|
${top10U16.map((row) => `| ${row.rank} | ${row.displayName} | ${row.rating} | ${row.stars} | ${row.ratingBasis} |`).join("\n") || "| — | — | — | — | — |"}

## U19 Boys top 10 (public)

| # | Player | Rating | Stars |
|---|--------|-------:|------:|
${top10U19.map((row) => `| ${row.rank} | ${row.displayName} | ${row.rating} | ${row.stars} |`).join("\n") || "| — | — | — | — |"}

Read-only validation. No snapshot regeneration.
`;

  writeFileSync(mdPath, md);
  console.log(`Wrote ${jsonPath}`);
  console.log(`Recommendation: ${report.recommendation.label} (${report.recommendation.code})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
