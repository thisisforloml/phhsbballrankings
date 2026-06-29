const fs = require("fs");
const path = require("path");

const repoRoot = "D:/OnCourt Rankings PH";
const main =
  "C:/Users/DECK/.cursor/projects/d-OnCourt-Rankings-PH/agent-transcripts/486fd252-c23d-48a2-a1dd-4c9fa4fde99c/486fd252-c23d-48a2-a1dd-4c9fa4fde99c.jsonl";
const admin =
  "C:/Users/DECK/.cursor/projects/d-OnCourt-Rankings-PH/agent-transcripts/08f3052e-24ab-4cde-887e-f3022c77b2ca/08f3052e-24ab-4cde-887e-f3022c77b2ca.jsonl";

const picks = [
  { transcript: main, line: 924, match: /HomeClient\.tsx$/i, out: "src/app/HomeClient.tsx", maxLine: Infinity },
  { transcript: main, line: 966, match: /RankingTable\.tsx$/i, out: "src/components/public/RankingTable.tsx", maxLine: Infinity },
  { transcript: admin, line: 0, match: /admin[\\/]programs[\\/]page\.tsx$/i, out: "src/app/admin/programs/page.tsx", maxLine: Infinity, last: true },
  { transcript: admin, line: 0, match: /submissions[\\/]\[id\][\\/]page\.tsx$/i, out: "src/app/admin/submissions/[id]/page.tsx", maxLine: Infinity, last: true },
  { transcript: admin, line: 0, match: /url-import-actions\.ts$/i, out: "src/app/admin/tools/submissions/url-import-actions.ts", maxLine: Infinity, last: true },
  { transcript: admin, line: 0, match: /EditableGameStatsForm\.tsx$/i, out: "src/app/admin/submissions/[id]/EditableGameStatsForm.tsx", maxLine: Infinity, last: true },
];

function extractWrite(transcriptPath, lineNum, matchRe, last) {
  const lines = fs.readFileSync(transcriptPath, "utf8").split("\n");
  let found = null;
  const end = lineNum > 0 ? lineNum : lines.length;
  for (let i = 0; i < end; i++) {
    let obj;
    try {
      obj = JSON.parse(lines[i]);
    } catch {
      continue;
    }
    if (obj.role !== "assistant") continue;
    for (const part of obj.message?.content ?? []) {
      if (part.type !== "tool_use" || part.name !== "Write") continue;
      const p = part.input?.path ?? "";
      if (!matchRe.test(p.replace(/\\/g, "/"))) continue;
      const content = part.input.contents ?? part.input.content;
      if (content == null) continue;
      found = { line: i + 1, content };
      if (!last) return found;
    }
  }
  return found;
}

for (const pick of picks) {
  const w =
    pick.line > 0
      ? (() => {
          const lines = fs.readFileSync(pick.transcript, "utf8").split("\n");
          const obj = JSON.parse(lines[pick.line - 1]);
          for (const part of obj.message?.content ?? []) {
            if (part.type !== "tool_use" || part.name !== "Write") continue;
            const p = part.input?.path ?? "";
            if (!pick.match.test(p.replace(/\\/g, "/"))) continue;
            return { line: pick.line, content: part.input.contents ?? part.input.content };
          }
          return null;
        })()
      : extractWrite(pick.transcript, 0, pick.match, pick.last);

  if (!w?.content) {
    console.log("MISSING", pick.out);
    continue;
  }
  const out = path.join(repoRoot, pick.out);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, w.content, "utf8");
  console.log("OK", pick.out, "L" + w.line, w.content.length);
}
