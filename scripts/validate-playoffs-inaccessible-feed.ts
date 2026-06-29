/**
 * Read-only validation: PYBC Playoffs Finals inaccessible-feed reconciliation.
 * Usage: npx tsx scripts/validate-playoffs-inaccessible-feed.ts
 */
import { buildStatsHubSubmissionPackage, discoverStatsHubImport } from "@/lib/stats-import/adapters/statshub-v1";

const PLAYOFFS_URL =
  "https://www.statshubph.info/pybc-13u?WHurl=%2Fcompetition%2F47340%2Fschedule%3FphaseName%3DPlayoffs%26poolNumber%3D0%26matchType%3DFINALS%26";

async function main() {
  const discovery = await discoverStatsHubImport(PLAYOFFS_URL);
  const selected = discovery.games.filter((game) => game.status === "final" && game.statsAvailable);

  const built = await buildStatsHubSubmissionPackage({
    sourceUrl: PLAYOFFS_URL,
    competitionId: discovery.competitionId,
    leagueName: discovery.competitionTitle,
    ageGroup: discovery.inferredAgeGroup ?? "U13",
    gender: discovery.inferredGender === "GIRLS" ? "GIRLS" : "BOYS",
    games: selected.map((game) => ({
      matchId: game.matchId,
      gameNumber: game.gameNumber,
      sourceUrl: game.sourceUrl
    })),
    scheduleByMatchId: new Map(discovery.games.map((game) => [game.matchId, game]))
  });

  const match2785685 = built.packageDraft.games.find((game) => game.gameNumber.includes("2785685"));
  const fullStatGames = built.packageDraft.games.filter((game) => game.players.length > 0).length;

  console.log("PYBC Playoffs Finals import validation");
  console.log(`  discovered finals: ${selected.length}`);
  console.log(`  imported games: ${built.gameCount}`);
  console.log(`  games with player stats: ${fullStatGames}`);
  console.log(`  inaccessible feed reconciled: ${built.reconciliationSummary.inaccessibleFeedMatchIds.join(", ") || "(none)"}`);
  console.log(`  2785685 teamResultOnly: ${match2785685?.teamResultOnly ?? "missing"}`);
  console.log(`  2785685 defaultWin: ${match2785685?.defaultWin ?? "missing"}`);
  console.log(`  2785685 score: ${match2785685?.homeScore}-${match2785685?.awayScore}`);

  if (built.gameCount !== 9) throw new Error(`Expected 9 games, got ${built.gameCount}`);
  if (!built.reconciliationSummary.inaccessibleFeedMatchIds.includes("2785685")) {
    throw new Error("Expected 2785685 in inaccessibleFeedMatchIds");
  }
  if (!match2785685?.teamResultOnly || !match2785685.defaultWin) {
    throw new Error("2785685 should be team-result-only default win");
  }
  if (fullStatGames !== 8) throw new Error(`Expected 8 full-stat games, got ${fullStatGames}`);

  console.log("PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
