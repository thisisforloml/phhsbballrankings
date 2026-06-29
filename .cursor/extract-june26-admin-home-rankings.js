const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const repoRoot = "D:/OnCourt Rankings PH";
const mainTranscript =
  "C:/Users/DECK/.cursor/projects/d-OnCourt-Rankings-PH/agent-transcripts/486fd252-c23d-48a2-a1dd-4c9fa4fde99c/486fd252-c23d-48a2-a1dd-4c9fa4fde99c.jsonl";
const adminTranscript =
  "C:/Users/DECK/.cursor/projects/d-OnCourt-Rankings-PH/agent-transcripts/08f3052e-24ab-4cde-887e-f3022c77b2ca/08f3052e-24ab-4cde-887e-f3022c77b2ca.jsonl";

const MAIN_MAX_LINE = 691;

const SKIP_PATTERNS = [
  /src[\\/]lib[\\/]design-system[\\/]/i,
  /src[\\/]components[\\/]design-system[\\/]/i,
  /src[\\/]lib[\\/]format[\\/]stats\.ts$/i,
  /src[\\/]components[\\/]icons[\\/]sports[\\/]/i,
];

const HOME_RANKINGS_PATTERNS = [
  /src[\\/]app[\\/]HomeClient\.tsx$/i,
  /src[\\/]app[\\/]page\.tsx$/i,
  /src[\\/]components[\\/]sections[\\/]/i,
  /src[\\/]lib[\\/]public-site-data\.ts$/i,
  /src[\\/]app[\\/]rankings[\\/]/i,
  /src[\\/]components[\\/]public[\\/](RankingTable|FilterBar|AgeGroupPill|RecruitingClassFilter|SectionHeader|RankingsCoverageNotice|PublicPageShell|SortIndicator)\.tsx$/i,
  /src[\\/]lib[\\/](rankings-url-state|public-rankings-coverage)\.ts$/i,
  /src[\\/]components[\\/]ui[\\/](RatingBadge|EmptyState)\.tsx$/i,
];

const ADMIN_PATTERNS = [
  /src[\\/]app[\\/]admin[\\/]/i,
  /src[\\/]components[\\/]admin[\\/]/i,
  /src[\\/]lib[\\/]admin[\\/]/i,
  /src[\\/]lib[\\/]admin-audit-log\.ts$/i,
];

function normRel(p) {
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
  return SKIP_PATTERNS.some((re) => re.test(n));
}

function matchesArea(rel, patterns) {
  const n = rel.replace(/\\/g, "/");
  if (!/\.(tsx?|css|mdc)$/i.test(n)) return false;
  return patterns.some((re) => re.test(n));
}

function gitShow(relPath) {
  try {
    return execSync(`git show HEAD:"${relPath.replace(/\\/g, "/")}"`, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    });
  } catch {
    return null;
  }
}

/** @type {Map<string, { rel: string, content: string | null, source: string, hadWrite: boolean, ops: Array<{line:number, old:string, new:string}> }>} */
const files = new Map();

function ensureEntry(rel) {
  const key = normRel(rel);
  if (!files.has(key)) {
    files.set(key, {
      rel,
      content: null,
      source: "",
      hadWrite: false,
      ops: [],
    });
  }
  return files.get(key);
}

function processTranscript(transcriptPath, options) {
  const { maxLineIndex = Infinity, areaPatterns, label } = options;
  if (!fs.existsSync(transcriptPath)) {
    console.warn("missing:", transcriptPath);
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
      if (part.type !== "tool_use" || !part.input?.path) continue;
      const rawPath = part.input.path;
      const rel = rawPath.replace(/\\/g, "/");
      if (!rel.includes("src/") && !rel.includes("src\\")) continue;
      if (shouldSkip(rel)) continue;
      if (!matchesArea(rel, areaPatterns)) continue;

      const entry = ensureEntry(rawPath);

      if (part.name === "Write" && inputContents(part)) {
        entry.content = inputContents(part);
        entry.hadWrite = true;
        entry.source = `${label}:L${i + 1}`;
        entry.ops = [];
        continue;
      }

      if (part.name === "StrReplace" && part.input.old_string != null && part.input.new_string != null) {
        entry.ops.push({
          line: i + 1,
          old: part.input.old_string,
          new: part.input.new_string,
        });
        if (!entry.source) entry.source = `${label}:sr-only`;
      }
    }
  }
}

function inputContents(part) {
  return part.input.contents ?? part.input.content ?? null;
}

// Pass 1: main transcript — home + rankings (before DS Phase 1)
processTranscript(mainTranscript, {
  maxLineIndex: MAIN_MAX_LINE,
  areaPatterns: HOME_RANKINGS_PATTERNS,
  label: "main",
});

// Pass 2: admin transcript (full session)
processTranscript(adminTranscript, {
  areaPatterns: ADMIN_PATTERNS,
  label: "admin",
});

const written = [];
const bootstrapped = [];
const failed = [];

for (const [key, entry] of files) {
  const relPath = entry.rel.replace(/^D:[\\/]OnCourt Rankings PH[\\/]/i, "").replace(/\\/g, "/");
  let content = entry.content;

  if (!entry.hadWrite) {
    const diskPath = toRepoPath(entry.rel);
    const fromGit = gitShow(relPath);
    const fromDisk = fs.existsSync(diskPath) && fs.statSync(diskPath).isFile()
      ? fs.readFileSync(diskPath, "utf8")
      : null;
    // Prefer git baseline for strreplace-only chains (disk may hold post-rollback state)
    content = fromGit ?? fromDisk;
    if (content) bootstrapped.push(relPath);
  }

  if (!content) {
    failed.push({ path: relPath, reason: "no write and no bootstrap" });
    continue;
  }

  let applied = 0;
  for (const op of entry.ops) {
    if (!content.includes(op.old)) continue;
    content = content.replace(op.old, op.new);
    applied++;
    entry.source = entry.source ? `${entry.source}+sr:L${op.line}` : `sr:L${op.line}`;
  }

  const out = toRepoPath(entry.rel);
  if (fs.existsSync(out) && fs.statSync(out).isDirectory()) {
    failed.push({ path: relPath, reason: "path is a directory" });
    continue;
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, content, "utf8");
  written.push({
    path: relPath,
    source: entry.source,
    hadWrite: entry.hadWrite,
    srApplied: entry.ops.length,
    bytes: content.length,
  });
}

const report = { written, bootstrapped, failed };
fs.writeFileSync(
  path.join(repoRoot, ".cursor/extract-june26-admin-home-rankings-report.json"),
  JSON.stringify(report, null, 2),
  "utf8"
);

console.log("RESTORED", written.length, "files");
for (const w of written.sort((a, b) => a.path.localeCompare(b.path))) {
  console.log(
    " ",
    w.path,
    w.hadWrite ? "W" : "bootstrap",
    `${w.bytes}b`,
    w.source
  );
}
console.log("\nFAILED", failed.length);
for (const f of failed) console.log(" ", f.path, f.reason);
