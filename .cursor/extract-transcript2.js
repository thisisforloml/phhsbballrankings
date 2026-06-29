const fs = require("fs");
const path = require("path");

const transcript =
  "C:/Users/DECK/.cursor/projects/d-OnCourt-Rankings-PH/agent-transcripts/486fd252-c23d-48a2-a1dd-4c9fa4fde99c/486fd252-c23d-48a2-a1dd-4c9fa4fde99c.jsonl";
const repoRoot = "D:/OnCourt Rankings PH";

const files = [
  "PlayerCompareClient.tsx",
  "NationalTeamRankingTable.tsx",
  "TeamRosterTable.tsx",
  "TeamsClient.tsx",
  "page.tsx",
];

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
    if (part.type !== "tool_use" || !part.input?.path) continue;
    const rel = part.input.path.replace(/\\/g, "/");
    const base = path.basename(rel);
    let key = base;
    if (base === "page.tsx") {
      if (rel.includes("players/compare")) key = "compare-page.tsx";
      else if (rel.includes("players/[slug]") || rel.includes("players\\[slug]")) key = "player-slug-page.tsx";
      else continue;
    } else if (!files.includes(base)) {
      continue;
    }
    if (part.name === "Write" && part.input.contents) {
      latest.set(key, { rel: part.input.path, contents: part.input.contents });
    }
  }
}

for (const [key, { rel, contents }] of latest) {
  const out = path.join(repoRoot, rel.replace(/^D:[\\/]OnCourt Rankings PH[\\/]/i, ""));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, contents);
  console.log(key, "->", out, contents.length);
}
