/**
 * Validation Phase B — read-only player identity audit.
 * Usage: npx tsx scripts/phase-b-identity-audit.ts
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { PlayerGender } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { normalizeImportedPlayerNameKey } from "../src/lib/player-import-identity";

type Severity = "critical" | "high" | "medium" | "low" | "info";

type Finding = {
  id: string;
  severity: Severity;
  category: string;
  summary: string;
  count: number;
  sample?: unknown[];
};

function classifyDuplicateGroup(input: {
  playerCount: number;
  withStats: number;
  sameGameConflicts: number;
}): Severity {
  if (input.sameGameConflicts > 0) return "critical";
  if (input.withStats > 1) return "high";
  if (input.playerCount > 1) return "medium";
  return "info";
}

function loadMergePlanDuplicateIds(): string[] {
  const paths = [
    join(process.cwd(), "scripts", "reports", "approved-player-merge-plan.json"),
    join(process.cwd(), "scripts", "reports", "approved-player-merge-plan-round-2.json")
  ];
  const ids = new Set<string>();
  for (const planPath of paths) {
    if (!existsSync(planPath)) continue;
    try {
      const plan = JSON.parse(readFileSync(planPath, "utf8")) as {
        approvedGroups?: Array<{ duplicatePlayerIds?: string[] }>;
      };
      for (const group of plan.approvedGroups ?? []) {
        for (const id of group.duplicatePlayerIds ?? []) ids.add(id);
      }
    } catch {
      // ignore unreadable plan files
    }
  }
  return Array.from(ids);
}

async function main() {
  const findings: Finding[] = [];
  const blockers: string[] = [];

  const [
    activePlayerCount,
    deletedPlayerCount,
    aliasCount,
    externalAliasCount,
    activePlayersWithStats,
    activePlayersWithoutStats
  ] = await Promise.all([
    prisma.player.count({ where: { deletedAt: null } }),
    prisma.player.count({ where: { deletedAt: { not: null } } }),
    prisma.playerAlias.count(),
    prisma.playerExternalAlias.count(),
    prisma.player.count({
      where: { deletedAt: null, gameStats: { some: { deletedAt: null } } }
    }),
    prisma.player.count({
      where: { deletedAt: null, gameStats: { none: { deletedAt: null } } }
    })
  ]);

  // ── 1. Exact displayName + gender duplicate audit ─────────────────────────
  const displayNameDuplicates = await prisma.$queryRaw<
    Array<{
      display_name: string;
      gender: PlayerGender;
      player_count: number;
      player_ids: string[];
    }>
  >`
    SELECT
      p."displayName" AS display_name,
      p.gender,
      COUNT(*)::int AS player_count,
      array_agg(p.id ORDER BY p."createdAt") AS player_ids
    FROM players p
    WHERE p."deletedAt" IS NULL
    GROUP BY p."displayName", p.gender
    HAVING COUNT(*) > 1
    ORDER BY player_count DESC, display_name ASC
  `;

  const duplicateGroupsWithStats: Array<{
    displayName: string;
    gender: PlayerGender;
    playerIds: string[];
    playersWithStats: number;
    totalGameStats: number;
  }> = [];

  for (const group of displayNameDuplicates) {
    const statsByPlayer = await prisma.gameStat.groupBy({
      by: ["playerId"],
      where: { deletedAt: null, playerId: { in: group.player_ids } },
      _count: { _all: true }
    });
    const playersWithStats = statsByPlayer.length;
    const totalGameStats = statsByPlayer.reduce((sum, row) => sum + row._count._all, 0);
    duplicateGroupsWithStats.push({
      displayName: group.display_name,
      gender: group.gender,
      playerIds: group.player_ids,
      playersWithStats,
      totalGameStats
    });
  }

  const duplicateGroupsWithMultipleStats = duplicateGroupsWithStats.filter((g) => g.playersWithStats > 1);
  if (displayNameDuplicates.length > 0) {
    findings.push({
      id: "displayName-gender-duplicates",
      severity: duplicateGroupsWithMultipleStats.length > 0 ? "high" : "medium",
      category: "displayName_duplicates",
      summary: `${displayNameDuplicates.length} active displayName+gender group(s) have multiple Player records.`,
      count: displayNameDuplicates.length,
      sample: duplicateGroupsWithStats.slice(0, 15)
    });
    if (duplicateGroupsWithMultipleStats.length > 0) {
      blockers.push(
        `${duplicateGroupsWithMultipleStats.length} displayName+gender duplicate group(s) have multiple players with GameStats — import resolution will block or mis-route.`
      );
    }
  }

  // ── 2. Alias collision audit ─────────────────────────────────────────────
  const aliasesToDeletedPlayers = await prisma.playerAlias.findMany({
    where: { player: { deletedAt: { not: null } } },
    select: {
      id: true,
      aliasName: true,
      gender: true,
      source: true,
      player: { select: { id: true, displayName: true, deletedAt: true } }
    },
    orderBy: { aliasName: "asc" }
  });

  const aliasNameConflicts = await prisma.$queryRaw<
    Array<{
      alias_id: string;
      alias_name: string;
      gender: PlayerGender;
      alias_player_id: string;
      alias_canonical_name: string;
      conflicting_player_id: string;
    }>
  >`
    SELECT
      pa.id AS alias_id,
      pa."aliasName" AS alias_name,
      pa.gender,
      pa."playerId" AS alias_player_id,
      canonical."displayName" AS alias_canonical_name,
      conflict.id AS conflicting_player_id
    FROM player_aliases pa
    JOIN players canonical ON canonical.id = pa."playerId"
    JOIN players conflict
      ON conflict."displayName" = pa."aliasName"
     AND conflict.gender = pa.gender
     AND conflict."deletedAt" IS NULL
     AND conflict.id <> pa."playerId"
    ORDER BY pa."aliasName", pa.gender
  `;

  const aliasMatchesCanonicalDisplayName = await prisma.$queryRaw<
    Array<{ alias_id: string; alias_name: string; gender: PlayerGender; player_id: string }>
  >`
    SELECT pa.id AS alias_id, pa."aliasName" AS alias_name, pa.gender, pa."playerId" AS player_id
    FROM player_aliases pa
    JOIN players p ON p.id = pa."playerId" AND p."deletedAt" IS NULL
    WHERE pa."aliasName" = p."displayName"
  `;

  if (aliasesToDeletedPlayers.length > 0) {
    findings.push({
      id: "alias-points-to-deleted-player",
      severity: "high",
      category: "alias_collision",
      summary: `${aliasesToDeletedPlayers.length} PlayerAlias row(s) point to soft-deleted players — imports using these names will block.`,
      count: aliasesToDeletedPlayers.length,
      sample: aliasesToDeletedPlayers.slice(0, 20)
    });
    blockers.push(
      `${aliasesToDeletedPlayers.length} PlayerAlias row(s) reference merged-away players; resolve before new imports using those alias strings.`
    );
  }

  if (aliasNameConflicts.length > 0) {
    findings.push({
      id: "alias-name-active-player-conflict",
      severity: "high",
      category: "alias_collision",
      summary: `${aliasNameConflicts.length} alias string(s) match a different active player's displayName — ambiguous import resolution.`,
      count: aliasNameConflicts.length,
      sample: aliasNameConflicts.slice(0, 20)
    });
    blockers.push(
      `${aliasNameConflicts.length} alias/displayName collision(s) can cause wrong-player imports or blocked imports.`
    );
  }

  if (aliasMatchesCanonicalDisplayName.length > 0) {
    findings.push({
      id: "alias-equals-canonical-displayName",
      severity: "low",
      category: "alias_collision",
      summary: `${aliasMatchesCanonicalDisplayName.length} redundant alias row(s) where aliasName equals canonical displayName.`,
      count: aliasMatchesCanonicalDisplayName.length,
      sample: aliasMatchesCanonicalDisplayName.slice(0, 10)
    });
  }

  // ── 3. Post-merge recreation audit ───────────────────────────────────────
  const mergePlanDuplicateIds = loadMergePlanDuplicateIds();
  const mergePlanDuplicatesStillActive = mergePlanDuplicateIds.length
    ? await prisma.player.findMany({
        where: { id: { in: mergePlanDuplicateIds }, deletedAt: null },
        select: { id: true, displayName: true, gender: true }
      })
    : [];

  const mergePlanDuplicatesWithLingeringStats = mergePlanDuplicateIds.length
    ? await prisma.gameStat.groupBy({
        by: ["playerId"],
        where: { deletedAt: null, playerId: { in: mergePlanDuplicateIds } },
        _count: { _all: true }
      })
    : [];

  const recreatedAfterMerge = await prisma.$queryRaw<
    Array<{
      deleted_id: string;
      deleted_name: string;
      gender: PlayerGender;
      deleted_at: Date;
      active_id: string;
      active_created_at: Date;
      active_stat_count: number;
    }>
  >`
    SELECT
      deleted.id AS deleted_id,
      deleted."displayName" AS deleted_name,
      deleted.gender,
      deleted."deletedAt" AS deleted_at,
      active.id AS active_id,
      active."createdAt" AS active_created_at,
      (
        SELECT COUNT(*)::int
        FROM game_stats gs
        WHERE gs."playerId" = active.id AND gs."deletedAt" IS NULL
      ) AS active_stat_count
    FROM players deleted
    JOIN players active
      ON active."displayName" = deleted."displayName"
     AND active.gender = deleted.gender
     AND active."deletedAt" IS NULL
     AND active.id <> deleted.id
    WHERE deleted."deletedAt" IS NOT NULL
      AND active."createdAt" > deleted."deletedAt"
    ORDER BY deleted."displayName", active."createdAt"
  `;

  const recreatedWithStats = recreatedAfterMerge.filter((row) => row.active_stat_count > 0);

  if (mergePlanDuplicatesStillActive.length > 0) {
    findings.push({
      id: "merge-plan-duplicates-still-active",
      severity: "high",
      category: "post_merge_recreation",
      summary: `${mergePlanDuplicatesStillActive.length} player ID(s) from approved merge plans are still active (merge incomplete).`,
      count: mergePlanDuplicatesStillActive.length,
      sample: mergePlanDuplicatesStillActive.slice(0, 20)
    });
    blockers.push(`${mergePlanDuplicatesStillActive.length} approved-merge duplicate player(s) were never soft-deleted.`);
  }

  if (mergePlanDuplicatesWithLingeringStats.length > 0) {
    findings.push({
      id: "merge-plan-duplicates-with-stats",
      severity: "critical",
      category: "post_merge_recreation",
      summary: `${mergePlanDuplicatesWithLingeringStats.length} merged-away duplicate player ID(s) still have active GameStats.`,
      count: mergePlanDuplicatesWithLingeringStats.length,
      sample: mergePlanDuplicatesWithLingeringStats.slice(0, 20)
    });
    blockers.push("Merged duplicate players still own active GameStats — merge cleanup incomplete.");
  }

  if (recreatedAfterMerge.length > 0) {
    findings.push({
      id: "post-merge-displayName-recreation",
      severity: recreatedWithStats.length > 0 ? "high" : "medium",
      category: "post_merge_recreation",
      summary: `${recreatedAfterMerge.length} soft-deleted player name(s) were recreated as new active Player records (${recreatedWithStats.length} with stats).`,
      count: recreatedAfterMerge.length,
      sample: recreatedAfterMerge.slice(0, 20)
    });
    if (recreatedWithStats.length > 0) {
      blockers.push(
        `${recreatedWithStats.length} post-merge recreation(s) have active GameStats — potential split identity after merge.`
      );
    }
  }

  // ── 4. Same-game duplicate-name audit ────────────────────────────────────
  const sameGameExactNameDuplicates = await prisma.$queryRaw<
    Array<{
      game_id: string;
      game_number: string | null;
      game_date: Date;
      display_name: string;
      gender: PlayerGender;
      player_ids: string[];
      stat_rows: number;
    }>
  >`
    SELECT
      g.id AS game_id,
      g."gameNumber" AS game_number,
      g."gameDate" AS game_date,
      p."displayName" AS display_name,
      p.gender,
      array_agg(DISTINCT gs."playerId") AS player_ids,
      COUNT(gs.id)::int AS stat_rows
    FROM game_stats gs
    JOIN players p ON p.id = gs."playerId" AND p."deletedAt" IS NULL
    JOIN games g ON g.id = gs."gameId" AND g."deletedAt" IS NULL
    WHERE gs."deletedAt" IS NULL
    GROUP BY g.id, g."gameNumber", g."gameDate", p."displayName", p.gender
    HAVING COUNT(DISTINCT gs."playerId") > 1
    ORDER BY stat_rows DESC
  `;

  const sameGameNormalizedKeyDuplicates = await prisma.$queryRaw<
    Array<{
      game_id: string;
      game_number: string | null;
      normalized_key: string;
      gender: PlayerGender;
      display_names: string[];
      player_ids: string[];
    }>
  >`
    WITH stat_names AS (
      SELECT
        gs."gameId" AS game_id,
        gs."playerId" AS player_id,
        p.gender,
        p."displayName" AS display_name,
        upper(regexp_replace(trim(p."displayName"), '\s+', ' ', 'g')) AS normalized_key
      FROM game_stats gs
      JOIN players p ON p.id = gs."playerId" AND p."deletedAt" IS NULL
      WHERE gs."deletedAt" IS NULL
    )
    SELECT
      sn.game_id,
      g."gameNumber" AS game_number,
      sn.normalized_key,
      sn.gender,
      array_agg(DISTINCT sn.display_name ORDER BY sn.display_name) AS display_names,
      array_agg(DISTINCT sn.player_id) AS player_ids
    FROM stat_names sn
    JOIN games g ON g.id = sn.game_id AND g."deletedAt" IS NULL
    GROUP BY sn.game_id, g."gameNumber", sn.normalized_key, sn.gender
    HAVING COUNT(DISTINCT sn.player_id) > 1
    ORDER BY array_length(array_agg(DISTINCT sn.player_id), 1) DESC
  `;

  if (sameGameExactNameDuplicates.length > 0) {
    findings.push({
      id: "same-game-exact-displayName",
      severity: "critical",
      category: "same_game_duplicate_name",
      summary: `${sameGameExactNameDuplicates.length} game(s) contain multiple active Player IDs with the same displayName+gender.`,
      count: sameGameExactNameDuplicates.length,
      sample: sameGameExactNameDuplicates.slice(0, 15)
    });
    blockers.push(
      `${sameGameExactNameDuplicates.length} same-game exact-name collision(s) — unsafe to auto-merge; distinct players may share a name.`
    );
  }

  const sameGameNormalizedOnly = sameGameNormalizedKeyDuplicates.filter(
    (row) => row.display_names.length > 1 || row.player_ids.length > 1
  );
  const normalizedOnlyNotExact = sameGameNormalizedOnly.filter(
    (row) => row.display_names.length > 1
  );
  if (normalizedOnlyNotExact.length > 0) {
    findings.push({
      id: "same-game-normalized-key-variants",
      severity: "medium",
      category: "same_game_duplicate_name",
      summary: `${normalizedOnlyNotExact.length} game(s) have different displayName spellings normalizing to the same import key across multiple player IDs.`,
      count: normalizedOnlyNotExact.length,
      sample: normalizedOnlyNotExact.slice(0, 15)
    });
  }

  // ── 5. Import-key split audit ────────────────────────────────────────────
  const activePlayers = await prisma.player.findMany({
    where: { deletedAt: null },
    select: { id: true, displayName: true, gender: true, createdAt: true }
  });

  const importKeyGroups = new Map<string, typeof activePlayers>();
  for (const player of activePlayers) {
    const key = `${player.gender}|${normalizeImportedPlayerNameKey(player.displayName)}`;
    const group = importKeyGroups.get(key) ?? [];
    group.push(player);
    importKeyGroups.set(key, group);
  }

  const importKeySplits = Array.from(importKeyGroups.entries())
    .filter(([, players]) => players.length > 1)
    .map(([key, players]) => ({
      importKey: key,
      playerIds: players.map((p) => p.id),
      displayNames: players.map((p) => p.displayName),
      createdAtRange: {
        earliest: players.reduce((min, p) => (p.createdAt < min ? p.createdAt : min), players[0].createdAt).toISOString(),
        latest: players.reduce((max, p) => (p.createdAt > max ? p.createdAt : max), players[0].createdAt).toISOString()
      }
    }))
    .sort((a, b) => b.playerIds.length - a.playerIds.length);

  const importKeySplitIds = new Set(importKeySplits.flatMap((g) => g.playerIds));
  const importKeySplitStats = importKeySplitIds.size
    ? await prisma.gameStat.groupBy({
        by: ["playerId"],
        where: { deletedAt: null, playerId: { in: Array.from(importKeySplitIds) } },
        _count: { _all: true }
      })
    : [];
  const splitGroupsWithMultipleStatPlayers = importKeySplits.filter((group) => {
    const statPlayers = group.playerIds.filter((id) =>
      importKeySplitStats.some((row) => row.playerId === id && row._count._all > 0)
    );
    return statPlayers.length > 1;
  });

  if (importKeySplits.length > 0) {
    findings.push({
      id: "import-key-split",
      severity: splitGroupsWithMultipleStatPlayers.length > 0 ? "high" : "medium",
      category: "import_key_split",
      summary: `${importKeySplits.length} normalized import-key+gender group(s) map to multiple active Player IDs (${splitGroupsWithMultipleStatPlayers.length} with stats on 2+ IDs).`,
      count: importKeySplits.length,
      sample: importKeySplits.slice(0, 20)
    });
    if (splitGroupsWithMultipleStatPlayers.length > 0) {
      blockers.push(
        `${splitGroupsWithMultipleStatPlayers.length} import-key split group(s) have GameStats on multiple player IDs — identity fragmentation.`
      );
    }
  }

  const externalAliasSplits = await prisma.$queryRaw<
    Array<{
      provider: string;
      normalized_external_label: string;
      player_count: number;
      player_ids: string[];
    }>
  >`
    SELECT
      pea.provider,
      pea."normalizedExternalLabel" AS normalized_external_label,
      COUNT(DISTINCT pea."playerId")::int AS player_count,
      array_agg(DISTINCT pea."playerId") AS player_ids
    FROM player_external_aliases pea
    JOIN players p ON p.id = pea."playerId" AND p."deletedAt" IS NULL
    GROUP BY pea.provider, pea."normalizedExternalLabel"
    HAVING COUNT(DISTINCT pea."playerId") > 1
    ORDER BY player_count DESC
  `;

  if (externalAliasSplits.length > 0) {
    findings.push({
      id: "external-alias-split",
      severity: "high",
      category: "import_key_split",
      summary: `${externalAliasSplits.length} external import label(s) map to multiple active players.`,
      count: externalAliasSplits.length,
      sample: externalAliasSplits.slice(0, 15)
    });
    blockers.push(`${externalAliasSplits.length} PlayerExternalAlias split(s) — URL/stats provider identity fragmented.`);
  }

  // ── 6. Orphan player audit ───────────────────────────────────────────────
  const orphanPlayers = await prisma.player.findMany({
    where: {
      deletedAt: null,
      gameStats: { none: { deletedAt: null } },
      currentRatings: { none: {} },
      rosterSeasons: { none: {} },
      rankingRows: { none: {} }
    },
    select: {
      id: true,
      displayName: true,
      gender: true,
      createdAt: true,
      currentProgramId: true,
      aliases: { select: { aliasName: true } },
      externalAliases: { select: { provider: true, externalLabel: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  const orphanWithAliases = orphanPlayers.filter((p) => p.aliases.length > 0 || p.externalAliases.length > 0);

  if (orphanPlayers.length > 0) {
    findings.push({
      id: "orphan-players",
      severity: orphanWithAliases.length > 0 ? "medium" : "low",
      category: "orphan_players",
      summary: `${orphanPlayers.length} active player(s) have no GameStats, PlayerRating, roster, or snapshot rows.`,
      count: orphanPlayers.length,
      sample: orphanPlayers.slice(0, 25).map((p) => ({
        id: p.id,
        displayName: p.displayName,
        gender: p.gender,
        createdAt: p.createdAt.toISOString(),
        aliasCount: p.aliases.length,
        externalAliasCount: p.externalAliases.length
      }))
    });
  }

  // ── 7. Active vs soft-deleted overlap review ─────────────────────────────
  const activeDeletedOverlap = await prisma.$queryRaw<
    Array<{
      display_name: string;
      gender: PlayerGender;
      active_count: number;
      deleted_count: number;
      active_ids: string[];
      deleted_ids: string[];
    }>
  >`
    SELECT
      active."displayName" AS display_name,
      active.gender,
      COUNT(DISTINCT active.id)::int AS active_count,
      COUNT(DISTINCT deleted.id)::int AS deleted_count,
      array_agg(DISTINCT active.id) AS active_ids,
      array_agg(DISTINCT deleted.id) AS deleted_ids
    FROM players active
    JOIN players deleted
      ON deleted."displayName" = active."displayName"
     AND deleted.gender = active.gender
     AND deleted."deletedAt" IS NOT NULL
     AND deleted.id <> active.id
    WHERE active."deletedAt" IS NULL
    GROUP BY active."displayName", active.gender
    ORDER BY deleted_count DESC, display_name ASC
  `;

  const overlapWithMultipleActive = activeDeletedOverlap.filter((row) => row.active_count > 1);
  if (activeDeletedOverlap.length > 0) {
    findings.push({
      id: "active-deleted-displayName-overlap",
      severity: overlapWithMultipleActive.length > 0 ? "high" : "low",
      category: "active_deleted_overlap",
      summary: `${activeDeletedOverlap.length} displayName+gender string(s) exist on both active and soft-deleted players (expected after approved merges when canonical predates duplicate).`,
      count: activeDeletedOverlap.length,
      sample: activeDeletedOverlap.slice(0, 20)
    });
  }

  const aliasSources = await prisma.playerAlias.groupBy({
    by: ["source"],
    _count: { _all: true }
  });
  aliasSources.sort((a, b) => b._count._all - a._count._all);

  const mergeAuditLogs = await prisma.auditLog.count({
    where: {
      OR: [
        { entityType: { contains: "player", mode: "insensitive" }, action: { contains: "merge", mode: "insensitive" } },
        { reason: { contains: "merge", mode: "insensitive" }, entityType: { contains: "player", mode: "insensitive" } }
      ]
    }
  });

  const severityRank: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
  const severityCounts = findings.reduce<Record<Severity, number>>(
    (acc, finding) => {
      acc[finding.severity] = (acc[finding.severity] ?? 0) + 1;
      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
  );

  const hasCritical = (severityCounts.critical ?? 0) > 0;
  const recommendation =
    hasCritical || blockers.length > 0
      ? "STOP"
      : findings.some((f) => f.severity === "high" || f.severity === "medium")
        ? "PROCEED_WITH_CAUTION"
        : "PROCEED";

  const report = {
    generatedAt: new Date().toISOString(),
    phase: "B-identity-audit",
    mode: "read-only",
    metrics: {
      players: { active: activePlayerCount, softDeleted: deletedPlayerCount },
      playerAlias: { total: aliasCount, bySource: aliasSources },
      playerExternalAlias: { total: externalAliasCount },
      activePlayersWithGameStats: activePlayersWithStats,
      activePlayersWithoutGameStats: activePlayersWithoutStats,
      displayNameGenderDuplicateGroups: displayNameDuplicates.length,
      displayNameDuplicatesWithMultipleStatPlayers: duplicateGroupsWithMultipleStats.length,
      aliasesToDeletedPlayers: aliasesToDeletedPlayers.length,
      aliasDisplayNameConflicts: aliasNameConflicts.length,
      mergePlanDuplicateIdsTracked: mergePlanDuplicateIds.length,
      mergePlanDuplicatesStillActive: mergePlanDuplicatesStillActive.length,
      mergePlanDuplicatesWithLingeringStats: mergePlanDuplicatesWithLingeringStats.length,
      postMergeRecreations: recreatedAfterMerge.length,
      postMergeRecreationsWithStats: recreatedWithStats.length,
      sameGameExactNameCollisions: sameGameExactNameDuplicates.length,
      sameGameNormalizedKeyCollisions: sameGameNormalizedKeyDuplicates.length,
      importKeySplitGroups: importKeySplits.length,
      importKeySplitGroupsWithMultipleStatPlayers: splitGroupsWithMultipleStatPlayers.length,
      externalAliasSplitGroups: externalAliasSplits.length,
      orphanPlayers: orphanPlayers.length,
      orphanPlayersWithAliases: orphanWithAliases.length,
      activeDeletedOverlapGroups: activeDeletedOverlap.length,
      auditLogMergeEntries: mergeAuditLogs
    },
    findings,
    severityCounts,
    blockers: Array.from(new Set(blockers)),
    recommendation
  };

  const reportPath = join(process.cwd(), "scripts", "reports", "phase-b-identity-audit-report.json");
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");

  console.log(JSON.stringify(report, null, 2));
  console.error(`\nWrote ${reportPath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
