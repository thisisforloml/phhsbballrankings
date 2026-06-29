import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { prisma } from "../src/lib/prisma";
import { getClassYear, getCurrentRankingAgeBracket } from "../src/lib/ranking-eligibility";

const jsonReportPath = join(process.cwd(), "scripts", "reports", "generic-roster-reassignment-plan.json");
const markdownReportPath = join(process.cwd(), "scripts", "reports", "generic-roster-reassignment-plan.md");
const now = new Date();

type Confidence = "AUTO_READY" | "NEEDS_REVIEW" | "BLOCKED_NO_TARGET" | "BLOCKED_MULTIPLE_TARGETS";

type LoadedTeam = {
  id: string;
  name: string;
  city: string;
  region: string;
  homeGames: Array<{ id: string; gameNumber: string | null; seasonId: string; season: { id: string; name: string; league: { ageGroup: string; name: string } } }>;
  awayGames: Array<{ id: string; gameNumber: string | null; seasonId: string; season: { id: string; name: string; league: { ageGroup: string; name: string } } }>;
  gameStats: Array<{ id: string; game: { id: string; gameNumber: string | null; seasonId: string; season: { id: string; name: string; league: { ageGroup: string; name: string } } } }>;
  rosterSeasons: Array<{ id: string; seasonId: string; season: { id: string; name: string; league: { ageGroup: string; name: string } } }>;
};

function formatDate(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : null;
}

function uniqueSorted<T>(values: T[]) {
  return Array.from(new Set(values)).sort((left, right) => String(left).localeCompare(String(right), undefined, { numeric: true }));
}

function normalizeGender(value: string | null | undefined) {
  const text = String(value ?? "").toLowerCase();
  if (/\b(girls?|women|female|lady|ladies|tigress|tigresses)\b/.test(text)) return "GIRLS";
  if (/\b(boys?|men|male)\b/.test(text)) return "BOYS";
  return "";
}

function normalizeAgeGroup(value: string | null | undefined) {
  const text = String(value ?? "").toLowerCase();
  if (/\b(u13|13u|13 and below)\b/.test(text)) return "U13";
  if (/\b(u16|16u)\b/.test(text)) return "U16";
  if (/\b(u19|19u)\b/.test(text)) return "U19";
  return "";
}

function teamNameHasSpecificContext(value: string) {
  return Boolean(normalizeAgeGroup(value) || normalizeGender(value));
}

function legacyReasons(teamName: string, hasSpecificSibling: boolean) {
  const reasons: string[] = [];
  if (/\b(jrs?|juniors?)\b/i.test(teamName)) reasons.push("junior label");
  if (/\b(hs|high school)\b/i.test(teamName)) reasons.push("high-school label");
  if (/\bvarsity\b/i.test(teamName)) reasons.push("varsity label");
  if (hasSpecificSibling && !teamNameHasSpecificContext(teamName)) reasons.push("generic name while specific age/gender Teams exist");
  return reasons;
}

function activeRosterWhere() {
  return {
    deletedAt: null,
    OR: [{ endsOn: null }, { endsOn: { gte: now } }]
  };
}

function teamSeasonIds(team: {
  homeGames: Array<{ seasonId: string }>;
  awayGames: Array<{ seasonId: string }>;
  rosterSeasons: Array<{ seasonId: string }>;
}) {
  return new Set([...team.homeGames.map((game) => game.seasonId), ...team.awayGames.map((game) => game.seasonId), ...team.rosterSeasons.map((roster) => roster.seasonId)]);
}

function teamSeasonLabels(team: LoadedTeam) {
  const rows = [
    ...team.homeGames.map((game) => ({ seasonId: game.seasonId, label: `${game.season.league.name} / ${game.season.name}`, source: "home game" })),
    ...team.awayGames.map((game) => ({ seasonId: game.seasonId, label: `${game.season.league.name} / ${game.season.name}`, source: "away game" })),
    ...team.gameStats.map((stat) => ({ seasonId: stat.game.seasonId, label: `${stat.game.season.league.name} / ${stat.game.season.name}`, source: "GameStat" })),
    ...team.rosterSeasons.map((roster) => ({ seasonId: roster.seasonId, label: `${roster.season.league.name} / ${roster.season.name}`, source: "roster" }))
  ];
  return Array.from(new Map(rows.map((row) => [row.seasonId, row])).values()).sort((left, right) => left.label.localeCompare(right.label));
}

function teamActiveGameRefs(team: LoadedTeam) {
  return uniqueSorted([...team.homeGames, ...team.awayGames].map((game) => game.gameNumber ?? game.id));
}

function teamInventory(team: LoadedTeam, hasSpecificSibling: boolean) {
  const context = teamContext(team);
  return {
    teamId: team.id,
    teamName: team.name,
    city: team.city,
    region: team.region,
    inferredGender: context.gender || "UNKNOWN",
    inferredAgeGroups: context.ageGroups,
    legacyReasons: legacyReasons(team.name, hasSpecificSibling),
    activePlayerTeamSeasonCount: team.rosterSeasons.length,
    activeGameStatsCount: team.gameStats.length,
    activeGamesCount: new Set([...team.homeGames.map((game) => game.id), ...team.awayGames.map((game) => game.id)]).size,
    latestGameRefs: teamActiveGameRefs(team).slice(-8),
    linkedSeasons: teamSeasonLabels(team)
  };
}

function teamContext(team: {
  name: string;
  homeGames: Array<{ season: { league: { ageGroup: string; name: string } } }>;
  awayGames: Array<{ season: { league: { ageGroup: string; name: string } } }>;
  rosterSeasons: Array<{ season: { league: { ageGroup: string; name: string } } }>;
}) {
  const contexts = [...team.homeGames, ...team.awayGames, ...team.rosterSeasons];
  const gender = normalizeGender(team.name) || normalizeGender(contexts.map((item) => item.season.league.name).join(" "));
  const ageGroups = uniqueSorted([normalizeAgeGroup(team.name), ...contexts.map((item) => item.season.league.ageGroup)].filter(Boolean));
  return { gender, ageGroups };
}

function targetDiagnostics(team: LoadedTeam, roster: { seasonId: string }, targetGender: string, targetAgeGroup: string) {
  const context = teamContext(team);
  const seasons = teamSeasonIds(team);
  const rejectionReasons: string[] = [];
  if (!seasons.has(roster.seasonId)) rejectionReasons.push("no linked game/stat/roster evidence in assigned season");
  if (targetGender === "GIRLS") {
    if (context.gender !== "GIRLS") rejectionReasons.push(`gender mismatch: target GIRLS, team ${context.gender || "UNKNOWN"}`);
  } else if (context.gender !== "BOYS") {
    rejectionReasons.push(`gender mismatch: target BOYS, team ${context.gender || "UNKNOWN"}`);
  }
  if (targetGender !== "GIRLS" && !context.ageGroups.includes(targetAgeGroup)) {
    rejectionReasons.push(`age-group mismatch: target ${targetAgeGroup || "UNKNOWN"}, team ${context.ageGroups.join("/") || "UNKNOWN"}`);
  }
  return {
    teamId: team.id,
    teamName: team.name,
    inferredGender: context.gender || "UNKNOWN",
    inferredAgeGroups: context.ageGroups,
    linkedSeasons: teamSeasonLabels(team),
    accepted: rejectionReasons.length === 0,
    rejectionReasons
  };
}

function playerAgeGroup(player: { birthDate: Date | null; classYearOverride: number | null; ageGroupOverride: string | null }, seasonAgeGroup: string) {
  if (player.ageGroupOverride) return player.ageGroupOverride;
  const current = getCurrentRankingAgeBracket(player.birthDate, now, player.classYearOverride);
  if (current && current !== "OUT_OF_RANGE") return current;
  return seasonAgeGroup || "";
}

async function main() {
  const programs = await prisma.program.findMany({
    where: { deletedAt: null },
    include: {
      teams: {
        where: { deletedAt: null },
        include: {
          homeGames: {
            where: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } },
            select: { id: true, gameNumber: true, seasonId: true, season: { include: { league: true } } }
          },
          awayGames: {
            where: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } },
            select: { id: true, gameNumber: true, seasonId: true, season: { include: { league: true } } }
          },
          gameStats: {
            where: { deletedAt: null, game: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } } },
            select: { id: true, game: { select: { id: true, gameNumber: true, seasonId: true, season: { include: { league: true } } } } }
          },
          rosterSeasons: {
            where: activeRosterWhere(),
            include: {
              player: { include: { currentProgram: true } },
              season: { include: { league: true } }
            },
            orderBy: { createdAt: "asc" }
          }
        },
        orderBy: { name: "asc" }
      }
    },
    orderBy: { fullName: "asc" }
  });

  const rows = [];
  const programDiagnostics = [];
  for (const program of programs) {
    const specificTeams = program.teams.filter((team) => teamNameHasSpecificContext(team.name));
    if (!specificTeams.length) continue;
    const hasActiveGenericRosterRows = program.teams.some((team) => legacyReasons(team.name, specificTeams.length > 0).length && team.rosterSeasons.length);
    if (hasActiveGenericRosterRows) {
      programDiagnostics.push({
        programId: program.id,
        programName: program.fullName,
        teams: program.teams.map((team) => teamInventory(team, specificTeams.length > 0))
      });
    }
    for (const genericTeam of program.teams) {
      const reasons = legacyReasons(genericTeam.name, specificTeams.length > 0);
      if (!reasons.length || !genericTeam.rosterSeasons.length) continue;

      for (const roster of genericTeam.rosterSeasons) {
        const targetGender = roster.player.gender;
        const targetAgeGroup = playerAgeGroup(roster.player, roster.season.league.ageGroup);
        const specificTargetDiagnostics = specificTeams.map((team) => targetDiagnostics(team, roster, targetGender, targetAgeGroup));
        const possibleTargets = specificTargetDiagnostics.filter((target) => target.accepted).map(({ accepted, rejectionReasons, ...target }) => target);

        let confidence: Confidence = "NEEDS_REVIEW";
        if (!targetAgeGroup || targetAgeGroup === "OUT_OF_RANGE") confidence = "NEEDS_REVIEW";
        else if (possibleTargets.length === 0) confidence = "BLOCKED_NO_TARGET";
        else if (possibleTargets.length > 1) confidence = "BLOCKED_MULTIPLE_TARGETS";
        else confidence = "AUTO_READY";

        rows.push({
          programId: program.id,
          programName: program.fullName,
          currentGenericTeamId: genericTeam.id,
          currentGenericTeamName: genericTeam.name,
          genericReasons: reasons,
          playerTeamSeasonId: roster.id,
          playerId: roster.playerId,
          playerName: roster.player.displayName,
          playerGender: roster.player.gender,
          birthDate: formatDate(roster.player.birthDate),
          classYear: roster.player.classYearOverride ?? getClassYear(roster.player.birthDate),
          classYearOverride: roster.player.classYearOverride,
          ageGroupOverride: roster.player.ageGroupOverride,
          inferredAgeGroup: targetAgeGroup || "UNKNOWN",
          currentProgramId: roster.player.currentProgramId,
          currentProgramName: roster.player.currentProgram?.fullName ?? null,
          assignedSeasonId: roster.seasonId,
          assignedSeasonName: roster.season.name,
          assignedLeagueName: roster.season.league.name,
          possibleSpecificTargets: possibleTargets,
          rejectedSpecificTargets: specificTargetDiagnostics.filter((target) => !target.accepted),
          recommendedTargetTeam: confidence === "AUTO_READY" ? possibleTargets[0] : null,
          confidence
        });
      }
    }
  }

  const byConfidence = rows.reduce<Record<Confidence, number>>((acc, row) => {
    acc[row.confidence] += 1;
    return acc;
  }, { AUTO_READY: 0, NEEDS_REVIEW: 0, BLOCKED_NO_TARGET: 0, BLOCKED_MULTIPLE_TARGETS: 0 });

  const report = {
    generatedAt: new Date().toISOString(),
    mode: "dry-run-read-only",
    guardrails: [
      "No database writes.",
      "No deletes.",
      "No merges.",
      "No GameStat or Game rewrites.",
      "Only future approved roster-only PlayerTeamSeason reassignment should be considered."
    ],
    summary: {
      totalActiveGenericRosterRows: rows.length,
      ...byConfidence
    },
    programDiagnostics,
    rows
  };

  const markdown = [
    "# Generic Roster Reassignment Plan",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Dry-run only. No database writes, deletes, merges, GameStat rewrites, or Game rewrites were performed.",
    "",
    "## Summary",
    "",
    `- Total active generic roster rows: ${report.summary.totalActiveGenericRosterRows}`,
    `- AUTO_READY: ${report.summary.AUTO_READY}`,
    `- NEEDS_REVIEW: ${report.summary.NEEDS_REVIEW}`,
    `- BLOCKED_NO_TARGET: ${report.summary.BLOCKED_NO_TARGET}`,
    `- BLOCKED_MULTIPLE_TARGETS: ${report.summary.BLOCKED_MULTIPLE_TARGETS}`,
    "",
    "## Program Team Inventory",
    "",
    ...programDiagnostics.flatMap((program) => [
      `### ${program.programName}`,
      "",
      ...program.teams.map((team) => `- ${team.teamName}: ${team.inferredAgeGroups.join("/") || "UNKNOWN"} ${team.inferredGender}; roster ${team.activePlayerTeamSeasonCount}; games ${team.activeGamesCount}; stats ${team.activeGameStatsCount}; seasons ${team.linkedSeasons.map((season) => season.label).join(" | ") || "none"}${team.legacyReasons.length ? `; legacy: ${team.legacyReasons.join(", ")}` : ""}`),
      ""
    ]),
    "## UST Jrs Recommendations",
    "",
    ...rows
      .filter((row) => row.programName.includes("Santo Tomas") || row.currentGenericTeamName.includes("UST"))
      .map((row) => {
        const rejected = row.rejectedSpecificTargets.length
          ? ` Rejected: ${row.rejectedSpecificTargets.map((target) => `${target.teamName} [${target.rejectionReasons.join("; ")}]`).join(" | ")}`
          : "";
        return `- ${row.playerName} (${row.inferredAgeGroup} ${row.playerGender}) from ${row.currentGenericTeamName}: ${row.confidence}${row.recommendedTargetTeam ? ` -> ${row.recommendedTargetTeam.teamName}` : ""}.${rejected}`;
      }),
    "",
    "## All Rows",
    "",
    ...rows.map((row) => `- ${row.programName} / ${row.currentGenericTeamName} / ${row.playerName}: ${row.confidence}${row.recommendedTargetTeam ? ` -> ${row.recommendedTargetTeam.teamName}` : ""}`)
  ].join("\n");

  mkdirSync(dirname(jsonReportPath), { recursive: true });
  writeFileSync(jsonReportPath, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(markdownReportPath, `${markdown}\n`);

  console.log(JSON.stringify({
    jsonReportPath,
    markdownReportPath,
    summary: report.summary,
    ustJrsRecommendations: rows
      .filter((row) => row.currentGenericTeamName.includes("UST Jrs"))
      .map((row) => ({
        playerName: row.playerName,
        playerId: row.playerId,
        inferredAgeGroup: row.inferredAgeGroup,
        playerGender: row.playerGender,
        confidence: row.confidence,
        recommendedTargetTeam: row.recommendedTargetTeam
      }))
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
