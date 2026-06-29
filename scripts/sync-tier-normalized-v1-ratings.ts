/**
 * Sync all production ratings to current GPS + league tiers (tier-normalized v1).
 * Usage: npx tsx scripts/sync-tier-normalized-v1-ratings.ts
 */
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../src/lib/prisma";
import {
  projectHomeBoardTierNormalizedRatings,
  recomputeTierNormalizedV1Ratings
} from "../src/lib/ratings/tier-normalized-v1";

const reportsDir = join(process.cwd(), "scripts", "reports");

async function main() {
  const recompute = await recomputeTierNormalizedV1Ratings({ execute: true });
  const projected = await projectHomeBoardTierNormalizedRatings({ execute: true });

  execSync("npx tsx scripts/regenerate-national-ranking-snapshots.ts", {
    cwd: process.cwd(),
    stdio: "inherit"
  });

  const report = {
    generatedAt: new Date().toISOString(),
    mode: "sync-execute",
    recompute: {
      targets: recompute.targets.length,
      created: recompute.created,
      updated: recompute.updated
    },
    projectedHomeBoard: projected
  };

  mkdirSync(reportsDir, { recursive: true });
  const jsonPath = join(reportsDir, "sync-tier-normalized-v1-ratings.json");
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  console.log(`Wrote ${jsonPath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
