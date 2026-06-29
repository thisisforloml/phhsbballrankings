/**
 * Read-only investigation of specific team identity split pairs.
 * Usage: npx tsx scripts/investigate-team-identity-splits.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { prisma } from "../src/lib/prisma";

const PAIRS = [
  { label: "BistroLeCoucou vs Bistro Le Coucou", patterns: ["bistro", "coucou"] },
  { label: "Smile 360 Bullies vs Smile 360 Bullies U13 Boys", patterns: ["smile 360"] }
] as const;

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function overlapPercent(a: Set<string>, b: Set<string>) {
  if (!a.size && !b.size) return 0;
  const intersection = [...a].filter((id) => b.has(id)).length;
  const union = new Set([...a, ...b]).size;
  return union ? Number(((intersection / union) * 100).toFixed(1)) : 0;
}

function jaccardPercent(a: Set<string>, b: Set<string>) {
  if (!a.size && !b.size) return 0;
  const intersection = [...a].filter((id) => b.has(id)).length;
  const union = new Set([...a, ...b]).size;
  return union ? Number(((intersection / union) * 100).toFixed(1)) : 0;
}

async function loadTeamBundle(teamId: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      program: { select: { id: true, fullName: true } }
    }
  });
  if (!team) return null;

  const gameStats = await prisma.gameStat.findMany({
    where: { deletedAt: null, teamId },
    select: {
      id: true,
      playerId: true,
      gameId: true,
      game: {
        select: {
          id: true,
          gameNumber: true,
          gameDate: true,
          homeTeamId: true,
          awayTeamId: true,
          season: {
            select: {
              id: true,
              name: true,
              league: { select: { id: true, name: true, ageGroup: true } }
            }
          }
        }
      }
    }
  });

  const gameIds = new Set(gameStats.map((stat) => stat.gameId));
  const playerIds = new Set(gameStats.map((stat) => stat.playerId));

  const games = await prisma.game.findMany({
    where: {
      deletedAt: null,
      OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }]
    },
    include: {
      season: {
        select: {
          id: true,
          name: true,
          league: { select: { id: true, name: true, ageGroup: true } }
        }
      },
      homeTeam: { select: { id: true, name: true } },
      awayTeam: { select: { id: true, name: true } }
    },
    orderBy: { gameDate: "asc" }
  });

  const contexts = new Map<string, { leagueId: string; leagueName: string; seasonId: string; seasonName: string; ageGroup: string; games: number; gameStats: number }>();
  for (const stat of gameStats) {
    const league = stat.game.season.league;
    const season = stat.game.season;
    const key = `${league.id}|${season.id}`;
    const row = contexts.get(key) ?? {
      leagueId: league.id,
      leagueName: league.name,
      seasonId: season.id,
      seasonName: season.name,
      ageGroup: league.ageGroup,
      games: 0,
      gameStats: 0
    };
    row.gameStats += 1;
    contexts.set(key, row);
  }
  for (const game of games) {
    const league = game.season.league;
    const season = game.season;
    const key = `${league.id}|${season.id}`;
    const row = contexts.get(key) ?? {
      leagueId: league.id,
      leagueName: league.name,
      seasonId: season.id,
      seasonName: season.name,
      ageGroup: league.ageGroup,
      games: 0,
      gameStats: 0
    };
    row.games += 1;
    contexts.set(key, row);
  }

  const rosterSeasons = await prisma.playerTeamSeason.findMany({
    where: { teamId },
    select: {
      playerId: true,
      season: {
        select: {
          id: true,
          name: true,
          league: { select: { id: true, name: true, ageGroup: true } }
        }
      }
    }
  });
  const rosterPlayerIds = new Set(rosterSeasons.map((row) => row.playerId));

  return {
    teamId: team.id,
    teamName: team.name,
    programId: team.programId,
    programName: team.program?.fullName ?? null,
    gameCount: games.length,
    gameStatCount: gameStats.length,
    uniquePlayersFromStats: playerIds.size,
    uniquePlayersFromRoster: rosterPlayerIds.size,
    playerIds,
    rosterPlayerIds,
    contexts: [...contexts.values()],
    games: games.map((game) => ({
      gameId: game.id,
      gameNumber: game.gameNumber,
      gameDate: game.gameDate.toISOString(),
      league: game.season.league.name,
      season: game.season.name,
      ageGroup: game.season.league.ageGroup,
      homeTeamId: game.homeTeamId,
      awayTeamId: game.awayTeamId,
      homeTeamName: game.homeTeam.name,
      awayTeamName: game.awayTeam.name,
      opponentTeamId: game.homeTeamId === teamId ? game.awayTeamId : game.homeTeamId,
      opponentTeamName: game.homeTeamId === teamId ? game.awayTeam.name : game.homeTeam.name
    })),
    gameDates: games.map((game) => game.gameDate.toISOString().slice(0, 10))
  };
}

async function findTeamsForPattern(pattern: string) {
  const teams = await prisma.team.findMany({
    where: { deletedAt: null, name: { contains: pattern, mode: "insensitive" } },
    include: { program: { select: { id: true, fullName: true } } },
    orderBy: { name: "asc" }
  });
  return teams;
}

async function investigatePair(label: string, patterns: readonly string[]) {
  const allTeams = new Map<string, Awaited<ReturnType<typeof findTeamsForPattern>>[number]>();
  for (const pattern of patterns) {
    for (const team of await findTeamsForPattern(pattern)) {
      allTeams.set(team.id, team);
    }
  }

  const candidateTeams = [...allTeams.values()];
  const bundles = (
    await Promise.all(candidateTeams.map((team) => loadTeamBundle(team.id)))
  ).filter((bundle): bundle is NonNullable<typeof bundle> => bundle !== null);

  // For Bistro pair, narrow to the two closest names if more than 2 found
  let teamA: (typeof bundles)[number] | undefined;
  let teamB: (typeof bundles)[number] | undefined;

  if (label.includes("Bistro")) {
    const bistroTeams = bundles.filter((bundle) => normalizeName(bundle.teamName).includes("bistro"));
    teamA = bistroTeams.find((bundle) => normalizeName(bundle.teamName).replace(/\s+/g, "") === "bistrolecoucou");
    teamB = bistroTeams.find((bundle) => normalizeName(bundle.teamName) === "bistro le coucou");
    if (!teamA || !teamB) {
      const sorted = bistroTeams.sort((left, right) => left.teamName.localeCompare(right.teamName));
      teamA = sorted[0];
      teamB = sorted[1];
    }
  } else {
    teamA = bundles.find((bundle) => normalizeName(bundle.teamName) === "smile 360 bullies");
    teamB = bundles.find((bundle) => normalizeName(bundle.teamName).includes("u13"));
  }

  if (!teamA || !teamB || teamA.teamId === teamB.teamId) {
    return {
      pair: label,
      error: "Could not resolve two distinct teams for pair",
      candidatesFound: bundles.map((bundle) => ({
        teamId: bundle.teamId,
        teamName: bundle.teamName,
        programId: bundle.programId,
        programName: bundle.programName,
        games: bundle.gameCount,
        gameStats: bundle.gameStatCount
      }))
    };
  }

  const sharedGameIds = teamA.games
    .map((game) => game.gameId)
    .filter((gameId) => teamB.games.some((other) => other.gameId === gameId));
  const sharedGameDates = [...new Set(
    teamA.gameDates.filter((date) => teamB.gameDates.includes(date))
  )];

  const opponentsA = new Set(teamA.games.map((game) => game.opponentTeamId));
  const opponentsB = new Set(teamB.games.map((game) => game.opponentTeamId));
  const sharedOpponents = [...opponentsA].filter((id) => opponentsB.has(id));

  const opponentDetails = await prisma.team.findMany({
    where: { id: { in: sharedOpponents } },
    select: { id: true, name: true }
  });

  const sharedContexts = teamA.contexts.filter((ctxA) =>
    teamB.contexts.some((ctxB) => ctxA.leagueId === ctxB.leagueId && ctxA.seasonId === ctxB.seasonId)
  );

  const playerOverlapFromStats = jaccardPercent(teamA.playerIds, teamB.playerIds);
  const rosterOverlap = jaccardPercent(teamA.rosterPlayerIds, teamB.rosterPlayerIds);

  return {
    pair: label,
    teamA,
    teamB,
    crossProgram: teamA.programId !== teamB.programId,
    sharedCompetitions: sharedContexts,
    sharedGames: sharedGameIds,
    sharedGameDates,
    sharedOpponents: opponentDetails.map((team) => ({ teamId: team.id, teamName: team.name })),
    overlap: {
      playerOverlapPercent: playerOverlapFromStats,
      rosterOverlapPercent: rosterOverlap,
      sharedOpponentCount: sharedOpponents.length
    },
    allCandidates: bundles.map((bundle) => ({
      teamId: bundle.teamId,
      teamName: bundle.teamName,
      programId: bundle.programId,
      programName: bundle.programName,
      games: bundle.gameCount,
      gameStats: bundle.gameStatCount,
      contexts: bundle.contexts
    }))
  };
}

async function main() {
  const results = [];
  for (const pair of PAIRS) {
    results.push(await investigatePair(pair.label, pair.patterns));
  }

  const outputPath = join(process.cwd(), "scripts", "reports", "team-identity-split-investigation.json");
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify({ generatedAt: new Date().toISOString(), mode: "read-only", results }, null, 2));
  console.log(JSON.stringify({ outputPath, results }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
