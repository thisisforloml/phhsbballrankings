import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { prisma } from "../src/lib/prisma";
import { normalizeCompetitionDisplayName } from "../src/lib/competition-naming";
import { getTeamDisplayName, normalizeProgramAlias } from "../src/lib/uaap-school-display";

type LoadedTeam = Awaited<ReturnType<typeof loadPrograms>>[number]["teams"][number];

const reportPath = join(process.cwd(), "scripts", "reports", "suffix-team-duplicate-repair-plan.json");
const approvedPrimeAscencionRepair = {
  programId: "10bdfbd4-397c-4f00-a29d-6fc6bb2b76f2",
  canonicalTeamId: "5a0d52b6-a998-455f-b5ab-4c8ea538e32a",
  duplicateTeamId: "cfcaa1ea-9166-458b-9140-fd8df2d7507e",
  approvedGameNumbers: [
    "G-2025-011",
    "G-2025-012",
    "G-2025-014",
    "G-2025-026",
    "G-2025-027"
  ]
};
const approvedPybcTeamDuplicateRepairs = [
  {
    participantName: "JMTG Medical Trading Infinite",
    programId: "7e62a36c-4691-497a-990f-201a0ca42810",
    canonicalTeamId: "bf8f1578-6a68-4991-9966-da32aff82f60",
    duplicateTeamId: "c17caa40-d059-4348-ad63-3b31f5b35b80",
    approvedGameNumbers: ["G-2025-013", "G-2025-015", "G-2025-019", "G-2025-020", "G-2025-024", "G-2025-026"],
    expectedGameStats: 82
  },
  {
    participantName: "Migrafix Doc Boleros",
    programId: "132b41bb-5470-4a52-b295-5625177566cd",
    canonicalTeamId: "f0063ff0-31f0-45ad-8efe-86905b479163",
    duplicateTeamId: "c66313bf-145d-4486-a5a0-a207b1c4aa94",
    approvedGameNumbers: ["G-2025-013", "G-2025-016", "G-2025-018", "G-2025-023"],
    expectedGameStats: 46
  },
  {
    participantName: "Migueluz Trading Moderno",
    programId: "68b06396-32af-4b8c-9c5d-7ff2fbb5817d",
    canonicalTeamId: "efbfd74c-0a70-4764-82df-65f2a883b92b",
    duplicateTeamId: "efcab0cf-4a7e-4c2c-a010-98a13e0beecb",
    approvedGameNumbers: ["G-2025-012", "G-2025-015", "G-2025-018", "G-2025-022", "G-2025-028"],
    expectedGameStats: 59
  },
  {
    participantName: "Prime Ascencion Medical Supplies San Anton",
    programId: approvedPrimeAscencionRepair.programId,
    canonicalTeamId: approvedPrimeAscencionRepair.canonicalTeamId,
    duplicateTeamId: approvedPrimeAscencionRepair.duplicateTeamId,
    approvedGameNumbers: approvedPrimeAscencionRepair.approvedGameNumbers,
    expectedGameStats: 53
  },
  {
    participantName: "Smile 360 Bullies",
    programId: "58f9e2a2-fe97-44bf-b4d7-caf0164637d9",
    canonicalTeamId: "48b03b46-91b7-4acb-9b85-1a8278c33773",
    duplicateTeamId: "b961adec-77e3-4b3b-ab2e-d1868644a633",
    approvedGameNumbers: ["G-2025-005", "G-2025-007", "G-2025-009", "G-2025-014", "G-2025-024", "G-2025-025"],
    expectedGameStats: 73
  }
];

type DuplicateGroup = ReturnType<typeof buildDuplicateGroup>;
type TargetArgs = {
  programId?: string;
  canonicalTeamId?: string;
  duplicateTeamId?: string;
};

function isExecuteRequested() {
  return process.argv.includes("--execute");
}

function isPybcReadyRepairRequested() {
  return process.argv.includes("--repair-pybc-ready-suffix-duplicates");
}

function isApprovedPybcTeamRepairRequested() {
  return process.argv.includes("--repair-approved-pybc-team-duplicates");
}

function argValue(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function targetArgs(): TargetArgs {
  return {
    programId: argValue("--program-id"),
    canonicalTeamId: argValue("--canonical-team-id"),
    duplicateTeamId: argValue("--duplicate-team-id")
  };
}

function hasTargetArgs(args: TargetArgs) {
  return Boolean(args.programId || args.canonicalTeamId || args.duplicateTeamId);
}

function hasCompleteTargetArgs(args: TargetArgs) {
  return Boolean(args.programId && args.canonicalTeamId && args.duplicateTeamId);
}

function uniqueSorted(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort((left, right) => left.localeCompare(right));
}

function formatDate(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : null;
}

function inferGender(...values: Array<string | null | undefined>) {
  return values.filter(Boolean).join(" ").toLowerCase().includes("girls") ? "Girls" : "Boys";
}

function displayKey(teamName: string) {
  return normalizeProgramAlias(getTeamDisplayName(teamName));
}

function isLeagueContextProgram(fullName: string) {
  return normalizeProgramAlias(fullName) === normalizeProgramAlias("PYBC 15U");
}

function hasSuffixOnlyContext(teamName: string) {
  return /\b(?:U|UNDER)[ -]?(?:13|16|19)\s*(?:BOYS|GIRLS)?\b/i.test(teamName)
    || /\b(?:13U|16U|19U)\s*(?:BOYS|GIRLS)?\b/i.test(teamName)
    || /\b(?:BOYS|GIRLS)\b$/i.test(teamName);
}

function activeGamesForTeam(team: LoadedTeam) {
  const games = new Map<string, LoadedTeam["homeGames"][number] | LoadedTeam["awayGames"][number]>();
  for (const game of team.homeGames) games.set(game.id, game);
  for (const game of team.awayGames) games.set(game.id, game);
  return Array.from(games.values());
}

function teamEvidence(team: LoadedTeam) {
  const games = activeGamesForTeam(team);
  const contexts = uniqueSorted(games.map((game) => {
    const gender = inferGender(game.season.league.name, team.name);
    return `${game.season.league.ageGroup} ${gender} / ${normalizeCompetitionDisplayName(game.season.league.name)} / ${game.season.name}`;
  }));

  return {
    teamId: team.id,
    teamName: team.name,
    displayName: getTeamDisplayName(team.name),
    cleanedDisplayKey: displayKey(team.name),
    hasSuffixOnlyContext: hasSuffixOnlyContext(team.name),
    ageGroups: uniqueSorted(games.map((game) => String(game.season.league.ageGroup))),
    genders: uniqueSorted(games.map((game) => inferGender(game.season.league.name, team.name))),
    leagues: uniqueSorted(games.map((game) => game.season.league.name)),
    seasons: uniqueSorted(games.map((game) => game.season.name)),
    contexts,
    gameRefs: games.map((game) => ({
      gameId: game.id,
      gameNumber: game.gameNumber,
      gameDate: formatDate(game.gameDate),
      league: game.season.league.name,
      normalizedLeague: normalizeCompetitionDisplayName(game.season.league.name),
      season: game.season.name,
      ageGroup: String(game.season.league.ageGroup),
      gender: inferGender(game.season.league.name, team.name),
      homeTeamId: game.homeTeamId,
      awayTeamId: game.awayTeamId,
      homeScore: game.homeScore,
      awayScore: game.awayScore
    })).sort((left, right) => String(left.gameNumber).localeCompare(String(right.gameNumber), undefined, { numeric: true })),
    gameCount: games.length,
    gameStatCount: team.gameStats.length
  };
}

function chooseCanonical(teams: ReturnType<typeof teamEvidence>[]) {
  return teams.slice().sort((left, right) => {
    const leftCleanExact = left.teamName === left.displayName ? 1 : 0;
    const rightCleanExact = right.teamName === right.displayName ? 1 : 0;
    if (rightCleanExact !== leftCleanExact) return rightCleanExact - leftCleanExact;
    if (left.hasSuffixOnlyContext !== right.hasSuffixOnlyContext) return left.hasSuffixOnlyContext ? 1 : -1;
    if (right.gameCount !== left.gameCount) return right.gameCount - left.gameCount;
    if (right.gameStatCount !== left.gameStatCount) return right.gameStatCount - left.gameStatCount;
    return left.teamName.localeCompare(right.teamName);
  })[0];
}

function sameContext(teams: ReturnType<typeof teamEvidence>[]) {
  const allContexts = teams.map((team) => new Set(team.contexts));
  if (allContexts.some((contexts) => contexts.size === 0)) return false;
  const [first, ...rest] = allContexts;
  return rest.every((contexts) => contexts.size === first.size && Array.from(contexts).every((context) => first.has(context)));
}

function sameStringSet(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((value) => rightSet.has(value));
}

function hasOnlyPybcEvidence(team: ReturnType<typeof teamEvidence>) {
  return team.gameRefs.length > 0 && team.gameRefs.every((game) => game.normalizedLeague === "PYBC 15U");
}

function isPybcReadyDuplicateGroup(group: DuplicateGroup) {
  return group.classification === "READY_FOR_APPROVAL"
    && !isLeagueContextProgram(group.program.fullName)
    && group.allTeams.every(hasOnlyPybcEvidence);
}

function groupExclusionReason(group: DuplicateGroup) {
  const names = [
    group.program.fullName,
    group.canonicalTeam.teamName,
    ...group.duplicateTeams.map((team) => team.teamName)
  ].join(" ").toLowerCase();

  if (isLeagueContextProgram(group.program.fullName)) {
    return "PYBC 15U is league/competition context, not a Program target.";
  }
  if (names.includes("sbu") || names.includes("jpm-tec") || names.includes("san beda")) {
    return "Excluded because SBU/JPM-TEC San Beda identity requires explicit admin review.";
  }
  if (group.classification !== "READY_FOR_APPROVAL") {
    return "Excluded because the diagnostic classified this group as NEEDS_REVIEW.";
  }
  if (!group.allTeams.every(hasOnlyPybcEvidence)) {
    return "Excluded because the group is not exclusively active PYBC game/stat evidence.";
  }
  return null;
}

function pybcReadyGroups(report: Awaited<ReturnType<typeof buildReport>>) {
  return report.duplicateGroups.filter(isPybcReadyDuplicateGroup);
}

function groupForApprovedRepair(report: Awaited<ReturnType<typeof buildReport>>, repair: typeof approvedPybcTeamDuplicateRepairs[number]) {
  return report.duplicateGroups.find((group) => group.program.programId === repair.programId
    && group.canonicalTeam.teamId === repair.canonicalTeamId
    && group.duplicateTeams.some((team) => team.teamId === repair.duplicateTeamId));
}

function approvedRepairFromReport(report: Awaited<ReturnType<typeof buildReport>>, repair: typeof approvedPybcTeamDuplicateRepairs[number]) {
  const group = groupForApprovedRepair(report, repair);
  if (!group) {
    throw new Error(`Approved repair group was not found for ${repair.participantName}.`);
  }
  if (group.program.programId !== repair.programId || group.canonicalTeam.teamId !== repair.canonicalTeamId) {
    throw new Error(`Approved repair target mismatch for ${repair.participantName}.`);
  }
  const duplicateTeam = group.duplicateTeams.find((team) => team.teamId === repair.duplicateTeamId);
  const reassignment = group.proposedReassignments.find((item) => item.fromTeamId === repair.duplicateTeamId);
  if (!duplicateTeam || !reassignment) {
    throw new Error(`Approved duplicate Team was not found for ${repair.participantName}.`);
  }
  if (!sameStringSet(reassignment.gameNumbersToUpdate.map(String), repair.approvedGameNumbers)) {
    throw new Error(`Approved game refs changed for ${repair.participantName}. Found ${reassignment.gameNumbersToUpdate.join(", ")}`);
  }
  if (reassignment.gameStatsToUpdate !== repair.expectedGameStats) {
    throw new Error(`Approved GameStat count changed for ${repair.participantName}. Expected ${repair.expectedGameStats}, found ${reassignment.gameStatsToUpdate}.`);
  }
  if (!duplicateTeam.gameRefs.every((game) => game.normalizedLeague === "PYBC 15U")) {
    throw new Error(`Non-PYBC game found in approved repair scope for ${repair.participantName}.`);
  }
  return { repair, group, duplicateTeam, reassignment };
}

function excludedGroupSummary(report: Awaited<ReturnType<typeof buildReport>>) {
  const excluded = report.duplicateGroups.filter((group) => !isPybcReadyDuplicateGroup(group));
  const reasons = new Map<string, number>();

  for (const group of excluded) {
    const reason = groupExclusionReason(group) ?? "Excluded by PYBC-only ready-group guardrails.";
    reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
  }

  return {
    totalExcludedGroups: excluded.length,
    byReason: Array.from(reasons.entries()).map(([reason, count]) => ({ reason, count })),
    groups: excluded.map((group) => ({
      programId: group.program.programId,
      programName: group.program.fullName,
      classification: group.classification,
      reason: groupExclusionReason(group) ?? "Excluded by PYBC-only ready-group guardrails.",
      teamNames: group.allTeams.map((team) => team.teamName)
    }))
  };
}

function buildDuplicateGroup(
  program: Awaited<ReturnType<typeof loadPrograms>>[number],
  cleanedDisplayKey: string,
  teams: ReturnType<typeof teamEvidence>[]
) {
  const canonical = chooseCanonical(teams);
  const duplicateTeams = teams.filter((team) => team.teamId !== canonical.teamId);
  const safeSameContext = sameContext(teams);

  return {
    program: {
      programId: program.id,
      fullName: program.fullName,
      abbreviation: program.abbreviation,
      type: program.type
    },
    cleanedDisplayKey,
    classification: safeSameContext ? "READY_FOR_APPROVAL" : "NEEDS_REVIEW",
    reason: safeSameContext
      ? "Same Program and same cleaned display key with matching active age/gender/league/season context."
      : "Same Program and same cleaned display key, but context differs or is incomplete; review before repair.",
    canonicalTeam: canonical,
    duplicateTeams,
    proposedReassignments: duplicateTeams.map((team) => ({
      fromTeamId: team.teamId,
      fromTeamName: team.teamName,
      toTeamId: canonical.teamId,
      toTeamName: canonical.teamName,
      gamesToUpdate: team.gameRefs.map((game) => game.gameId),
      gameNumbersToUpdate: team.gameRefs.map((game) => game.gameNumber),
      gameStatsToUpdate: team.gameStatCount,
      ratingsSnapshotsUnaffected: true
    })),
    allTeams: teams
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
            include: { season: { include: { league: true } } }
          },
          awayGames: {
            where: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } },
            include: { season: { include: { league: true } } }
          },
          gameStats: {
            where: { deletedAt: null, game: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } } },
            select: { id: true }
          }
        },
        orderBy: { name: "asc" }
      }
    },
    orderBy: { fullName: "asc" }
  });
}

async function buildReport() {
  const programs = await loadPrograms();
  const duplicateGroups = [];

  for (const program of programs) {
    if (isLeagueContextProgram(program.fullName)) continue;

    const groups = new Map<string, ReturnType<typeof teamEvidence>[]>();
    for (const team of program.teams) {
      const evidence = teamEvidence(team);
      const list = groups.get(evidence.cleanedDisplayKey) ?? [];
      list.push(evidence);
      groups.set(evidence.cleanedDisplayKey, list);
    }

    for (const [cleanedDisplayKey, teams] of groups.entries()) {
      if (teams.length < 2) continue;
      if (!teams.some((team) => team.hasSuffixOnlyContext)) continue;

      duplicateGroups.push(buildDuplicateGroup(program, cleanedDisplayKey, teams));
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    mode: "dry-run",
    guardrails: [
      "No database writes were performed.",
      "Groups are constrained to Teams under the same Program.",
      "PYBC 15U is treated as league context and skipped as a Program.",
      "No deletes, merges, rating recomputes, or snapshot changes are performed by this script."
    ],
    summary: {
      programsInspected: programs.length,
      duplicateGroups: duplicateGroups.length,
      readyForApproval: duplicateGroups.filter((group) => group.classification === "READY_FOR_APPROVAL").length,
      needsReview: duplicateGroups.filter((group) => group.classification === "NEEDS_REVIEW").length,
      totalDuplicateTeamsToReassign: duplicateGroups.reduce((sum, group) => sum + group.duplicateTeams.length, 0),
      totalGamesToUpdateIfApproved: duplicateGroups.reduce((sum, group) => sum + group.proposedReassignments.reduce((inner, item) => inner + item.gamesToUpdate.length, 0), 0),
      totalGameStatsToUpdateIfApproved: duplicateGroups.reduce((sum, group) => sum + group.proposedReassignments.reduce((inner, item) => inner + item.gameStatsToUpdate, 0), 0)
    },
    duplicateGroups
  };
}

function findTargetGroup(report: Awaited<ReturnType<typeof buildReport>>, args: Required<TargetArgs>) {
  const group = report.duplicateGroups.find((item) => item.program.programId === args.programId);
  if (!group) {
    throw new Error(`Target Program was not found in the suffix duplicate report: ${args.programId}`);
  }
  if (group.classification !== "READY_FOR_APPROVAL") {
    throw new Error(`Target group is not ready for approval. Current classification: ${group.classification}`);
  }
  if (group.canonicalTeam.teamId !== args.canonicalTeamId) {
    throw new Error(`Canonical Team mismatch. Expected report canonical ${group.canonicalTeam.teamId}, received ${args.canonicalTeamId}`);
  }

  const duplicateTeam = group.duplicateTeams.find((team) => team.teamId === args.duplicateTeamId);
  if (!duplicateTeam) {
    throw new Error(`Duplicate Team was not found in the target group: ${args.duplicateTeamId}`);
  }

  const reassignment = group.proposedReassignments.find((item) => item.fromTeamId === args.duplicateTeamId);
  if (!reassignment) {
    throw new Error(`No proposed reassignment was found for duplicate Team: ${args.duplicateTeamId}`);
  }

  if (args.programId !== approvedPrimeAscencionRepair.programId
    || args.canonicalTeamId !== approvedPrimeAscencionRepair.canonicalTeamId
    || args.duplicateTeamId !== approvedPrimeAscencionRepair.duplicateTeamId) {
    throw new Error("Execute/dry-run target is not the approved Prime Ascencion duplicate group.");
  }

  const gameNumbers = reassignment.gameNumbersToUpdate.map(String);
  if (!sameStringSet(gameNumbers, approvedPrimeAscencionRepair.approvedGameNumbers)) {
    throw new Error(`Approved game refs do not match. Found ${gameNumbers.join(", ")}`);
  }

  return { group, duplicateTeam, reassignment };
}

function targetSummary(group: DuplicateGroup, duplicateTeam: DuplicateGroup["duplicateTeams"][number], reassignment: DuplicateGroup["proposedReassignments"][number]) {
  return {
    program: group.program,
    canonicalTeam: group.canonicalTeam,
    duplicateTeam,
    proposedReassignment: reassignment,
    approvedGameNumbers: approvedPrimeAscencionRepair.approvedGameNumbers,
    executeGuardrails: [
      "Requires explicit --program-id, --canonical-team-id, --duplicate-team-id, and --execute.",
      "Broad execute-all mode is not supported.",
      "Both Teams must belong to the same approved Program.",
      "The duplicate group must be classified READY_FOR_APPROVAL.",
      "Only the 5 approved game refs can be updated.",
      "Only Game.homeTeamId, Game.awayTeamId, and GameStat.teamId rows currently pointing to the duplicate Team can be reassigned.",
      "The duplicate Team is not deleted.",
      "Players, GameStat values, ratings, snapshots, rankings, imports, and submissions are not touched."
    ]
  };
}

function pybcGroupSummary(group: DuplicateGroup) {
  return {
    program: group.program,
    cleanedDisplayKey: group.cleanedDisplayKey,
    canonicalTeam: {
      teamId: group.canonicalTeam.teamId,
      teamName: group.canonicalTeam.teamName,
      displayName: group.canonicalTeam.displayName,
      gameCount: group.canonicalTeam.gameCount,
      gameStatCount: group.canonicalTeam.gameStatCount,
      contexts: group.canonicalTeam.contexts
    },
    duplicateTeams: group.duplicateTeams.map((team) => ({
      teamId: team.teamId,
      teamName: team.teamName,
      displayName: team.displayName,
      gameCount: team.gameCount,
      gameStatCount: team.gameStatCount,
      contexts: team.contexts
    })),
    proposedReassignments: group.proposedReassignments.map((item) => ({
      fromTeamId: item.fromTeamId,
      fromTeamName: item.fromTeamName,
      toTeamId: item.toTeamId,
      toTeamName: item.toTeamName,
      gameNumbersToUpdate: item.gameNumbersToUpdate,
      gamesToUpdate: item.gamesToUpdate,
      gameStatsToUpdate: item.gameStatsToUpdate,
      ratingsSnapshotsUnaffected: item.ratingsSnapshotsUnaffected
    }))
  };
}

function pybcReadySummary(report: Awaited<ReturnType<typeof buildReport>>) {
  const includedGroups = pybcReadyGroups(report);
  const includedReassignments = includedGroups.flatMap((group) => group.proposedReassignments);
  return {
    mode: "pybc-ready-suffix-duplicates-dry-run",
    executeReady: includedGroups.length > 0,
    inclusionRules: [
      "Same Program.",
      "Same cleaned display key after stripping suffix-only context such as U16 Boys, 16U, or Boys.",
      "Active official evidence is exclusively PYBC/PYBC 15U game/stat data.",
      "Same age/gender/league/season context by existing READY_FOR_APPROVAL diagnostic.",
      "PYBC 15U is treated only as league/competition context, not as a Program target."
    ],
    exclusionRules: [
      "All non-PYBC duplicate groups are excluded.",
      "All NEEDS_REVIEW groups are excluded.",
      "SBU/JPM-TEC San Beda ambiguity is excluded unless separately approved.",
      "Groups involving PYBC 15U as a Program target are excluded.",
      "Broad repair-all mode is not available."
    ],
    summary: {
      includedPybcGroups: includedGroups.length,
      duplicateTeamsToReassign: includedGroups.reduce((sum, group) => sum + group.duplicateTeams.length, 0),
      gamesToUpdateIfApproved: includedReassignments.reduce((sum, item) => sum + item.gamesToUpdate.length, 0),
      gameStatsToUpdateIfApproved: includedReassignments.reduce((sum, item) => sum + item.gameStatsToUpdate, 0)
    },
    includedGroups: includedGroups.map(pybcGroupSummary),
    excludedGroups: excludedGroupSummary(report),
    executeGuardrails: [
      "Execute requires --repair-pybc-ready-suffix-duplicates --execute.",
      "No broad repair-all mode is supported.",
      "Only included PYBC READY_FOR_APPROVAL groups can be repaired.",
      "Each group is revalidated immediately before writes.",
      "Only Game.homeTeamId, Game.awayTeamId, and GameStat.teamId rows currently pointing to duplicate Teams can be reassigned.",
      "Duplicate Team records are not deleted.",
      "Players, GameStat values, ratings, snapshots, rankings, imports, and submissions are not touched."
    ],
    noWritesPerformed: true
  };
}

function approvedPybcTeamRepairSummary(report: Awaited<ReturnType<typeof buildReport>>) {
  const includedRepairs = approvedPybcTeamDuplicateRepairs.map((repair) => approvedRepairFromReport(report, repair));
  const totalGames = includedRepairs.reduce((sum, item) => sum + item.reassignment.gamesToUpdate.length, 0);
  const totalGameStats = includedRepairs.reduce((sum, item) => sum + item.reassignment.gameStatsToUpdate, 0);
  if (includedRepairs.length !== 5 || totalGames !== 26 || totalGameStats !== 313) {
    throw new Error(`Approved PYBC repair totals changed. Found ${includedRepairs.length} repairs / ${totalGames} games / ${totalGameStats} GameStats.`);
  }

  return {
    mode: "approved-pybc-team-duplicates-dry-run",
    executeReady: true,
    inclusionRules: [
      "Only the 5 explicitly approved PYBC participants are included.",
      "Each repair must match the explicit Program ID, canonical Team ID, duplicate Team ID, game refs, and GameStats count.",
      "Every game in scope must normalize to PYBC 15U.",
      "Only suffix/internal-context duplicate Team records under the same Program are eligible."
    ],
    exclusionRules: [
      "LEV Construction Full Potential is excluded.",
      "JPM-TEC San Beda / SBU is excluded.",
      "San Pedro Spartans is excluded.",
      "No non-PYBC duplicate groups are included.",
      "No broad repair-all mode is available."
    ],
    summary: {
      includedParticipants: includedRepairs.length,
      duplicateTeamsToReassign: includedRepairs.length,
      gamesToUpdateIfApproved: totalGames,
      gameStatsToUpdateIfApproved: totalGameStats
    },
    includedRepairs: includedRepairs.map(({ repair, group, duplicateTeam, reassignment }) => ({
      participantName: repair.participantName,
      program: group.program,
      canonicalTeam: {
        teamId: group.canonicalTeam.teamId,
        teamName: group.canonicalTeam.teamName,
        displayName: group.canonicalTeam.displayName,
        gameCount: group.canonicalTeam.gameCount,
        gameStatCount: group.canonicalTeam.gameStatCount
      },
      duplicateTeam: {
        teamId: duplicateTeam.teamId,
        teamName: duplicateTeam.teamName,
        displayName: duplicateTeam.displayName,
        gameCount: duplicateTeam.gameCount,
        gameStatCount: duplicateTeam.gameStatCount
      },
      proposedReassignment: {
        fromTeamId: reassignment.fromTeamId,
        fromTeamName: reassignment.fromTeamName,
        toTeamId: reassignment.toTeamId,
        toTeamName: reassignment.toTeamName,
        gameNumbersToUpdate: reassignment.gameNumbersToUpdate,
        gamesToUpdate: reassignment.gamesToUpdate,
        gameStatsToUpdate: reassignment.gameStatsToUpdate,
        ratingsSnapshotsUnaffected: reassignment.ratingsSnapshotsUnaffected
      }
    })),
    excludedByDesign: [
      "LEV Construction Full Potential",
      "JPM-TEC San Beda / SBU",
      "San Pedro Spartans"
    ],
    executeGuardrails: [
      "Execute requires --repair-approved-pybc-team-duplicates --execute.",
      "The live report must still match exactly 5 duplicate Teams, 26 games, and 313 GameStats.",
      "Each repair is revalidated against explicit IDs and game refs immediately before writes.",
      "Only Game.homeTeamId, Game.awayTeamId, and GameStat.teamId rows currently pointing to duplicate Teams can be reassigned.",
      "Duplicate Team records are not deleted.",
      "LEV, JPM-TEC/SBU, and San Pedro are not touched.",
      "Players, GameStat values, ratings, snapshots, rankings, imports, and submissions are not touched."
    ],
    noWritesPerformed: true
  };
}

async function executeTargetedRepair(group: DuplicateGroup, reassignment: DuplicateGroup["proposedReassignments"][number]) {
  const gameIds = reassignment.gamesToUpdate;
  const protectedCountsBefore = {
    gamePerformanceScores: await prisma.gamePerformanceScore.count(),
    playerRatings: await prisma.playerRating.count(),
    rankingSnapshots: await prisma.rankingSnapshot.count(),
    rankingSnapshotRows: await prisma.rankingSnapshotRow.count()
  };

  const result = await prisma.$transaction(async (tx) => {
    const canonicalTeam = await tx.team.findFirst({
      where: {
        id: reassignment.toTeamId,
        programId: group.program.programId,
        deletedAt: null
      },
      select: { id: true, name: true, programId: true }
    });
    const duplicateTeam = await tx.team.findFirst({
      where: {
        id: reassignment.fromTeamId,
        programId: group.program.programId,
        deletedAt: null
      },
      select: { id: true, name: true, programId: true }
    });
    if (!canonicalTeam || !duplicateTeam) {
      throw new Error("Canonical and duplicate Teams must both exist and belong to the approved Program.");
    }

    const games = await tx.game.findMany({
      where: {
        id: { in: gameIds },
        deletedAt: null,
        OR: [
          { homeTeamId: reassignment.fromTeamId },
          { awayTeamId: reassignment.fromTeamId }
        ]
      },
      select: { id: true, gameNumber: true, homeTeamId: true, awayTeamId: true }
    });
    const gameNumbers = games.map((game) => String(game.gameNumber));
    if (!sameStringSet(gameNumbers, approvedPrimeAscencionRepair.approvedGameNumbers) || games.length !== approvedPrimeAscencionRepair.approvedGameNumbers.length) {
      throw new Error(`Live database game refs do not match the approved repair scope. Found ${gameNumbers.join(", ")}`);
    }

    const gameStatsToUpdate = await tx.gameStat.count({
      where: {
        gameId: { in: gameIds },
        teamId: reassignment.fromTeamId,
        deletedAt: null
      }
    });
    if (gameStatsToUpdate !== reassignment.gameStatsToUpdate) {
      throw new Error(`Live GameStat count changed. Expected ${reassignment.gameStatsToUpdate}, found ${gameStatsToUpdate}.`);
    }

    const homeGamesUpdated = await tx.game.updateMany({
      where: { id: { in: gameIds }, homeTeamId: reassignment.fromTeamId, deletedAt: null },
      data: { homeTeamId: reassignment.toTeamId }
    });
    const awayGamesUpdated = await tx.game.updateMany({
      where: { id: { in: gameIds }, awayTeamId: reassignment.fromTeamId, deletedAt: null },
      data: { awayTeamId: reassignment.toTeamId }
    });
    const gameStatsUpdated = await tx.gameStat.updateMany({
      where: { gameId: { in: gameIds }, teamId: reassignment.fromTeamId, deletedAt: null },
      data: { teamId: reassignment.toTeamId }
    });

    return {
      gamesUpdated: homeGamesUpdated.count + awayGamesUpdated.count,
      homeGamesUpdated: homeGamesUpdated.count,
      awayGamesUpdated: awayGamesUpdated.count,
      gameStatsUpdated: gameStatsUpdated.count,
      gameNumbersUpdated: gameNumbers.sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
    };
  });

  const protectedCountsAfter = {
    gamePerformanceScores: await prisma.gamePerformanceScore.count(),
    playerRatings: await prisma.playerRating.count(),
    rankingSnapshots: await prisma.rankingSnapshot.count(),
    rankingSnapshotRows: await prisma.rankingSnapshotRow.count()
  };

  if (JSON.stringify(protectedCountsBefore) !== JSON.stringify(protectedCountsAfter)) {
    throw new Error("Protected rating/snapshot counts changed unexpectedly.");
  }

  return {
    mode: "targeted-execute",
    result,
    protectedCountsBefore,
    protectedCountsAfter,
    duplicateTeamDeleted: false,
    validationPassed: true
  };
}

async function executeApprovedPybcTeamRepairs(report: Awaited<ReturnType<typeof buildReport>>) {
  const includedRepairs = approvedPybcTeamDuplicateRepairs.map((repair) => approvedRepairFromReport(report, repair));
  const totalGames = includedRepairs.reduce((sum, item) => sum + item.reassignment.gamesToUpdate.length, 0);
  const totalGameStats = includedRepairs.reduce((sum, item) => sum + item.reassignment.gameStatsToUpdate, 0);
  if (includedRepairs.length !== 5 || totalGames !== 26 || totalGameStats !== 313) {
    throw new Error(`Approved PYBC repair totals changed. Found ${includedRepairs.length} repairs / ${totalGames} games / ${totalGameStats} GameStats.`);
  }

  const protectedCountsBefore = {
    gamePerformanceScores: await prisma.gamePerformanceScore.count(),
    playerRatings: await prisma.playerRating.count(),
    rankingSnapshots: await prisma.rankingSnapshot.count(),
    rankingSnapshotRows: await prisma.rankingSnapshotRow.count()
  };

  const result = await prisma.$transaction(async (tx) => {
    const repairs = [];
    for (const { repair, group, reassignment } of includedRepairs) {
      const canonicalTeam = await tx.team.findFirst({
        where: { id: repair.canonicalTeamId, programId: repair.programId, deletedAt: null },
        select: { id: true, name: true, programId: true }
      });
      const duplicateTeam = await tx.team.findFirst({
        where: { id: repair.duplicateTeamId, programId: repair.programId, deletedAt: null },
        select: { id: true, name: true, programId: true }
      });
      if (!canonicalTeam || !duplicateTeam) {
        throw new Error(`Canonical and duplicate Teams must both exist under Program ${group.program.fullName}.`);
      }

      const games = await tx.game.findMany({
        where: {
          id: { in: reassignment.gamesToUpdate },
          deletedAt: null,
          OR: [
            { homeTeamId: repair.duplicateTeamId },
            { awayTeamId: repair.duplicateTeamId }
          ],
          season: {
            deletedAt: null,
            league: { deletedAt: null }
          }
        },
        include: { season: { include: { league: true } } }
      });
      const gameNumbers = games.map((game) => String(game.gameNumber));
      if (!sameStringSet(gameNumbers, repair.approvedGameNumbers) || games.length !== repair.approvedGameNumbers.length) {
        throw new Error(`Live database game refs changed for ${repair.participantName}. Found ${gameNumbers.join(", ")}`);
      }
      if (!games.every((game) => normalizeCompetitionDisplayName(game.season.league.name) === "PYBC 15U")) {
        throw new Error(`Non-PYBC game found in approved repair scope for ${repair.participantName}.`);
      }

      const gameStatsToUpdate = await tx.gameStat.count({
        where: {
          gameId: { in: reassignment.gamesToUpdate },
          teamId: repair.duplicateTeamId,
          deletedAt: null
        }
      });
      if (gameStatsToUpdate !== repair.expectedGameStats) {
        throw new Error(`Live GameStat count changed for ${repair.participantName}. Expected ${repair.expectedGameStats}, found ${gameStatsToUpdate}.`);
      }

      const homeGamesUpdated = await tx.game.updateMany({
        where: { id: { in: reassignment.gamesToUpdate }, homeTeamId: repair.duplicateTeamId, deletedAt: null },
        data: { homeTeamId: repair.canonicalTeamId }
      });
      const awayGamesUpdated = await tx.game.updateMany({
        where: { id: { in: reassignment.gamesToUpdate }, awayTeamId: repair.duplicateTeamId, deletedAt: null },
        data: { awayTeamId: repair.canonicalTeamId }
      });
      const gameStatsUpdated = await tx.gameStat.updateMany({
        where: { gameId: { in: reassignment.gamesToUpdate }, teamId: repair.duplicateTeamId, deletedAt: null },
        data: { teamId: repair.canonicalTeamId }
      });

      repairs.push({
        participantName: repair.participantName,
        programId: repair.programId,
        fromTeamId: repair.duplicateTeamId,
        fromTeamName: duplicateTeam.name,
        toTeamId: repair.canonicalTeamId,
        toTeamName: canonicalTeam.name,
        gamesUpdated: homeGamesUpdated.count + awayGamesUpdated.count,
        gameStatsUpdated: gameStatsUpdated.count,
        gameNumbersUpdated: gameNumbers.sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
      });
    }
    return repairs;
  });

  const protectedCountsAfter = {
    gamePerformanceScores: await prisma.gamePerformanceScore.count(),
    playerRatings: await prisma.playerRating.count(),
    rankingSnapshots: await prisma.rankingSnapshot.count(),
    rankingSnapshotRows: await prisma.rankingSnapshotRow.count()
  };

  if (JSON.stringify(protectedCountsBefore) !== JSON.stringify(protectedCountsAfter)) {
    throw new Error("Protected rating/snapshot counts changed unexpectedly.");
  }

  return {
    mode: "approved-pybc-team-duplicates-execute",
    repairs: result,
    protectedCountsBefore,
    protectedCountsAfter,
    duplicateTeamsDeleted: false,
    validationPassed: true
  };
}

async function executePybcReadyRepairs(report: Awaited<ReturnType<typeof buildReport>>) {
  const includedGroups = pybcReadyGroups(report);
  if (includedGroups.length === 0) {
    throw new Error("No PYBC READY_FOR_APPROVAL suffix duplicate groups are available to repair.");
  }

  const protectedCountsBefore = {
    gamePerformanceScores: await prisma.gamePerformanceScore.count(),
    playerRatings: await prisma.playerRating.count(),
    rankingSnapshots: await prisma.rankingSnapshot.count(),
    rankingSnapshotRows: await prisma.rankingSnapshotRow.count()
  };

  const result = await prisma.$transaction(async (tx) => {
    const repairs = [];

    for (const group of includedGroups) {
      if (!isPybcReadyDuplicateGroup(group)) {
        throw new Error(`Group failed PYBC ready guardrails before repair: ${group.program.fullName}`);
      }

      for (const reassignment of group.proposedReassignments) {
        const canonicalTeam = await tx.team.findFirst({
          where: { id: reassignment.toTeamId, programId: group.program.programId, deletedAt: null },
          select: { id: true, name: true, programId: true }
        });
        const duplicateTeam = await tx.team.findFirst({
          where: { id: reassignment.fromTeamId, programId: group.program.programId, deletedAt: null },
          select: { id: true, name: true, programId: true }
        });
        if (!canonicalTeam || !duplicateTeam) {
          throw new Error(`Canonical and duplicate Teams must both exist under Program ${group.program.fullName}.`);
        }

        const games = await tx.game.findMany({
          where: {
            id: { in: reassignment.gamesToUpdate },
            deletedAt: null,
            OR: [
              { homeTeamId: reassignment.fromTeamId },
              { awayTeamId: reassignment.fromTeamId }
            ],
            season: {
              deletedAt: null,
              league: { deletedAt: null }
            }
          },
          include: { season: { include: { league: true } } }
        });
        if (games.length !== reassignment.gamesToUpdate.length) {
          throw new Error(`Live database game refs changed for duplicate Team ${reassignment.fromTeamName}.`);
        }
        if (!games.every((game) => normalizeCompetitionDisplayName(game.season.league.name) === "PYBC 15U")) {
          throw new Error(`Non-PYBC game found in repair scope for duplicate Team ${reassignment.fromTeamName}.`);
        }

        const gameStatsToUpdate = await tx.gameStat.count({
          where: {
            gameId: { in: reassignment.gamesToUpdate },
            teamId: reassignment.fromTeamId,
            deletedAt: null
          }
        });
        if (gameStatsToUpdate !== reassignment.gameStatsToUpdate) {
          throw new Error(`Live GameStat count changed for ${reassignment.fromTeamName}. Expected ${reassignment.gameStatsToUpdate}, found ${gameStatsToUpdate}.`);
        }

        const homeGamesUpdated = await tx.game.updateMany({
          where: { id: { in: reassignment.gamesToUpdate }, homeTeamId: reassignment.fromTeamId, deletedAt: null },
          data: { homeTeamId: reassignment.toTeamId }
        });
        const awayGamesUpdated = await tx.game.updateMany({
          where: { id: { in: reassignment.gamesToUpdate }, awayTeamId: reassignment.fromTeamId, deletedAt: null },
          data: { awayTeamId: reassignment.toTeamId }
        });
        const gameStatsUpdated = await tx.gameStat.updateMany({
          where: { gameId: { in: reassignment.gamesToUpdate }, teamId: reassignment.fromTeamId, deletedAt: null },
          data: { teamId: reassignment.toTeamId }
        });

        repairs.push({
          programId: group.program.programId,
          programName: group.program.fullName,
          fromTeamId: reassignment.fromTeamId,
          fromTeamName: reassignment.fromTeamName,
          toTeamId: reassignment.toTeamId,
          toTeamName: reassignment.toTeamName,
          gamesUpdated: homeGamesUpdated.count + awayGamesUpdated.count,
          gameStatsUpdated: gameStatsUpdated.count,
          gameNumbersUpdated: games.map((game) => String(game.gameNumber)).sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
        });
      }
    }

    return repairs;
  });

  const protectedCountsAfter = {
    gamePerformanceScores: await prisma.gamePerformanceScore.count(),
    playerRatings: await prisma.playerRating.count(),
    rankingSnapshots: await prisma.rankingSnapshot.count(),
    rankingSnapshotRows: await prisma.rankingSnapshotRow.count()
  };

  if (JSON.stringify(protectedCountsBefore) !== JSON.stringify(protectedCountsAfter)) {
    throw new Error("Protected rating/snapshot counts changed unexpectedly.");
  }

  return {
    mode: "pybc-ready-suffix-duplicates-execute",
    repairs: result,
    protectedCountsBefore,
    protectedCountsAfter,
    duplicateTeamsDeleted: false,
    validationPassed: true
  };
}

async function main() {
  const args = targetArgs();
  const executeRequested = isExecuteRequested();
  const pybcReadyRepairRequested = isPybcReadyRepairRequested();
  const approvedPybcTeamRepairRequested = isApprovedPybcTeamRepairRequested();
  if (executeRequested && !hasCompleteTargetArgs(args) && !pybcReadyRepairRequested && !approvedPybcTeamRepairRequested) {
    throw new Error("Broad execute mode is not supported. Provide explicit target IDs, --repair-pybc-ready-suffix-duplicates, or --repair-approved-pybc-team-duplicates.");
  }
  if (hasTargetArgs(args) && !hasCompleteTargetArgs(args)) {
    throw new Error("Targeted mode requires --program-id, --canonical-team-id, and --duplicate-team-id.");
  }
  if ((pybcReadyRepairRequested || approvedPybcTeamRepairRequested) && hasTargetArgs(args)) {
    throw new Error("Batch repair modes cannot be combined with explicit single-group target IDs.");
  }
  if (pybcReadyRepairRequested && approvedPybcTeamRepairRequested) {
    throw new Error("Choose only one batch repair mode.");
  }

  const report = await buildReport();

  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  if (approvedPybcTeamRepairRequested) {
    const summary = approvedPybcTeamRepairSummary(report);
    if (executeRequested) {
      const result = await executeApprovedPybcTeamRepairs(report);
      console.log(JSON.stringify({
        reportPath,
        ...summary,
        noWritesPerformed: false,
        ...result
      }, null, 2));
      return;
    }

    console.log(JSON.stringify({
      reportPath,
      ...summary
    }, null, 2));
    return;
  }

  if (pybcReadyRepairRequested) {
    const summary = pybcReadySummary(report);
    if (executeRequested) {
      const result = await executePybcReadyRepairs(report);
      console.log(JSON.stringify({
        reportPath,
        ...summary,
        noWritesPerformed: false,
        ...result
      }, null, 2));
      return;
    }

    console.log(JSON.stringify({
      reportPath,
      ...summary
    }, null, 2));
    return;
  }

  if (hasCompleteTargetArgs(args)) {
    const { group, duplicateTeam, reassignment } = findTargetGroup(report, args as Required<TargetArgs>);
    const summary = targetSummary(group, duplicateTeam, reassignment);

    if (executeRequested) {
      const result = await executeTargetedRepair(group, reassignment);
      console.log(JSON.stringify({
        reportPath,
        ...summary,
        ...result
      }, null, 2));
      return;
    }

    console.log(JSON.stringify({
      reportPath,
      mode: "targeted-dry-run",
      executeReady: true,
      ...summary,
      noWritesPerformed: true
    }, null, 2));
    return;
  }

  if (executeRequested) {
    throw new Error("Broad execute mode is not supported.");
  }

  console.log(JSON.stringify({
    reportPath,
    ...report.summary,
    primeAscencionDetected: report.duplicateGroups.some((group) => group.program.fullName === "Prime Ascencion Medical Supplies San Anton"),
    primeAscencion: report.duplicateGroups.find((group) => group.program.fullName === "Prime Ascencion Medical Supplies San Anton") ?? null
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
