const fs = require("fs");
const path = require("path");

const repoRoot = "D:/OnCourt Rankings PH";
const mainTranscript =
  "C:/Users/DECK/.cursor/projects/d-OnCourt-Rankings-PH/agent-transcripts/486fd252-c23d-48a2-a1dd-4c9fa4fde99c/486fd252-c23d-48a2-a1dd-4c9fa4fde99c.jsonl";
const adminTranscript =
  "C:/Users/DECK/.cursor/projects/d-OnCourt-Rankings-PH/agent-transcripts/08f3052e-24ab-4cde-887e-f3022c77b2ca/08f3052e-24ab-4cde-887e-f3022c77b2ca.jsonl";
const MAX_MAIN = 691;

const REPLAY_FILES = [
  "src/app/HomeClient.tsx",
  "src/components/sections/HeroSection.tsx",
  "src/components/public/RankingTable.tsx",
  "src/lib/public-site-data.ts",
];

const WRITE_ONLY_ADMIN = [
  "src/app/admin/programs/page.tsx",
  "src/app/admin/submissions/[id]/page.tsx",
  "src/app/admin/tools/submissions/url-import-actions.ts",
  "src/app/admin/submissions/[id]/EditableGameStatsForm.tsx",
];

function relKey(p) {
  return p.replace(/\\/g, "/").replace(/^D:[/]OnCourt Rankings PH[/]/i, "").toLowerCase();
}

function toOut(rel) {
  return path.join(repoRoot, rel.replace(/\\/g, "/"));
}

function collectOps(transcriptPath, maxLine, fileFilter) {
  const ops = [];
  const lines = fs.readFileSync(transcriptPath, "utf8").split("\n");
  for (let i = 0; i < Math.min(maxLine, lines.length); i++) {
    let obj;
    try {
      obj = JSON.parse(lines[i]);
    } catch {
      continue;
    }
    if (obj.role !== "assistant") continue;
    for (const part of obj.message?.content ?? []) {
      if (part.type !== "tool_use" || !part.input?.path) continue;
      const rel = part.input.path.replace(/\\/g, "/").replace(/^D:[/]OnCourt Rankings PH[/]/i, "");
      if (!fileFilter(rel)) continue;
      if (part.name === "Write" && (part.input.contents ?? part.input.content) != null) {
        ops.push({ kind: "write", line: i + 1, content: part.input.contents ?? part.input.content });
      } else if (part.name === "StrReplace") {
        ops.push({
          kind: "sr",
          line: i + 1,
          old: part.input.old_string,
          new: part.input.new_string,
        });
      }
    }
  }
  return ops;
}

const { execSync } = require("child_process");

function gitShow(rel) {
  try {
    return execSync(`git show HEAD:"${rel}"`, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    });
  } catch {
    return null;
  }
}

function replay(rel) {
  const ops = collectOps(mainTranscript, MAX_MAIN, (p) => relKey(p) === rel.toLowerCase());
  let content = gitShow(rel);
  let applied = 0;
  for (const op of ops) {
    if (op.kind === "write") {
      content = op.content;
      applied++;
      continue;
    }
    if (!content) continue;
    if (!content.includes(op.old)) continue;
    content = content.replace(op.old, op.new);
    applied++;
  }
  return { content, applied, ops: ops.length };
}

for (const rel of REPLAY_FILES) {
  const { content, applied, ops } = replay(rel);
  if (!content) {
    console.log("SKIP (no write baseline)", rel);
    continue;
  }
  fs.mkdirSync(path.dirname(toOut(rel)), { recursive: true });
  fs.writeFileSync(toOut(rel), content, "utf8");
  console.log("REPLAY", rel, `${applied}/${ops} ops`, content.length, "bytes");
}

function lastWrite(transcriptPath, rel) {
  const lines = fs.readFileSync(transcriptPath, "utf8").split("\n");
  let found = null;
  for (let i = 0; i < lines.length; i++) {
    let obj;
    try {
      obj = JSON.parse(lines[i]);
    } catch {
      continue;
    }
    if (obj.role !== "assistant") continue;
    for (const part of obj.message?.content ?? []) {
      if (part.type !== "tool_use" || part.name !== "Write") continue;
      const p = part.input?.path?.replace(/\\/g, "/").replace(/^D:[/]OnCourt Rankings PH[/]/i, "");
      if (relKey(p) !== rel.toLowerCase()) continue;
      found = { line: i + 1, content: part.input.contents ?? part.input.content };
    }
  }
  return found;
}

for (const rel of WRITE_ONLY_ADMIN) {
  const w = lastWrite(adminTranscript, rel);
  if (!w) {
    console.log("ADMIN NO WRITE", rel);
    continue;
  }
  fs.mkdirSync(path.dirname(toOut(rel)), { recursive: true });
  fs.writeFileSync(toOut(rel), w.content, "utf8");
  console.log("ADMIN WRITE", rel, `L${w.line}`, w.content.length, "bytes");
}
