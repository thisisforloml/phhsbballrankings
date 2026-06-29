/**
 * TR-5: Persist ProgramTeamRating rows from TPI-v1 computation.
 * Usage: npx tsx scripts/compute-program-team-ratings.ts [--dry-run] [--eval ISO_DATE]
 */
import { computeProgramTeamRatings } from "../src/lib/team-ratings/compute-program-team-ratings";
import { TEAM_TPI_RECOMPUTE_ENABLED } from "../src/lib/team-ratings/feature-flags";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const evalArg = process.argv.find((a) => a.startsWith("--eval="));
  const evaluationDate = evalArg ? new Date(evalArg.split("=")[1]!) : new Date("2026-06-17T12:00:00.000Z");

  if (!dryRun && !TEAM_TPI_RECOMPUTE_ENABLED) {
    console.log(JSON.stringify({ status: "SKIPPED", reason: "TEAM_TPI_RECOMPUTE_ENABLED=false" }, null, 2));
    return;
  }

  const result = await computeProgramTeamRatings({ dryRun, evaluationDate });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
