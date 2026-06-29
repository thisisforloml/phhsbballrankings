/**
 * Identity Integrity Sweep — read-only audit.
 * Usage: npx tsx scripts/generate-identity-integrity-sweep.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { PlayerGender } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { normalizeImportedPlayerNameKey } from "../src/lib/player-import-identity";
import { teamDisplayMatchKey } from "../src/lib/team-import-matching";
import { getUaapSchoolDisplayName } from "../src/lib/uaap-school-display";

type Risk = "critical" | "high" | "medium" | "low";
type MergeReadiness = "ready" | "review" | "blocked";

function normalizeName(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function lastNameKey(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] ?? name;
}

function stripAgeGenderSuffix(name: string) {
  return name.replace(/\s+U(?:13|16|19)\s+(?:Boys|Girls)$/i, "").trim();
}

function publicSchoolDisplayName(teamName: string) {
  return getUaapSchoolDisplayName(stripAgeGenderSuffix(teamName) || teamName);
}

function inferGenderFromText(...values: Array<string | null | undefined>) {
  return values.filter(Boolean).join(" ").toLowerCase().includes("girls") ? "Girls" : "Boys";
}

type QueueItem = {
  priority: number;
  action: string;
  entityIds: string[];
  candidates: string[];
  risk: Risk;
  expectedImpact: string;
  mergeReadiness?: MergeReadiness;
  effort: "low" | "medium" | "high";
};

async function main() {
  const programQueue: QueueItem[] = [];
  const teamQueue: QueueItem[] = [];
  const playerQueue: QueueItem[] = [];

  const [
    programs,
    activeTeams,
    displayNameDuplicates,
    sameGameExactNameDuplicates,
    importKeySplitGroups,
    orphanTeams,
    teamsWithoutProgram,
    programsWithoutTeams,
    playerProgramMismatch
  ] = await Promise.all([
    prisma.program.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        fullName: true,
        _count: { select: { teams: { where: { deletedAt: null } }, currentPlayers: true } },
        teams: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            _count: { select: { gameStats: { where: { deletedAt: null } } } }
          }
        }
      }
    }),
    prisma.team.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        programId: true,
        program: { select: { id: true, fullName: true } },
        _count: {
          select: {
            gameStats: { where: { deletedAt: null } },
            homeGames: { where: { deletedAt: null } },
            awayGames: { where: { deletedAt: null } }
          }
        }
      },
      orderBy: { name: "asc" }
    }),
    prisma.$queryRaw<
      Array<{ display_name: string; gender: PlayerGender; player_count: number; player_ids: string[] }>
    >`
      SELECT p."displayName" AS display_name, p.gender, COUNT(*)::int AS player_count,
        array_agg(p.id ORDER BY p."createdAt") AS player_ids
      FROM players p WHERE p."deletedAt" IS NULL
      GROUP BY p."displayName", p.gender HAVING COUNT(*) > 1
      ORDER BY player_count DESC
    `,
    prisma.$queryRaw<
      Array<{ game_id: string; display_name: string; gender: PlayerGender; player_ids: string[] }>
    >`
      SELECT g.id AS game_id, p."displayName" AS display_name, p.gender,
        array_agg(DISTINCT gs."playerId") AS player_ids
      FROM game_stats gs
      JOIN players p ON p.id = gs."playerId" AND p."deletedAt" IS NULL
      JOIN games g ON g.id = gs."gameId" AND g."deletedAt" IS NULL
      WHERE gs."deletedAt" IS NULL
      GROUP BY g.id, p."displayName", p.gender
      HAVING COUNT(DISTINCT gs."playerId") > 1
    `,
    (async () => {
      const players = await prisma.player.findMany({
        where: { deletedAt: null },
        select: { id: true, displayName: true, gender: true }
      });
      const groups = new Map<string, typeof players>();
      for (const p of players) {
        const key = `${p.gender}|${normalizeImportedPlayerNameKey(p.displayName)}`;
        groups.set(key, [...(groups.get(key) ?? []), p]);
      }
      return Array.from(groups.entries())
        .filter(([, g]) => g.length > 1)
        .map(([key, g]) => ({
          importKey: key,
          playerIds: g.map((x) => x.id),
          displayNames: g.map((x) => x.displayName)
        }));
    })(),
    prisma.team.findMany({
      where: {
        deletedAt: null,
        programId: { not: null },
        gameStats: { none: { deletedAt: null } },
        homeGames: { none: { deletedAt: null } },
        awayGames: { none: { deletedAt: null } }
      },
      select: { id: true, name: true, programId: true, program: { select: { fullName: true } } },
      orderBy: { name: "asc" }
    }),
    prisma.team.findMany({
      where: { deletedAt: null, programId: null },
      select: { id: true, name: true, _count: { select: { gameStats: { where: { deletedAt: null } } } } }
    }),
    prisma.program.findMany({
      where: { deletedAt: null, teams: { none: { deletedAt: null } }, currentPlayers: { none: {} } },
      select: { id: true, fullName: true }
    }),
    prisma.$queryRaw<
      Array<{ player_id: string; player_name: string; current_program: string | null; roster_program: string }>
    >`
      SELECT DISTINCT ON (p.id)
        p.id AS player_id, p."displayName" AS player_name,
        cp."fullName" AS current_program, rp."fullName" AS roster_program
      FROM players p
      JOIN player_team_seasons pts ON pts."playerId" = p.id AND pts."deletedAt" IS NULL
      JOIN teams tm ON tm.id = pts."teamId" AND tm."deletedAt" IS NULL
      JOIN programs rp ON rp.id = tm."programId"
      LEFT JOIN programs cp ON cp.id = p."currentProgramId"
      WHERE p."deletedAt" IS NULL
        AND p."currentProgramId" IS NOT NULL
        AND p."currentProgramId" <> tm."programId"
      ORDER BY p.id, pts."createdAt" DESC
      LIMIT 100
    `
  ]);

  // ── 1. Duplicate Programs ────────────────────────────────────────────────
  const programGroups = new Map<string, typeof programs>();
  for (const p of programs) {
    const key = normalizeName(p.fullName);
    programGroups.set(key, [...(programGroups.get(key) ?? []), p]);
  }

  let programPriority = 1;
  for (const [, group] of programGroups) {
    if (group.length < 2) continue;
    const mapped = group.map((p) => {
      const gameStats = p.teams.reduce((s, t) => s + t._count.gameStats, 0);
      return {
        id: p.id,
        fullName: p.fullName,
        teams: p._count.teams,
        players: p._count.currentPlayers,
        gameStats,
        isEmptyShell: p._count.teams === 0 && p._count.currentPlayers === 0
      };
    });
    const canonical = [...mapped].sort((a, b) => b.gameStats - a.gameStats || b.teams - a.teams)[0];
    const shells = mapped.filter((p) => p.isEmptyShell);
    const casingOnly =
      shells.length === 0 &&
      new Set(group.map((p) => p.fullName)).size > 1 &&
      mapped.every((p) => p.gameStats === 0 || p.id === canonical.id);

    if (shells.length > 0) {
      for (const shell of shells) {
        programQueue.push({
          priority: programPriority++,
          action: `Retire empty program shell: ${shell.fullName}`,
          entityIds: [shell.id],
          candidates: [`Keep canonical ${canonical.fullName} (${canonical.id})`],
          risk: "low",
          expectedImpact: `Removes duplicate Program identity; ${canonical.gameStats} GameStats stay on canonical`,
          effort: "low"
        });
      }
    } else if (mapped.filter((p) => p.gameStats > 0).length > 1) {
      programQueue.push({
        priority: programPriority++,
        action: `Merge duplicate programs: ${group.map((p) => p.fullName).join(" / ")}`,
        entityIds: mapped.map((p) => p.id),
        candidates: mapped.map((p) => `${p.fullName} (${p.id}) — ${p.gameStats} stats, ${p.teams} teams`),
        risk: "high",
        expectedImpact: `Unifies ${mapped.reduce((s, p) => s + p.gameStats, 0)} GameStats under one Program`,
        effort: "high"
      });
    } else if (casingOnly) {
      const dup = mapped.find((p) => p.id !== canonical.id)!;
      programQueue.push({
        priority: programPriority++,
        action: `Consolidate casing variant: ${dup.fullName} → ${canonical.fullName}`,
        entityIds: [dup.id, canonical.id],
        candidates: mapped.map((p) => `${p.fullName} (${p.id})`),
        risk: "medium",
        expectedImpact: `Single Program record for ${canonical.gameStats} GameStats team linkage`,
        effort: "medium"
      });
    }
  }

  for (const p of programsWithoutTeams) {
    const isDup = Array.from(programGroups.values()).some((g) => g.length > 1 && g.some((x) => x.id === p.id));
    if (isDup) continue;
    programQueue.push({
      priority: programPriority++,
      action: `Retire orphan program (no teams, no players): ${p.fullName}`,
      entityIds: [p.id],
      candidates: [p.fullName],
      risk: "low",
      expectedImpact: "Removes unused Program shell",
      effort: "low"
    });
  }

  // ── 2–5. Teams: fragmentation, orphans, inconsistencies ────────────────
  let teamPriority = 1;

  for (const team of teamsWithoutProgram) {
    const stats = team._count.gameStats;
    teamQueue.push({
      priority: teamPriority++,
      action: stats > 0 ? `Assign programId to orphan team: ${team.name}` : `Retire orphan team (no program): ${team.name}`,
      entityIds: [team.id],
      candidates: [team.name],
      risk: stats > 0 ? "high" : "low",
      expectedImpact: stats > 0 ? `${stats} GameStats lack Program linkage` : "Removes unattached team shell",
      effort: stats > 0 ? "medium" : "low"
    });
  }

  for (const team of orphanTeams) {
    teamQueue.push({
      priority: teamPriority++,
      action: `Retire zero-activity team: ${team.name}`,
      entityIds: [team.id],
      candidates: [`${team.program?.fullName ?? "unknown program"} — ${team.name}`],
      risk: "low",
      expectedImpact: "Reduces team fragmentation under program",
      effort: "low"
    });
  }

  const withinProgramDisplayKey = new Map<string, typeof activeTeams>();
  for (const team of activeTeams) {
    if (!team.programId) continue;
    const key = `${team.programId}|${teamDisplayMatchKey(team.name)}`;
    withinProgramDisplayKey.set(key, [...(withinProgramDisplayKey.get(key) ?? []), team]);
  }

  for (const [, teams] of withinProgramDisplayKey) {
    if (teams.length < 2) continue;
    const withStats = teams.filter((t) => t._count.gameStats > 0);
    if (withStats.length < 2 && teams.every((t) => t._count.gameStats === 0 || withStats[0]?.id === t.id)) {
      const zeros = teams.filter((t) => t._count.gameStats === 0);
      for (const z of zeros) {
        teamQueue.push({
          priority: teamPriority++,
          action: `Retire duplicate zero-stat team: ${z.name}`,
          entityIds: [z.id],
          candidates: teams.map((t) => `${t.name} (${t._count.gameStats} stats)`),
          risk: "low",
          expectedImpact: `Deduplicates ${z.program?.fullName} team list`,
          effort: "low"
        });
      }
      continue;
    }
    if (withStats.length > 1) {
      teamQueue.push({
        priority: teamPriority++,
        action: `Merge same-program team duplicates: ${teams[0].program?.fullName}`,
        entityIds: teams.map((t) => t.id),
        candidates: teams.map((t) => `${t.name} (${t._count.gameStats} stats)`),
        risk: "high",
        expectedImpact: `Consolidates ${teams.reduce((s, t) => s + t._count.gameStats, 0)} GameStats`,
        effort: "high"
      });
    }
  }

  const programsWithMultiple = programs
    .filter((p) => p.teams.length > 1)
    .map((p) => ({
      program: p.fullName,
      programId: p.id,
      teams: p.teams,
      zeroStatTeams: p.teams.filter((t) => t._count.gameStats === 0),
      activeTeams: p.teams.filter((t) => t._count.gameStats > 0)
    }))
    .sort((a, b) => b.zeroStatTeams.length - a.zeroStatTeams.length);

  for (const row of programsWithMultiple) {
    if (row.zeroStatTeams.length === 0) continue;
    const alreadyQueued = new Set(teamQueue.flatMap((q) => q.entityIds));
    const toRetire = row.zeroStatTeams.filter((t) => !alreadyQueued.has(t.id));
    if (toRetire.length === 0) continue;
    teamQueue.push({
      priority: teamPriority++,
      action: `Batch retire ${toRetire.length} zero-stat teams under ${row.program}`,
      entityIds: toRetire.map((t) => t.id),
      candidates: toRetire.map((t) => t.name),
      risk: "low",
      expectedImpact: `Cleans ${row.program} from ${row.teams.length} → ${row.activeTeams.length} active teams`,
      effort: "low"
    });
  }

  const games = await prisma.game.findMany({
    where: {
      deletedAt: null,
      season: { deletedAt: null, league: { deletedAt: null } },
      homeTeam: { deletedAt: null },
      awayTeam: { deletedAt: null }
    },
    include: {
      homeTeam: { select: { id: true, name: true, programId: true } },
      awayTeam: { select: { id: true, name: true, programId: true } },
      season: { include: { league: { select: { name: true, ageGroup: true } } } },
      stats: { where: { deletedAt: null }, select: { teamId: true } }
    }
  });

  type CtxGroup = {
    key: string;
    publicName: string;
    league: string;
    season: string;
    teams: Array<{ id: string; name: string; stats: number; games: number }>;
  };
  const ctxGroups = new Map<string, CtxGroup>();

  for (const game of games) {
    const gender = inferGenderFromText(game.season.league.name, game.homeTeam.name, game.awayTeam.name);
    for (const side of [game.homeTeam, game.awayTeam]) {
      const pub = publicSchoolDisplayName(side.name);
      const key = `${pub}|${game.season.league.ageGroup}|${gender}|${game.seasonId}`;
      const g =
        ctxGroups.get(key) ??
        ({
          key,
          publicName: pub,
          league: game.season.league.name,
          season: game.season.name,
          teams: []
        } satisfies CtxGroup);
      let row = g.teams.find((t) => t.id === side.id);
      if (!row) {
        row = { id: side.id, name: side.name, stats: 0, games: 0 };
        g.teams.push(row);
      }
      row.games += 1;
      row.stats += game.stats.filter((s) => s.teamId === side.id).length;
      ctxGroups.set(key, g);
    }
  }

  const highImpactFragmentation = Array.from(ctxGroups.values())
    .filter((g) => g.teams.length > 1)
    .map((g) => ({ ...g, totalStats: g.teams.reduce((s, t) => s + t.stats, 0) }))
    .filter((g) => g.totalStats >= 50)
    .sort((a, b) => b.totalStats - a.totalStats);

  for (const g of highImpactFragmentation.slice(0, 15)) {
    teamQueue.push({
      priority: teamPriority++,
      action: `Resolve competition-context fragmentation: ${g.publicName} (${g.league})`,
      entityIds: g.teams.map((t) => t.id),
      candidates: g.teams.map((t) => `${t.name} — ${t.stats} stats, ${t.games} games`),
      risk: "high",
      expectedImpact: `${g.totalStats} GameStats split across ${g.teams.length} Team records in same season context`,
      effort: "high"
    });
  }

  if (playerProgramMismatch.length > 0) {
    const byProgram = new Map<string, typeof playerProgramMismatch>();
    for (const row of playerProgramMismatch) {
      const key = `${row.current_program} vs ${row.roster_program}`;
      byProgram.set(key, [...(byProgram.get(key) ?? []), row]);
    }
    for (const [key, rows] of byProgram) {
      programQueue.push({
        priority: programPriority++,
        action: `Reconcile player currentProgramId mismatch: ${key}`,
        entityIds: rows.map((r) => r.player_id),
        candidates: rows.slice(0, 5).map((r) => r.player_name),
        risk: "medium",
        expectedImpact: `${rows.length} player(s) roster program ≠ currentProgramId`,
        effort: "medium"
      });
    }
  }

  // ── 3–7. Players: duplicates, fragmentation, merge readiness ───────────
  const playersWithStats = await prisma.player.findMany({
    where: { deletedAt: null, gameStats: { some: { deletedAt: null } } },
    select: {
      id: true,
      displayName: true,
      gender: true,
      gameStats: {
        where: { deletedAt: null },
        select: {
          gameId: true,
          teamId: true,
          team: { select: { name: true } },
          game: { select: { season: { select: { league: { select: { name: true } } } } } }
        }
      }
    }
  });

  const sameGamePlayerIds = new Set(sameGameExactNameDuplicates.flatMap((r) => r.player_ids));
  let playerPriority = 1;

  for (const dup of displayNameDuplicates) {
    const ids = dup.player_ids;
    const statsByPlayer = await prisma.gameStat.groupBy({
      by: ["playerId"],
      where: { deletedAt: null, playerId: { in: ids } },
      _count: { _all: true }
    });
    const withStats = statsByPlayer.filter((r) => r._count._all > 0);
    if (withStats.length < 2) continue;

    const blocked = ids.some((id) => sameGamePlayerIds.has(id));
    playerQueue.push({
      priority: playerPriority++,
      action: `Merge exact-name duplicate: ${dup.display_name} (${dup.gender})`,
      entityIds: ids,
      candidates: ids,
      risk: blocked ? "critical" : "high",
      expectedImpact: blocked
        ? "Same-game collision — manual review required before merge"
        : `Consolidates ${withStats.reduce((s, r) => s + r._count._all, 0)} GameStats under one Player`,
      mergeReadiness: blocked ? "blocked" : "review",
      effort: blocked ? "high" : "medium"
    });
  }

  const fuzzyClusters: Array<{
    names: string[];
    playerIds: string[];
    sharedTeams: string[];
    overlappingStats: number;
    confidence: string;
  }> = [];
  const seen = new Set<string>();
  const fuzzyGroups = new Map<string, typeof playersWithStats>();

  function clusterKey(ids: string[]) {
    return ids.sort().join("|");
  }

  for (const player of playersWithStats) {
    const fuzzyKey = `${player.gender}:${normalizeName(lastNameKey(player.displayName))}`;
    fuzzyGroups.set(fuzzyKey, [...(fuzzyGroups.get(fuzzyKey) ?? []), player]);
  }

  for (const group of fuzzyGroups.values()) {
    if (group.length < 2 || group.length > 4) continue;
    const firstTokens = new Set(group.map((p) => normalizeName(p.displayName.split(/\s+/)[0] ?? "")));
    if (firstTokens.size === group.length) continue;
    const key = clusterKey(group.map((p) => p.id));
    if (seen.has(key)) continue;
    seen.add(key);

    const teamSets = group.map((p) => new Set(p.gameStats.map((s) => s.team?.name ?? s.teamId)));
    const sharedTeams = [...teamSets[0]].filter((t) => teamSets.every((s) => s.has(t)));
    const gameIds = new Set<string>();
    let overlapping = 0;
    for (const p of group) {
      for (const s of p.gameStats) {
        if (gameIds.has(s.gameId)) overlapping += 1;
        gameIds.add(s.gameId);
      }
    }
    fuzzyClusters.push({
      names: group.map((p) => p.displayName),
      playerIds: group.map((p) => p.id),
      sharedTeams,
      overlappingStats: overlapping,
      confidence: group.some((p) => p.gameStats.length > 10) ? "medium" : "low"
    });
  }

  fuzzyClusters.sort(
    (a, b) =>
      (b.sharedTeams.length > 0 ? 2 : 0) + (b.overlappingStats > 0 ? -3 : 0) - (a.sharedTeams.length > 0 ? 2 : 0)
  );

  for (const cluster of fuzzyClusters) {
    const blocked = cluster.overlappingStats > 0;
    const ready = cluster.sharedTeams.length > 0 && !blocked;
    playerQueue.push({
      priority: playerPriority++,
      action: `Review fuzzy duplicate: ${cluster.names.join(" / ")}`,
      entityIds: cluster.playerIds,
      candidates: cluster.names,
      risk: blocked ? "critical" : ready ? "medium" : "low",
      expectedImpact: blocked
        ? "Overlapping game evidence — do not auto-merge"
        : ready
          ? `Shared team context (${cluster.sharedTeams[0]}); likely single identity`
          : "No shared games; confirm manually",
      mergeReadiness: blocked ? "blocked" : ready ? "ready" : "review",
      effort: blocked ? "high" : ready ? "low" : "medium"
    });
  }

  for (const group of importKeySplitGroups) {
    const statPlayers = await prisma.gameStat.groupBy({
      by: ["playerId"],
      where: { deletedAt: null, playerId: { in: group.playerIds } },
      _count: { _all: true }
    });
    if (statPlayers.filter((r) => r._count._all > 0).length < 2) continue;
    const blocked = group.playerIds.some((id) => sameGamePlayerIds.has(id));
    playerQueue.push({
      priority: playerPriority++,
      action: `Merge import-key split: ${group.displayNames.join(" / ")}`,
      entityIds: group.playerIds,
      candidates: group.displayNames,
      risk: blocked ? "critical" : "high",
      expectedImpact: `Import resolution maps one key to ${group.playerIds.length} Player IDs`,
      mergeReadiness: blocked ? "blocked" : "review",
      effort: "medium"
    });
  }

  // Re-sort queues by risk then impact
  const riskRank: Record<Risk, number> = { critical: 4, high: 3, medium: 2, low: 1 };
  const sortQueue = (q: QueueItem[]) =>
    q
      .sort((a, b) => riskRank[b.risk] - riskRank[a.risk] || a.effort.localeCompare(b.effort))
      .map((item, i) => ({ ...item, priority: i + 1 }));

  const sortedProgram = sortQueue(programQueue);
  const sortedTeam = sortQueue(teamQueue);
  const sortedPlayer = sortQueue(playerQueue);

  const auditSections = {
    duplicatePrograms: {
      candidates: sortedProgram.filter((q) => q.action.includes("program") || q.action.includes("Consolidate")),
      risk: sortedProgram.some((q) => q.risk === "high") ? "high" : "low",
      impact: `${programGroups.size > 0 ? Array.from(programGroups.values()).filter((g) => g.length > 1).length : 0} duplicate group(s); ${programsWithoutTeams.length} empty orphan program(s)`,
      executionOrder: sortedProgram.map((q) => q.priority)
    },
    teamFragmentation: {
      candidates: sortedTeam.filter((q) => q.action.includes("fragmentation") || q.action.includes("zero-stat")),
      risk: highImpactFragmentation.length > 0 ? "high" : "medium",
      impact: `${programsWithMultiple.length} programs with multiple teams; ${highImpactFragmentation.length} high-impact competition-context splits`,
      executionOrder: sortedTeam.filter((q) => q.action.includes("fragmentation") || q.action.includes("Batch")).map((q) => q.priority)
    },
    duplicatePlayers: {
      candidates: sortedPlayer.filter((q) => q.action.includes("exact-name") || q.action.includes("fuzzy")),
      risk: sortedPlayer.some((q) => q.risk === "critical") ? "critical" : "medium",
      impact: `${displayNameDuplicates.length} exact-name groups; ${fuzzyClusters.length} fuzzy clusters`,
      executionOrder: sortedPlayer.map((q) => q.priority)
    },
    orphanTeams: {
      candidates: sortedTeam.filter((q) => q.action.includes("orphan") || q.action.includes("zero-activity")),
      risk: teamsWithoutProgram.some((t) => t._count.gameStats > 0) ? "high" : "low",
      impact: `${orphanTeams.length} zero-activity teams; ${teamsWithoutProgram.length} teams without programId`,
      executionOrder: sortedTeam.filter((q) => q.action.includes("orphan") || q.action.includes("zero")).map((q) => q.priority)
    },
    programTeamInconsistencies: {
      candidates: [...sortedProgram.filter((q) => q.action.includes("mismatch")), ...sortedTeam.filter((q) => q.action.includes("programId"))],
      risk: playerProgramMismatch.length > 0 || teamsWithoutProgram.length > 0 ? "medium" : "low",
      impact: `${playerProgramMismatch.length} player program mismatches; ${teamsWithoutProgram.length} unlinked teams`,
      executionOrder: []
    },
    playerIdentityFragmentation: {
      candidates: sortedPlayer.filter((q) => q.action.includes("import-key")),
      risk: importKeySplitGroups.length > 0 ? "high" : "low",
      impact: `${importKeySplitGroups.length} import-key split group(s)`,
      executionOrder: sortedPlayer.filter((q) => q.action.includes("import-key")).map((q) => q.priority)
    },
    mergeReadiness: {
      ready: sortedPlayer.filter((q) => q.mergeReadiness === "ready").length,
      review: sortedPlayer.filter((q) => q.mergeReadiness === "review").length,
      blocked: sortedPlayer.filter((q) => q.mergeReadiness === "blocked").length,
      candidates: sortedPlayer.filter((q) => q.mergeReadiness === "ready"),
      risk: sortedPlayer.some((q) => q.mergeReadiness === "blocked") ? "high" : "medium",
      impact: `${sortedPlayer.filter((q) => q.mergeReadiness === "ready").length} merge-ready; ${sortedPlayer.filter((q) => q.mergeReadiness === "blocked").length} blocked`,
      executionOrder: sortedPlayer.filter((q) => q.mergeReadiness === "ready").map((q) => q.priority)
    }
  };

  const payload = {
    generatedAt: new Date().toISOString(),
    mode: "read-only",
    assumptions: ["PYBC games imported", "Submission imports processed", "Competition coverage not primary bottleneck"],
    liveCounts: {
      programs: programs.length,
      teams: activeTeams.length,
      displayNameDuplicateGroups: displayNameDuplicates.length,
      fuzzyPlayerClusters: fuzzyClusters.length,
      importKeySplitGroups: importKeySplitGroups.length,
      orphanTeams: orphanTeams.length,
      teamsWithoutProgram: teamsWithoutProgram.length,
      highImpactContextFragmentation: highImpactFragmentation.length
    },
    auditSections,
    programCleanupQueue: sortedProgram,
    teamCleanupQueue: sortedTeam,
    playerMergeQueue: sortedPlayer
  };

  const outDir = join(process.cwd(), "docs", "planning", "audits");
  mkdirSync(outDir, { recursive: true });
  const jsonPath = join(outDir, "identity-integrity-sweep.json");
  writeFileSync(jsonPath, JSON.stringify(payload, null, 2), "utf8");

  const md = formatMarkdown(payload);
  const mdPath = join(outDir, "IDENTITY_INTEGRITY_SWEEP.md");
  writeFileSync(mdPath, md, "utf8");

  console.log(JSON.stringify({ jsonPath, mdPath, counts: payload.liveCounts }, null, 2));
}

function formatMarkdown(payload: ReturnType<typeof main> extends Promise<infer T> ? T : never): string {
  const p = payload as {
    generatedAt: string;
    liveCounts: Record<string, number>;
    auditSections: Record<string, { candidates: QueueItem[]; risk: string; impact: string; executionOrder: number[]; ready?: number; review?: number; blocked?: number }>;
    programCleanupQueue: QueueItem[];
    teamCleanupQueue: QueueItem[];
    playerMergeQueue: QueueItem[];
  };

  const queueTable = (items: QueueItem[]) =>
    items
      .map(
        (q) =>
          `| ${q.priority} | ${q.action} | ${q.entityIds.length} | ${q.risk} | ${q.expectedImpact} | ${q.effort} |`
      )
      .join("\n");

  return `# Identity Integrity Sweep

**Generated:** ${p.generatedAt}  
**Mode:** Read-only

---

## 1. Program Cleanup Queue

| Prio | Action | Entities | Risk | Expected Impact | Effort |
|---:|---|---:|---|---|---|
${queueTable(p.programCleanupQueue)}

---

## 2. Team Cleanup Queue

| Prio | Action | Entities | Risk | Expected Impact | Effort |
|---:|---|---:|---|---|---|
${queueTable(p.teamCleanupQueue)}

---

## 3. Player Merge Queue

| Prio | Action | Entities | Risk | Expected Impact | Effort | Readiness |
|---:|---|---:|---|---|---|---|
${p.playerMergeQueue.map((q) => `| ${q.priority} | ${q.action} | ${q.entityIds.length} | ${q.risk} | ${q.expectedImpact} | ${q.effort} | ${q.mergeReadiness ?? "—"} |`).join("\n")}
`;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
