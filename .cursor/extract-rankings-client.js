const fs = require("fs");
const path = "C:/Users/DECK/.cursor/projects/d-OnCourt-Rankings-PH/agent-transcripts/486fd252-c23d-48a2-a1dd-4c9fa4fde99c/486fd252-c23d-48a2-a1dd-4c9fa4fde99c.jsonl";
const lines = fs.readFileSync(path, "utf8").split("\n");
for (let i = 0; i < lines.length; i++) {
  if (!lines[i].includes("RankingsClient.tsx")) continue;
  try {
    const o = JSON.parse(lines[i]);
    for (const c of o.message?.content || []) {
      if (c.name === "StrReplace" && c.input?.path?.includes("RankingsClient")) {
        if (c.input.new_string?.includes("border-y border-line-500") || c.input.new_string?.includes("FilterBar")) {
          console.log("--- LINE", i + 1, "---");
          console.log(c.input.new_string.slice(0, 6000));
        }
      }
      if (c.name === "Write" && c.input?.path?.includes("RankingsClient")) {
        console.log("--- WRITE LINE", i + 1, "---");
        console.log(c.input.contents);
      }
    }
  } catch {}
}
