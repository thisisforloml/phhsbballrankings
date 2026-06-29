const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const repoRoot = "D:/OnCourt Rankings PH";
const transcript =
  "C:/Users/DECK/.cursor/projects/d-OnCourt-Rankings-PH/agent-transcripts/eb44faa5-fbd3-4702-9cde-1009b18e8795/eb44faa5-fbd3-4702-9cde-1009b18e8795.jsonl";
const rel = "src/app/HomeClient.tsx";
const MAX_LINE = 294;

function normRel(p) {
  return p.replace(/\\/g, "/").replace(/^D:[/]OnCourt Rankings PH[/]/i, "").toLowerCase();
}

function gitShow(relPath) {
  try {
    return execSync(`git show HEAD:"${relPath}"`, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"]
    });
  } catch {
    return null;
  }
}

let content = gitShow(rel);
let applied = 0;
let missed = 0;
const lines = fs.readFileSync(transcript, "utf8").split("\n");

for (let i = 0; i < Math.min(MAX_LINE, lines.length); i++) {
  let obj;
  try {
    obj = JSON.parse(lines[i]);
  } catch {
    continue;
  }
  if (obj.role !== "assistant") continue;
  for (const part of obj.message?.content ?? []) {
    if (part.type !== "tool_use" || !part.input?.path) continue;
    if (normRel(part.input.path) !== rel.toLowerCase()) continue;
    if (part.name === "Write" && (part.input.contents ?? part.input.content) != null) {
      content = part.input.contents ?? part.input.content;
      applied++;
    } else if (part.name === "StrReplace") {
      if (!content || !content.includes(part.input.old_string)) {
        missed++;
        continue;
      }
      content = content.replace(part.input.old_string, part.input.new_string);
      applied++;
    }
  }
}

fs.writeFileSync(path.join(repoRoot, rel), content, "utf8");
console.log("HomeClient", content.length, "bytes", "applied", applied, "missed", missed);
console.log("has BoardLeadersCarousel", content.includes("BoardLeadersCarousel"));
console.log("has teamPreview", content.includes("teamPreview"));
