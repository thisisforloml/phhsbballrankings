const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const repoRoot = "D:/OnCourt Rankings PH";
const transcript =
  "C:/Users/DECK/.cursor/projects/d-OnCourt-Rankings-PH/agent-transcripts/486fd252-c23d-48a2-a1dd-4c9fa4fde99c/486fd252-c23d-48a2-a1dd-4c9fa4fde99c.jsonl";
const rel = "src/lib/public-site-data.ts";

let content;
try {
  content = execSync(`git show HEAD:"${rel}"`, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "ignore"],
  });
} catch {
  content = fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

let applied = 0;
let missed = 0;

for (const line of fs.readFileSync(transcript, "utf8").split("\n")) {
  try {
    const obj = JSON.parse(line);
    if (obj.role !== "assistant") continue;
    for (const part of obj.message?.content ?? []) {
      if (part.type !== "tool_use" || !String(part.input?.path || "").includes("public-site-data.ts")) continue;
      if (part.name === "Write" && (part.input.contents ?? part.input.content) != null) {
        content = part.input.contents ?? part.input.content;
        applied++;
      } else if (part.name === "StrReplace") {
        if (!content.includes(part.input.old_string)) {
          missed++;
          continue;
        }
        content = content.replace(part.input.old_string, part.input.new_string);
        applied++;
      }
    }
  } catch {
    // skip
  }
}

// Keep VerificationStatus import fix
if (content.includes("VerificationStatus.SUBMITTED") && !content.includes("VerificationStatus")) {
  content = content.replace(
    'import { AgeGroup, PlayerGender } from "@prisma/client";',
    'import { AgeGroup, PlayerGender, VerificationStatus } from "@prisma/client";'
  );
}

fs.writeFileSync(path.join(repoRoot, rel), content, "utf8");
console.log(
  "len",
  content.length,
  "applied",
  applied,
  "missed",
  missed,
  "leaderboardsByAge",
  content.includes("leaderboardsByAge"),
  "teamPreview",
  content.includes("teamPreview")
);
