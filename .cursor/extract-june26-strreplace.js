const fs = require("fs");
const path = require("path");

const repoRoot = "D:/OnCourt Rankings PH";
const mainTranscript =
  "C:/Users/DECK/.cursor/projects/d-OnCourt-Rankings-PH/agent-transcripts/486fd252-c23d-48a2-a1dd-4c9fa4fde99c/486fd252-c23d-48a2-a1dd-4c9fa4fde99c.jsonl";
const MAX_LINE_INDEX = 691;

const TARGETS = [
  "src/components/layout/Footer.tsx",
  "src/lib/public-site-data.ts",
  "src/components/layout/AppChrome.tsx",
  "src/app/layout.tsx",
  "src/app/HomeClient.tsx",
  "src/components/ui/EmptyState.tsx",
  "src/components/layout/Navbar.tsx",
  "src/app/players/compare/PlayerCompareClient.tsx",
  "src/lib/player-profile.ts",
  "src/components/public/ProfileModule.tsx",
  "src/components/ui/Card.tsx",
  "src/styles/globals.css",
  "src/components/sections/HeroSection.tsx",
];

function norm(p) {
  return p.replace(/\\/g, "/").replace(/^D:[/]OnCourt Rankings PH[/]/i, "").toLowerCase();
}

const targetSet = new Set(TARGETS.map((t) => t.toLowerCase()));
const ops = [];

for (const [i, line] of fs.readFileSync(mainTranscript, "utf8").split("\n").entries()) {
  if (i >= MAX_LINE_INDEX || !line.trim()) continue;
  let obj;
  try {
    obj = JSON.parse(line);
  } catch {
    continue;
  }
  if (obj.role !== "assistant") continue;
  for (const part of obj.message?.content ?? []) {
    if (part.type !== "tool_use" || part.name !== "StrReplace" || !part.input?.path) continue;
    const rel = part.input.path.replace(/\\/g, "/").replace(/^D:[/]OnCourt Rankings PH[/]/i, "");
    if (!targetSet.has(norm(rel))) continue;
    ops.push({ rel, line: i + 1, old: part.input.old_string, new: part.input.new_string });
  }
}

const results = { applied: [], failed: [], missing: [] };

for (const rel of TARGETS) {
  const out = path.join(repoRoot, rel);
  if (!fs.existsSync(out)) {
    results.missing.push(rel);
    continue;
  }
  let content = fs.readFileSync(out, "utf8");
  let applied = 0;
  for (const op of ops.filter((o) => norm(o.rel) === rel.toLowerCase())) {
    if (!content.includes(op.old)) continue;
    content = content.replace(op.old, op.new);
    applied++;
  }
  if (applied > 0) {
    fs.writeFileSync(out, content, "utf8");
    results.applied.push({ rel, count: applied });
    console.log("patched", rel, applied, "replacements");
  } else {
    results.failed.push(rel);
    console.log("no-op", rel);
  }
}

fs.writeFileSync(
  path.join(repoRoot, ".cursor/extract-june26-strreplace-report.json"),
  JSON.stringify(results, null, 2)
);
