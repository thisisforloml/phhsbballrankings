import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const prisma = new PrismaClient();
const reportPath = join(process.cwd(), "scripts", "reports", "admin-program-cleanup-audit.json");

type Action = "KEEP_ACTIVE" | "HIDE_INACTIVE" | "MERGE_DUPLICATE" | "DELETE_IF_TEST_ONLY" | "NEEDS_REVIEW";

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(jr|jrs|u13|u16|u19|boys|girls|hs|high|school|team)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactName(value: string) {
  return normalizeName(value).replace(/\s+/g, "");
}

function inferGender(...values: Array<string | null | undefined>) {
  return values.filter(Boolean).join(" ").toLowerCase().includes("girls") ? "Girls" : "Boys";
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function similarity(left: string, right: string) {
  const a = compactName(left);
  const b = compactName(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.9;
  const aSet = new Set(a.split(""));
  const bSet = new Set(b.split(""));
  const intersection = Array.from(aSet).filter((char) => bSet.has(char)).length;
  const union = new Set([...aSet, ...bSet]).size;
  return union ? intersection / union : 0;
}

async function main() {
  const [programs, players, adminFiles] = await Promise.all([
    prisma.program.findMany({
      where: { deletedAt: null },
      include: {
        teams: {
          where: { deletedAt: null },
          include: {
            _count: { select: { homeGames: true, awayGames: true, gameStats: true } },
            homeGames: { where: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } }, include: { season: { include: { league: true } }, awayTeam: true } },
            awayGames: { where: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } }, include: { season: { include: { league: true } }, homeTeam: true } },
            gameStats: { where: { deletedAt: null, game: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } } }, select: { id: true, playerId: true } }
          },
          orderBy: { name: "asc" }
        }
      },
      orderBy: { fullName: "asc" }
    }),
    prisma.player.findMany({
      where: { deletedAt: null },
      include: {
        currentProgram: true,
        gameStats: { where: { deletedAt: null }, select: { id: true } },
        currentRatings: { select: { id: true, ageGroup: true } },
        rankingRows: { select: { id: true, snapshot: { select: { ageGroup: true, gender: true, weekOf: true } } } }
      },
      orderBy: { displayName: "asc" }
    }),
    Promise.resolve([
      "/admin",
      "/admin/submissions",
      "/admin/programs",
      "/admin/programs/[id]",
      "/admin/players",
      "/admin/teams",
      "/rankings"
    ])
  ]);

  const teamDuplicateGroups: any[] = [];
  const programReports = programs.map((program) => {
    const contextTeams = new Map<string, Array<(typeof program.teams)[number]>>();
    const activeTeams: any[] = [];
    const inactiveTeams: any[] = [];

    for (const team of program.teams) {
      const games = Array.from(new Map([...team.homeGames, ...team.awayGames].map((game) => [game.id, game])).values());
      const contexts = uniqueSorted(games.map((game) => `${game.season.league.ageGroup} ${inferGender(game.season.league.name, team.name)} / ${game.season.league.name} / ${game.season.name}`));
      const gameNumbers = uniqueSorted(games.map((game) => game.gameNumber ?? "Unnumbered"));
      const activeUsage = games.length > 0 || team.gameStats.length > 0;
      for (const context of contexts) {
        const list = contextTeams.get(context) ?? [];
        list.push(team);
        contextTeams.set(context, list);
      }
      const row = {
        teamId: team.id,
        name: team.name,
        city: team.city,
        region: team.region,
        activeGames: games.length,
        activeGameStats: team.gameStats.length,
        historicalHomeGames: team._count.homeGames,
        historicalAwayGames: team._count.awayGames,
        historicalGameStats: team._count.gameStats,
        hasHistoricalUsage: team._count.homeGames + team._count.awayGames + team._count.gameStats > 0,
        contexts,
        gameNumbers
      };
      if (activeUsage) activeTeams.push({ ...row, recommendedAction: "KEEP_ACTIVE" as Action });
      else inactiveTeams.push({ ...row, recommendedAction: row.hasHistoricalUsage ? "HIDE_INACTIVE" as Action : "DELETE_IF_TEST_ONLY" as Action });
    }

    const duplicateGroups = Array.from(contextTeams.entries())
      .filter(([, teams]) => teams.length > 1)
      .map(([context, teams]) => {
        const group = {
          programId: program.id,
          programFullName: program.fullName,
          context,
          teams: teams.map((team) => ({
            teamId: team.id,
            name: team.name,
            activeGames: new Set([...team.homeGames, ...team.awayGames].map((game) => game.id)).size,
            activeGameStats: team.gameStats.length
          })),
          affectedGames: new Set(teams.flatMap((team) => [...team.homeGames, ...team.awayGames].map((game) => game.id))).size,
          affectedGameStats: teams.reduce((sum, team) => sum + team.gameStats.length, 0),
          recommendedAction: "NEEDS_REVIEW" as Action
        };
        teamDuplicateGroups.push(group);
        return group;
      });

    const safeToHideInactive = inactiveTeams.filter((team) => team.recommendedAction === "HIDE_INACTIVE" || team.recommendedAction === "DELETE_IF_TEST_ONLY").length;
    return {
      programId: program.id,
      fullName: program.fullName,
      abbreviation: program.abbreviation,
      type: program.type,
      activeTeams,
      inactiveTeams,
      possibleDuplicateTeams: duplicateGroups,
      inactiveRecordsHaveHistoricalUsage: inactiveTeams.some((team) => team.hasHistoricalUsage),
      safeToRemoveHideMerge: {
        hideInactiveCount: safeToHideInactive,
        mergeDuplicateCount: duplicateGroups.length,
        deleteIfTestOnlyCount: inactiveTeams.filter((team) => team.recommendedAction === "DELETE_IF_TEST_ONLY").length
      },
      recommendedAction: duplicateGroups.length ? "NEEDS_REVIEW" as Action : activeTeams.length ? "KEEP_ACTIVE" as Action : "HIDE_INACTIVE" as Action
    };
  });

  const teamSimilarNameGroups: any[] = [];
  for (const program of programs) {
    for (let i = 0; i < program.teams.length; i += 1) {
      for (let j = i + 1; j < program.teams.length; j += 1) {
        const left = program.teams[i];
        const right = program.teams[j];
        const score = similarity(left.name, right.name);
        if (score >= 0.88) {
          teamSimilarNameGroups.push({
            programId: program.id,
            programFullName: program.fullName,
            teams: [
              { teamId: left.id, name: left.name, activeGameStats: left.gameStats.length },
              { teamId: right.id, name: right.name, activeGameStats: right.gameStats.length }
            ],
            similarityScore: Number(score.toFixed(2)),
            recommendedAction: left.gameStats.length && right.gameStats.length ? "NEEDS_REVIEW" : "HIDE_INACTIVE"
          });
        }
      }
    }
  }

  const playerDuplicateGroups: any[] = [];
  const byNormalizedName = new Map<string, typeof players>();
  for (const player of players) {
    const key = normalizeName(player.displayName);
    const list = byNormalizedName.get(key) ?? [];
    list.push(player);
    byNormalizedName.set(key, list);
  }
  for (const [normalizedName, group] of byNormalizedName.entries()) {
    if (group.length > 1) {
      const currentProgramIds = new Set(group.map((player) => player.currentProgramId ?? "none"));
      const genders = new Set(group.map((player) => player.gender));
      playerDuplicateGroups.push({
        matchType: currentProgramIds.size === 1 ? "exact_normalized_name_same_currentProgramId" : genders.size === 1 ? "exact_normalized_name_same_gender" : "exact_normalized_name_mixed_context",
        normalizedName,
        players: group.map((player) => ({
          playerId: player.id,
          displayName: player.displayName,
          gender: player.gender,
          currentProgramId: player.currentProgramId,
          currentProgram: player.currentProgram?.fullName ?? null,
          gameStatCount: player.gameStats.length,
          playerRatingCount: player.currentRatings.length,
          rankingSnapshotRowCount: player.rankingRows.length
        })),
        recommendedAction: currentProgramIds.size === 1 && genders.size === 1 ? "MERGE_SAFE" : "NEEDS_REVIEW"
      });
    }
  }

  const similarPlayerGroups: any[] = [];
  for (let i = 0; i < players.length; i += 1) {
    for (let j = i + 1; j < players.length; j += 1) {
      const left = players[i];
      const right = players[j];
      if (left.currentProgramId !== right.currentProgramId || !left.currentProgramId) continue;
      const score = similarity(left.displayName, right.displayName);
      if (score >= 0.92 && normalizeName(left.displayName) !== normalizeName(right.displayName)) {
        similarPlayerGroups.push({
          matchType: "very_similar_name_same_program",
          similarityScore: Number(score.toFixed(2)),
          players: [left, right].map((player) => ({
            playerId: player.id,
            displayName: player.displayName,
            gender: player.gender,
            currentProgramId: player.currentProgramId,
            currentProgram: player.currentProgram?.fullName ?? null,
            gameStatCount: player.gameStats.length,
            playerRatingCount: player.currentRatings.length,
            rankingSnapshotRowCount: player.rankingRows.length
          })),
          recommendedAction: "NEEDS_REVIEW"
        });
      }
    }
  }

  const playerGroupingPlan = programReports.map((program) => ({
    programId: program.programId,
    fullName: program.fullName,
    groupPlayersBy: "current active Team / Moniker",
    activeTeamPlayerCounts: program.activeTeams.map((team: any) => ({ teamId: team.teamId, name: team.name, playerCount: new Set(programs.find((p) => p.id === program.programId)?.teams.find((t) => t.id === team.teamId)?.gameStats.map((stat) => stat.playerId) ?? []).size })),
    multiTeamPlayersHandling: "Show player once under each active team they played for, with a badge when they appear on multiple teams under the same Program.",
    currentProgramMismatchHandling: "If Player.currentProgramId differs from the derived team Program, show a warning badge and offer Edit only / Transfer controls. Do not change GameStats."
  }));

  const report = {
    generatedAt: new Date().toISOString(),
    scope: "read-only admin cleanup audit",
    adminRouteAudit: {
      inspectedRoutes: adminFiles,
      primaryRoutesRecommended: ["/admin", "/admin/submissions", "/admin/programs", "/rankings"],
      demoteOrHideRoutesRecommended: [
        { route: "/admin/players", recommendation: "DEMOTE", reason: "Keep as player search/editing, but move Program/team-context player editing into Program detail." },
        { route: "/admin/teams", recommendation: "HIDE_OR_LEGACY", reason: "Program Management should be the main editor. Teams page should remain compatibility-only until removed." }
      ]
    },
    playerEditFieldsToMoveIntoProgramDetail: [
      "displayName",
      "firstName",
      "lastName",
      "currentProgramId / current school-program",
      "schoolOverride if retained as fallback",
      "classYearOverride",
      "position",
      "heightCm with ft/in helper",
      "city",
      "region",
      "birthDate",
      "ageGroupOverride",
      "photoUrl",
      "transfer mode and transfer history"
    ],
    programTeamRecords: programReports,
    playerGroupingPlan,
    duplicatePlayerAudit: {
      exactOrConservativeGroups: playerDuplicateGroups,
      verySimilarNameSameProgramGroups: similarPlayerGroups,
      totalGroups: playerDuplicateGroups.length + similarPlayerGroups.length
    },
    duplicateTeamAudit: {
      sameContextGroups: teamDuplicateGroups,
      similarNameSameProgramGroups: teamSimilarNameGroups,
      totalGroups: teamDuplicateGroups.length + teamSimilarNameGroups.length
    },
    summary: {
      programsInspected: programReports.length,
      inactiveTeamRecordsCount: programReports.reduce((sum, program) => sum + program.inactiveTeams.length, 0),
      safeToHideInactiveRecordsCount: programReports.reduce((sum, program) => sum + program.safeToRemoveHideMerge.hideInactiveCount, 0),
      possibleTeamDuplicateGroups: teamDuplicateGroups.length + teamSimilarNameGroups.length,
      possiblePlayerDuplicateGroups: playerDuplicateGroups.length + similarPlayerGroups.length,
      adminPagesToDemoteOrRemove: ["/admin/players", "/admin/teams"],
      recommendedNextImplementationSteps: [
        "Make /admin/programs/[id] the unified editor for Program, Team/Moniker, and Player fields.",
        "Group players under active Team / Moniker sections on Program detail pages.",
        "Move player bio editing controls from /admin/players into Program detail player rows or drawer.",
        "Keep /admin/players as search-only or redirect to Program detail after selection.",
        "Hide /admin/teams from primary navigation and keep as compatibility-only until approved cleanup is complete.",
        "Create separate approved repair scripts for any duplicate Team or Player groups before merging/deleting.",
        "For inactive Team records with no historical usage, prepare a test-only deletion plan; for inactive records with historical usage, hide by default instead of deleting."
      ]
    }
  };

  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report.summary, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
