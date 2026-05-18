import { AgeGroup, PlayerGender, type Submission } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildSubmissionReview } from "@/lib/submission-review";
import { getUaapInternalTeamName, getUaapSchoolDisplayName } from "@/lib/uaap-school-display";

type JsonRecord = Record<string, unknown>;
type PreflightAction = "reuse" | "create" | "update" | "manual_review";

type SubmissionForPreflight = Pick<Submission, "id" | "status" | "title" | "leagueName" | "rawText" | "parsedPreview">;

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

function cleanPlayerName(value: unknown): string {
  return stringValue(value).replace(/^\*+/, "").trim();
}

function normalize(value: string) {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

function parseSubmissionJson(submission: Pick<Submission, "rawText" | "parsedPreview">) {
  if (submission.rawText?.trim()) return JSON.parse(submission.rawText);

  if (submission.parsedPreview && typeof submission.parsedPreview === "object") {
    const preview = submission.parsedPreview as JsonRecord;
    if ("league" in preview || "season" in preview || "games" in preview) return preview;
    if (Array.isArray(preview.sample)) return preview.sample;
    if (preview.sample && typeof preview.sample === "object") return preview.sample;
  }

  return null;
}

function getPackages(parsed: unknown): JsonRecord[] {
  const root = asRecord(parsed);
  if (root) return [root];
  return asArray(parsed).map(asRecord).filter((item): item is JsonRecord => item !== null);
}

function coerceAgeGroup(value: string | null): AgeGroup | null {
  if (!value) return null;
  const normalized = value.toUpperCase();
  return Object.values(AgeGroup).includes(normalized as AgeGroup) ? (normalized as AgeGroup) : null;
}

function inferGender(reviewGender: "BOYS" | "GIRLS" | null): PlayerGender {
  return reviewGender === "GIRLS" ? PlayerGender.GIRLS : PlayerGender.BOYS;
}

function recommendedLeagueName(submission: SubmissionForPreflight, fallback: string | null) {
  const review = buildSubmissionReview(submission);
  return review.recommendations.recommendedLeagueName ?? fallback ?? submission.leagueName ?? submission.title;
}

export type SubmissionImportPreflight = Awaited<ReturnType<typeof buildSubmissionImportPreflight>>;

export async function buildSubmissionImportPreflight(submission: SubmissionForPreflight) {
  const review = buildSubmissionReview(submission);
  const parsed = parseSubmissionJson(submission);
  const packages = getPackages(parsed);
  const primaryPackage = packages[0] ?? null;
  const leagueRecord = asRecord(primaryPackage?.league);
  const seasonRecord = asRecord(primaryPackage?.season);
  const games = packages.flatMap((submissionPackage) => asArray(submissionPackage.games).map(asRecord).filter((game): game is JsonRecord => game !== null));
  const targetLeagueName = recommendedLeagueName(submission, review.summary.leagueName);
  const targetAgeGroup = coerceAgeGroup(review.summary.ageGroup);
  const inferredGender = inferGender(review.recommendations.inferredGender);
  const seasonName = stringValue(seasonRecord?.name) || review.summary.seasonName;
  const seasonYear = typeof seasonRecord?.seasonYear === "number" ? seasonRecord.seasonYear : review.summary.seasonYear;
  const blockers: string[] = [];

  if (submission.status !== "APPROVED") blockers.push("Submission must be APPROVED before import preflight can be considered ready.");
  if (!review.validJson) blockers.push("Submission JSON is not valid.");
  if (!review.importReady) blockers.push("Submission review parser found validation issues.");
  if (!targetAgeGroup) blockers.push(`Unsupported or missing age group: ${review.summary.ageGroup ?? "missing"}.`);
  if (!seasonName) blockers.push("Season name is missing.");

  const existingLeague = targetAgeGroup
    ? await prisma.league.findFirst({
        where: { name: targetLeagueName, ageGroup: targetAgeGroup, deletedAt: null },
        select: { id: true, name: true, ageGroup: true }
      })
    : null;

  const existingSeason = existingLeague && seasonName
    ? await prisma.season.findUnique({
        where: { leagueId_name: { leagueId: existingLeague.id, name: seasonName } },
        select: { id: true, name: true, seasonYear: true }
      })
    : null;

  const submittedTeams = Array.from(new Set(review.summary.detectedTeams)).sort((left, right) => left.localeCompare(right));
  const teamPreflight = await Promise.all(submittedTeams.map(async (submittedTeamName) => {
    const normalizedPublicName = getUaapSchoolDisplayName(submittedTeamName);
    const internalTeamName = getUaapInternalTeamName(submittedTeamName, targetAgeGroup, inferredGender);
    const matches = await prisma.team.findMany({
      where: { deletedAt: null, name: internalTeamName },
      select: { id: true, name: true, city: true, region: true },
      orderBy: { name: "asc" }
    });

    const action: PreflightAction = matches.length === 1 ? "reuse" : matches.length === 0 ? "create" : "manual_review";
    return { submittedTeamName, internalTeamName, normalizedPublicName, matches, action };
  }));

  const uniquePlayerNames = review.summary.uniquePlayerNames;
  const playerPreflight = await Promise.all(uniquePlayerNames.map(async (submittedName) => {
    const cleanedName = submittedName.replace(/^\*+/, "").trim();
    const exactMatches = await prisma.player.findMany({
      where: { displayName: cleanedName, gender: inferredGender, deletedAt: null },
      select: { id: true, displayName: true, gender: true, city: true, region: true },
      orderBy: { displayName: "asc" }
    });
    const possibleCaseMatches = exactMatches.length === 0
      ? await prisma.player.findMany({
          where: { displayName: { equals: cleanedName, mode: "insensitive" }, gender: inferredGender, deletedAt: null },
          select: { id: true, displayName: true, gender: true, city: true, region: true },
          orderBy: { displayName: "asc" }
        })
      : [];

    const action: PreflightAction = exactMatches.length === 1
      ? "reuse"
      : exactMatches.length === 0 && possibleCaseMatches.length === 0
        ? "create"
        : "manual_review";

    return { submittedName, cleanedName, gender: inferredGender, exactMatches, possibleCaseMatches, action };
  }));

  const teamBySubmittedName = new Map(teamPreflight.map((team) => [normalize(team.submittedTeamName), team]));
  const playerByCleanedName = new Map(playerPreflight.map((player) => [normalize(player.cleanedName), player]));

  const gamePreflight = await Promise.all(games.map(async (game) => {
    const gameNumber = stringValue(game.gameNumber);
    const homeTeamName = stringValue(game.homeTeamName);
    const awayTeamName = stringValue(game.awayTeamName);
    const homeScore = numberValue(game.homeScore);
    const awayScore = numberValue(game.awayScore);
    const pointCheck = review.validation.pointTotals.find((check) => check.gameNumber === gameNumber) ?? null;
    const existingGame = existingSeason && gameNumber
      ? await prisma.game.findFirst({
          where: { seasonId: existingSeason.id, gameNumber, deletedAt: null },
          select: { id: true, gameNumber: true, homeScore: true, awayScore: true }
        })
      : null;

    const homeTeam = teamBySubmittedName.get(normalize(homeTeamName));
    const awayTeam = teamBySubmittedName.get(normalize(awayTeamName));
    const teamReviewNeeded = homeTeam?.action === "manual_review" || awayTeam?.action === "manual_review";
    const action: PreflightAction = teamReviewNeeded ? "manual_review" : existingGame ? "update" : "create";

    return { gameNumber, game: stringValue(game.game), homeTeamName, awayTeamName, homeScore, awayScore, existingGame, action, pointCheck };
  }));

  const gameByNumber = new Map(gamePreflight.map((game) => [game.gameNumber, game]));
  let gameStatsWouldCreate = 0;
  let gameStatsWouldUpdate = 0;
  let gameStatsManualReview = 0;
  const gameStatIssues: Array<{ gameNumber: string; playerName: string; team: string; reason: string }> = [];

  for (const game of games) {
    const gameNumber = stringValue(game.gameNumber);
    const submittedGame = gameByNumber.get(gameNumber);
    const homeTeamName = stringValue(game.homeTeamName);
    const awayTeamName = stringValue(game.awayTeamName);
    const gamePlayers = asArray(game.players).map(asRecord).filter((player): player is JsonRecord => player !== null);

    for (const playerRow of gamePlayers) {
      const playerName = cleanPlayerName(playerRow.name);
      const playerTeam = stringValue(playerRow.team);
      const playerPreflightRow = playerByCleanedName.get(normalize(playerName));
      const teamPreflightRow = teamBySubmittedName.get(normalize(playerTeam));
      const reasons: string[] = [];

      if (normalize(playerTeam) !== normalize(homeTeamName) && normalize(playerTeam) !== normalize(awayTeamName)) reasons.push("player team does not match game teams");
      if (!playerPreflightRow || playerPreflightRow.action === "manual_review") reasons.push("player requires manual review");
      if (!teamPreflightRow || teamPreflightRow.action === "manual_review") reasons.push("team requires manual review");
      if (!submittedGame || submittedGame.action === "manual_review") reasons.push("game requires manual review");

      if (reasons.length) {
        gameStatsManualReview += 1;
        gameStatIssues.push({ gameNumber, playerName, team: playerTeam, reason: reasons.join("; ") });
        continue;
      }

      if (playerPreflightRow && submittedGame) {
        const existingPlayerId = playerPreflightRow.exactMatches[0]?.id;
        const existingGameId = submittedGame.existingGame?.id;

        if (existingPlayerId && existingGameId) {
          const existingStat = await prisma.gameStat.findUnique({
            where: { gameId_playerId: { gameId: existingGameId, playerId: existingPlayerId } },
            select: { id: true }
          });
          if (existingStat) gameStatsWouldUpdate += 1;
          else gameStatsWouldCreate += 1;
        } else {
          gameStatsWouldCreate += 1;
        }
      } else {
        gameStatsWouldCreate += 1;
      }
    }
  }

  const wouldCreate = {
    leagues: existingLeague ? 0 : 1,
    seasons: existingSeason ? 0 : 1,
    teams: teamPreflight.filter((team) => team.action === "create").length,
    players: playerPreflight.filter((player) => player.action === "create").length,
    games: gamePreflight.filter((game) => game.action === "create").length,
    gameStats: gameStatsWouldCreate
  };

  const wouldReuse = {
    leagues: existingLeague ? 1 : 0,
    seasons: existingSeason ? 1 : 0,
    teams: teamPreflight.filter((team) => team.action === "reuse").length,
    players: playerPreflight.filter((player) => player.action === "reuse").length,
    games: gamePreflight.filter((game) => game.action === "update").length,
    gameStats: gameStatsWouldUpdate
  };

  const manualReviewCount = teamPreflight.filter((team) => team.action === "manual_review").length
    + playerPreflight.filter((player) => player.action === "manual_review").length
    + gamePreflight.filter((game) => game.action === "manual_review").length
    + gameStatsManualReview;

  if (manualReviewCount > 0) blockers.push("One or more teams, players, games, or stat rows require manual review.");

  return {
    submissionReadiness: {
      status: submission.status,
      statusApproved: submission.status === "APPROVED",
      validParsedJson: review.validJson,
      importReadyFromReview: review.importReady
    },
    league: {
      submittedName: review.summary.leagueName,
      recommendedName: targetLeagueName,
      ageGroup: review.summary.ageGroup,
      inferredGender,
      existingLeague,
      action: existingLeague ? "reuse" as const : "create" as const
    },
    season: {
      name: seasonName,
      seasonYear,
      existingSeason,
      action: existingSeason ? "reuse" as const : "create" as const
    },
    teams: teamPreflight,
    players: playerPreflight,
    games: gamePreflight,
    gameStats: {
      totalSubmittedRows: review.summary.totalPlayerRows,
      wouldCreate: gameStatsWouldCreate,
      wouldUpdate: gameStatsWouldUpdate,
      manualReview: gameStatsManualReview,
      issues: gameStatIssues.slice(0, 50)
    },
    overallSummary: {
      wouldCreate,
      wouldReuse,
      manualReviewCount,
      importBlocked: blockers.length > 0,
      blockers
    }
  };
}
