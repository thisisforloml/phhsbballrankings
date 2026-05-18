import "server-only";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { OrganizerSubmissionType } from "@prisma/client";

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

async function storeUploadedFile(file: File) {
  const storageRoot = path.join(process.cwd(), "storage", "submissions");
  await mkdir(storageRoot, { recursive: true });

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "submission";
  const storedFilePath = path.join("storage", "submissions", `${Date.now()}-${randomUUID()}-${safeName}`);
  const absolutePath = path.join(process.cwd(), storedFilePath);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(absolutePath, buffer);

  return {
    storedFilePath,
    buffer
  };
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
    throw new Error("Paste JSON or upload a JSON, CSV, or XLSX file.");
  }

  const extension = fileExtension(file);
  if (extension === "json" || file.type === "application/json") return OrganizerSubmissionType.UPLOAD_JSON;
  if (extension === "csv" || file.type === "text/csv") return OrganizerSubmissionType.UPLOAD_CSV;
  if (extension === "xlsx" || file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") return OrganizerSubmissionType.UPLOAD_XLSX;

  throw new Error("Unsupported file type. Upload JSON, CSV, or XLSX only.");
}

export async function parseSubmissionPayload(type: OrganizerSubmissionType, formData: FormData): Promise<ParsedSubmissionPayload> {
  if (type === OrganizerSubmissionType.PASTE_JSON) {
    const rawText = String(formData.get("rawText") ?? "").trim();
    if (!rawText) throw new Error("Pasted JSON is required.");
    if (Buffer.byteLength(rawText, "utf8") > maxFileSizeBytes) throw new Error("Pasted JSON must be 5 MB or smaller.");

    try {
      const parsed = JSON.parse(rawText) as unknown;
      return {
        rawText,
        parsedPreview: jsonPreview(parsed),
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
    } catch {
      return {
        rawText,
        parsedPreview: null,
        validationSummary: {
          ok: false,
          format: "json",
          messages: ["Invalid JSON. Submission stored for review, but preview could not be generated."],
          previewSupported: true
        },
        originalFilename: null,
        mimeType: null,
        fileSizeBytes: Buffer.byteLength(rawText, "utf8"),
        storedFilePath: null
      };
    }
  }

  const file = assertFile(formData.get("file"));
  const { storedFilePath, buffer } = await storeUploadedFile(file);
  const originalFilename = file.name || "submission";
  const mimeType = file.type || "application/octet-stream";

  if (type === OrganizerSubmissionType.UPLOAD_JSON) {
    const rawText = buffer.toString("utf8").trim();
    try {
      const parsed = JSON.parse(rawText) as unknown;
      return {
        rawText,
        parsedPreview: jsonPreview(parsed),
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
    } catch {
      return {
        rawText,
        parsedPreview: null,
        validationSummary: {
          ok: false,
          format: "json",
          messages: ["Uploaded file is not valid JSON. Submission stored for review."],
          previewSupported: true
        },
        originalFilename,
        mimeType,
        fileSizeBytes: file.size,
        storedFilePath
      };
    }
  }

  if (type === OrganizerSubmissionType.UPLOAD_CSV) {
    const rawText = buffer.toString("utf8");
    const preview = parseCsvPreview(rawText);
    return {
      rawText,
      parsedPreview: preview,
      validationSummary: {
        ok: preview.headers.length > 0,
        format: "csv",
        messages: preview.headers.length > 0
          ? ["CSV preview generated. No official import was performed."]
          : ["CSV appears empty. Submission stored for review."],
        rowCount: preview.totalRows,
        previewSupported: true
      },
      originalFilename,
      mimeType,
      fileSizeBytes: file.size,
      storedFilePath
    };
  }

  return {
    rawText: null,
    parsedPreview: null,
    validationSummary: {
      ok: true,
      format: "xlsx",
      messages: ["XLSX file stored. Preview is unsupported until an XLSX parser dependency is approved."],
      previewSupported: false
    },
    originalFilename,
    mimeType,
    fileSizeBytes: file.size,
    storedFilePath
  };
}

export function submissionTypeLabel(type: OrganizerSubmissionType | string) {
  if (type === OrganizerSubmissionType.PASTE_JSON || type === "PASTE_JSON") return "Pasted JSON";
  if (type === OrganizerSubmissionType.UPLOAD_JSON || type === "UPLOAD_JSON") return "JSON upload";
  if (type === OrganizerSubmissionType.UPLOAD_CSV || type === "UPLOAD_CSV") return "CSV upload";
  if (type === OrganizerSubmissionType.UPLOAD_XLSX || type === "UPLOAD_XLSX") return "XLSX upload";
  return String(type);
}