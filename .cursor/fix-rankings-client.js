const fs = require("fs");
const t =
  "C:/Users/DECK/.cursor/projects/d-OnCourt-Rankings-PH/agent-transcripts/486fd252-c23d-48a2-a1dd-4c9fa4fde99c/486fd252-c23d-48a2-a1dd-4c9fa4fde99c.jsonl";
let content = null;
for (const [i, line] of fs.readFileSync(t, "utf8").split("\n").entries()) {
  if (i >= 691) break;
  let obj;
  try {
    obj = JSON.parse(line);
  } catch {
    continue;
  }
  for (const part of obj.message?.content ?? []) {
    if (part.name === "Write" && part.input?.path?.includes("RankingsClient")) {
      content = part.input.contents;
    }
    if (
      part.name === "StrReplace" &&
      part.input?.path?.includes("RankingsClient") &&
      content?.includes(part.input.old_string)
    ) {
      content = content.replace(part.input.old_string, part.input.new_string);
    }
  }
}
content = content.replace(/^import \{ RECRUITING_CLASS_FILTER_ENABLED \} from "@\/lib\/public-rankings-coverage";\s*/, "");
if (!content.startsWith('"use client"')) content = `"use client";\n\n${content}`;
if (!content.includes("RankingsCoverageNotice")) {
  content = content.replace(
    "import { SectionHeader }",
    'import { RankingsCoverageNotice } from "@/components/public/RankingsCoverageNotice";\nimport { SectionHeader }'
  );
}
if (!content.includes("const ageGroups")) {
  content = content.replace("const genders =", "const ageGroups = PUBLIC_AGE_GROUPS;\nconst genders =");
}
if (!content.includes("PUBLIC_AGE_GROUPS")) {
  content = content.replace(
    "publicRankingsCoverageCopy, RECRUITING_CLASS_FILTER_ENABLED",
    "publicRankingsCoverageCopy, PUBLIC_AGE_GROUPS, RECRUITING_CLASS_FILTER_ENABLED"
  );
}
content = content.replace(/sanitizeClassYearForAgeGroup,\s*/, "");
fs.writeFileSync("D:/OnCourt Rankings PH/src/app/rankings/RankingsClient.tsx", content);
console.log("RankingsClient", content.length);
