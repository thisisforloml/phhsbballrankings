const fs = require("fs");
const path = require("path");

const repoRoot = "D:/OnCourt Rankings PH";
const mainTranscript =
  "C:/Users/DECK/.cursor/projects/d-OnCourt-Rankings-PH/agent-transcripts/486fd252-c23d-48a2-a1dd-4c9fa4fde99c/486fd252-c23d-48a2-a1dd-4c9fa4fde99c.jsonl";
const teamTranscript =
  "C:/Users/DECK/.cursor/projects/d-OnCourt-Rankings-PH/agent-transcripts/8a2a8b8f-c7c1-442e-a30e-a7d10d4b9f5b/8a2a8b8f-c7c1-442e-a30e-a7d10d4b9f5b.jsonl";

const MAX_LINE_INDEX = 691; // stop before line 692 (Design System Phase 1)

const SKIP_PATH_PATTERNS = [
  /src[\\/]lib[\\/]design-system[\\/]/i,
  /src[\\/]components[\\/]design-system[\\/]/i,
  /src[\\/]lib[\\/]format[\\/]stats\.ts$/i,
  /src[\\/]components[\\/]icons[\\/]sports[\\/]/i,
  /src[\\/]app[\\/]error\.tsx$/i,
  /src[\\/]app[\\/]loading\.tsx$/i,
  /src[\\/]app[\\/]not-found\.tsx$/i,
  /src[\\/]lib[\\/]env\.ts$/i,
];

const TEAM_FILE_PATTERNS = [
  /TeamsClient\.tsx$/i,
  /NationalTeamRankingTable/i,
  /TeamRosterTable/i,
  /src[\\/]app[\\/]teams[\\/]/i,
];

function normalizeRel(p) {
  return p
    .replace(/\\/g, "/")
    .replace(/^D:[/]OnCourt Rankings PH[/]/i, "")
    .toLowerCase();
}

function toRepoPath(rel) {
  const cleaned = rel.replace(/^D:[\\/]OnCourt Rankings PH[\\/]/i, "");
  return path.join(repoRoot, cleaned);
}

function shouldSkip(rel) {
  const n = rel.replace(/\\/g, "/");
  if (!n.includes("/src/") && !n.startsWith("src/")) return true;
  return SKIP_PATH_PATTERNS.some((re) => re.test(n));
}

function isTeamFile(rel) {
  const n = rel.replace(/\\/g, "/");
  return TEAM_FILE_PATTERNS.some((re) => re.test(n));
}

/** @type {Map<string, { rel: string, content: string, source: string, hadWrite: boolean }>} */
const files = new Map();
/** @type {Map<string, { count: number }>} */
const strReplaceOnly = new Map();

function processTranscript(transcriptPath, options = {}) {
  const {
    maxLineIndex = Infinity,
    teamOnly = false,
    label = "main",
  } = options;

  if (!fs.existsSync(transcriptPath)) {
    console.warn("missing transcript:", transcriptPath);
    return;
  }

  const lines = fs.readFileSync(transcriptPath, "utf8").split("\n");
  for (let i = 0; i < lines.length && i < maxLineIndex; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    if (obj.role !== "assistant") continue;

    for (const part of obj.message?.content ?? []) {
      if (part.type !== "tool_use") continue;
      const input = part.input ?? {};
      const rawPath = input.path;
      if (!rawPath) continue;

      const rel = rawPath.replace(/\\/g, "/");
      if (shouldSkip(rel)) continue;
      if (teamOnly && !isTeamFile(rel)) continue;
      if (!teamOnly && isTeamFile(rel) && label === "main") {
        // team files come from team transcript pass
        continue;
      }

      const key = normalizeRel(rel);

      if (part.name === "Write" && input.contents != null) {
        files.set(key, {
          rel: rawPath,
          content: input.contents,
          source: `${label}:L${i + 1}`,
          hadWrite: true,
        });
        strReplaceOnly.delete(key);
        continue;
      }

      if (part.name === "StrReplace" && input.old_string != null && input.new_string != null) {
        const entry = files.get(key);
        if (entry) {
          if (!entry.content.includes(input.old_string)) {
            // best-effort: skip mismatched replace
            continue;
          }
          entry.content = entry.content.replace(input.old_string, input.new_string);
          entry.source = `${entry.source}+sr:L${i + 1}`;
        } else {
          const prev = strReplaceOnly.get(key) ?? { count: 0 };
          prev.count += 1;
          strReplaceOnly.set(key, prev);
        }
      }
    }
  }
}

// Pass 1: main transcript through line 691
processTranscript(mainTranscript, {
  maxLineIndex: MAX_LINE_INDEX,
  label: "main",
});

// Pass 2: team transcript (full)
processTranscript(teamTranscript, {
  teamOnly: true,
  label: "team",
});

const written = [];
const skipped = [];

for (const [key, entry] of files) {
  const out = toRepoPath(entry.rel);
  if (!out.includes(`${path.sep}src${path.sep}`)) continue;
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, entry.content, "utf8");
  written.push({
    path: path.relative(repoRoot, out).replace(/\\/g, "/"),
    source: entry.source,
    bytes: entry.content.length,
  });
}

const strReplaceOnlyPaths = [...strReplaceOnly.keys()]
  .map((k) => {
    const entry = files.get(k);
    return entry ? null : k;
  })
  .filter(Boolean);

const report = {
  writtenCount: written.length,
  written: written.sort((a, b) => a.path.localeCompare(b.path)),
  strReplaceOnlyCount: strReplaceOnlyPaths.length,
  strReplaceOnly: strReplaceOnlyPaths,
};

fs.writeFileSync(
  path.join(repoRoot, ".cursor/extract-june26-report.json"),
  JSON.stringify(report, null, 2),
  "utf8"
);

console.log("RESTORED", written.length, "files");
for (const w of written) {
  console.log("  ", w.path, `(${w.bytes}b, ${w.source})`);
}
console.log("\nSTRREPLACE_ONLY (no Write before line 692):", strReplaceOnlyPaths.length);
for (const p of strReplaceOnlyPaths.slice(0, 50)) {
  console.log("  ", p);
}
if (strReplaceOnlyPaths.length > 50) {
  console.log("  ... and", strReplaceOnlyPaths.length - 50, "more");
}
