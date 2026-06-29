const fs = require("fs");
const path = require("path");

const repoRoot = "D:/OnCourt Rankings PH";
const transcripts = [
  {
    label: "main",
    path: "C:/Users/DECK/.cursor/projects/d-OnCourt-Rankings-PH/agent-transcripts/486fd252-c23d-48a2-a1dd-4c9fa4fde99c/486fd252-c23d-48a2-a1dd-4c9fa4fde99c.jsonl",
    maxLine: 691,
  },
  {
    label: "admin",
    path: "C:/Users/DECK/.cursor/projects/d-OnCourt-Rankings-PH/agent-transcripts/08f3052e-24ab-4cde-887e-f3022c77b2ca/08f3052e-24ab-4cde-887e-f3022c77b2ca.jsonl",
    maxLine: Infinity,
  },
];

const TARGETS = [
  "src/app/HomeClient.tsx",
  "src/components/sections/HeroSection.tsx",
  "src/components/sections/BoardLeadersCarousel.tsx",
  "src/components/sections/LeaderboardPreview.tsx",
  "src/components/public/RankingTable.tsx",
  "src/components/public/SectionHeader.tsx",
  "src/lib/public-site-data.ts",
  "src/app/admin/programs/page.tsx",
  "src/app/admin/submissions/[id]/page.tsx",
  "src/app/admin/tools/submissions/url-import-actions.ts",
  "src/app/admin/submissions/[id]/EditableGameStatsForm.tsx",
];

function norm(p) {
  return p.replace(/\\/g, "/").replace(/^D:[/]OnCourt Rankings PH[/]/i, "").toLowerCase();
}

const targetSet = new Set(TARGETS.map((t) => t.toLowerCase()));
/** @type {Map<string, { content: string, source: string }>} */
const latest = new Map();

for (const { label, path: tp, maxLine } of transcripts) {
  if (!fs.existsSync(tp)) continue;
  const lines = fs.readFileSync(tp, "utf8").split("\n");
  for (let i = 0; i < Math.min(maxLine, lines.length); i++) {
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
      if (part.type !== "tool_use" || part.name !== "Write") continue;
      const raw = part.input?.path;
      const contents = part.input?.contents ?? part.input?.content;
      if (!raw || contents == null) continue;
      const rel = raw.replace(/\\/g, "/").replace(/^D:[/]OnCourt Rankings PH[/]/i, "");
      if (!targetSet.has(norm(rel))) continue;
      latest.set(norm(rel), { content: contents, source: `${label}:L${i + 1}` });
    }
  }
}

for (const [key, { content, source }] of latest) {
  const rel = TARGETS.find((t) => t.toLowerCase() === key) ?? key;
  const out = path.join(repoRoot, rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, content, "utf8");
  console.log("WROTE", rel, source, content.length);
}

const missing = TARGETS.filter((t) => !latest.has(t.toLowerCase()));
if (missing.length) {
  console.log("\nNO WRITE FOUND:");
  for (const m of missing) console.log(" ", m);
}
