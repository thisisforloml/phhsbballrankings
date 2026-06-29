const fs = require("fs");
const t =
  "C:/Users/DECK/.cursor/projects/d-OnCourt-Rankings-PH/agent-transcripts/08f3052e-24ab-4cde-887e-f3022c77b2ca/08f3052e-24ab-4cde-887e-f3022c77b2ca.jsonl";
const lines = fs.readFileSync(t, "utf8").split("\n");
const obj = JSON.parse(lines[496]);
let content = null;
for (const part of obj.message.content) {
  if (part.name === "Write") content = part.input.contents;
}
let applied = 0;
for (let i = 496; i < lines.length; i++) {
  if (!lines[i].trim()) continue;
  let row;
  try {
    row = JSON.parse(lines[i]);
  } catch {
    continue;
  }
  if (row.role !== "assistant") continue;
  for (const part of row.message?.content ?? []) {
    if (part.type !== "tool_use" || part.name !== "StrReplace" || !part.input?.path?.includes("url-import-actions")) continue;
    if (!content.includes(part.input.old_string)) continue;
    content = content.replace(part.input.old_string, part.input.new_string);
    applied++;
  }
}
fs.writeFileSync("D:/OnCourt Rankings PH/src/app/admin/tools/submissions/url-import-actions.ts", content);
console.log("url-import", applied, content.length, content.slice(0, 20));
