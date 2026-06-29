import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { normalizeCompetitionDisplayName } from "../src/lib/competition-naming";
import { prisma } from "../src/lib/prisma";
import { getClassYear, getCurrentRankingAgeBracket } from "../src/lib/ranking-eligibility";
import { getTeamDisplayName, normalizeProgramAlias } from "../src/lib/uaap-school-display";

const jsonReportPath = join(process.cwd(), "scripts", "reports", "roster-only-canonicalization-plan.json");
const markdownReportPath = join(process.cwd(), "scripts", "reports", "roster-only-canonicalization-plan.md");
const now = new Date();

type RowStatus = "READY_FOR_APPROVAL" | "NEEDS_MANUAL_TARGET" | "BLOCKED_NO_VALID_TARGET" | "BLOCKED_CROSS_SEASON";
type LoadedProgram = Awaited<ReturnType<typeof loadPrograms>>[number];
type LoadedTeam = LoadedProgram["teams"][number];
type LoadedRoster = LoadedTeam["rosterSeasons"][number];

function uniqueSorted(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort((left, right) =>
    left.localeCompare(right, undefined, { numeric: true })
  );
}

function formatDate(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : null;
}

function normalizeKey(value: string | null | undefined) {
  return normalizeProgramAlias(getTeamDisplayName(value ?? ""))
    .replace(/\b(U13|13U|U16|16U|U19|19U|BOYS|GIRLS|MEN|WOMEN|MALE|FEMALE)\b/gi, "")
    .replace(/\b(JRS?|JUNIORS?|HS|HIGH SCHOOL|VARSITY)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function normalizeGender(...values: Array<string | null | undefined>) {
  const text = values.filter(Boolean).join(" ").toLowerCase();
  if (/\b(girls?|women|female|lady|ladies|tigress|tigresses)\b/.test(text)) return "GIRLS";
  if (/\b(boys?|men|male)\b/.test(text)) return "BOYS";
  return "";
}

function normalizeAgeGroup(...values: Array<string | null | undefined>) {
  const text = values.filter(Boolean).join(" ").toLowerCase();
  if (/\b(u13|13u|13 and below)\b/.test(text)) return "U13";
  if (/\b(u16|16u)\b/.test(text)) return "U16";
  if (/\b(u19|19u)\b/.test(text)) return "U19";
  return "";
}

function isLegacyName(teamName: string, program: Pick<LoadedProgram, "fullName" | "abbreviation">) {
  const reasons: string[] = [];
  if (/\b(jrs?|juniors?)\b/i.test(teamName)) reasons.push("junior label");
  if (/\b(hs|high school)\b/i.test(teamName)) reasons.push("high-school label");
  if (/\bvarsity\b/i.test(teamName)) reasons.push("varsity label");
  if (normalizeKey(teamName) && normalizeKey(teamName) === normalizeKey(program.fullName)) reasons.push("exact generic Program-name Team");
  if (program.abbreviation && normalizeKey(teamName) === normalizeKey(program.abbreviation)) reasons.push("exact generic Program-abbreviation Team");
  return reasons;
}

function activeRosterWhere() {
  return {
    deletedAt: null,
    OR: [{ endsOn: null }, { endsOn: { gte: now } }]
  };
}

function teamGames(team: LoadedTeam) {
  return Array.from(new Map([...team.homeGames, ...team.awayGames].map((game) => [game.id, game])).values());
}

function teamContext(team: LoadedTeam) {
  const games = teamGames(team);
  const rosterSeasons = team.rosterSeasons.map((roster) => roster.season);
  const statSeasons = team.gameStats.map((stat) => stat.game.season);
  const seasons = [...games.map((game) => game.season), ...rosterSeasons, ...statSeasons];
  const leagueNames = uniqueSorted(seasons.map((season) => normalizeCompetitionDisplayName(season.league.name) || season.league.name));
  const seasonNames = uniqueSorted(seasons.map((season) => season.name));
  const ageGroups = uniqueSorted([normalizeAgeGroup(team.name), ...seasons.map((season) => season.league.ageGroup)].filter(Boolean));
  const gender = normalizeGender(team.name, ...seasons.map((season) => season.league.name));
  const seasonIds = uniqueSorted(seasons.map((season) => season.id));
  return { gender, ageGroups, leagueNames, seasonNames, seasonIds };
}

function isCanonicalTargetCandidate(team: LoadedTeam, program: Pick<LoadedProgram, "fullName" | "abbreviation">) {
  if (isLegacyName(team.name, program).length) return false;
  const context = teamContext(team);
  return Boolean(normalizeGender(team.name) || normalizeAgeGroup(team.name) || context.gender || context.ageGroups.length || context.seasonIds.length);
}

function referenceCounts(team: LoadedTeam) {
  return {
    playerTeamSeason: team.rosterSeasons.length,
    gameStat: team.gameStats.length,
    gameHomeAway: teamGames(team).length
  };
}

function inferRosterAgeGroup(roster: LoadedRoster) {
  if (roster.player.ageGroupOverride) return roster.player.ageGroupOverride;
  const current = getCurrentRankingAgeBracket(roster.player.birthDate, now, roster.player.classYearOverride);
  if (current && current !== "OUT_OF_RANGE") return current;
  return roster.season.league.ageGroup || "";
}

function targetDiagnostics(team: LoadedTeam, roster: LoadedRoster, inferredGender: string, inferredAgeGroup: string) {
  const context = teamContext(team);
  const sameSeason = context.seasonIds.includes(roster.seasonId);
  const sameGender = !inferredGender || !context.gender || inferredGender === context.gender;
  const sameAgeGroup = !inferredAgeGroup || !context.ageGroups.length || context.ageGroups.includes(inferredAgeGroup);
  const rejectionReasons: string[] = [];
  if (!sameSeason) rejectionReasons.push("different season context");
  if (!sameGender) rejectionReasons.push(`gender mismatch: player ${inferredGender || "UNKNOWN"}, team ${context.gender || "UNKNOWN"}`);
  if (!sameAgeGroup) rejectionReasons.push(`age-group mismatch: player ${inferredAgeGroup || "UNKNOWN"}, team ${context.ageGroups.join("/") || "UNKNOWN"}`);
  return {
    teamId: team.id,
    teamName: team.name,
    displayName: getTeamDisplayName(team.name),
    context,
    sameSeason,
    sameGender,
    sameAgeGroup,
    validExactTarget: sameSeason && sameGender && sameAgeGroup,
    crossSeasonOnly: !sameSeason && sameGender && sameAgeGroup,
    rejectionReasons
  };
}

function classifyRosterRow(roster: LoadedRoster, targetRows: ReturnType<typeof targetDiagnostics>[]) {
  const exactTargets = targetRows.filter((target) => target.validExactTarget);
  if (exactTargets.length === 1) {
    return {
      status: "READY_FOR_APPROVAL" as RowStatus,
      recommendedTargetTeam: exactTargets[0],
      reason: "One target Team matches Program, Season, gender, and inferred age group."
    };
  }
  if (exactTargets.length > 1) {
    return {
      status: "NEEDS_MANUAL_TARGET" as RowStatus,
      recommendedTargetTeam: null,
      reason: "Multiple same-season target Teams match; admin must choose one."
    };
  }
  const crossSeasonTargets = targetRows.filter((target) => target.crossSeasonOnly);
  if (crossSeasonTargets.length === 1) {
    return {
      status: "BLOCKED_CROSS_SEASON" as RowStatus,
      recommendedTargetTeam: crossSeasonTargets[0],
      reason: "Only same-age/gender target is in a different Season context."
    };
  }
  if (crossSeasonTargets.length > 1) {
    return {
      status: "BLOCKED_CROSS_SEASON" as RowStatus,
      recommendedTargetTeam: null,
      reason: "Only same-age/gender targets are in different Season contexts, and multiple options exist."
    };
  }
  return {
    status: "BLOCKED_NO_VALID_TARGET" as RowStatus,
    recommendedTargetTeam: null,
    reason: "No target Team under the same Program matches Season, gender, and inferred age group."
  };
}

async function loadPrograms() {
  return prisma.program.findMany({
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
            select: { id: true, playerId: true, game: { select: { id: true, gameNumber: true, seasonId: true, season: { include: { league: true } } } } }
          },
          rosterSeasons: {
            where: activeRosterWhere(),
            include: {
              player: {
                select: {
                  id: true,
                  displayName: true,
                  gender: true,
                  birthDate: true,
                  classYearOverride: true,
                  ageGroupOverride: true
                }
              },
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
}

function buildMarkdown(report: {
  generatedAt: string;
  summary: Record<RowStatus | "legacyTeamsReviewed" | "rosterRowsReviewed", number>;
  groups: Array<{
    programName: string;
    sourceTeamName: string;
    referenceCounts: ReturnType<typeof referenceCounts>;
    rows: Array<{
      playerName: string;
      inferredGender: string;
      inferredAgeGroup: string;
      status: RowStatus;
      recommendedTargetTeam: ReturnType<typeof targetDiagnostics> | null;
      reason: string;
    }>;
  }>;
}) {
  const lines = [
    "# Roster-only Canonicalization Review Plan",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Mode: dry-run / read-only. No roster assignments or historical stats were changed.",
    "",
    "## Summary",
    "",
    ...Object.entries(report.summary).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Groups",
    ""
  ];
  for (const group of report.groups) {
    lines.push(`### ${group.programName} / ${group.sourceTeamName}`);
    lines.push("");
    lines.push(`- Source refs: roster ${group.referenceCounts.playerTeamSeason}, GameStats ${group.referenceCounts.gameStat}, game home/away ${group.referenceCounts.gameHomeAway}`);
    lines.push("");
    lines.push("| Player | Inferred | Status | Target | Reason |");
    lines.push("| --- | --- | --- | --- | --- |");
    for (const row of group.rows) {
      lines.push(
        `| ${row.playerName} | ${row.inferredGender} ${row.inferredAgeGroup} | ${row.status} | ${row.recommendedTargetTeam?.teamName ?? "—"} | ${row.reason} |`
      );
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

async function main() {
  const programs = await loadPrograms();
  const groups = [];

  for (const program of programs) {
    const targetTeams = program.teams.filter((team) => isCanonicalTargetCandidate(team, program));
    if (!targetTeams.length) continue;

    for (const sourceTeam of program.teams) {
      const legacyReasons = isLegacyName(sourceTeam.name, program);
      const counts = referenceCounts(sourceTeam);
      if (!legacyReasons.length) continue;
      if (!counts.playerTeamSeason || counts.gameStat || counts.gameHomeAway) continue;

      const rows = sourceTeam.rosterSeasons.map((roster) => {
        const inferredGender = roster.player.gender;
        const inferredAgeGroup = inferRosterAgeGroup(roster);
        const targets = targetTeams
          .filter((team) => team.id !== sourceTeam.id)
          .map((team) => targetDiagnostics(team, roster, inferredGender, inferredAgeGroup));
        const classification = classifyRosterRow(roster, targets);
        return {
          playerTeamSeasonId: roster.id,
          playerId: roster.playerId,
          playerName: roster.player.displayName,
          birthDate: formatDate(roster.player.birthDate),
          yearOfBirth: roster.player.birthDate ? roster.player.birthDate.getUTCFullYear() : null,
          classYearOverride: roster.player.classYearOverride,
          classYear: roster.player.classYearOverride ?? getClassYear(roster.player.birthDate),
          ageGroupOverride: roster.player.ageGroupOverride,
          inferredGender,
          inferredAgeGroup: inferredAgeGroup || "UNKNOWN",
          currentSourceTeamId: sourceTeam.id,
          currentSourceTeamName: sourceTeam.name,
          currentSeasonId: roster.seasonId,
          currentSeasonName: roster.season.name,
          currentLeagueName: normalizeCompetitionDisplayName(roster.season.league.name) || roster.season.league.name,
          possibleTargetTeams: targets,
          recommendedTargetTeam: classification.recommendedTargetTeam,
          status: classification.status,
          reason: classification.reason
        };
      });

      groups.push({
        programId: program.id,
        programName: program.fullName,
        sourceTeamId: sourceTeam.id,
        sourceTeamName: sourceTeam.name,
        legacyReasons,
        referenceCounts: counts,
        candidateTargetTeams: targetTeams
          .filter((team) => team.id !== sourceTeam.id)
          .map((team) => ({
            teamId: team.id,
            teamName: team.name,
            displayName: getTeamDisplayName(team.name),
            context: teamContext(team),
            referenceCounts: referenceCounts(team)
          })),
        rows
      });
    }
  }

  const summary = groups.reduce<Record<RowStatus | "legacyTeamsReviewed" | "rosterRowsReviewed", number>>((acc, group) => {
    acc.legacyTeamsReviewed += 1;
    for (const row of group.rows) {
      acc.rosterRowsReviewed += 1;
      acc[row.status] += 1;
    }
    return acc;
  }, {
    legacyTeamsReviewed: 0,
    rosterRowsReviewed: 0,
    READY_FOR_APPROVAL: 0,
    NEEDS_MANUAL_TARGET: 0,
    BLOCKED_NO_VALID_TARGET: 0,
    BLOCKED_CROSS_SEASON: 0
  });

  const report = {
    generatedAt: new Date().toISOString(),
    mode: "dry-run-read-only",
    guardrails: [
      "No database writes.",
      "No deletes.",
      "No merges.",
      "No schema changes.",
      "No GameStat or Game rewrites.",
      "Only PlayerTeamSeason roster-only reassignment can be considered in a later approved execute path."
    ],
    summary,
    groups
  };

  mkdirSync(dirname(jsonReportPath), { recursive: true });
  writeFileSync(jsonReportPath, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(markdownReportPath, buildMarkdown(report));

  const ustJrs = groups.find((group) => group.sourceTeamName === "UST Jrs (UST)");
  console.log(JSON.stringify({
    jsonReportPath,
    markdownReportPath,
    summary,
    ustJrs: ustJrs
      ? {
          programName: ustJrs.programName,
          sourceTeamId: ustJrs.sourceTeamId,
          sourceTeamName: ustJrs.sourceTeamName,
          referenceCounts: ustJrs.referenceCounts,
          rows: ustJrs.rows.map((row) => ({
            playerName: row.playerName,
            inferredGender: row.inferredGender,
            inferredAgeGroup: row.inferredAgeGroup,
            currentSeasonName: row.currentSeasonName,
            status: row.status,
            recommendedTargetTeam: row.recommendedTargetTeam
              ? {
                  teamId: row.recommendedTargetTeam.teamId,
                  teamName: row.recommendedTargetTeam.teamName
                }
              : null,
            reason: row.reason
          }))
        }
      : null
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
