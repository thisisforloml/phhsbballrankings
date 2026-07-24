import { VerificationStatus } from "@prisma/client";
import fs from "node:fs/promises";
import path from "node:path";

import { inferCompetitionGender } from "../src/lib/competition-naming";
import { prisma } from "../src/lib/prisma";
import { getTeamDisplayName } from "../src/lib/uaap-school-display";

const officialStatuses = [VerificationStatus.SUBMITTED, VerificationStatus.VERIFIED];

function competitionAgeLabel(name: string, fallback: string) {
  const normalized = name.toUpperCase();
  const match = normalized.match(/\bU(1[0-9])\b|\b(1[0-9])U\b/);
  return match ? `U${match[1] ?? match[2]}` : fallback;
}

async function main() {
  const teams = await prisma.team.findMany({
    where: { deletedAt: null, programId: { not: null } },
    select: {
      id: true,
      name: true,
      programId: true,
      program: { select: { fullName: true } },
      rosterSeasons: { where: { deletedAt: null }, select: { id: true, seasonId: true } },
      gameStats: {
        where: { deletedAt: null, game: { deletedAt: null, verificationStatus: { in: officialStatuses } } },
        select: { gameId: true },
      },
      homeGames: {
        where: { deletedAt: null, verificationStatus: { in: officialStatuses } },
        select: { id: true, gameNumber: true, seasonId: true, season: { select: { name: true, league: { select: { name: true, ageGroup: true } } } } },
      },
      awayGames: {
        where: { deletedAt: null, verificationStatus: { in: officialStatuses } },
        select: { id: true, gameNumber: true, seasonId: true, season: { select: { name: true, league: { select: { name: true, ageGroup: true } } } } },
      },
    },
    orderBy: [{ program: { fullName: "asc" } }, { name: "asc" }],
  });

  const plans = teams.flatMap((team) => {
    const games = [...team.homeGames, ...team.awayGames];
    const contexts = new Map<string, {
      competition: string;
      season: string;
      ageGroup: string;
      publicAgeLabel: string;
      gender: string;
      seasonIds: Set<string>;
      gameIds: string[];
      gameRefs: string[];
    }>();

    for (const game of games) {
      const gender = inferCompetitionGender(undefined, game.season.league.name);
      const publicAgeLabel = competitionAgeLabel(game.season.league.name, game.season.league.ageGroup);
      const key = `${game.season.league.ageGroup}|${publicAgeLabel}|${gender}`;
      const context = contexts.get(key) ?? {
        competition: game.season.league.name,
        season: game.season.name,
        ageGroup: game.season.league.ageGroup,
        publicAgeLabel,
        gender,
        seasonIds: new Set<string>(),
        gameIds: [],
        gameRefs: [],
      };
      context.seasonIds.add(game.seasonId);
      context.gameIds.push(game.id);
      if (game.gameNumber) context.gameRefs.push(game.gameNumber);
      contexts.set(key, context);
    }

    if (contexts.size <= 1) return [];
    const baseName = getTeamDisplayName(team.name);
    const statCountByGame = new Map<string, number>();
    for (const stat of team.gameStats) statCountByGame.set(stat.gameId, (statCountByGame.get(stat.gameId) ?? 0) + 1);

    return [{
      status: "NEEDS_APPROVAL",
      program: { id: team.programId, name: team.program?.fullName ?? "Unknown" },
      sourceTeam: {
        id: team.id,
        name: team.name,
        activeRosterRows: team.rosterSeasons.length,
        officialGames: games.length,
        officialGameStats: team.gameStats.length,
      },
      reason: "One Team record is referenced by multiple age/gender competition contexts.",
      proposedTeams: Array.from(contexts.values()).map((context) => ({
        proposedName: `${baseName} ${context.publicAgeLabel}${context.gender === "GIRLS" ? " Girls" : ""}`,
        competition: context.competition,
        season: context.season,
        ageGroup: context.ageGroup,
        publicAgeLabel: context.publicAgeLabel,
        gender: context.gender,
        seasonIds: Array.from(context.seasonIds).sort(),
        gameIds: context.gameIds.sort(),
        gameRefs: context.gameRefs.sort(),
        gameStats: context.gameIds.reduce((sum, gameId) => sum + (statCountByGame.get(gameId) ?? 0), 0),
      })),
      allowedFutureRepair: ["create/reuse one Team per listed context", "update PlayerTeamSeason.teamId when season context matches", "update Game.homeTeamId/Game.awayTeamId and GameStat.teamId only for listed games"],
      forbidden: ["cross-program moves", "cross-gender moves", "player/stat/rating/snapshot changes", "deleting the source Team before all references are zero"],
    }];
  });

  const report = {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    summary: { activeTeamsInspected: teams.length, mixedContextTeams: plans.length },
    plans,
  };
  const reportDir = path.join(process.cwd(), "scripts", "reports");
  await fs.mkdir(reportDir, { recursive: true });
  await fs.writeFile(path.join(reportDir, "split-multi-context-teams-plan.json"), `${JSON.stringify(report, null, 2)}\n`);
  const lines = [
    "# Multi-context Team Split Plan", "", `Generated: ${report.generatedAt}`, "", "Read-only. No records were changed.", "",
    `- Active Teams inspected: ${report.summary.activeTeamsInspected}`,
    `- Mixed-context Teams: ${report.summary.mixedContextTeams}`, "",
    ...plans.flatMap((plan) => [
      `## ${plan.program.name}: ${plan.sourceTeam.name}`, "",
      `- Status: ${plan.status}`,
      `- Program ID: ${plan.program.id}`,
      `- Source Team ID: ${plan.sourceTeam.id}`,
      `- Current references: ${plan.sourceTeam.officialGames} games, ${plan.sourceTeam.officialGameStats} GameStats, ${plan.sourceTeam.activeRosterRows} roster rows`, "",
      ...plan.proposedTeams.flatMap((target) => [
        `### ${target.proposedName}`, "",
        `- Context: ${target.competition} / ${target.season} / ${target.ageGroup} / ${target.gender}`,
        `- Games: ${target.gameRefs.join(", ") || target.gameIds.join(", ")}`,
        `- GameStats: ${target.gameStats}`, "",
      ]),
    ]),
  ];
  await fs.writeFile(path.join(reportDir, "split-multi-context-teams-plan.md"), `${lines.join("\n")}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());