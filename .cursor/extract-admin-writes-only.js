const fs = require("fs");
const path = require("path");

const repoRoot = "D:/OnCourt Rankings PH";
const adminTranscript =
  "C:/Users/DECK/.cursor/projects/d-OnCourt-Rankings-PH/agent-transcripts/08f3052e-24ab-4cde-887e-f3022c77b2ca/08f3052e-24ab-4cde-887e-f3022c77b2ca.jsonl";

function relKey(p) {
  return p.replace(/\\/g, "/").replace(/^D:[/]OnCourt Rankings PH[/]/i, "").toLowerCase();
}

/** @type {Map<string, { rel: string, content: string, line: number }>} */
const latest = new Map();

for (const [i, line] of fs.readFileSync(adminTranscript, "utf8").split("\n").entries()) {
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
    const rel = part.input.path;
    const content = part.input.contents ?? part.input.content;
    if (content == null) continue;
    const key = relKey(rel);
    if (!key.includes("src/")) continue;
    if (!key.includes("/admin/") && !key.includes("/components/admin/") && !key.includes("/lib/admin/")) continue;
    latest.set(key, { rel, content, line: i + 1 });
  }
}

let n = 0;
for (const { rel, content, line } of latest.values()) {
  const out = path.join(repoRoot, rel.replace(/^D:[\\/]OnCourt Rankings PH[\\/]/i, ""));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, content, "utf8");
  console.log("W", line, path.relative(repoRoot, out).replace(/\\/g, "/"));
  n++;
}
console.log("TOTAL", n);
