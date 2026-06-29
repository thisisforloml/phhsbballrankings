import { prisma } from "../src/lib/prisma";
import { getUaapSchoolDisplayName } from "../src/lib/uaap-school-display";

function publicTeamDisplayName(internalName: string) {
  const alias = internalName.replace(/\s+U(?:13|16|19)\s+(?:Boys|Girls)$/i, "").trim();
  return getUaapSchoolDisplayName(alias || internalName);
}

function inferGender(...values: Array<string | null | undefined>) {
  return values.filter(Boolean).join(" ").toLowerCase().includes("girls") ? "Girls" : "Boys";
}

type TeamRecord = {
  teamId: string;
  teamName: string;
  publicSchoolDisplayName: string;
  ageGroup: string;
  gender: string;
  leagueId: string;
  league: string;
  seasonId: string;
  season: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDifferential: number;
  gameStatsCount: number;
  gameNumbers: string[];
};

function keyFor(parts: Array<string | null | undefined>) {
  return parts.map((part) => part ?? "").join("|");
}

async function main() {
  const games = await prisma.game.findMany({
    where: {
      deletedAt: null,
      season: { deletedAt: null, league: { deletedAt: null } },
      homeTeam: { deletedAt: null },
      awayTeam: { deletedAt: null }
    },
    include: {
      homeTeam: true,
      awayTeam: true,
      season: { include: { league: true } },
      stats: { where: { deletedAt: null }, select: { id: true, teamId: true } }
    },
    orderBy: [{ gameDate: "asc" }, { gameNumber: "asc" }]
  });

  const teams = new Map<string, TeamRecord>();

  for (const game of games) {
    const scope = {
      ageGroup: game.season.league.ageGroup,
      leagueId: game.season.leagueId,
      league: game.season.league.name,
      seasonId: game.seasonId,
      season: game.season.name
    };

    for (const side of ["home", "away"] as const) {
      const team = side === "home" ? game.homeTeam : game.awayTeam;
      const pointsFor = side === "home" ? game.homeScore : game.awayScore;
      const pointsAgainst = side === "home" ? game.awayScore : game.homeScore;
      const gender = inferGender(scope.league, team.name);
      const publicSchoolDisplayName = publicTeamDisplayName(team.name);
      const teamKey = keyFor([scope.ageGroup, gender, scope.leagueId, scope.seasonId, team.id]);
      const existing = teams.get(teamKey) ?? {
        teamId: team.id,
        teamName: team.name,
        publicSchoolDisplayName,
        ageGroup: scope.ageGroup,
        gender,
        leagueId: scope.leagueId,
        league: scope.league,
        seasonId: scope.seasonId,
        season: scope.season,
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        pointDifferential: 0,
        gameStatsCount: 0,
        gameNumbers: []
      };

      existing.gamesPlayed += 1;
      existing.wins += pointsFor > pointsAgainst ? 1 : 0;
      existing.losses += pointsFor > pointsAgainst ? 0 : 1;
      existing.pointsFor += pointsFor;
      existing.pointsAgainst += pointsAgainst;
      existing.pointDifferential = existing.pointsFor - existing.pointsAgainst;
      existing.gameStatsCount += game.stats.filter((stat) => stat.teamId === team.id).length;
      if (game.gameNumber) existing.gameNumbers.push(game.gameNumber);
      teams.set(teamKey, existing);
    }
  }

  const teamRows = [...teams.values()].sort((a, b) => a.ageGroup.localeCompare(b.ageGroup)
    || a.gender.localeCompare(b.gender)
    || a.league.localeCompare(b.league)
    || a.season.localeCompare(b.season)
    || a.publicSchoolDisplayName.localeCompare(b.publicSchoolDisplayName)
    || a.teamName.localeCompare(b.teamName));

  const byPublicSchoolScope = new Map<string, TeamRecord[]>();
  for (const row of teamRows) {
    const key = keyFor([row.ageGroup, row.gender, row.leagueId, row.seasonId, row.publicSchoolDisplayName]);
    byPublicSchoolScope.set(key, [...(byPublicSchoolScope.get(key) ?? []), row]);
  }

  const duplicatePublicSchoolDisplayNames = [...byPublicSchoolScope.values()]
    .filter((rows) => rows.length > 1)
    .map((rows) => ({
      publicSchoolDisplayName: rows[0].publicSchoolDisplayName,
      ageGroup: rows[0].ageGroup,
      gender: rows[0].gender,
      leagueId: rows[0].leagueId,
      league: rows[0].league,
      seasonId: rows[0].seasonId,
      season: rows[0].season,
      internalTeamRecords: rows.map((row) => ({
        teamId: row.teamId,
        teamName: row.teamName,
        gamesPlayed: row.gamesPlayed,
        wins: row.wins,
        losses: row.losses,
        pointsFor: row.pointsFor,
        pointsAgainst: row.pointsAgainst,
        pointDifferential: row.pointDifferential,
        gameStatsCount: row.gameStatsCount,
        gameNumbers: row.gameNumbers
      }))
    }));

  const targetAliases = new Set(["DLSU", "DLSZ", "LA SALLE", "DE LA SALLE SANTIAGO ZOBEL"]);
  const deLaSalleChecks = teamRows
    .filter((row) => targetAliases.has(row.teamName.toUpperCase()) || row.publicSchoolDisplayName === "De La Salle Santiago Zobel")
    .map((row) => ({
      publicSchoolDisplayName: row.publicSchoolDisplayName,
      ageGroup: row.ageGroup,
      gender: row.gender,
      leagueId: row.leagueId,
      league: row.league,
      seasonId: row.seasonId,
      season: row.season,
      teamId: row.teamId,
      teamName: row.teamName,
      gamesPlayed: row.gamesPlayed,
      wins: row.wins,
      losses: row.losses,
      pointsFor: row.pointsFor,
      pointsAgainst: row.pointsAgainst,
      pointDifferential: row.pointDifferential,
      gameStatsCount: row.gameStatsCount,
      gameNumbers: row.gameNumbers
    }));

  const activeOfficialGamesByScope = Object.values(games.reduce<Record<string, { ageGroup: string; gender: string; leagueId: string; league: string; seasonId: string; season: string; games: number; internalTeams: Set<string>; publicSchools: Set<string> }>>((acc, game) => {
    const gender = inferGender(game.season.league.name, game.homeTeam.name, game.awayTeam.name);
    const key = keyFor([game.season.league.ageGroup, gender, game.season.leagueId, game.seasonId]);
    acc[key] ??= { ageGroup: game.season.league.ageGroup, gender, leagueId: game.season.leagueId, league: game.season.league.name, seasonId: game.seasonId, season: game.season.name, games: 0, internalTeams: new Set(), publicSchools: new Set() };
    acc[key].games += 1;
    acc[key].internalTeams.add(game.homeTeamId);
    acc[key].internalTeams.add(game.awayTeamId);
    acc[key].publicSchools.add(publicTeamDisplayName(game.homeTeam.name));
    acc[key].publicSchools.add(publicTeamDisplayName(game.awayTeam.name));
    return acc;
  }, {})).map((scope) => ({ ...scope, internalTeams: scope.internalTeams.size, publicSchools: scope.publicSchools.size }));

  const recommendation = duplicatePublicSchoolDisplayNames.length
    ? "These are duplicate official Team records that collapse to the same public school within the same ageGroup/gender/league/season. Display-normalization alone can hide the duplicate names, but standings would still split records and GameStats. Recommended next step is an approved data repair: reassign affected games and GameStats to the intended canonical Team, then merge or retire the duplicate Team records. Do not do this without explicit approval."
    : "No duplicate public school display names were found within the same ageGroup/gender/league/season. No merge/reassignment is indicated from this diagnostic.";

  console.log(JSON.stringify({
    diagnostic: "duplicate-public-school-display-names-in-dynamic-team-standings",
    readOnly: true,
    activeOfficialGamesInspected: games.length,
    activeOfficialGamesByScope,
    duplicatePublicSchoolDisplayNameGroups: duplicatePublicSchoolDisplayNames,
    deLaSalleAliasChecks: deLaSalleChecks,
    recommendation
  }, null, 2));
}

main().finally(async () => prisma.$disconnect());
