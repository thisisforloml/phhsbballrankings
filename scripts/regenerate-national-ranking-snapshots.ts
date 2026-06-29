/**
 * Regenerate all national ranking snapshots from the active rating policy.
 *
 * Usage: npx tsx scripts/regenerate-national-ranking-snapshots.ts
 */
import { prisma } from "../src/lib/prisma";
import { getActivePolicyVersionId } from "../src/lib/ratings/active-formula";
import { regenerateNationalRankingSnapshots } from "../src/lib/rankings/national-snapshot-regeneration";

async function main() {
  const result = await regenerateNationalRankingSnapshots();

  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        policyVersionId: getActivePolicyVersionId(),
        formulaVersionId: result.formulaVersionId,
        snapshotDate: result.snapshotDate,
        results: result.results
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
  .finally(() => prisma.$disconnect());
