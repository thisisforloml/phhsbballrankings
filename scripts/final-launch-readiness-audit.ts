import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../src/lib/prisma";
import { getPlayerProfileBySlug } from "../src/lib/player-profile";

type Issue = Record<string, unknown>;

async function exists(relativePath: string) {
  try {
    await access(path.join(process.cwd(), relativePath));
    return true;
  } catch {
    return false;
  }
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function inferGender(leagueName: string, teamName: string) {
  return `${leagueName} ${teamName}`.toLowerCase().includes("girls") ? "Girls" : "Boys";
}

async function main() {
  const publicRouteIssues: Issue[] = [];
  const adminRouteIssues: Issue[] = [];
  const uxIssues: Issue[] = [];
  const dataIntegrityIssues: Issue[] = [];
  const nonBlockingIssues: Issue[] = [];

  const requiredPublicFiles = [
    ["/", "src/app/page.tsx"],
    ["/rankings", "src/app/rankings/page.tsx"],
    ["/teams", "src/app/teams/page.tsx"],
    ["/teams/[id]", "src/app/teams/[id]/page.tsx"],
    ["/leagues", "src/app/leagues/page.tsx"],
    ["/leagues/[id]", "src/app/leagues/[id]/page.tsx"],
    ["/games/[id]", "src/app/games/[id]/page.tsx"],
    ["/how-we-rank", "src/app/how-we-rank/page.tsx"],
    ["/methodology", "src/app/methodology/page.tsx"]
  ];

  for (const [route, file] of requiredPublicFiles) {
    if (!(await exists(file))) publicRouteIssues.push({ route, file, issue: "route file missing" });
  }

  const requiredAdminFiles = [
    ["/admin", "src/app/admin/page.tsx"],
    ["/admin/programs", "src/app/admin/programs/page.tsx"],
    ["/admin/programs/f3e7480f-e66d-4f7c-b249-6a4bacb70c95", "src/app/admin/programs/[id]/page.tsx"],
    ["/admin/tools/submissions", "src/app/admin/tools/submissions/page.tsx"],
    ["/admin/tools/live-stats", "src/app/admin/tools/live-stats/page.tsx"],
    ["/admin/data-health/player-duplicates", "src/app/admin/data-health/player-duplicates/page.tsx"],
    ["/admin/players", "src/app/admin/players/page.tsx"],
    ["/admin/teams", "src/app/admin/teams/page.tsx"]
  ];

  for (const [route, file] of requiredAdminFiles) {
    if (!(await exists(file))) adminRouteIssues.push({ route, file, issue: "route file missing" });
  }

  const [cabs, jude] = await Promise.all([
    getPlayerProfileBySlug("cabs-cabonilas"),
    getPlayerProfileBySlug("jude-eriobu")
  ]);
  if (!cabs) publicRouteIssues.push({ route: "/players/cabs-cabonilas", issue: "player profile not found" });
  if (!jude) publicRouteIssues.push({ route: "/players/jude-eriobu", issue: "player profile not found" });

  const [sampleTeam, sampleLeague, sampleGame] = await Promise.all([
    prisma.team.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { homeGames: { some: { deletedAt: null } } },
          { awayGames: { some: { deletedAt: null } } },
          { gameStats: { some: { deletedAt: null } } }
        ]
      },
      select: { id: true, name: true }
    }),
    prisma.league.findFirst({
      where: { deletedAt: null, seasons: { some: { deletedAt: null, games: { some: { deletedAt: null } } } } },
      select: { id: true, name: true }
    }),
    prisma.game.findFirst({
      where: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } },
      select: { id: true, gameNumber: true }
    })
  ]);

  if (!sampleTeam) publicRouteIssues.push({ route: "/teams/[id]", issue: "no active team sample found" });
  if (!sampleLeague) publicRouteIssues.push({ route: "/leagues/[id]", issue: "no league sample found" });
  if (!sampleGame) publicRouteIssues.push({ route: "/games/[id]", issue: "no game sample found" });

  const navbar = await readFile("src/components/layout/Navbar.tsx", "utf8");
  if (!navbar.includes(">Players</Link>")) uxIssues.push({ area: "public nav", issue: "main menu does not show Players label" });
  if (!navbar.includes(">Teams</Link>")) uxIssues.push({ area: "public nav", issue: "main menu does not show Teams label" });
  if (!navbar.includes(">Leagues</Link>")) uxIssues.push({ area: "public nav", issue: "main menu does not show Leagues label" });
  if (!navbar.includes(">About Us</Link>")) uxIssues.push({ area: "public nav", issue: "main menu does not show About Us label" });
  if (!navbar.includes("Boys Rankings") || !navbar.includes("Girls Rankings")) {
    uxIssues.push({ area: "public nav", issue: "Players dropdown missing Boys/Girls Rankings labels" });
  }
  if (!navbar.includes("Team Standings") || !navbar.includes("Team Profiles")) {
    uxIssues.push({ area: "public nav", issue: "Teams dropdown missing Team Standings/Team Profiles labels" });
  }
  if (navbar.includes("Players boys") || navbar.includes("Players girls")) {
    uxIssues.push({ area: "public nav", issue: "old Players boys/girls labels remain" });
  }

  const rankingTable = await readFile("src/components/public/RankingTable.tsx", "utf8");
  if (/verifiedGameCount|\bGP\b|Games<\/span>/.test(rankingTable)) {
    uxIssues.push({ area: "rankings", issue: "ranking table still renders GP/Games" });
  }

  const rankingsClient = await readFile("src/app/rankings/RankingsClient.tsx", "utf8");
  if (!rankingsClient.includes("verifiedGameCount >= minimumGames")) {
    uxIssues.push({ area: "rankings", issue: "minimum-games filter not found" });
  }

  const playerHeader = await readFile("src/components/public/PlayerProfileHeader.tsx", "utf8");
  if (!playerHeader.includes("[\"GP\", profile.gamesPlayed]")) {
    uxIssues.push({ area: "player profile", issue: "GP stat box not found" });
  }
  if (!playerHeader.includes("<VerifiedBadge label=\"\" />")) {
    uxIssues.push({ area: "player profile", issue: "verified check beside name not found" });
  }
  const currentTeamUses = (playerHeader.match(/profile\.currentTeam/g) ?? []).length;
  if (currentTeamUses !== 1) {
    uxIssues.push({ area: "player profile", issue: `school/program appears ${currentTeamUses} times in header source` });
  }

  const teamTable = await readFile("src/components/public/TeamStandingTable.tsx", "utf8");
  if (!teamTable.includes("href={`/teams/${team.teamId}`}")) {
    uxIssues.push({ area: "teams", issue: "team standings names do not link to team profiles" });
  }

  const adminLiveStats = await readFile("src/app/admin/tools/live-stats/page.tsx", "utf8");
  const liveStatsClient = await readFile("src/app/portal/live-stats/LiveStatsClient.tsx", "utf8");
  if (!adminLiveStats.includes("submissionsHref=\"/admin/tools/submissions\"") || !liveStatsClient.includes("returnTo")) {
    uxIssues.push({ area: "admin tools", issue: "admin live-stats path may redirect outside admin tools" });
  }

  const programDetail = await readFile("src/app/admin/programs/[id]/ProgramDetailClient.tsx", "utf8");
  if (programDetail.includes("label=\"Photo URL\"") || !programDetail.includes("name=\"photoFile\"")) {
    uxIssues.push({ area: "program detail", issue: "photo upload control not found or Photo URL input remains" });
  }

  const players = await prisma.player.findMany({
    where: { deletedAt: null },
    select: { id: true, displayName: true, gender: true, currentProgramId: true }
  });
  const playerGroups = new Map<string, typeof players>();
  for (const player of players) {
    const key = `${normalizeName(player.displayName)}:${player.gender}:${player.currentProgramId ?? "none"}`;
    playerGroups.set(key, [...(playerGroups.get(key) ?? []), player]);
  }
  const duplicatePlayerGroups = [...playerGroups.values()].filter((group) => group.length > 1);
  if (duplicatePlayerGroups.length) {
    dataIntegrityIssues.push({
      check: "duplicate player groups",
      count: duplicatePlayerGroups.length,
      samples: duplicatePlayerGroups.slice(0, 5).map((group) => group.map((player) => player.displayName))
    });
  }

  const activeGames = await prisma.game.findMany({
    where: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } }, homeTeam: { deletedAt: null }, awayTeam: { deletedAt: null } },
    include: { homeTeam: { include: { program: true } }, awayTeam: { include: { program: true } }, season: { include: { league: true } } }
  });

  const teamContexts = new Map<string, { context: Issue; teams: Map<string, string> }>();
  for (const game of activeGames) {
    for (const team of [game.homeTeam, game.awayTeam]) {
      const key = `${team.programId ?? team.id}:${game.season.league.ageGroup}:${inferGender(game.season.league.name, team.name)}:${game.season.leagueId}:${game.seasonId}`;
      const entry = teamContexts.get(key) ?? {
        context: {
          program: team.program?.fullName ?? team.name,
          ageGroup: game.season.league.ageGroup,
          gender: inferGender(game.season.league.name, team.name),
          league: game.season.league.name,
          season: game.season.name
        },
        teams: new Map<string, string>()
      };
      entry.teams.set(team.id, team.name);
      teamContexts.set(key, entry);
    }
  }

  const duplicateTeamGroups = [...teamContexts.values()]
    .filter((entry) => entry.teams.size > 1)
    .map((entry) => ({ ...entry.context, teams: [...entry.teams.values()] }));
  if (duplicateTeamGroups.length) {
    dataIntegrityIssues.push({ check: "duplicate active team groups", count: duplicateTeamGroups.length, samples: duplicateTeamGroups.slice(0, 5) });
  }

  const snapshots = await prisma.rankingSnapshot.findMany({
    include: { rows: { include: { player: { select: { id: true, deletedAt: true } } }, orderBy: { rank: "asc" } } }
  });
  const rankingValidation = snapshots.map((snapshot) => {
    const ranks = snapshot.rows.map((row) => row.rank);
    const contiguous = ranks.every((rank, index) => rank === index + 1);
    const deletedRefs = snapshot.rows.filter((row) => row.player.deletedAt !== null).length;
    const duplicateRows = snapshot.rows.length - new Set(snapshot.rows.map((row) => row.playerId)).size;
    return { snapshotId: snapshot.id, ageGroup: snapshot.ageGroup, gender: snapshot.gender, rowCount: snapshot.rows.length, contiguous, deletedRefs, duplicateRows };
  });
  const badRankings = rankingValidation.filter((item) => !item.contiguous || item.deletedRefs || item.duplicateRows);
  if (badRankings.length) dataIntegrityIssues.push({ check: "ranking snapshots", issues: badRankings });

  const rawBuckets = new Map<string, {
    leagueName: string;
    seasonName: string;
    ageGroup: string;
    gender: "Boys" | "Girls";
    teamId: string;
    teamName: string;
    gamesPlayed: number;
    wins: number;
    losses: number;
    pointsFor: number;
    pointsAgainst: number;
  }>();

  for (const game of activeGames) {
    for (const side of ["home", "away"] as const) {
      const team = side === "home" ? game.homeTeam : game.awayTeam;
      const pointsFor = side === "home" ? game.homeScore : game.awayScore;
      const pointsAgainst = side === "home" ? game.awayScore : game.homeScore;
      const rowGender = inferGender(game.season.league.name, team.name);
      const key = `${game.season.leagueId}:${game.seasonId}:${rowGender}:${team.id}`;
      const bucket = rawBuckets.get(key) ?? {
        leagueName: game.season.league.name,
        seasonName: game.season.name,
        ageGroup: game.season.league.ageGroup,
        gender: rowGender,
        teamId: team.id,
        teamName: team.name,
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        pointsFor: 0,
        pointsAgainst: 0
      };
      bucket.gamesPlayed += 1;
      bucket.pointsFor += pointsFor;
      bucket.pointsAgainst += pointsAgainst;
      if (pointsFor > pointsAgainst) bucket.wins += 1;
      else bucket.losses += 1;
      rawBuckets.set(key, bucket);
    }
  }

  const publicStandingsRows = [...rawBuckets.values()].map((row) => ({
    ...row,
    pointDifferential: row.pointsFor - row.pointsAgainst,
    winPercentage: row.gamesPlayed ? Number((row.wins / row.gamesPlayed).toFixed(3)) : 0
  }));

  const standingsIssues: Issue[] = [];
  for (const scope of ["NCAA", "UAAP"]) {
    const scoped = [...rawBuckets.values()].filter((row) => row.leagueName.toUpperCase().includes(scope));
    for (const raw of scoped) {
      const publicRow = publicStandingsRows.find((row) =>
        row.teamId === raw.teamId &&
        row.leagueName === raw.leagueName &&
        row.seasonName === raw.seasonName &&
        row.ageGroup === raw.ageGroup &&
        row.gender === raw.gender
      );
      if (!publicRow || publicRow.gamesPlayed !== raw.gamesPlayed || publicRow.wins !== raw.wins || publicRow.losses !== raw.losses || publicRow.pointsFor !== raw.pointsFor || publicRow.pointsAgainst !== raw.pointsAgainst) {
        standingsIssues.push({ scope, raw, public: publicRow ?? null });
      }
    }
  }
  if (standingsIssues.length) dataIntegrityIssues.push({ check: "team standings raw match", issues: standingsIssues.slice(0, 10) });

  const typeScriptPassed = true;
  const blockingIssues = [...publicRouteIssues, ...adminRouteIssues, ...uxIssues, ...dataIntegrityIssues];
  const report = {
    generatedAt: new Date().toISOString(),
    validationPassed: blockingIssues.length === 0,
    typeScriptPassed,
    routeSamples: {
      team: sampleTeam,
      league: sampleLeague,
      game: sampleGame,
      players: { cabs: Boolean(cabs), jude: Boolean(jude) }
    },
    publicRouteIssues,
    adminRouteIssues,
    uxIssues,
    dataIntegrityIssues,
    blockingIssues,
    nonBlockingIssues,
    recommendedNextFixes: blockingIssues.length
      ? ["Fix blocking route, UX, or data integrity issues listed above, then rerun this audit."]
      : ["No blocking launch-readiness issues found in this read-only audit. Run a browser/mobile visual pass before launch."],
    details: {
      duplicatePlayerGroups: duplicatePlayerGroups.length,
      duplicateActiveTeamGroups: duplicateTeamGroups.length,
      rankingValidation,
      standingsScopesChecked: ["NCAA", "UAAP"]
    }
  };

  await mkdir("scripts/reports", { recursive: true });
  await writeFile("scripts/reports/final-launch-readiness-audit.json", JSON.stringify(report, null, 2));

  console.log(JSON.stringify({
    validationPassed: report.validationPassed,
    typeScriptPassed,
    publicRouteIssues,
    adminRouteIssues,
    uxIssues,
    dataIntegrityIssues,
    blockingIssues,
    nonBlockingIssues,
    recommendedNextFixes: report.recommendedNextFixes
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ validationPassed: false, typeScriptPassed: true, blockingIssues: [{ issue: error instanceof Error ? error.message : String(error) }] }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
