import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { normalizeCompetitionDisplayName } from "../src/lib/competition-naming";
import { prisma } from "../src/lib/prisma";
import { getTeamDisplayName, normalizeProgramAlias } from "../src/lib/uaap-school-display";

const reportPath = join(process.cwd(), "scripts", "reports", "pybc-participant-cleanup-plan.json");

const expectedParticipants = [
  "JMTG Medical Trading Infinite",
  "LEV Construction Full Potential",
  "Migrafix Doc Boleros",
  "Migueluz Trading Moderno",
  "Prime Ascencion Medical Supplies San Anton",
  "JPM-TEC San Beda",
  "Smile 360 Bullies",
  "San Pedro Spartans"
];

function uniqueSorted<T>(values: T[]) {
  return Array.from(new Set(values)).sort((left, right) => String(left).localeCompare(String(right), undefined, { numeric: true }));
}

function formatDate(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : null;
}

function stripContext(value: string) {
  return value
    .trim()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(?:U|UNDER)[ -]?(?:13|16|19)\s*(?:BOYS|GIRLS)?\b/gi, " ")
    .replace(/\b(?:13U|16U|19U)\s*(?:BOYS|GIRLS)?\b/gi, " ")
    .replace(/\b(?:BOYS|GIRLS)\b$/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function displayIdentity(value: string) {
  const normalized = normalizeProgramAlias(value);
  if (normalized === "SBU") return "SBU";
  if (normalized.includes("JPM TEC") || normalized.includes("JPM-TEC")) return "JPM-TEC San Beda";
  return getTeamDisplayName(stripContext(value));
}

function identityKey(value: string) {
  return normalizeProgramAlias(displayIdentity(value));
}

function aliasCount(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

function isAllCapsName(value: string) {
  const letters = value.replace(/[^A-Za-z]+/g, "");
  return Boolean(letters) && letters === letters.toUpperCase();
}

type GameRef = {
  gameId: string;
  gameNumber: string | null;
  gameDate: string | null;
  league: string;
  normalizedLeague: string;
  season: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
};

type TeamRecord = {
  teamId: string;
  rawTeamName: string;
  cleanedTeamDisplayName: string;
  programId: string | null;
  programName: string | null;
  gameRefs: GameRef[];
  gameStatCount: number;
};

type ProgramRecord = {
  programId: string;
  fullName: string;
  abbreviation: string | null;
  type: string;
  aliases: unknown;
  identityKey: string;
  teams: TeamRecord[];
  gameRefs: string[];
  gameStatCount: number;
};

async function loadPybcGames() {
  return prisma.game.findMany({
    where: {
      deletedAt: null,
      season: {
        deletedAt: null,
        league: {
          deletedAt: null,
          OR: [
            { name: { contains: "PYBC", mode: "insensitive" } },
            { name: { contains: "Philippine Youth Basketball Championship", mode: "insensitive" } }
          ]
        }
      }
    },
    include: {
      homeTeam: { include: { program: true } },
      awayTeam: { include: { program: true } },
      season: { include: { league: true } },
      stats: { where: { deletedAt: null }, select: { id: true, teamId: true } }
    },
    orderBy: [{ gameDate: "asc" }, { gameNumber: "asc" }]
  });
}

async function loadExpectedPrograms() {
  const expectedKeys = new Set(expectedParticipants.map(identityKey));
  const programs = await prisma.program.findMany({
    where: { deletedAt: null },
    include: {
      teams: {
        where: { deletedAt: null },
        include: {
          homeGames: {
            where: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } },
            include: { season: { include: { league: true } }, stats: { where: { deletedAt: null }, select: { id: true, teamId: true } } }
          },
          awayGames: {
            where: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } },
            include: { season: { include: { league: true } }, stats: { where: { deletedAt: null }, select: { id: true, teamId: true } } }
          }
        }
      }
    },
    orderBy: { fullName: "asc" }
  });

  return programs.filter((program) => expectedKeys.has(identityKey(program.fullName))).map((program): ProgramRecord => {
    const teams = program.teams.map((team): TeamRecord => {
      const activeGames = [...team.homeGames, ...team.awayGames]
        .filter((game, index, games) => games.findIndex((candidate) => candidate.id === game.id) === index)
        .filter((game) => normalizeCompetitionDisplayName(game.season.league.name) === "PYBC 15U")
        .sort((left, right) => String(left.gameNumber).localeCompare(String(right.gameNumber), undefined, { numeric: true }));

      return {
        teamId: team.id,
        rawTeamName: team.name,
        cleanedTeamDisplayName: getTeamDisplayName(team.name),
        programId: program.id,
        programName: program.fullName,
        gameRefs: activeGames.map((game) => ({
          gameId: game.id,
          gameNumber: game.gameNumber,
          gameDate: formatDate(game.gameDate),
          league: game.season.league.name,
          normalizedLeague: normalizeCompetitionDisplayName(game.season.league.name),
          season: game.season.name,
          homeTeamId: game.homeTeamId,
          awayTeamId: game.awayTeamId,
          homeScore: game.homeScore,
          awayScore: game.awayScore
        })),
        gameStatCount: activeGames.reduce((sum, game) => sum + game.stats.filter((stat) => stat.teamId === team.id).length, 0)
      };
    });

    return {
      programId: program.id,
      fullName: program.fullName,
      abbreviation: program.abbreviation,
      type: program.type,
      aliases: program.aliases,
      identityKey: identityKey(program.fullName),
      teams,
      gameRefs: uniqueSorted(teams.flatMap((team) => team.gameRefs.map((game) => String(game.gameNumber)))),
      gameStatCount: teams.reduce((sum, team) => sum + team.gameStatCount, 0)
    };
  });
}

function chooseCanonicalProgram(programs: ProgramRecord[]) {
  return programs.slice().sort((left, right) => {
    const leftAliases = aliasCount(left.aliases);
    const rightAliases = aliasCount(right.aliases);
    if (rightAliases !== leftAliases) return rightAliases - leftAliases;
    if (right.gameRefs.length !== left.gameRefs.length) return right.gameRefs.length - left.gameRefs.length;
    const leftAllCaps = isAllCapsName(left.fullName) ? 1 : 0;
    const rightAllCaps = isAllCapsName(right.fullName) ? 1 : 0;
    if (leftAllCaps !== rightAllCaps) return leftAllCaps - rightAllCaps;
    if (right.gameStatCount !== left.gameStatCount) return right.gameStatCount - left.gameStatCount;
    return left.fullName.localeCompare(right.fullName);
  })[0] ?? null;
}

function chooseCanonicalTeam(teams: TeamRecord[]) {
  return teams.slice().sort((left, right) => {
    const leftCleanExact = left.rawTeamName === left.cleanedTeamDisplayName ? 1 : 0;
    const rightCleanExact = right.rawTeamName === right.cleanedTeamDisplayName ? 1 : 0;
    if (rightCleanExact !== leftCleanExact) return rightCleanExact - leftCleanExact;
    if (right.gameRefs.length !== left.gameRefs.length) return right.gameRefs.length - left.gameRefs.length;
    if (right.gameStatCount !== left.gameStatCount) return right.gameStatCount - left.gameStatCount;
    return left.rawTeamName.localeCompare(right.rawTeamName);
  })[0] ?? null;
}

function summarizeProgram(program: ProgramRecord) {
  return {
    programId: program.programId,
    fullName: program.fullName,
    abbreviation: program.abbreviation,
    type: program.type,
    aliases: program.aliases,
    gameRefs: program.gameRefs,
    gameStatCount: program.gameStatCount,
    linkedTeams: program.teams.map((team) => ({
      teamId: team.teamId,
      rawTeamName: team.rawTeamName,
      cleanedTeamDisplayName: team.cleanedTeamDisplayName,
      gameRefs: team.gameRefs.map((game) => game.gameNumber),
      gameStatCount: team.gameStatCount
    }))
  };
}

function summarizeTeam(team: TeamRecord) {
  return {
    teamId: team.teamId,
    rawTeamName: team.rawTeamName,
    cleanedTeamDisplayName: team.cleanedTeamDisplayName,
    programId: team.programId,
    programName: team.programName,
    gameRefs: team.gameRefs.map((game) => game.gameNumber),
    gameStatCount: team.gameStatCount
  };
}

async function buildPlan() {
  const [pybcGames, programs] = await Promise.all([loadPybcGames(), loadExpectedPrograms()]);
  const programsByKey = new Map<string, ProgramRecord[]>();
  for (const program of programs) {
    programsByKey.set(program.identityKey, [...(programsByKey.get(program.identityKey) ?? []), program]);
  }

  const participants = expectedParticipants.map((participant) => {
    const key = identityKey(participant);
    const matchingPrograms = programsByKey.get(key) ?? [];
    const allTeams = matchingPrograms.flatMap((program) => program.teams);
    const activeTeams = allTeams.filter((team) => team.gameRefs.length > 0);
    const canonicalProgram = chooseCanonicalProgram(matchingPrograms);
    const canonicalTeam = chooseCanonicalTeam(activeTeams.length ? activeTeams : allTeams);
    const duplicatePrograms = canonicalProgram ? matchingPrograms.filter((program) => program.programId !== canonicalProgram.programId) : [];
    const duplicateTeams = canonicalTeam ? allTeams.filter((team) => team.teamId !== canonicalTeam.teamId) : [];
    const hasDuplicatePrograms = matchingPrograms.length > 1;
    const hasDuplicateTeams = allTeams.length > 1;
    const hasSanBedaAmbiguity = key === "SBU" || key.includes("SAN BEDA") && !key.includes("JPM-TEC");
    const hasSbuTeamUnderJpmTec = key.includes("JPM-TEC") && allTeams.some((team) => normalizeProgramAlias(team.rawTeamName) === "SBU");
    const hasCrossProgramTeamComplexity = hasDuplicatePrograms && hasDuplicateTeams;
    const classification = hasSanBedaAmbiguity || hasSbuTeamUnderJpmTec || hasCrossProgramTeamComplexity ? "NEEDS_REVIEW" : "READY_FOR_APPROVAL";
    const reviewReasons = [
      hasSanBedaAmbiguity ? "San Beda/SBU identities must not be merged without explicit admin mapping." : null,
      hasSbuTeamUnderJpmTec ? "A Team named SBU is linked under JPM-TEC San Beda; confirm the admin-edited identity before repairing Team references." : null,
      hasCrossProgramTeamComplexity ? "Participant has both duplicate Programs and duplicate Teams; repair order needs manual confirmation." : null
    ].filter(Boolean);

    return {
      participantDisplayName: participant,
      normalizedIdentity: key,
      classification,
      reviewReasons,
      programRecords: matchingPrograms.map(summarizeProgram),
      teamRecords: allTeams.map(summarizeTeam),
      hasDuplicatePrograms,
      hasDuplicateTeams,
      suggestedCanonicalProgram: canonicalProgram ? {
        programId: canonicalProgram.programId,
        fullName: canonicalProgram.fullName
      } : null,
      suggestedCanonicalTeam: canonicalTeam ? {
        teamId: canonicalTeam.teamId,
        rawTeamName: canonicalTeam.rawTeamName,
        cleanedTeamDisplayName: canonicalTeam.cleanedTeamDisplayName,
        programId: canonicalTeam.programId,
        programName: canonicalTeam.programName
      } : null,
      proposedRepairSteps: [
        ...duplicatePrograms.map((program) => ({
          type: "REASSIGN_TEAM_PROGRAM",
          fromProgramId: program.programId,
          fromProgramName: program.fullName,
          toProgramId: canonicalProgram?.programId ?? null,
          toProgramName: canonicalProgram?.fullName ?? null,
          affectedTeamIds: program.teams.map((team) => team.teamId),
          affectedTeamNames: program.teams.map((team) => team.rawTeamName),
          gameRefs: program.gameRefs,
          gameStatsCovered: program.gameStatCount
        })),
        ...duplicateTeams.map((team) => ({
          type: "REASSIGN_TEAM_REFERENCES",
          fromTeamId: team.teamId,
          fromTeamName: team.rawTeamName,
          toTeamId: canonicalTeam?.teamId ?? null,
          toTeamName: canonicalTeam?.rawTeamName ?? null,
          gameRefs: team.gameRefs.map((game) => game.gameNumber),
          gameStatsCovered: team.gameStatCount
        }))
      ]
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    mode: "dry-run",
    reportPath,
    guardrails: [
      "Read-only cleanup plan; no database writes were performed.",
      "Starts from active official PYBC 15U game evidence plus expected PYBC participant Program records.",
      "PYBC 15U is league/competition context, not a Program.",
      "SBU and JPM-TEC San Beda are kept separate unless explicitly approved.",
      "No execute mode is implemented by this script.",
      "No deletes, merges, rating recomputes, snapshot changes, imports, or publish actions are performed."
    ],
    summary: {
      pybcGamesInspected: pybcGames.filter((game) => normalizeCompetitionDisplayName(game.season.league.name) === "PYBC 15U").length,
      participantsInspected: participants.length,
      readyForApproval: participants.filter((participant) => participant.classification === "READY_FOR_APPROVAL").length,
      needsReview: participants.filter((participant) => participant.classification === "NEEDS_REVIEW").length,
      participantsWithDuplicatePrograms: participants.filter((participant) => participant.hasDuplicatePrograms).length,
      participantsWithDuplicateTeams: participants.filter((participant) => participant.hasDuplicateTeams).length,
      proposedProgramReassignments: participants.reduce((sum, participant) => sum + participant.proposedRepairSteps.filter((step) => step.type === "REASSIGN_TEAM_PROGRAM").length, 0),
      proposedTeamReferenceReassignments: participants.reduce((sum, participant) => sum + participant.proposedRepairSteps.filter((step) => step.type === "REASSIGN_TEAM_REFERENCES").length, 0)
    },
    participants,
    recommendedRepairOrder: [
      "Approve and run suffix duplicate Team reference repairs for READY_FOR_APPROVAL participants with only duplicate Teams.",
      "Approve the Lev/LEV Program reassignment before any Team reference cleanup involving LEV.",
      "Review San Pedro Spartans manually because it has both duplicate Program rows and duplicate Team rows.",
      "Keep JPM-TEC San Beda separate from SBU unless a future admin mapping explicitly says otherwise.",
      "After approved repairs, rerun this cleanup plan and refresh Admin Program Management."
    ]
  };
}

async function main() {
  if (process.argv.includes("--execute")) {
    throw new Error("Execute mode is not implemented. This script is dry-run/report only.");
  }

  const report = await buildPlan();
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(JSON.stringify({
    reportPath,
    ...report.summary,
    participants: report.participants.map((participant) => ({
      participantDisplayName: participant.participantDisplayName,
      classification: participant.classification,
      reviewReasons: participant.reviewReasons,
      programCount: participant.programRecords.length,
      teamCount: participant.teamRecords.length,
      hasDuplicatePrograms: participant.hasDuplicatePrograms,
      hasDuplicateTeams: participant.hasDuplicateTeams,
      suggestedCanonicalProgram: participant.suggestedCanonicalProgram,
      suggestedCanonicalTeam: participant.suggestedCanonicalTeam,
      proposedRepairSteps: participant.proposedRepairSteps
    })),
    recommendedRepairOrder: report.recommendedRepairOrder,
    noWritesPerformed: true
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
