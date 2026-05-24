import "server-only";

import { mkdir, writeFile } from "node:fs/promises";
import { inflateRawSync } from "node:zlib";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { OrganizerSubmissionType } from "@prisma/client";
import { formatSubmissionJsonParseError, safeJsonParse } from "@/lib/submission-json";

const maxFileSizeBytes = 5 * 1024 * 1024;
const previewLimit = 10;

export type SubmissionValidationSummary = {
  ok: boolean;
  format: string;
  messages: string[];
  rowCount?: number;
  previewSupported: boolean;
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

function parseCsvPreview(rawText: string) {
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

type ParsedBoxScore = {
  packageJson: Record<string, unknown>;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  homePlayerCount: number;
  awayPlayerCount: number;
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

function parseXlsxRows(buffer: Buffer) {
  const sheet = zipEntry(buffer, "xl/worksheets/sheet1.xml");
  if (!sheet) throw new Error("XLSX sheet1.xml was not found.");
  return parseSheetRows(sheet, parseSharedStrings(zipEntry(buffer, "xl/sharedStrings.xml")));
}

function cellText(value: SpreadsheetCell | undefined) {
  return String(value ?? "").trim();
}

function normalizeHeader(value: string) {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

function isHeaderRow(row: SpreadsheetRow) {
  const headers = row.map((cell) => normalizeHeader(cellText(cell)));
  return headers.includes("PLAYER") && (headers.includes("PTS") || headers.includes("POINTS"));
}

function cleanPybcTeamName(value: string) {
  return value.replace(/\b1?6\s*U\b/gi, "").replace(/\s+/g, " ").trim().toUpperCase();
}

function numberFromCell(value: SpreadsheetCell | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function minutesFromCell(value: SpreadsheetCell | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const totalSeconds = value > 0 && value < 1 ? Math.round(value * 24 * 60 * 60) : Math.round(value * 60);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  const raw = cellText(value);
  if (!raw) return "00:00";
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return raw;
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

const statHeaderMap: Record<string, string> = {
  PLAYER: "name",
  MINS: "MIN",
  MIN: "MIN",
  PTS: "PTS",
  POINTS: "PTS",
  FGM: "FGM",
  FGA: "FGA",
  "2PM": "2PM",
  "2PA": "2PA",
  "3PM": "3PM",
  "3PA": "3PA",
  FTM: "FTM",
  FTA: "FTA",
  OFF: "OREB",
  OREB: "OREB",
  DEF: "DREB",
  DREB: "DREB",
  REB: "TRB",
  TRB: "TRB",
  AST: "AST",
  TO: "TOV",
  TOV: "TOV",
  STL: "STL",
  BLK: "BLK",
  PF: "PF",
  "FLS ON": "FD",
  FD: "FD",
  "+/-": "+/-"
};

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
  const headers = rows[headerIndex].map((cell) => statHeaderMap[normalizeHeader(cellText(cell))] ?? null);
  const players: ParsedBoxScorePlayer[] = [];
  const end = nextHeaderIndex ?? rows.length;

  for (let index = headerIndex + 1; index < end; index += 1) {
    const row = rows[index];
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

function parsePybcTwoTeamBoxScore(rows: SpreadsheetRow[], formData: FormData): ParsedBoxScore {
  const headerIndices = rows.map((row, index) => isHeaderRow(row) ? index : -1).filter((index) => index >= 0);
  if (headerIndices.length < 2) throw new Error("Spreadsheet format not recognized. Expected two team sections with a Player/Pts header row.");

  const first = parseTeamRows(rows, headerIndices[0], headerIndices[1]);
  const second = parseTeamRows(rows, headerIndices[1], headerIndices[2] ?? null);
  if (!first.teamName || !second.teamName) throw new Error("Team names could not be read from the spreadsheet.");
  if (!first.players.length || !second.players.length) throw new Error("Player stat rows could not be read for both teams.");

  const homeScore = first.players.reduce((sum, player) => sum + Number(player.PTS ?? 0), 0);
  const awayScore = second.players.reduce((sum, player) => sum + Number(player.PTS ?? 0), 0);
  if (homeScore <= 0 || awayScore <= 0) throw new Error("Team scores must be greater than zero. Check the Pts column in the spreadsheet.");

  const gameDate = String(formData.get("gameDate") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(gameDate)) throw new Error("Game date is required for spreadsheet box score uploads.");

  const gameNumberInput = String(formData.get("gameNumber") ?? "").trim();
  const gameNumber = gameNumberInput || `PYBC-DRAFT-${gameDate.replace(/-/g, "")}-${first.teamName.replace(/[^A-Z0-9]+/g, "-")}-VS-${second.teamName.replace(/[^A-Z0-9]+/g, "-")}`.slice(0, 120);
  const packageJson = {
    league: {
      name: "PYBC U16 Boys Basketball",
      ageGroup: "U16",
      organizerName: "PYBC",
      city: "Metro Manila",
      region: "NCR"
    },
    season: {
      name: "2025 Season",
      seasonYear: 2025
    },
    games: [
      {
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
      }
    ]
  };

  return {
    packageJson,
    homeTeamName: first.teamName,
    awayTeamName: second.teamName,
    homeScore,
    awayScore,
    homePlayerCount: first.players.length,
    awayPlayerCount: second.players.length,
    totalPlayerRows: first.players.length + second.players.length,
    messages: [
      `Parsed PYBC two-team box score: ${first.teamName} ${homeScore} - ${awayScore} ${second.teamName}.`,
      `Player point totals pass: ${first.teamName} ${homeScore}, ${second.teamName} ${awayScore}.`,
      "Submission draft JSON was generated for admin review. No official import was performed."
    ]
  };
}

export function parsePybcSpreadsheetBuffer(buffer: Buffer, formData: FormData, format: "csv" | "xlsx") {
  const rows = format === "csv" ? buffer.toString("utf8").replace(/^\uFEFF/, "").split(/\r?\n/).map(parseCsvLine) : parseXlsxRows(buffer);
  return parsePybcTwoTeamBoxScore(rows, formData);
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

async function storeUploadedFile(file: File) {
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

export async function parseSubmissionPayload(type: OrganizerSubmissionType, formData: FormData): Promise<ParsedSubmissionPayload> {
  if (type === OrganizerSubmissionType.PASTE_JSON) {
    const rawText = String(formData.get("rawText") ?? "").trim();
    if (!rawText) throw new Error("Pasted JSON is required.");
    if (Buffer.byteLength(rawText, "utf8") > maxFileSizeBytes) throw new Error("Pasted JSON must be 5 MB or smaller.");

    const parsed = safeJsonParse(rawText);
    if (!parsed.ok) throw new Error(`Invalid JSON: ${formatSubmissionJsonParseError(parsed) ?? "JSON could not be parsed."}`);

    return {
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
    };
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
    return {
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
    };
  }

  const { storedFilePath, buffer } = await storeUploadedFileBuffer(file, initialBuffer);

  if (type === OrganizerSubmissionType.UPLOAD_CSV || type === OrganizerSubmissionType.UPLOAD_XLSX) {
    const format = type === OrganizerSubmissionType.UPLOAD_CSV ? "csv" : "xlsx";
    const parsedBoxScore = parsePybcSpreadsheetBuffer(buffer, formData, format);
    const rawText = JSON.stringify(parsedBoxScore.packageJson, null, 2);
    return {
      rawText,
      parsedPreview: jsonPreview(parsedBoxScore.packageJson),
      validationSummary: {
        ok: true,
        format,
        messages: parsedBoxScore.messages,
        rowCount: parsedBoxScore.totalPlayerRows,
        previewSupported: true
      },
      originalFilename,
      mimeType,
      fileSizeBytes: file.size,
      storedFilePath
    };
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