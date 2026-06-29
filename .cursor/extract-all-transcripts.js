const fs = require("fs");
const path = require("path");

const transcripts = [
  "C:/Users/DECK/.cursor/projects/d-OnCourt-Rankings-PH/agent-transcripts/eb44faa5-fbd3-4702-9cde-1009b18e8795/eb44faa5-fbd3-4702-9cde-1009b18e8795.jsonl",
  "C:/Users/DECK/.cursor/projects/d-OnCourt-Rankings-PH/agent-transcripts/8a2a8b8f-c7c1-442e-a30e-a7d10d4b9f5b/8a2a8b8f-c7c1-442e-a30e-a7d10d4b9f5b.jsonl",
  "C:/Users/DECK/.cursor/projects/d-OnCourt-Rankings-PH/agent-transcripts/486fd252-c23d-48a2-a1dd-4c9fa4fde99c/486fd252-c23d-48a2-a1dd-4c9fa4fde99c.jsonl",
];
const repoRoot = "D:/OnCourt Rankings PH";
const latest = new Map();

for (const transcript of transcripts) {
  if (!fs.existsSync(transcript)) continue;
  for (const line of fs.readFileSync(transcript, "utf8").split("\n")) {
    if (!line.trim()) continue;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    for (const part of obj.message?.content ?? []) {
      if (part.type !== "tool_use" || part.name !== "Write" || !part.input?.path || !part.input?.contents) continue;
      const rel = part.input.path.replace(/\\/g, "/");
      if (rel.includes("design-system") || rel.includes("format/stats")) continue;
      latest.set(rel.toLowerCase(), { rel: part.input.path, contents: part.input.contents });
    }
  }
}

for (const [, { rel, contents }] of latest) {
  if (!rel.includes("OnCourt Rankings PH")) continue;
  const out = path.join(repoRoot, rel.replace(/^D:[\\/]OnCourt Rankings PH[\\/]/i, ""));
  if (!out.includes("src\\") && !out.includes("src/")) continue;
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, contents);
  console.log("wrote", path.basename(out), contents.length);
}
