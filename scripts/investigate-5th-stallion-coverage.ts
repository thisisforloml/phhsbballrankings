/**
 * Read-only investigation: 5th Stallion Cup 17U coverage.
 * Usage: npx tsx scripts/investigate-5th-stallion-coverage.ts
 */
import { prisma } from "../src/lib/prisma";
import { safeParseSubmissionJson } from "../src/lib/submission-json";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function parseSubmission(input: { rawText: string | null; parsedPreview: unknown }) {
  const parsed = safeParseSubmissionJson(input);
  if (!parsed.ok) return { ok: false as const, error: parsed.errorMessage };

  const packages = Array.isArray(parsed.data) ? parsed.data : [parsed.data];
  let games = 0;
  let leagueName = "";
  let seasonName = "";
  const gameNumbers: string[] = [];
  const teams = new Set<string>();
  const gameDates: string[] = [];

  for (const pkg of packages) {
    const record = asRecord(pkg);
    if (!record) continue;
    leagueName = leagueName || String(asRecord(record.league)?.name ?? "");
    seasonName = seasonName || String(asRecord(record.season)?.name ?? "");
    for (const game of Array.isArray(record.games) ? record.games : []) {
      const gameRecord = asRecord(game);
      if (!gameRecord) continue;
      games += 1;
      if (gameRecord.gameNumber) gameNumbers.push(String(gameRecord.gameNumber));
      if (gameRecord.gameDate) gameDates.push(String(gameRecord.gameDate).slice(0, 10));
      const home = String(gameRecord.homeTeam ?? gameRecord.homeTeamName ?? "");
      const away = String(gameRecord.awayTeam ?? gameRecord.awayTeamName ?? "");
      if (home) teams.add(home);
      if (away) teams.add(away);
      for (const player of Array.isArray(gameRecord.players) ? gameRecord.players : []) {
        const playerRecord = asRecord(player);
        const teamName = String(playerRecord?.teamName ?? playerRecord?.team ?? "");
        if (teamName) teams.add(teamName);
      }
    }
  }

  return {
    ok: true as const,
    games,
    leagueName,
    seasonName,
    gameNumbers,
    gameDates: gameDates.sort(),
    teams: Array.from(teams).sort()
  };
}

async function main() {
  const stallionLeagues = await prisma.league.findMany({
    where: {
      deletedAt: null,
      name: { contains: "Stallion", mode: "insensitive" }
    },
    select: {
      id: true,
      name: true,
      ageGroup: true,
      seasons: {
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          seasonYear: true,
          status: true,
          startsOn: true,
          endsOn: true,
          games: {
            where: { deletedAt: null },
            select: {
              id: true,
              gameNumber: true,
              gameDate: true,
              sourceName: true,
              sourceUrl: true,
              homeTeam: { select: { id: true, name: true } },
              awayTeam: { select: { id: true, name: true } },
              _count: { select: { stats: { where: { deletedAt: null } } } }
            },
            orderBy: [{ gameDate: "asc" }, { gameNumber: "asc" }]
          }
        },
        orderBy: { seasonYear: "asc" }
      }
    },
    orderBy: { name: "asc" }
  });

  const fifthLeague = stallionLeagues.find((league) => /5th/i.test(league.name) && /17/i.test(league.name));

  const fifthSubmissions = await prisma.submission.findMany({
    where: {
      deletedAt: null,
      status: "IMPORTED",
      OR: [
        { title: { contains: "5th Stallion", mode: "insensitive" } },
        { leagueName: { contains: "5th Stallion", mode: "insensitive" } }
      ]
    },
    select: {
      id: true,
      title: true,
      leagueName: true,
      adminNotes: true,
      createdAt: true,
      importedAt: true,
      rawText: true,
      parsedPreview: true
    },
    orderBy: { createdAt: "asc" }
  });

  const submissionDetails = fifthSubmissions.map((submission) => {
    const payload = parseSubmission(submission);
    return {
      id: submission.id,
      title: submission.title,
      leagueName: submission.leagueName,
      createdAt: submission.createdAt.toISOString(),
      importedAt: submission.importedAt?.toISOString() ?? null,
      adminNotes: submission.adminNotes,
      ...(payload.ok
        ? {
            jsonLeague: payload.leagueName,
            jsonSeason: payload.seasonName,
            submissionGames: payload.games,
            gameNumbers: payload.gameNumbers,
            dateRange:
              payload.gameDates.length > 0
                ? { earliest: payload.gameDates[0], latest: payload.gameDates.at(-1) }
                : null,
            teams: payload.teams
          }
        : { parseError: payload.error })
    };
  });

  const fifthLeagueSeasons = fifthLeague?.seasons ?? [];
  const season2026 = fifthLeagueSeasons.find((season) => season.seasonYear === 2026 || /2026/i.test(season.name));
  const season2025 = fifthLeagueSeasons.find((season) => season.seasonYear === 2025 || /2025/i.test(season.name));

  function summarizeSeason(season: (typeof fifthLeagueSeasons)[number] | undefined, label: string) {
    if (!season) return null;
    const teams = new Set<string>();
    for (const game of season.games) {
      teams.add(game.homeTeam.name);
      teams.add(game.awayTeam.name);
    }
    return {
      label,
      seasonId: season.id,
      seasonName: season.name,
      seasonYear: season.seasonYear,
      status: season.status,
      startsOn: season.startsOn.toISOString().slice(0, 10),
      endsOn: season.endsOn?.toISOString().slice(0, 10) ?? null,
      games: season.games.length,
      gameStats: season.games.reduce((sum, game) => sum + game._count.stats, 0),
      teams: Array.from(teams).sort(),
      teamCount: teams.size,
      dateRange:
        season.games.length > 0
          ? {
              earliest: season.games[0].gameDate.toISOString().slice(0, 10),
              latest: season.games.at(-1)!.gameDate.toISOString().slice(0, 10)
            }
          : null,
      sourceNames: Array.from(new Set(season.games.map((game) => game.sourceName))).sort(),
      games: season.games.map((game) => ({
        id: game.id,
        gameNumber: game.gameNumber,
        date: game.gameDate.toISOString().slice(0, 10),
        home: game.homeTeam.name,
        away: game.awayTeam.name,
        sourceName: game.sourceName,
        stats: game._count.stats
      }))
    };
  }

  const playoffSubmission = submissionDetails.find((row) => /playoff/i.test(row.title));
  const elimSubmission = submissionDetails.find((row) => /elimination/i.test(row.title));

  const playoffTeams = new Set(playoffSubmission && "teams" in playoffSubmission ? playoffSubmission.teams : []);
  const elimTeams = new Set(elimSubmission && "teams" in elimSubmission ? elimSubmission.teams : []);

  const playoffGamesAnywhere = await prisma.game.findMany({
    where: {
      deletedAt: null,
      OR: [
        { sourceName: { contains: "5th Stallion", mode: "insensitive" } },
        { sourceUrl: { contains: "5th", mode: "insensitive" } },
        {
          season: {
            league: { name: { contains: "5th Stallion", mode: "insensitive" }, deletedAt: null },
            deletedAt: null
          }
        }
      ]
    },
    select: {
      id: true,
      gameNumber: true,
      gameDate: true,
      sourceName: true,
      season: { select: { name: true, seasonYear: true, league: { select: { name: true } } } },
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } }
    },
    orderBy: { gameDate: "asc" }
  });

  const allStallion17Games = stallionLeagues
    .filter((league) => /17/i.test(league.name))
    .flatMap((league) =>
      league.seasons.flatMap((season) =>
        season.games.map((game) => ({
          league: league.name,
          season: season.name,
          seasonYear: season.seasonYear,
          gameNumber: game.gameNumber,
          date: game.gameDate.toISOString().slice(0, 10),
          home: game.homeTeam.name,
          away: game.awayTeam.name,
          sourceName: game.sourceName
        }))
      )
    );

  const playoffSubmissionGameNumbers = playoffSubmission && "gameNumbers" in playoffSubmission ? playoffSubmission.gameNumbers : [];
  const elimSubmissionGameNumbers = elimSubmission && "gameNumbers" in elimSubmission ? elimSubmission.gameNumbers : [];

  const dbGameNumbers2026 = new Set((season2026?.games ?? []).map((game) => game.gameNumber).filter(Boolean));
  const playoffNumbersMissingFromDb = playoffSubmissionGameNumbers.filter((num) => !dbGameNumbers2026.has(num));

  let verdict: "A_missing" | "B_mislinked" | "C_insufficient" = "C_insufficient";
  let verdictReason = "";

  const playoffDbIn2026 = season2026?.games.length ?? 0;
  const playoffSubmissionGames = playoffSubmission && "submissionGames" in playoffSubmission ? playoffSubmission.submissionGames : 0;
  const elimDbIn2026 = season2026?.games.length ?? 0;

  if (playoffSubmissionGames > 0 && playoffDbIn2026 === elimDbIn2026 && (season2025?.games.length ?? 0) === playoffSubmissionGames) {
    verdict = "B_mislinked";
    verdictReason =
      "Playoff submission exists and its game count matches Season 2025 DB games, not Season 2026. Playoffs appear imported under the wrong season year.";
  } else if (playoffSubmissionGames > 0 && playoffNumbersMissingFromDb.length === playoffSubmissionGameNumbers.length) {
    verdict = "A_missing";
    verdictReason = "Playoff submission JSON game numbers are not present in Season 2026 DB games.";
  } else if (playoffSubmissionGames === 0) {
    verdict = "A_missing";
    verdictReason = "No playoff submission payload found.";
  }

  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        mode: "read-only",
        fifthLeague: fifthLeague
          ? { id: fifthLeague.id, name: fifthLeague.name, ageGroup: fifthLeague.ageGroup, seasonCount: fifthLeague.seasons.length }
          : null,
        submissions: submissionDetails,
        seasonSummaries: {
          season2026: summarizeSeason(season2026, "Season 2026"),
          season2025: summarizeSeason(season2025, "Season 2025")
        },
        crossLeagueStallion17: Object.entries(
          allStallion17Games.reduce<Record<string, number>>((acc, game) => {
            const key = `${game.league} :: ${game.season} (${game.seasonYear})`;
            acc[key] = (acc[key] ?? 0) + 1;
            return acc;
          }, {})
        ).map(([key, count]) => ({ key, games: count })),
        teamComparison: {
          eliminationSubmissionTeams: elimTeams.size ? Array.from(elimTeams).sort() : [],
          playoffSubmissionTeams: playoffTeams.size ? Array.from(playoffTeams).sort() : [],
          teamsOnlyInPlayoffs: Array.from(playoffTeams).filter((team) => !elimTeams.has(team)).sort(),
          teamsOnlyInEliminations: Array.from(elimTeams).filter((team) => !playoffTeams.has(team)).sort(),
          season2026DbTeams: summarizeSeason(season2026, "Season 2026")?.teams ?? [],
          season2025DbTeams: summarizeSeason(season2025, "Season 2025")?.teams ?? []
        },
        playoffGameNumberCheck: {
          playoffSubmissionGameNumbers,
          elimSubmissionGameNumbers,
          dbGameNumbersSeason2026: Array.from(dbGameNumbers2026).sort(),
          dbGameNumbersSeason2025: Array.from(new Set((season2025?.games ?? []).map((g) => g.gameNumber).filter(Boolean))).sort(),
          playoffNumbersMissingFromSeason2026: playoffNumbersMissingFromDb
        },
        gamesFoundViaBroadSearch: playoffGamesAnywhere.map((game) => ({
          league: game.season.league.name,
          season: game.season.name,
          seasonYear: game.season.seasonYear,
          gameNumber: game.gameNumber,
          date: game.gameDate.toISOString().slice(0, 10),
          home: game.homeTeam.name,
          away: game.awayTeam.name,
          sourceName: game.sourceName
        })),
        counts: {
          fifthLeagueTotalGames: fifthLeagueSeasons.reduce((sum, season) => sum + season.games.length, 0),
          season2026Games: season2026?.games.length ?? 0,
          season2025Games: season2025?.games.length ?? 0,
          playoffSubmissionGames,
          elimSubmissionGames: elimSubmission && "submissionGames" in elimSubmission ? elimSubmission.submissionGames : 0
        },
        verdict,
        verdictReason
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
  .finally(async () => {
    await prisma.$disconnect();
  });
