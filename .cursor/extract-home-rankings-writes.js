const fs = require("fs");
const path = require("path");

const repoRoot = "D:/OnCourt Rankings PH";
const mainTranscript =
  "C:/Users/DECK/.cursor/projects/d-OnCourt-Rankings-PH/agent-transcripts/486fd252-c23d-48a2-a1dd-4c9fa4fde99c/486fd252-c23d-48a2-a1dd-4c9fa4fde99c.jsonl";

const MAX_LINE_INDEX = 691;

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

function matchesArea(rel) {
  const n = rel.replace(/\\/g, "/");
  if (!/\.(tsx?|css)$/i.test(n)) return false;
  return HOME_RANKINGS_PATTERNS.some((re) => re.test(n));
}

/** @type {Map<string, { rel: string, content: string, line: number }>} */
const latest = new Map();

const lines = fs.readFileSync(mainTranscript, "utf8").split("\n");
for (let i = 0; i < lines.length && i < MAX_LINE_INDEX; i++) {
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
    if (part.type !== "tool_use" || part.name !== "Write" || !part.input?.path) continue;
    const rawPath = part.input.path;
    const rel = rawPath.replace(/\\/g, "/");
    if (!rel.includes("src/")) continue;
    if (shouldSkip(rel)) continue;
    if (!matchesArea(rel)) continue;
    const content = part.input.contents ?? part.input.content;
    if (content == null) continue;
    latest.set(normRel(rawPath), { rel: rawPath, content, line: i + 1 });
  }
}

let n = 0;
for (const { rel, content, line } of latest.values()) {
  const out = toRepoPath(rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, content, "utf8");
  console.log("W", line, path.relative(repoRoot, out).replace(/\\/g, "/"));
  n++;
}
console.log("TOTAL", n);
