import { isInaccessibleFeedStatus } from "@/lib/stats-import/reconciliation/reconcile-game";
import type { ExternalGameIndex, SubmissionGameDraft } from "@/lib/stats-import/types";

type FibaTeam = {
  code?: string;
  shortName?: string;
  name?: string;
  score?: number;
  pl?: Record<string, FibaPlayer>;
};

type FibaPlayer = Record<string, unknown> & {
  cName?: string;
  cNumber?: string;
  sMinutes?: string | number;
  sPoints?: number;
  sFieldGoalsMade?: number;
  sFieldGoalsAttempted?: number;
  sThreePointersMade?: number;
  sThreePointersAttempted?: number;
  sTwoPointersMade?: number;
  sTwoPointersAttempted?: number;
  sFreeThrowsMade?: number;
  sFreeThrowsAttempted?: number;
  sReboundsOffensive?: number;
  sReboundsDefensive?: number;
  sReboundsTotal?: number;
  sAssists?: number;
  sSteals?: number;
  sBlocks?: number;
  sTurnovers?: number;
  sFoulsPersonal?: number;
  sFoulsOn?: number;
  sPlusMinus?: number;
};

type FibaMatchData = {
  matchId?: number | string;
  compName?: string;
  matchTime?: string;
  tm?: Record<string, FibaTeam>;
};

export type FibaMatchDataResult =
  | { ok: true; data: FibaMatchData }
  | { ok: false; status: number };

const FIBA_DATA_JSON_URL = (matchId: string) =>
  `https://fibalivestats.dcd.shared.geniussports.com/data/${matchId}/data.json`;

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

const COLON_CLOCK_PATTERN = /^(\d{1,3}):(\d{2})$/;

/** Normalize FIBA/Genius colon clock strings, carrying seconds >= 60 into minutes. */
export function normalizeColonClockString(value: string): string | null {
  const trimmed = value.trim();
  const match = trimmed.match(COLON_CLOCK_PATTERN);
  if (!match) return null;

  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || minutes < 0 || seconds < 0) {
    return null;
  }

  const totalSeconds = Math.max(0, minutes * 60 + seconds);
  const normalizedMinutes = Math.floor(totalSeconds / 60);
  const normalizedSeconds = totalSeconds % 60;
  return `${String(normalizedMinutes).padStart(2, "0")}:${String(normalizedSeconds).padStart(2, "0")}`;
}

export function formatMinutes(value: unknown): string {
  if (typeof value === "string") {
    if (value.includes(":")) {
      return normalizeColonClockString(value) ?? "00:00";
    }
    return "00:00";
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const total = Math.max(0, Math.round(value));
    const hours = Math.floor(total / 60);
    const minutes = total % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }
  return "00:00";
}

function stripStarterMarker(value: string) {
  return value.replace(/^\*+/, "").trim();
}

function normalizePlayerNameString(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

/** True when the label is an initial-style display name such as "J. Cruz" or "E. Araneta". */
export function isAbbreviatedPlayerName(name: string) {
  const trimmed = normalizePlayerNameString(name);
  if (!trimmed) return false;
  const [first] = trimmed.split(/\s+/);
  if (!first) return false;
  return /^[A-Za-z]\.?$/.test(first);
}

/**
 * Canonical FIBA player name for URL import and draft JSON.
 * Prefers full identity fields over abbreviated scoreboard labels.
 */
export function canonicalPlayerName(player: Record<string, unknown>): string {
  const cName = normalizePlayerNameString(stripStarterMarker(stringValue(player.cName)));
  if (cName && !isAbbreviatedPlayerName(cName)) return cName;

  const firstLast = normalizePlayerNameString(
    `${stringValue(player.firstName)} ${stringValue(player.familyName)}`
  );
  if (firstLast) return firstLast;

  const international = normalizePlayerNameString(
    `${stringValue(player.internationalFirstName)} ${stringValue(player.internationalFamilyName)}`
  );
  if (international) return international;

  const scoreboardName = normalizePlayerNameString(stripStarterMarker(stringValue(player.scoreboardName)));
  if (scoreboardName) return scoreboardName;

  const displayName = normalizePlayerNameString(stripStarterMarker(stringValue(player.name)));
  if (displayName) return displayName;

  return "Unknown player";
}

/** @deprecated Use canonicalPlayerName — kept for existing call sites. */
export function fibaPlayerDisplayName(player: Record<string, unknown>): string {
  return canonicalPlayerName(player);
}

function playerName(player: FibaPlayer): string {
  return canonicalPlayerName(player);
}

function teamLabel(team: FibaTeam): string {
  return stringValue(team.shortName) || stringValue(team.code) || stringValue(team.name) || "Unknown team";
}

export function fibaTeamLabelsFromMatch(data: FibaMatchData): { home: string; away: string } | null {
  const homeTeam = data.tm?.["1"];
  const awayTeam = data.tm?.["2"];
  if (!homeTeam || !awayTeam) return null;
  return {
    home: teamLabel(homeTeam),
    away: teamLabel(awayTeam)
  };
}

export async function fetchFibaTeamLabels(
  matchId: string,
  scheduleFallback?: { home: string; away: string } | null
): Promise<{ home: string; away: string }> {
  const result = await fetchFibaMatchDataResult(matchId);
  if (result.ok) {
    const labels = fibaTeamLabelsFromMatch(result.data);
    if (!labels) throw new Error(`Match ${matchId} is missing team labels.`);
    return labels;
  }

  if (isInaccessibleFeedStatus(result.status) && scheduleFallback) {
    return scheduleFallback;
  }

  throw new Error(`Request failed (${result.status}) for ${FIBA_DATA_JSON_URL(matchId)}`);
}

function normalizePlayerRow(player: FibaPlayer, teamName: string): Record<string, string | number> {
  const oreb = numberValue(player.sReboundsOffensive);
  const dreb = numberValue(player.sReboundsDefensive);
  return {
    team: teamName,
    name: playerName(player),
    MIN: formatMinutes(player.sMinutes),
    PTS: numberValue(player.sPoints),
    FGM: numberValue(player.sFieldGoalsMade),
    FGA: numberValue(player.sFieldGoalsAttempted),
    "3PM": numberValue(player.sThreePointersMade),
    "3PA": numberValue(player.sThreePointersAttempted),
    "2PM": numberValue(player.sTwoPointersMade),
    "2PA": numberValue(player.sTwoPointersAttempted),
    FTM: numberValue(player.sFreeThrowsMade),
    FTA: numberValue(player.sFreeThrowsAttempted),
    OREB: oreb,
    DREB: dreb,
    TRB: numberValue(player.sReboundsTotal) || oreb + dreb,
    AST: numberValue(player.sAssists),
    STL: numberValue(player.sSteals),
    BLK: numberValue(player.sBlocks),
    TOV: numberValue(player.sTurnovers),
    PF: numberValue(player.sFoulsPersonal),
    FD: numberValue(player.sFoulsOn),
    "+/-": numberValue(player.sPlusMinus)
  };
}

function parseGameDate(match: FibaMatchData): string {
  const raw = stringValue(match.matchTime);
  if (raw) {
    const iso = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    if (iso) return iso[1];
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

export async function fetchFibaMatchDataResult(matchId: string): Promise<FibaMatchDataResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(FIBA_DATA_JSON_URL(matchId), {
      signal: controller.signal,
      headers: {
        "User-Agent": "PeachBasket-Admin-UrlImport/1.0",
        Accept: "application/json, text/html, */*"
      },
      cache: "no-store"
    });
    if (!response.ok) {
      return { ok: false, status: response.status };
    }
    const text = await response.text();
    return { ok: true, data: JSON.parse(text) as FibaMatchData };
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchFibaMatchData(matchId: string): Promise<FibaMatchData> {
  const result = await fetchFibaMatchDataResult(matchId);
  if (!result.ok) {
    throw new Error(`Request failed (${result.status}) for ${FIBA_DATA_JSON_URL(matchId)}`);
  }
  return result.data;
}

export function scheduleGameToSubmissionDraft(
  matchId: string,
  scheduleGame: ExternalGameIndex,
  options: {
    gameNumber?: string;
    city: string;
    region: string;
    sourceUrl: string;
  }
): SubmissionGameDraft {
  const homeScore = scheduleGame.homeScore ?? 0;
  const awayScore = scheduleGame.awayScore ?? 0;
  const gameNumber = options.gameNumber ?? `SH-MATCH-${matchId}`;

  return {
    gameNumber,
    gameDate: scheduleGame.gameDate ?? new Date().toISOString().slice(0, 10),
    game: `${scheduleGame.homeTeamLabel} ${homeScore} - ${awayScore} ${scheduleGame.awayTeamLabel}`,
    homeTeamName: scheduleGame.homeTeamLabel,
    awayTeamName: scheduleGame.awayTeamLabel,
    homeScore,
    awayScore,
    city: options.city,
    region: options.region,
    sourceName: `StatsHub URL import — ${options.sourceUrl}`.slice(0, 240),
    players: []
  };
}

export function fibaMatchToSubmissionGame(
  matchId: string,
  data: FibaMatchData,
  options: {
    gameNumber?: string;
    city: string;
    region: string;
    sourceUrl: string;
  }
): SubmissionGameDraft {
  const homeTeam = data.tm?.["1"];
  const awayTeam = data.tm?.["2"];
  if (!homeTeam || !awayTeam) {
    throw new Error(`Match ${matchId} is missing team data.`);
  }

  const homeTeamName = teamLabel(homeTeam);
  const awayTeamName = teamLabel(awayTeam);
  const homeScore = numberValue(homeTeam.score);
  const awayScore = numberValue(awayTeam.score);
  const homePlayers = Object.values(homeTeam.pl ?? {}).map((player) => normalizePlayerRow(player, homeTeamName));
  const awayPlayers = Object.values(awayTeam.pl ?? {}).map((player) => normalizePlayerRow(player, awayTeamName));
  const players = [...homePlayers, ...awayPlayers];

  if (!players.length) {
    throw new Error(`Match ${matchId} has no player stat rows.`);
  }

  const gameDate = parseGameDate(data);
  const gameNumber = options.gameNumber ?? `SH-MATCH-${matchId}`;

  return {
    gameNumber,
    gameDate,
    game: `${homeTeamName} ${homeScore} - ${awayScore} ${awayTeamName}`,
    homeTeamName,
    awayTeamName,
    homeScore,
    awayScore,
    city: options.city,
    region: options.region,
    sourceName: `StatsHub URL import — ${options.sourceUrl}`.slice(0, 240),
    players
  };
}

export async function enrichSingleGamePreview(matchId: string, sourceUrl: string) {
  const data = await fetchFibaMatchData(matchId);
  const homeTeam = data.tm?.["1"];
  const awayTeam = data.tm?.["2"];
  return {
    homeTeamLabel: homeTeam ? teamLabel(homeTeam) : "Unknown",
    awayTeamLabel: awayTeam ? teamLabel(awayTeam) : "Unknown",
    homeScore: homeTeam ? numberValue(homeTeam.score) : null,
    awayScore: awayTeam ? numberValue(awayTeam.score) : null,
    gameDate: parseGameDate(data),
    competitionTitle: stringValue(data.compName) || null,
    status: "final" as const,
    statsAvailable: Boolean(homeTeam && awayTeam && Object.keys(homeTeam.pl ?? {}).length)
  };
}
