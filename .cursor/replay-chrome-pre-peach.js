const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const repoRoot = "D:/OnCourt Rankings PH";
const transcript =
  "C:/Users/DECK/.cursor/projects/d-OnCourt-Rankings-PH/agent-transcripts/eb44faa5-fbd3-4702-9cde-1009b18e8795/eb44faa5-fbd3-4702-9cde-1009b18e8795.jsonl";
const MAX_LINE = 294;

const files = [
  "src/components/layout/Navbar.tsx",
  "src/components/layout/Footer.tsx",
  "src/components/layout/AppChrome.tsx",
  "src/app/layout.tsx",
  "src/components/auth/AuthContext.tsx",
  "src/lib/portal-auth.ts",
  "src/app/login/page.tsx",
  "src/app/register/page.tsx",
  "src/app/portal/login/page.tsx",
  "src/components/sections/RatingExplainer.tsx",
];

function normRel(p) {
  return p
    .replace(/\\/g, "/")
    .replace(/^D:[/]OnCourt Rankings PH[/]/i, "")
    .toLowerCase();
}

function gitShow(relPath) {
  try {
    return execSync(`git show HEAD:"${relPath}"`, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    });
  } catch {
    return null;
  }
}

const lines = fs.readFileSync(transcript, "utf8").split("\n");

for (const rel of files) {
  let content = gitShow(rel);
  let applied = 0;
  let missed = 0;

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

  if (!content) {
    console.log(rel, "SKIP no content");
    continue;
  }
  fs.writeFileSync(path.join(repoRoot, rel), content, "utf8");
  console.log(
    rel,
    "bytes",
    content.length,
    "applied",
    applied,
    "missed",
    missed,
    "peach",
    /peach/i.test(content),
    "oncourt",
    /oncourt/i.test(content)
  );
}
