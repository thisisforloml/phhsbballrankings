import { fetchGeniusEmbedSchedule } from "../src/lib/stats-import/adapters/statshub-v1/resolve-competition";
import { parseScheduleHtml } from "../src/lib/stats-import/adapters/statshub-v1/parse-schedule";

async function previewPath(path: string) {
  const { html } = await fetchGeniusEmbedSchedule(path);
  const competitionId = path.match(/competition\/(\d+)/)?.[1] ?? "unknown";
  const games = parseScheduleHtml(html, competitionId, "preview");
  const withDates = games.filter((game) => game.gameDate);
  console.log(
    JSON.stringify({
      path,
      games: games.length,
      withDates: withDates.length,
      sample: withDates.slice(0, 2).map((game) => ({
        matchId: game.matchId,
        gameDate: game.gameDate,
        matchup: `${game.homeTeamLabel} vs ${game.awayTeamLabel}`
      }))
    })
  );
}

async function main() {
  const paths = [
    "/competition/40774/schedule",
    "/competition/40774/schedule?phaseName=Eliminations",
    "/competition/40774/schedule?phaseName=Playoffs",
    "/competition/47472/schedule",
    "/competition/47472/schedule?phaseName=Eliminations",
    "/competition/48385/schedule",
    "/competition/48385/schedule?phaseName=Eliminations",
    "/competition/47340/schedule",
    "/competition/47340/schedule?phaseName=Eliminations"
  ];

  for (const path of paths) {
    try {
      await previewPath(path);
    } catch (error) {
      console.log(JSON.stringify({ path, error: error instanceof Error ? error.message : String(error) }));
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
