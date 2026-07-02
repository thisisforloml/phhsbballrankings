import { activeCompetitionGameJoins, activeCompetitionGameSql } from "@/lib/admin/active-competition-sql";
import type { ProgramListRow } from "@/lib/admin/program-list-row";
import { prisma } from "@/lib/prisma";

type ProgramTeamGameRow = {
  programId: string;
  teamId: string;
  teamName: string;
  gameId: string;
  seasonId: string;
  leagueId: string;
  ageGroup: string;
  leagueName: string;
};

type ProgramTeamPlayerRow = {
  programId: string;
  teamId: string;
  playerId: string;
};

function inferGender(...values: Array<string | null | undefined>) {
  return values.filter(Boolean).join(" ").toLowerCase().includes("girls") ? "Girls" : "Boys";
}

async function loadProgramTeamGameRows() {
  return prisma.$queryRaw<ProgramTeamGameRow[]>`
    SELECT DISTINCT
      t."programId" AS "programId",
      t.id AS "teamId",
      t.name AS "teamName",
      g.id AS "gameId",
      s.id AS "seasonId",
      l.id AS "leagueId",
      l."ageGroup"::text AS "ageGroup",
      l.name AS "leagueName"
    ${activeCompetitionGameJoins}
    INNER JOIN teams t ON t.id = g."homeTeamId" AND t."deletedAt" IS NULL AND t."programId" IS NOT NULL
    WHERE ${activeCompetitionGameSql}
    UNION
    SELECT DISTINCT
      t."programId" AS "programId",
      t.id AS "teamId",
      t.name AS "teamName",
      g.id AS "gameId",
      s.id AS "seasonId",
      l.id AS "leagueId",
      l."ageGroup"::text AS "ageGroup",
      l.name AS "leagueName"
    ${activeCompetitionGameJoins}
    INNER JOIN teams t ON t.id = g."awayTeamId" AND t."deletedAt" IS NULL AND t."programId" IS NOT NULL
    WHERE ${activeCompetitionGameSql}
  `;
}

async function loadProgramTeamPlayerRows() {
  return prisma.$queryRaw<ProgramTeamPlayerRow[]>`
    SELECT DISTINCT
      t."programId" AS "programId",
      gs."teamId" AS "teamId",
      gs."playerId" AS "playerId"
    FROM game_stats gs
    INNER JOIN games g ON g.id = gs."gameId"
    INNER JOIN seasons s ON s.id = g."seasonId"
    INNER JOIN leagues l ON l.id = s."leagueId"
    INNER JOIN teams ht ON ht.id = g."homeTeamId"
    INNER JOIN teams at ON at.id = g."awayTeamId"
    INNER JOIN teams t ON t.id = gs."teamId"
    WHERE gs."deletedAt" IS NULL
      AND t."deletedAt" IS NULL
      AND t."programId" IS NOT NULL
      AND ${activeCompetitionGameSql}
  `;
}

function serializeProgramListRow(
  program: {
    id: string;
    fullName: string;
    abbreviation: string | null;
    type: ProgramListRow["type"];
    city: string | null;
    region: string | null;
  },
  gameRows: ProgramTeamGameRow[],
  playerRows: ProgramTeamPlayerRow[],
): ProgramListRow {
  const officialGameIds = new Set<string>();
  const playerIds = new Set<string>();
  const activeTeamIds = new Set<string>();
  const contextTeams = new Map<string, Set<string>>();

  for (const row of gameRows) {
    officialGameIds.add(row.gameId);
    activeTeamIds.add(row.teamId);
    const gender = inferGender(row.leagueName, row.teamName);
    const contextKey = [row.ageGroup, gender, row.leagueId, row.seasonId].join("|");
    const teamSet = contextTeams.get(contextKey) ?? new Set<string>();
    teamSet.add(row.teamId);
    contextTeams.set(contextKey, teamSet);
  }

  for (const row of playerRows) {
    activeTeamIds.add(row.teamId);
    playerIds.add(row.playerId);
  }

  return {
    id: program.id,
    fullName: program.fullName,
    abbreviation: program.abbreviation,
    type: program.type,
    city: program.city,
    region: program.region,
    teamCount: activeTeamIds.size,
    possibleDuplicateContextGroups: Array.from(contextTeams.values()).filter((teamIds) => teamIds.size > 1).length,
    derivedPlayerCount: playerIds.size,
    officialGameCount: officialGameIds.size,
  };
}

let programListCache: { value: ProgramListRow[]; loadedAt: number } | null = null;
const PROGRAM_LIST_CACHE_MS = 5 * 60 * 1000;

export function clearProgramListCache() {
  programListCache = null;
}

export async function loadProgramListRows(options?: { bypassCache?: boolean }): Promise<ProgramListRow[]> {
  const now = Date.now();
  if (
    !options?.bypassCache &&
    programListCache &&
    now - programListCache.loadedAt < PROGRAM_LIST_CACHE_MS
  ) {
    return programListCache.value;
  }

  const [programs, gameRows, playerRows] = await Promise.all([
    prisma.program.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        fullName: true,
        abbreviation: true,
        type: true,
        city: true,
        region: true,
      },
      orderBy: [{ type: "asc" }, { fullName: "asc" }],
    }),
    loadProgramTeamGameRows(),
    loadProgramTeamPlayerRows(),
  ]);

  const gameRowsByProgramId = new Map<string, ProgramTeamGameRow[]>();
  for (const row of gameRows) {
    const bucket = gameRowsByProgramId.get(row.programId) ?? [];
    bucket.push(row);
    gameRowsByProgramId.set(row.programId, bucket);
  }

  const playerRowsByProgramId = new Map<string, ProgramTeamPlayerRow[]>();
  for (const row of playerRows) {
    const bucket = playerRowsByProgramId.get(row.programId) ?? [];
    bucket.push(row);
    playerRowsByProgramId.set(row.programId, bucket);
  }

  const value = programs.map((program) =>
    serializeProgramListRow(
      program,
      gameRowsByProgramId.get(program.id) ?? [],
      playerRowsByProgramId.get(program.id) ?? [],
    ),
  );
  programListCache = { value, loadedAt: now };
  return value;
}
