const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const repoRoot = "D:/OnCourt Rankings PH";
const transcript =
  "C:/Users/DECK/.cursor/projects/d-OnCourt-Rankings-PH/agent-transcripts/eb44faa5-fbd3-4702-9cde-1009b18e8795/eb44faa5-fbd3-4702-9cde-1009b18e8795.jsonl";
const mainTranscript =
  "C:/Users/DECK/.cursor/projects/d-OnCourt-Rankings-PH/agent-transcripts/486fd252-c23d-48a2-a1dd-4c9fa4fde99c/486fd252-c23d-48a2-a1dd-4c9fa4fde99c.jsonl";

const TARGET = "src/components/sections/HeroSection.tsx";
const EB44_MAX = 294;
const MAIN_MAX = 691;

function normRel(p) {
  return p.replace(/\\/g, "/").replace(/^D:[/]OnCourt Rankings PH[/]/i, "").toLowerCase();
}

function gitShow(rel) {
  try {
    return execSync(`git show HEAD:"${rel}"`, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"]
    });
  } catch {
    return null;
  }
}

function collectOps(transcriptPath, maxLine) {
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
      if (normRel(part.input.path) !== TARGET.toLowerCase()) continue;
      if (part.name === "Write" && (part.input.contents ?? part.input.content) != null) {
        ops.push({ kind: "write", line: i + 1, content: part.input.contents ?? part.input.content });
      } else if (part.name === "StrReplace") {
        ops.push({
          kind: "sr",
          line: i + 1,
          old: part.input.old_string,
          new: part.input.new_string
        });
      }
    }
  }
  return ops;
}

function replay(ops, label) {
  let content = gitShow(TARGET);
  let applied = 0;
  let missed = 0;
  for (const op of ops) {
    if (op.kind === "write") {
      content = op.content;
      applied++;
      continue;
    }
    if (!content || !content.includes(op.old)) {
      missed++;
      continue;
    }
    content = content.replace(op.old, op.new);
    applied++;
  }
  return { content, applied, missed, label };
}

const mainOps = collectOps(mainTranscript, MAIN_MAX);
const eb44Ops = collectOps(transcript, EB44_MAX);

let { content, applied, missed } = replay(mainOps, "main");
const eb44 = replay(eb44Ops, "eb44");
if (eb44.applied > 0) {
  // Continue from main result if eb44 has later ops
  let c = content;
  let a = 0;
  let m = 0;
  for (const op of eb44Ops) {
    if (op.kind === "write") {
      c = op.content;
      a++;
      continue;
    }
    if (!c || !c.includes(op.old)) {
      m++;
      continue;
    }
    c = c.replace(op.old, op.new);
    a++;
  }
  content = c;
  applied += a;
  missed += m;
}

const out = path.join(repoRoot, TARGET);
fs.writeFileSync(out, content, "utf8");
console.log("HeroSection restored:", content.length, "bytes");
console.log("applied", applied, "missed", missed);
console.log("has Elevating:", content.includes("Elevating PH Basketball Through Data"));
console.log("has recruiting:", content.includes("recruiting board"));
