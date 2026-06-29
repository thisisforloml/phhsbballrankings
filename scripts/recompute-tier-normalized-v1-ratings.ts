/**
 * Recompute shadow PlayerRating rows for Phase 1 tier-normalized v1.
 *
 * Dry-run:  npx tsx scripts/recompute-tier-normalized-v1-ratings.ts
 * Execute: npx tsx scripts/recompute-tier-normalized-v1-ratings.ts --execute
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AgeGroup, PlayerGender } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { FORMULA_TIER_NORMALIZED_V1_POLICY_ID, FORMULA_V1_POLICY_ID } from "../src/lib/ratings/formula-constants";
import {
  recomputeTierNormalizedV1Ratings,
  resolveFormulaV1VersionId,
  starBand
} from "../src/lib/ratings/tier-normalized-v1";

const reportsDir = join(process.cwd(), "scripts", "reports");
const execute = process.argv.includes("--execute");
const REVIEW_NAMES = ["Lucas Kaw", "Jude Eriobu", "Josef Calo-oy", "Xyriel Macahipay", "Prince Cariño"];

async function boardTop(
  formulaVersionId: string,
  policyVersionId: string,
  ageGroup: AgeGroup,
  gender: PlayerGender,
  limit = 15
) {
  const rows = await prisma.playerRating.findMany({
    where: {
      formulaVersionId,
      policyVersionId,
      ageGroup,
      player: { gender, deletedAt: null }
    },
    include: { player: { select: { displayName: true } } },
    orderBy: [{ adjustedRating: "desc" }, { verifiedGameCount: "desc" }],
    take: limit
  });

  return rows.map((row, index) => ({
    rank: index + 1,
    playerId: row.playerId,
    displayName: row.player.displayName,
    rating: Number(row.adjustedRating),
    verifiedGameCount: row.verifiedGameCount,
    stars: row.starRating
  }));
}

async function main() {
  const result = await recomputeTierNormalizedV1Ratings({ execute });
  const formulaVersionId = await resolveFormulaV1VersionId();

  const productionU19 = await boardTop(formulaVersionId, FORMULA_V1_POLICY_ID, AgeGroup.U19, PlayerGender.BOYS);
  const shadowU19 = execute
    ? await boardTop(formulaVersionId, FORMULA_TIER_NORMALIZED_V1_POLICY_ID, AgeGroup.U19, PlayerGender.BOYS)
    : productionU19.map((row) => {
        const target = result.targets.find(
          (candidate) =>
            candidate.playerId === row.playerId &&
            candidate.ageGroup === AgeGroup.U19
        );
        return target
          ? {
              ...row,
              rating: target.adjustedRating,
              verifiedGameCount: target.verifiedGameCount,
              stars: starBand(target.adjustedRating)
            }
          : row;
      })
        .sort(
          (left, right) =>
            right.rating - left.rating ||
            right.verifiedGameCount - left.verifiedGameCount ||
            left.displayName.localeCompare(right.displayName)
        )
        .map((row, index) => ({ ...row, rank: index + 1 }));

  const productionMap = new Map(productionU19.map((row) => [row.playerId, row]));
  const shadowMap = new Map(shadowU19.map((row) => [row.playerId, row]));

  const reviewSet = REVIEW_NAMES.map((name) => {
    const production = productionU19.find((row) => row.displayName === name);
    const shadow = shadowU19.find((row) => row.displayName === name);
    return {
      displayName: name,
      production: production ?? null,
      shadow: shadow ?? null,
      rankDelta: production && shadow ? production.rank - shadow.rank : null,
      ratingDelta: production && shadow ? Number((shadow.rating - production.rating).toFixed(2)) : null
    };
  });

  const top10Entered = shadowU19
    .filter((row) => row.rank <= 10)
    .filter((row) => (productionMap.get(row.playerId)?.rank ?? 99) > 10)
    .map((row) => ({ name: row.displayName, rank: row.rank, rating: row.rating }));

  const top10Exited = productionU19
    .filter((row) => row.rank <= 10)
    .filter((row) => (shadowMap.get(row.playerId)?.rank ?? 99) > 10)
    .map((row) => ({ name: row.displayName, rank: row.rank, rating: row.rating }));

  const report = {
    generatedAt: new Date().toISOString(),
    mode: execute ? "execute" : "dry-run",
    policyVersionId: FORMULA_TIER_NORMALIZED_V1_POLICY_ID,
    productionPolicyVersionId: FORMULA_V1_POLICY_ID,
    warning: execute
      ? "Shadow policy rows written. Public board unchanged until explicit cutover."
      : "NO DATABASE WRITES — pass --execute after validation.",
    summary: {
      targetCount: result.targets.length,
      created: result.created,
      updated: result.updated,
      unchangedVsProductionShape: result.skippedProductionParity,
      top10Churn: top10Entered.length
    },
    reviewSet,
    top10: {
      production: productionU19.slice(0, 10),
      shadow: shadowU19.slice(0, 10),
      entered: top10Entered,
      exited: top10Exited
    },
    samples: {
      largestRatingIncreases: reviewSet
        .filter((row) => row.ratingDelta !== null)
        .sort((a, b) => (b.ratingDelta ?? 0) - (a.ratingDelta ?? 0))
        .slice(0, 5),
      largestRankMovers: shadowU19
        .map((row) => {
          const production = productionMap.get(row.playerId);
          return production
            ? {
                displayName: row.displayName,
                productionRank: production.rank,
                shadowRank: row.rank,
                rankDelta: production.rank - row.rank
              }
            : null;
        })
        .filter((row): row is NonNullable<typeof row> => Boolean(row))
        .sort((a, b) => Math.abs(b.rankDelta) - Math.abs(a.rankDelta))
        .slice(0, 12)
    }
  };

  mkdirSync(reportsDir, { recursive: true });
  const jsonPath = join(reportsDir, "recompute-tier-normalized-v1-ratings.json");
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  console.log(`Wrote ${jsonPath}`);
  if (execute) {
    console.log(
      `Execute complete: ${result.created} created, ${result.updated} updated (${result.targets.length} targets).`
    );
  } else {
    console.log(`Dry-run: ${result.targets.length} shadow targets ready. Re-run with --execute to write rows.`);
  }
  console.log(`Lucas Kaw preview: ${JSON.stringify(reviewSet.find((row) => row.displayName === "Lucas Kaw") ?? null)}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
