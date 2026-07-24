import { AgeGroup, PlayerGender, Prisma, SeasonStatus, type Submission, SubmissionStatus, SubmissionType, VerificationStatus } from "@prisma/client";

import { assertImportProgramReusable } from "@/lib/admin/program-role";
import { ensurePlayerRosterFromGameStat } from "@/lib/admin/roster-from-game-evidence";
import { inferCompetitionGender, isPybcCompetitionName, normalizeCompetitionDisplayName } from "@/lib/competition-naming";
import {
  buildGameStatBoxScoreFromPlayerRow,
  evaluateGameStatImmutability,
  existingGameStatToCompareInput,
  type GameStatBlockedDetail,
  gameStatBoxScoreSelect} from "@/lib/game-stat-import-integrity";
import { resolveCanonicalLeagueImport } from "@/lib/league-canonical-naming";
import {
  prepareImportedPlayerName,
  resolvePlayerForImport
} from "@/lib/player-import-identity";
import { prisma } from "@/lib/prisma";
import { buildSubmissionImportPreflight } from "@/lib/submission-import-preflight";
import { formatSubmissionJsonParseError, safeParseSubmissionJson } from "@/lib/submission-json";
import { assertSubmissionReviewable } from "@/lib/submission-lifecycle";
import { buildSubmissionReview } from "@/lib/submission-review";
import { getTeamDisplayName, getUaapInternalTeamName, normalizeProgramAlias, type ProgramIdentity,resolveProgramIdentity } from "@/lib/uaap-school-display";

type JsonRecord = Record<string, unknown>;
type _SubmissionForImport = Pick<Submission, "id" | "status" | "title" | "leagueName" | "rawText" | "parsedPreview" | "adminNotes">;

const OFFICIAL_IMPORT_TRANSACTION_TIMEOUT_MS = 120_000;

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

function programKeyFromName(value: string) {
  return normalizeProgramAlias(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "unknown-program";
}

function importProgramIdentity(submittedTeamName: string, leagueName: string): ProgramIdentity {
  if (isPybcCompetitionName(normalizeCompetitionDisplayName(leagueName))) {
    const teamProgramName = getTeamDisplayName(submittedTeamName);
    return {
      programKey: programKeyFromName(teamProgramName),
      programFullName: teamProgramName,
      programAbbreviation: teamProgramName,
      programType: "Club / Team",
      teamDisplayName: teamProgramName,
      normalizedAlias: normalizeProgramAlias(teamProgramName)
    };
  }

  return resolveProgramIdentity(submittedTeamName);
}

async function findConfiguredProgram(
  tx: Prisma.TransactionClient,
  identity: ProgramIdentity
) {
  const existing = await tx.program.findFirst({
    where: { fullName: identity.programFullName, deletedAt: null },
    select: { id: true, fullName: true, abbreviation: true, type: true, programRole: true },
  });
  if (existing) {
    assertImportProgramReusable(existing);
    return existing;
  }

  throw new Error(
    `Program ${identity.programFullName} is not configured. Create it in Admin > Programs before publishing this submission.`,
  );
}

function teamDisplayMatchKey(value: string) {
  return normalizeProgramAlias(getTeamDisplayName(value));
}

function hasTeamContextSuffix(value: string) {
  return /\b(?:U|UNDER)[ -]?(?:1[0-9]|12)\b/i.test(value)
    || /\b(?:1[0-9]|12)U\b/i.test(value)
    || /\b(?:U|UNDER)[ -]?(?:13|16|19)\s*(?:BOYS|GIRLS)?\b/i.test(value)
    || /\b(?:13U|16U|19U)\s*(?:BOYS|GIRLS)?\b/i.test(value)
    || /\b(?:BOYS|GIRLS)\b$/i.test(value);
}

function chooseEquivalentProgramTeam(
  submittedTeamName: string,
  teams: Array<{ id: string; name: string; programId: string | null }>
) {
  const submittedDisplayName = getTeamDisplayName(submittedTeamName);
  const exactDisplayMatches = teams.filter((team) => normalizeProgramAlias(team.name) === normalizeProgramAlias(submittedDisplayName));
  if (exactDisplayMatches.length === 1) return exactDisplayMatches[0];
  if (exactDisplayMatches.length > 1) {
    throw new Error(`Multiple active clean Team matches found under the same Program for ${submittedTeamName}: ${exactDisplayMatches.map((team) => team.name).join(", ")}.`);
  }

  const cleanMatches = teams.filter((team) => !hasTeamContextSuffix(team.name));
  if (cleanMatches.length === 1) return cleanMatches[0];
  if (cleanMatches.length > 1) {
    throw new Error(`Multiple active clean Team matches found under the same Program for ${submittedTeamName}: ${cleanMatches.map((team) => team.name).join(", ")}.`);
  }

  return null;
}

async function findImportTeamMatch(
  tx: Prisma.TransactionClient,
  params: {
    submittedTeamName: string;
    internalTeamName: string;
    programId: string;
    allowProgramDisplayMatch: boolean;
    ageGroup: AgeGroup;
    gender: PlayerGender;
  }
) {
  if (params.allowProgramDisplayMatch) {
    const submittedKey = teamDisplayMatchKey(params.submittedTeamName);
    const programTeams = await tx.team.findMany({
      where: { deletedAt: null, programId: params.programId },
      include: {
        homeGames: {
          where: { deletedAt: null, verificationStatus: { in: [VerificationStatus.SUBMITTED, VerificationStatus.VERIFIED] } },
          select: { season: { select: { league: { select: { name: true, ageGroup: true } } } } },
        },
        awayGames: {
          where: { deletedAt: null, verificationStatus: { in: [VerificationStatus.SUBMITTED, VerificationStatus.VERIFIED] } },
          select: { season: { select: { league: { select: { name: true, ageGroup: true } } } } },
        },
      },
      orderBy: { name: "asc" }
    });
    const equivalentMatches = programTeams.filter((team) => {
      if (teamDisplayMatchKey(team.name) !== submittedKey) return false;
      const contexts = [...team.homeGames, ...team.awayGames].map((game) => ({
        ageGroup: game.season.league.ageGroup,
        gender: inferCompetitionGender(undefined, game.season.league.name),
      }));
      const contextKeys = new Set(contexts.map((context) => context.ageGroup + "|" + context.gender));
      if (contextKeys.size > 1) {
        throw new Error(
          "Team " + team.name + " already contains multiple age/gender competition contexts. Split it into specific Team records before importing more games.",
        );
      }
      return contexts.length === 0 || contexts.some((context) => context.ageGroup === params.ageGroup && context.gender === params.gender);
    });
    const preferredTeam = chooseEquivalentProgramTeam(params.submittedTeamName, equivalentMatches);
    if (preferredTeam) return preferredTeam;
    if (equivalentMatches.length === 1) return equivalentMatches[0];
    if (equivalentMatches.length > 1) {
      throw new Error(`Multiple active Team matches found under the same Program for ${params.submittedTeamName}: ${equivalentMatches.map((team) => team.name).join(", ")}.`);
    }
  }

  const exactMatches = await tx.team.findMany({
    where: { deletedAt: null, name: params.internalTeamName, programId: params.programId },
    orderBy: { name: "asc" }
  });
  if (exactMatches.length > 1) throw new Error(`Multiple active Team matches found for ${params.internalTeamName}.`);
  if (exactMatches.length === 1) return exactMatches[0];
  return null;
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
      adminNotes: true,
      deletedAt: true
    }
  });

  if (!submission) throw new Error("Submission not found.");
  assertSubmissionReviewable(submission);
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

  const submittedLeagueName = review.recommendations.recommendedLeagueName ?? review.summary.leagueName ?? submission.leagueName ?? submission.title;
  const submittedSeasonName = stringValue(seasonRecord?.name) || review.summary.seasonName || "Season 88";
  const canonicalLeague = resolveCanonicalLeagueImport({ leagueName: submittedLeagueName, seasonName: submittedSeasonName });
  const targetLeagueName = canonicalLeague.leagueName;
  const ageGroup = coerceAgeGroup(review.summary.ageGroup);
  if (!ageGroup) throw new Error(`Unsupported age group for this import: ${review.summary.ageGroup ?? "missing"}.`);
  const gender = review.recommendations.inferredGender === "GIRLS" ? PlayerGender.GIRLS : PlayerGender.BOYS;
  const organizerName = stringValue(leagueRecord?.organizerName) || "UAAP";
  const leagueCity = stringValue(leagueRecord?.city) || "Quezon City";
  const leagueRegion = stringValue(leagueRecord?.region) || "NCR";
  const seasonName = canonicalLeague.seasonName;
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
      teamsProgramLinked: 0,
      teamsProgramAlreadyLinked: 0,
      teamsProgramKeptExisting: 0,
      playersCreated: 0,
      playersReused: 0,
      playersReusedViaAlias: 0,
      gamesCreated: 0,
      gamesReused: 0,
      gameStatsCreated: 0,
      gameStatsSkipped: 0,
      gameStatsBlocked: 0,
      gameStatBlockedDetails: [] as GameStatBlockedDetail[],
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
      const identity = importProgramIdentity(submittedTeamName, targetLeagueName);
      const program = await findConfiguredProgram(tx, identity);
      const team = await findImportTeamMatch(tx, {
        submittedTeamName,
        internalTeamName,
        programId: program.id,
        allowProgramDisplayMatch: identity.programType === "Club / Team",
        ageGroup,
        gender,
      });
      if (!team) {
        throw new Error(
          `Team ${internalTeamName} is not configured under ${program.fullName}. Create or assign the age/gender-specific Team in Admin > Programs before publishing.`,
        );
      } else {
        summary.teamsReused += 1;
        summary.teamsProgramAlreadyLinked += 1;
      }
      teamBySubmittedName.set(normalize(submittedTeamName), { id: team.id, name: team.name });
    }

    const playerByName = new Map<string, { id: string; displayName: string }>();
    const uniquePlayerNames = Array.from(new Set(games.flatMap((game) => game.players.map((player) => prepareImportedPlayerName(player.name))).filter(Boolean)));
    for (const displayName of uniquePlayerNames) {
      const resolved = await resolvePlayerForImport(tx, { cleanedName: displayName, gender });
      if (resolved.action === "blocked") throw new Error(resolved.reason);

      let player: { id: string; displayName: string };
      if (resolved.action === "reuse") {
        player = { id: resolved.playerId, displayName: resolved.displayName };
        summary.playersReused += 1;
        if (resolved.via === "alias") summary.playersReusedViaAlias += 1;
      } else {
        const parts = nameParts(displayName);
        const created = await tx.player.create({
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
          },
          select: { id: true, displayName: true }
        });
        player = created;
        summary.playersCreated += 1;
      }
      playerByName.set(normalize(displayName), { id: player.id, displayName: player.displayName });
    }

    const rosterEvidenceByPlayer = new Map<string, { playerId: string; teamId: string; startsOn: Date }>();

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
        const cleanedName = prepareImportedPlayerName(playerRow.name);
        const player = playerByName.get(normalize(cleanedName));
        const team = teamBySubmittedName.get(normalize(stringValue(playerRow.team)));
        if (!player || !team) throw new Error(`Missing player/team mapping for ${cleanedName} in ${submittedGame.gameNumber}.`);

        const submittedBoxScore = buildGameStatBoxScoreFromPlayerRow(playerRow);
        const existingStat = await tx.gameStat.findUnique({
          where: { gameId_playerId: { gameId: game.id, playerId: player.id } },
          select: gameStatBoxScoreSelect()
        });
        const decision = evaluateGameStatImmutability(existingGameStatToCompareInput(existingStat), submittedBoxScore);

        if (decision.action === "create") {
          await tx.gameStat.create({
            data: {
              gameId: game.id,
              playerId: player.id,
              teamId: team.id,
              ...submittedBoxScore
            }
          });
          summary.gameStatsCreated += 1;
        } else if (decision.action === "skip") {
          summary.gameStatsSkipped += 1;
        } else {
          summary.gameStatsBlocked += 1;
          summary.gameStatBlockedDetails.push({
            gameNumber: submittedGame.gameNumber,
            playerName: cleanedName,
            reason: decision.reason,
            diffs: decision.diffs
          });
        }

        if (decision.action === "create" || decision.action === "skip") {
          const currentEvidence = rosterEvidenceByPlayer.get(player.id);
          if (!currentEvidence || submittedGame.gameDate > currentEvidence.startsOn) {
            rosterEvidenceByPlayer.set(player.id, {
              playerId: player.id,
              teamId: team.id,
              startsOn: submittedGame.gameDate
            });
          }
        }
      }
    }

    if (summary.gameStatsBlocked > 0) {
      throw new Error(`Import blocked: ${summary.gameStatsBlocked} GameStat row(s) would modify existing historical evidence. ${JSON.stringify(summary.gameStatBlockedDetails)}`);
    }

    for (const evidence of rosterEvidenceByPlayer.values()) {
      await ensurePlayerRosterFromGameStat(tx, {
        ...evidence,
        seasonId: season.id
      });
    }

    const importNote = `Official import completed: ${JSON.stringify(summary)}`;
    await tx.submission.update({
      where: { id: submission.id },
      data: {
        status: SubmissionStatus.IMPORTED,
        importedAt: new Date(),
        adminNotes: appendAdminNotes(submission.adminNotes, importNote)
      },
      select: { id: true }
    });

    return summary;
  }, { timeout: OFFICIAL_IMPORT_TRANSACTION_TIMEOUT_MS, isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
