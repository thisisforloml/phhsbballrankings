import type { GameStat } from "@prisma/client";

/** Box-score fields compared for GameStat immutability (not identity keys). */
export const GAME_STAT_BOX_SCORE_FIELDS = [
  "starter",
  "minutes",
  "points",
  "offensiveRebounds",
  "defensiveRebounds",
  "rebounds",
  "assists",
  "steals",
  "blocks",
  "turnovers",
  "fouls",
  "foulsDrawn",
  "plusMinus",
  "fieldGoalsMade",
  "fieldGoalsAttempt",
  "twoMade",
  "twoAttempt",
  "threeMade",
  "threeAttempt",
  "freeThrowsMade",
  "freeThrowsAttempt"
] as const;

export type GameStatBoxScoreField = (typeof GAME_STAT_BOX_SCORE_FIELDS)[number];

export type GameStatBoxScoreValues = {
  starter: GameStat["starter"];
  minutes: number | null;
  points: GameStat["points"];
  offensiveRebounds: GameStat["offensiveRebounds"];
  defensiveRebounds: GameStat["defensiveRebounds"];
  rebounds: GameStat["rebounds"];
  assists: GameStat["assists"];
  steals: GameStat["steals"];
  blocks: GameStat["blocks"];
  turnovers: GameStat["turnovers"];
  fouls: GameStat["fouls"];
  foulsDrawn: GameStat["foulsDrawn"];
  plusMinus: GameStat["plusMinus"];
  fieldGoalsMade: GameStat["fieldGoalsMade"];
  fieldGoalsAttempt: GameStat["fieldGoalsAttempt"];
  twoMade: GameStat["twoMade"];
  twoAttempt: GameStat["twoAttempt"];
  threeMade: GameStat["threeMade"];
  threeAttempt: GameStat["threeAttempt"];
  freeThrowsMade: GameStat["freeThrowsMade"];
  freeThrowsAttempt: GameStat["freeThrowsAttempt"];
};

export type GameStatFieldDiff = {
  field: GameStatBoxScoreField;
  existing: string;
  submitted: string;
};

export type GameStatImmutabilityDecision =
  | { action: "create" }
  | { action: "skip" }
  | { action: "block"; reason: "soft_deleted" | "value_mismatch"; diffs: GameStatFieldDiff[] };

export type GameStatBlockedDetail = {
  gameNumber: string;
  playerName: string;
  reason: "soft_deleted" | "value_mismatch";
  diffs: GameStatFieldDiff[];
};

type JsonRecord = Record<string, unknown>;

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function nullableNumberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isStarter(playerName: unknown): boolean {
  return stringValue(playerName).startsWith("*");
}

export function parseImportedMinutes(value: unknown, playerName: string): number | null {
  const raw = stringValue(value);
  if (!raw) return null;
  const match = raw.match(/^(\d{1,3}):(\d{2})$/);
  if (!match) throw new Error(`${playerName}: MIN must use MM:SS format, found "${raw}".`);
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || seconds > 59) {
    throw new Error(`${playerName}: MIN must use MM:SS format, found "${raw}".`);
  }
  const decimalMinutes = Math.round((minutes + seconds / 60) * 100) / 100;
  if (Math.abs(decimalMinutes) >= 1000) {
    throw new Error(`${playerName}: MIN value ${decimalMinutes} would overflow GameStat.minutes. Check spreadsheet minute parsing for raw value "${raw}".`);
  }
  return decimalMinutes;
}

function assertNoNumericOverflow(playerName: string, data: Record<string, unknown>) {
  for (const [field, value] of Object.entries(data)) {
    if (typeof value === "number" && Number.isFinite(value) && Math.abs(value) >= 1000) {
      throw new Error(`${playerName}: ${field} value ${value} is too large for import. Check the submitted stats before publishing.`);
    }
  }
}

export function buildGameStatBoxScoreFromPlayerRow(playerRow: JsonRecord): GameStatBoxScoreValues {
  const playerName = stringValue(playerRow.name).replace(/^\*+/, "").trim() || "Unknown player";
  const fieldGoalsMade = nullableNumberValue(playerRow.FGM);
  const fieldGoalsAttempt = nullableNumberValue(playerRow.FGA);
  const threeMade = nullableNumberValue(playerRow["3PM"]);
  const threeAttempt = nullableNumberValue(playerRow["3PA"]);
  const freeThrowsMade = nullableNumberValue(playerRow.FTM);
  const freeThrowsAttempt = nullableNumberValue(playerRow.FTA);

  const values: GameStatBoxScoreValues = {
    starter: isStarter(playerRow.name),
    minutes: parseImportedMinutes(playerRow.MIN, playerName),
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
    freeThrowsAttempt
  };

  assertNoNumericOverflow(playerName, values);
  return values;
}

export function gameStatBoxScoreSelect() {
  return {
    id: true,
    deletedAt: true,
    starter: true,
    minutes: true,
    points: true,
    offensiveRebounds: true,
    defensiveRebounds: true,
    rebounds: true,
    assists: true,
    steals: true,
    blocks: true,
    turnovers: true,
    fouls: true,
    foulsDrawn: true,
    plusMinus: true,
    fieldGoalsMade: true,
    fieldGoalsAttempt: true,
    twoMade: true,
    twoAttempt: true,
    threeMade: true,
    threeAttempt: true,
    freeThrowsMade: true,
    freeThrowsAttempt: true
  } as const;
}

export type ExistingGameStatForCompare = GameStatBoxScoreValues & {
  deletedAt: Date | null;
};

export function existingGameStatToCompareInput(
  existing: ({ deletedAt: Date | null; minutes: unknown } & Omit<GameStatBoxScoreValues, "minutes">) | null
): ExistingGameStatForCompare | null {
  if (!existing) return null;
  return {
    ...existing,
    minutes: normalizeMinutes(existing.minutes)
  };
}

function normalizeMinutes(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value * 100) / 100;
  if (typeof value === "object" && value !== null && "toNumber" in value && typeof (value as { toNumber: () => number }).toNumber === "function") {
    return Math.round((value as { toNumber: () => number }).toNumber() * 100) / 100;
  }
  return null;
}

function formatCompareValue(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  return String(value);
}

export function compareGameStatBoxScores(existing: GameStatBoxScoreValues, submitted: GameStatBoxScoreValues): GameStatFieldDiff[] {
  const diffs: GameStatFieldDiff[] = [];

  for (const field of GAME_STAT_BOX_SCORE_FIELDS) {
    const left = field === "minutes" ? normalizeMinutes(existing.minutes) : existing[field];
    const right = field === "minutes" ? normalizeMinutes(submitted.minutes) : submitted[field];
    if (left !== right) {
      diffs.push({
        field,
        existing: formatCompareValue(left),
        submitted: formatCompareValue(right)
      });
    }
  }

  return diffs;
}

export function evaluateGameStatImmutability(
  existing: ExistingGameStatForCompare | null,
  submitted: GameStatBoxScoreValues
): GameStatImmutabilityDecision {
  if (!existing) return { action: "create" };
  if (existing.deletedAt !== null) {
    return { action: "block", reason: "soft_deleted", diffs: [] };
  }

  const diffs = compareGameStatBoxScores(existing, submitted);
  if (diffs.length === 0) return { action: "skip" };
  return { action: "block", reason: "value_mismatch", diffs };
}
