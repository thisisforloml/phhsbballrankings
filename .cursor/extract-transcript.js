const fs = require("fs");
const path = require("path");

const transcript =
  "C:/Users/DECK/.cursor/projects/d-OnCourt-Rankings-PH/agent-transcripts/486fd252-c23d-48a2-a1dd-4c9fa4fde99c/486fd252-c23d-48a2-a1dd-4c9fa4fde99c.jsonl";
const repoRoot = "D:/OnCourt Rankings PH";

const want = new Set([
  "PlayerProfilePageClient.tsx",
  "PlayerAnalytics.tsx",
  "PlayerProfileCharts.tsx",
  "ProfileCharts.tsx",
  "PlayerTrendsChart.tsx",
  "PerformanceTrajectoryChart.tsx",
  "PlayerCompareClient.tsx",
  "NationalTeamRankingTable.tsx",
  "TeamRosterTable.tsx",
  "PlayerProfileHeader.tsx",
  "RankingsClient.tsx",
  "TeamsClient.tsx",
  "page.tsx",
]);

const latest = new Map();

for (const line of fs.readFileSync(transcript, "utf8").split("\n")) {
  if (!line.trim()) continue;
  let obj;
  try {
    obj = JSON.parse(line);
  } catch {
    continue;
  }
  for (const part of obj.message?.content ?? []) {
    if (part.type !== "tool_use" || part.name !== "Write" || !part.input?.path) continue;
    const base = path.basename(part.input.path);
    const rel = part.input.path.replace(/\\/g, "/");
    const key = rel.includes("players/compare") ? "PlayerCompareClient.tsx" : base;
    if (!want.has(key) && !want.has(base)) continue;
    if (key === "page.tsx" && !rel.includes("players/[slug]") && !rel.includes("players\\[slug]") && !rel.includes("players/compare")) continue;
    latest.set(key + "|" + rel, { rel: part.input.path, contents: part.input.contents });
  }
}

for (const [, { rel, contents }] of latest) {
  const out = path.join(repoRoot, rel.replace(/^D:[\\/]OnCourt Rankings PH[\\/]/i, ""));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, contents);
  console.log("wrote", out, contents.length);
}

console.log("total", latest.size);
