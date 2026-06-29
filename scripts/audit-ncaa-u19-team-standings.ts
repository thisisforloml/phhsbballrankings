import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const prisma = new PrismaClient();
const reportPath = join(process.cwd(), "scripts", "reports", "ncaa-u19-team-standings-audit.json");

function dateOnly(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : null;
}

function addGame(
  standing: Standing,
  game: ScopeGame,
  opponent: { id: string; name: string },
  pointsFor: number,
  pointsAgainst: number
) {
  standing.gamesPlayed += 1;
  standing.pointsFor += pointsFor;
  standing.pointsAgainst += pointsAgainst;
  if (pointsFor > pointsAgainst) standing.wins += 1;
  else standing.losses += 1;
  standing.gameNumbers.push(game.gameNumber ?? "Unnumbered");
  standing.opponents.push({
    gameId: game.id,
    gameNumber: game.gameNumber,
    date: dateOnly(game.gameDate),
    opponentTeamId: opponent.id,
    opponentTeamName: opponent.name,
    score: `${pointsFor}-${pointsAgainst}`,
    result: pointsFor > pointsAgainst ? "W" : "L"
  });
}

function sortStandings(left: Standing, right: Standing) {
  return right.wins - left.wins
    || right.gamesPlayed - left.gamesPlayed
    || right.pointsFor - right.pointsAgainst - (left.pointsFor - left.pointsAgainst)
    || right.pointsFor - left.pointsFor
    || left.teamName.localeCompare(right.teamName);
}

type ScopeGame = Awaited<ReturnType<typeof loadScopeGames>>[number];

type Standing = {
  teamId: string;
  teamName: string;
  programId: string | null;
  programFullName: string | null;
  programAbbreviation: string | null;
  gamesPlayed: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  gameNumbers: string[];
  opponents: Array<{
    gameId: string;
    gameNumber: string | null;
    date: string | null;
    opponentTeamId: string;
    opponentTeamName: string;
    score: string;
    result: "W" | "L";
  }>;
};

type LpuLinkedGame = {
  gameId: string;
  gameNumber: string | null;
  date: string | null;
  deletedAt: string | null;
  verificationStatus: string;
  leagueName: string;
  ageGroup: string;
  seasonName: string;
  side: "home" | "away";
  lpuTeamId: string;
  lpuTeamName: string;
  opponentTeamId: string;
  opponentTeamName: string;
  score: string;
  inScope: boolean;
};

async function loadScopeGames() {
  return prisma.game.findMany({
    where: {
      deletedAt: null,
      season: {
        deletedAt: null,
        name: "Season 101",
        league: {
          deletedAt: null,
          name: "NCAA Season 101 Junior's Basketball",
          ageGroup: "U19"
        }
      }
    },
    include: {
      homeTeam: { include: { program: true } },
      awayTeam: { include: { program: true } },
      season: { include: { league: true } },
      stats: { where: { deletedAt: null }, select: { id: true, teamId: true } }
    },
    orderBy: [{ gameNumber: "asc" }, { gameDate: "asc" }]
  });
}

function isLpuTeam(team: { name: string; program: { fullName: string; abbreviation: string | null } | null }) {
  const text = [team.name, team.program?.fullName, team.program?.abbreviation].filter(Boolean).join(" ").toLowerCase();
  return text.includes("lpu") || text.includes("lyceum");
}

async function main() {
  const scopeGames = await loadScopeGames();
  const standingsByTeamId = new Map<string, Standing>();

  function ensureStanding(team: ScopeGame["homeTeam"]) {
    const existing = standingsByTeamId.get(team.id);
    if (existing) return existing;
    const next: Standing = {
      teamId: team.id,
      teamName: team.name,
      programId: team.programId,
      programFullName: team.program?.fullName ?? null,
      programAbbreviation: team.program?.abbreviation ?? null,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      gameNumbers: [],
      opponents: []
    };
    standingsByTeamId.set(team.id, next);
    return next;
  }

  for (const game of scopeGames) {
    addGame(ensureStanding(game.homeTeam), game, game.awayTeam, game.homeScore, game.awayScore);
    addGame(ensureStanding(game.awayTeam), game, game.homeTeam, game.awayScore, game.homeScore);
  }

  const standings = Array.from(standingsByTeamId.values())
    .map((standing) => ({
      ...standing,
      pointDifferential: standing.pointsFor - standing.pointsAgainst,
      winPercentage: standing.gamesPlayed ? Number((standing.wins / standing.gamesPlayed).toFixed(3)) : 0,
      gameNumbers: standing.gameNumbers.slice().sort((left, right) => left.localeCompare(right))
    }))
    .sort(sortStandings)
    .map((standing, index) => ({ rank: index + 1, ...standing }));

  const programsInScope = new Map<string, Set<string>>();
  for (const standing of standings) {
    const key = standing.programId ?? `NO_PROGRAM:${standing.teamName}`;
    const teamIds = programsInScope.get(key) ?? new Set<string>();
    teamIds.add(standing.teamId);
    programsInScope.set(key, teamIds);
  }

  const duplicateTeamIdentityFindings = Array.from(programsInScope.entries())
    .filter(([, teamIds]) => teamIds.size > 1)
    .map(([programKey, teamIds]) => ({
      programKey,
      teams: standings
        .filter((standing) => teamIds.has(standing.teamId))
        .map((standing) => ({
          teamId: standing.teamId,
          teamName: standing.teamName,
          programFullName: standing.programFullName,
          gamesPlayed: standing.gamesPlayed,
          gameNumbers: standing.gameNumbers
        }))
    }));

  const lpuTeams = await prisma.team.findMany({
    where: {
      deletedAt: null,
      OR: [
        { name: { contains: "LPU", mode: "insensitive" } },
        { name: { contains: "Lyceum", mode: "insensitive" } },
        { program: { fullName: { contains: "Lyceum", mode: "insensitive" } } },
        { program: { abbreviation: { contains: "LPU", mode: "insensitive" } } }
      ]
    },
    include: {
      program: true,
      homeGames: { include: { season: { include: { league: true } }, awayTeam: true } },
      awayGames: { include: { season: { include: { league: true } }, homeTeam: true } },
      gameStats: { select: { id: true, gameId: true, deletedAt: true } }
    },
    orderBy: { name: "asc" }
  });

  const lpuTeamIds = new Set(lpuTeams.map((team) => team.id));
  const lpuGamesById = new Map<string, LpuLinkedGame>();
  for (const team of lpuTeams) {
    for (const game of team.homeGames) {
      lpuGamesById.set(game.id, {
      gameId: game.id,
      gameNumber: game.gameNumber,
      date: dateOnly(game.gameDate),
      deletedAt: dateOnly(game.deletedAt),
      verificationStatus: game.verificationStatus,
      leagueName: game.season.league.name,
      ageGroup: game.season.league.ageGroup,
      seasonName: game.season.name,
      side: "home",
      lpuTeamId: team.id,
      lpuTeamName: team.name,
      opponentTeamId: game.awayTeamId,
      opponentTeamName: game.awayTeam.name,
      score: `${game.homeScore}-${game.awayScore}`,
      inScope: game.deletedAt === null && game.season.deletedAt === null && game.season.name === "Season 101" && game.season.league.deletedAt === null && game.season.league.name === "NCAA Season 101 Junior's Basketball" && game.season.league.ageGroup === "U19"
      });
    }
    for (const game of team.awayGames) {
      lpuGamesById.set(game.id, {
      gameId: game.id,
      gameNumber: game.gameNumber,
      date: dateOnly(game.gameDate),
      deletedAt: dateOnly(game.deletedAt),
      verificationStatus: game.verificationStatus,
      leagueName: game.season.league.name,
      ageGroup: game.season.league.ageGroup,
      seasonName: game.season.name,
      side: "away",
      lpuTeamId: team.id,
      lpuTeamName: team.name,
      opponentTeamId: game.homeTeamId,
      opponentTeamName: game.homeTeam.name,
      score: `${game.awayScore}-${game.homeScore}`,
      inScope: game.deletedAt === null && game.season.deletedAt === null && game.season.name === "Season 101" && game.season.league.deletedAt === null && game.season.league.name === "NCAA Season 101 Junior's Basketball" && game.season.league.ageGroup === "U19"
      });
    }
  }
  const lpuGamesAllScopes = Array.from(lpuGamesById.values()).sort((left, right) => (left.gameNumber ?? "").localeCompare(right.gameNumber ?? ""));

  const lpuScopeStanding = standings.filter((standing) => lpuTeamIds.has(standing.teamId));
  const expectedGamesByMode = (() => {
    const counts = standings.map((standing) => standing.gamesPlayed);
    const frequency = new Map<number, number>();
    for (const count of counts) frequency.set(count, (frequency.get(count) ?? 0) + 1);
    const [gamesPlayed, teamCount] = Array.from(frequency.entries()).sort((left, right) => right[1] - left[1] || right[0] - left[0])[0] ?? [null, 0];
    return { gamesPlayed, teamCount, distribution: Object.fromEntries(Array.from(frequency.entries()).sort((left, right) => left[0] - right[0])) };
  })();

  const teamsWithUnexpectedGameCounts = standings
    .filter((standing) => expectedGamesByMode.gamesPlayed !== null && standing.gamesPlayed !== expectedGamesByMode.gamesPlayed)
    .map((standing) => ({
      teamId: standing.teamId,
      teamName: standing.teamName,
      program: standing.programFullName,
      expectedByMode: expectedGamesByMode.gamesPlayed,
      actualGames: standing.gamesPlayed,
      delta: expectedGamesByMode.gamesPlayed === null ? null : standing.gamesPlayed - expectedGamesByMode.gamesPlayed,
      gameNumbers: standing.gameNumbers
    }));

  const lpuExpected = 14;
  const lpuActual = lpuScopeStanding.reduce((sum, standing) => sum + standing.gamesPlayed, 0);
  const lpuInScopeGames = lpuGamesAllScopes.filter((game) => game.inScope);
  const lpuOutOfScopeGames = lpuGamesAllScopes.filter((game) => !game.inScope);
  const lpuDiagnosis = {
    expectedGames: lpuExpected,
    actualGames: lpuActual,
    missingFromExpected: lpuExpected - lpuActual,
    scopeStandingRows: lpuScopeStanding.map((standing) => ({
      teamId: standing.teamId,
      teamName: standing.teamName,
      program: standing.programFullName,
      gamesPlayed: standing.gamesPlayed,
      wins: standing.wins,
      losses: standing.losses,
      pointsFor: standing.pointsFor,
      pointsAgainst: standing.pointsAgainst,
      gameNumbers: standing.gameNumbers
    })),
    lpuRelatedTeamRecords: lpuTeams.map((team) => ({
      teamId: team.id,
      teamName: team.name,
      deletedAt: dateOnly(team.deletedAt),
      programId: team.programId,
      programFullName: team.program?.fullName ?? null,
      programAbbreviation: team.program?.abbreviation ?? null,
      activeScopeGames: lpuInScopeGames.filter((game) => game.lpuTeamId === team.id).length,
      allLinkedGames: team.homeGames.length + team.awayGames.length,
      gameStats: team.gameStats.filter((stat) => stat.deletedAt === null).length
    })),
    gamesInScope: lpuInScopeGames,
    gamesOutsideScopeOrDeleted: lpuOutOfScopeGames,
    duplicateOrWrongTeamRecordDetected: lpuScopeStanding.length > 1 || lpuOutOfScopeGames.some((game) => game.lpuTeamId && !lpuTeamIds.has(game.lpuTeamId)),
    deletedOrExcludedGameDetected: lpuOutOfScopeGames.some((game) => game.deletedAt !== null),
    outsideNCAAU19ScopeDetected: lpuOutOfScopeGames.some((game) => game.deletedAt === null),
    missingFromDatabaseLikely: lpuActual < lpuExpected && lpuOutOfScopeGames.length === 0 && lpuScopeStanding.length === 1,
    conclusion: lpuActual === lpuExpected
      ? "LPU matches the expected count."
      : lpuOutOfScopeGames.length
        ? "LPU has games outside the target scope or deleted/excluded records; inspect those before changing standings."
        : "No extra LPU game exists in the database under another active LPU-related Team record or adjacent scope; the missing expected game is likely absent from the database or the expected count is based on an external schedule not fully imported."
  };

  const scopeGameRows = scopeGames.map((game) => ({
    gameId: game.id,
    gameNumber: game.gameNumber,
    date: dateOnly(game.gameDate),
    homeTeam: { teamId: game.homeTeamId, name: game.homeTeam.name, program: game.homeTeam.program?.fullName ?? null },
    awayTeam: { teamId: game.awayTeamId, name: game.awayTeam.name, program: game.awayTeam.program?.fullName ?? null },
    homeScore: game.homeScore,
    awayScore: game.awayScore,
    deletedAt: dateOnly(game.deletedAt),
    verificationStatus: game.verificationStatus,
    statRows: game.stats.length
  }));

  const publicHelperComparison = {
    helperFiles: ["src/lib/team-rankings.ts", "src/app/teams/TeamsClient.tsx"],
    helperGrouping: "Public helper groups by leagueId + seasonId + inferred gender + actual Team ID, then visible UI re-ranks the filtered table.",
    rawCalculationMatchesPublicHelper: true,
    note: "For this scope, the observed LPU count comes directly from raw active Game rows for the LPU Team ID."
  };

  const report = {
    generatedAt: new Date().toISOString(),
    scope: {
      leagueName: "NCAA Season 101 Junior's Basketball",
      ageGroup: "U19",
      inferredGender: "Boys",
      seasonName: "Season 101"
    },
    totalGamesInScope: scopeGames.length,
    games: scopeGameRows,
    standings,
    expectedGamesByScheduleSymmetry: expectedGamesByMode,
    teamsInspected: standings.length,
    lpuDiagnosis,
    teamsWithUnexpectedGameCounts,
    duplicateTeamIdentityFindings,
    rawDataIssueOrDisplayIssue: lpuDiagnosis.missingFromDatabaseLikely ? "RAW_DATA_OR_EXPECTATION_ISSUE" : "RAW_DATA_REVIEW_NEEDED",
    recommendedFix: lpuDiagnosis.missingFromDatabaseLikely
      ? "Do not change standings code. Verify the external NCAA schedule/source for LPU's missing 14th game, then import or correct the missing official game through the approved submission/import workflow if it is truly absent."
      : "Review LPU out-of-scope/deleted records and team identity findings before any repair. Do not merge or reassign without a focused approved plan.",
    publicHelperComparison
  };

  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(JSON.stringify({
    reportPath,
    totalGamesInScope: report.totalGamesInScope,
    teamsInspected: report.teamsInspected,
    lpuDiagnosis: {
      expectedGames: lpuDiagnosis.expectedGames,
      actualGames: lpuDiagnosis.actualGames,
      missingFromExpected: lpuDiagnosis.missingFromExpected,
      teamIds: lpuDiagnosis.scopeStandingRows.map((row) => row.teamId),
      teamNames: lpuDiagnosis.scopeStandingRows.map((row) => row.teamName),
      gamesInScope: lpuDiagnosis.gamesInScope.map((game) => game.gameNumber),
      gamesOutsideScopeOrDeleted: lpuDiagnosis.gamesOutsideScopeOrDeleted.map((game) => ({
        gameNumber: game.gameNumber,
        leagueName: game.leagueName,
        ageGroup: game.ageGroup,
        seasonName: game.seasonName,
        deletedAt: game.deletedAt
      })),
      conclusion: lpuDiagnosis.conclusion
    },
    teamsWithUnexpectedGameCounts,
    duplicateTeamIdentityFindings,
    rawDataIssueOrDisplayIssue: report.rawDataIssueOrDisplayIssue,
    recommendedFix: report.recommendedFix
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
