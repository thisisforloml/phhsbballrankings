import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { prisma } from "../src/lib/prisma";
import { getUaapSchoolDisplayName } from "../src/lib/uaap-school-display";

const reportPath = "D:/Peach Basket/scripts/reports/team-duplicate-cleanup-audit.json";
const aliasNeedles = ["ADU", "ATENEO", "DLSU", "DLSZ", "LA SALLE", "FEU", "NU", "NUNS", "UE", "UP", "UPIS", "UST"];
const repairedU16TeamNames = new Set(["ADU U16 Boys", "ATENEO U16 Boys", "DLSZ U16 Boys", "FEU U16 Boys", "UP U16 Boys", "UST U16 Boys"]);
const repairedU19DlszTeamNames = new Set(["DLSZ U19 Boys", "DLSZ U19 Girls"]);

type TeamUsage = {
  teamId: string;
  teamName: string;
  city: string;
  region: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  gameStatsCount: number;
  gameNumbers: string[];
  firstGameDate: string | null;
  lastGameDate: string | null;
};

type ContextGroup = {
  classification: "EXPECTED_SINGLE" | "DUPLICATE_SAME_CONTEXT";
  publicSchoolDisplayName: string;
  ageGroup: string;
  gender: string;
  leagueId: string;
  leagueName: string;
  seasonId: string;
  seasonName: string;
  teams: TeamUsage[];
};

function stripAgeGenderSuffix(name: string) {
  return name.replace(/\s+U(?:13|16|19)\s+(?:Boys|Girls)$/i, "").trim();
}

function publicDisplayName(name: string) {
  const alias = stripAgeGenderSuffix(name);
  return getUaapSchoolDisplayName(alias || name);
}

function inferGender(...values: Array<string | null | undefined>) {
  return values.filter(Boolean).join(" ").toLowerCase().includes("girls") ? "Girls" : "Boys";
}

function contextKey(parts: Array<string | null | undefined>) {
  return parts.map((part) => part ?? "").join("|");
}

function canonicalName(publicSchoolDisplayName: string, ageGroup: string, gender: string) {
  const prefixBySchool: Record<string, string> = {
    "Adamson University": "ADU",
    "Ateneo de Manila University": "ATENEO",
    "De La Salle Santiago Zobel": "DLSZ",
    "Far Eastern University": "FEU",
    "National University Nazareth School": "NU",
    "University of the East": "UE",
    "University of the Philippines Integrated School": "UP",
    "University of Santo Tomas": "UST"
  };
  return `${prefixBySchool[publicSchoolDisplayName] ?? publicSchoolDisplayName} ${ageGroup} ${gender}`;
}

function riskLevel(group: ContextGroup) {
  const affectedStats = group.teams.reduce((sum, team) => sum + team.gameStatsCount, 0);
  if (affectedStats >= 150 || group.teams.some((team) => repairedU16TeamNames.has(team.teamName) || repairedU19DlszTeamNames.has(team.teamName))) return "HIGH";
  if (affectedStats >= 50) return "MEDIUM";
  return "LOW";
}

async function main() {
  const [teams, games] = await Promise.all([
    prisma.team.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } }),
    prisma.game.findMany({
      where: {
        deletedAt: null,
        season: { deletedAt: null, league: { deletedAt: null } },
        homeTeam: { deletedAt: null },
        awayTeam: { deletedAt: null }
      },
      include: {
        homeTeam: true,
        awayTeam: true,
        season: { include: { league: true } },
        stats: { where: { deletedAt: null }, select: { id: true, teamId: true, points: true } }
      },
      orderBy: [{ gameDate: "asc" }, { gameNumber: "asc" }]
    })
  ]);

  const activeTeamIds = new Set<string>();
  const groups = new Map<string, ContextGroup>();

  for (const game of games) {
    const gender = inferGender(game.season.league.name, game.homeTeam.name, game.awayTeam.name);
    const base = {
      ageGroup: game.season.league.ageGroup,
      gender,
      leagueId: game.season.leagueId,
      leagueName: game.season.league.name,
      seasonId: game.seasonId,
      seasonName: game.season.name
    };

    for (const side of ["home", "away"] as const) {
      const team = side === "home" ? game.homeTeam : game.awayTeam;
      const pointsFor = side === "home" ? game.homeScore : game.awayScore;
      const pointsAgainst = side === "home" ? game.awayScore : game.homeScore;
      const publicName = publicDisplayName(team.name);
      const key = contextKey([publicName, base.ageGroup, base.gender, base.leagueId, base.seasonId]);
      activeTeamIds.add(team.id);

      const group = groups.get(key) ?? {
        classification: "EXPECTED_SINGLE",
        publicSchoolDisplayName: publicName,
        ...base,
        teams: []
      };

      let usage = group.teams.find((row) => row.teamId === team.id);
      if (!usage) {
        usage = {
          teamId: team.id,
          teamName: team.name,
          city: team.city,
          region: team.region,
          gamesPlayed: 0,
          wins: 0,
          losses: 0,
          pointsFor: 0,
          pointsAgainst: 0,
          gameStatsCount: 0,
          gameNumbers: [],
          firstGameDate: null,
          lastGameDate: null
        };
        group.teams.push(usage);
      }

      usage.gamesPlayed += 1;
      usage.wins += pointsFor > pointsAgainst ? 1 : 0;
      usage.losses += pointsFor > pointsAgainst ? 0 : 1;
      usage.pointsFor += pointsFor;
      usage.pointsAgainst += pointsAgainst;
      usage.gameStatsCount += game.stats.filter((stat) => stat.teamId === team.id).length;
      if (game.gameNumber) usage.gameNumbers.push(game.gameNumber);
      const gameDate = game.gameDate.toISOString().slice(0, 10);
      usage.firstGameDate = usage.firstGameDate && usage.firstGameDate < gameDate ? usage.firstGameDate : gameDate;
      usage.lastGameDate = usage.lastGameDate && usage.lastGameDate > gameDate ? usage.lastGameDate : gameDate;

      groups.set(key, group);
    }
  }

  const contextGroups = Array.from(groups.values()).map((group) => ({
    ...group,
    classification: group.teams.length > 1 ? "DUPLICATE_SAME_CONTEXT" as const : "EXPECTED_SINGLE" as const,
    teams: group.teams.sort((left, right) => left.teamName.localeCompare(right.teamName))
  })).sort((left, right) => left.publicSchoolDisplayName.localeCompare(right.publicSchoolDisplayName)
    || left.ageGroup.localeCompare(right.ageGroup)
    || left.gender.localeCompare(right.gender)
    || left.leagueName.localeCompare(right.leagueName));

  const duplicateGroups = contextGroups.filter((group) => group.classification === "DUPLICATE_SAME_CONTEXT");
  const schoolContextCounts = new Map<string, Set<string>>();
  for (const group of contextGroups) {
    const contexts = schoolContextCounts.get(group.publicSchoolDisplayName) ?? new Set<string>();
    contexts.add(contextKey([group.ageGroup, group.gender, group.leagueId, group.seasonId]));
    schoolContextCounts.set(group.publicSchoolDisplayName, contexts);
  }

  const expectedMultiContextGroups = Array.from(schoolContextCounts.entries())
    .filter(([, contexts]) => contexts.size > 1)
    .map(([publicSchoolDisplayName]) => ({
      classification: "EXPECTED_MULTI_CONTEXT" as const,
      publicSchoolDisplayName,
      contexts: contextGroups
        .filter((group) => group.publicSchoolDisplayName === publicSchoolDisplayName)
        .map((group) => ({
          ageGroup: group.ageGroup,
          gender: group.gender,
          leagueId: group.leagueId,
          leagueName: group.leagueName,
          seasonId: group.seasonId,
          seasonName: group.seasonName,
          internalTeamNames: group.teams.map((team) => team.teamName)
        }))
    }))
    .sort((left, right) => left.publicSchoolDisplayName.localeCompare(right.publicSchoolDisplayName));

  const inactiveOrUnclear = teams
    .filter((team) => !activeTeamIds.has(team.id))
    .map((team) => ({
      classification: "INACTIVE_OR_UNCLEAR" as const,
      teamId: team.id,
      teamName: team.name,
      publicSchoolDisplayName: publicDisplayName(team.name),
      city: team.city,
      region: team.region,
      reason: "No active official games found for this Team record. Do not merge automatically without historical/archive review."
    }))
    .sort((left, right) => left.publicSchoolDisplayName.localeCompare(right.publicSchoolDisplayName) || left.teamName.localeCompare(right.teamName));

  const proposedDuplicateRepairs = duplicateGroups.map((group) => {
    const preferredExisting = group.teams.find((team) => team.teamName === canonicalName(group.publicSchoolDisplayName, group.ageGroup, group.gender))
      ?? group.teams.find((team) => team.teamName.includes(group.ageGroup) && team.teamName.toLowerCase().includes(group.gender.toLowerCase()))
      ?? group.teams.slice().sort((left, right) => right.gamesPlayed - left.gamesPlayed || right.gameStatsCount - left.gameStatsCount)[0];
    const affectedGames = new Set(group.teams.flatMap((team) => team.gameNumbers));

    return {
      publicSchoolDisplayName: group.publicSchoolDisplayName,
      ageGroup: group.ageGroup,
      gender: group.gender,
      leagueId: group.leagueId,
      leagueName: group.leagueName,
      seasonId: group.seasonId,
      seasonName: group.seasonName,
      canonicalTeamName: canonicalName(group.publicSchoolDisplayName, group.ageGroup, group.gender),
      canonicalTeamId: preferredExisting?.teamId ?? null,
      canonicalTeamIdReason: preferredExisting ? "Existing record selected by context-aware name or largest active usage." : "No existing record available; create context-aware Team first.",
      teamsToReassignFrom: group.teams.filter((team) => team.teamId !== preferredExisting?.teamId).map((team) => ({ teamId: team.teamId, teamName: team.teamName, gamesPlayed: team.gamesPlayed, gameStatsCount: team.gameStatsCount })),
      affectedGamesCount: affectedGames.size,
      affectedGameStatsCount: group.teams.reduce((sum, team) => sum + team.gameStatsCount, 0),
      ratingsRecomputationNeeded: false,
      ratingsImpactReason: "GamePerformanceScore, PlayerRating, and RankingSnapshot rows do not store Team ID; if only Game.homeTeamId/awayTeamId and GameStat.teamId change while GameStat/player/stat values remain unchanged, ratings recomputation is not needed.",
      riskLevel: riskLevel(group)
    };
  });

  const aliasChecks = aliasNeedles.map((alias) => {
    const needle = alias.toLowerCase();
    const relatedTeams = teams.filter((team) => team.name.toLowerCase().includes(needle) || publicDisplayName(team.name).toLowerCase().includes(needle));
    return {
      alias,
      teams: relatedTeams.map((team) => ({ teamId: team.id, teamName: team.name, publicSchoolDisplayName: publicDisplayName(team.name), activeContextCount: contextsForTeam(contextGroups, team.id).length })),
      duplicateSameContextGroups: duplicateGroups.filter((group) => group.teams.some((team) => relatedTeams.some((related) => related.id === team.teamId))).map((group) => ({
        publicSchoolDisplayName: group.publicSchoolDisplayName,
        ageGroup: group.ageGroup,
        gender: group.gender,
        leagueName: group.leagueName,
        seasonName: group.seasonName,
        internalTeamNames: group.teams.map((team) => team.teamName)
      }))
    };
  });

  const affectedGames = new Set(duplicateGroups.flatMap((group) => group.teams.flatMap((team) => team.gameNumbers)));
  const repairedU16Touched = duplicateGroups.some((group) => group.teams.some((team) => repairedU16TeamNames.has(team.teamName)));
  const repairedU19DlszTouched = duplicateGroups.some((group) => group.teams.some((team) => repairedU19DlszTeamNames.has(team.teamName)));

  const report = {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    classificationRules: [
      "EXPECTED_SINGLE: one active Team record for one public school inside one ageGroup/gender/league/season context.",
      "EXPECTED_MULTI_CONTEXT: same public school has teams across different age groups, genders, leagues, or seasons.",
      "DUPLICATE_SAME_CONTEXT: more than one active Team record maps to the same public school inside the same ageGroup/gender/league/season context.",
      "INACTIVE_OR_UNCLEAR: active Team record has no active official game context. List separately; do not merge automatically."
    ],
    summary: {
      activeTeamsInspected: teams.length,
      activeOfficialGamesInspected: games.length,
      contextGroups: contextGroups.length,
      expectedSingleGroups: contextGroups.filter((group) => group.classification === "EXPECTED_SINGLE").length,
      expectedMultiContextSchoolGroups: expectedMultiContextGroups.length,
      duplicateSameContextGroups: duplicateGroups.length,
      inactiveOrUnclearTeams: inactiveOrUnclear.length,
      affectedGames: affectedGames.size,
      affectedGameStats: duplicateGroups.reduce((sum, group) => sum + group.teams.reduce((inner, team) => inner + team.gameStatsCount, 0), 0),
      repairedU16TeamsWouldBeTouched: repairedU16Touched,
      repairedU19DlszTeamsWouldBeTouched: repairedU19DlszTouched,
      ratingsRecomputationNeeded: false
    },
    duplicateSameContextGroups: duplicateGroups,
    proposedDuplicateRepairs,
    expectedMultiContextGroups,
    inactiveOrUnclear,
    aliasChecks,
    safetySummary: {
      totalDuplicateGroups: duplicateGroups.length,
      totalAffectedGames: affectedGames.size,
      totalAffectedGameStats: duplicateGroups.reduce((sum, group) => sum + group.teams.reduce((inner, team) => inner + team.gameStatsCount, 0), 0),
      anyU16RepairedTeamsWouldBeTouched: repairedU16Touched,
      anyU19RepairedDlszTeamsWouldBeTouched: repairedU19DlszTouched,
      recommendedRepairOrder: [
        "Review all DUPLICATE_SAME_CONTEXT groups with high risk first.",
        "For each group, approve one canonical context-aware Team record or approve creation of a missing canonical Team.",
        "Repair one public school/context group per transaction.",
        "After each repair, validate active game counts, GameStats counts, point totals, and dynamic /teams standings.",
        "Leave INACTIVE_OR_UNCLEAR teams untouched until archived/test-data policy is confirmed."
      ]
    }
  };

  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    reportPath,
    readOnly: true,
    summary: report.summary,
    duplicateSameContextGroups: duplicateGroups.map((group) => ({
      publicSchoolDisplayName: group.publicSchoolDisplayName,
      ageGroup: group.ageGroup,
      gender: group.gender,
      leagueName: group.leagueName,
      seasonName: group.seasonName,
      internalTeamNames: group.teams.map((team) => team.teamName),
      affectedGames: new Set(group.teams.flatMap((team) => team.gameNumbers)).size,
      affectedGameStats: group.teams.reduce((sum, team) => sum + team.gameStatsCount, 0)
    })),
    inactiveOrUnclearTeams: inactiveOrUnclear.length,
    ratingsRecomputationNeeded: false
  }, null, 2));
}

function contextsForTeam(groups: ContextGroup[], teamId: string) {
  return groups.filter((group) => group.teams.some((team) => team.teamId === teamId));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});