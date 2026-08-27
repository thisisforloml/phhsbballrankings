type JsonRecord = Record<string, unknown>;

type NormalizedGame = {
  competition: JsonRecord;
  season: JsonRecord | null;
  gender: string;
  game: JsonRecord;
  gameYear: number | null;
};

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizedKey(value: string) {
  if (value === "+/-") return "plusminus";
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function valueFor(record: JsonRecord | null, aliases: string[]) {
  if (!record) return undefined;
  const wanted = new Set(aliases.map(normalizedKey));
  return Object.entries(record).find(([key]) => wanted.has(normalizedKey(key)))?.[1];
}

function recordFor(record: JsonRecord | null, aliases: string[]) {
  return asRecord(valueFor(record, aliases));
}

function arrayFor(record: JsonRecord | null, aliases: string[]) {
  return asArray(valueFor(record, aliases));
}

function text(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function textFor(record: JsonRecord | null, aliases: string[]) {
  return text(valueFor(record, aliases));
}

function number(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function numberFor(record: JsonRecord | null, aliases: string[]) {
  return number(valueFor(record, aliases));
}

function firstNumber(...values: Array<number | undefined>) {
  return values.find((value) => value !== undefined);
}

function normalizeAgeGroup(value: string) {
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (["13U", "U13"].includes(compact)) return "U13";
  if (["15U", "U15", "16U", "U16"].includes(compact)) return "U16";
  if (["18U", "U18", "19U", "U19"].includes(compact)) return "U19";
  return value.toUpperCase();
}

function contextRecord(record: JsonRecord, aliases: string[]) {
  const value = valueFor(record, aliases);
  const nested = asRecord(value);
  if (nested) return nested;
  const name = text(value);
  return name ? { name } : null;
}

function teamName(team: JsonRecord | null) {
  return textFor(team, ["teamName", "team_name", "name", "displayName", "school", "program"]);
}

function teamCode(team: JsonRecord | null) {
  return textFor(team, ["teamCode", "team_code", "code", "abbreviation", "shortName"]);
}

function teamForIdentity(teams: JsonRecord[], identity: unknown) {
  const identityRecord = asRecord(identity);
  if (identityRecord) return identityRecord;
  const key = text(identity).toUpperCase();
  return teams.find((team) => [teamCode(team), teamName(team)].some((candidate) => candidate.toUpperCase() === key)) ?? null;
}

function statNumber(player: JsonRecord, flatAliases: string[], nestedAliases: string[], childAliases: string[]) {
  return firstNumber(numberFor(player, flatAliases), numberFor(recordFor(player, nestedAliases), childAliases));
}

function playerRow(player: JsonRecord, fallbackTeamName: string) {
  const playerTeam = valueFor(player, ["team", "teamName", "team_name", "club", "school"]);
  const playerTeamName = teamName(asRecord(playerTeam)) || text(playerTeam) || fallbackTeamName;
  const minutes = valueFor(player, ["MIN", "min", "minutes", "minutesPlayed", "timePlayed"]);
  return {
    name: textFor(player, ["name", "playerName", "player_name", "fullName", "displayName"]),
    team: playerTeamName,
    jerseyNumber: valueFor(player, ["number", "jerseyNumber", "jersey", "uniformNumber"]) ?? null,
    starter: valueFor(player, ["starter", "isStarter", "started"]) === true,
    MIN: typeof minutes === "number" ? minutes : text(minutes),
    PTS: numberFor(player, ["PTS", "pts", "points"]),
    FGM: statNumber(player, ["FGM", "fieldGoalsMade"], ["fg", "fieldGoals"], ["made", "m"]),
    FGA: statNumber(player, ["FGA", "fieldGoalsAttempted", "fieldGoalAttempts"], ["fg", "fieldGoals"], ["attempted", "attempts", "a"]),
    "2PM": statNumber(player, ["2PM", "twoPointersMade", "twoPointMade"], ["twoPt", "two_pt", "twoPoint", "twoPointers"], ["made", "m"]),
    "2PA": statNumber(player, ["2PA", "twoPointersAttempted", "twoPointAttempts"], ["twoPt", "two_pt", "twoPoint", "twoPointers"], ["attempted", "attempts", "a"]),
    "3PM": statNumber(player, ["3PM", "threePointersMade", "threePointMade"], ["threePt", "three_pt", "threePoint", "threePointers"], ["made", "m"]),
    "3PA": statNumber(player, ["3PA", "threePointersAttempted", "threePointAttempts"], ["threePt", "three_pt", "threePoint", "threePointers"], ["attempted", "attempts", "a"]),
    FTM: statNumber(player, ["FTM", "freeThrowsMade", "freeThrowMade"], ["ft", "freeThrows", "freeThrow"], ["made", "m"]),
    FTA: statNumber(player, ["FTA", "freeThrowsAttempted", "freeThrowAttempts"], ["ft", "freeThrows", "freeThrow"], ["attempted", "attempts", "a"]),
    OREB: statNumber(player, ["OREB", "orb", "offensiveRebounds"], ["rebounds", "reb"], ["offensive", "off", "oreb"]),
    DREB: statNumber(player, ["DREB", "drb", "defensiveRebounds"], ["rebounds", "reb"], ["defensive", "def", "dreb"]),
    TRB: statNumber(player, ["TRB", "REB", "reb", "totalRebounds"], ["rebounds"], ["total", "trb", "reb"]),
    AST: numberFor(player, ["AST", "ast", "assists"]),
    STL: numberFor(player, ["STL", "stl", "steals"]),
    BLK: numberFor(player, ["BLK", "blk", "blocks"]),
    TOV: numberFor(player, ["TOV", "TO", "turnovers"]),
    PF: statNumber(player, ["PF", "personalFouls", "fouls"], ["fouls"], ["personal", "pf"]),
    FD: statNumber(player, ["FD", "foulsDrawn"], ["fouls"], ["drawn", "fd"]),
    "+/-": numberFor(player, ["+/-", "plusMinus", "plus_minus", "pm"]),
  };
}

function locationFromGame(game: JsonRecord) {
  const city = textFor(game, ["city", "locationCity"]);
  const region = textFor(game, ["region", "locationRegion"]);
  if (city && region) return { city, region };
  const venue = textFor(game, ["venue", "venueName", "arena"]);
  if (/FEU\s+DILIMAN/i.test(venue)) return { city: "Quezon City", region: "NCR" };
  return { city, region };
}

function gameHasFlexibleShape(value: unknown) {
  const wrapper = asRecord(value);
  if (!wrapper) return false;
  const game = recordFor(wrapper, ["game", "match", "fixture"]) ?? wrapper;
  const teams = arrayFor(wrapper, ["teams", "teamStats", "team_stats", "boxScoreTeams"]);
  const gameTeams = arrayFor(game, ["teams", "teamStats", "boxScoreTeams"]);
  const directPlayers = arrayFor(game, ["players", "playerStats", "player_stats", "boxScore", "box_score"]);
  const home = valueFor(game, ["homeTeamName", "homeTeam", "home_team", "home"]);
  const away = valueFor(game, ["awayTeamName", "awayTeam", "away_team", "visitorTeam", "visitor_team", "away"]);
  const embeddedPlayers = [asRecord(home), asRecord(away)].some((team) =>
    arrayFor(team, ["players", "playerStats", "roster"]).length > 0);
  return Boolean(home && away && (teams.length >= 2 || gameTeams.length >= 2 || directPlayers.length > 0 || embeddedPlayers));
}

function normalizeFlexibleGame(value: unknown, fallbackContext?: JsonRecord): NormalizedGame | null {
  const wrapper = asRecord(value);
  if (!wrapper || !gameHasFlexibleShape(wrapper)) return null;
  const game = recordFor(wrapper, ["game", "match", "fixture"]) ?? wrapper;
  let teams = arrayFor(wrapper, ["teams", "teamStats", "team_stats", "boxScoreTeams"])
    .map(asRecord).filter((team): team is JsonRecord => team !== null);
  if (!teams.length) teams = arrayFor(game, ["teams", "teamStats", "boxScoreTeams"])
    .map(asRecord).filter((team): team is JsonRecord => team !== null);
  if (!teams.length) {
    teams = [
      asRecord(valueFor(game, ["homeTeam", "home_team", "home"])),
      asRecord(valueFor(game, ["awayTeam", "away_team", "visitorTeam", "visitor_team", "away"])),
    ].filter((team): team is JsonRecord => team !== null);
  }

  const homeIdentity = valueFor(game, ["homeTeamName", "homeTeam", "home_team", "home"]);
  const awayIdentity = valueFor(game, ["awayTeamName", "awayTeam", "away_team", "visitorTeam", "visitor_team", "away"]);
  // Never infer home/away from array order: exports can list teams in either order.
  const homeTeam = teamForIdentity(teams, homeIdentity);
  const awayTeam = teamForIdentity(teams, awayIdentity);
  const homeIdentityRecord = asRecord(homeIdentity);
  const awayIdentityRecord = asRecord(awayIdentity);
  const homeCode = teamCode(homeTeam) || teamCode(homeIdentityRecord) || text(homeIdentity);
  const awayCode = teamCode(awayTeam) || teamCode(awayIdentityRecord) || text(awayIdentity);
  const homeTeamName = teamName(homeTeam) || teamName(homeIdentityRecord) || text(homeIdentity);
  const awayTeamName = teamName(awayTeam) || teamName(awayIdentityRecord) || text(awayIdentity);
  const finalScore = recordFor(game, ["finalScore", "final_score", "score"]);
  const homeScore = firstNumber(
    numberFor(game, ["homeScore", "home_score", "homePoints"]),
    numberFor(homeIdentityRecord, ["score", "points"]),
    number(finalScore?.[homeCode]), number(finalScore?.[homeTeamName]),
    numberFor(recordFor(homeTeam, ["totals", "teamTotals", "stats"]), ["points", "PTS", "score"]),
  );
  const awayScore = firstNumber(
    numberFor(game, ["awayScore", "away_score", "visitorScore", "awayPoints"]),
    numberFor(awayIdentityRecord, ["score", "points"]),
    number(finalScore?.[awayCode]), number(finalScore?.[awayTeamName]),
    numberFor(recordFor(awayTeam, ["totals", "teamTotals", "stats"]), ["points", "PTS", "score"]),
  );
  const directPlayers = arrayFor(game, ["players", "playerStats", "player_stats", "boxScore", "box_score"])
    .map(asRecord).filter((player): player is JsonRecord => player !== null);
  const players = directPlayers.length
    ? directPlayers.map((player) => {
        const row = playerRow(player, "");
        const matchedTeam = teamForIdentity(teams, row.team);
        return { ...row, team: teamName(matchedTeam) || row.team };
      })
    : teams.flatMap((team) => {
        const name = teamName(team) || teamCode(team);
        return arrayFor(team, ["players", "playerStats", "player_stats", "roster"])
          .map(asRecord).filter((player): player is JsonRecord => player !== null)
          .map((player) => playerRow(player, name));
      });
  const gameDate = textFor(game, ["gameDate", "game_date", "date", "playedAt", "startDate"]);
  const location = locationFromGame(game);
  const competition = contextRecord(wrapper, ["competition", "league", "tournament"])
    ?? contextRecord(fallbackContext ?? {}, ["competition", "league", "tournament"])
    ?? {};
  const season = contextRecord(wrapper, ["season"]) ?? contextRecord(fallbackContext ?? {}, ["season"]);
  const gender = textFor(wrapper, ["gender", "divisionGender"])
    || textFor(fallbackContext ?? null, ["gender", "divisionGender"])
    || textFor(competition, ["gender"]);

  return {
    competition,
    season,
    gender,
    game: {
      gameNumber: textFor(game, ["gameNumber", "game_number", "gameNo", "matchNumber", "matchId", "id"]),
      gameDate,
      game: `${homeTeamName} ${homeScore ?? 0} - ${awayScore ?? 0} ${awayTeamName}`,
      homeTeamName, awayTeamName, homeScore, awayScore,
      city: location.city, region: location.region,
      venueName: textFor(game, ["venue", "venueName", "arena"]),
      sourceName: textFor(game, ["sourceName", "source", "provider"]) || "Submitted JSON box score",
      players,
    },
    gameYear: /^\d{4}-\d{2}-\d{2}/.test(gameDate) ? Number(gameDate.slice(0, 4)) : null,
  };
}

function normalizedContextKey(item: NormalizedGame) {
  const competitionName = textFor(item.competition, ["name", "competitionName", "leagueName", "tournamentName"]);
  const division = textFor(item.competition, ["division", "ageGroup", "age_group", "bracket", "category"]);
  const season = item.season
    ? textFor(item.season, ["name", "seasonName", "season_number", "number", "year"])
    : textFor(item.competition, ["season", "seasonName", "season_number"]);
  return `${competitionName}|${season}|${division}|${item.gender}`.toUpperCase();
}

function canonicalPackage(games: NormalizedGame[]) {
  if (!games.length) return null;
  const first = games[0];
  const contextKey = normalizedContextKey(first);
  if (!contextKey.replace(/\|/g, "") || games.some((game) => normalizedContextKey(game) !== contextKey)) return null;
  const competitionName = textFor(first.competition, ["name", "competitionName", "leagueName", "tournamentName"]);
  const division = textFor(first.competition, ["division", "ageGroup", "age_group", "bracket", "category"])
    || competitionName.match(/(?:U\s*\d+|\d+\s*U)/i)?.[0] || "";
  const seasonValue = first.season
    ? textFor(first.season, ["name", "seasonName", "season_number", "number", "year"])
    : textFor(first.competition, ["season", "seasonName", "season_number"]);
  const explicitSeasonYear = first.season ? numberFor(first.season, ["seasonYear", "season_year", "year"]) : undefined;
  const teamNames = games.flatMap((item) => [textFor(item.game, ["homeTeamName"]), textFor(item.game, ["awayTeamName"])]);
  const inferredGender = first.gender.toUpperCase()
    || (teamNames.length && teamNames.every((name) => /\b(?:JRS?|JUNIORS?|BOYS?)\b/i.test(name)) ? "BOYS" : "");
  return {
    league: {
      name: competitionName,
      ageGroup: normalizeAgeGroup(division),
      organizerName: textFor(first.competition, ["organizerName", "organizer", "operator"])
        || competitionName.match(/^[A-Z0-9]+/i)?.[0] || "",
      city: games.map((item) => textFor(item.game, ["city"])).find(Boolean) ?? "",
      region: games.map((item) => textFor(item.game, ["region"])).find(Boolean) ?? "",
    },
    season: {
      name: /^season\b/i.test(seasonValue) ? seasonValue : seasonValue ? `Season ${seasonValue}` : "",
      seasonYear: explicitSeasonYear ?? games.find((item) => item.gameYear)?.gameYear ?? null,
    },
    ...(inferredGender ? { gender: inferredGender } : {}),
    games: games.map((item) => item.game),
  };
}

function isCanonicalPackage(value: unknown) {
  const record = asRecord(value);
  return Boolean(asRecord(record?.league) && asRecord(record?.season) && Array.isArray(record?.games)
    && record.games.every((value: unknown) => {
      const game = asRecord(value);
      return game && "homeTeamName" in game && "awayTeamName" in game && "gameDate" in game
        && Array.isArray(game.players);
    }));
}

export function normalizeSubmissionJsonShape(value: unknown): unknown {
  if (isCanonicalPackage(value)) return value;
  const root = asRecord(value);
  const packageGames = root ? arrayFor(root, ["games", "matches", "fixtures"]) : [];
  if (packageGames.length) {
    const normalized = packageGames.map((game) => normalizeFlexibleGame(game, root ?? undefined));
    if (normalized.every((game): game is NormalizedGame => game !== null)) return canonicalPackage(normalized) ?? value;
  }
  const inputs = Array.isArray(value) ? value : [value];
  const normalized = inputs.map((game) => normalizeFlexibleGame(game));
  if (normalized.length && normalized.every((game): game is NormalizedGame => game !== null)) return canonicalPackage(normalized) ?? value;
  return value;
}
