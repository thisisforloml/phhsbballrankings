import type { Prisma } from "@prisma/client";
import { ProgramType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveAutoRosterAssignment, type AutoRosterMatch } from "@/lib/admin/auto-roster-assignment";

type DbClient = Prisma.TransactionClient | typeof prisma;

const AUTO_GAME_STAT_REASON = "Auto-assigned from verified game stat evidence.";
const AUTO_AGE_BRACKET_REASON = "Auto-assigned from age bracket after birth date update.";

async function maybeAssignSchoolProgram(
  db: DbClient,
  playerId: string,
  programId: string
) {
  const program = await db.program.findFirst({
    where: { id: programId, deletedAt: null },
    select: { id: true, type: true }
  });
  if (!program || program.type !== ProgramType.SCHOOL) return;

  const player = await db.player.findFirst({
    where: { id: playerId, deletedAt: null },
    select: {
      currentProgramId: true,
      currentProgram: { select: { type: true } }
    }
  });
  if (!player) return;

  const currentIsSchool = player.currentProgram?.type === ProgramType.SCHOOL;
  if (!player.currentProgramId || !currentIsSchool) {
    await db.player.update({
      where: { id: playerId },
      data: { currentProgramId: program.id }
    });
  }
}

export async function ensurePlayerRosterFromGameStat(
  db: DbClient,
  input: {
    playerId: string;
    teamId: string;
    seasonId: string;
    startsOn?: Date | null;
  }
): Promise<"created" | "updated" | "unchanged" | "admin_preserved"> {
  const team = await db.team.findFirst({
    where: { id: input.teamId, deletedAt: null },
    select: { id: true, programId: true }
  });
  if (!team) return "unchanged";

  const player = await db.player.findFirst({
    where: { id: input.playerId, deletedAt: null },
    select: { id: true }
  });
  if (!player) return "unchanged";

  if (team.programId) {
    await maybeAssignSchoolProgram(db, player.id, team.programId);
  }

  const existing = await db.playerTeamSeason.findUnique({
    where: { playerId_seasonId: { playerId: input.playerId, seasonId: input.seasonId } },
    select: { id: true, teamId: true, adminOverride: true, deletedAt: true }
  });

  if (existing?.adminOverride && existing.teamId !== input.teamId) {
    return "admin_preserved";
  }

  if (existing?.adminOverride) {
    return "admin_preserved";
  }

  if (existing && existing.teamId === input.teamId && !existing.deletedAt) {
    return "unchanged";
  }

  await db.playerTeamSeason.upsert({
    where: { playerId_seasonId: { playerId: input.playerId, seasonId: input.seasonId } },
    create: {
      playerId: input.playerId,
      teamId: input.teamId,
      seasonId: input.seasonId,
      adminOverride: false,
      overrideReason: AUTO_GAME_STAT_REASON,
      startsOn: input.startsOn ?? null,
      endsOn: null,
      deletedAt: null
    },
    update: {
      teamId: input.teamId,
      adminOverride: false,
      overrideReason: AUTO_GAME_STAT_REASON,
      startsOn: input.startsOn ?? null,
      endsOn: null,
      deletedAt: null
    }
  });

  return existing ? "updated" : "created";
}

async function upsertRosterMatch(playerId: string, match: AutoRosterMatch, reason: string) {
  const existing = await prisma.playerTeamSeason.findUnique({
    where: { playerId_seasonId: { playerId, seasonId: match.seasonId } },
    select: { id: true, teamId: true, adminOverride: true, deletedAt: true }
  });

  if (existing?.adminOverride && existing.teamId !== match.teamId) {
    return { ok: false as const, reason: "admin_preserved" as const };
  }

  if (existing && existing.teamId === match.teamId && !existing.deletedAt) {
    return { ok: true as const, action: "unchanged" as const, match };
  }

  await prisma.playerTeamSeason.upsert({
    where: { playerId_seasonId: { playerId, seasonId: match.seasonId } },
    create: {
      playerId,
      teamId: match.teamId,
      seasonId: match.seasonId,
      adminOverride: false,
      overrideReason: reason,
      startsOn: new Date(),
      endsOn: null,
      deletedAt: null
    },
    update: {
      teamId: match.teamId,
      adminOverride: false,
      overrideReason: reason,
      endsOn: null,
      deletedAt: null
    }
  });

  return { ok: true as const, action: existing ? ("updated" as const) : ("created" as const), match };
}

export async function assignPlayerRosterFromAgeBracket(playerId: string) {
  const player = await prisma.player.findFirst({
    where: { id: playerId, deletedAt: null },
    select: { currentProgramId: true }
  });
  if (!player?.currentProgramId) {
    return { ok: false as const, reason: "NO_PROGRAM" as const };
  }

  const auto = await resolveAutoRosterAssignment({ playerId, programId: player.currentProgramId });
  if (!auto.ok) {
    return { ok: false as const, reason: auto.reason, candidates: auto.candidates };
  }

  const result = await upsertRosterMatch(playerId, auto.match, AUTO_AGE_BRACKET_REASON);
  if (!result.ok) {
    return { ok: false as const, reason: result.reason };
  }

  return { ok: true as const, action: result.action, match: result.match };
}

export async function syncRostersFromSeasonGameStats(seasonId: string) {
  const stats = await prisma.gameStat.findMany({
    where: {
      deletedAt: null,
      game: { seasonId, deletedAt: null }
    },
    select: {
      playerId: true,
      teamId: true,
      game: { select: { gameDate: true } }
    },
    orderBy: [{ game: { gameDate: "desc" } }, { createdAt: "desc" }]
  });

  const latestByPlayer = new Map<string, { teamId: string; startsOn: Date }>();
  for (const stat of stats) {
    if (!latestByPlayer.has(stat.playerId)) {
      latestByPlayer.set(stat.playerId, { teamId: stat.teamId, startsOn: stat.game.gameDate });
    }
  }

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let adminPreserved = 0;

  for (const [playerId, evidence] of latestByPlayer) {
    const result = await ensurePlayerRosterFromGameStat(prisma, {
      playerId,
      teamId: evidence.teamId,
      seasonId,
      startsOn: evidence.startsOn
    });
    if (result === "created") created += 1;
    else if (result === "updated") updated += 1;
    else if (result === "admin_preserved") adminPreserved += 1;
    else unchanged += 1;
  }

  return { created, updated, unchanged, adminPreserved, players: latestByPlayer.size };
}

export async function backfillAllRostersFromGameStats() {
  const seasons = await prisma.season.findMany({
    where: { deletedAt: null, games: { some: { deletedAt: null } } },
    select: { id: true, name: true }
  });

  const totals = { created: 0, updated: 0, unchanged: 0, adminPreserved: 0, players: 0, seasons: seasons.length };

  for (const season of seasons) {
    const result = await syncRostersFromSeasonGameStats(season.id);
    totals.created += result.created;
    totals.updated += result.updated;
    totals.unchanged += result.unchanged;
    totals.adminPreserved += result.adminPreserved;
    totals.players += result.players;
  }

  return totals;
}
