import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { VerificationStatus } from "@prisma/client";

import { inferCompetitionGender } from "../src/lib/competition-naming";
import { prisma } from "../src/lib/prisma";
import { buildContextualTeamName, inferCompetitionAgeLabel } from "../src/lib/team-context-name";
import { getTeamDisplayName } from "../src/lib/uaap-school-display";

const officialStatuses = [VerificationStatus.SUBMITTED, VerificationStatus.VERIFIED];

function stableFingerprint(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function main() {
  const teams = await prisma.team.findMany({
    where: { deletedAt: null, programId: { not: null } },
    select: {
      id: true,
      name: true,
      city: true,
      region: true,
      logoUrl: true,
      programId: true,
      program: { select: { fullName: true } },
      rosterSeasons: { where: { deletedAt: null }, select: { id: true, seasonId: true } },
      teamRatings: { select: { id: true, seasonId: true } },
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

  const activeTeamByProgramAndName = new Map(
    teams.map((team) => [`${team.programId}:${team.name.toLocaleLowerCase()}`, team]),
  );

  const plans = teams.flatMap((team) => {
    const games = [...team.homeGames, ...team.awayGames];
    const contexts = new Map<string, {
      contextKey: string;
      competitionNames: Set<string>;
      seasonNames: Set<string>;
      ageGroup: string;
      publicAgeLabel: string;
      gender: string;
      seasonIds: Set<string>;
      gameIds: string[];
      gameRefs: string[];
    }>();

    for (const game of games) {
      const gender = inferCompetitionGender(undefined, game.season.league.name);
      const publicAgeLabel = inferCompetitionAgeLabel(game.season.league.name, game.season.league.ageGroup);
      const contextKey = `${publicAgeLabel}|${gender}`;
      const context = contexts.get(contextKey) ?? {
        contextKey,
        competitionNames: new Set<string>(),
        seasonNames: new Set<string>(),
        ageGroup: game.season.league.ageGroup,
        publicAgeLabel,
        gender,
        seasonIds: new Set<string>(),
        gameIds: [],
        gameRefs: [],
      };
      context.competitionNames.add(game.season.league.name);
      context.seasonNames.add(game.season.name);
      context.seasonIds.add(game.seasonId);
      context.gameIds.push(game.id);
      if (game.gameNumber) context.gameRefs.push(game.gameNumber);
      contexts.set(contextKey, context);
    }

    if (contexts.size <= 1) return [];

    const baseName = getTeamDisplayName(team.name);
    const statCountByGame = new Map<string, number>();
    for (const stat of team.gameStats) statCountByGame.set(stat.gameId, (statCountByGame.get(stat.gameId) ?? 0) + 1);

    const orderedContexts = Array.from(contexts.values()).sort(
      (left, right) => right.gameIds.length - left.gameIds.length || left.contextKey.localeCompare(right.contextKey),
    );
    const retainedContextKey = orderedContexts[0]!.contextKey;
    const blockers: string[] = [];
    const allContextSeasonIds = new Set(orderedContexts.flatMap((context) => Array.from(context.seasonIds)));
    const unmatchedRosterRows = team.rosterSeasons.filter((row) => !allContextSeasonIds.has(row.seasonId));
    const unmatchedRatings = team.teamRatings.filter((row) => !allContextSeasonIds.has(row.seasonId));
    if (unmatchedRosterRows.length) blockers.push(`${unmatchedRosterRows.length} active roster rows are outside the official context seasons.`);
    if (unmatchedRatings.length) blockers.push(`${unmatchedRatings.length} TeamRating rows are outside the official context seasons.`);

    const proposedTeams = orderedContexts.map((context) => {
      const proposedName = buildContextualTeamName(baseName, context.publicAgeLabel, context.gender);
      const existingTarget = activeTeamByProgramAndName.get(`${team.programId}:${proposedName.toLocaleLowerCase()}`);
      const retainsSourceTeam = context.contextKey === retainedContextKey;
      if (existingTarget && existingTarget.id !== team.id) {
        blockers.push(`Target Team already exists and requires a separate consolidation review: ${proposedName} (${existingTarget.id}).`);
      }
      const seasonIds = Array.from(context.seasonIds).sort();
      return {
        contextKey: context.contextKey,
        proposedName,
        competitionNames: Array.from(context.competitionNames).sort(),
        seasonNames: Array.from(context.seasonNames).sort(),
        ageGroup: context.ageGroup,
        publicAgeLabel: context.publicAgeLabel,
        gender: context.gender,
        seasonIds,
        gameIds: context.gameIds.sort(),
        gameRefs: context.gameRefs.sort(),
        gameStats: context.gameIds.reduce((sum, gameId) => sum + (statCountByGame.get(gameId) ?? 0), 0),
        rosterRowIds: team.rosterSeasons.filter((row) => context.seasonIds.has(row.seasonId)).map((row) => row.id).sort(),
        teamRatingIds: team.teamRatings.filter((row) => context.seasonIds.has(row.seasonId)).map((row) => row.id).sort(),
        retainsSourceTeam,
        existingTargetTeamId: existingTarget && existingTarget.id !== team.id ? existingTarget.id : null,
      };
    });

    const fingerprintInput = {
      programId: team.programId,
      sourceTeamId: team.id,
      sourceTeamName: team.name,
      retainedContextKey,
      proposedTeams: proposedTeams.map((target) => ({
        contextKey: target.contextKey,
        proposedName: target.proposedName,
        seasonIds: target.seasonIds,
        gameIds: target.gameIds,
        rosterRowIds: target.rosterRowIds,
        teamRatingIds: target.teamRatingIds,
        retainsSourceTeam: target.retainsSourceTeam,
        existingTargetTeamId: target.existingTargetTeamId,
      })),
    };

    return [{
      status: blockers.length ? "NEEDS_REVIEW" : "EXECUTE_READY",
      fingerprint: stableFingerprint(fingerprintInput),
      retainedContextKey,
      blockers,
      program: { id: team.programId!, name: team.program?.fullName ?? "Unknown" },
      sourceTeam: {
        id: team.id,
        name: team.name,
        city: team.city,
        region: team.region,
        logoUrl: team.logoUrl,
        activeRosterRows: team.rosterSeasons.length,
        officialGames: games.length,
        officialGameStats: team.gameStats.length,
        teamRatings: team.teamRatings.length,
      },
      reason: "One Team record is referenced by multiple age/gender competition contexts.",
      proposedTeams,
      allowedRepair: [
        "retain and rename the source Team for the dominant context",
        "create one Team for each additional exact context",
        "update PlayerTeamSeason.teamId only for listed season rows",
        "update Game.homeTeamId/Game.awayTeamId and GameStat.teamId only for listed games",
        "update TeamRating.teamId only for listed season ratings",
      ],
      forbidden: [
        "cross-program or cross-gender moves",
        "player, box-score value, formula, or snapshot changes",
        "deleting the source Team",
      ],
    }];
  });

  const ready = plans.filter((plan) => plan.status === "EXECUTE_READY").length;
  const report = {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    summary: {
      activeTeamsInspected: teams.length,
      mixedContextTeams: plans.length,
      executeReady: ready,
      needsReview: plans.length - ready,
      newTeamsRequired: plans.reduce((sum, plan) => sum + plan.proposedTeams.filter((target) => !target.retainsSourceTeam).length, 0),
    },
    plans,
  };

  const reportDir = path.join(process.cwd(), "scripts", "reports");
  await fs.mkdir(reportDir, { recursive: true });
  await fs.writeFile(path.join(reportDir, "split-multi-context-teams-plan.json"), `${JSON.stringify(report, null, 2)}\n`);

  const lines = [
    "# Multi-context Team Split Plan", "", `Generated: ${report.generatedAt}`, "", "Read-only. No records were changed.", "",
    `- Active Teams inspected: ${report.summary.activeTeamsInspected}`,
    `- Mixed-context Teams: ${report.summary.mixedContextTeams}`,
    `- Execute ready: ${report.summary.executeReady}`,
    `- Needs review: ${report.summary.needsReview}`,
    `- New Teams required: ${report.summary.newTeamsRequired}`, "",
    ...plans.flatMap((plan) => [
      `## ${plan.program.name}: ${plan.sourceTeam.name}`, "",
      `- Status: ${plan.status}`,
      `- Fingerprint: ${plan.fingerprint}`,
      `- Program ID: ${plan.program.id}`,
      `- Source Team ID: ${plan.sourceTeam.id}`,
      `- Current references: ${plan.sourceTeam.officialGames} games, ${plan.sourceTeam.officialGameStats} GameStats, ${plan.sourceTeam.activeRosterRows} roster rows, ${plan.sourceTeam.teamRatings} TeamRatings`,
      ...(plan.blockers.length ? plan.blockers.map((blocker) => `- Blocker: ${blocker}`) : []), "",
      ...plan.proposedTeams.flatMap((target) => [
        `### ${target.proposedName}${target.retainsSourceTeam ? " (retains source Team)" : " (new Team)"}`, "",
        `- Context: ${target.competitionNames.join("; ")} / ${target.seasonNames.join("; ")} / ${target.publicAgeLabel} / ${target.gender}`,
        `- Games: ${target.gameRefs.join(", ") || target.gameIds.join(", ")}`,
        `- GameStats: ${target.gameStats}`,
        `- Roster rows: ${target.rosterRowIds.length}`,
        `- TeamRatings: ${target.teamRatingIds.length}`, "",
      ]),
    ]),
  ];
  await fs.writeFile(path.join(reportDir, "split-multi-context-teams-plan.md"), `${lines.join("\n")}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());