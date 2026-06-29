const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const repoRoot = "D:/OnCourt Rankings PH";
const adminTranscript =
  "C:/Users/DECK/.cursor/projects/d-OnCourt-Rankings-PH/agent-transcripts/08f3052e-24ab-4cde-887e-f3022c77b2ca/08f3052e-24ab-4cde-887e-f3022c77b2ca.jsonl";
const subTranscript =
  "C:/Users/DECK/.cursor/projects/d-OnCourt-Rankings-PH/agent-transcripts/486fd252-c23d-48a2-a1dd-4c9fa4fde99c/subagents/6fb7e4be-4a13-4dd3-a86f-98108f69a153.jsonl";

function replayStrReplace(transcriptPath, relMatch, startContent) {
  let content = startContent;
  let applied = 0;
  for (const line of fs.readFileSync(transcriptPath, "utf8").split("\n")) {
    if (!line.trim()) continue;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    if (obj.role !== "assistant") continue;
    for (const part of obj.message?.content ?? []) {
      if (part.type !== "tool_use" || part.name !== "StrReplace" || !part.input?.path) continue;
      if (!relMatch.test(part.input.path.replace(/\\/g, "/"))) continue;
      if (!content.includes(part.input.old_string)) continue;
      content = content.replace(part.input.old_string, part.input.new_string);
      applied++;
    }
  }
  return { content, applied };
}

function latestWrite(transcriptPath, relMatch) {
  let found = null;
  for (const line of fs.readFileSync(transcriptPath, "utf8").split("\n")) {
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
      if (!relMatch.test(part.input.path.replace(/\\/g, "/"))) continue;
      found = part.input.contents ?? part.input.content;
    }
  }
  return found;
}

// url-import-actions: Write + admin StrReplace chain
{
  const write = latestWrite(adminTranscript, /url-import-actions\.ts$/i);
  const replay = replayStrReplace(adminTranscript, /url-import-actions\.ts$/i, write);
  fs.writeFileSync(
    path.join(repoRoot, "src/app/admin/tools/submissions/url-import-actions.ts"),
    replay.content
  );
  console.log("url-import-actions sr", replay.applied);
}

// submissions actions from subagent StrReplace on git baseline
{
  let content = execSync('git show HEAD:"src/app/admin/submissions/actions.ts"', {
    cwd: repoRoot,
    encoding: "utf8",
  });
  const replay = replayStrReplace(subTranscript, /submissions\/actions\.ts$/i, content);
  const adminReplay = replayStrReplace(adminTranscript, /submissions\/actions\.ts$/i, replay.content);
  fs.writeFileSync(path.join(repoRoot, "src/app/admin/submissions/actions.ts"), adminReplay.content);
  console.log("submissions/actions sr", replay.applied + adminReplay.applied);
}

// SimplifiedSubmissionReview from git + subagent sr
{
  let content = execSync('git show HEAD:"src/app/admin/submissions/[id]/SimplifiedSubmissionReview.tsx"', {
    cwd: repoRoot,
    encoding: "utf8",
  });
  const replay = replayStrReplace(subTranscript, /SimplifiedSubmissionReview\.tsx$/i, content);
  const adminReplay = replayStrReplace(adminTranscript, /SimplifiedSubmissionReview\.tsx$/i, replay.content);
  fs.writeFileSync(
    path.join(repoRoot, "src/app/admin/submissions/[id]/SimplifiedSubmissionReview.tsx"),
    adminReplay.content
  );
  console.log("SimplifiedSubmissionReview sr", replay.applied + adminReplay.applied);
}

// HeroSection from git + main transcript sr (lines in 486fd252 before 691)
{
  let content = execSync('git show HEAD:"src/components/sections/HeroSection.tsx"', {
    cwd: repoRoot,
    encoding: "utf8",
  });
  const main =
    "C:/Users/DECK/.cursor/projects/d-OnCourt-Rankings-PH/agent-transcripts/486fd252-c23d-48a2-a1dd-4c9fa4fde99c/486fd252-c23d-48a2-a1dd-4c9fa4fde99c.jsonl";
  const lines = fs.readFileSync(main, "utf8").split("\n");
  let applied = 0;
  for (let i = 0; i < 691 && i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    if (obj.role !== "assistant") continue;
    for (const part of obj.message?.content ?? []) {
      if (part.type !== "tool_use" || part.name !== "StrReplace" || !part.input?.path) continue;
      if (!/HeroSection\.tsx$/i.test(part.input.path.replace(/\\/g, "/"))) continue;
      if (!content.includes(part.input.old_string)) continue;
      content = content.replace(part.input.old_string, part.input.new_string);
      applied++;
    }
  }
  fs.writeFileSync(path.join(repoRoot, "src/components/sections/HeroSection.tsx"), content);
  console.log("HeroSection sr", applied);
}

// player-profile from git + main sr before 691
{
  let content = execSync('git show HEAD:"src/lib/player-profile.ts"', { cwd: repoRoot, encoding: "utf8" });
  const main =
    "C:/Users/DECK/.cursor/projects/d-OnCourt-Rankings-PH/agent-transcripts/486fd252-c23d-48a2-a1dd-4c9fa4fde99c/486fd252-c23d-48a2-a1dd-4c9fa4fde99c.jsonl";
  const replay = replayStrReplace(main, /player-profile\.ts$/i, content);
  fs.writeFileSync(path.join(repoRoot, "src/lib/player-profile.ts"), replay.content);
  console.log("player-profile sr", replay.applied);
}

console.log("done");
