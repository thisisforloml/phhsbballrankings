import type { Submission } from "@prisma/client";
import { hasExplicitBoysCompetitionContext, inferCompetitionGender, normalizeCompetitionDisplayName } from "@/lib/competition-naming";
import { safeParseSubmissionJson, formatSubmissionJsonParseError, type SubmissionJsonParseResult } from "@/lib/submission-json";

const gameRequiredFields = [
  "gameNumber",
  "gameDate",
  "game",
  "homeTeamName",
  "awayTeamName",
  "homeScore",
  "awayScore",
  "city",
  "region",
  "sourceName",
  "players"
] as const;

const playerRequiredFields = [
  "name",
  "team",
  "MIN",
  "PTS",
  "FGM",
  "FGA",
  "3PM",
  "3PA",
  "FTM",
  "FTA",
  "OREB",
  "DREB",
  "TRB",
  "AST",
  "PF",
  "FD",
  "+/-"
] as const;

const schoolDisplayMap: Record<string, string> = {
  ATENEO: "Ateneo de Manila University",
  ADMU: "Ateneo de Manila University",
  "ATENEO JRS": "Ateneo de Manila University",
  "LA SALLE": "De La Salle Santiago Zobel",
  "DE LA SALLE JRS": "De La Salle Santiago Zobel",
  DLSZ: "De La Salle Santiago Zobel",
  DLSU: "De La Salle Santiago Zobel",
  UE: "University of the East",
  "UE JRS": "University of the East",
  NU: "National University Nazareth School",
  NUNS: "National University Nazareth School",
  "NU JRS": "National University Nazareth School",
  UST: "University of Santo Tomas",
  "UST JRS": "University of Santo Tomas",
  UP: "University of the Philippines Integrated School",
  UPIS: "University of the Philippines Integrated School",
  "UPIS JRS": "University of the Philippines Integrated School",
  ADU: "Adamson University",
  "ADU JRS": "Adamson University",
  FEU: "Far Eastern University",
  "FEU JRS": "Far Eastern University"
};

type JsonRecord = Record<string, unknown>;

type PointTotalCheck = {
  gameNumber: string;
  game: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  summedHomePlayerPoints: number;
  summedAwayPlayerPoints: number;
  homePass: boolean;
  awayPass: boolean;
};

type MissingFieldIssue = {
  scope: "submission" | "game" | "player";
  gameNumber?: string;
  playerName?: string;
  missingFields: string[];
};

type TeamMismatch = {
  gameNumber: string;
  playerName: string;
  team: string;
  expectedTeams: string[];
};

type DuplicatePlayerIssue = {
  gameNumber: string;
  team: string;
  playerName: string;
  count: number;
};

export type SubmissionReview = {
  validJson: boolean;
  parseError: string | null;
  parseErrorPosition?: number;
  parseErrorLine?: number;
  parseErrorColumn?: number;
  importReady: boolean;
  readinessLabel: string;
  summary: {
    packageCount: number;
    multiplePackagesFound: boolean;
    leagueName: string | null;
    ageGroup: string | null;
    seasonName: string | null;
    seasonYear: number | null;
    gameCount: number;
    totalPlayerRows: number;
    uniquePlayerNamesCount: number;
    uniquePlayerNames: string[];
    detectedTeams: string[];
  };
  validation: {
    pointTotals: PointTotalCheck[];
    missingRequiredFields: MissingFieldIssue[];
    duplicatePlayerNamesWithinGames: DuplicatePlayerIssue[];
    teamNamesNotMatchingGameTeams: TeamMismatch[];
  };
  recommendations: {
    leagueNameIssues: string[];
    recommendedLeagueName: string | null;
    missingGenderField: boolean;
    inferredGender: "BOYS" | "GIRLS" | null;
    teamDisplayMapping: Array<{ sourceName: string; displayName: string }>;
  };
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

function booleanValue(value: unknown): boolean {
  return value === true;
}

function cleanPlayerName(value: unknown): string {
  return stringValue(value).replace(/^\*+/, "").trim();
}

function normalizeTeamName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

function displayTeamName(value: string): string {
  return schoolDisplayMap[normalizeTeamName(value)] ?? value;
}

function missingFields(record: JsonRecord, fields: readonly string[]) {
  return fields.filter((field) => {
    const value = record[field];
    if (field === "players") return !Array.isArray(value);
    return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
  });
}

function parseSubmissionJson(submission: Pick<Submission, "rawText" | "parsedPreview">): { parsed: unknown | null; error: string | null; result: SubmissionJsonParseResult } {
  const result = safeParseSubmissionJson(submission);
  if (result.ok) return { parsed: result.data, error: null, result };
  return { parsed: null, error: formatSubmissionJsonParseError(result), result };
}

function getSubmissionPackages(parsed: unknown): { packages: JsonRecord[]; error: string | null; multiplePackagesFound: boolean } {
  const rootRecord = asRecord(parsed);
  if (rootRecord) return { packages: [rootRecord], error: null, multiplePackagesFound: false };

  if (Array.isArray(parsed)) {
    const packages = parsed.map(asRecord).filter((item): item is JsonRecord => item !== null);
    if (packages.length === 0) return { packages: [], error: "JSON array did not contain any package objects.", multiplePackagesFound: parsed.length > 1 };
    return { packages, error: null, multiplePackagesFound: packages.length > 1 };
  }

  return { packages: [], error: "JSON root must be an object or an array of package objects.", multiplePackagesFound: false };
}

export function buildSubmissionReview(submission: Pick<Submission, "rawText" | "parsedPreview" | "title" | "leagueName">): SubmissionReview {
  const parseResult = parseSubmissionJson(submission);
  const { parsed, error } = parseResult;
  const packageResult = getSubmissionPackages(parsed);
  const packages = packageResult.packages;
  const root = packages[0] ?? null;
  const missingRequiredFields: MissingFieldIssue[] = [];
  const pointTotals: PointTotalCheck[] = [];
  const teamNamesNotMatchingGameTeams: TeamMismatch[] = [];
  const duplicatePlayerNamesWithinGames: DuplicatePlayerIssue[] = [];

  if (!root) {
    return {
      validJson: false,
      parseError: error ?? packageResult.error ?? "JSON root must be an object or array package.",
      parseErrorPosition: parseResult.result.ok ? undefined : parseResult.result.position,
      parseErrorLine: parseResult.result.ok ? undefined : parseResult.result.line,
      parseErrorColumn: parseResult.result.ok ? undefined : parseResult.result.column,
      importReady: false,
      readinessLabel: "Needs review",
      summary: {
        packageCount: packages.length,
        multiplePackagesFound: packageResult.multiplePackagesFound,
        leagueName: null,
        ageGroup: null,
        seasonName: null,
        seasonYear: null,
        gameCount: 0,
        totalPlayerRows: 0,
        uniquePlayerNamesCount: 0,
        uniquePlayerNames: [],
        detectedTeams: []
      },
      validation: {
        pointTotals,
        missingRequiredFields: [{ scope: "submission", missingFields: ["valid JSON package"] }],
        duplicatePlayerNamesWithinGames,
        teamNamesNotMatchingGameTeams
      },
      recommendations: {
        leagueNameIssues: [],
        recommendedLeagueName: null,
        missingGenderField: true,
        inferredGender: null,
        teamDisplayMapping: []
      }
    };
  }

  if (packageResult.multiplePackagesFound) {
    missingRequiredFields.push({ scope: "submission", missingFields: ["single package only for v1 review/import"] });
  }

  const uniqueNames = new Set<string>();
  const detectedTeams = new Set<string>();
  let totalPlayerRows = 0;
  const allGames: JsonRecord[] = [];

  for (const submissionPackage of packages) {
    const rootMissing = missingFields(submissionPackage, ["league", "season", "games"]);
    if (rootMissing.length) missingRequiredFields.push({ scope: "submission", missingFields: rootMissing });
    const packageGames = asArray(submissionPackage.games).map(asRecord).filter((game): game is JsonRecord => game !== null);
    allGames.push(...packageGames);
  }

  const primaryPackage = root;
  const league = asRecord(primaryPackage.league);
  const season = asRecord(primaryPackage.season);

  for (const game of allGames) {
    const gameNumber = stringValue(game.gameNumber) || "Unknown game";
    const gameMissing = missingFields(game, gameRequiredFields);
    if (gameMissing.length) missingRequiredFields.push({ scope: "game", gameNumber, missingFields: gameMissing });

    const homeTeamName = stringValue(game.homeTeamName);
    const awayTeamName = stringValue(game.awayTeamName);
    const homeTeamKey = normalizeTeamName(homeTeamName);
    const awayTeamKey = normalizeTeamName(awayTeamName);
    const homeScore = numberValue(game.homeScore);
    const awayScore = numberValue(game.awayScore);
    const isTeamResultOnly = booleanValue(game.teamResultOnly) || booleanValue(game.defaultWin);
    const players = asArray(game.players).map(asRecord).filter((player): player is JsonRecord => player !== null);
    totalPlayerRows += players.length;

    if (homeTeamName) detectedTeams.add(homeTeamName);
    if (awayTeamName) detectedTeams.add(awayTeamName);

    let summedHomePlayerPoints = 0;
    let summedAwayPlayerPoints = 0;
    const duplicateKeyCounts = new Map<string, { name: string; team: string; count: number }>();

    for (const player of players) {
      const cleanedName = cleanPlayerName(player.name);
      const team = stringValue(player.team);
      const teamKey = normalizeTeamName(team);
      const points = numberValue(player.PTS);
      const playerMissing = missingFields(player, playerRequiredFields);

      if (cleanedName) uniqueNames.add(cleanedName);
      if (team) detectedTeams.add(team);
      if (playerMissing.length) missingRequiredFields.push({ scope: "player", gameNumber, playerName: cleanedName || "Unknown player", missingFields: playerMissing });

      if (teamKey === homeTeamKey) summedHomePlayerPoints += points;
      if (teamKey === awayTeamKey) summedAwayPlayerPoints += points;
      if (teamKey !== homeTeamKey && teamKey !== awayTeamKey) {
        teamNamesNotMatchingGameTeams.push({ gameNumber, playerName: cleanedName || "Unknown player", team: team || "Missing team", expectedTeams: [homeTeamName, awayTeamName].filter(Boolean) });
      }

      const duplicateKey = `${gameNumber}:${teamKey}:${cleanedName.toUpperCase()}`;
      const current = duplicateKeyCounts.get(duplicateKey) ?? { name: cleanedName || "Unknown player", team: team || "Missing team", count: 0 };
      current.count += 1;
      duplicateKeyCounts.set(duplicateKey, current);
    }

    for (const entry of duplicateKeyCounts.values()) {
      if (entry.count > 1) duplicatePlayerNamesWithinGames.push({ gameNumber, team: entry.team, playerName: entry.name, count: entry.count });
    }

    pointTotals.push({
      gameNumber,
      game: stringValue(game.game),
      homeTeamName,
      awayTeamName,
      homeScore,
      awayScore,
      summedHomePlayerPoints,
      summedAwayPlayerPoints,
      homePass: isTeamResultOnly && players.length === 0 ? true : homeScore === summedHomePlayerPoints,
      awayPass: isTeamResultOnly && players.length === 0 ? true : awayScore === summedAwayPlayerPoints
    });
  }

  const rawLeagueName = stringValue(league?.name) || submission.leagueName || null;
  const leagueName = rawLeagueName ? normalizeCompetitionDisplayName(rawLeagueName) : null;
  const ageGroup = stringValue(league?.ageGroup) || null;
  const seasonName = stringValue(season?.name) || null;
  const seasonYear = typeof season?.seasonYear === "number" ? season.seasonYear : null;
  const genderValue = stringValue(root.gender) || stringValue(league?.gender);
  const missingGenderField = !genderValue;
  const inferredGender = inferCompetitionGender(genderValue, `${leagueName ?? ""} ${submission.title ?? ""}`);
  const leagueNameIssues: string[] = [];
  const normalizedLeague = leagueName ?? submission.title;

  if (/16u/i.test(normalizedLeague)) leagueNameIssues.push('Use uppercase "16U" in league naming.');
  if (!hasExplicitBoysCompetitionContext(normalizedLeague) && inferredGender === "BOYS") leagueNameIssues.push('Gender is not explicit; confirm and include "Boys" before import.');

  const recommendedLeagueName = /uaap/i.test(normalizedLeague) && /16u/i.test(normalizedLeague)
    ? "UAAP Season 88 16U Boys Basketball"
    : rawLeagueName && normalizeCompetitionDisplayName(rawLeagueName) !== rawLeagueName
      ? normalizeCompetitionDisplayName(rawLeagueName)
      : null;
  const teamDisplayMapping = Array.from(detectedTeams)
    .sort((left, right) => left.localeCompare(right))
    .map((sourceName) => ({ sourceName, displayName: displayTeamName(sourceName) }));
  const pointTotalsPass = pointTotals.every((check) => check.homePass && check.awayPass);
  const importReady = Boolean(root)
    && pointTotalsPass
    && missingRequiredFields.length === 0
    && teamNamesNotMatchingGameTeams.length === 0
    && duplicatePlayerNamesWithinGames.length === 0;

  return {
    validJson: true,
    parseError: null,
    importReady,
    readinessLabel: importReady ? "Ready for admin cleanup/import" : "Needs review",
    summary: {
      leagueName,
      ageGroup,
      seasonName,
      seasonYear,
      packageCount: packages.length,
      multiplePackagesFound: packageResult.multiplePackagesFound,
      gameCount: allGames.length,
      totalPlayerRows,
      uniquePlayerNamesCount: uniqueNames.size,
      uniquePlayerNames: Array.from(uniqueNames).sort((left, right) => left.localeCompare(right)),
      detectedTeams: Array.from(detectedTeams).sort((left, right) => left.localeCompare(right))
    },
    validation: {
      pointTotals,
      missingRequiredFields,
      duplicatePlayerNamesWithinGames,
      teamNamesNotMatchingGameTeams
    },
    recommendations: {
      leagueNameIssues,
      recommendedLeagueName,
      missingGenderField,
      inferredGender,
      teamDisplayMapping
    }
  };
}
