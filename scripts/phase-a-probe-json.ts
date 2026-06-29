import { prisma } from "../src/lib/prisma";
import { safeParseSubmissionJson } from "../src/lib/submission-json";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}
function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

async function main() {
  const subs = await prisma.submission.findMany({
    where: { status: "IMPORTED", deletedAt: null },
    select: { id: true, title: true, rawText: true, parsedPreview: true },
  });

  let games = 0;
  let playerRows = 0;
  let parseOk = 0;
  let parseFail = 0;
  const structures: string[] = [];

  for (const s of subs) {
    const parsed = safeParseSubmissionJson(s);
    if (!parsed.ok) {
      parseFail++;
      continue;
    }
    parseOk++;
    const root = parsed.data;
    const packages = Array.isArray(root) ? root : [root];
    for (const pkg of packages) {
      const rec = asRecord(pkg);
      if (!rec) continue;
      const topKeys = Object.keys(rec).slice(0, 8).join(",");
      if (!structures.includes(topKeys)) structures.push(topKeys);
      for (const game of asArray(rec.games)) {
        const g = asRecord(game);
        if (!g) continue;
        games++;
        playerRows += asArray(g.players).length;
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        submissions: subs.length,
        parseOk,
        parseFail,
        submissionJsonGames: games,
        submissionJsonPlayerRows: playerRows,
        sampleTopKeys: structures,
      },
      null,
      2,
    ),
  );
}

main().finally(() => prisma.$disconnect());
