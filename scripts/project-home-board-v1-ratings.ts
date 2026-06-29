/**
 * Project home-board PlayerRating rows for v1 limbo players (Option B).
 * Dry-run: npx tsx scripts/project-home-board-v1-ratings.ts
 * Execute:  npx tsx scripts/project-home-board-v1-ratings.ts --execute
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../src/lib/prisma";
import { findV1LimboCases, projectHomeBoardV1Ratings } from "../src/lib/ratings/home-board-v1";

const reportsDir = join(process.cwd(), "scripts", "reports");
const execute = process.argv.includes("--execute");

async function main() {
  const before = await findV1LimboCases();
  const result = await projectHomeBoardV1Ratings({ execute });
  const after = execute ? await findV1LimboCases() : before;

  const report = {
    generatedAt: new Date().toISOString(),
    mode: execute ? "execute" : "dry-run",
    policyVersionId: "formula-v1-production",
    limboBefore: before.length,
    limboAfter: after.length,
    created: execute ? result.created : null,
    skippedExisting: result.skippedExisting,
    targets: result.targets.map((target) => ({
      displayName: target.displayName,
      playerId: target.playerId,
      ageGroup: target.ageGroup,
      adjustedRating: target.adjustedRating,
      verifiedGameCount: target.verifiedGameCount,
      starRating: target.starRating,
      ratingBasis: target.ratingBasis
    }))
  };

  mkdirSync(reportsDir, { recursive: true });
  writeFileSync(join(reportsDir, "project-home-board-v1-ratings.json"), JSON.stringify(report, null, 2));

  console.log(
    execute
      ? `Created ${result.created} home-board v1 ratings (${result.skippedExisting} already existed). Limbo remaining: ${after.length}.`
      : `Dry-run: ${result.targets.length} limbo targets ready. Re-run with --execute to create rows.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
