/**
 * Recompute vNext home-board PlayerRating rows.
 * Dry-run: npx tsx scripts/recompute-player-ratings-vnext.ts
 * Execute:  npx tsx scripts/recompute-player-ratings-vnext.ts --execute
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AgeGroup } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { FORMULA_V1_VERSION_NUMBER } from "../src/lib/player-rating-cumulative";
import { buildShadowRatings } from "../src/lib/ratings/formula-vnext/accumulation";
import { loadFormulaVnextEvidence } from "../src/lib/ratings/formula-vnext/load-evidence";
import { resolveShadowFormulaParams } from "../src/lib/ratings/formula-vnext/resolve-params";
import { FORMULA_VNEXT_POLICY_ID } from "../src/lib/ratings/formula-vnext/types";

const reportsDir = join(process.cwd(), "scripts", "reports");
const execute = process.argv.includes("--execute");

const HOME_BRACKETS: Array<"U13" | "U16" | "U19"> = ["U13", "U16", "U19"];

async function main() {
  const asOfDate = new Date();
  const params = resolveShadowFormulaParams();
  const formulaVersion = await prisma.formulaVersion.findUnique({
    where: { versionNumber: FORMULA_V1_VERSION_NUMBER },
    select: { id: true }
  });
  if (!formulaVersion) {
    throw new Error("Formula v1 record not found.");
  }

  const evidence = await loadFormulaVnextEvidence({ asOfDate });
  const targets: Array<{
    playerId: string;
    ageGroup: AgeGroup;
    observedRating: number;
    adjustedRating: number;
    verifiedGameCount: number;
    starRating: number;
    ratingBasis: string;
  }> = [];

  for (const bracket of HOME_BRACKETS) {
    const shadowRows = buildShadowRatings(
      evidence.filter((row) => row.homeBracket === bracket),
      params,
      asOfDate
    );
    for (const row of shadowRows) {
      targets.push({
        playerId: row.playerId,
        ageGroup: bracket as AgeGroup,
        observedRating: row.observedRating,
        adjustedRating: row.adjustedRating,
        verifiedGameCount: row.verifiedGameCount,
        starRating: row.starRating,
        ratingBasis: row.ratingBasis
      });
    }
  }

  let created = 0;
  let updated = 0;

  if (execute) {
    const computedAt = new Date();
    for (const target of targets) {
      const existing = await prisma.playerRating.findUnique({
        where: {
          playerId_ageGroup_formulaVersionId_policyVersionId: {
            playerId: target.playerId,
            ageGroup: target.ageGroup,
            formulaVersionId: formulaVersion.id,
            policyVersionId: FORMULA_VNEXT_POLICY_ID
          }
        },
        select: { id: true }
      });

      await prisma.playerRating.upsert({
        where: {
          playerId_ageGroup_formulaVersionId_policyVersionId: {
            playerId: target.playerId,
            ageGroup: target.ageGroup,
            formulaVersionId: formulaVersion.id,
            policyVersionId: FORMULA_VNEXT_POLICY_ID
          }
        },
        update: {
          observedRating: target.observedRating,
          adjustedRating: target.adjustedRating,
          verifiedGameCount: target.verifiedGameCount,
          starRating: target.starRating,
          computedAt
        },
        create: {
          playerId: target.playerId,
          ageGroup: target.ageGroup,
          formulaVersionId: formulaVersion.id,
          policyVersionId: FORMULA_VNEXT_POLICY_ID,
          observedRating: target.observedRating,
          adjustedRating: target.adjustedRating,
          verifiedGameCount: target.verifiedGameCount,
          starRating: target.starRating,
          computedAt
        }
      });

      if (existing) updated += 1;
      else created += 1;
    }
  }

  const report = {
    generatedAt: asOfDate.toISOString(),
    mode: execute ? "execute" : "dry-run",
    policyVersionId: FORMULA_VNEXT_POLICY_ID,
    formulaVersionNumber: FORMULA_V1_VERSION_NUMBER,
    targetCount: targets.length,
    created: execute ? created : null,
    updated: execute ? updated : null,
    projected: targets.filter((t) => t.ratingBasis === "PROJECTED").length,
    samples: targets.filter((t) => t.ratingBasis === "PROJECTED").slice(0, 15)
  };

  mkdirSync(reportsDir, { recursive: true });
  writeFileSync(join(reportsDir, "recompute-player-ratings-vnext.json"), JSON.stringify(report, null, 2));

  console.log(
    execute
      ? `Executed vNext recompute: ${created} created, ${updated} updated (${targets.length} targets)`
      : `Dry-run only: ${targets.length} targets. Re-run with --execute to write.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
