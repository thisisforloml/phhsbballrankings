const fs = require("fs");
const { execSync } = require("child_process");

const repoRoot = "D:/OnCourt Rankings PH";
const main =
  "C:/Users/DECK/.cursor/projects/d-OnCourt-Rankings-PH/agent-transcripts/486fd252-c23d-48a2-a1dd-4c9fa4fde99c/486fd252-c23d-48a2-a1dd-4c9fa4fde99c.jsonl";

function replay(rel, maxLine = 691) {
  let content = execSync(`git show HEAD:"${rel}"`, { cwd: repoRoot, encoding: "utf8" });
  const ops = [];
  for (const [i, line] of fs.readFileSync(main, "utf8").split("\n").entries()) {
    if (i >= maxLine || !line.trim()) continue;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    if (obj.role !== "assistant") continue;
    for (const part of obj.message?.content ?? []) {
      if (part.type !== "tool_use" || part.name !== "StrReplace" || !part.input?.path) continue;
      if (!part.input.path.replace(/\\/g, "/").toLowerCase().includes(`/${rel.replace(/\\/g, "/").toLowerCase()}`)) continue;
      ops.push({ old: part.input.old_string, new: part.input.new_string });
    }
  }
  let total = 0;
  for (let pass = 0; pass < 10; pass++) {
    let applied = 0;
    for (const op of ops) {
      if (!content.includes(op.old)) continue;
      content = content.replace(op.old, op.new);
      applied++;
      total++;
    }
    if (!applied) break;
  }
  fs.writeFileSync(`${repoRoot}/${rel}`, content);
  console.log(rel, total, "replacements", content.length);
  return content;
}

replay("src/lib/player-profile.ts");
let hero = replay("src/components/sections/HeroSection.tsx");
if (!hero.includes("RatingBadge")) {
  hero = hero.replace(
    'import { StarRating } from "@/components/ui";',
    'import { RatingBadge, StarRating } from "@/components/ui";'
  );
}
hero = hero.replace(/^import \{ StarRating \} from "@\/components\/ui";[^\n]*\n/, "");
if (!hero.startsWith('"use client"')) hero = `"use client";\n\n${hero.replace(/^"use client";\s*/, "")}`;
fs.writeFileSync(`${repoRoot}/src/components/sections/HeroSection.tsx`, hero);
