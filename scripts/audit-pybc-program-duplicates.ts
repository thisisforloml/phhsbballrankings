import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { normalizeCompetitionDisplayName } from "../src/lib/competition-naming";
import { prisma } from "../src/lib/prisma";
import { getTeamDisplayName, normalizeProgramAlias } from "../src/lib/uaap-school-display";

const reportPath = join(process.cwd(), "scripts", "reports", "pybc-program-duplicate-audit.json");

const expectedParticipants = [
  "JMTG Medical Trading Infinite",
  "Lev Construction Full Potential",
  "Migrafix Doc Boleros",
  "Migueluz Trading Moderno",
  "Prime Ascencion Medical Supplies San Anton",
  "JPM-TEC San Beda",
  "Smile 360 Bullies",
  "San Pedro Spartans"
];

function isExecuteRequested() {
  return process.argv.includes("--execute");
}

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

function identityDisplayName(value: string) {
  const normalized = normalizeProgramAlias(value);
  if (normalized === "SBU") return "SBU";
  if (normalized.includes("JPM TEC") || normalized.includes("JPM-TEC")) return "JPM-TEC San Beda";
  return getTeamDisplayName(stripContext(value));
}

function identityKey(value: string) {
  return normalizeProgramAlias(identityDisplayName(value));
}

function isAmbiguousSanBedaIdentity(key: string) {
  return key === "SBU" || key.includes("JPM TEC") || key.includes("SAN BEDA");
}

function isAllCapsName(value: string) {
  const letters = value.replace(/[^A-Za-z]+/g, "");
  return Boolean(letters) && letters === letters.toUpperCase();
}

function aliasCount(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

function chooseCanonicalProgram(programs: ProgramEvidence[]) {
  return programs.slice().sort((left, right) => {
    const leftAliases = aliasCount(left.aliases);
    const rightAliases = aliasCount(right.aliases);
    if (rightAliases !== leftAliases) return rightAliases - leftAliases;
    const leftAllCaps = isAllCapsName(left.fullName) ? 1 : 0;
    const rightAllCaps = isAllCapsName(right.fullName) ? 1 : 0;
    if (leftAllCaps !== rightAllCaps) return leftAllCaps - rightAllCaps;
    if (right.gameRefs.length !== left.gameRefs.length) return right.gameRefs.length - left.gameRefs.length;
    if (right.gameStatCount !== left.gameStatCount) return right.gameStatCount - left.gameStatCount;
    return left.fullName.localeCompare(right.fullName);
  })[0];
}

type TeamEvidence = {
  teamId: string;
  teamName: string;
  displayName: string;
  programId: string | null;
  programName: string | null;
  gameRefs: {
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
  }[];
  gameStatCount: number;
};

type ProgramEvidence = {
  programId: string;
  fullName: string;
  abbreviation: string | null;
  type: string;
  aliases: unknown;
  identityKey: string;
  identityDisplayName: string;
  teams: TeamEvidence[];
  gameRefs: string[];
  gameStatCount: number;
};

async function loadPybcEvidence() {
  const games = await prisma.game.findMany({
    where: {
      deletedAt: null,
      season: {
        deletedAt: null,
        league: {
          deletedAt: null,
          name: {
            contains: "PYBC",
            mode: "insensitive"
          }
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

  const teamMap = new Map<string, TeamEvidence>();

  for (const game of games) {
    const normalizedLeague = normalizeCompetitionDisplayName(game.season.league.name);
    if (normalizedLeague !== "PYBC 15U") continue;

    for (const team of [game.homeTeam, game.awayTeam]) {
      const existing = teamMap.get(team.id) ?? {
        teamId: team.id,
        teamName: team.name,
        displayName: getTeamDisplayName(team.name),
        programId: team.programId,
        programName: team.program?.fullName ?? null,
        gameRefs: [],
        gameStatCount: 0
      };
      existing.gameRefs.push({
        gameId: game.id,
        gameNumber: game.gameNumber,
        gameDate: formatDate(game.gameDate),
        league: game.season.league.name,
        normalizedLeague,
        season: game.season.name,
        homeTeamId: game.homeTeamId,
        awayTeamId: game.awayTeamId,
        homeScore: game.homeScore,
        awayScore: game.awayScore
      });
      existing.gameStatCount += game.stats.filter((stat) => stat.teamId === team.id).length;
      teamMap.set(team.id, existing);
    }
  }

  return Array.from(teamMap.values()).map((team) => ({
    ...team,
    gameRefs: team.gameRefs.sort((left, right) => String(left.gameNumber).localeCompare(String(right.gameNumber), undefined, { numeric: true }))
  }));
}

async function loadExpectedParticipantPrograms() {
  const programs = await prisma.program.findMany({
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
        }
      }
    },
    orderBy: { fullName: "asc" }
  });
  const expectedKeys = new Set(expectedParticipants.map(identityKey));

  return programs
    .filter((program) => expectedKeys.has(identityKey(program.fullName)))
    .map((program) => {
      const teams = program.teams.map((team) => {
        const activeGames = [...team.homeGames, ...team.awayGames]
          .filter((game, index, games) => games.findIndex((candidate) => candidate.id === game.id) === index)
          .sort((left, right) => String(left.gameNumber).localeCompare(String(right.gameNumber), undefined, { numeric: true }));
        const pybcGameRefs = activeGames
          .filter((game) => normalizeCompetitionDisplayName(game.season.league.name) === "PYBC 15U")
          .map((game) => ({
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
          }));

        return {
          teamId: team.id,
          teamName: team.name,
          displayName: getTeamDisplayName(team.name),
          programId: program.id,
          programName: program.fullName,
          gameRefs: pybcGameRefs,
          gameStatCount: team.gameStats.length
        };
      });

      return {
        programId: program.id,
        fullName: program.fullName,
        abbreviation: program.abbreviation,
        type: program.type,
        aliases: program.aliases,
        identityKey: identityKey(program.fullName),
        identityDisplayName: identityDisplayName(program.fullName),
        teams,
        gameRefs: uniqueSorted(teams.flatMap((team) => team.gameRefs.map((game) => String(game.gameNumber)))),
        gameStatCount: teams.reduce((sum, team) => sum + team.gameStatCount, 0)
      };
    });
}

function buildProgramEvidence(teams: TeamEvidence[]) {
  const programMap = new Map<string, ProgramEvidence>();

  for (const team of teams) {
    if (!team.programId || !team.programName) continue;
    const existing = programMap.get(team.programId) ?? {
      programId: team.programId,
      fullName: team.programName,
      abbreviation: null,
      type: "UNKNOWN",
      aliases: null,
      identityKey: identityKey(team.programName),
      identityDisplayName: identityDisplayName(team.programName),
      teams: [],
      gameRefs: [],
      gameStatCount: 0
    };
    existing.teams.push(team);
    existing.gameRefs = uniqueSorted([...existing.gameRefs, ...team.gameRefs.map((game) => String(game.gameNumber))]);
    existing.gameStatCount += team.gameStatCount;
    programMap.set(team.programId, existing);
  }

  return Array.from(programMap.values());
}

async function enrichPrograms(programs: ProgramEvidence[]) {
  const programRows = await prisma.program.findMany({
    where: { id: { in: programs.map((program) => program.programId) } },
    select: { id: true, fullName: true, abbreviation: true, type: true, aliases: true }
  });
  const rowsById = new Map(programRows.map((program) => [program.id, program]));
  return programs.map((program) => {
    const row = rowsById.get(program.programId);
    return {
      ...program,
      fullName: row?.fullName ?? program.fullName,
      abbreviation: row?.abbreviation ?? null,
      type: row?.type ?? "UNKNOWN",
      aliases: row?.aliases ?? null
    };
  });
}

function teamDuplicateGroups(programs: ProgramEvidence[]) {
  const groups = [];
  for (const program of programs) {
    const teamsByKey = new Map<string, TeamEvidence[]>();
    for (const team of program.teams) {
      const key = identityKey(team.teamName);
      teamsByKey.set(key, [...(teamsByKey.get(key) ?? []), team]);
    }
    for (const [key, teams] of teamsByKey.entries()) {
      if (teams.length < 2) continue;
      const canonical = teams.slice().sort((left, right) => {
        const leftCleanExact = left.teamName === left.displayName ? 1 : 0;
        const rightCleanExact = right.teamName === right.displayName ? 1 : 0;
        if (rightCleanExact !== leftCleanExact) return rightCleanExact - leftCleanExact;
        if (right.gameRefs.length !== left.gameRefs.length) return right.gameRefs.length - left.gameRefs.length;
        return left.teamName.localeCompare(right.teamName);
      })[0];
      groups.push({
        programId: program.programId,
        programName: program.fullName,
        normalizedIdentity: key,
        canonicalTeam: canonical,
        duplicateTeams: teams.filter((team) => team.teamId !== canonical.teamId),
        allTeams: teams
      });
    }
  }
  return groups;
}

function classifyProgramDuplicate(identityKeyValue: string, programs: ProgramEvidence[]) {
  if (isAmbiguousSanBedaIdentity(identityKeyValue)) return "NEEDS_REVIEW_NAME_AMBIGUITY";
  if (programs.length > 2 || programs.some((program) => program.teams.length > 1)) return "NEEDS_REVIEW_CROSS_PROGRAM_COMPLEX";
  return "SAFE_PYBC_PROGRAM_DUPLICATE";
}

async function main() {
  if (isExecuteRequested()) {
    throw new Error("Execute mode is not implemented. This script is a dry-run audit/report only.");
  }

  const teams = await loadPybcEvidence();
  const evidencePrograms = await enrichPrograms(buildProgramEvidence(teams));
  const expectedParticipantPrograms = await loadExpectedParticipantPrograms();
  const programsById = new Map<string, ProgramEvidence>();
  for (const program of expectedParticipantPrograms) programsById.set(program.programId, program);
  for (const program of evidencePrograms) programsById.set(program.programId, program);
  const programs = Array.from(programsById.values());
  const unlinkedTeams = teams.filter((team) => !team.programId);

  const programsByIdentity = new Map<string, ProgramEvidence[]>();
  for (const program of programs) {
    programsByIdentity.set(program.identityKey, [...(programsByIdentity.get(program.identityKey) ?? []), program]);
  }

  const duplicateProgramGroups = Array.from(programsByIdentity.entries())
    .filter(([, groupPrograms]) => groupPrograms.length > 1)
    .map(([normalizedIdentity, groupPrograms]) => {
      const canonical = chooseCanonicalProgram(groupPrograms);
      const riskClassification = classifyProgramDuplicate(normalizedIdentity, groupPrograms);
      return {
        normalizedIdentity,
        displayIdentity: canonical.identityDisplayName,
        riskClassification,
        programs: groupPrograms.map((program) => ({
          programId: program.programId,
          fullName: program.fullName,
          abbreviation: program.abbreviation,
          type: program.type,
          aliases: program.aliases,
          linkedTeams: program.teams.map((team) => ({
            teamId: team.teamId,
            teamName: team.teamName,
            displayName: team.displayName,
            gameRefs: team.gameRefs.map((game) => game.gameNumber),
            gameStatCount: team.gameStatCount
          })),
          gameRefs: program.gameRefs,
          gameStatCount: program.gameStatCount
        })),
        suggestedCanonicalProgram: {
          programId: canonical.programId,
          fullName: canonical.fullName
        },
        suggestedProgramsToReassignFrom: groupPrograms
          .filter((program) => program.programId !== canonical.programId)
          .map((program) => ({ programId: program.programId, fullName: program.fullName })),
        suggestedTeamReassignments: groupPrograms
          .filter((program) => program.programId !== canonical.programId)
          .flatMap((program) => program.teams.map((team) => ({
            teamId: team.teamId,
            teamName: team.teamName,
            fromProgramId: program.programId,
            fromProgramName: program.fullName,
            toProgramId: canonical.programId,
            toProgramName: canonical.fullName,
            gameRefs: team.gameRefs.map((game) => game.gameNumber),
            gameStatCount: team.gameStatCount
          })))
      };
    });

  const duplicateTeamGroups = teamDuplicateGroups(programs);
  const participantAudit = expectedParticipants.map((participant) => {
    const key = identityKey(participant);
    const participantPrograms = programsByIdentity.get(key) ?? [];
    return {
      expectedParticipant: participant,
      normalizedIdentity: key,
      programCount: participantPrograms.length,
      programs: participantPrograms.map((program) => ({
        programId: program.programId,
        fullName: program.fullName,
        teamCount: program.teams.length,
        gameRefs: program.gameRefs,
        gameStatCount: program.gameStatCount
      })),
      hasDuplicatePrograms: participantPrograms.length > 1,
      duplicateTeamGroups: duplicateTeamGroups
        .filter((group) => group.normalizedIdentity === key)
        .map((group) => ({
          programId: group.programId,
          programName: group.programName,
          canonicalTeam: { teamId: group.canonicalTeam.teamId, teamName: group.canonicalTeam.teamName },
          duplicateTeams: group.duplicateTeams.map((team) => ({ teamId: team.teamId, teamName: team.teamName })),
          gameRefs: uniqueSorted(group.allTeams.flatMap((team) => team.gameRefs.map((game) => String(game.gameNumber))))
        }))
    };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    mode: "dry-run",
    reportPath,
    guardrails: [
      "Read-only audit; no database writes were performed.",
      "Only active official PYBC 15U game evidence is used.",
      "PYBC 15U is treated as league/competition context, not a Program.",
      "SBU and JPM-TEC San Beda are not automatically grouped.",
      "No execute-all repair path is generated by this script.",
      "No deletes, merges, rating recomputes, or snapshot changes are performed."
    ],
    summary: {
      pybcTeamsInspected: teams.length,
      pybcProgramsInspected: programs.length,
      pybcEvidenceProgramsInspected: evidencePrograms.length,
      expectedParticipantProgramsInspected: expectedParticipantPrograms.length,
      unlinkedPybcTeams: unlinkedTeams.length,
      duplicateProgramGroups: duplicateProgramGroups.length,
      safePybcProgramDuplicates: duplicateProgramGroups.filter((group) => group.riskClassification === "SAFE_PYBC_PROGRAM_DUPLICATE").length,
      needsReviewNameAmbiguity: duplicateProgramGroups.filter((group) => group.riskClassification === "NEEDS_REVIEW_NAME_AMBIGUITY").length,
      needsReviewCrossProgramComplex: duplicateProgramGroups.filter((group) => group.riskClassification === "NEEDS_REVIEW_CROSS_PROGRAM_COMPLEX").length,
      duplicateTeamGroups: duplicateTeamGroups.length
    },
    duplicateProgramGroups,
    duplicateTeamGroups: duplicateTeamGroups.map((group) => ({
      programId: group.programId,
      programName: group.programName,
      normalizedIdentity: group.normalizedIdentity,
      canonicalTeam: {
        teamId: group.canonicalTeam.teamId,
        teamName: group.canonicalTeam.teamName,
        gameRefs: group.canonicalTeam.gameRefs.map((game) => game.gameNumber),
        gameStatCount: group.canonicalTeam.gameStatCount
      },
      duplicateTeams: group.duplicateTeams.map((team) => ({
        teamId: team.teamId,
        teamName: team.teamName,
        gameRefs: team.gameRefs.map((game) => game.gameNumber),
        gameStatCount: team.gameStatCount
      }))
    })),
    participantAudit,
    unlinkedTeams,
    recommendedRepairOrder: [
      "Review SAFE_PYBC_PROGRAM_DUPLICATE groups first and approve one explicit Program reassignment plan at a time.",
      "Run/approve suffix duplicate Team repairs separately from Program duplicate repairs.",
      "Handle San Pedro Spartans and Smile 360 Bullies manually if casing/source variants remain NEEDS_REVIEW.",
      "Do not group SBU and JPM-TEC San Beda unless an admin explicitly maps them."
    ]
  };

  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(JSON.stringify({
    reportPath,
    ...report.summary,
    duplicateProgramGroups: report.duplicateProgramGroups.map((group) => ({
      normalizedIdentity: group.normalizedIdentity,
      displayIdentity: group.displayIdentity,
      riskClassification: group.riskClassification,
      programNames: group.programs.map((program) => program.fullName),
      suggestedCanonicalProgram: group.suggestedCanonicalProgram,
      suggestedProgramsToReassignFrom: group.suggestedProgramsToReassignFrom
    })),
    duplicateTeamGroups: report.duplicateTeamGroups.map((group) => ({
      programName: group.programName,
      canonicalTeam: group.canonicalTeam.teamName,
      duplicateTeams: group.duplicateTeams.map((team) => team.teamName)
    })),
    participantAudit: report.participantAudit.map((participant) => ({
      expectedParticipant: participant.expectedParticipant,
      programCount: participant.programCount,
      hasDuplicatePrograms: participant.hasDuplicatePrograms,
      duplicateTeamGroupCount: participant.duplicateTeamGroups.length,
      programs: participant.programs.map((program) => program.fullName)
    })),
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
