const fs = require("fs");
const path = require("path");

const repoRoot = "D:/OnCourt Rankings PH";

function writeFromTranscript(transcriptPath, filter) {
  const lines = fs.readFileSync(transcriptPath, "utf8").split("\n");
  for (const line of lines) {
    if (!line.trim()) continue;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    for (const part of obj.message?.content ?? []) {
      if (part.type !== "tool_use" || part.name !== "Write" || !part.input?.path) continue;
      const rel = part.input.path.replace(/\\/g, "/");
      if (!filter(rel)) continue;
      let contents = part.input.contents;
      if (rel.includes("PlayerCompareClient")) {
        contents = contents.replace(
          'from "@/lib/player-profile"',
          'from "@/lib/player-profile-types"'
        );
      }
      if (rel.includes("players/compare/page.tsx")) {
        contents = contents.replace("OnCourt", "Peach Basket");
      }
      const out = path.join(
        repoRoot,
        rel.replace(/^D:[\\/]OnCourt Rankings PH[\\/]/i, "")
      );
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, contents);
      console.log("wrote", path.relative(repoRoot, out), contents.length);
    }
  }
}

writeFromTranscript(
  "C:/Users/DECK/.cursor/projects/d-OnCourt-Rankings-PH/agent-transcripts/eb44faa5-fbd3-4702-9cde-1009b18e8795/eb44faa5-fbd3-4702-9cde-1009b18e8795.jsonl",
  (rel) => rel.includes("players/compare")
);

writeFromTranscript(
  "C:/Users/DECK/.cursor/projects/d-OnCourt-Rankings-PH/agent-transcripts/8a2a8b8f-c7c1-442e-a30e-a7d10d4b9f5b/8a2a8b8f-c7c1-442e-a30e-a7d10d4b9f5b.jsonl",
  (rel) =>
    rel.includes("TeamsClient.tsx") ||
    rel.includes("NationalTeamRankingTable") ||
    rel.includes("TeamRosterTable")
);
