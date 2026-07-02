import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { inflateRawSync } from "node:zlib";

import { OrganizerSubmissionType } from "@prisma/client";

import { normalizeCompetitionDisplayName } from "@/lib/competition-naming";
import { formatSubmissionJsonParseError, safeJsonParse } from "@/lib/submission-json";
import { withListReviewInValidationSummary } from "@/lib/submission-list-review-snapshot";
import { buildSubmissionListReview } from "@/lib/submission-review";

const maxFileSizeBytes = 5 * 1024 * 1024;
const previewLimit = 10;

import type { SubmissionListReviewSnapshot } from "@/lib/submission-list-review-snapshot";

export type SubmissionValidationSummary = {
  ok: boolean;
  format: string;
  messages: string[];
  gameCount?: number;
  rowCount?: number;
  previewSupported: boolean;
  listReview?: SubmissionListReviewSnapshot;
};

export type ParsedSubmissionPayload = {
  rawText: string | null;
  parsedPreview: unknown | null;
  validationSummary: SubmissionValidationSummary;
  originalFilename: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  storedFilePath: string | null;
};

function normalizeDate(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const date = new Date(`${raw}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(date.getTime())) {
    throw new Error("Game date must be a valid date.");
  }

  return date;
}

export function readSubmissionMetadata(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) throw new Error("Title is required.");
  if (title.length > 160) throw new Error("Title must be 160 characters or fewer.");

  const leagueName = String(formData.get("leagueName") ?? "").trim() || null;
  if (leagueName && leagueName.length > 160) throw new Error("League name must be 160 characters or fewer.");

  return {
    title,
    leagueName,
    gameDate: normalizeDate(formData.get("gameDate"))
  };
}

function assertFile(file: FormDataEntryValue | null): File {
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("A file is required for this submission type.");
  }

  if (file.size > maxFileSizeBytes) {
    throw new Error("File must be 5 MB or smaller.");
  }

  return file;
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += char;
    }
  }

  cells.push(cell.trim());
  return cells;
}

function _parseCsvPreview(rawText: string) {
  const lines = rawText.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim().length > 0);
  const rows = lines.map(parseCsvLine);
  const headers = rows[0] ?? [];
  const previewRows = rows.slice(1, previewLimit + 1).map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header || `Column ${index + 1}`] = row[index] ?? "";
    });
    return record;
  });

  return {
    headers,
    rows: previewRows,
    totalRows: Math.max(rows.length - 1, 0)
  };
}

type SpreadsheetCell = string | number;
type SpreadsheetRow = SpreadsheetCell[];
type ParsedBoxScorePlayer = Record<string, string | number>;

type _ParsedBoxScore = {
  packageJson: Record<string, unknown>;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  homePlayerCount: number;
  awayPlayerCount: number;
  gameCount: number;
  totalPlayerRows: number;
  messages: string[];
};

function xmlDecode(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function columnIndex(cellRef: string) {
  const letters = cellRef.match(/^[A-Z]+/i)?.[0]?.toUpperCase() ?? "A";
  let index = 0;
  for (const letter of letters) index = index * 26 + letter.charCodeAt(0) - 64;
  return index - 1;
}

function zipEntry(buffer: Buffer, entryName: string) {
  const eocdSignature = 0x06054b50;
  let eocdOffset = -1;
  for (let offset = buffer.length - 22; offset >= 0; offset -= 1) {
    if (buffer.readUInt32LE(offset) === eocdSignature) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error("XLSX file is not a readable ZIP archive.");

  const centralDirectorySize = buffer.readUInt32LE(eocdOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  let offset = centralDirectoryOffset;
  const end = centralDirectoryOffset + centralDirectorySize;

  while (offset < end) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error("XLSX central directory is invalid.");
    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + fileNameLength).toString("utf8");

    if (name === entryName) {
      if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) throw new Error(`XLSX local header is invalid for ${entryName}.`);
      const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
      const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
      if (compressionMethod === 0) return compressed.toString("utf8");
      if (compressionMethod === 8) return inflateRawSync(compressed).toString("utf8");
      throw new Error(`Unsupported XLSX compression method ${compressionMethod}.`);
    }

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return null;
}

function zipEntryNames(buffer: Buffer) {
  const eocdSignature = 0x06054b50;
  let eocdOffset = -1;
  for (let offset = buffer.length - 22; offset >= 0; offset -= 1) {
    if (buffer.readUInt32LE(offset) === eocdSignature) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error("XLSX file is not a readable ZIP archive.");

  const centralDirectorySize = buffer.readUInt32LE(eocdOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  let offset = centralDirectoryOffset;
  const end = centralDirectoryOffset + centralDirectorySize;
  const names: string[] = [];

  while (offset < end) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error("XLSX central directory is invalid.");
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    names.push(buffer.subarray(offset + 46, offset + 46 + fileNameLength).toString("utf8"));
    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return names;
}

function parseSharedStrings(xml: string | null) {
  if (!xml) return [];
  return Array.from(xml.matchAll(/<si[\s\S]*?<\/si>/g)).map(([item]) => {
    const parts = Array.from(item.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)).map((match) => xmlDecode(match[1] ?? ""));
    return parts.join("");
  });
}

function parseSheetRows(xml: string, sharedStrings: string[]): SpreadsheetRow[] {
  const rows: SpreadsheetRow[] = [];
  for (const rowMatch of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: SpreadsheetRow = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c\s+([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cellMatch[1];
      const body = cellMatch[2];
      const ref = attrs.match(/\br="([^"]+)"/)?.[1] ?? "A1";
      const type = attrs.match(/\bt="([^"]+)"/)?.[1] ?? "";
      const value = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? body.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? "";
      let parsed: SpreadsheetCell = xmlDecode(value);
      if (type === "s") parsed = sharedStrings[Number(value)] ?? "";
      else if (type !== "inlineStr" && parsed !== "" && Number.isFinite(Number(parsed))) parsed = Number(parsed);
      cells[columnIndex(ref)] = parsed;
    }
    rows.push(cells.map((cell) => cell ?? ""));
  }
  return rows;
}

function parseWorkbookSheetRefs(workbookXml: string | null, workbookRelsXml: string | null) {
  if (!workbookXml) return [];
  const relTargets = new Map<string, string>();
  if (workbookRelsXml) {
    for (const match of workbookRelsXml.matchAll(/<Relationship\b([^>]*)\/>/g)) {
      const attrs = match[1] ?? "";
      const id = attrs.match(/\bId="([^"]+)"/)?.[1];
      const target = attrs.match(/\bTarget="([^"]+)"/)?.[1];
      if (!id || !target) continue;
      relTargets.set(id, target.startsWith("/") ? target.replace(/^\//, "") : `xl/${target.replace(/^\.\.\//, "")}`);
    }
  }

  return Array.from(workbookXml.matchAll(/<sheet\b([^>]*)\/>/g)).map((match, index) => {
    const attrs = match[1] ?? "";
    const name = xmlDecode(attrs.match(/\bname="([^"]+)"/)?.[1] ?? `Sheet ${index + 1}`);
    const relId = attrs.match(/\br:id="([^"]+)"/)?.[1];
    const fallbackPath = `xl/worksheets/sheet${index + 1}.xml`;
    return { name, path: (relId && relTargets.get(relId)) || fallbackPath };
  });
}

function parseXlsxSheets(buffer: Buffer) {
  const sharedStrings = parseSharedStrings(zipEntry(buffer, "xl/sharedStrings.xml"));
  const workbookRefs = parseWorkbookSheetRefs(zipEntry(buffer, "xl/workbook.xml"), zipEntry(buffer, "xl/_rels/workbook.xml.rels"));
  const refs = workbookRefs.length
    ? workbookRefs
    : zipEntryNames(buffer)
      .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name))
      .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
      .map((path, index) => ({ name: `Sheet ${index + 1}`, path }));

  const sheets = refs
    .map((sheet) => {
      const xml = zipEntry(buffer, sheet.path);
      return xml ? { name: sheet.name, rows: parseSheetRows(xml, sharedStrings) } : null;
    })
    .filter((sheet): sheet is { name: string; rows: SpreadsheetRow[] } => Boolean(sheet));

  if (!sheets.length) throw new Error("XLSX workbook did not contain readable worksheets.");
  return sheets;
}

function cellText(value: SpreadsheetCell | undefined) {
  return String(value ?? "").trim();
}

function normalizeHeader(value: string) {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

function statHeaderFromCell(value: SpreadsheetCell | undefined) {
  if (typeof value === "number" && Math.abs(value - 14 / 24) < 0.00001) return "2PM";
  if (typeof value === "number" && Math.abs(value - 15 / 24) < 0.00001) return "3PM";
  return normalizeHeader(cellText(value));
}

function isHeaderRow(row: SpreadsheetRow) {
  const fields = row.map(statFieldFromCell);
  return fields.includes("name") && fields.includes("PTS");
}

function cleanPybcTeamName(value: string) {
  return value.replace(/\b1?6\s*U\b/gi, "").replace(/\s+/g, " ").trim();
}

function numberFromCell(value: SpreadsheetCell | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function clockString(minutes: number, seconds: number) {
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function minutesFromExcelTimeSerial(value: number) {
  // PYBC sheets format minutes as Excel h:mm time values. The displayed h:mm clock
  // components are basketball minutes:seconds, not elapsed hours:minutes.
  const displayedMinutes = Math.round(value * 24 * 60);
  return clockString(Math.floor(displayedMinutes / 60), displayedMinutes % 60);
}

function minutesFromCell(value: SpreadsheetCell | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value >= 0 && value < 1) return minutesFromExcelTimeSerial(value);
    const totalSeconds = Math.round(value * 60);
    return clockString(Math.floor(totalSeconds / 60), totalSeconds % 60);
  }
  const raw = cellText(value);
  if (!raw) return "00:00";
  const match = raw.match(/^(\d{1,3}):(\d{2})(?::\d{2})?$/);
  if (!match) return raw;
  return clockString(Number(match[1]), Number(match[2]));
}

const supportedSpreadsheetFormatsMessage = "Spreadsheet format not recognized. Supported formats: (1) two team sections with Player/Pts headers, or (2) one combined Player Stats table with Team, Player, and PTS columns.";

const statHeaderMap: Record<string, string> = {
  NAME: "name",
  PLAYER: "name",
  PLAYERNAME: "name",
  TEAM: "team",
  TEAMNAME: "team",
  MINS: "MIN",
  MIN: "MIN",
  MINUTES: "MIN",
  PTS: "PTS",
  POINTS: "PTS",
  FGM: "FGM",
  FIELDMADES: "FGM",
  FGA: "FGA",
  FIELDATTEMPTS: "FGA",
  "2PM": "2PM",
  "2FGM": "2PM",
  "2PA": "2PA",
  "2FGA": "2PA",
  "3PM": "3PM",
  "3FGM": "3PM",
  "3PA": "3PA",
  "3FGA": "3PA",
  FTM: "FTM",
  FTA: "FTA",
  OFF: "OREB",
  ORB: "OREB",
  OREB: "OREB",
  OFFENSIVEREBOUNDS: "OREB",
  DEF: "DREB",
  DRB: "DREB",
  DREB: "DREB",
  DEFENSIVEREBOUNDS: "DREB",
  REB: "TRB",
  TRB: "TRB",
  TOTALREBOUNDS: "TRB",
  AST: "AST",
  ASSISTS: "AST",
  TO: "TOV",
  TOV: "TOV",
  TURNOVERS: "TOV",
  STL: "STL",
  STEALS: "STL",
  BLK: "BLK",
  BLOCKS: "BLK",
  PF: "PF",
  FOULS: "PF",
  PERSONALFOULS: "PF",
  FLSON: "FD",
  FD: "FD",
  PLUSMINUS: "+/-",
  "+/-": "+/-"
};

type ParsedSheetGame = {
  sheetName: string;
  format: "two-team-sections" | "combined-team-column" | "default-forfeit";
  game: Record<string, unknown> & {
    homeTeamName: string;
    awayTeamName: string;
    homeScore: number;
    awayScore: number;
    players: ParsedBoxScorePlayer[];
  };
  homePlayerCount: number;
  awayPlayerCount: number;
  messages: string[];
};

function headerLookupKey(value: SpreadsheetCell | undefined) {
  const header = statHeaderFromCell(value);
  if (header === "+/-") return "+/-";
  return header.replace(/[^A-Z0-9]+/g, "");
}

function statFieldFromCell(value: SpreadsheetCell | undefined) {
  return statHeaderMap[headerLookupKey(value)] ?? null;
}

function rowIsBlank(row: SpreadsheetRow) {
  return row.every((cell) => !cellText(cell));
}

function supportedFormatError(sheetName: string) {
  return `${sheetName}: ${supportedSpreadsheetFormatsMessage}`;
}

function parseTeamRows(rows: SpreadsheetRow[], headerIndex: number, nextHeaderIndex: number | null) {
  let title = "";
  for (let index = headerIndex - 1; index >= 0; index -= 1) {
    const nonEmpty = rows[index].map(cellText).filter(Boolean);
    if (nonEmpty.length) {
      title = nonEmpty.join(" ");
      break;
    }
  }
  const teamName = cleanPybcTeamName(title);
  const headers = rows[headerIndex].map(statFieldFromCell);
  const players: ParsedBoxScorePlayer[] = [];
  const end = nextHeaderIndex ?? rows.length;

  for (let index = headerIndex + 1; index < end; index += 1) {
    const row = rows[index];
    const nonEmptyCells = row.map(cellText).filter(Boolean);
    if (players.length && nonEmptyCells.length === 1) break;
    const name = cellText(row[headers.indexOf("name")]);
    if (!name) {
      if (players.length) break;
      continue;
    }
    if (/total|team/i.test(name)) continue;
    const player: ParsedBoxScorePlayer = { name, team: teamName };
    headers.forEach((field, columnIndexValue) => {
      if (!field || field === "name") return;
      player[field] = field === "MIN" ? minutesFromCell(row[columnIndexValue]) : numberFromCell(row[columnIndexValue]);
    });
    for (const required of ["MIN", "PTS", "FGM", "FGA", "3PM", "3PA", "2PM", "2PA", "FTM", "FTA", "OREB", "DREB", "TRB", "AST", "STL", "BLK", "TOV", "PF", "FD", "+/-"]) {
      player[required] ??= required === "MIN" ? "00:00" : 0;
    }
    players.push(player);
  }

  return { teamName, players };
}

function requiredPlayerDefaults(player: ParsedBoxScorePlayer) {
  for (const required of ["MIN", "PTS", "FGM", "FGA", "3PM", "3PA", "2PM", "2PA", "FTM", "FTA", "OREB", "DREB", "TRB", "AST", "STL", "BLK", "TOV", "PF", "FD", "+/-"]) {
    player[required] ??= required === "MIN" ? "00:00" : 0;
  }
  return player;
}

function spreadsheetDateFromCell(value: SpreadsheetCell | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(Date.UTC(1899, 11, 30 + Math.floor(value)));
    return date.toISOString().slice(0, 10);
  }
  const raw = cellText(value);
  if (!raw) return "";
  const iso = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString().slice(0, 10);
}

function normalizeAgeGroup(value: string) {
  const upper = value.trim().toUpperCase();
  if (upper === "U13" || upper === "13U") return "U13";
  if (upper === "U16" || upper === "16U") return "U16";
  if (upper === "U19" || upper === "19U" || upper === "U18" || upper === "18U") return "U19";
  return upper || "U16";
}

function gameInfoKey(value: SpreadsheetCell | undefined) {
  return cellText(value).replace(/[^a-z0-9]+/gi, "").toLowerCase();
}

function readGameInfo(rows: SpreadsheetRow[], formData: FormData) {
  const info: Record<string, SpreadsheetCell> = {};
  const keyMap: Record<string, string> = {
    leaguename: "leagueName",
    league: "leagueName",
    gamenumber: "gameNumber",
    game: "gameNumber",
    gamedate: "gameDate",
    date: "gameDate",
    agegroup: "ageGroup",
    city: "city",
    region: "region",
    season: "seasonName",
    seasonname: "seasonName",
    seasonyear: "seasonYear",
    teama: "teamA",
    hometeam: "teamA",
    teamb: "teamB",
    awayteam: "teamB",
    teamascore: "teamAScore",
    homescore: "teamAScore",
    teambscore: "teamBScore",
    awayscore: "teamBScore",
    note: "note",
    notes: "note",
    remarks: "note"
  };

  for (const row of rows.slice(0, 20)) {
    const key = keyMap[gameInfoKey(row[0])];
    if (key && cellText(row[1])) info[key] = row[1];
  }

  const fallbackGameDate = String(formData.get("gameDate") ?? "").trim();
  const fallbackGameNumber = String(formData.get("gameNumber") ?? "").trim();
  const seasonYear = Number(cellText(info.seasonYear)) || 2025;
  const leagueName = normalizeCompetitionDisplayName(cellText(info.leagueName) || "PYBC U16 Boys Basketball") || "PYBC 15U";
  return {
    leagueName,
    gameNumber: cellText(info.gameNumber) || fallbackGameNumber,
    gameDate: spreadsheetDateFromCell(info.gameDate) || fallbackGameDate,
    ageGroup: normalizeAgeGroup(cellText(info.ageGroup) || "U16"),
    city: cellText(info.city) || "Metro Manila",
    region: cellText(info.region) || "NCR",
    seasonName: cellText(info.seasonName) || `${seasonYear} Season`,
    seasonYear,
    teamA: cellText(info.teamA),
    teamB: cellText(info.teamB),
    hasTeamAScore: cellText(info.teamAScore) !== "",
    hasTeamBScore: cellText(info.teamBScore) !== "",
    teamAScore: numberFromCell(info.teamAScore),
    teamBScore: numberFromCell(info.teamBScore),
    note: cellText(info.note)
  };
}

function parsedGamePackage(games: ParsedSheetGame[], firstInfo: ReturnType<typeof readGameInfo>) {
  const leagueName = normalizeCompetitionDisplayName(firstInfo.leagueName) || firstInfo.leagueName;
  return {
    league: {
      name: leagueName,
      ageGroup: firstInfo.ageGroup,
      organizerName: leagueName.match(/^[A-Z0-9]+/)?.[0] ?? "PYBC",
      city: firstInfo.city,
      region: firstInfo.region
    },
    season: {
      name: firstInfo.seasonName,
      seasonYear: firstInfo.seasonYear
    },
    games: games.map((item) => item.game)
  };
}

function parsePybcTwoTeamBoxScore(rows: SpreadsheetRow[], formData: FormData, sheetName = "Sheet 1"): ParsedSheetGame {
  const headerIndices = rows.map((row, index) => isHeaderRow(row) ? index : -1).filter((index) => index >= 0);
  if (headerIndices.length < 2) throw new Error(supportedFormatError(sheetName));

  const first = parseTeamRows(rows, headerIndices[0], headerIndices[1]);
  const second = parseTeamRows(rows, headerIndices[1], headerIndices[2] ?? null);
  if (!first.teamName || !second.teamName) throw new Error(`${sheetName}: Team names could not be read from the spreadsheet.`);
  if (!first.players.length || !second.players.length) throw new Error(`${sheetName}: Player stat rows could not be read for both teams.`);

  const homeScore = first.players.reduce((sum, player) => sum + Number(player.PTS ?? 0), 0);
  const awayScore = second.players.reduce((sum, player) => sum + Number(player.PTS ?? 0), 0);
  if (homeScore <= 0 || awayScore <= 0) throw new Error(`${sheetName}: Team scores must be greater than zero. Check the Pts column in the spreadsheet.`);

  const gameDate = String(formData.get("gameDate") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(gameDate)) throw new Error(`${sheetName}: Game date is required for spreadsheet box score uploads.`);

  const gameNumberInput = String(formData.get("gameNumber") ?? "").trim();
  const gameNumber = gameNumberInput || `PYBC-DRAFT-${gameDate.replace(/-/g, "")}-${first.teamName.replace(/[^a-z0-9]+/gi, "-")}-VS-${second.teamName.replace(/[^a-z0-9]+/gi, "-")}`.slice(0, 120);

  return {
    sheetName,
    format: "two-team-sections",
    game: {
      gameNumber,
      gameDate,
      game: `${first.teamName} ${homeScore} - ${awayScore} ${second.teamName}`,
      homeTeamName: first.teamName,
      awayTeamName: second.teamName,
      homeScore,
      awayScore,
      city: "Metro Manila",
      region: "NCR",
      sourceName: "PYBC spreadsheet upload",
      players: [...first.players, ...second.players]
    },
    homePlayerCount: first.players.length,
    awayPlayerCount: second.players.length,
    messages: [
      `${sheetName}: parsed two-team box score (${first.teamName} ${homeScore} - ${awayScore} ${second.teamName}).`,
      `${sheetName}: player point totals pass.`
    ]
  };
}

function findCombinedHeaderIndex(rows: SpreadsheetRow[]) {
  return rows.findIndex((row) => {
    const fields = row.map(statFieldFromCell);
    return fields.includes("team") && fields.includes("name") && fields.includes("PTS");
  });
}

function parseCombinedTeamColumnFormat(rows: SpreadsheetRow[], formData: FormData, sheetName: string): ParsedSheetGame {
  const headerIndex = findCombinedHeaderIndex(rows);
  if (headerIndex < 0) throw new Error(supportedFormatError(sheetName));
  const headers = rows[headerIndex].map(statFieldFromCell);
  const teamIndex = headers.indexOf("team");
  const nameIndex = headers.indexOf("name");
  const info = readGameInfo(rows, formData);
  const players: ParsedBoxScorePlayer[] = [];

  for (let index = headerIndex + 1; index < rows.length; index += 1) {
    const row = rows[index];
    if (rowIsBlank(row)) {
      if (players.length) break;
      continue;
    }
    const team = cleanPybcTeamName(cellText(row[teamIndex]));
    const name = cellText(row[nameIndex]);
    if (!team || !name) continue;
    if (/total|team/i.test(name)) continue;
    const player: ParsedBoxScorePlayer = { name, team };
    headers.forEach((field, columnIndexValue) => {
      if (!field || field === "name" || field === "team") return;
      player[field] = field === "MIN" ? minutesFromCell(row[columnIndexValue]) : numberFromCell(row[columnIndexValue]);
    });
    players.push(requiredPlayerDefaults(player));
  }

  const teams = Array.from(new Set(players.map((player) => String(player.team))));
  if (teams.length < 2) throw new Error(`${sheetName}: Combined Player Stats table must include at least two teams in the Team column.`);

  const homeTeamName = cleanPybcTeamName(info.teamA) || teams[0];
  const awayTeamName = cleanPybcTeamName(info.teamB) || teams.find((team) => team !== homeTeamName) || teams[1];
  const homePlayers = players.filter((player) => String(player.team).toUpperCase() === homeTeamName.toUpperCase());
  const awayPlayers = players.filter((player) => String(player.team).toUpperCase() === awayTeamName.toUpperCase());
  const homeScore = info.teamAScore || homePlayers.reduce((sum, player) => sum + Number(player.PTS ?? 0), 0);
  const awayScore = info.teamBScore || awayPlayers.reduce((sum, player) => sum + Number(player.PTS ?? 0), 0);
  const gameDate = info.gameDate;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(gameDate)) throw new Error(`${sheetName}: Game date is missing or invalid.`);
  const gameNumber = info.gameNumber || `PYBC-DRAFT-${sheetName.replace(/[^A-Z0-9]+/gi, "-")}`.slice(0, 120);

  return {
    sheetName,
    format: "combined-team-column",
    game: {
      gameNumber,
      gameDate,
      game: `${homeTeamName} ${homeScore} - ${awayScore} ${awayTeamName}`,
      homeTeamName,
      awayTeamName,
      homeScore,
      awayScore,
      city: info.city,
      region: info.region,
      sourceName: `PYBC spreadsheet upload - ${sheetName}`,
      players
    },
    homePlayerCount: homePlayers.length,
    awayPlayerCount: awayPlayers.length,
    messages: [
      `${sheetName}: parsed combined Player Stats table (${homeTeamName} ${homeScore} - ${awayScore} ${awayTeamName}).`,
      `${sheetName}: detected ${players.length} player stat rows across ${teams.length} teams.`
    ]
  };
}

function isDefaultWinNote(value: string) {
  return /\b(default|forfeit|did\s+not\s+show|no\s*show|walkover|walk-over|won\s+by\s+default)\b/i.test(value);
}

function parseDefaultForfeitGameInfo(rows: SpreadsheetRow[], formData: FormData, sheetName: string): ParsedSheetGame {
  const info = readGameInfo(rows, formData);
  const homeTeamName = cleanPybcTeamName(info.teamA);
  const awayTeamName = cleanPybcTeamName(info.teamB);
  if (!homeTeamName || !awayTeamName) throw new Error(`${sheetName}: Default/forfeit game requires Team A and Team B.`);
  if (!info.hasTeamAScore || !info.hasTeamBScore) throw new Error(`${sheetName}: Default/forfeit game requires Team A Score and Team B Score.`);
  if (!isDefaultWinNote(info.note)) throw new Error(supportedFormatError(sheetName));

  const gameNumber = info.gameNumber || `PYBC-DRAFT-${sheetName.replace(/[^A-Z0-9]+/gi, "-")}`.slice(0, 120);
  const note = info.note || "Default/forfeit result.";
  const hasValidGameDate = /^\d{4}-\d{2}-\d{2}$/.test(info.gameDate);

  return {
    sheetName,
    format: "default-forfeit",
    game: {
      gameNumber,
      gameDate: info.gameDate,
      game: `${homeTeamName} ${info.teamAScore} - ${info.teamBScore} ${awayTeamName}`,
      homeTeamName,
      awayTeamName,
      homeScore: info.teamAScore,
      awayScore: info.teamBScore,
      city: info.city,
      region: info.region,
      sourceName: `PYBC spreadsheet upload - ${sheetName} - ${note}`.slice(0, 240),
      note,
      defaultWin: true,
      teamResultOnly: true,
      players: []
    },
    homePlayerCount: 0,
    awayPlayerCount: 0,
    messages: [
      `${sheetName}: parsed default/forfeit team result (${homeTeamName} ${info.teamAScore} - ${info.teamBScore} ${awayTeamName}).`,
      `${sheetName}: no player stat rows included; this game will not create player GameStats or affect player ratings.`,
      hasValidGameDate ? "" : `${sheetName}: game date is missing; add it before official import/publish.`,
      `${sheetName}: note: ${note}`
    ].filter(Boolean)
  };
}

function parseSupportedSheet(rows: SpreadsheetRow[], formData: FormData, sheetName: string) {
  if (findCombinedHeaderIndex(rows) >= 0) return parseCombinedTeamColumnFormat(rows, formData, sheetName);
  const info = readGameInfo(rows, formData);
  if (info.teamA && info.teamB && info.hasTeamAScore && info.hasTeamBScore && isDefaultWinNote(info.note)) {
    return parseDefaultForfeitGameInfo(rows, formData, sheetName);
  }
  return parsePybcTwoTeamBoxScore(rows, formData, sheetName);
}

function isHelperSheetName(sheetName: string) {
  return /\b(legend|readme|instructions?|template|reports?|projections?|summary|dashboard|index|notes?)\b/i.test(sheetName.trim());
}

function hasLikelyGameSheetContent(rows: SpreadsheetRow[]) {
  const hasCombinedHeader = findCombinedHeaderIndex(rows) >= 0;
  const hasTwoTeamHeader = rows.some(isHeaderRow);
  const labels = new Set(rows.slice(0, 25).map((row) => gameInfoKey(row[0])).filter(Boolean));
  const hasGameInfo = labels.has("gamenumber") || labels.has("gamedate") || labels.has("teama") || labels.has("teamb");
  const hasPlayerStatsLabel = rows.some((row) => row.some((cell) => /player\s*stats/i.test(cellText(cell))));
  const info = readGameInfo(rows, new FormData());
  const hasDefaultForfeitInfo = Boolean(info.teamA && info.teamB && info.hasTeamAScore && info.hasTeamBScore && isDefaultWinNote(info.note));

  return hasCombinedHeader || hasTwoTeamHeader || (hasGameInfo && hasPlayerStatsLabel) || hasDefaultForfeitInfo;
}

export function parsePybcSpreadsheetBuffer(buffer: Buffer, formData: FormData, format: "csv" | "xlsx") {
  const sheets = format === "csv"
    ? [{ name: "CSV upload", rows: buffer.toString("utf8").replace(/^\uFEFF/, "").split(/\r?\n/).map(parseCsvLine) }]
    : parseXlsxSheets(buffer).filter((sheet) => sheet.rows.some((row) => !rowIsBlank(row)));
  const parsedGames: ParsedSheetGame[] = [];
  const failures: string[] = [];
  const skippedSheets: string[] = [];

  for (const sheet of sheets) {
    if (isHelperSheetName(sheet.name) || !hasLikelyGameSheetContent(sheet.rows)) {
      skippedSheets.push(sheet.name);
      continue;
    }

    try {
      parsedGames.push(parseSupportedSheet(sheet.rows, formData, sheet.name));
    } catch (error) {
      failures.push(error instanceof Error ? error.message : `${sheet.name}: could not parse sheet.`);
    }
  }

  if (!parsedGames.length) {
    throw new Error(failures.length ? failures.join(" ") : supportedSpreadsheetFormatsMessage);
  }

  const firstInfo = readGameInfo(sheets.find((sheet) => sheet.name === parsedGames[0].sheetName)?.rows ?? sheets[0].rows, formData);
  const totalPlayerRows = parsedGames.reduce((sum, game) => sum + game.homePlayerCount + game.awayPlayerCount, 0);
  const messages = [
    `Parsed ${parsedGames.length} game sheet${parsedGames.length === 1 ? "" : "s"}: ${parsedGames.map((game) => `${game.sheetName} (${game.format})`).join(", ")}.`,
    ...parsedGames.flatMap((game) => game.messages),
    skippedSheets.length ? `Skipped ${skippedSheets.length} non-game sheet${skippedSheets.length === 1 ? "" : "s"}: ${skippedSheets.join(", ")}.` : "",
    failures.length ? `Skipped ${failures.length} unsupported sheet${failures.length === 1 ? "" : "s"}: ${failures.join(" | ")}` : "",
    "Submission draft JSON was generated for admin review. No official import was performed.",
    "Spreadsheet upload is parsed as a submission preview. It will appear in Program Management after official import/publish."
  ].filter(Boolean);

  return {
    packageJson: parsedGamePackage(parsedGames, firstInfo),
    homeTeamName: parsedGames[0].game.homeTeamName,
    awayTeamName: parsedGames[0].game.awayTeamName,
    homeScore: parsedGames[0].game.homeScore,
    awayScore: parsedGames[0].game.awayScore,
    homePlayerCount: parsedGames[0].homePlayerCount,
    awayPlayerCount: parsedGames[0].awayPlayerCount,
    gameCount: parsedGames.length,
    totalPlayerRows,
    messages
  };
}

function jsonPreview(value: unknown) {
  if (Array.isArray(value)) {
    return {
      kind: "array",
      totalItems: value.length,
      sample: value.slice(0, previewLimit)
    };
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    return {
      kind: "object",
      keys: entries.map(([key]) => key),
      sample: Object.fromEntries(entries.slice(0, previewLimit))
    };
  }

  return {
    kind: typeof value,
    sample: value
  };
}

async function storeUploadedFileBuffer(file: File, buffer: Buffer) {
  const storageRoot = path.join(process.cwd(), "storage", "submissions");
  await mkdir(storageRoot, { recursive: true });

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "submission";
  const storedFilePath = path.join("storage", "submissions", `${Date.now()}-${randomUUID()}-${safeName}`);
  const absolutePath = path.join(process.cwd(), storedFilePath);
  await writeFile(absolutePath, buffer);

  return {
    storedFilePath,
    buffer
  };
}

async function _storeUploadedFile(file: File) {
  return storeUploadedFileBuffer(file, Buffer.from(await file.arrayBuffer()));
}

function fileExtension(file: File) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".json")) return "json";
  if (name.endsWith(".csv")) return "csv";
  if (name.endsWith(".xlsx")) return "xlsx";
  return "";
}

export function inferSubmissionType(formData: FormData): OrganizerSubmissionType {
  const rawText = String(formData.get("rawText") ?? "").trim();
  if (rawText) return OrganizerSubmissionType.PASTE_JSON;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Upload a supported file. JSON paste is available only in admin intake.");
  }

  const extension = fileExtension(file);
  if (extension === "json" || file.type === "application/json") return OrganizerSubmissionType.UPLOAD_JSON;
  if (extension === "csv" || file.type === "text/csv") return OrganizerSubmissionType.UPLOAD_CSV;
  if (extension === "xlsx" || file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") return OrganizerSubmissionType.UPLOAD_XLSX;

  throw new Error("Unsupported file type. Upload JSON, CSV, or XLSX only. JSON submissions are admin-managed.");
}

function attachListReviewToPayload(payload: ParsedSubmissionPayload, leagueName: string | null): ParsedSubmissionPayload {
  const listReview = buildSubmissionListReview({
    rawText: payload.rawText,
    parsedPreview: payload.parsedPreview as import("@prisma/client").Prisma.JsonValue,
    title: "",
    leagueName,
  });

  return {
    ...payload,
    validationSummary: withListReviewInValidationSummary(payload.validationSummary, listReview),
  };
}

export async function parseSubmissionPayload(type: OrganizerSubmissionType, formData: FormData): Promise<ParsedSubmissionPayload> {
  if (type === OrganizerSubmissionType.PASTE_JSON) {
    const rawText = String(formData.get("rawText") ?? "").trim();
    if (!rawText) throw new Error("Pasted JSON is required.");
    if (Buffer.byteLength(rawText, "utf8") > maxFileSizeBytes) throw new Error("Pasted JSON must be 5 MB or smaller.");

    const parsed = safeJsonParse(rawText);
    if (!parsed.ok) throw new Error(`Invalid JSON: ${formatSubmissionJsonParseError(parsed) ?? "JSON could not be parsed."}`);

    return attachListReviewToPayload({
      rawText,
      parsedPreview: jsonPreview(parsed.data),
      validationSummary: {
        ok: true,
        format: "json",
        messages: ["Valid JSON parsed. Preview stored only; no official import was performed."],
        previewSupported: true
      },
      originalFilename: null,
      mimeType: null,
      fileSizeBytes: Buffer.byteLength(rawText, "utf8"),
      storedFilePath: null
    }, null);
  }

  const file = assertFile(formData.get("file"));
  const originalFilename = file.name || "submission";
  const mimeType = file.type || "application/octet-stream";
  const initialBuffer = Buffer.from(await file.arrayBuffer());

  if (type === OrganizerSubmissionType.UPLOAD_JSON) {
    const rawText = initialBuffer.toString("utf8").trim();
    const parsed = safeJsonParse(rawText);
    if (!parsed.ok) throw new Error(`Invalid JSON: ${formatSubmissionJsonParseError(parsed) ?? "Uploaded file could not be parsed."}`);

    const { storedFilePath } = await storeUploadedFileBuffer(file, initialBuffer);
    return attachListReviewToPayload({
      rawText,
      parsedPreview: jsonPreview(parsed.data),
      validationSummary: {
        ok: true,
        format: "json",
        messages: ["Valid JSON uploaded. Preview stored only; no official import was performed."],
        previewSupported: true
      },
      originalFilename,
      mimeType,
      fileSizeBytes: file.size,
      storedFilePath
    }, null);
  }

  const { storedFilePath, buffer } = await storeUploadedFileBuffer(file, initialBuffer);

  if (type === OrganizerSubmissionType.UPLOAD_CSV || type === OrganizerSubmissionType.UPLOAD_XLSX) {
    const format = type === OrganizerSubmissionType.UPLOAD_CSV ? "csv" : "xlsx";
    const parsedBoxScore = parsePybcSpreadsheetBuffer(buffer, formData, format);
    const rawText = JSON.stringify(parsedBoxScore.packageJson, null, 2);
    return attachListReviewToPayload({
      rawText,
      parsedPreview: jsonPreview(parsedBoxScore.packageJson),
      validationSummary: {
        ok: true,
        format,
        messages: parsedBoxScore.messages,
        gameCount: parsedBoxScore.gameCount,
        rowCount: parsedBoxScore.totalPlayerRows,
        previewSupported: true
      },
      originalFilename,
      mimeType,
      fileSizeBytes: file.size,
      storedFilePath
    }, null);
  }

  throw new Error("Unsupported submission type.");
}

export function submissionTypeLabel(type: OrganizerSubmissionType | string) {
  if (type === OrganizerSubmissionType.PASTE_JSON || type === "PASTE_JSON") return "Pasted JSON";
  if (type === OrganizerSubmissionType.UPLOAD_JSON || type === "UPLOAD_JSON") return "JSON upload";
  if (type === OrganizerSubmissionType.UPLOAD_CSV || type === "UPLOAD_CSV") return "CSV upload";
  if (type === OrganizerSubmissionType.UPLOAD_XLSX || type === "UPLOAD_XLSX") return "XLSX upload";
  return String(type);
}
