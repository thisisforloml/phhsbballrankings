"use server";

import { OrganizerSubmissionType, type Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { invalidateAdminSubmissionListCaches } from "@/lib/admin/invalidate-admin-caches";
import { requireOrganizerUser } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { safeJsonParse } from "@/lib/submission-json";
import { withListReviewInValidationSummary } from "@/lib/submission-list-review-snapshot";
import { buildSubmissionListReview } from "@/lib/submission-review";

type JsonRecord = Record<string, unknown>;

type ManualStatRow = {
  team: string;
  name: string;
  starter: boolean;
  MIN: string;
  PTS: number;
  FGM: number;
  FGA: number;
  "3PM": number;
  "3PA": number;
  "2PM": number;
  "2PA": number;
  FTM: number;
  FTA: number;
  OREB: number;
  DREB: number;
  TRB: number;
  AST: number;
  STL: number;
  BLK: number;
  TOV: number;
  PF: number;
  FD: number;
  "+/-": number;
};

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function stringValue(record: JsonRecord, key: string) {
  return typeof record[key] === "string" ? record[key].trim() : "";
}

function numberValue(record: JsonRecord, key: string) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : Number(value ?? 0);
}

function requireString(record: JsonRecord, key: string, label: string) {
  const value = stringValue(record, key);
  if (!value) throw new Error(`${label} is required.`);
  return value;
}

function requireInteger(record: JsonRecord, key: string, label: string) {
  const value = numberValue(record, key);
  if (!Number.isInteger(value)) throw new Error(`${label} must be a whole number.`);
  return value;
}

function optionalInteger(record: JsonRecord, key: string) {
  const value = numberValue(record, key);
  if (!Number.isInteger(value) || value < 0) return 0;
  return value;
}

function validateDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime())) {
    throw new Error("Game date must be a valid date.");
  }
  return date;
}

function normalizeTeam(value: string) {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

function validateMinutes(value: string, label: string) {
  const raw = value.trim();
  if (!raw) return "00:00";
  if (!/^\d{1,2}:\d{2}$/.test(raw)) throw new Error(`${label}: minutes must use mm:ss format.`);
  const [minutes, seconds] = raw.split(":").map(Number);
  if (minutes < 0 || minutes > 60 || seconds < 0 || seconds > 59) throw new Error(`${label}: minutes must use valid mm:ss time.`);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function validateShotLine(row: ManualStatRow, label: string, madeKey: keyof ManualStatRow, attemptKey: keyof ManualStatRow, issues: string[]) {
  const made = Number(row[madeKey]);
  const attempt = Number(row[attemptKey]);
  if (made > attempt) issues.push(`${label}: ${String(madeKey)} cannot exceed ${String(attemptKey)}.`);
}

function scoreFromQuarters(root: JsonRecord, prefix: "home" | "away") {
  return optionalInteger(root, `${prefix}Q1`) + optionalInteger(root, `${prefix}Q2`) + optionalInteger(root, `${prefix}Q3`) + optionalInteger(root, `${prefix}Q4`) + optionalInteger(root, `${prefix}OT`);
}

function buildManualSubmissionPackage(payload: unknown) {
  const root = asRecord(payload);
  if (!root) throw new Error("Manual submission payload is invalid.");

  const leagueName = requireString(root, "leagueName", "League name");
  const ageGroup = requireString(root, "ageGroup", "Age group");
  const gender = requireString(root, "gender", "Gender").toUpperCase() === "GIRLS" ? "GIRLS" : "BOYS";
  const seasonName = requireString(root, "season", "Season");
  const seasonYear = requireInteger(root, "seasonYear", "Season year");
  const gameNumber = requireString(root, "gameNumber", "Game number");
  const gameDate = requireString(root, "gameDate", "Game date");
  const homeTeamName = requireString(root, "homeTeamName", "Home team");
  const awayTeamName = requireString(root, "awayTeamName", "Away team");
  const homeScore = scoreFromQuarters(root, "home");
  const awayScore = scoreFromQuarters(root, "away");
  const city = requireString(root, "city", "City");
  const region = requireString(root, "region", "Region");
  validateDate(gameDate);

  if (homeScore <= 0 || awayScore <= 0) {
    throw new Error("Quarter scores must calculate to a final score greater than 0 for both teams.");
  }

  const rawRows = Array.isArray(root.players) ? root.players : [];
  const players = rawRows.map(asRecord).filter((row): row is JsonRecord => row !== null).map((row): ManualStatRow => {
    const name = requireString(row, "name", "Player name");
    const oreb = requireInteger(row, "OREB", "OREB");
    const dreb = requireInteger(row, "DREB", "DREB");
    return {
      team: requireString(row, "team", "Player team"),
      name,
      starter: Boolean(row.starter),
      MIN: validateMinutes(stringValue(row, "MIN"), name),
      PTS: requireInteger(row, "PTS", "PTS"),
      FGM: requireInteger(row, "FGM", "FGM"),
      FGA: requireInteger(row, "FGA", "FGA"),
      "3PM": requireInteger(row, "3PM", "3PM"),
      "3PA": requireInteger(row, "3PA", "3PA"),
      "2PM": requireInteger(row, "2PM", "2PM"),
      "2PA": requireInteger(row, "2PA", "2PA"),
      FTM: requireInteger(row, "FTM", "FTM"),
      FTA: requireInteger(row, "FTA", "FTA"),
      OREB: oreb,
      DREB: dreb,
      TRB: oreb + dreb,
      AST: requireInteger(row, "AST", "AST"),
      STL: requireInteger(row, "STL", "STL"),
      BLK: requireInteger(row, "BLK", "BLK"),
      TOV: requireInteger(row, "TOV", "TOV"),
      PF: requireInteger(row, "PF", "PF"),
      FD: requireInteger(row, "FD", "FD"),
      "+/-": requireInteger(row, "+/-", "+/-")
    };
  });

  if (!players.length) throw new Error("Add at least one player stat row.");

  const issues: string[] = [];
  const homeKey = normalizeTeam(homeTeamName);
  const awayKey = normalizeTeam(awayTeamName);
  let homePoints = 0;
  let awayPoints = 0;

  for (const row of players) {
    const teamKey = normalizeTeam(row.team);
    if (teamKey !== homeKey && teamKey !== awayKey) {
      issues.push(`${row.name}: team must match ${homeTeamName} or ${awayTeamName}.`);
    }
    if (teamKey === homeKey) homePoints += row.PTS;
    if (teamKey === awayKey) awayPoints += row.PTS;
    validateShotLine(row, row.name, "FGM", "FGA", issues);
    validateShotLine(row, row.name, "3PM", "3PA", issues);
    validateShotLine(row, row.name, "2PM", "2PA", issues);
    validateShotLine(row, row.name, "FTM", "FTA", issues);
  }

  if (homePoints !== homeScore) issues.push(`${homeTeamName} player points total ${homePoints}, but calculated final score is ${homeScore}.`);
  if (awayPoints !== awayScore) issues.push(`${awayTeamName} player points total ${awayPoints}, but calculated final score is ${awayScore}.`);

  if (issues.length) throw new Error(issues.join(" "));

  return {
    league: {
      name: leagueName,
      ageGroup,
      gender
    },
    gender,
    season: {
      name: seasonName,
      seasonYear
    },
    games: [
      {
        gameNumber,
        gameDate,
        game: `${homeTeamName} vs ${awayTeamName}`,
        homeTeamName,
        awayTeamName,
        homeScore,
        awayScore,
        homeQ1: optionalInteger(root, "homeQ1"),
        homeQ2: optionalInteger(root, "homeQ2"),
        homeQ3: optionalInteger(root, "homeQ3"),
        homeQ4: optionalInteger(root, "homeQ4"),
        homeOT: optionalInteger(root, "homeOT"),
        awayQ1: optionalInteger(root, "awayQ1"),
        awayQ2: optionalInteger(root, "awayQ2"),
        awayQ3: optionalInteger(root, "awayQ3"),
        awayQ4: optionalInteger(root, "awayQ4"),
        awayOT: optionalInteger(root, "awayOT"),
        city,
        region,
        sourceName: "Manual stats entry",
        players
      }
    ]
  };
}

function manualReturnPath(formData: FormData, isAdmin: boolean) {
  const value = String(formData.get("returnTo") ?? "").trim();
  if (isAdmin && value === "/admin/tools/live-stats") return value;
  return "/organizer/live-stats";
}

function redirectWithError(path: string, message: string) {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function createManualStatsSubmission(formData: FormData) {
  const user = await requireOrganizerUser();
  const returnPath = manualReturnPath(formData, user.role === "ADMIN");
  const submissionsPath = returnPath.startsWith("/admin") ? "/admin/tools/submissions" : "/organizer/submissions";
  const rawPayload = String(formData.get("manualSubmissionPayload") ?? "");

  try {
    const parsedPayload = safeJsonParse(rawPayload);
    if (!parsedPayload.ok) throw new Error("Manual stat form could not be read. Please refresh and try again.");

    const packageJson = buildManualSubmissionPackage(parsedPayload.data);
    const rawText = JSON.stringify(packageJson, null, 2);
    const title = `${packageJson.league.name} ${packageJson.games[0].gameNumber}: ${packageJson.games[0].homeTeamName} vs ${packageJson.games[0].awayTeamName}`;

    const listReview = buildSubmissionListReview({
      rawText,
      parsedPreview: {
        kind: "object",
        keys: Object.keys(packageJson),
        sample: packageJson,
      },
      title: title.slice(0, 160),
      leagueName: packageJson.league.name,
    });

    await prisma.submission.create({
      data: {
        submittedByUserId: user.id,
        type: OrganizerSubmissionType.PASTE_JSON,
        status: "SUBMITTED",
        title: title.slice(0, 160),
        leagueName: packageJson.league.name,
        gameDate: validateDate(packageJson.games[0].gameDate),
        originalFilename: null,
        mimeType: "application/json",
        fileSizeBytes: Buffer.byteLength(rawText, "utf8"),
        storedFilePath: null,
        rawText,
        parsedPreview: {
          kind: "object",
          keys: Object.keys(packageJson),
          sample: packageJson
        } as Prisma.InputJsonValue,
        validationSummary: withListReviewInValidationSummary(
          {
            ok: true,
            format: "manual-entry",
            messages: ["Manual game stats saved as a submission draft. Official data was not changed."],
            previewSupported: true,
            rowCount: packageJson.games[0].players.length,
          },
          listReview,
        ),
        adminNotes: null
      }
    });
  } catch (error) {
    redirectWithError(returnPath, error instanceof Error ? error.message : "Manual submission could not be saved.");
  }

  invalidateAdminSubmissionListCaches();
  revalidatePath("/organizer/submissions");
  revalidatePath("/admin/tools/submissions");
  revalidatePath("/admin/submissions");
  redirect(`${submissionsPath}?created=1`);
}
