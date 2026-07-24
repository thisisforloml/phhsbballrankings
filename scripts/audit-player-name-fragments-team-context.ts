import { VerificationStatus } from "@prisma/client";
import fs from "node:fs/promises";
import path from "node:path";

import { prisma } from "../src/lib/prisma";

const officialStatuses = [VerificationStatus.SUBMITTED, VerificationStatus.VERIFIED];

function tokens(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
}

function subset(left: string[], right: string[]) {
  const values = new Set(right);
  return left.every((value) => values.has(value));
}

function overlap(left: string[], right: string[]) {
  const values = new Set(right);
  return new Set(left.filter((value) => values.has(value))).size;
}

async function main() {
  const players = await prisma.player.findMany({
    where: { deletedAt: null },
    select: {
      id: true, displayName: true, gender: true, birthDate: true, currentProgramId: true,
      currentProgram: { select: { fullName: true } },
      aliases: { select: { aliasName: true } },
      gameStats: {
        where: { deletedAt: null, game: { deletedAt: null, verificationStatus: { in: officialStatuses } } },
        select: { teamId: true, gameId: true, game: { select: { season: { select: { leagueId: true } } } } },
      },
    },
    orderBy: { displayName: "asc" },
  });

  const candidates = [];
  for (let i = 0; i < players.length; i += 1) {
    for (let j = i + 1; j < players.length; j += 1) {
      const left = players[i];
      const right = players[j];
      if (left.gender !== right.gender) continue;
      const leftTokens = tokens(left.displayName);
      const rightTokens = tokens(right.displayName);
      if (leftTokens.length < 2 || rightTokens.length < 2) continue;
      if (leftTokens[0] !== rightTokens[0] || leftTokens.at(-1) !== rightTokens.at(-1)) continue;
      if (!subset(leftTokens, rightTokens) && !subset(rightTokens, leftTokens)) continue;

      const sameProgram = Boolean(left.currentProgramId && left.currentProgramId === right.currentProgramId);
      const sharedTeams = overlap(left.gameStats.map((row) => row.teamId), right.gameStats.map((row) => row.teamId));
      const sharedLeagues = overlap(left.gameStats.map((row) => row.game.season.leagueId), right.gameStats.map((row) => row.game.season.leagueId));
      const sameBirthDate = Boolean(left.birthDate && right.birthDate && left.birthDate.getTime() === right.birthDate.getTime());
      const conflictingBirthDate = Boolean(left.birthDate && right.birthDate && left.birthDate.getTime() !== right.birthDate.getTime());
      const evidenceScore = (sameProgram ? 3 : 0) + (sharedTeams ? 3 : 0) + (sharedLeagues ? 1 : 0) + (sameBirthDate ? 4 : 0) - (conflictingBirthDate ? 5 : 0);

      candidates.push({
        status: evidenceScore >= 6 ? "HIGH_CONFIDENCE_REVIEW" : evidenceScore >= 3 ? "POSSIBLE_REVIEW" : "LOW_CONFIDENCE",
        evidenceScore,
        left: { id: left.id, displayName: left.displayName, program: left.currentProgram?.fullName ?? null, gameCount: new Set(left.gameStats.map((row) => row.gameId)).size, aliases: left.aliases.map((row) => row.aliasName) },
        right: { id: right.id, displayName: right.displayName, program: right.currentProgram?.fullName ?? null, gameCount: new Set(right.gameStats.map((row) => row.gameId)).size, aliases: right.aliases.map((row) => row.aliasName) },
        evidence: { sameProgram, sharedTeams, sharedLeagues, sameBirthDate, conflictingBirthDate },
      });
    }
  }
  candidates.sort((left, right) => right.evidenceScore - left.evidenceScore);

  const smilePrograms = await prisma.program.findMany({
    where: { deletedAt: null, fullName: { contains: "Smile 360", mode: "insensitive" } },
    select: {
      id: true, fullName: true,
      teams: {
        where: { deletedAt: null },
        select: {
          id: true, name: true,
          rosterSeasons: { where: { deletedAt: null }, select: { id: true } },
          gameStats: {
            where: { deletedAt: null, game: { deletedAt: null, verificationStatus: { in: officialStatuses } } },
            select: { gameId: true, game: { select: { gameNumber: true, season: { select: { name: true, league: { select: { name: true, ageGroup: true } } } } } } },
          },
          homeGames: { where: { deletedAt: null, verificationStatus: { in: officialStatuses } }, select: { id: true } },
          awayGames: { where: { deletedAt: null, verificationStatus: { in: officialStatuses } }, select: { id: true } },
        },
      },
    },
  });

  const smile360 = smilePrograms.map((program) => ({
    id: program.id, fullName: program.fullName,
    teams: program.teams.map((team) => ({
      id: team.id, name: team.name,
      activeRosterRows: team.rosterSeasons.length,
      officialGames: team.homeGames.length + team.awayGames.length,
      officialGameStats: team.gameStats.length,
      contexts: Array.from(new Set(team.gameStats.map((row) => `${row.game.season.league.name} | ${row.game.season.name} | ${row.game.season.league.ageGroup}`))).sort(),
      gameRefs: Array.from(new Set(team.gameStats.map((row) => row.game.gameNumber).filter((value): value is string => Boolean(value)))).sort(),
    })),
  }));

  const summary = {
    total: candidates.length,
    highConfidenceReview: candidates.filter((row) => row.status === "HIGH_CONFIDENCE_REVIEW").length,
    possibleReview: candidates.filter((row) => row.status === "POSSIBLE_REVIEW").length,
    lowConfidence: candidates.filter((row) => row.status === "LOW_CONFIDENCE").length,
  };
  const report = { generatedAt: new Date().toISOString(), readOnly: true, playerCandidateSummary: summary, playerCandidates: candidates, smile360 };
  const reportDir = path.join(process.cwd(), "scripts", "reports");
  await fs.mkdir(reportDir, { recursive: true });
  await fs.writeFile(path.join(reportDir, "player-name-fragments-team-context.json"), `${JSON.stringify(report, null, 2)}\n`);

  const lines = [
    "# Player Name Fragment and Team Context Audit", "", `Generated: ${report.generatedAt}`, "",
    "Read-only audit. No records were changed.", "", "## Player candidate summary", "",
    `- Total token-subset candidates: ${summary.total}`,
    `- High-confidence review: ${summary.highConfidenceReview}`,
    `- Possible review: ${summary.possibleReview}`,
    `- Low-confidence: ${summary.lowConfidence}`, "", "## Candidate pairs", "",
    ...candidates.flatMap((row) => [
      `### ${row.left.displayName} / ${row.right.displayName}`, "",
      `- Status: ${row.status}`,
      `- IDs: ${row.left.id} / ${row.right.id}`,
      `- Programs: ${row.left.program ?? "None"} / ${row.right.program ?? "None"}`,
      `- Official games: ${row.left.gameCount} / ${row.right.gameCount}`,
      `- Evidence: sameProgram=${row.evidence.sameProgram}, sharedTeams=${row.evidence.sharedTeams}, sharedLeagues=${row.evidence.sharedLeagues}, sameBirthDate=${row.evidence.sameBirthDate}, conflictingBirthDate=${row.evidence.conflictingBirthDate}`, "",
    ]),
    "## Smile 360 team context", "",
    ...smile360.flatMap((program) => [
      `### ${program.fullName} (${program.id})`, "",
      ...program.teams.flatMap((team) => [
        `- ${team.name} (${team.id}): ${team.officialGames} games, ${team.officialGameStats} GameStats, ${team.activeRosterRows} roster rows`,
        `  - Contexts: ${team.contexts.join("; ") || "None"}`,
        `  - Game refs: ${team.gameRefs.join(", ") || "None"}`,
      ]), "",
    ]),
  ];
  await fs.writeFile(path.join(reportDir, "player-name-fragments-team-context.md"), `${lines.join("\n")}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
