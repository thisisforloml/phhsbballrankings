import { AgeGroup, PlayerGender, Prisma, SeasonStatus, SubmissionStatus, SubmissionType, VerificationStatus, type Submission } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildSubmissionReview } from "@/lib/submission-review";
import { buildSubmissionImportPreflight } from "@/lib/submission-import-preflight";
import { getUaapInternalTeamName } from "@/lib/uaap-school-display";
import { formatSubmissionJsonParseError, safeParseSubmissionJson } from "@/lib/submission-json";

type JsonRecord = Record<string, unknown>;
type SubmissionForImport = Pick<Submission, "id" | "status" | "title" | "leagueName" | "rawText" | "parsedPreview" | "adminNotes">;

type ParsedGame = {
  gameNumber: string;
  gameDate: Date;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  city: string;
  region: string;
  sourceName: string;
  players: JsonRecord[];
};

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function nullableNumberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function cleanPlayerName(value: unknown): string {
  return stringValue(value).replace(/^\*+/, "").trim();
}

function canonicalPlayerDisplayName(value: string): string {
  return normalize(value) === "JD JUANGCO" ? "JD Juangco" : value;
}

function isStarter(value: unknown): boolean {
  return stringValue(value).startsWith("*");
}

function normalize(value: string) {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

function parseDate(value: unknown) {
  const raw = stringValue(value);
  if (!raw) throw new Error("Game date is missing.");
  const date = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid game date: ${raw}`);
  return date;
}

function parseMinutes(value: unknown): number | null {
  const raw = stringValue(value);
  if (!raw) return null;
  const [minutes, seconds] = raw.split(":").map((part) => Number(part));
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
  return Math.round((minutes + seconds / 60) * 100) / 100;
}

function parseSubmissionJson(submission: Pick<Submission, "rawText" | "parsedPreview">) {
  const result = safeParseSubmissionJson(submission);
  if (!result.ok) throw new Error(formatSubmissionJsonParseError(result) ?? "Submission JSON is not valid.");
  return result.data;
}

function coerceAgeGroup(value: string | null): AgeGroup | null {
  if (!value) return null;
  const normalized = value.toUpperCase();
  return Object.values(AgeGroup).includes(normalized as AgeGroup) ? (normalized as AgeGroup) : null;
}

function getPrimaryPackage(submission: Pick<Submission, "rawText" | "parsedPreview">) {
  const parsed = parseSubmissionJson(submission);
  const root = asRecord(parsed);
  if (root) return root;

  const packages = asArray(parsed).map(asRecord).filter((item): item is JsonRecord => item !== null);
  if (packages.length !== 1) throw new Error(`Expected exactly one submission package for v1 import, found ${packages.length}.`);
  return packages[0];
}

function nameParts(displayName: string) {
  const tokens = displayName.trim().split(/\s+/).filter(Boolean);
  if (tokens.length <= 1) return { firstName: displayName, lastName: displayName };
  return { firstName: tokens[0], lastName: tokens.slice(1).join(" ") };
}

function appendAdminNotes(existing: string | null, summary: string) {
  return [existing, summary].filter(Boolean).join("\n\n");
}

function gameStatData(playerRow: JsonRecord, gameId: string, playerId: string, teamId: string) {
  const fieldGoalsMade = nullableNumberValue(playerRow.FGM);
  const fieldGoalsAttempt = nullableNumberValue(playerRow.FGA);
  const threeMade = nullableNumberValue(playerRow["3PM"]);
  const threeAttempt = nullableNumberValue(playerRow["3PA"]);
  const freeThrowsMade = nullableNumberValue(playerRow.FTM);
  const freeThrowsAttempt = nullableNumberValue(playerRow.FTA);

  return {
    gameId,
    playerId,
    teamId,
    starter: isStarter(playerRow.name),
    minutes: parseMinutes(playerRow.MIN),
    points: numberValue(playerRow.PTS),
    offensiveRebounds: nullableNumberValue(playerRow.OREB),
    defensiveRebounds: nullableNumberValue(playerRow.DREB),
    rebounds: numberValue(playerRow.TRB),
    assists: numberValue(playerRow.AST),
    steals: nullableNumberValue(playerRow.STL),
    blocks: nullableNumberValue(playerRow.BLK),
    turnovers: nullableNumberValue(playerRow.TOV),
    fouls: nullableNumberValue(playerRow.PF),
    foulsDrawn: nullableNumberValue(playerRow.FD),
    plusMinus: nullableNumberValue(playerRow["+/-"]),
    fieldGoalsMade,
    fieldGoalsAttempt,
    twoMade: fieldGoalsMade !== null && threeMade !== null ? fieldGoalsMade - threeMade : null,
    twoAttempt: fieldGoalsAttempt !== null && threeAttempt !== null ? fieldGoalsAttempt - threeAttempt : null,
    threeMade,
    threeAttempt,
    freeThrowsMade,
    freeThrowsAttempt,
    deletedAt: null
  };
}

function parseGames(packageRoot: JsonRecord): ParsedGame[] {
  return asArray(packageRoot.games).map(asRecord).filter((game): game is JsonRecord => game !== null).map((game) => ({
    gameNumber: stringValue(game.gameNumber),
    gameDate: parseDate(game.gameDate),
    homeTeamName: stringValue(game.homeTeamName),
    awayTeamName: stringValue(game.awayTeamName),
    homeScore: numberValue(game.homeScore),
    awayScore: numberValue(game.awayScore),
    city: stringValue(game.city) || "Metro Manila",
    region: stringValue(game.region) || "NCR",
    sourceName: stringValue(game.sourceName) || "Organizer submission import",
    players: asArray(game.players).map(asRecord).filter((player): player is JsonRecord => player !== null)
  }));
}

export async function importApprovedSubmissionOfficialData(submissionId: string) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      status: true,
      title: true,
      leagueName: true,
      rawText: true,
      parsedPreview: true,
      adminNotes: true
    }
  });

  if (!submission) throw new Error("Submission not found.");
  if (submission.status === SubmissionStatus.IMPORTED) {
    return { alreadyImported: true, submissionId, message: "Submission is already imported." };
  }
  if (submission.status !== SubmissionStatus.APPROVED) {
    throw new Error("Only APPROVED submissions can be imported.");
  }

  const preflight = await buildSubmissionImportPreflight(submission);
  if (preflight.overallSummary.importBlocked) {
    throw new Error(`Import blocked: ${preflight.overallSummary.blockers.join(" ")}`);
  }

  const review = buildSubmissionReview(submission);
  const packageRoot = getPrimaryPackage(submission);
  const leagueRecord = asRecord(packageRoot.league);
  const seasonRecord = asRecord(packageRoot.season);
  const games = parseGames(packageRoot);
  if (!games.length) throw new Error("No games found in submission.");

  const targetLeagueName = review.recommendations.recommendedLeagueName ?? review.summary.leagueName ?? submission.leagueName ?? submission.title;
  const ageGroup = coerceAgeGroup(review.summary.ageGroup);
  if (!ageGroup) throw new Error(`Unsupported age group for this import: ${review.summary.ageGroup ?? "missing"}.`);
  const gender = review.recommendations.inferredGender === "GIRLS" ? PlayerGender.GIRLS : PlayerGender.BOYS;
  const organizerName = stringValue(leagueRecord?.organizerName) || "UAAP";
  const leagueCity = stringValue(leagueRecord?.city) || "Quezon City";
  const leagueRegion = stringValue(leagueRecord?.region) || "NCR";
  const seasonName = stringValue(seasonRecord?.name) || review.summary.seasonName || "Season 88";
  const seasonYear = typeof seasonRecord?.seasonYear === "number" ? seasonRecord.seasonYear : review.summary.seasonYear ?? 2025;
  const startsOn = games.reduce((earliest, game) => game.gameDate < earliest ? game.gameDate : earliest, games[0].gameDate);
  const endsOn = games.reduce((latest, game) => game.gameDate > latest ? game.gameDate : latest, games[0].gameDate);

  return prisma.$transaction(async (tx) => {
    const summary = {
      alreadyImported: false,
      league: { action: "reuse" as "reuse" | "create", id: "" },
      season: { action: "reuse" as "reuse" | "create", id: "" },
      teamsCreated: 0,
      teamsReused: 0,
      playersCreated: 0,
      playersReused: 0,
      gamesCreated: 0,
      gamesReused: 0,
      gameStatsCreated: 0,
      gameStatsUpdated: 0,
      submissionStatus: SubmissionStatus.IMPORTED
    };

    let league = await tx.league.findFirst({ where: { name: targetLeagueName, ageGroup, deletedAt: null } });
    if (!league) {
      league = await tx.league.create({
        data: {
          name: targetLeagueName,
          ageGroup,
          organizerName,
          city: leagueCity,
          region: leagueRegion
        }
      });
      summary.league.action = "create";
    }
    summary.league.id = league.id;

    let season = await tx.season.findUnique({ where: { leagueId_name: { leagueId: league.id, name: seasonName } } });
    if (!season) {
      season = await tx.season.create({
        data: {
          leagueId: league.id,
          name: seasonName,
          seasonYear,
          status: SeasonStatus.ACTIVE,
          startsOn,
          endsOn
        }
      });
      summary.season.action = "create";
    }
    summary.season.id = season.id;

    const teamBySubmittedName = new Map<string, { id: string; name: string }>();
    const submittedTeamNames = Array.from(new Set(games.flatMap((game) => [game.homeTeamName, game.awayTeamName, ...game.players.map((player) => stringValue(player.team))]).filter(Boolean)));
    for (const submittedTeamName of submittedTeamNames) {
      const internalTeamName = getUaapInternalTeamName(submittedTeamName, ageGroup, gender);
      const matches = await tx.team.findMany({ where: { deletedAt: null, name: internalTeamName }, orderBy: { name: "asc" } });
      if (matches.length > 1) throw new Error(`Multiple active Team matches found for ${internalTeamName}.`);
      let team = matches[0] ?? null;
      if (!team) {
        team = await tx.team.create({ data: { name: internalTeamName, city: "Metro Manila", region: "NCR" } });
        summary.teamsCreated += 1;
      } else {
        summary.teamsReused += 1;
      }
      teamBySubmittedName.set(normalize(submittedTeamName), { id: team.id, name: team.name });
    }

    const playerByName = new Map<string, { id: string; displayName: string }>();
    const uniquePlayerNames = Array.from(new Set(games.flatMap((game) => game.players.map((player) => canonicalPlayerDisplayName(cleanPlayerName(player.name)))).filter(Boolean)));
    for (const displayName of uniquePlayerNames) {
      const matches = await tx.player.findMany({ where: { displayName, gender, deletedAt: null }, orderBy: { displayName: "asc" } });
      if (matches.length > 1) throw new Error(`Multiple active Player matches found for ${displayName}.`);
      let player = matches[0] ?? null;
      if (!player) {
        const parts = nameParts(displayName);
        player = await tx.player.create({
          data: {
            displayName,
            firstName: parts.firstName,
            lastName: parts.lastName,
            gender,
            city: "Metro Manila",
            region: "NCR",
            birthDate: null,
            photoUrl: null,
            heightCm: null,
            position: null
          }
        });
        summary.playersCreated += 1;
      } else {
        summary.playersReused += 1;
      }
      playerByName.set(normalize(displayName), { id: player.id, displayName: player.displayName });
    }

    for (const submittedGame of games) {
      const homeTeam = teamBySubmittedName.get(normalize(submittedGame.homeTeamName));
      const awayTeam = teamBySubmittedName.get(normalize(submittedGame.awayTeamName));
      if (!homeTeam || !awayTeam) throw new Error(`Missing team mapping for game ${submittedGame.gameNumber}.`);

      let game = await tx.game.findFirst({ where: { seasonId: season.id, gameNumber: submittedGame.gameNumber, deletedAt: null } });
      if (game) {
        if (game.homeTeamId !== homeTeam.id || game.awayTeamId !== awayTeam.id || game.homeScore !== submittedGame.homeScore || game.awayScore !== submittedGame.awayScore) {
          throw new Error(`Existing game ${submittedGame.gameNumber} does not match submitted teams/scores.`);
        }
        summary.gamesReused += 1;
      } else {
        game = await tx.game.create({
          data: {
            seasonId: season.id,
            homeTeamId: homeTeam.id,
            awayTeamId: awayTeam.id,
            gameNumber: submittedGame.gameNumber,
            gameDate: submittedGame.gameDate,
            city: submittedGame.city,
            region: submittedGame.region,
            homeScore: submittedGame.homeScore,
            awayScore: submittedGame.awayScore,
            sourceName: submittedGame.sourceName,
            submissionType: SubmissionType.STAFF_MANUAL_ENTRY,
            verificationStatus: VerificationStatus.SUBMITTED
          }
        });
        summary.gamesCreated += 1;
      }

      for (const playerRow of submittedGame.players) {
        const cleanedName = canonicalPlayerDisplayName(cleanPlayerName(playerRow.name));
        const player = playerByName.get(normalize(cleanedName));
        const team = teamBySubmittedName.get(normalize(stringValue(playerRow.team)));
        if (!player || !team) throw new Error(`Missing player/team mapping for ${cleanedName} in ${submittedGame.gameNumber}.`);

        const data = gameStatData(playerRow, game.id, player.id, team.id);
        const existingStat = await tx.gameStat.findUnique({ where: { gameId_playerId: { gameId: game.id, playerId: player.id } } });
        if (existingStat) {
          await tx.gameStat.update({ where: { id: existingStat.id }, data });
          summary.gameStatsUpdated += 1;
        } else {
          await tx.gameStat.create({ data });
          summary.gameStatsCreated += 1;
        }
      }
    }

    const importNote = `Official import completed: ${JSON.stringify(summary)}`;
    await tx.submission.update({
      where: { id: submission.id },
      data: {
        status: SubmissionStatus.IMPORTED,
        adminNotes: appendAdminNotes(submission.adminNotes, importNote)
      },
      select: { id: true }
    });

    return summary;
  }, { timeout: 30000, isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
