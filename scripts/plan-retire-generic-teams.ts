import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { prisma } from "../src/lib/prisma";
import { getCurrentRankingAgeBracket } from "../src/lib/ranking-eligibility";

const reportPath = join(process.cwd(), "scripts", "reports", "generic-team-retirement-plan.json");
const now = new Date();

function uniqueSorted(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
}

function formatDate(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : null;
}

function inferGender(...values: Array<string | null | undefined>) {
  const text = values.filter(Boolean).join(" ").toLowerCase();
  if (/\b(girls?|women|female|lady|ladies|tigress|tigresses)\b/.test(text)) return "Girls";
  if (/\b(boys?|men|male)\b/.test(text)) return "Boys";
  return "Unknown";
}

function teamNameHasSpecificContext(value: string) {
  return /\b(u13|13u|u16|16u|u19|19u|boys?|girls?|men|women|female|male|lady|ladies|tigress|tigresses)\b/i.test(value);
}

function legacyReason(teamName: string, hasSpecificSibling: boolean) {
  const reasons: string[] = [];
  if (/\b(jrs?|juniors?)\b/i.test(teamName)) reasons.push("junior label");
  if (/\b(hs|high school)\b/i.test(teamName)) reasons.push("high-school label");
  if (/\bvarsity\b/i.test(teamName)) reasons.push("varsity label");
  if (hasSpecificSibling && !teamNameHasSpecificContext(teamName)) reasons.push("generic name while specific age/gender Teams exist");
  return reasons;
}

function activeRosterFilter() {
  return {
    deletedAt: null,
    OR: [{ endsOn: null }, { endsOn: { gte: now } }]
  };
}

async function buildNicksonDiagnostic() {
  const player = await prisma.player.findFirst({
    where: {
      deletedAt: null,
      OR: [
        { displayName: { contains: "Nickson Cabanero", mode: "insensitive" } },
        { displayName: { contains: "Nickson Cabañero", mode: "insensitive" } },
        { firstName: { contains: "Nickson", mode: "insensitive" } }
      ]
    },
    include: {
      currentProgram: true,
      rosterSeasons: {
        where: { deletedAt: null },
        include: { team: { include: { program: true } }, season: true },
        orderBy: { createdAt: "desc" }
      },
      gameStats: {
        where: { deletedAt: null },
        include: { team: { include: { program: true } }, game: { include: { season: { include: { league: true } } } } }
      }
    }
  });

  const ustProgram = await prisma.program.findFirst({
    where: {
      deletedAt: null,
      OR: [
        { fullName: { contains: "University of Santo Tomas", mode: "insensitive" } },
        { abbreviation: { equals: "UST", mode: "insensitive" } }
      ]
    },
    include: {
      currentPlayers: { where: { deletedAt: null }, select: { id: true } },
      teams: {
        where: { deletedAt: null },
        include: {
          rosterSeasons: { where: activeRosterFilter(), select: { playerId: true } },
          gameStats: { where: { deletedAt: null }, select: { playerId: true } }
        }
      }
    }
  });

  if (!player) return { found: false, message: "Nickson Cabanero was not found." };
  const ustTeamIds = new Set(ustProgram?.teams.map((team) => team.id) ?? []);
  const currentProgramPlayers = new Set(ustProgram?.currentPlayers.map((candidate) => candidate.id) ?? []);
  const rosterPlayers = new Set(ustProgram?.teams.flatMap((team) => team.rosterSeasons.map((roster) => roster.playerId)) ?? []);
  const historicalPlayers = new Set(ustProgram?.teams.flatMap((team) => team.gameStats.map((stat) => stat.playerId)) ?? []);
  const hasCurrentProgram = ustProgram ? currentProgramPlayers.has(player.id) : false;
  const hasUstRoster = rosterPlayers.has(player.id);
  const hasHistoricalUstStats = historicalPlayers.has(player.id);
  const isGraduated = getCurrentRankingAgeBracket(player.birthDate, now, player.classYearOverride) === "OUT_OF_RANGE";
  const hasActiveUstRosterAssignment = player.rosterSeasons.some((roster) => ustTeamIds.has(roster.teamId) && (!roster.endsOn || roster.endsOn >= now));
  const isUnassignedProgramLevel = hasCurrentProgram && !hasActiveUstRosterAssignment && !isGraduated;

  let rootCause = "UNKNOWN";
  if (!ustProgram) rootCause = "UST_PROGRAM_NOT_FOUND";
  else if (!player.rosterSeasons.length) rootCause = "NO_PLAYER_TEAM_SEASON_ASSIGNMENT_FOUND";
  else if (!hasActiveUstRosterAssignment) rootCause = "PLAYER_TEAM_SEASON_NOT_UNDER_UST_PROGRAM_OR_NOT_ACTIVE";
  else if (isGraduated) rootCause = "PLAYER_GROUPED_AS_GRADUATED";
  else rootCause = "DATA_PRESENT_PROGRAM_DETAIL_LOADER_SHOULD_SHOW_CURRENT_ROSTER";

  return {
    found: true,
    player: {
      id: player.id,
      displayName: player.displayName,
      gender: player.gender,
      birthDate: formatDate(player.birthDate),
      classYearOverride: player.classYearOverride,
      currentProgramId: player.currentProgramId,
      currentProgramName: player.currentProgram?.fullName ?? null,
      rankingAgeBracketNow: getCurrentRankingAgeBracket(player.birthDate, now, player.classYearOverride)
    },
    ustProgram: ustProgram ? { id: ustProgram.id, fullName: ustProgram.fullName, abbreviation: ustProgram.abbreviation } : null,
    playerTeamSeasonRows: player.rosterSeasons.map((roster) => ({
      id: roster.id,
      teamId: roster.teamId,
      teamName: roster.team.name,
      teamProgramId: roster.team.programId,
      teamProgramName: roster.team.program?.fullName ?? null,
      seasonId: roster.seasonId,
      seasonName: roster.season.name,
      startsOn: formatDate(roster.startsOn),
      endsOn: formatDate(roster.endsOn),
      activeNow: !roster.endsOn || roster.endsOn >= now,
      teamBelongsToUst: ustTeamIds.has(roster.teamId)
    })),
    sourceSetPresence: {
      currentProgramPlayers: hasCurrentProgram,
      playerTeamSeasonRosterPlayers: hasUstRoster,
      historicalGameStatPlayers: hasHistoricalUstStats,
      unassignedProgramLevelPlayers: isUnassignedProgramLevel,
      graduatedPlayers: isGraduated
    },
    historicalUstGameStats: player.gameStats.filter((stat) => ustTeamIds.has(stat.teamId)).map((stat) => ({
      gameStatId: stat.id,
      teamId: stat.teamId,
      teamName: stat.team.name,
      gameNumber: stat.game.gameNumber,
      league: stat.game.season.league.name,
      season: stat.game.season.name
    })),
    rootCause
  };
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
            select: { id: true, gameNumber: true }
          },
          awayGames: {
            where: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } },
            select: { id: true, gameNumber: true }
          },
          gameStats: { where: { deletedAt: null }, select: { id: true } },
          rosterSeasons: { where: activeRosterFilter(), select: { id: true } }
        },
        orderBy: { name: "asc" }
      }
    },
    orderBy: { fullName: "asc" }
  });

  const candidates = [];
  for (const program of programs) {
    const specificTeams = program.teams.filter((team) => teamNameHasSpecificContext(team.name));
    if (!specificTeams.length) continue;
    for (const team of program.teams) {
      const reasons = legacyReason(team.name, specificTeams.length > 0);
      if (!reasons.length) continue;
      const activeOfficialGames = Array.from(new Map([...team.homeGames, ...team.awayGames].map((game) => [game.id, game])).values());
      const activeRosterCount = team.rosterSeasons.length;
      const activeGameStatsCount = team.gameStats.length;
      const activeOfficialGamesCount = activeOfficialGames.length;
      const recommendation = activeRosterCount > 0
        ? "BLOCKED_HAS_CURRENT_ROSTER"
        : activeGameStatsCount > 0 || activeOfficialGamesCount > 0
          ? "NEEDS_REVIEW_HAS_HISTORY"
          : "SAFE_TO_RETIRE_FROM_ACTIVE_UI";
      candidates.push({
        programId: program.id,
        programName: program.fullName,
        genericTeamId: team.id,
        genericTeamName: team.name,
        reason: reasons,
        specificTeams: specificTeams.map((specific) => ({ id: specific.id, name: specific.name })),
        activePlayerTeamSeasonCount: activeRosterCount,
        activeGameStatsCount,
        activeOfficialGamesCount,
        activeOfficialGameRefs: uniqueSorted(activeOfficialGames.map((game) => game.gameNumber ?? game.id)),
        recommendation
      });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    mode: "dry-run-read-only",
    guardrails: [
      "No database writes.",
      "No deletes.",
      "No merges.",
      "No GameStat or Game rewrites.",
      "Generic Teams with history should be hidden/soft-retired only after explicit approval."
    ],
    nicksonDiagnostic: await buildNicksonDiagnostic(),
    summary: {
      candidateCount: candidates.length,
      safeToRetireFromActiveUi: candidates.filter((candidate) => candidate.recommendation === "SAFE_TO_RETIRE_FROM_ACTIVE_UI").length,
      needsReviewHasHistory: candidates.filter((candidate) => candidate.recommendation === "NEEDS_REVIEW_HAS_HISTORY").length,
      blockedHasCurrentRoster: candidates.filter((candidate) => candidate.recommendation === "BLOCKED_HAS_CURRENT_ROSTER").length
    },
    candidates
  };

  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({
    reportPath,
    nicksonRootCause: "rootCause" in report.nicksonDiagnostic ? report.nicksonDiagnostic.rootCause : report.nicksonDiagnostic.message,
    summary: report.summary,
    ustCandidates: candidates.filter((candidate) => candidate.programName.includes("Santo Tomas") || candidate.programName === "UST")
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
