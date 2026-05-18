export type SubmissionJsonParseResult =
  | { ok: true; data: unknown }
  | { ok: false; errorMessage: string; position?: number; line?: number; column?: number };

type JsonRecord = Record<string, unknown>;

function getPositionFromMessage(message: string) {
  const match = message.match(/position\s+(\d+)/i);
  return match ? Number(match[1]) : undefined;
}

function getLineColumnFromPosition(text: string, position: number) {
  const clamped = Math.max(0, Math.min(position, text.length));
  let line = 1;
  let column = 1;

  for (let index = 0; index < clamped; index += 1) {
    if (text[index] === "\n") {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }

  return { line, column };
}

function jsonParseError(text: string, error: unknown): SubmissionJsonParseResult {
  const errorMessage = error instanceof Error ? error.message : "Invalid JSON.";
  const position = getPositionFromMessage(errorMessage);
  const location = typeof position === "number" ? getLineColumnFromPosition(text, position) : {};

  return {
    ok: false,
    errorMessage,
    position,
    ...location
  };
}

export function safeJsonParse(text: string): SubmissionJsonParseResult {
  try {
    return { ok: true, data: JSON.parse(text) as unknown };
  } catch (error) {
    return jsonParseError(text, error);
  }
}

export function safeParseSubmissionJson(submission: { rawText: string | null; parsedPreview: unknown }): SubmissionJsonParseResult {
  if (submission.rawText?.trim()) return safeJsonParse(submission.rawText);

  if (submission.parsedPreview && typeof submission.parsedPreview === "object") {
    const preview = submission.parsedPreview as JsonRecord;
    if ("league" in preview || "season" in preview || "games" in preview) return { ok: true, data: preview };
    if (Array.isArray(preview.sample)) return { ok: true, data: preview.sample };
    if (preview.sample && typeof preview.sample === "object") return { ok: true, data: preview.sample };
  }

  return { ok: false, errorMessage: "Full submission JSON is not available." };
}

export function formatSubmissionJsonParseError(result: SubmissionJsonParseResult) {
  if (result.ok) return null;
  const location = result.line && result.column ? ` at line ${result.line}, column ${result.column}` : "";
  return `${result.errorMessage}${location}`;
}
